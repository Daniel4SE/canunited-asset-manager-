import { BaseCMSSAdapter } from './base.adapter.js';
import type {
  CMSSConfig,
  CMSSType,
  WorkOrder,
  WorkOrderFilter,
  SyncResult,
} from '../types.js';

/**
 * ServiceNow Adapter
 * Integrates with ServiceNow ITOM/ITSM for work order and incident management
 */
export class ServiceNowAdapter extends BaseCMSSAdapter {
  private oauthToken: string | null = null;

  constructor(config: CMSSConfig) {
    super(config);
  }

  get type(): CMSSType {
    return 'servicenow';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.simulateApiCall(400);
      return true;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    this.validateConfig();
    await this.simulateApiCall(350);
    this.oauthToken = `snow_oauth_${Date.now()}`;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.oauthToken = null;
    this.connected = false;
  }

  async getWorkOrders(filters?: WorkOrderFilter): Promise<WorkOrder[]> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(400);

    const mockOrders = this.generateMockWorkOrders(filters?.limit || 10);

    if (filters?.status) {
      return mockOrders.filter((wo) => filters.status!.includes(wo.status));
    }

    return mockOrders;
  }

  async getWorkOrder(externalId: string): Promise<WorkOrder | null> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(200);

    return {
      id: this.generateId(),
      externalId,
      assetId: 'asset-001',
      title: `ServiceNow Task ${externalId}`,
      description: 'Work order from ServiceNow',
      priority: 'medium',
      status: 'approved',
      type: 'preventive',
      plannedStart: new Date(),
      plannedEnd: new Date(Date.now() + 172800000),
      assignedTo: 'IT Operations',
      estimatedDuration: 3,
    };
  }

  async createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'externalId'>): Promise<WorkOrder> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(450);

    const externalId = `SNOW-WO-${Date.now()}`;

    return {
      id: this.generateId(),
      externalId,
      ...workOrder,
    };
  }

  async updateWorkOrder(externalId: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(350);

    const existing = await this.getWorkOrder(externalId);
    if (!existing) {
      throw new Error(`Work order ${externalId} not found in ServiceNow`);
    }

    return {
      ...existing,
      ...updates,
    };
  }

  async closeWorkOrder(externalId: string, resolution: string): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(300);
    console.log(`ServiceNow: Closed work order ${externalId} with resolution: ${resolution}`);
  }

  async syncAssets(): Promise<SyncResult> {
    if (!this.connected) {
      await this.connect();
    }

    const startedAt = new Date();
    await this.simulateApiCall(800);

    return {
      success: true,
      itemsSynced: 18,
      itemsFailed: 0,
      errors: [],
      startedAt,
      completedAt: new Date(),
    };
  }

  async getMaintenanceHistory(assetExternalId: string): Promise<WorkOrder[]> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(350);

    return [
      {
        id: this.generateId(),
        externalId: `SNOW-HIST-001`,
        assetId: assetExternalId,
        title: 'Scheduled Maintenance',
        description: 'Quarterly scheduled maintenance',
        priority: 'medium',
        status: 'completed',
        type: 'preventive',
        actualStart: new Date(Date.now() - 45 * 86400000),
        actualEnd: new Date(Date.now() - 45 * 86400000),
        actualDuration: 3,
      },
    ];
  }

  private generateMockWorkOrders(count: number): WorkOrder[] {
    const orders: WorkOrder[] = [];
    const statuses: WorkOrder['status'][] = ['submitted', 'approved', 'in_progress', 'completed'];
    const types: WorkOrder['type'][] = ['preventive', 'corrective', 'inspection', 'predictive'];
    const priorities: WorkOrder['priority'][] = ['low', 'medium', 'high'];

    for (let i = 0; i < count; i++) {
      orders.push({
        id: this.generateId(),
        externalId: `SNOW-${3000 + i}`,
        assetId: `asset-${(i % 5) + 1}`,
        title: `ServiceNow Task ${i + 1}`,
        description: `Work order ${i + 1} from ServiceNow`,
        priority: priorities[i % priorities.length],
        status: statuses[i % statuses.length],
        type: types[i % types.length],
        plannedStart: new Date(Date.now() + i * 86400000),
        plannedEnd: new Date(Date.now() + (i + 1) * 86400000),
        estimatedDuration: 2 + (i % 4),
      });
    }

    return orders;
  }

  private simulateApiCall(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
