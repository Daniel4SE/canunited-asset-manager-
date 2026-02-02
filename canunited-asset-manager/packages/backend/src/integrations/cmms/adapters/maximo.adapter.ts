import { BaseCMSSAdapter } from './base.adapter.js';
import type {
  CMSSConfig,
  CMSSType,
  WorkOrder,
  WorkOrderFilter,
  SyncResult,
} from '../types.js';

/**
 * IBM Maximo Adapter
 * Integrates with IBM Maximo Asset Management for work order management
 */
export class MaximoAdapter extends BaseCMSSAdapter {
  private sessionId: string | null = null;

  constructor(config: CMSSConfig) {
    super(config);
  }

  get type(): CMSSType {
    return 'maximo';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.simulateApiCall(600);
      return true;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    this.validateConfig();
    await this.simulateApiCall(400);
    this.sessionId = `maximo_session_${Date.now()}`;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.sessionId = null;
    this.connected = false;
  }

  async getWorkOrders(filters?: WorkOrderFilter): Promise<WorkOrder[]> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(500);

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

    await this.simulateApiCall(250);

    return {
      id: this.generateId(),
      externalId,
      assetId: 'asset-001',
      title: `Maximo Work Order ${externalId}`,
      description: 'Work order from IBM Maximo',
      priority: 'high',
      status: 'in_progress',
      type: 'corrective',
      plannedStart: new Date(),
      plannedEnd: new Date(Date.now() + 86400000),
      assignedTo: 'Field Service Team',
      estimatedDuration: 6,
    };
  }

  async createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'externalId'>): Promise<WorkOrder> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(600);

    const externalId = `MX-${Date.now()}`;

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

    await this.simulateApiCall(450);

    const existing = await this.getWorkOrder(externalId);
    if (!existing) {
      throw new Error(`Work order ${externalId} not found in Maximo`);
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

    await this.simulateApiCall(350);
    console.log(`Maximo: Closed work order ${externalId} with resolution: ${resolution}`);
  }

  async syncAssets(): Promise<SyncResult> {
    if (!this.connected) {
      await this.connect();
    }

    const startedAt = new Date();
    await this.simulateApiCall(1200);

    return {
      success: true,
      itemsSynced: 22,
      itemsFailed: 1,
      errors: [{ itemId: 'asset-error-001', error: 'Asset not found in Maximo' }],
      startedAt,
      completedAt: new Date(),
    };
  }

  async getMaintenanceHistory(assetExternalId: string): Promise<WorkOrder[]> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(450);

    return [
      {
        id: this.generateId(),
        externalId: `MX-HIST-001`,
        assetId: assetExternalId,
        title: 'Emergency Repair',
        description: 'Emergency corrective maintenance',
        priority: 'urgent',
        status: 'completed',
        type: 'corrective',
        actualStart: new Date(Date.now() - 15 * 86400000),
        actualEnd: new Date(Date.now() - 15 * 86400000),
        actualDuration: 8,
      },
    ];
  }

  private generateMockWorkOrders(count: number): WorkOrder[] {
    const orders: WorkOrder[] = [];
    const statuses: WorkOrder['status'][] = ['draft', 'submitted', 'approved', 'in_progress'];
    const types: WorkOrder['type'][] = ['preventive', 'corrective', 'predictive'];
    const priorities: WorkOrder['priority'][] = ['low', 'medium', 'high', 'urgent'];

    for (let i = 0; i < count; i++) {
      orders.push({
        id: this.generateId(),
        externalId: `MX-${2000 + i}`,
        assetId: `asset-${(i % 5) + 1}`,
        title: `Maximo Task ${i + 1}`,
        description: `Work order ${i + 1} from IBM Maximo`,
        priority: priorities[i % priorities.length],
        status: statuses[i % statuses.length],
        type: types[i % types.length],
        plannedStart: new Date(Date.now() + i * 86400000),
        plannedEnd: new Date(Date.now() + (i + 1) * 86400000),
        estimatedDuration: 3 + (i % 5),
      });
    }

    return orders;
  }

  private simulateApiCall(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
