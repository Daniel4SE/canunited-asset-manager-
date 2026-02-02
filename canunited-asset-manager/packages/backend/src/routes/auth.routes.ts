import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, withTransaction } from '../db/connection.js';
import { redisClient } from '../cache/redis.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticate,
  JWTPayload,
} from '../middleware/auth.js';
import { badRequest, unauthorized, notFound } from '../middleware/errorHandler.js';
import { UserRole } from '../types/index.js';
import {
  setupMFA,
  verifyTOTP,
  verifyBackupCode,
  hashBackupCodes,
} from '../services/mfa/index.js';
import { config } from '../config/index.js';

export const authRoutes = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const mfaVerifySchema = z.object({
  userId: z.string().uuid(),
  code: z.string().min(6).max(10),
  tempToken: z.string(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organizationId: z.string().uuid().optional(),
  organizationName: z.string().min(2).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  mfa_backup_codes: string[] | null;
  site_access: string[];
  organization_id: string | null;
}

// Login - Step 1
authRoutes.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await query<UserRow>(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.username,
              u.first_name, u.last_name, u.role, u.is_active,
              u.mfa_enabled, u.mfa_secret, u.mfa_backup_codes,
              u.site_access,
              t.id as organization_id
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      unauthorized('Invalid email or password');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      unauthorized('Account is disabled');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Log failed attempt
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, details, ip_address)
         VALUES ($1, $2, 'login_failed', 'auth', $3, $4)`,
        [user.tenant_id, user.id, JSON.stringify({ reason: 'invalid_password' }), req.ip]
      );
      unauthorized('Invalid email or password');
    }

    // Check if MFA is enabled
    if (user.mfa_enabled && user.mfa_secret) {
      // Generate temporary token for MFA verification
      const tempToken = Buffer.from(
        JSON.stringify({ userId: user.id, exp: Date.now() + 5 * 60 * 1000 })
      ).toString('base64');

      // Store temp token in Redis (5 minutes expiry)
      await redisClient?.set(`mfa_temp:${user.id}`, tempToken, { EX: 300 });

      res.json({
        success: true,
        data: {
          requireMFA: true,
          userId: user.id,
          tempToken,
        },
      });
      return;
    }

    // No MFA - generate tokens directly
    await completeLogin(user, req, res);
  } catch (error) {
    next(error);
  }
});

// MFA Verification - Step 2
authRoutes.post('/mfa/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, code, tempToken } = mfaVerifySchema.parse(req.body);

    // Verify temp token
    const storedToken = await redisClient?.get(`mfa_temp:${userId}`);
    if (!storedToken || storedToken !== tempToken) {
      unauthorized('Invalid or expired MFA session');
    }

    // Get user
    const result = await query<UserRow>(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.username,
              u.first_name, u.last_name, u.role, u.is_active,
              u.mfa_enabled, u.mfa_secret, u.mfa_backup_codes,
              u.site_access,
              t.id as organization_id
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      notFound('User');
    }

    const user = result.rows[0];

    // Try TOTP first
    if (verifyTOTP(user.mfa_secret!, code)) {
      // Delete temp token
      await redisClient?.del(`mfa_temp:${userId}`);
      await completeLogin(user, req, res, true);
      return;
    }

    // Try backup code
    if (user.mfa_backup_codes && user.mfa_backup_codes.length > 0) {
      const { valid, usedIndex } = verifyBackupCode(code, user.mfa_backup_codes);
      if (valid) {
        // Remove used backup code
        const newBackupCodes = [...user.mfa_backup_codes];
        newBackupCodes[usedIndex] = ''; // Mark as used

        await query(
          'UPDATE users SET mfa_backup_codes = $1 WHERE id = $2',
          [newBackupCodes, userId]
        );

        // Delete temp token
        await redisClient?.del(`mfa_temp:${userId}`);
        await completeLogin(user, req, res, true);
        return;
      }
    }

    unauthorized('Invalid MFA code');
  } catch (error) {
    next(error);
  }
});

// Setup MFA
authRoutes.post('/mfa/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Check if already enabled
    const existingResult = await query<{ mfa_enabled: boolean }>(
      'SELECT mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (existingResult.rows[0]?.mfa_enabled) {
      badRequest('MFA is already enabled');
    }

    // Get user email
    const userResult = await query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    const mfaResult = await setupMFA(userResult.rows[0].email);

    // Store secret temporarily (user must confirm with a valid code)
    await redisClient?.set(
      `mfa_setup:${userId}`,
      JSON.stringify({
        secret: mfaResult.secret,
        backupCodes: mfaResult.backupCodes,
      }),
      { EX: 600 } // 10 minutes
    );

    res.json({
      success: true,
      data: {
        qrCodeUrl: mfaResult.qrCodeUrl,
        backupCodes: mfaResult.backupCodes,
        message: 'Scan QR code with your authenticator app, then verify with a code',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Confirm MFA Setup
authRoutes.post('/mfa/confirm', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    // Get pending setup
    const setupData = await redisClient?.get(`mfa_setup:${userId}`);
    if (!setupData) {
      badRequest('No pending MFA setup found');
    }

    const { secret, backupCodes } = JSON.parse(setupData!);

    // Verify the code
    if (!verifyTOTP(secret, code)) {
      badRequest('Invalid verification code');
    }

    // Enable MFA
    const hashedBackupCodes = hashBackupCodes(backupCodes);
    await query(
      `UPDATE users
       SET mfa_enabled = true, mfa_secret = $1, mfa_backup_codes = $2
       WHERE id = $3`,
      [secret, hashedBackupCodes, userId]
    );

    // Cleanup
    await redisClient?.del(`mfa_setup:${userId}`);

    // Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
       VALUES ($1, 'mfa_enabled', 'auth', '{}', $2)`,
      [userId, req.ip]
    );

    res.json({
      success: true,
      data: {
        message: 'MFA enabled successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Disable MFA
authRoutes.post('/mfa/disable', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { password, code } = z.object({
      password: z.string(),
      code: z.string().length(6),
    }).parse(req.body);

    // Verify password
    const userResult = await query<{ password_hash: string; mfa_secret: string }>(
      'SELECT password_hash, mfa_secret FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows.length) {
      notFound('User');
    }

    const { password_hash, mfa_secret } = userResult.rows[0];

    const isValidPassword = await bcrypt.compare(password, password_hash);
    if (!isValidPassword) {
      unauthorized('Invalid password');
    }

    // Verify MFA code
    if (!verifyTOTP(mfa_secret, code)) {
      unauthorized('Invalid MFA code');
    }

    // Disable MFA
    await query(
      `UPDATE users
       SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL
       WHERE id = $1`,
      [userId]
    );

    // Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
       VALUES ($1, 'mfa_disabled', 'auth', '{}', $2)`,
      [userId, req.ip]
    );

    res.json({
      success: true,
      data: {
        message: 'MFA disabled successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Refresh Token
authRoutes.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Verify refresh token
    let payload: JWTPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      unauthorized('Invalid refresh token');
      return;
    }

    // Check if token is blacklisted
    const isBlacklisted = await redisClient?.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      unauthorized('Token has been revoked');
    }

    // Get fresh user data
    const result = await query<UserRow>(
      `SELECT u.id, u.tenant_id, u.email, u.role, u.is_active, u.site_access,
              t.id as organization_id
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      unauthorized('User not found or inactive');
    }

    const user = result.rows[0];

    // Generate new tokens
    const newPayload: Omit<JWTPayload, 'tokenType'> = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenant_id,
      organizationId: user.organization_id || user.tenant_id,
      vendorAccess: [],
      siteAccess: user.site_access || ['*'],
      mfaVerified: payload.mfaVerified,
    };

    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    // Blacklist old refresh token
    await redisClient?.set(`blacklist:${refreshToken}`, '1', { EX: 7 * 24 * 60 * 60 });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Logout
authRoutes.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(req.body);

    // Blacklist refresh token if provided
    if (refreshToken) {
      await redisClient?.set(`blacklist:${refreshToken}`, '1', { EX: 7 * 24 * 60 * 60 });
    }

    // Log logout
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
       VALUES ($1, 'logout', 'auth', '{}', $2)`,
      [req.user!.userId, req.ip]
    );

    res.json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
authRoutes.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<{
      id: string;
      tenant_id: string;
      email: string;
      username: string;
      first_name: string;
      last_name: string;
      role: string;
      is_active: boolean;
      mfa_enabled: boolean;
      site_access: string[];
      avatar_url: string | null;
      last_login: string | null;
      tenant_name: string;
    }>(
      `SELECT u.id, u.tenant_id, u.email, u.username, u.first_name, u.last_name,
              u.role, u.is_active, u.mfa_enabled, u.site_access, u.avatar_url, u.last_login,
              t.name as tenant_name
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      notFound('User');
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        isActive: user.is_active,
        mfaEnabled: user.mfa_enabled,
        siteAccess: user.site_access,
        avatarUrl: user.avatar_url,
        lastLogin: user.last_login,
        tenantName: user.tenant_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Register (for demo purposes - in production this would be admin-only)
authRoutes.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existingUser.rows.length > 0) {
      badRequest('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    await withTransaction(async (client) => {
      let tenantId = data.organizationId;

      // Create tenant if name provided and no ID
      if (data.organizationName && !tenantId) {
        const tenantResult = await client.query(
          `INSERT INTO tenants (name, slug, settings)
           VALUES ($1, $2, '{}')
           RETURNING id`,
          [data.organizationName, data.organizationName.toLowerCase().replace(/\s+/g, '-')]
        );
        tenantId = tenantResult.rows[0].id;
      }

      if (!tenantId) {
        throw new Error('Organization ID or name is required');
      }

      // Create user
      const nameParts = data.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, username, first_name, last_name, role, tenant_id, site_access)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, email, role`,
        [data.email, passwordHash, data.email.split('@')[0], firstName, lastName, 'viewer', tenantId, ['*']]
      );

      const user = userResult.rows[0];

      const payload: Omit<JWTPayload, 'tokenType'> = {
        userId: user.id,
        email: user.email,
        role: UserRole.VIEWER,
        tenantId: tenantId!,
        organizationId: tenantId!,
        vendorAccess: [],
        siteAccess: ['*'],
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      res.status(201).json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: data.name,
            role: user.role,
            tenantId,
          },
        },
      });
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to complete login
async function completeLogin(
  user: UserRow,
  req: Request,
  res: Response,
  mfaVerified: boolean = false
): Promise<void> {
  // Update last login
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  const payload: Omit<JWTPayload, 'tokenType'> = {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    tenantId: user.tenant_id,
    organizationId: user.organization_id || user.tenant_id,
    vendorAccess: [],
    siteAccess: user.site_access || ['*'],
    mfaVerified,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token in Redis for session management
  await redisClient?.set(
    `session:${user.id}:${Date.now()}`,
    refreshToken,
    { EX: 7 * 24 * 60 * 60 }
  );

  // Log successful login
  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
     VALUES ($1, 'login_success', 'auth', $2, $3)`,
    [user.id, JSON.stringify({ mfaVerified }), req.ip]
  );

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        tenantId: user.tenant_id,
        mfaEnabled: user.mfa_enabled,
      },
    },
  });
}
