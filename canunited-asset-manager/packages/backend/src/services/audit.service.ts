import { query } from '../db/connection.js';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an action to the audit_logs table
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.tenantId,
        entry.userId || null,
        entry.action,
        entry.entityType,
        entry.entityId || null,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
      ]
    );
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to write audit log:', error);
  }
}

// Common audit actions
export const AuditActions = {
  // Maintenance
  MAINTENANCE_CREATED: 'maintenance.created',
  MAINTENANCE_UPDATED: 'maintenance.updated',
  MAINTENANCE_STATUS_CHANGED: 'maintenance.status_changed',
  MAINTENANCE_ASSIGNED: 'maintenance.assigned',
  MAINTENANCE_COMPLETED: 'maintenance.completed',
  MAINTENANCE_DELETED: 'maintenance.deleted',
  MAINTENANCE_CHECKLIST_UPDATED: 'maintenance.checklist_updated',

  // Assets
  ASSET_CREATED: 'asset.created',
  ASSET_UPDATED: 'asset.updated',
  ASSET_DELETED: 'asset.deleted',

  // Alerts
  ALERT_CREATED: 'alert.created',
  ALERT_ACKNOWLEDGED: 'alert.acknowledged',
  ALERT_RESOLVED: 'alert.resolved',

  // Users
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_MFA_ENABLED: 'user.mfa_enabled',
  USER_MFA_DISABLED: 'user.mfa_disabled',
} as const;
