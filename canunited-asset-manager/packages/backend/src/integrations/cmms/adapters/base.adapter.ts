import type {
  CMSSAdapter,
  CMSSConfig,
  CMSSType,
  WorkOrder,
  WorkOrderFilter,
  SyncResult,
} from '../types.js';

export abstract class BaseCMSSAdapter implements CMSSAdapter {
  protected config: CMSSConfig;
  protected connected: boolean = false;

  constructor(config: CMSSConfig) {
    this.config = config;
  }

  abstract get type(): CMSSType;

  abstract testConnection(): Promise<boolean>;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract getWorkOrders(filters?: WorkOrderFilter): Promise<WorkOrder[]>;
  abstract getWorkOrder(externalId: string): Promise<WorkOrder | null>;
  abstract createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'externalId'>): Promise<WorkOrder>;
  abstract updateWorkOrder(externalId: string, updates: Partial<WorkOrder>): Promise<WorkOrder>;
  abstract closeWorkOrder(externalId: string, resolution: string): Promise<void>;

  abstract syncAssets(): Promise<SyncResult>;
  abstract getMaintenanceHistory(assetExternalId: string): Promise<WorkOrder[]>;

  protected validateConfig(): void {
    if (!this.config.apiUrl) {
      throw new Error('API URL is required');
    }
    if (!this.config.credentials) {
      throw new Error('Credentials are required');
    }
  }

  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    _data?: unknown
  ): Promise<T> {
    // Base implementation - to be overridden by specific adapters
    throw new Error(`Request to ${method} ${endpoint} not implemented`);
  }

  protected mapPriority(externalPriority: string | number): WorkOrder['priority'] {
    // Default mapping - override in specific adapters
    const priorityMap: Record<string, WorkOrder['priority']> = {
      '1': 'urgent',
      '2': 'high',
      '3': 'medium',
      '4': 'low',
      urgent: 'urgent',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    return priorityMap[String(externalPriority).toLowerCase()] || 'medium';
  }

  protected mapStatus(externalStatus: string): WorkOrder['status'] {
    // Default mapping - override in specific adapters
    const statusMap: Record<string, WorkOrder['status']> = {
      draft: 'draft',
      new: 'submitted',
      submitted: 'submitted',
      approved: 'approved',
      open: 'approved',
      in_progress: 'in_progress',
      wip: 'in_progress',
      completed: 'completed',
      closed: 'completed',
      cancelled: 'cancelled',
      canceled: 'cancelled',
    };
    return statusMap[externalStatus.toLowerCase()] || 'draft';
  }

  protected mapType(externalType: string): WorkOrder['type'] {
    // Default mapping - override in specific adapters
    const typeMap: Record<string, WorkOrder['type']> = {
      pm: 'preventive',
      preventive: 'preventive',
      cm: 'corrective',
      corrective: 'corrective',
      pdm: 'predictive',
      predictive: 'predictive',
      inspection: 'inspection',
    };
    return typeMap[externalType.toLowerCase()] || 'corrective';
  }

  protected generateId(): string {
    return `wo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
