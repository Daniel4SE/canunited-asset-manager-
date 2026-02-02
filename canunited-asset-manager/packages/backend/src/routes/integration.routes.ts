import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createCMSSAdapter,
  getSupportedCMSSTypes,
  validateCMSSConfig,
  type CMSSConfig,
} from '../integrations/cmms/index.js';

const router = Router();

// Validation schemas
const createIntegrationSchema = z.object({
  type: z.enum(['sap_pm', 'maximo', 'servicenow']),
  name: z.string().min(1).max(100),
  apiUrl: z.string().url(),
  credentials: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }),
  options: z.object({
    syncInterval: z.number().optional(),
    retryAttempts: z.number().optional(),
    timeout: z.number().optional(),
  }).optional(),
});

// In-memory storage for demo (would be database in production)
const integrations: Map<string, {
  id: string;
  organizationId: string;
  type: string;
  name: string;
  isActive: boolean;
  config: CMSSConfig;
  lastSyncAt: Date | null;
  syncStatus: string;
  createdAt: Date;
}> = new Map();

// Get supported CMMS types
router.get('/cmms/types', authenticate, (_req, res) => {
  res.json({
    success: true,
    data: getSupportedCMSSTypes(),
  });
});

// List all CMMS integrations for organization
router.get('/cmms', authenticate, (req, res) => {
  const organizationId = req.user?.organizationId || '';

  // Filter integrations by organization
  const orgIntegrations = Array.from(integrations.values())
    .filter((i) => i.organizationId === organizationId)
    .map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      isActive: i.isActive,
      lastSyncAt: i.lastSyncAt,
      syncStatus: i.syncStatus,
      createdAt: i.createdAt,
    }));

  // Add mock data if empty for demo
  if (orgIntegrations.length === 0) {
    return res.json({
      success: true,
      data: [
        {
          id: 'cmms-demo-001',
          type: 'sap_pm',
          name: 'SAP PM Integration',
          isActive: true,
          lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
          syncStatus: 'success',
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        },
        {
          id: 'cmms-demo-002',
          type: 'maximo',
          name: 'IBM Maximo',
          isActive: false,
          lastSyncAt: null,
          syncStatus: 'pending',
          createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
      ],
    });
  }

  return res.json({
    success: true,
    data: orgIntegrations,
  });
});

// Create new CMMS integration
router.post('/cmms', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const validation = createIntegrationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid integration configuration',
          details: validation.error.errors,
        },
      });
    }

    const { type, name, apiUrl, credentials, options } = validation.data;
    const organizationId = req.user?.organizationId || '';

    // Validate CMMS config
    const config: CMSSConfig = { type, apiUrl, credentials, options };
    const configValidation = validateCMSSConfig(config);

    if (!configValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONFIG_VALIDATION_ERROR',
          message: 'Invalid CMMS configuration',
          details: configValidation.errors,
        },
      });
    }

    // Create integration record
    const id = `cmms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const integration = {
      id,
      organizationId,
      type,
      name,
      isActive: true,
      config,
      lastSyncAt: null,
      syncStatus: 'pending',
      createdAt: new Date(),
    };

    integrations.set(id, integration);

    return res.status(201).json({
      success: true,
      data: {
        id: integration.id,
        type: integration.type,
        name: integration.name,
        isActive: integration.isActive,
        syncStatus: integration.syncStatus,
        createdAt: integration.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single integration
router.get('/cmms/:id', authenticate, (req, res) => {
  const { id } = req.params;

  const integration = integrations.get(id);

  if (!integration) {
    // Return mock for demo
    return res.json({
      success: true,
      data: {
        id,
        type: 'sap_pm',
        name: 'SAP PM Integration',
        isActive: true,
        lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
        syncStatus: 'success',
        workOrdersSync: 12,
        assetsSync: 45,
      },
    });
  }

  return res.json({
    success: true,
    data: {
      id: integration.id,
      type: integration.type,
      name: integration.name,
      isActive: integration.isActive,
      lastSyncAt: integration.lastSyncAt,
      syncStatus: integration.syncStatus,
    },
  });
});

// Test connection
router.post('/cmms/:id/test', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const integration = integrations.get(id);

    if (!integration) {
      // Demo mode: simulate successful connection test
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.json({
        success: true,
        data: {
          connected: true,
          latency: 245,
          message: 'Connection successful',
        },
      });
    }

    // Test actual connection
    const adapter = createCMSSAdapter(integration.config);
    const connected = await adapter.testConnection();

    return res.json({
      success: true,
      data: {
        connected,
        latency: connected ? Math.floor(Math.random() * 300) + 100 : null,
        message: connected ? 'Connection successful' : 'Connection failed',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Trigger sync
router.post('/cmms/:id/sync', authenticate, authorize(['admin', 'reliability_engineer']), async (req, res, next) => {
  try {
    const { id } = req.params;

    const integration = integrations.get(id);

    if (!integration) {
      // Demo mode: simulate sync
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return res.json({
        success: true,
        data: {
          itemsSynced: 15,
          itemsFailed: 0,
          duration: 2.3,
          message: 'Sync completed successfully',
        },
      });
    }

    // Perform sync
    const adapter = createCMSSAdapter(integration.config);
    await adapter.connect();
    const result = await adapter.syncAssets();
    await adapter.disconnect();

    // Update integration status
    integration.lastSyncAt = new Date();
    integration.syncStatus = result.success ? 'success' : 'failed';

    return res.json({
      success: true,
      data: {
        itemsSynced: result.itemsSynced,
        itemsFailed: result.itemsFailed,
        errors: result.errors,
        duration: (result.completedAt.getTime() - result.startedAt.getTime()) / 1000,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get work orders from CMMS
router.get('/cmms/:id/work-orders', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, limit = '20' } = req.query;

    const integration = integrations.get(id);

    if (!integration) {
      // Demo mode: return mock work orders
      return res.json({
        success: true,
        data: [
          { id: 'wo-1', externalId: 'SAP-WO-1001', title: 'Preventive Maintenance', status: 'approved', priority: 'medium' },
          { id: 'wo-2', externalId: 'SAP-WO-1002', title: 'Corrective Action', status: 'in_progress', priority: 'high' },
          { id: 'wo-3', externalId: 'SAP-WO-1003', title: 'Inspection Task', status: 'completed', priority: 'low' },
        ],
      });
    }

    const adapter = createCMSSAdapter(integration.config);
    await adapter.connect();

    const workOrders = await adapter.getWorkOrders({
      status: status ? (status as string).split(',') as any : undefined,
      limit: parseInt(limit as string, 10),
    });

    await adapter.disconnect();

    return res.json({
      success: true,
      data: workOrders,
    });
  } catch (error) {
    next(error);
  }
});

// Webhook endpoint for CMMS callbacks
router.post('/cmms/:id/webhook', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    console.log(`Received webhook for integration ${id}:`, payload);

    // Process webhook event
    // In production, this would validate signature and process the event

    res.json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error) {
    next(error);
  }
});

// Delete integration
router.delete('/cmms/:id', authenticate, authorize(['admin']), (req, res) => {
  const { id } = req.params;

  integrations.delete(id);

  res.json({
    success: true,
    message: 'Integration deleted',
  });
});

export const integrationRoutes = router;
