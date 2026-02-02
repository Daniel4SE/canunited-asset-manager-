export type CMSSType = 'sap_pm' | 'maximo' | 'servicenow';

export interface CMSSConfig {
  type: CMSSType;
  apiUrl: string;
  credentials: {
    username?: string;
    password?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
  };
  options?: {
    syncInterval?: number;
    retryAttempts?: number;
    timeout?: number;
  };
}

export interface CMSSIntegration {
  id: string;
  organizationId: string;
  type: CMSSType;
  name: string;
  isActive: boolean;
  configEncrypted: string;
  lastSyncAt: Date | null;
  syncStatus: 'pending' | 'in_progress' | 'success' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkOrder {
  id: string;
  externalId: string;
  assetId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'submitted' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  type: 'preventive' | 'corrective' | 'predictive' | 'inspection';
  plannedStart?: Date;
  plannedEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  assignedTo?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkOrderMapping {
  id: string;
  integrationId: string;
  internalTaskId: string;
  externalWorkOrderId: string;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  lastSyncAt: Date;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  errors: Array<{ itemId: string; error: string }>;
  startedAt: Date;
  completedAt: Date;
}

export interface CMSSAdapter {
  type: CMSSType;

  // Connection management
  testConnection(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Work order operations
  getWorkOrders(filters?: WorkOrderFilter): Promise<WorkOrder[]>;
  getWorkOrder(externalId: string): Promise<WorkOrder | null>;
  createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'externalId'>): Promise<WorkOrder>;
  updateWorkOrder(externalId: string, updates: Partial<WorkOrder>): Promise<WorkOrder>;
  closeWorkOrder(externalId: string, resolution: string): Promise<void>;

  // Asset synchronization
  syncAssets(): Promise<SyncResult>;

  // Maintenance history
  getMaintenanceHistory(assetExternalId: string): Promise<WorkOrder[]>;
}

export interface WorkOrderFilter {
  status?: WorkOrder['status'][];
  priority?: WorkOrder['priority'][];
  type?: WorkOrder['type'][];
  assetId?: string;
  assignedTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface CMSSWebhookPayload {
  event: 'work_order.created' | 'work_order.updated' | 'work_order.closed' | 'asset.updated';
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string;
}
