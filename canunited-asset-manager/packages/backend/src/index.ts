import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import crypto from 'crypto';
import QRCode from 'qrcode';
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

// ============= In-Memory Data Store =============
// Synced with frontend mockData.ts

const mockUser = {
  id: 'mock-user-001',
  email: 'admin@canunited.demo',
  name: 'System Admin',
  role: 'admin',
  organizationId: 'org-001',
};

// ============= MFA Implementation =============
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// In-memory MFA storage (demo mode - resets on restart)
const mfaStore = new Map<string, {
  enabled: boolean;
  secret: string | null;
  backupCodes: string[];
  pendingSetup?: { secret: string; backupCodes: string[]; expiresAt: number };
}>();

// Initialize demo users with MFA disabled
mfaStore.set('admin@canunited.com', { enabled: false, secret: null, backupCodes: [] });
mfaStore.set('admin@canunited.demo', { enabled: false, secret: null, backupCodes: [] });

function base32Encode(buffer: Buffer): string {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(encoded: string): Buffer {
  const cleanEncoded = encoded.replace(/=+$/, '').toUpperCase();
  let bits = 0, value = 0;
  const output: number[] = [];
  for (let i = 0; i < cleanEncoded.length; i++) {
    const index = BASE32_CHARS.indexOf(cleanEncoded[i]);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTOTP(secret: string, counter: number): string {
  const secretBuffer = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) |
               ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function verifyTOTP(secret: string, token: string): boolean {
  const time = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, time + i) === token) return true;
  }
  return false;
}

function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

const mockDashboard = {
  summary: {
    totalSites: 3,
    totalAssets: 45,
    totalSensors: 28,
    totalGateways: 6,
    avgHealthScore: '82.5',
    criticalAssets: 3,
    activeAlerts: 7,
    upcomingMaintenance: 12,
  },
  healthDistribution: {
    excellent: 18,
    good: 15,
    fair: 7,
    poor: 3,
    critical: 2,
  },
  vendorDistribution: [
    { vendor: 'schneider', count: 15, avgHealth: '85.2' },
    { vendor: 'abb', count: 12, avgHealth: '78.5' },
    { vendor: 'siemens', count: 10, avgHealth: '88.1' },
    { vendor: 'bosch', count: 5, avgHealth: '92.0' },
    { vendor: 'eaton', count: 3, avgHealth: '75.3' },
  ],
  recentAlerts: [
    { id: '1', severity: 'critical', title: 'High Temperature Detected', siteName: 'Singapore Main Plant', assetName: 'Transformer TX-001', triggeredAt: new Date().toISOString() },
    { id: '2', severity: 'high', title: 'Partial Discharge Activity', siteName: 'Malaysia Factory', assetName: 'MV Switchgear SG-003', triggeredAt: new Date(Date.now() - 3600000).toISOString() },
    { id: '3', severity: 'medium', title: 'Breaker Operation Count High', siteName: 'Singapore Main Plant', assetName: 'Circuit Breaker CB-012', triggeredAt: new Date(Date.now() - 7200000).toISOString() },
  ],
  assetsNeedingAttention: [
    { id: 'a1', name: 'ABB Resibloc Transformer', assetTag: 'SGP-TRF-0002', assetType: 'transformer', vendor: 'abb', healthScore: 45, status: 'poor', trend: 'degrading' },
    { id: 'a2', name: 'Eaton Power Defense CB', assetTag: 'SGP-CBR-0011', assetType: 'circuit_breaker', vendor: 'eaton', healthScore: 35, status: 'poor', trend: 'degrading' },
    { id: 'a3', name: 'Schneider ComPact NSX', assetTag: 'MYS-CBR-0005', assetType: 'circuit_breaker', vendor: 'schneider', healthScore: 25, status: 'critical', trend: 'degrading' },
  ],
};

// Sites data store
const sitesStore = new Map([
  ['site-001', {
    id: 'site-001',
    name: 'Singapore Main Plant',
    code: 'SGP-001',
    address: { street: '123 Industrial Ave', city: 'Singapore', country: 'Singapore', postalCode: '123456' },
    timezone: 'Asia/Singapore',
    assetCount: 20,
    healthSummary: { avgHealthScore: 85.2, criticalAssets: 1 },
  }],
  ['site-002', {
    id: 'site-002',
    name: 'Malaysia Factory',
    code: 'MYS-001',
    address: { street: '456 Manufacturing Rd', city: 'Kuala Lumpur', country: 'Malaysia', postalCode: '50000' },
    timezone: 'Asia/Kuala_Lumpur',
    assetCount: 15,
    healthSummary: { avgHealthScore: 78.5, criticalAssets: 2 },
  }],
  ['site-003', {
    id: 'site-003',
    name: 'Thailand Facility',
    code: 'THA-001',
    address: { street: '789 Industry Blvd', city: 'Bangkok', country: 'Thailand', postalCode: '10100' },
    timezone: 'Asia/Bangkok',
    assetCount: 10,
    healthSummary: { avgHealthScore: 92.1, criticalAssets: 0 },
  }],
]);

// Assets data store
const assetsStore = new Map([
  ['a1', { id: 'a1', name: 'SM6-24 MV Switchgear', assetTag: 'SGP-MVS-0001', assetType: 'mv_switchgear', vendor: 'schneider', vendorModel: 'SM6-24', siteId: 'site-001', siteName: 'Singapore Main Plant', health: { overallScore: 92, status: 'excellent', trend: 'stable', electricalHealth: 95, thermalHealth: 90, insulationHealth: 88, mechanicalHealth: 94 } }],
  ['a2', { id: 'a2', name: 'Masterpact MTZ1 Breaker', assetTag: 'SGP-CBR-0001', assetType: 'circuit_breaker', vendor: 'schneider', vendorModel: 'Masterpact MTZ1', siteId: 'site-001', siteName: 'Singapore Main Plant', health: { overallScore: 87, status: 'good', trend: 'stable', electricalHealth: 85, thermalHealth: 88, insulationHealth: 90, mechanicalHealth: 85 } }],
  ['a3', { id: 'a3', name: 'Trihal Cast Resin Transformer', assetTag: 'SGP-TRF-0001', assetType: 'transformer', vendor: 'schneider', vendorModel: 'Trihal Cast Resin', siteId: 'site-001', siteName: 'Singapore Main Plant', health: { overallScore: 78, status: 'good', trend: 'stable', electricalHealth: 80, thermalHealth: 75, insulationHealth: 82, mechanicalHealth: 76 } }],
  ['a4', { id: 'a4', name: 'Emax 2 Circuit Breaker', assetTag: 'SGP-CBR-0002', assetType: 'circuit_breaker', vendor: 'abb', vendorModel: 'Emax 2', siteId: 'site-001', siteName: 'Singapore Main Plant', health: { overallScore: 85, status: 'good', trend: 'improving', electricalHealth: 88, thermalHealth: 82, insulationHealth: 85, mechanicalHealth: 84 } }],
  ['a5', { id: 'a5', name: 'ABB Resibloc Transformer', assetTag: 'SGP-TRF-0002', assetType: 'transformer', vendor: 'abb', vendorModel: 'Resibloc', siteId: 'site-001', siteName: 'Singapore Main Plant', health: { overallScore: 45, status: 'poor', trend: 'degrading', electricalHealth: 50, thermalHealth: 38, insulationHealth: 48, mechanicalHealth: 44 } }],
  ['a6', { id: 'a6', name: 'Siemens 3WL Breaker', assetTag: 'MYS-CBR-0001', assetType: 'circuit_breaker', vendor: 'siemens', vendorModel: '3WL', siteId: 'site-002', siteName: 'Malaysia Factory', health: { overallScore: 88, status: 'good', trend: 'stable', electricalHealth: 90, thermalHealth: 86, insulationHealth: 88, mechanicalHealth: 89 } }],
  ['a7', { id: 'a7', name: 'NXPLUS C Switchgear', assetTag: 'MYS-MVS-0001', assetType: 'mv_switchgear', vendor: 'siemens', vendorModel: 'NXPLUS C', siteId: 'site-002', siteName: 'Malaysia Factory', health: { overallScore: 91, status: 'excellent', trend: 'stable', electricalHealth: 93, thermalHealth: 89, insulationHealth: 92, mechanicalHealth: 90 } }],
  ['a8', { id: 'a8', name: 'Eaton Power Defense', assetTag: 'SGP-CBR-0003', assetType: 'circuit_breaker', vendor: 'eaton', vendorModel: 'Power Defense', siteId: 'site-001', siteName: 'Singapore Main Plant', health: { overallScore: 65, status: 'fair', trend: 'degrading', electricalHealth: 68, thermalHealth: 62, insulationHealth: 65, mechanicalHealth: 64 } }],
  ['a9', { id: 'a9', name: 'Schneider ComPact NSX', assetTag: 'MYS-CBR-0005', assetType: 'circuit_breaker', vendor: 'schneider', vendorModel: 'ComPact NSX', siteId: 'site-002', siteName: 'Malaysia Factory', health: { overallScore: 25, status: 'critical', trend: 'degrading', electricalHealth: 28, thermalHealth: 22, insulationHealth: 25, mechanicalHealth: 26 } }],
  ['a10', { id: 'a10', name: 'ABB ACS880 VFD', assetTag: 'THA-VFD-0001', assetType: 'vfd', vendor: 'abb', vendorModel: 'ACS880', siteId: 'site-003', siteName: 'Thailand Facility', health: { overallScore: 72, status: 'fair', trend: 'stable', electricalHealth: 75, thermalHealth: 70, insulationHealth: 72, mechanicalHealth: 71 } }],
]);

// Alerts data store
const alertsStore = new Map([
  ['1', { id: '1', severity: 'critical', status: 'active', title: 'High Temperature Detected', description: 'Transformer TX-001 temperature exceeds 85°C threshold', siteName: 'Singapore Main Plant', assetName: 'Trihal Cast Resin Transformer', category: 'thermal', source: 'sensor', triggeredAt: new Date().toISOString() }],
  ['2', { id: '2', severity: 'high', status: 'active', title: 'Partial Discharge Activity', description: 'PD levels at 45pC detected on MV Switchgear', siteName: 'Malaysia Factory', assetName: 'NXPLUS C Switchgear', category: 'insulation', source: 'sensor', triggeredAt: new Date(Date.now() - 3600000).toISOString() }],
  ['3', { id: '3', severity: 'medium', status: 'acknowledged', title: 'Breaker Operation Count High', description: 'Operation count reached 8000 of 10000 lifecycle', siteName: 'Singapore Main Plant', assetName: 'Masterpact MTZ1 Breaker', category: 'mechanical', source: 'system', triggeredAt: new Date(Date.now() - 7200000).toISOString() }],
  ['4', { id: '4', severity: 'low', status: 'active', title: 'Scheduled Maintenance Due', description: 'Annual inspection due in 7 days', siteName: 'Thailand Facility', assetName: 'ABB ACS880 VFD', category: 'maintenance', source: 'system', triggeredAt: new Date(Date.now() - 86400000).toISOString() }],
  ['5', { id: '5', severity: 'critical', status: 'active', title: 'Critical Health Degradation', description: 'Asset health dropped below 30%', siteName: 'Malaysia Factory', assetName: 'Schneider ComPact NSX', category: 'health', source: 'analytics', triggeredAt: new Date(Date.now() - 1800000).toISOString() }],
]);

// Sensors data store
const sensorsStore = new Map([
  ['s1', { id: 's1', name: 'CL110 Temp/Humidity Sensor 1', sensorType: 'temperature_humidity', vendor: 'schneider', model: 'CL110', protocol: 'zigbee', isOnline: true, batteryLevel: 85, signalStrength: 92, assignedAssetId: 'a1', assignedAssetName: 'SM6-24 MV Switchgear' }],
  ['s2', { id: 's2', name: 'Easergy PD Sensor', sensorType: 'partial_discharge', vendor: 'schneider', model: 'Easergy PD', protocol: 'modbus_tcp', isOnline: true, batteryLevel: null, signalStrength: 98, assignedAssetId: 'a7', assignedAssetName: 'NXPLUS C Switchgear' }],
  ['s3', { id: 's3', name: 'HeatTag Thermal Sensor', sensorType: 'heat_tag', vendor: 'schneider', model: 'HeatTag', protocol: 'zigbee', isOnline: true, batteryLevel: 72, signalStrength: 88, assignedAssetId: 'a3', assignedAssetName: 'Trihal Cast Resin Transformer' }],
  ['s4', { id: 's4', name: 'Bosch CISS Vibration', sensorType: 'vibration', vendor: 'bosch', model: 'CISS Vibration', protocol: 'lorawan', isOnline: true, batteryLevel: 65, signalStrength: 78, assignedAssetId: 'a10', assignedAssetName: 'ABB ACS880 VFD' }],
  ['s5', { id: 's5', name: 'Generic CT Sensor', sensorType: 'current', vendor: 'generic', model: 'CT-100A', protocol: 'modbus_rtu', isOnline: false, batteryLevel: null, signalStrength: 0, assignedAssetId: 'a8', assignedAssetName: 'Eaton Power Defense' }],
  ['s6', { id: 's6', name: 'CL110 Temp/Humidity Sensor 2', sensorType: 'temperature_humidity', vendor: 'schneider', model: 'CL110', protocol: 'zigbee', isOnline: true, batteryLevel: 23, signalStrength: 85, assignedAssetId: 'a5', assignedAssetName: 'ABB Resibloc Transformer' }],
]);

// Maintenance data store
const maintenanceStore = new Map([
  ['m1', { id: 'm1', title: 'Annual Breaker Inspection', description: 'Comprehensive inspection of breaker contacts and mechanism', taskType: 'preventive', priority: 'medium', status: 'scheduled', siteId: 'site-001', siteName: 'Singapore Main Plant', assetId: 'a2', assetName: 'Masterpact MTZ1 Breaker', assetTag: 'SGP-CBR-0001', assetVendor: 'schneider', dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), oemServiceRequired: false }],
  ['m2', { id: 'm2', title: 'Thermal Scan Required', description: 'Infrared thermal scan due to elevated temperatures', taskType: 'predictive', priority: 'high', status: 'scheduled', siteId: 'site-001', siteName: 'Singapore Main Plant', assetId: 'a5', assetName: 'ABB Resibloc Transformer', assetTag: 'SGP-TRF-0002', assetVendor: 'abb', dueDate: new Date(Date.now() + 2 * 86400000).toISOString(), oemServiceRequired: true }],
  ['m3', { id: 'm3', title: 'Replace Worn Contacts', description: 'Contact replacement due to high operation count', taskType: 'corrective', priority: 'urgent', status: 'in_progress', siteId: 'site-002', siteName: 'Malaysia Factory', assetId: 'a9', assetName: 'Schneider ComPact NSX', assetTag: 'MYS-CBR-0005', assetVendor: 'schneider', dueDate: new Date(Date.now() - 1 * 86400000).toISOString(), oemServiceRequired: true }],
  ['m4', { id: 'm4', title: 'Visual Inspection', description: 'Routine visual inspection of switchgear', taskType: 'inspection', priority: 'low', status: 'scheduled', siteId: 'site-003', siteName: 'Thailand Facility', assetId: 'a10', assetName: 'ABB ACS880 VFD', assetTag: 'THA-VFD-0001', assetVendor: 'abb', dueDate: new Date(Date.now() + 14 * 86400000).toISOString(), oemServiceRequired: false }],
]);

const mockVendorComparison = {
  metric: 'health_score',
  assetType: 'all',
  vendors: [
    { vendor: 'schneider', sampleSize: 15, avgHealth: 78.5, avgElectrical: 80.2, avgThermal: 76.1, avgInsulation: 79.8, avgMechanical: 77.9, minHealth: 25, maxHealth: 95, stddevHealth: 18.5 },
    { vendor: 'abb', sampleSize: 12, avgHealth: 72.3, avgElectrical: 74.5, avgThermal: 69.2, avgInsulation: 73.8, avgMechanical: 71.6, minHealth: 45, maxHealth: 88, stddevHealth: 14.2 },
    { vendor: 'siemens', sampleSize: 10, avgHealth: 89.2, avgElectrical: 91.5, avgThermal: 87.1, avgInsulation: 90.2, avgMechanical: 88.0, minHealth: 82, maxHealth: 96, stddevHealth: 4.8 },
    { vendor: 'eaton', sampleSize: 5, avgHealth: 68.5, avgElectrical: 70.2, avgThermal: 66.8, avgInsulation: 69.1, avgMechanical: 67.8, minHealth: 55, maxHealth: 82, stddevHealth: 10.2 },
    { vendor: 'bosch', sampleSize: 3, avgHealth: 92.1, avgElectrical: 93.5, avgThermal: 91.2, avgInsulation: 92.8, avgMechanical: 90.9, minHealth: 88, maxHealth: 98, stddevHealth: 3.5 },
  ],
};

const mockFailureRisk = [
  { id: 'a9', name: 'Schneider ComPact NSX', assetTag: 'MYS-CBR-0005', assetType: 'circuit_breaker', vendor: 'schneider', healthScore: 25, healthTrend: 'degrading', remainingUsefulLife: 45, riskLevel: 'critical', healthBreakdown: { electrical: 28, thermal: 22, insulation: 25, mechanical: 26 } },
  { id: 'a5', name: 'ABB Resibloc Transformer', assetTag: 'SGP-TRF-0002', assetType: 'transformer', vendor: 'abb', healthScore: 45, healthTrend: 'degrading', remainingUsefulLife: 120, riskLevel: 'high', healthBreakdown: { electrical: 50, thermal: 38, insulation: 48, mechanical: 44 } },
  { id: 'a8', name: 'Eaton Power Defense', assetTag: 'SGP-CBR-0003', assetType: 'circuit_breaker', vendor: 'eaton', healthScore: 65, healthTrend: 'degrading', remainingUsefulLife: 280, riskLevel: 'medium', healthBreakdown: { electrical: 68, thermal: 62, insulation: 65, mechanical: 64 } },
];

const mockTopology = {
  nodes: [
    { id: 'n1', label: 'SM6-24 MV Switchgear', assetTag: 'SGP-MVS-0001', type: 'mv_switchgear', vendor: 'schneider', healthScore: 92, status: 'excellent' },
    { id: 'n2', label: 'Trihal Transformer', assetTag: 'SGP-TRF-0001', type: 'transformer', vendor: 'schneider', healthScore: 78, status: 'good' },
    { id: 'n3', label: 'Masterpact MTZ1', assetTag: 'SGP-CBR-0001', type: 'circuit_breaker', vendor: 'schneider', healthScore: 87, status: 'good' },
    { id: 'n4', label: 'Emax 2 Breaker', assetTag: 'SGP-CBR-0002', type: 'circuit_breaker', vendor: 'abb', healthScore: 85, status: 'good' },
    { id: 'n5', label: 'ABB Resibloc TX', assetTag: 'SGP-TRF-0002', type: 'transformer', vendor: 'abb', healthScore: 45, status: 'poor' },
    { id: 'n6', label: 'Eaton Power Defense', assetTag: 'SGP-CBR-0003', type: 'circuit_breaker', vendor: 'eaton', healthScore: 65, status: 'fair' },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', type: 'electrical', relationship: 'feeds', isCriticalPath: true },
    { id: 'e2', source: 'n2', target: 'n3', type: 'electrical', relationship: 'feeds', isCriticalPath: true },
    { id: 'e3', source: 'n2', target: 'n4', type: 'electrical', relationship: 'feeds', isCriticalPath: false },
    { id: 'e4', source: 'n1', target: 'n5', type: 'electrical', relationship: 'feeds', isCriticalPath: false },
    { id: 'e5', source: 'n5', target: 'n6', type: 'electrical', relationship: 'feeds', isCriticalPath: false },
  ],
};

const mockReportTemplates = [
  { id: 'asset_inventory', name: 'Asset Inventory', description: 'Complete list of all assets with their current status and health scores' },
  { id: 'health_analysis', name: 'Health Analysis', description: 'Detailed health analysis with trends and predictions for all assets' },
  { id: 'maintenance_records', name: 'Maintenance Records', description: 'Historical maintenance records including completed and scheduled tasks' },
  { id: 'alert_logs', name: 'Alert Logs', description: 'Comprehensive log of all alerts with severity and resolution status' },
];

const mockCmmsIntegrations = [
  { id: 'cmms-001', type: 'sap_pm', name: 'SAP PM Integration', isActive: true, lastSyncAt: new Date(Date.now() - 3600000).toISOString(), syncStatus: 'success', workOrdersSync: 12 },
  { id: 'cmms-002', type: 'maximo', name: 'IBM Maximo Integration', isActive: false, lastSyncAt: null, syncStatus: 'pending', workOrdersSync: 0 },
];

// ID generator
let nextId = 1000;
const generateId = () => `gen-${nextId++}`;

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
    database: DATABASE_URL ? 'configured' : 'demo-mode',
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
    mode: 'demo',
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
    'admin@canunited.demo': { id: '1', email: 'admin@canunited.demo', name: 'System Admin', role: 'administrator' },
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
  res.json({ success: true, data: mockUser });
});

app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ success: true });
});

// ============= MFA Endpoints =============

// Setup MFA - Generate QR code and backup codes
app.post('/api/v1/auth/mfa/setup', async (req, res) => {
  try {
    const email = 'admin@canunited.com'; // In real app, get from JWT
    const secret = generateSecret();
    const backupCodes = generateBackupCodes(10);

    // Store pending setup
    const userMfa = mfaStore.get(email) || { enabled: false, secret: null, backupCodes: [] };
    userMfa.pendingSetup = { secret, backupCodes, expiresAt: Date.now() + 10 * 60 * 1000 };
    mfaStore.set(email, userMfa);

    // Generate QR code
    const issuer = encodeURIComponent('CANUnited');
    const account = encodeURIComponent(email);
    const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, { width: 256, margin: 2 });

    res.json({
      success: true,
      data: {
        qrCodeUrl,
        secret, // Show secret for manual entry
        backupCodes,
        message: 'Scan QR code with your authenticator app, then verify with a code',
      },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to setup MFA' } });
  }
});

// Confirm MFA setup
app.post('/api/v1/auth/mfa/confirm', (req, res) => {
  const { code } = req.body;
  const email = 'admin@canunited.com';

  const userMfa = mfaStore.get(email);
  if (!userMfa?.pendingSetup) {
    return res.status(400).json({ success: false, error: { message: 'No pending MFA setup' } });
  }

  if (Date.now() > userMfa.pendingSetup.expiresAt) {
    userMfa.pendingSetup = undefined;
    return res.status(400).json({ success: false, error: { message: 'MFA setup expired' } });
  }

  if (!verifyTOTP(userMfa.pendingSetup.secret, code)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid verification code' } });
  }

  // Enable MFA
  userMfa.enabled = true;
  userMfa.secret = userMfa.pendingSetup.secret;
  userMfa.backupCodes = userMfa.pendingSetup.backupCodes;
  userMfa.pendingSetup = undefined;
  mfaStore.set(email, userMfa);

  res.json({ success: true, data: { message: 'MFA enabled successfully' } });
});

// Verify MFA code (during login)
app.post('/api/v1/auth/mfa/verify', (req, res) => {
  const { code, email } = req.body;
  const userMfa = mfaStore.get(email || 'admin@canunited.com');

  if (!userMfa?.enabled || !userMfa.secret) {
    return res.status(400).json({ success: false, error: { message: 'MFA not enabled' } });
  }

  if (verifyTOTP(userMfa.secret, code)) {
    return res.json({ success: true, data: { verified: true } });
  }

  // Check backup codes
  const normalizedCode = code.replace(/-/g, '').toUpperCase();
  const backupIndex = userMfa.backupCodes.findIndex(
    bc => bc.replace(/-/g, '').toUpperCase() === normalizedCode
  );
  if (backupIndex !== -1) {
    userMfa.backupCodes.splice(backupIndex, 1);
    return res.json({ success: true, data: { verified: true, usedBackupCode: true } });
  }

  res.status(400).json({ success: false, error: { message: 'Invalid MFA code' } });
});

// Disable MFA
app.post('/api/v1/auth/mfa/disable', (req, res) => {
  const { code } = req.body;
  const email = 'admin@canunited.com';
  const userMfa = mfaStore.get(email);

  if (!userMfa?.enabled || !userMfa.secret) {
    return res.status(400).json({ success: false, error: { message: 'MFA not enabled' } });
  }

  if (!verifyTOTP(userMfa.secret, code)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid MFA code' } });
  }

  userMfa.enabled = false;
  userMfa.secret = null;
  userMfa.backupCodes = [];
  mfaStore.set(email, userMfa);

  res.json({ success: true, data: { message: 'MFA disabled successfully' } });
});

// Get MFA status
app.get('/api/v1/auth/mfa/status', (req, res) => {
  const email = 'admin@canunited.com';
  const userMfa = mfaStore.get(email);
  res.json({
    success: true,
    data: {
      enabled: userMfa?.enabled || false,
      backupCodesRemaining: userMfa?.backupCodes?.length || 0,
    },
  });
});

// ============= Dashboard =============
app.get('/api/v1/dashboard', (req, res) => {
  res.json({ success: true, data: mockDashboard });
});

app.get('/api/v1/dashboard/summary', (req, res) => {
  res.json({ success: true, data: mockDashboard.summary });
});

// ============= Sites CRUD =============
app.get('/api/v1/sites', (req, res) => {
  res.json({ success: true, data: Array.from(sitesStore.values()) });
});

app.get('/api/v1/sites/:id', (req, res) => {
  const site = sitesStore.get(req.params.id);
  if (site) {
    res.json({ success: true, data: site });
  } else {
    res.status(404).json({ success: false, error: { message: 'Site not found' } });
  }
});

app.post('/api/v1/sites', (req, res) => {
  const id = generateId();
  const site = {
    id,
    name: req.body.name || 'New Site',
    code: req.body.code || `SITE-${id}`,
    address: req.body.address || { street: '', city: '', country: '', postalCode: '' },
    timezone: req.body.timezone || 'UTC',
    assetCount: 0,
    healthSummary: { avgHealthScore: 100, criticalAssets: 0 },
  };
  sitesStore.set(id, site);
  res.status(201).json({ success: true, data: site });
});

app.put('/api/v1/sites/:id', (req, res) => {
  const site = sitesStore.get(req.params.id);
  if (site) {
    const updated = { ...site, ...req.body, id: site.id };
    sitesStore.set(site.id, updated);
    res.json({ success: true, data: updated });
  } else {
    res.status(404).json({ success: false, error: { message: 'Site not found' } });
  }
});

app.delete('/api/v1/sites/:id', (req, res) => {
  if (sitesStore.delete(req.params.id)) {
    res.json({ success: true, message: 'Site deleted' });
  } else {
    res.status(404).json({ success: false, error: { message: 'Site not found' } });
  }
});

// ============= Assets CRUD =============
app.get('/api/v1/assets', (req, res) => {
  let assets = Array.from(assetsStore.values());

  // Filter by siteId if provided
  if (req.query.siteId) {
    assets = assets.filter(a => a.siteId === req.query.siteId);
  }

  // Filter by vendor if provided
  if (req.query.vendor) {
    assets = assets.filter(a => a.vendor === req.query.vendor);
  }

  // Filter by assetType if provided
  if (req.query.assetType) {
    assets = assets.filter(a => a.assetType === req.query.assetType);
  }

  res.json({
    success: true,
    data: assets,
    meta: { page: 1, perPage: 50, total: assets.length, totalPages: 1 }
  });
});

app.get('/api/v1/assets/:id', (req, res) => {
  const asset = assetsStore.get(req.params.id);
  if (asset) {
    res.json({ success: true, data: asset });
  } else {
    res.status(404).json({ success: false, error: { message: 'Asset not found' } });
  }
});

app.post('/api/v1/assets', (req, res) => {
  const id = generateId();
  const asset = {
    id,
    name: req.body.name || 'New Asset',
    assetTag: req.body.assetTag || `ASSET-${id}`,
    assetType: req.body.assetType || 'unknown',
    vendor: req.body.vendor || 'unknown',
    vendorModel: req.body.vendorModel || '',
    siteId: req.body.siteId || '',
    siteName: req.body.siteName || '',
    health: req.body.health || { overallScore: 100, status: 'excellent', trend: 'stable', electricalHealth: 100, thermalHealth: 100, insulationHealth: 100, mechanicalHealth: 100 },
  };
  assetsStore.set(id, asset);
  res.status(201).json({ success: true, data: asset });
});

app.put('/api/v1/assets/:id', (req, res) => {
  const asset = assetsStore.get(req.params.id);
  if (asset) {
    const updated = { ...asset, ...req.body, id: asset.id };
    assetsStore.set(asset.id, updated);
    res.json({ success: true, data: updated });
  } else {
    res.status(404).json({ success: false, error: { message: 'Asset not found' } });
  }
});

app.delete('/api/v1/assets/:id', (req, res) => {
  if (assetsStore.delete(req.params.id)) {
    res.json({ success: true, message: 'Asset deleted' });
  } else {
    res.status(404).json({ success: false, error: { message: 'Asset not found' } });
  }
});

// ============= Sensors CRUD =============
app.get('/api/v1/sensors', (req, res) => {
  let sensors = Array.from(sensorsStore.values());

  if (req.query.assetId) {
    sensors = sensors.filter(s => s.assignedAssetId === req.query.assetId);
  }

  res.json({ success: true, data: sensors });
});

app.get('/api/v1/sensors/:id', (req, res) => {
  const sensor = sensorsStore.get(req.params.id);
  if (sensor) {
    res.json({ success: true, data: sensor });
  } else {
    res.status(404).json({ success: false, error: { message: 'Sensor not found' } });
  }
});

app.post('/api/v1/sensors', (req, res) => {
  const id = generateId();
  const sensor = {
    id,
    name: req.body.name || 'New Sensor',
    sensorType: req.body.sensorType || 'unknown',
    vendor: req.body.vendor || 'generic',
    model: req.body.model || '',
    protocol: req.body.protocol || 'modbus_rtu',
    isOnline: true,
    batteryLevel: req.body.batteryLevel || null,
    signalStrength: 100,
    assignedAssetId: req.body.assignedAssetId || null,
    assignedAssetName: req.body.assignedAssetName || '',
  };
  sensorsStore.set(id, sensor);
  res.status(201).json({ success: true, data: sensor });
});

app.put('/api/v1/sensors/:id', (req, res) => {
  const sensor = sensorsStore.get(req.params.id);
  if (sensor) {
    const updated = { ...sensor, ...req.body, id: sensor.id };
    sensorsStore.set(sensor.id, updated);
    res.json({ success: true, data: updated });
  } else {
    res.status(404).json({ success: false, error: { message: 'Sensor not found' } });
  }
});

app.delete('/api/v1/sensors/:id', (req, res) => {
  if (sensorsStore.delete(req.params.id)) {
    res.json({ success: true, message: 'Sensor deleted' });
  } else {
    res.status(404).json({ success: false, error: { message: 'Sensor not found' } });
  }
});

// ============= Alerts CRUD =============
app.get('/api/v1/alerts', (req, res) => {
  let alerts = Array.from(alertsStore.values());

  if (req.query.status) {
    alerts = alerts.filter(a => a.status === req.query.status);
  }

  if (req.query.severity) {
    alerts = alerts.filter(a => a.severity === req.query.severity);
  }

  res.json({
    success: true,
    data: alerts,
    meta: { page: 1, perPage: 50, total: alerts.length, totalPages: 1 }
  });
});

app.get('/api/v1/alerts/summary', (req, res) => {
  const alerts = Array.from(alertsStore.values());
  const summary = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
    info: alerts.filter(a => a.severity === 'info').length,
    total: alerts.length
  };
  res.json({ success: true, data: summary });
});

app.get('/api/v1/alerts/:id', (req, res) => {
  const alert = alertsStore.get(req.params.id);
  if (alert) {
    res.json({ success: true, data: alert });
  } else {
    res.status(404).json({ success: false, error: { message: 'Alert not found' } });
  }
});

app.post('/api/v1/alerts', (req, res) => {
  const id = generateId();
  const alert = {
    id,
    severity: req.body.severity || 'medium',
    status: 'active',
    title: req.body.title || 'New Alert',
    description: req.body.description || '',
    siteName: req.body.siteName || '',
    assetName: req.body.assetName || '',
    category: req.body.category || 'system',
    source: req.body.source || 'manual',
    triggeredAt: new Date().toISOString(),
  };
  alertsStore.set(id, alert);
  res.status(201).json({ success: true, data: alert });
});

app.put('/api/v1/alerts/:id', (req, res) => {
  const alert = alertsStore.get(req.params.id);
  if (alert) {
    const updated = { ...alert, ...req.body, id: alert.id };
    alertsStore.set(alert.id, updated);
    res.json({ success: true, data: updated });
  } else {
    res.status(404).json({ success: false, error: { message: 'Alert not found' } });
  }
});

app.post('/api/v1/alerts/:id/acknowledge', (req, res) => {
  const alert = alertsStore.get(req.params.id);
  if (alert) {
    alert.status = 'acknowledged';
    alertsStore.set(alert.id, alert);
    res.json({ success: true, data: alert });
  } else {
    res.status(404).json({ success: false, error: { message: 'Alert not found' } });
  }
});

app.post('/api/v1/alerts/:id/resolve', (req, res) => {
  const alert = alertsStore.get(req.params.id);
  if (alert) {
    alert.status = 'resolved';
    alertsStore.set(alert.id, alert);
    res.json({ success: true, data: alert });
  } else {
    res.status(404).json({ success: false, error: { message: 'Alert not found' } });
  }
});

app.delete('/api/v1/alerts/:id', (req, res) => {
  if (alertsStore.delete(req.params.id)) {
    res.json({ success: true, message: 'Alert deleted' });
  } else {
    res.status(404).json({ success: false, error: { message: 'Alert not found' } });
  }
});

// ============= Maintenance CRUD =============
app.get('/api/v1/maintenance', (req, res) => {
  let tasks = Array.from(maintenanceStore.values());

  if (req.query.status) {
    tasks = tasks.filter(t => t.status === req.query.status);
  }

  if (req.query.priority) {
    tasks = tasks.filter(t => t.priority === req.query.priority);
  }

  res.json({
    success: true,
    data: tasks,
    meta: { page: 1, perPage: 50, total: tasks.length, totalPages: 1 }
  });
});

app.get('/api/v1/maintenance/upcoming', (req, res) => {
  const tasks = Array.from(maintenanceStore.values());
  res.json({
    success: true,
    data: {
      scheduled: tasks.filter(t => t.status === 'scheduled').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'completed').length,
      oemRequired: tasks.filter(t => t.oemServiceRequired).length,
    }
  });
});

app.get('/api/v1/maintenance/:id', (req, res) => {
  const task = maintenanceStore.get(req.params.id);
  if (task) {
    res.json({ success: true, data: task });
  } else {
    res.status(404).json({ success: false, error: { message: 'Maintenance task not found' } });
  }
});

app.post('/api/v1/maintenance', (req, res) => {
  const id = generateId();
  const task = {
    id,
    title: req.body.title || 'New Maintenance Task',
    description: req.body.description || '',
    taskType: req.body.taskType || 'preventive',
    priority: req.body.priority || 'medium',
    status: 'scheduled',
    siteId: req.body.siteId || '',
    siteName: req.body.siteName || '',
    assetId: req.body.assetId || '',
    assetName: req.body.assetName || '',
    assetTag: req.body.assetTag || '',
    assetVendor: req.body.assetVendor || '',
    dueDate: req.body.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
    oemServiceRequired: req.body.oemServiceRequired || false,
  };
  maintenanceStore.set(id, task);
  res.status(201).json({ success: true, data: task });
});

app.put('/api/v1/maintenance/:id', (req, res) => {
  const task = maintenanceStore.get(req.params.id);
  if (task) {
    const updated = { ...task, ...req.body, id: task.id };
    maintenanceStore.set(task.id, updated);
    res.json({ success: true, data: updated });
  } else {
    res.status(404).json({ success: false, error: { message: 'Maintenance task not found' } });
  }
});

app.delete('/api/v1/maintenance/:id', (req, res) => {
  if (maintenanceStore.delete(req.params.id)) {
    res.json({ success: true, message: 'Maintenance task deleted' });
  } else {
    res.status(404).json({ success: false, error: { message: 'Maintenance task not found' } });
  }
});

// ============= Analytics =============
app.get('/api/v1/analytics/vendor-comparison', (req, res) => {
  res.json({ success: true, data: mockVendorComparison });
});

app.get('/api/v1/analytics/failure-risk', (req, res) => {
  res.json({ success: true, data: mockFailureRisk });
});

// ============= Topology =============
app.get('/api/v1/topology/site/:siteId', (req, res) => {
  res.json({ success: true, data: mockTopology });
});

app.get('/api/v1/topology', (req, res) => {
  res.json({ success: true, data: mockTopology });
});

// ============= Reports =============
app.get('/api/v1/reports/templates', (req, res) => {
  res.json({ success: true, data: mockReportTemplates });
});

app.post('/api/v1/reports/generate', (req, res) => {
  const { templateId, format, filters } = req.body;
  res.json({
    success: true,
    data: {
      reportId: generateId(),
      templateId,
      format: format || 'pdf',
      status: 'completed',
      downloadUrl: `/api/v1/reports/download/${generateId()}`,
      generatedAt: new Date().toISOString(),
    }
  });
});

// ============= CMMS Integrations =============
app.get('/api/v1/integrations/cmms', (req, res) => {
  res.json({ success: true, data: mockCmmsIntegrations });
});

app.post('/api/v1/integrations/cmms', (req, res) => {
  const id = generateId();
  const integration = {
    id,
    type: req.body.type || 'sap_pm',
    name: req.body.name || 'New Integration',
    isActive: false,
    lastSyncAt: null,
    syncStatus: 'pending',
    workOrdersSync: 0,
  };
  mockCmmsIntegrations.push(integration);
  res.status(201).json({ success: true, data: integration });
});

app.post('/api/v1/integrations/cmms/:id/sync', (req, res) => {
  const integration = mockCmmsIntegrations.find(i => i.id === req.params.id);
  if (integration) {
    integration.lastSyncAt = new Date().toISOString();
    integration.syncStatus = 'success';
    integration.workOrdersSync += 3;
    res.json({ success: true, data: integration });
  } else {
    res.status(404).json({ success: false, error: { message: 'Integration not found' } });
  }
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
║   Mode: Demo (in-memory data, synced with frontend)       ║
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
