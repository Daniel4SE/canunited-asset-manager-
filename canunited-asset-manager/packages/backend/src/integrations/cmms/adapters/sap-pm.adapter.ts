import { BaseCMSSAdapter } from './base.adapter.js';
import type {
  CMSSConfig,
  CMSSType,
  WorkOrder,
  WorkOrderFilter,
  SyncResult,
} from '../types.js';

/**
 * SAP Plant Maintenance (SAP PM) Adapter
 * Integrates with SAP PM module for work order and maintenance management
 */
export class SapPmAdapter extends BaseCMSSAdapter {
  private accessToken: string | null = null;

  constructor(config: CMSSConfig) {
    super(config);
  }

  get type(): CMSSType {
    return 'sap_pm';
  }

  async testConnection(): Promise<boolean> {
    try {
      // In a real implementation, this would call SAP's API
      // For demo, simulate a successful connection test
      await this.simulateApiCall(500);
      return true;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    this.validateConfig();

    // Simulate OAuth token exchange with SAP
    await this.simulateApiCall(300);
    this.accessToken = `sap_token_${Date.now()}`;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.connected = false;
  }

  async getWorkOrders(filters?: WorkOrderFilter): Promise<WorkOrder[]> {
    if (!this.connected) {
      await this.connect();
    }

    // Simulate fetching work orders from SAP PM
    await this.simulateApiCall(400);

    // Return mock data for demo
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
      title: `SAP PM Work Order ${externalId}`,
      description: 'Preventive maintenance task from SAP PM',
      priority: 'medium',
      status: 'approved',
      type: 'preventive',
      plannedStart: new Date(),
      plannedEnd: new Date(Date.now() + 86400000),
      assignedTo: 'Maintenance Team A',
      estimatedDuration: 4,
    };
  }

  async createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'externalId'>): Promise<WorkOrder> {
    if (!this.connected) {
      await this.connect();
    }

    await this.simulateApiCall(500);

    const externalId = `SAP-WO-${Date.now()}`;

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

    await this.simulateApiCall(400);

    const existing = await this.getWorkOrder(externalId);
    if (!existing) {
      throw new Error(`Work order ${externalId} not found`);
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
    // In real implementation, this would call SAP's BAPI to close the order
    console.log(`SAP PM: Closed work order ${externalId} with resolution: ${resolution}`);
  }

  async syncAssets(): Promise<SyncResult> {
    if (!this.connected) {
      await this.connect();
    }

    const startedAt = new Date();
    await this.simulateApiCall(1000);

    // Simulate sync result
    return {
      success: true,
      itemsSynced: 15,
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

    await this.simulateApiCall(400);

    // Return mock maintenance history
    return [
      {
        id: this.generateId(),
        externalId: `SAP-WO-HIST-001`,
        assetId: assetExternalId,
        title: 'Annual Inspection',
        description: 'Completed annual inspection',
        priority: 'medium',
        status: 'completed',
        type: 'inspection',
        actualStart: new Date(Date.now() - 30 * 86400000),
        actualEnd: new Date(Date.now() - 30 * 86400000),
        actualDuration: 2,
      },
      {
        id: this.generateId(),
        externalId: `SAP-WO-HIST-002`,
        assetId: assetExternalId,
        title: 'Preventive Maintenance',
        description: 'Quarterly PM completed',
        priority: 'low',
        status: 'completed',
        type: 'preventive',
        actualStart: new Date(Date.now() - 90 * 86400000),
        actualEnd: new Date(Date.now() - 90 * 86400000),
        actualDuration: 4,
      },
    ];
  }

  private generateMockWorkOrders(count: number): WorkOrder[] {
    const orders: WorkOrder[] = [];
    const statuses: WorkOrder['status'][] = ['submitted', 'approved', 'in_progress', 'completed'];
    const types: WorkOrder['type'][] = ['preventive', 'corrective', 'inspection'];
    const priorities: WorkOrder['priority'][] = ['low', 'medium', 'high'];

    for (let i = 0; i < count; i++) {
      orders.push({
        id: this.generateId(),
        externalId: `SAP-WO-${1000 + i}`,
        assetId: `asset-${(i % 5) + 1}`,
        title: `SAP PM Task ${i + 1}`,
        description: `Maintenance task ${i + 1} from SAP PM`,
        priority: priorities[i % priorities.length],
        status: statuses[i % statuses.length],
        type: types[i % types.length],
        plannedStart: new Date(Date.now() + i * 86400000),
        plannedEnd: new Date(Date.now() + (i + 1) * 86400000),
        estimatedDuration: 2 + (i % 6),
      });
    }

    return orders;
  }

  private simulateApiCall(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
