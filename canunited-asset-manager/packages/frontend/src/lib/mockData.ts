// Mock data for demo mode (when backend is not available)

export const mockUser = {
  id: 'mock-user-001',
  email: 'admin@canunited.demo',
  name: 'System Admin',
  role: 'administrator',
  organizationId: 'org-001',
};

export const mockDashboard = {
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

export const mockSites = [
  {
    id: 'site-001',
    name: 'Singapore Main Plant',
    code: 'SGP-001',
    address: { street: '123 Industrial Ave', city: 'Singapore', country: 'Singapore', postalCode: '123456' },
    timezone: 'Asia/Singapore',
    assetCount: 20,
    healthSummary: { avgHealthScore: 85.2, criticalAssets: 1 },
  },
  {
    id: 'site-002',
    name: 'Malaysia Factory',
    code: 'MYS-001',
    address: { street: '456 Manufacturing Rd', city: 'Kuala Lumpur', country: 'Malaysia', postalCode: '50000' },
    timezone: 'Asia/Kuala_Lumpur',
    assetCount: 15,
    healthSummary: { avgHealthScore: 78.5, criticalAssets: 2 },
  },
  {
    id: 'site-003',
    name: 'Thailand Facility',
    code: 'THA-001',
    address: { street: '789 Industry Blvd', city: 'Bangkok', country: 'Thailand', postalCode: '10100' },
    timezone: 'Asia/Bangkok',
    assetCount: 10,
    healthSummary: { avgHealthScore: 92.1, criticalAssets: 0 },
  },
];

export const mockAssets = [
  { id: 'a1', name: 'SM6-24 MV Switchgear', assetTag: 'SGP-MVS-0001', assetType: 'mv_switchgear', vendor: 'schneider', vendorModel: 'SM6-24', siteName: 'Singapore Main Plant', health: { overallScore: 92, status: 'excellent', trend: 'stable', electricalHealth: 95, thermalHealth: 90, insulationHealth: 88, mechanicalHealth: 94 } },
  { id: 'a2', name: 'Masterpact MTZ1 Breaker', assetTag: 'SGP-CBR-0001', assetType: 'circuit_breaker', vendor: 'schneider', vendorModel: 'Masterpact MTZ1', siteName: 'Singapore Main Plant', health: { overallScore: 87, status: 'good', trend: 'stable', electricalHealth: 85, thermalHealth: 88, insulationHealth: 90, mechanicalHealth: 85 } },
  { id: 'a3', name: 'Trihal Cast Resin Transformer', assetTag: 'SGP-TRF-0001', assetType: 'transformer', vendor: 'schneider', vendorModel: 'Trihal Cast Resin', siteName: 'Singapore Main Plant', health: { overallScore: 78, status: 'good', trend: 'stable', electricalHealth: 80, thermalHealth: 75, insulationHealth: 82, mechanicalHealth: 76 } },
  { id: 'a4', name: 'Emax 2 Circuit Breaker', assetTag: 'SGP-CBR-0002', assetType: 'circuit_breaker', vendor: 'abb', vendorModel: 'Emax 2', siteName: 'Singapore Main Plant', health: { overallScore: 85, status: 'good', trend: 'improving', electricalHealth: 88, thermalHealth: 82, insulationHealth: 85, mechanicalHealth: 84 } },
  { id: 'a5', name: 'ABB Resibloc Transformer', assetTag: 'SGP-TRF-0002', assetType: 'transformer', vendor: 'abb', vendorModel: 'Resibloc', siteName: 'Singapore Main Plant', health: { overallScore: 45, status: 'poor', trend: 'degrading', electricalHealth: 50, thermalHealth: 38, insulationHealth: 48, mechanicalHealth: 44 } },
  { id: 'a6', name: 'Siemens 3WL Breaker', assetTag: 'MYS-CBR-0001', assetType: 'circuit_breaker', vendor: 'siemens', vendorModel: '3WL', siteName: 'Malaysia Factory', health: { overallScore: 88, status: 'good', trend: 'stable', electricalHealth: 90, thermalHealth: 86, insulationHealth: 88, mechanicalHealth: 89 } },
  { id: 'a7', name: 'NXPLUS C Switchgear', assetTag: 'MYS-MVS-0001', assetType: 'mv_switchgear', vendor: 'siemens', vendorModel: 'NXPLUS C', siteName: 'Malaysia Factory', health: { overallScore: 91, status: 'excellent', trend: 'stable', electricalHealth: 93, thermalHealth: 89, insulationHealth: 92, mechanicalHealth: 90 } },
  { id: 'a8', name: 'Eaton Power Defense', assetTag: 'SGP-CBR-0003', assetType: 'circuit_breaker', vendor: 'eaton', vendorModel: 'Power Defense', siteName: 'Singapore Main Plant', health: { overallScore: 65, status: 'fair', trend: 'degrading', electricalHealth: 68, thermalHealth: 62, insulationHealth: 65, mechanicalHealth: 64 } },
  { id: 'a9', name: 'Schneider ComPact NSX', assetTag: 'MYS-CBR-0005', assetType: 'circuit_breaker', vendor: 'schneider', vendorModel: 'ComPact NSX', siteName: 'Malaysia Factory', health: { overallScore: 25, status: 'critical', trend: 'degrading', electricalHealth: 28, thermalHealth: 22, insulationHealth: 25, mechanicalHealth: 26 } },
  { id: 'a10', name: 'ABB ACS880 VFD', assetTag: 'THA-VFD-0001', assetType: 'vfd', vendor: 'abb', vendorModel: 'ACS880', siteName: 'Thailand Facility', health: { overallScore: 72, status: 'fair', trend: 'stable', electricalHealth: 75, thermalHealth: 70, insulationHealth: 72, mechanicalHealth: 71 } },
];

export const mockAlerts = [
  { id: '1', severity: 'critical', status: 'active', title: 'High Temperature Detected', description: 'Transformer TX-001 temperature exceeds 85°C threshold', siteName: 'Singapore Main Plant', assetName: 'Trihal Cast Resin Transformer', category: 'thermal', source: 'sensor', triggeredAt: new Date().toISOString() },
  { id: '2', severity: 'high', status: 'active', title: 'Partial Discharge Activity', description: 'PD levels at 45pC detected on MV Switchgear', siteName: 'Malaysia Factory', assetName: 'NXPLUS C Switchgear', category: 'insulation', source: 'sensor', triggeredAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', severity: 'medium', status: 'acknowledged', title: 'Breaker Operation Count High', description: 'Operation count reached 8000 of 10000 lifecycle', siteName: 'Singapore Main Plant', assetName: 'Masterpact MTZ1 Breaker', category: 'mechanical', source: 'system', triggeredAt: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', severity: 'low', status: 'active', title: 'Scheduled Maintenance Due', description: 'Annual inspection due in 7 days', siteName: 'Thailand Facility', assetName: 'ABB ACS880 VFD', category: 'maintenance', source: 'system', triggeredAt: new Date(Date.now() - 86400000).toISOString() },
  { id: '5', severity: 'critical', status: 'active', title: 'Critical Health Degradation', description: 'Asset health dropped below 30%', siteName: 'Malaysia Factory', assetName: 'Schneider ComPact NSX', category: 'health', source: 'analytics', triggeredAt: new Date(Date.now() - 1800000).toISOString() },
];

export const mockAlertsSummary = {
  critical: 2,
  high: 1,
  medium: 2,
  low: 2,
  info: 0,
  total: 7,
};

export const mockSensors = [
  { id: 's1', name: 'CL110 Temp/Humidity Sensor 1', sensorType: 'temperature_humidity', vendor: 'schneider', model: 'CL110', protocol: 'zigbee', isOnline: true, batteryLevel: 85, signalStrength: 92, assignedAssetName: 'SM6-24 MV Switchgear' },
  { id: 's2', name: 'Easergy PD Sensor', sensorType: 'partial_discharge', vendor: 'schneider', model: 'Easergy PD', protocol: 'modbus_tcp', isOnline: true, batteryLevel: null, signalStrength: 98, assignedAssetName: 'NXPLUS C Switchgear' },
  { id: 's3', name: 'HeatTag Thermal Sensor', sensorType: 'heat_tag', vendor: 'schneider', model: 'HeatTag', protocol: 'zigbee', isOnline: true, batteryLevel: 72, signalStrength: 88, assignedAssetName: 'Trihal Cast Resin Transformer' },
  { id: 's4', name: 'Bosch CISS Vibration', sensorType: 'vibration', vendor: 'bosch', model: 'CISS Vibration', protocol: 'lorawan', isOnline: true, batteryLevel: 65, signalStrength: 78, assignedAssetName: 'ABB ACS880 VFD' },
  { id: 's5', name: 'Generic CT Sensor', sensorType: 'current', vendor: 'generic', model: 'CT-100A', protocol: 'modbus_rtu', isOnline: false, batteryLevel: null, signalStrength: 0, assignedAssetName: 'Eaton Power Defense' },
  { id: 's6', name: 'CL110 Temp/Humidity Sensor 2', sensorType: 'temperature_humidity', vendor: 'schneider', model: 'CL110', protocol: 'zigbee', isOnline: true, batteryLevel: 23, signalStrength: 85, assignedAssetName: 'ABB Resibloc Transformer' },
];

export const mockMaintenance = [
  { id: 'm1', title: 'Annual Breaker Inspection', description: 'Comprehensive inspection of breaker contacts and mechanism', taskType: 'preventive', priority: 'medium', status: 'scheduled', siteName: 'Singapore Main Plant', assetName: 'Masterpact MTZ1 Breaker', assetTag: 'SGP-CBR-0001', assetVendor: 'schneider', dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), oemServiceRequired: false },
  { id: 'm2', title: 'Thermal Scan Required', description: 'Infrared thermal scan due to elevated temperatures', taskType: 'predictive', priority: 'high', status: 'scheduled', siteName: 'Singapore Main Plant', assetName: 'ABB Resibloc Transformer', assetTag: 'SGP-TRF-0002', assetVendor: 'abb', dueDate: new Date(Date.now() + 2 * 86400000).toISOString(), oemServiceRequired: true },
  { id: 'm3', title: 'Replace Worn Contacts', description: 'Contact replacement due to high operation count', taskType: 'corrective', priority: 'urgent', status: 'in_progress', siteName: 'Malaysia Factory', assetName: 'Schneider ComPact NSX', assetTag: 'MYS-CBR-0005', assetVendor: 'schneider', dueDate: new Date(Date.now() - 1 * 86400000).toISOString(), oemServiceRequired: true },
  { id: 'm4', title: 'Visual Inspection', description: 'Routine visual inspection of switchgear', taskType: 'inspection', priority: 'low', status: 'scheduled', siteName: 'Thailand Facility', assetName: 'ABB ACS880 VFD', assetTag: 'THA-VFD-0001', assetVendor: 'abb', dueDate: new Date(Date.now() + 14 * 86400000).toISOString(), oemServiceRequired: false },
];

export const mockMaintenanceUpcoming = {
  scheduled: 8,
  inProgress: 2,
  overdue: 2,
  oemRequired: 4,
};

export const mockVendorComparison = {
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

export const mockFailureRisk = [
  { id: 'a9', name: 'Schneider ComPact NSX', assetTag: 'MYS-CBR-0005', assetType: 'circuit_breaker', vendor: 'schneider', healthScore: 25, healthTrend: 'degrading', remainingUsefulLife: 45, riskLevel: 'critical', healthBreakdown: { electrical: 28, thermal: 22, insulation: 25, mechanical: 26 } },
  { id: 'a5', name: 'ABB Resibloc Transformer', assetTag: 'SGP-TRF-0002', assetType: 'transformer', vendor: 'abb', healthScore: 45, healthTrend: 'degrading', remainingUsefulLife: 120, riskLevel: 'high', healthBreakdown: { electrical: 50, thermal: 38, insulation: 48, mechanical: 44 } },
  { id: 'a8', name: 'Eaton Power Defense', assetTag: 'SGP-CBR-0003', assetType: 'circuit_breaker', vendor: 'eaton', healthScore: 65, healthTrend: 'degrading', remainingUsefulLife: 280, riskLevel: 'medium', healthBreakdown: { electrical: 68, thermal: 62, insulation: 65, mechanical: 64 } },
];

export const mockTopology = {
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

// Report templates
export const mockReportTemplates = [
  {
    id: 'asset_inventory',
    name: 'Asset Inventory',
    description: 'Complete list of all assets with their current status and health scores',
  },
  {
    id: 'health_analysis',
    name: 'Health Analysis',
    description: 'Detailed health analysis with trends and predictions for all assets',
  },
  {
    id: 'maintenance_records',
    name: 'Maintenance Records',
    description: 'Historical maintenance records including completed and scheduled tasks',
  },
  {
    id: 'alert_logs',
    name: 'Alert Logs',
    description: 'Comprehensive log of all alerts with severity and resolution status',
  },
];

// CMMS integrations
export const mockCmmsIntegrations = [
  {
    id: 'cmms-001',
    type: 'sap_pm',
    name: 'SAP PM Integration',
    isActive: true,
    lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
    syncStatus: 'success',
    workOrdersSync: 12,
  },
  {
    id: 'cmms-002',
    type: 'maximo',
    name: 'IBM Maximo Integration',
    isActive: false,
    lastSyncAt: null,
    syncStatus: 'pending',
    workOrdersSync: 0,
  },
];

// Team members for task assignment
export const mockTeamMembers = [
  { id: 'user-001', name: 'System Admin', role: 'administrator', roleLabel: 'Administrator', avatar: 'SA' },
  { id: 'user-002', name: 'John Smith', role: 'technician', roleLabel: 'Technician', avatar: 'JS' },
  { id: 'user-003', name: 'Jane Doe', role: 'reliability_engineer', roleLabel: 'Reliability Engineer', avatar: 'JD' },
  { id: 'user-004', name: 'Mike Johnson', role: 'field_technician', roleLabel: 'Field Technician', avatar: 'MJ' },
  { id: 'user-005', name: 'Sarah Wilson', role: 'asset_manager', roleLabel: 'Asset Manager', avatar: 'SW' },
  { id: 'user-006', name: 'Tom Brown', role: 'technician', roleLabel: 'Technician', avatar: 'TB' },
  { id: 'user-007', name: 'Lisa Chen', role: 'analyst', roleLabel: 'Analyst', avatar: 'LC' },
];

// Current user info
export const mockCurrentUser = {
  id: 'user-001',
  email: 'admin@canunited.com',
  name: 'System Admin',
  firstName: 'System',
  lastName: 'Admin',
  role: 'administrator',
  roleLabel: 'Administrator',
  mfaEnabled: false,
  isActive: true,
};

// Audit logs for history tracking
export const mockAuditLogs = [
  {
    id: 'audit-001',
    action: 'maintenance.created',
    actionLabel: 'Task Created',
    entityType: 'maintenance_task',
    entityId: 'task-1',
    userName: 'System Admin',
    oldValues: null,
    newValues: { title: 'Annual Breaker Inspection', priority: 'medium' },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'audit-002',
    action: 'maintenance.assigned',
    actionLabel: 'Task Assigned',
    entityType: 'maintenance_task',
    entityId: 'task-1',
    userName: 'System Admin',
    oldValues: { assignedTo: null },
    newValues: { assignedTo: 'John Smith' },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'audit-003',
    action: 'maintenance.status_changed',
    actionLabel: 'Status Changed',
    entityType: 'maintenance_task',
    entityId: 'task-2',
    userName: 'John Smith',
    oldValues: { status: 'scheduled' },
    newValues: { status: 'in_progress' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'audit-004',
    action: 'maintenance.completed',
    actionLabel: 'Task Completed',
    entityType: 'maintenance_task',
    entityId: 'task-3',
    userName: 'Mike Johnson',
    oldValues: { status: 'in_progress' },
    newValues: { status: 'completed', actualDurationHours: 4.5 },
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

// Check if we're in mock mode (no backend available)
export const isMockMode = (): boolean => {
  return true; // Always use mock mode for now
};
