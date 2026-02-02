// CANUnited Asset Manager - Shared Types and Utilities

// ==================== ENUMS ====================

export enum VendorType {
  SCHNEIDER = 'schneider',
  ABB = 'abb',
  SIEMENS = 'siemens',
  BOSCH = 'bosch',
  EATON = 'eaton',
  GENERIC = 'generic'
}

export enum AssetType {
  MV_SWITCHGEAR = 'mv_switchgear',
  LV_PANEL = 'lv_panel',
  TRANSFORMER = 'transformer',
  CIRCUIT_BREAKER = 'circuit_breaker',
  BUSWAY = 'busway',
  SENSOR = 'sensor',
  GATEWAY = 'gateway',
  VFD = 'vfd',
  RELAY = 'relay',
  METER = 'meter'
}

export enum HealthStatus {
  EXCELLENT = 'excellent',     // 80-100
  GOOD = 'good',               // 60-79
  FAIR = 'fair',               // 40-59
  POOR = 'poor',               // 20-39
  CRITICAL = 'critical',       // 0-19
  UNKNOWN = 'unknown'
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed'
}

export enum ProtocolType {
  MODBUS_TCP = 'modbus_tcp',
  MODBUS_RTU = 'modbus_rtu',
  IEC_61850 = 'iec_61850',
  MQTT = 'mqtt',
  OPCUA = 'opc_ua',
  BACNET = 'bacnet',
  ZIGBEE = 'zigbee',
  LORAWAN = 'lorawan',
  PROFINET = 'profinet',
  HTTP_REST = 'http_rest'
}

export enum UserRole {
  ADMIN = 'administrator',
  ANALYST = 'analyst',
  TECHNICIAN = 'technician',
  VIEWER = 'viewer'
}

export const RolePermissions: Record<UserRole, string[]> = {
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
  ]
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Administrator',
    [UserRole.ANALYST]: 'Analyst',
    [UserRole.TECHNICIAN]: 'Technician',
    [UserRole.VIEWER]: 'Viewer'
  };
  return names[role];
}

export enum MaintenanceStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

// ==================== INTERFACES ====================

// User & Authentication
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization_id: string;
  vendor_access: VendorType[];
  site_access: string[];
  created_at: string;
  updated_at: string;
  last_login?: string;
  avatar_url?: string;
}

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  subscription_tier: 'starter' | 'professional' | 'enterprise';
  settings: OrganizationSettings;
  created_at: string;
}

export interface OrganizationSettings {
  default_language: string;
  timezone: string;
  health_thresholds: HealthThresholds;
  notification_preferences: NotificationPreferences;
}

export interface HealthThresholds {
  excellent_min: number;
  good_min: number;
  fair_min: number;
  poor_min: number;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  alert_severities: AlertSeverity[];
}

// Site & Location
export interface Site {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address: Address;
  timezone: string;
  coordinates?: GeoCoordinates;
  asset_count: number;
  health_summary: HealthSummary;
  created_at: string;
  updated_at: string;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  country: string;
  postal_code: string;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

// Asset Core
export interface Asset {
  id: string;
  site_id: string;
  organization_id: string;
  name: string;
  asset_tag: string;
  qr_code: string;
  asset_type: AssetType;
  vendor: VendorType;
  vendor_model: string;
  serial_number?: string;
  installation_date?: string;
  warranty_expiry?: string;
  location: AssetLocation;
  specifications: AssetSpecifications;
  health: AssetHealth;
  connections: AssetConnection[];
  sensors: SensorAssignment[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AssetLocation {
  building?: string;
  floor?: string;
  room?: string;
  panel?: string;
  position?: string;
  coordinates?: { x: number; y: number; z?: number };
}

export interface AssetSpecifications {
  // Common specs
  rated_voltage?: number;
  rated_current?: number;
  rated_power?: number;
  frequency?: number;
  
  // Breaker specific
  breaking_capacity?: number;
  trip_unit?: string;
  
  // Transformer specific
  primary_voltage?: number;
  secondary_voltage?: number;
  cooling_type?: string;
  insulation_class?: string;
  
  // Vendor specific data
  vendor_specific?: Record<string, unknown>;
}

export interface AssetHealth {
  overall_score: number;
  status: HealthStatus;
  electrical_health: number;
  thermal_health: number;
  insulation_health: number;
  mechanical_health: number;
  last_assessment: string;
  trend: 'improving' | 'stable' | 'degrading';
  remaining_useful_life?: number; // days
  next_maintenance?: string;
}

export interface AssetConnection {
  target_asset_id: string;
  relationship: 'upstream' | 'downstream' | 'parallel' | 'feeds' | 'fed_by' | 'adjacent';
  connection_type: 'electrical' | 'communication' | 'physical';
  metadata?: Record<string, unknown>;
}

export interface SensorAssignment {
  sensor_id: string;
  sensor_type: SensorType;
  mounting_location: string;
  assigned_at: string;
}

// Sensors
export enum SensorType {
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  TEMPERATURE_HUMIDITY = 'temperature_humidity',
  PARTIAL_DISCHARGE = 'partial_discharge',
  VIBRATION = 'vibration',
  CURRENT = 'current',
  VOLTAGE = 'voltage',
  POWER = 'power',
  GAS = 'gas',
  HEAT_TAG = 'heat_tag',
  THERMAL_CAMERA = 'thermal_camera'
}

export interface Sensor {
  id: string;
  site_id: string;
  name: string;
  sensor_type: SensorType;
  vendor: VendorType;
  model: string;
  serial_number?: string;
  protocol: ProtocolType;
  gateway_id?: string;
  assigned_asset_id?: string;
  calibration_date?: string;
  next_calibration?: string;
  battery_level?: number;
  signal_strength?: number;
  is_online: boolean;
  last_reading_at?: string;
  created_at: string;
}

export interface SensorReading {
  sensor_id: string;
  timestamp: string;
  values: Record<string, number>;
  unit: string;
  quality: 'good' | 'uncertain' | 'bad';
}

// Gateway
export interface Gateway {
  id: string;
  site_id: string;
  name: string;
  vendor: VendorType;
  model: string;
  ip_address?: string;
  mac_address?: string;
  protocols: ProtocolType[];
  connected_sensors: number;
  max_sensors: number;
  firmware_version?: string;
  is_online: boolean;
  last_heartbeat?: string;
  edge_analytics_enabled: boolean;
  buffer_days: number;
  created_at: string;
}

// Alerts & Notifications
export interface Alert {
  id: string;
  organization_id: string;
  site_id: string;
  asset_id?: string;
  sensor_id?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  category: string;
  source: string;
  triggered_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  related_alerts?: string[];
  metadata: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  conditions: AlertCondition[];
  logic: 'and' | 'or';
  severity: AlertSeverity;
  notification_channels: string[];
  cooldown_minutes: number;
  asset_filter?: AssetFilter;
  created_at: string;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=' | 'contains';
  value: number | string;
  duration_seconds?: number;
}

export interface AssetFilter {
  asset_types?: AssetType[];
  vendors?: VendorType[];
  sites?: string[];
  tags?: string[];
}

// Maintenance
export interface MaintenanceTask {
  id: string;
  organization_id: string;
  site_id: string;
  asset_id: string;
  title: string;
  description: string;
  task_type: 'preventive' | 'corrective' | 'predictive' | 'inspection';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: MaintenanceStatus;
  scheduled_date: string;
  due_date: string;
  completed_date?: string;
  assigned_to?: string;
  assigned_team?: string;
  oem_service_required: boolean;
  oem_vendor?: VendorType;
  work_order_id?: string;
  estimated_duration_hours?: number;
  actual_duration_hours?: number;
  parts_required?: MaintenancePart[];
  checklist?: MaintenanceChecklistItem[];
  notes?: string;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

export interface MaintenancePart {
  part_number: string;
  description: string;
  quantity: number;
  unit_cost?: number;
  vendor?: VendorType;
}

export interface MaintenanceChecklistItem {
  id: string;
  description: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
}

// Analytics & Reports
export interface HealthSummary {
  total_assets: number;
  by_status: Record<HealthStatus, number>;
  by_vendor: Record<VendorType, { count: number; avg_health: number }>;
  by_type: Record<AssetType, { count: number; avg_health: number }>;
  critical_assets: number;
  trending_down: number;
  upcoming_maintenance: number;
}

export interface VendorComparison {
  metric: string;
  vendors: {
    vendor: VendorType;
    value: number;
    sample_size: number;
    percentile_rank?: number;
  }[];
  time_period: string;
  asset_type?: AssetType;
}

export interface TrendData {
  metric: string;
  asset_id?: string;
  data_points: {
    timestamp: string;
    value: number;
    prediction?: number;
    lower_bound?: number;
    upper_bound?: number;
  }[];
  trend_direction: 'up' | 'down' | 'stable';
  change_percentage: number;
}

// Topology
export interface TopologyNode {
  id: string;
  asset_id: string;
  label: string;
  type: AssetType;
  vendor: VendorType;
  health_score: number;
  status: HealthStatus;
  x?: number;
  y?: number;
  level?: number;
  parent_id?: string;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'electrical' | 'communication' | 'physical';
  label?: string;
  is_critical_path?: boolean;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  site_id: string;
  last_updated: string;
}

// QR Code
export interface QRCodeData {
  asset_id: string;
  asset_tag: string;
  site_id: string;
  organization_id: string;
  url: string;
  generated_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// WebSocket Events
export enum WSEventType {
  SENSOR_READING = 'sensor_reading',
  ASSET_HEALTH_UPDATE = 'asset_health_update',
  ALERT_CREATED = 'alert_created',
  ALERT_UPDATED = 'alert_updated',
  GATEWAY_STATUS = 'gateway_status',
  MAINTENANCE_UPDATE = 'maintenance_update'
}

export interface WSMessage<T = unknown> {
  type: WSEventType;
  payload: T;
  timestamp: string;
  site_id?: string;
  asset_id?: string;
}

// ==================== UTILITY FUNCTIONS ====================

export function getHealthStatus(score: number): HealthStatus {
  if (score >= 80) return HealthStatus.EXCELLENT;
  if (score >= 60) return HealthStatus.GOOD;
  if (score >= 40) return HealthStatus.FAIR;
  if (score >= 20) return HealthStatus.POOR;
  if (score >= 0) return HealthStatus.CRITICAL;
  return HealthStatus.UNKNOWN;
}

export function getHealthColor(status: HealthStatus): string {
  const colors: Record<HealthStatus, string> = {
    [HealthStatus.EXCELLENT]: '#10b981', // Emerald
    [HealthStatus.GOOD]: '#22c55e',      // Green
    [HealthStatus.FAIR]: '#f59e0b',      // Amber
    [HealthStatus.POOR]: '#f97316',      // Orange
    [HealthStatus.CRITICAL]: '#ef4444',  // Red
    [HealthStatus.UNKNOWN]: '#6b7280'    // Gray
  };
  return colors[status];
}

export function getVendorColor(vendor: VendorType): string {
  const colors: Record<VendorType, string> = {
    [VendorType.SCHNEIDER]: '#3dcd58',  // Schneider Green
    [VendorType.ABB]: '#ff000f',        // ABB Red
    [VendorType.SIEMENS]: '#009999',    // Siemens Teal
    [VendorType.BOSCH]: '#ea0016',      // Bosch Red
    [VendorType.EATON]: '#0033a0',      // Eaton Blue
    [VendorType.GENERIC]: '#6366f1'     // Indigo
  };
  return colors[vendor];
}

export function getVendorName(vendor: VendorType): string {
  const names: Record<VendorType, string> = {
    [VendorType.SCHNEIDER]: 'Schneider Electric',
    [VendorType.ABB]: 'ABB',
    [VendorType.SIEMENS]: 'Siemens',
    [VendorType.BOSCH]: 'Bosch',
    [VendorType.EATON]: 'Eaton',
    [VendorType.GENERIC]: 'Generic'
  };
  return names[vendor];
}

export function getAssetTypeName(type: AssetType): string {
  const names: Record<AssetType, string> = {
    [AssetType.MV_SWITCHGEAR]: 'MV Switchgear',
    [AssetType.LV_PANEL]: 'LV Panel',
    [AssetType.TRANSFORMER]: 'Transformer',
    [AssetType.CIRCUIT_BREAKER]: 'Circuit Breaker',
    [AssetType.BUSWAY]: 'Busway',
    [AssetType.SENSOR]: 'Sensor',
    [AssetType.GATEWAY]: 'Gateway',
    [AssetType.VFD]: 'Variable Frequency Drive',
    [AssetType.RELAY]: 'Relay',
    [AssetType.METER]: 'Meter'
  };
  return names[type];
}

export function formatHealthScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function generateAssetTag(siteCode: string, assetType: AssetType, sequence: number): string {
  const typePrefix: Record<AssetType, string> = {
    [AssetType.MV_SWITCHGEAR]: 'MVS',
    [AssetType.LV_PANEL]: 'LVP',
    [AssetType.TRANSFORMER]: 'TRF',
    [AssetType.CIRCUIT_BREAKER]: 'CBR',
    [AssetType.BUSWAY]: 'BWY',
    [AssetType.SENSOR]: 'SNS',
    [AssetType.GATEWAY]: 'GTW',
    [AssetType.VFD]: 'VFD',
    [AssetType.RELAY]: 'RLY',
    [AssetType.METER]: 'MTR'
  };
  return `${siteCode}-${typePrefix[assetType]}-${String(sequence).padStart(4, '0')}`;
}
