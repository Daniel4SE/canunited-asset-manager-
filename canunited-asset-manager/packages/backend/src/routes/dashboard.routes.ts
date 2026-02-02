import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);

// Get main dashboard data
dashboardRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    // Get overall stats
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM sites WHERE organization_id = $1) as total_sites,
        (SELECT COUNT(*) FROM assets WHERE organization_id = $1) as total_assets,
        (SELECT COUNT(*) FROM sensors WHERE organization_id = $1) as total_sensors,
        (SELECT COUNT(*) FROM gateways WHERE organization_id = $1) as total_gateways,
        (SELECT AVG(health_score) FROM assets WHERE organization_id = $1) as avg_health,
        (SELECT COUNT(*) FROM assets WHERE organization_id = $1 AND health_status = 'critical') as critical_assets,
        (SELECT COUNT(*) FROM alerts WHERE organization_id = $1 AND status = 'active') as active_alerts,
        (SELECT COUNT(*) FROM maintenance_tasks WHERE organization_id = $1 AND status IN ('scheduled', 'in_progress') AND due_date <= NOW() + INTERVAL '7 days') as upcoming_maintenance`,
      [orgId]
    );

    // Get health distribution
    const healthDistResult = await query(
      `SELECT health_status, COUNT(*) as count
       FROM assets WHERE organization_id = $1
       GROUP BY health_status`,
      [orgId]
    );

    // Get vendor distribution
    const vendorDistResult = await query(
      `SELECT vendor, COUNT(*) as count, AVG(health_score) as avg_health
       FROM assets WHERE organization_id = $1
       GROUP BY vendor`,
      [orgId]
    );

    // Get recent alerts
    const recentAlertsResult = await query(
      `SELECT a.*, s.name as site_name, ast.name as asset_name
       FROM alerts a
       LEFT JOIN sites s ON a.site_id = s.id
       LEFT JOIN assets ast ON a.asset_id = ast.id
       WHERE a.organization_id = $1 AND a.status = 'active'
       ORDER BY 
         CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         a.triggered_at DESC
       LIMIT 10`,
      [orgId]
    );

    // Get assets needing attention
    const attentionAssetsResult = await query(
      `SELECT id, name, asset_tag, asset_type, vendor, health_score, health_status, health_trend
       FROM assets
       WHERE organization_id = $1 
       AND (health_score < 50 OR health_trend = 'degrading')
       ORDER BY health_score ASC
       LIMIT 10`,
      [orgId]
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        summary: {
          totalSites: parseInt(stats.total_sites) || 0,
          totalAssets: parseInt(stats.total_assets) || 0,
          totalSensors: parseInt(stats.total_sensors) || 0,
          totalGateways: parseInt(stats.total_gateways) || 0,
          avgHealthScore: parseFloat(stats.avg_health)?.toFixed(1) || 100,
          criticalAssets: parseInt(stats.critical_assets) || 0,
          activeAlerts: parseInt(stats.active_alerts) || 0,
          upcomingMaintenance: parseInt(stats.upcoming_maintenance) || 0
        },
        healthDistribution: healthDistResult.rows.reduce((acc, row) => {
          acc[row.health_status] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>),
        vendorDistribution: vendorDistResult.rows.map(row => ({
          vendor: row.vendor,
          count: parseInt(row.count),
          avgHealth: parseFloat(row.avg_health)?.toFixed(1) || 0
        })),
        recentAlerts: recentAlertsResult.rows.map(row => ({
          id: row.id,
          severity: row.severity,
          title: row.title,
          siteName: row.site_name,
          assetName: row.asset_name,
          triggeredAt: row.triggered_at
        })),
        assetsNeedingAttention: attentionAssetsResult.rows.map(row => ({
          id: row.id,
          name: row.name,
          assetTag: row.asset_tag,
          assetType: row.asset_type,
          vendor: row.vendor,
          healthScore: row.health_score,
          status: row.health_status,
          trend: row.health_trend
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get site-specific dashboard
dashboardRoutes.get('/site/:siteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.params;
    const orgId = req.user!.organizationId;

    // Get site info
    const siteResult = await query(
      `SELECT * FROM sites WHERE id = $1 AND organization_id = $2`,
      [siteId, orgId]
    );

    if (siteResult.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });
      return;
    }

    // Get site stats
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_assets,
        AVG(health_score) as avg_health,
        COUNT(*) FILTER (WHERE health_status = 'critical') as critical,
        COUNT(*) FILTER (WHERE health_status = 'poor') as poor,
        COUNT(*) FILTER (WHERE health_status = 'fair') as fair,
        COUNT(*) FILTER (WHERE health_status = 'good') as good,
        COUNT(*) FILTER (WHERE health_status = 'excellent') as excellent
       FROM assets WHERE site_id = $1`,
      [siteId]
    );

    // Get alerts for site
    const alertsResult = await query(
      `SELECT severity, COUNT(*) as count
       FROM alerts WHERE site_id = $1 AND status = 'active'
       GROUP BY severity`,
      [siteId]
    );

    // Get vendor breakdown
    const vendorResult = await query(
      `SELECT vendor, asset_type, COUNT(*) as count, AVG(health_score) as avg_health
       FROM assets WHERE site_id = $1
       GROUP BY vendor, asset_type
       ORDER BY vendor, asset_type`,
      [siteId]
    );

    // Get recent sensor readings summary
    const sensorResult = await query(
      `SELECT 
        s.sensor_type,
        COUNT(DISTINCT s.id) as sensor_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_online) as online_count
       FROM sensors s
       WHERE s.site_id = $1
       GROUP BY s.sensor_type`,
      [siteId]
    );

    const site = siteResult.rows[0];
    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        site: {
          id: site.id,
          name: site.name,
          code: site.code,
          address: site.address,
          timezone: site.timezone
        },
        summary: {
          totalAssets: parseInt(stats.total_assets) || 0,
          avgHealthScore: parseFloat(stats.avg_health)?.toFixed(1) || 100
        },
        healthDistribution: {
          excellent: parseInt(stats.excellent) || 0,
          good: parseInt(stats.good) || 0,
          fair: parseInt(stats.fair) || 0,
          poor: parseInt(stats.poor) || 0,
          critical: parseInt(stats.critical) || 0
        },
        alertSummary: alertsResult.rows.reduce((acc, row) => {
          acc[row.severity] = parseInt(row.count);
          return acc;
        }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<string, number>),
        vendorBreakdown: vendorResult.rows.map(row => ({
          vendor: row.vendor,
          assetType: row.asset_type,
          count: parseInt(row.count),
          avgHealth: parseFloat(row.avg_health)?.toFixed(1)
        })),
        sensorStatus: sensorResult.rows.map(row => ({
          type: row.sensor_type,
          total: parseInt(row.sensor_count),
          online: parseInt(row.online_count)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get real-time metrics stream configuration
dashboardRoutes.get('/realtime-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        wsEndpoint: '/ws',
        subscriptionChannels: [
          'sensor_readings',
          'asset_health',
          'alerts',
          'maintenance'
        ],
        refreshIntervals: {
          dashboard: 30000,
          sensorData: 5000,
          alerts: 10000
        }
      }
    });
  } catch (error) {
    next(error);
  }
});
