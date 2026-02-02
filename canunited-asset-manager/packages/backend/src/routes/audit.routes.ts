import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize, requirePermission } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

export const auditRoutes = Router();

auditRoutes.use(authenticate);

/**
 * Get audit logs for an entity (e.g., maintenance task history)
 */
auditRoutes.get('/entity/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = '1', perPage = '20' } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(perPage as string);
    const limit = parseInt(perPage as string);

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM audit_logs
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [req.user!.tenantId, entityType, entityId]
    );

    const result = await query(
      `SELECT a.*, u.first_name, u.last_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.tenant_id = $1 AND a.entity_type = $2 AND a.entity_id = $3
       ORDER BY a.created_at DESC
       LIMIT $4 OFFSET $5`,
      [req.user!.tenantId, entityType, entityId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        action: row.action,
        actionLabel: formatActionLabel(row.action),
        userId: row.user_id,
        userName: row.first_name && row.last_name
          ? `${row.first_name} ${row.last_name}`
          : row.user_email || 'System',
        oldValues: row.old_values,
        newValues: row.new_values,
        createdAt: row.created_at,
      })),
      meta: {
        page: parseInt(page as string),
        perPage: limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all audit logs (admin only)
 */
auditRoutes.get('/', requirePermission('audit:view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      entityType,
      action,
      userId,
      startDate,
      endDate,
      page = '1',
      perPage = '50'
    } = req.query;

    let whereConditions = ['a.tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let paramIndex = 2;

    if (entityType) {
      whereConditions.push(`a.entity_type = $${paramIndex++}`);
      params.push(entityType);
    }
    if (action) {
      whereConditions.push(`a.action LIKE $${paramIndex++}`);
      params.push(`%${action}%`);
    }
    if (userId) {
      whereConditions.push(`a.user_id = $${paramIndex++}`);
      params.push(userId);
    }
    if (startDate) {
      whereConditions.push(`a.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      whereConditions.push(`a.created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const offset = (parseInt(page as string) - 1) * parseInt(perPage as string);
    const limit = parseInt(perPage as string);

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM audit_logs a WHERE ${whereConditions.join(' AND ')}`,
      params
    );

    const result = await query(
      `SELECT a.*, u.first_name, u.last_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        action: row.action,
        actionLabel: formatActionLabel(row.action),
        entityType: row.entity_type,
        entityId: row.entity_id,
        userId: row.user_id,
        userName: row.first_name && row.last_name
          ? `${row.first_name} ${row.last_name}`
          : row.user_email || 'System',
        oldValues: row.old_values,
        newValues: row.new_values,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
      })),
      meta: {
        page: parseInt(page as string),
        perPage: limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'maintenance.created': 'Task Created',
    'maintenance.updated': 'Task Updated',
    'maintenance.status_changed': 'Status Changed',
    'maintenance.assigned': 'Task Assigned',
    'maintenance.completed': 'Task Completed',
    'maintenance.deleted': 'Task Deleted',
    'maintenance.checklist_updated': 'Checklist Updated',
    'asset.created': 'Asset Created',
    'asset.updated': 'Asset Updated',
    'asset.deleted': 'Asset Deleted',
    'alert.created': 'Alert Created',
    'alert.acknowledged': 'Alert Acknowledged',
    'alert.resolved': 'Alert Resolved',
    'user.login': 'User Login',
    'user.logout': 'User Logout',
    'user.password_changed': 'Password Changed',
    'user.mfa_enabled': 'MFA Enabled',
    'user.mfa_disabled': 'MFA Disabled',
  };
  return labels[action] || action;
}
