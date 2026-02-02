import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

export const userRoutes = Router();

userRoutes.use(authenticate);

/**
 * Get list of users (for task assignment, etc.)
 * Returns users in the same organization
 */
userRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, isActive = 'true' } = req.query;

    let whereConditions = ['tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let paramIndex = 2;

    if (isActive === 'true') {
      whereConditions.push('is_active = true');
    }

    if (role) {
      whereConditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    const result = await query(
      `SELECT
        id,
        email,
        username,
        first_name,
        last_name,
        role,
        avatar_url,
        is_active,
        last_login_at
       FROM users
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY first_name, last_name`,
      params
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        username: row.username,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        roleLabel: getRoleLabel(row.role),
        avatarUrl: row.avatar_url,
        avatar: getInitials(row.first_name, row.last_name, row.email),
        isActive: row.is_active,
        lastLoginAt: row.last_login_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get users available for maintenance task assignment
 * Returns technicians, engineers, and managers
 */
userRoutes.get('/assignable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT
        id,
        email,
        first_name,
        last_name,
        role,
        avatar_url
       FROM users
       WHERE tenant_id = $1
       AND is_active = true
       AND role IN ('administrator', 'technician', 'asset_manager', 'field_technician', 'reliability_engineer')
       ORDER BY
         CASE role
           WHEN 'administrator' THEN 1
           WHEN 'asset_manager' THEN 2
           WHEN 'reliability_engineer' THEN 3
           WHEN 'technician' THEN 4
           WHEN 'field_technician' THEN 5
           ELSE 6
         END,
         first_name, last_name`,
      [req.user!.tenantId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
        role: row.role,
        roleLabel: getRoleLabel(row.role),
        avatar: getInitials(row.first_name, row.last_name, row.email),
        avatarUrl: row.avatar_url,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get current user profile
 */
userRoutes.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT
        id, email, username, first_name, last_name, phone, avatar_url,
        role, mfa_enabled, is_active, email_verified, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        email: row.email,
        username: row.username,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        role: row.role,
        roleLabel: getRoleLabel(row.role),
        mfaEnabled: row.mfa_enabled,
        isActive: row.is_active,
        emailVerified: row.email_verified,
        lastLoginAt: row.last_login_at,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    administrator: 'Administrator',
    analyst: 'Analyst',
    technician: 'Technician',
    viewer: 'Viewer',
    asset_manager: 'Asset Manager',
    field_technician: 'Field Technician',
    reliability_engineer: 'Reliability Engineer',
  };
  return labels[role] || role;
}

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}
