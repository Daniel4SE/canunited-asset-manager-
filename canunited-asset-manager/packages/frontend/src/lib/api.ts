import axios from 'axios';
import * as mockData from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Demo mode - automatically disabled when real API URL is provided
const DEMO_MODE = !import.meta.env.VITE_API_URL || import.meta.env.VITE_DEMO_MODE === 'true';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('canunited-auth');
    if (stored) {
      const { state } = JSON.parse(stored);
      // authStore persists 'accessToken', not 'token'
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('canunited-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Auth
  login: '/auth/login',
  register: '/auth/register',
  me: '/auth/me',
  
  // Dashboard
  dashboard: '/dashboard',
  siteDashboard: (siteId: string) => `/dashboard/site/${siteId}`,
  
  // Sites
  sites: '/sites',
  site: (id: string) => `/sites/${id}`,
  
  // Assets
  assets: '/assets',
  asset: (id: string) => `/assets/${id}`,
  assetQR: (id: string) => `/assets/${id}/qrcode`,
  assetHealth: (id: string) => `/assets/${id}/health-history`,
  
  // Sensors
  sensors: '/sensors',
  sensor: (id: string) => `/sensors/${id}`,
  sensorReadings: (id: string) => `/sensors/${id}/readings`,
  
  // Alerts
  alerts: '/alerts',
  alertsSummary: '/alerts/summary',
  alertAcknowledge: (id: string) => `/alerts/${id}/acknowledge`,
  alertResolve: (id: string) => `/alerts/${id}/resolve`,
  
  // Maintenance
  maintenance: '/maintenance',
  maintenanceUpcoming: '/maintenance/upcoming',
  maintenanceStatus: (id: string) => `/maintenance/${id}/status`,
  
  // Topology
  topology: (siteId: string) => `/topology/site/${siteId}`,
  singleLine: (siteId: string) => `/topology/single-line/${siteId}`,
  criticalPath: (siteId: string) => `/topology/critical-path/${siteId}`,
  
  // Analytics
  vendorComparison: '/analytics/vendor-comparison',
  healthTrends: '/analytics/health-trends',
  failureRisk: '/analytics/failure-risk',
  crossVendorCorrelation: '/analytics/cross-vendor-correlation',
  maintenanceEffectiveness: '/analytics/maintenance-effectiveness',
  lifecycleAnalysis: '/analytics/lifecycle-analysis',

  // Predictions
  assetRul: (assetId: string) => `/predictions/${assetId}/rul`,
  fleetPredictions: '/predictions/fleet',
  riskDistribution: '/predictions/risk-distribution',

  // Reports
  reportTemplates: '/reports/templates',
  generateReport: '/reports/generate',

  // Integrations
  cmmsIntegrations: '/integrations/cmms',
  cmmsIntegration: (id: string) => `/integrations/cmms/${id}`,
  cmmsSync: (id: string) => `/integrations/cmms/${id}/sync`,

  // Users
  users: '/users',
  usersAssignable: '/users/assignable',
  userMe: '/users/me',

  // Audit
  auditLogs: '/audit',
  auditEntity: (entityType: string, entityId: string) => `/audit/entity/${entityType}/${entityId}`,
};

// Mock API wrapper for demo mode
export const mockApi = {
  get: async (endpoint: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Helper: check if endpoint starts with a path (ignoring query params)
    const matchesPath = (path: string) => {
      const basePath = endpoint.split('?')[0];
      return basePath === path || endpoint.startsWith(path + '?') || endpoint.startsWith(path + '/');
    };

    // Return mock data based on endpoint
    if (matchesPath(endpoints.dashboard)) {
      return { data: { data: mockData.mockDashboard } };
    }
    if (matchesPath(endpoints.sites)) {
      return { data: { data: mockData.mockSites } };
    }
    if (endpoint.split('?')[0] === endpoints.assets) {
      return { data: { data: mockData.mockAssets, meta: { page: 1, perPage: 12, total: mockData.mockAssets.length, totalPages: 1 } } };
    }
    if (endpoint.match(/\/assets\/[^/?]+(\?|$)/)) {
      const id = endpoint.split('/assets/')[1]?.split(/[/?]/)[0];
      const asset = mockData.mockAssets.find(a => a.id === id);
      return { data: { data: asset || mockData.mockAssets[0] } };
    }
    if (endpoint.includes('/health-history')) {
      return { data: { data: generateMockHealthHistory() } };
    }
    if (matchesPath(endpoints.alerts)) {
      return { data: { data: mockData.mockAlerts, meta: { page: 1, perPage: 50, total: mockData.mockAlerts.length, totalPages: 1 } } };
    }
    if (matchesPath(endpoints.alertsSummary)) {
      return { data: { data: mockData.mockAlertsSummary } };
    }
    if (matchesPath(endpoints.sensors)) {
      return { data: { data: mockData.mockSensors } };
    }
    if (matchesPath(endpoints.maintenance)) {
      return { data: { data: mockData.mockMaintenance, meta: { page: 1, perPage: 20, total: mockData.mockMaintenance.length, totalPages: 1 } } };
    }
    if (matchesPath(endpoints.maintenanceUpcoming)) {
      return { data: { data: mockData.mockMaintenanceUpcoming } };
    }
    if (matchesPath(endpoints.vendorComparison)) {
      return { data: { data: mockData.mockVendorComparison } };
    }
    if (matchesPath(endpoints.failureRisk)) {
      return { data: { data: mockData.mockFailureRisk } };
    }
    if (matchesPath(endpoints.healthTrends)) {
      return { data: { data: { dataPoints: generateMockTrendData() } } };
    }
    if (matchesPath(endpoints.lifecycleAnalysis)) {
      return { data: { data: generateMockLifecycleData() } };
    }
    if (endpoint.includes('/topology/site/')) {
      return { data: { data: mockData.mockTopology } };
    }
    if (endpoint.includes('/predictions/') && endpoint.includes('/rul')) {
      return { data: { data: generateMockRulPrediction() } };
    }
    if (matchesPath('/predictions/fleet')) {
      return { data: { data: generateMockFleetPredictions() } };
    }
    if (matchesPath('/predictions/risk-distribution')) {
      return { data: { data: generateMockRiskDistribution() } };
    }
    if (matchesPath('/reports/templates')) {
      return { data: { data: mockData.mockReportTemplates } };
    }
    if (matchesPath('/integrations/cmms')) {
      return { data: { data: mockData.mockCmmsIntegrations } };
    }
    if (matchesPath('/users/assignable')) {
      return { data: { data: mockData.mockTeamMembers } };
    }
    if (matchesPath('/users/me')) {
      return { data: { data: mockData.mockCurrentUser } };
    }
    if (matchesPath('/users')) {
      return { data: { data: mockData.mockTeamMembers } };
    }
    if (endpoint.includes('/audit/entity/')) {
      return { data: { data: mockData.mockAuditLogs, meta: { total: mockData.mockAuditLogs.length, page: 1, perPage: 20, totalPages: 1 } } };
    }
    if (matchesPath('/audit')) {
      return { data: { data: mockData.mockAuditLogs, meta: { total: mockData.mockAuditLogs.length, page: 1, perPage: 50, totalPages: 1 } } };
    }

    // Default empty response
    console.warn('[MockAPI] No mock data for endpoint:', endpoint);
    return { data: { data: [] } };
  },
  
  post: async (endpoint: string, _data?: any) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { data: { success: true } };
  }
};

// Helper to generate mock health history
function generateMockHealthHistory() {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      timestamp: date.toISOString(),
      healthScore: 75 + Math.sin(i / 5) * 10 + Math.random() * 5,
      electricalHealth: 78 + Math.random() * 10,
      thermalHealth: 72 + Math.random() * 10,
      insulationHealth: 76 + Math.random() * 10,
      mechanicalHealth: 74 + Math.random() * 10,
    });
  }
  return data;
}

// Helper to generate mock trend data
function generateMockTrendData() {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      timestamp: date.toISOString(),
      avgHealth: 80 + Math.sin(i / 5) * 5 + Math.random() * 3,
      avgElectrical: 82 + Math.random() * 5,
      avgThermal: 78 + Math.random() * 5,
      avgInsulation: 80 + Math.random() * 5,
      avgMechanical: 79 + Math.random() * 5,
    });
  }
  return data;
}

// Helper to generate mock lifecycle data
function generateMockLifecycleData() {
  return [
    { assetType: 'circuit_breaker', vendor: 'schneider', count: 8, avgAgeYears: '3.2', avgHealth: '82.5', avgRulDays: 850, outOfWarranty: 2, warrantyExpiringSoon: 1 },
    { assetType: 'circuit_breaker', vendor: 'abb', count: 5, avgAgeYears: '2.8', avgHealth: '78.2', avgRulDays: 720, outOfWarranty: 1, warrantyExpiringSoon: 0 },
    { assetType: 'transformer', vendor: 'schneider', count: 4, avgAgeYears: '4.5', avgHealth: '75.8', avgRulDays: 650, outOfWarranty: 2, warrantyExpiringSoon: 1 },
    { assetType: 'mv_switchgear', vendor: 'siemens', count: 3, avgAgeYears: '2.1', avgHealth: '91.2', avgRulDays: 1200, outOfWarranty: 0, warrantyExpiringSoon: 0 },
    { assetType: 'vfd', vendor: 'abb', count: 2, avgAgeYears: '1.8', avgHealth: '88.5', avgRulDays: 980, outOfWarranty: 0, warrantyExpiringSoon: 1 },
  ];
}

// Helper to generate mock RUL prediction
function generateMockRulPrediction() {
  const currentHealth = 75 + Math.random() * 15;
  const degradationRate = 0.05 + Math.random() * 0.2;
  const predictedRul = Math.round((currentHealth - 20) / degradationRate);
  const failureProbability30d = Math.min(0.95, Math.max(0.02, 1 - Math.pow(0.99, 30 * degradationRate)));

  const healthForecast = [];
  const today = new Date();
  let health = currentHealth;
  for (let i = 0; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    healthForecast.push({
      date: date.toISOString().split('T')[0],
      predicted: Math.max(0, health),
    });
    health -= degradationRate + (Math.random() - 0.5) * 0.1;
  }

  const trends = ['improving', 'stable', 'declining'] as const;
  const healthTrend = degradationRate > 0.15 ? 'declining' : degradationRate < 0.08 ? 'stable' : trends[Math.floor(Math.random() * 3)];

  return {
    assetId: 'mock-asset',
    predictedRul,
    degradationRate: Math.round(degradationRate * 1000) / 1000,
    confidenceLow: Math.round(predictedRul * 0.7),
    confidenceHigh: Math.round(predictedRul * 1.3),
    failureProbability30d: Math.round(failureProbability30d * 1000) / 1000,
    healthTrend,
    predictedAt: new Date().toISOString(),
    healthForecast,
    riskLevel: failureProbability30d > 0.5 ? 'critical' : failureProbability30d > 0.3 ? 'high' : failureProbability30d > 0.1 ? 'medium' : 'low',
    maintenanceRecommendation: {
      urgency: failureProbability30d > 0.5 ? 'immediate' : failureProbability30d > 0.3 ? 'within_week' : 'scheduled',
      recommendedDate: new Date(Date.now() + (predictedRul * 0.7 * 24 * 60 * 60 * 1000)).toISOString(),
      description: failureProbability30d > 0.3
        ? 'High failure risk detected. Schedule maintenance soon.'
        : 'Schedule preventive maintenance at optimal time.',
    },
  };
}

// Helper to generate mock fleet predictions
function generateMockFleetPredictions() {
  const predictions = mockData.mockAssets.slice(0, 5).map((asset) => ({
    ...generateMockRulPrediction(),
    assetId: asset.id,
  }));

  const atRisk = predictions.filter((p) => p.failureProbability30d > 0.3).length;
  const healthy = predictions.filter((p) => p.failureProbability30d < 0.1).length;
  const avgRul = Math.round(predictions.reduce((sum, p) => sum + p.predictedRul, 0) / predictions.length);

  return {
    predictions,
    summary: {
      atRisk,
      healthy,
      avgRul,
      shortestRul: predictions.reduce(
        (min, p) => (p.predictedRul < min.rul ? { assetId: p.assetId, rul: p.predictedRul } : min),
        { assetId: '', rul: Infinity }
      ),
    },
  };
}

// Helper to generate mock risk distribution
function generateMockRiskDistribution() {
  return {
    distribution: {
      critical: 2,
      high: 5,
      medium: 12,
      low: 31,
      total: 50,
    },
    criticalAssets: [
      { id: 'asset-004', name: 'Power Transformer T2', rul: 28, probability: 0.52 },
      { id: 'asset-012', name: 'LV Panel B3', rul: 35, probability: 0.48 },
    ],
    lastUpdated: new Date().toISOString(),
  };
}

// Export the appropriate API based on mode
export const getApi = () => DEMO_MODE ? mockApi : api;
