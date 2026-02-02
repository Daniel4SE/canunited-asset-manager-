import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/connection.js';
import { generateAccessToken, generateRefreshToken, authenticate, authorize } from '../middleware/auth.js';
import { SAMLService, OIDCService, createSSOService } from '../services/auth/sso.service.js';
import { LDAPService, createLDAPService } from '../services/auth/ldap.service.js';
import { UserRole } from '@canunited/shared';
import { redisClient } from '../cache/redis.js';
import crypto from 'crypto';

export const ssoRoutes = Router();

// ==================== SSO Initiation ====================

/**
 * Initiate SSO login for a tenant
 */
ssoRoutes.get('/initiate/:providerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;

    // Get SSO configuration
    const configResult = await query(
      `SELECT * FROM auth_configurations WHERE id = $1 AND is_enabled = true`,
      [providerId]
    );

    if (configResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'SSO_NOT_FOUND', message: 'SSO provider not found or disabled' },
      });
      return;
    }

    const config = configResult.rows[0];
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store state in Redis for validation
    await redisClient?.set(`sso_state:${state}`, JSON.stringify({
      providerId,
      tenantId: config.tenant_id,
      nonce,
      createdAt: Date.now(),
    }), { EX: 600 }); // 10 minutes

    if (config.provider === 'sso_oidc') {
      const oidcService = new OIDCService(config.configuration);
      const authUrl = oidcService.getAuthorizationUrl(state, nonce);
      res.redirect(authUrl);
    } else if (config.provider === 'sso_saml') {
      const samlService = new SAMLService(config.configuration);
      const { url } = samlService.generateAuthRequest();
      res.redirect(url);
    } else {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PROVIDER', message: 'Unknown SSO provider type' },
      });
    }
  } catch (error) {
    next(error);
  }
});

// ==================== OIDC Callback ====================

ssoRoutes.get('/oidc/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`/login?error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || !state) {
      res.redirect('/login?error=missing_parameters');
      return;
    }

    // Validate state
    const stateData = await redisClient?.get(`sso_state:${state}`);
    if (!stateData) {
      res.redirect('/login?error=invalid_state');
      return;
    }

    const { providerId, tenantId, nonce } = JSON.parse(stateData);
    await redisClient?.del(`sso_state:${state}`);

    // Get SSO configuration
    const configResult = await query(
      `SELECT * FROM auth_configurations WHERE id = $1`,
      [providerId]
    );

    if (configResult.rows.length === 0) {
      res.redirect('/login?error=provider_not_found');
      return;
    }

    const config = configResult.rows[0];
    const oidcService = new OIDCService(config.configuration);

    // Exchange code for tokens
    const tokens = await oidcService.exchangeCode(String(code));
    if (!tokens) {
      res.redirect('/login?error=token_exchange_failed');
      return;
    }

    // Get user info
    const userInfo = await oidcService.getUserInfo(tokens.accessToken);
    if (!userInfo) {
      res.redirect('/login?error=userinfo_failed');
      return;
    }

    // Find or create user
    const user = await findOrCreateSSOUser(tenantId, userInfo, 'sso_oidc');

    // Generate app tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenant_id,
      organizationId: user.tenant_id,
      vendorAccess: [],
      siteAccess: user.site_access || ['*'],
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenant_id,
      organizationId: user.tenant_id,
      vendorAccess: [],
      siteAccess: user.site_access || ['*'],
    });

    // Redirect to frontend with tokens
    res.redirect(`/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
  } catch (error) {
    console.error('[SSO] OIDC callback error:', error);
    res.redirect('/login?error=sso_failed');
  }
});

// ==================== SAML Callback ====================

ssoRoutes.post('/saml/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { SAMLResponse, RelayState } = req.body;

    if (!SAMLResponse) {
      res.redirect('/login?error=missing_saml_response');
      return;
    }

    // In production, validate and parse SAML response
    // For now, return an error indicating SAML needs full implementation

    res.redirect('/login?error=saml_not_implemented');
  } catch (error) {
    console.error('[SSO] SAML callback error:', error);
    res.redirect('/login?error=saml_failed');
  }
});

// ==================== LDAP Authentication ====================

ssoRoutes.post('/ldap/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, tenantId } = z.object({
      username: z.string(),
      password: z.string(),
      tenantId: z.string().uuid(),
    }).parse(req.body);

    // Get LDAP configuration for tenant
    const configResult = await query(
      `SELECT * FROM auth_configurations
       WHERE tenant_id = $1 AND provider = 'ldap' AND is_enabled = true`,
      [tenantId]
    );

    if (configResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'LDAP_NOT_CONFIGURED', message: 'LDAP not configured for this tenant' },
      });
      return;
    }

    const config = configResult.rows[0];
    const ldapService = new LDAPService(config.configuration);

    // Authenticate with LDAP
    const ldapUser = await ldapService.authenticate(username, password);

    if (!ldapUser) {
      res.status(401).json({
        success: false,
        error: { code: 'LDAP_AUTH_FAILED', message: 'LDAP authentication failed' },
      });
      return;
    }

    // Find or create user
    const user = await findOrCreateLDAPUser(tenantId, ldapUser);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenant_id,
      organizationId: user.tenant_id,
      vendorAccess: [],
      siteAccess: user.site_access || ['*'],
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenant_id,
      organizationId: user.tenant_id,
      vendorAccess: [],
      siteAccess: user.site_access || ['*'],
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          tenantId: user.tenant_id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== SSO Configuration Management ====================

/**
 * List SSO providers for a tenant
 */
ssoRoutes.get('/providers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT id, provider, name, is_enabled, is_default, created_at
       FROM auth_configurations
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [req.user!.tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create/Update SSO provider configuration (Admin only)
 */
ssoRoutes.post('/providers', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, name, configuration, isEnabled, isDefault } = z.object({
      provider: z.enum(['sso_saml', 'sso_oidc', 'ldap']),
      name: z.string().min(1),
      configuration: z.record(z.any()),
      isEnabled: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }).parse(req.body);

    const result = await query(
      `INSERT INTO auth_configurations (tenant_id, provider, name, configuration, is_enabled, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, provider, name, is_enabled, is_default, created_at`,
      [req.user!.tenantId, provider, name, configuration, isEnabled ?? false, isDefault ?? false]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test SSO connection
 */
ssoRoutes.post('/providers/:id/test', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM auth_configurations WHERE id = $1 AND tenant_id = $2`,
      [id, req.user!.tenantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Provider not found' },
      });
      return;
    }

    const config = result.rows[0];

    if (config.provider === 'ldap') {
      const ldapService = new LDAPService(config.configuration);
      const testResult = await ldapService.testConnection();

      res.json({
        success: testResult.success,
        data: { message: testResult.message },
      });
    } else {
      res.json({
        success: true,
        data: { message: 'Configuration valid. Use /initiate to test full flow.' },
      });
    }
  } catch (error) {
    next(error);
  }
});

// ==================== Helper Functions ====================

async function findOrCreateSSOUser(tenantId: string, userInfo: any, provider: string) {
  // Check if user exists
  let result = await query(
    `SELECT * FROM users WHERE tenant_id = $1 AND email = $2`,
    [tenantId, userInfo.email]
  );

  if (result.rows.length > 0) {
    // Update last login
    await query(
      `UPDATE users SET last_login_at = NOW(), auth_provider = $1 WHERE id = $2`,
      [provider, result.rows[0].id]
    );
    return result.rows[0];
  }

  // Create new user
  result = await query(
    `INSERT INTO users (tenant_id, email, username, first_name, last_name, role, auth_provider, external_id, email_verified, site_access)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
     RETURNING *`,
    [
      tenantId,
      userInfo.email,
      userInfo.email.split('@')[0],
      userInfo.givenName || userInfo.given_name || '',
      userInfo.familyName || userInfo.family_name || '',
      'viewer', // Default role, can be updated based on group claims
      provider,
      userInfo.sub,
      ['*'],
    ]
  );

  return result.rows[0];
}

async function findOrCreateLDAPUser(tenantId: string, ldapUser: any) {
  // Check if user exists
  let result = await query(
    `SELECT * FROM users WHERE tenant_id = $1 AND email = $2`,
    [tenantId, ldapUser.email]
  );

  if (result.rows.length > 0) {
    // Update last login
    await query(
      `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
      [result.rows[0].id]
    );
    return result.rows[0];
  }

  // Determine role from LDAP groups
  const ldapService = new LDAPService({} as any);
  const role = ldapService.mapGroupsToRole(ldapUser.groups || []);

  // Create new user
  result = await query(
    `INSERT INTO users (tenant_id, email, username, first_name, last_name, role, auth_provider, external_id, email_verified, site_access)
     VALUES ($1, $2, $3, $4, $5, $6, 'ldap', $7, true, $8)
     RETURNING *`,
    [
      tenantId,
      ldapUser.email,
      ldapUser.username,
      ldapUser.firstName,
      ldapUser.lastName,
      role,
      ldapUser.dn,
      ['*'],
    ]
  );

  return result.rows[0];
}
