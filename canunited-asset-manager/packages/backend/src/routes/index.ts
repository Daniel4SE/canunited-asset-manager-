import { Express } from 'express';
import { authRoutes } from './auth.routes.js';
import { ssoRoutes } from './sso.routes.js';
import { assetRoutes } from './asset.routes.js';
import { siteRoutes } from './site.routes.js';
import { sensorRoutes } from './sensor.routes.js';
import { alertRoutes } from './alert.routes.js';
import { maintenanceRoutes } from './maintenance.routes.js';
import { analyticsRoutes } from './analytics.routes.js';
import { topologyRoutes } from './topology.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { reportsRoutes } from './reports.routes.js';
import { predictionRoutes } from './prediction.routes.js';
import { integrationRoutes } from './integration.routes.js';

export function setupRoutes(app: Express): void {
  const apiPrefix = '/api/v1';

  // Public routes
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/auth/sso`, ssoRoutes);
  
  // Protected routes
  app.use(`${apiPrefix}/sites`, siteRoutes);
  app.use(`${apiPrefix}/assets`, assetRoutes);
  app.use(`${apiPrefix}/sensors`, sensorRoutes);
  app.use(`${apiPrefix}/alerts`, alertRoutes);
  app.use(`${apiPrefix}/maintenance`, maintenanceRoutes);
  app.use(`${apiPrefix}/analytics`, analyticsRoutes);
  app.use(`${apiPrefix}/topology`, topologyRoutes);
  app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
  app.use(`${apiPrefix}/reports`, reportsRoutes);
  app.use(`${apiPrefix}/predictions`, predictionRoutes);
  app.use(`${apiPrefix}/integrations`, integrationRoutes);

  console.log('✅ API routes initialized');
}
