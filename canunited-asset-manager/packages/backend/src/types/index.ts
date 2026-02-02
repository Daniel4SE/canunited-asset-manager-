// Local type definitions (replaces @canunited/shared for standalone deployment)

// Use const object for reliable cross-module imports
export const UserRole = {
  ADMIN: 'administrator',
  ANALYST: 'analyst',
  TECHNICIAN: 'technician',
  VIEWER: 'viewer',
  ASSET_MANAGER: 'asset_manager',
  FIELD_TECHNICIAN: 'field_technician',
  RELIABILITY_ENGINEER: 'reliability_engineer',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];
export type UserRoleType = UserRole;

export type VendorType = 'schneider' | 'abb' | 'siemens' | 'ge' | 'eaton' | 'other';

export type AssetType =
  | 'circuit_breaker'
  | 'transformer'
  | 'switchgear'
  | 'relay'
  | 'motor'
  | 'generator'
  | 'capacitor_bank'
  | 'cable'
  | 'busbar'
  | 'vfd'
  | 'ups'
  | 'battery'
  | 'meter'
  | 'other';

export type SensorType =
  | 'temperature'
  | 'vibration'
  | 'current'
  | 'voltage'
  | 'power'
  | 'power_factor'
  | 'frequency'
  | 'humidity'
  | 'pressure'
  | 'oil_level'
  | 'gas'
  | 'partial_discharge'
  | 'insulation_resistance'
  | 'contact_resistance'
  | 'other';

export type ProtocolType = 'modbus_tcp' | 'modbus_rtu' | 'iec61850' | 'dnp3' | 'opcua' | 'mqtt' | 'bacnet' | 'snmp';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown' | 'offline';

export const WSEventType = {
  SENSOR_READING: 'sensor_reading',
  ALERT_CREATED: 'alert_created',
  ALERT_UPDATED: 'alert_updated',
  ASSET_HEALTH_UPDATED: 'asset_health_updated',
  MAINTENANCE_STATUS_CHANGED: 'maintenance_status_changed',
  CONNECTION_STATUS: 'connection_status',
  GATEWAY_STATUS: 'gateway_status',
} as const;

export type WSEventTypeValue = typeof WSEventType[keyof typeof WSEventType];

export interface WSMessage {
  type: WSEventType;
  payload: any;
  timestamp: string;
}

// Role-based permissions
const RolePermissions: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'dashboard:view', 'dashboard:edit',
    'assets:view', 'assets:create', 'assets:edit', 'assets:delete',
    'sensors:view', 'sensors:create', 'sensors:edit', 'sensors:delete',
    'maintenance:view', 'maintenance:create', 'maintenance:edit', 'maintenance:delete', 'maintenance:assign',
    'alerts:view', 'alerts:acknowledge', 'alerts:resolve', 'alerts:create',
    'reports:view', 'reports:create', 'reports:export',
    'analytics:view', 'analytics:advanced',
    'topology:view', 'topology:edit',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'settings:view', 'settings:edit',
    'integrations:view', 'integrations:manage',
    'audit:view'
  ],
  [UserRole.ANALYST]: [
    'dashboard:view',
    'assets:view',
    'sensors:view',
    'maintenance:view',
    'alerts:view', 'alerts:acknowledge',
    'reports:view', 'reports:create', 'reports:export',
    'analytics:view', 'analytics:advanced',
    'topology:view',
    'audit:view'
  ],
  [UserRole.TECHNICIAN]: [
    'dashboard:view',
    'assets:view',
    'sensors:view',
    'maintenance:view', 'maintenance:edit',
    'alerts:view', 'alerts:acknowledge', 'alerts:resolve',
    'topology:view'
  ],
  [UserRole.VIEWER]: [
    'dashboard:view',
    'assets:view',
    'sensors:view',
    'maintenance:view',
    'alerts:view',
    'topology:view'
  ],
  [UserRole.ASSET_MANAGER]: [
    'dashboard:view', 'dashboard:edit',
    'assets:view', 'assets:create', 'assets:edit',
    'sensors:view', 'sensors:create', 'sensors:edit',
    'maintenance:view', 'maintenance:create', 'maintenance:edit', 'maintenance:assign',
    'alerts:view', 'alerts:acknowledge', 'alerts:resolve',
    'reports:view', 'reports:create', 'reports:export',
    'analytics:view',
    'topology:view', 'topology:edit'
  ],
  [UserRole.FIELD_TECHNICIAN]: [
    'dashboard:view',
    'assets:view',
    'sensors:view', 'sensors:edit',
    'maintenance:view', 'maintenance:edit',
    'alerts:view', 'alerts:acknowledge', 'alerts:resolve',
    'topology:view'
  ],
  [UserRole.RELIABILITY_ENGINEER]: [
    'dashboard:view',
    'assets:view', 'assets:edit',
    'sensors:view',
    'maintenance:view', 'maintenance:create', 'maintenance:edit',
    'alerts:view', 'alerts:acknowledge',
    'reports:view', 'reports:create', 'reports:export',
    'analytics:view', 'analytics:advanced',
    'topology:view'
  ]
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}
