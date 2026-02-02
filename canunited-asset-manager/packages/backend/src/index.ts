import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Get config from environment
const PORT = parseInt(process.env.PORT || '4000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

console.log('🚀 Starting CANUnited Backend...');
console.log(`📌 PORT: ${PORT}`);
console.log(`📌 NODE_ENV: ${NODE_ENV}`);
console.log(`📌 DATABASE_URL: ${DATABASE_URL ? '✓ configured' : '✗ not set'}`);
console.log(`📌 REDIS_URL: ${REDIS_URL ? '✓ configured' : '✗ not set'}`);

const app = express();
const server = createServer(app);

// Health check endpoint - FIRST, before anything else
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'canunited-backend',
    port: PORT,
    database: DATABASE_URL ? 'configured' : 'not configured',
    redis: REDIS_URL ? 'configured' : 'not configured'
  });
});

// Basic middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CANUnited Asset Manager API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      auth: '/api/v1/auth',
      assets: '/api/v1/assets',
      sites: '/api/v1/sites',
      sensors: '/api/v1/sensors',
      alerts: '/api/v1/alerts',
      maintenance: '/api/v1/maintenance',
      dashboard: '/api/v1/dashboard'
    }
  });
});

// ============= API Routes =============

// Auth routes
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Demo users
  const demoUsers: Record<string, any> = {
    'admin@canunited.com': { id: '1', email: 'admin@canunited.com', name: 'System Admin', role: 'administrator' },
    'analyst@canunited.com': { id: '2', email: 'analyst@canunited.com', name: 'Data Analyst', role: 'analyst' },
    'tech@canunited.com': { id: '3', email: 'tech@canunited.com', name: 'Field Technician', role: 'technician' },
    'viewer@canunited.com': { id: '4', email: 'viewer@canunited.com', name: 'Report Viewer', role: 'viewer' },
  };

  const user = demoUsers[email?.toLowerCase()];
  if (user && password === 'password123') {
    res.json({
      success: true,
      data: {
        user,
        accessToken: 'demo-access-token-' + Date.now(),
        refreshToken: 'demo-refresh-token-' + Date.now()
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid credentials. Try admin@canunited.com / password123' }
    });
  }
});

app.get('/api/v1/auth/me', (req, res) => {
  res.json({
    success: true,
    data: { id: '1', email: 'admin@canunited.com', name: 'System Admin', role: 'administrator' }
  });
});

app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Dashboard
app.get('/api/v1/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalSites: 3,
      totalAssets: 48,
      totalSensors: 156,
      avgHealthScore: 82.5,
      criticalAssets: 2,
      activeAlerts: 5,
      upcomingMaintenance: 8,
      healthDistribution: { healthy: 35, warning: 10, critical: 3 },
      vendorBreakdown: [
        { vendor: 'schneider', count: 18, avgHealth: 85 },
        { vendor: 'abb', count: 15, avgHealth: 80 },
        { vendor: 'siemens', count: 10, avgHealth: 82 },
        { vendor: 'ge', count: 5, avgHealth: 78 }
      ]
    }
  });
});

// Sites
app.get('/api/v1/sites', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: '1', name: 'Toronto Main Plant', code: 'TOR-01', address: '123 Industrial Blvd, Toronto', assetCount: 25, avgHealth: 85 },
      { id: '2', name: 'Vancouver Distribution', code: 'VAN-01', address: '456 Port Way, Vancouver', assetCount: 15, avgHealth: 78 },
      { id: '3', name: 'Montreal Facility', code: 'MTL-01', address: '789 Factory St, Montreal', assetCount: 8, avgHealth: 82 }
    ]
  });
});

// Assets
app.get('/api/v1/assets', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: '1', name: 'Main Transformer T1', assetTag: 'TRF-001', assetType: 'transformer', vendor: 'schneider', healthScore: 92, healthStatus: 'healthy' },
      { id: '2', name: 'Circuit Breaker CB-101', assetTag: 'CB-101', assetType: 'circuit_breaker', vendor: 'abb', healthScore: 78, healthStatus: 'warning' },
      { id: '3', name: 'MV Switchgear SG-01', assetTag: 'SG-001', assetType: 'switchgear', vendor: 'siemens', healthScore: 65, healthStatus: 'critical' },
      { id: '4', name: 'Power Transformer T2', assetTag: 'TRF-002', assetType: 'transformer', vendor: 'ge', healthScore: 88, healthStatus: 'healthy' },
      { id: '5', name: 'VFD Drive VFD-01', assetTag: 'VFD-001', assetType: 'vfd', vendor: 'abb', healthScore: 85, healthStatus: 'healthy' }
    ],
    meta: { page: 1, perPage: 20, total: 5, totalPages: 1 }
  });
});

// Sensors
app.get('/api/v1/sensors', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: '1', name: 'Temp Sensor T1-01', sensorType: 'temperature', vendor: 'schneider', isOnline: true, lastReading: 45.2 },
      { id: '2', name: 'Vibration V1-01', sensorType: 'vibration', vendor: 'abb', isOnline: true, lastReading: 2.1 },
      { id: '3', name: 'Current CT-01', sensorType: 'current', vendor: 'siemens', isOnline: false, lastReading: 125.5 }
    ]
  });
});

// Alerts
app.get('/api/v1/alerts', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: '1', title: 'High Temperature Warning', severity: 'high', status: 'active', assetName: 'Transformer T1', triggeredAt: new Date().toISOString() },
      { id: '2', title: 'Vibration Threshold Exceeded', severity: 'medium', status: 'acknowledged', assetName: 'Motor M-01', triggeredAt: new Date().toISOString() },
      { id: '3', title: 'Communication Lost', severity: 'critical', status: 'active', assetName: 'Switchgear SG-01', triggeredAt: new Date().toISOString() }
    ],
    meta: { page: 1, perPage: 50, total: 3, totalPages: 1 }
  });
});

app.get('/api/v1/alerts/summary', (req, res) => {
  res.json({
    success: true,
    data: { critical: 1, high: 2, medium: 3, low: 5, total: 11 }
  });
});

// Maintenance
app.get('/api/v1/maintenance', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: '1', title: 'Annual Transformer Inspection', status: 'scheduled', priority: 'high', assetName: 'Transformer T1', scheduledDate: '2026-02-15' },
      { id: '2', title: 'Circuit Breaker Testing', status: 'in_progress', priority: 'medium', assetName: 'CB-101', scheduledDate: '2026-02-10' },
      { id: '3', title: 'Oil Analysis', status: 'completed', priority: 'low', assetName: 'Transformer T2', scheduledDate: '2026-01-20' }
    ],
    meta: { page: 1, perPage: 20, total: 3, totalPages: 1 }
  });
});

// Analytics
app.get('/api/v1/analytics/vendor-comparison', (req, res) => {
  res.json({
    success: true,
    data: [
      { vendor: 'schneider', sampleSize: 18, avgHealth: 85, avgElectrical: 87, avgThermal: 83, avgInsulation: 86, avgMechanical: 84 },
      { vendor: 'abb', sampleSize: 15, avgHealth: 80, avgElectrical: 82, avgThermal: 78, avgInsulation: 81, avgMechanical: 79 },
      { vendor: 'siemens', sampleSize: 10, avgHealth: 82, avgElectrical: 84, avgThermal: 80, avgInsulation: 83, avgMechanical: 81 }
    ]
  });
});

app.get('/api/v1/analytics/failure-risk', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: '1', name: 'Switchgear SG-01', healthScore: 65, riskLevel: 'high', healthTrend: 'declining' },
      { id: '2', name: 'Circuit Breaker CB-101', healthScore: 78, riskLevel: 'medium', healthTrend: 'stable' }
    ]
  });
});

// Topology
app.get('/api/v1/topology/site/:siteId', (req, res) => {
  res.json({
    success: true,
    data: {
      nodes: [
        { id: '1', type: 'transformer', name: 'Main Transformer', healthScore: 92 },
        { id: '2', type: 'switchgear', name: 'MV Switchgear', healthScore: 85 },
        { id: '3', type: 'circuit_breaker', name: 'CB-101', healthScore: 78 }
      ],
      connections: [
        { source: '1', target: '2', type: 'power' },
        { source: '2', target: '3', type: 'power' }
      ]
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🏭 CANUnited Asset Manager Backend                      ║
║   Server running on http://0.0.0.0:${PORT}                       ║
║   Environment: ${NODE_ENV}                                       ║
║   Mode: Demo (mock data)                                  ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// WebSocket setup
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
