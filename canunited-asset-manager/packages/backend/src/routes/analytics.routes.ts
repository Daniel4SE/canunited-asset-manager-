import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { VendorType, AssetType } from '../types/index.js';

export const analyticsRoutes = Router();

analyticsRoutes.use(authenticate);

// Vendor comparison analytics
analyticsRoutes.get('/vendor-comparison', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetType, metric = 'health_score' } = req.query;

    let whereCondition = 'organization_id = $1';
    const params: unknown[] = [req.user!.organizationId];

    if (assetType) {
      whereCondition += ' AND asset_type = $2';
      params.push(assetType);
    }

    const result = await query(
      `SELECT 
        vendor,
        COUNT(*) as sample_size,
        AVG(health_score) as avg_health,
        AVG(electrical_health) as avg_electrical,
        AVG(thermal_health) as avg_thermal,
        AVG(insulation_health) as avg_insulation,
        AVG(mechanical_health) as avg_mechanical,
        MIN(health_score) as min_health,
        MAX(health_score) as max_health,
        STDDEV(health_score) as stddev_health
       FROM assets
       WHERE ${whereCondition}
       GROUP BY vendor
       ORDER BY avg_health DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        metric,
        assetType: assetType || 'all',
        vendors: result.rows.map(row => ({
          vendor: row.vendor,
          sampleSize: parseInt(row.sample_size),
          avgHealth: parseFloat(row.avg_health) || 0,
          avgElectrical: parseFloat(row.avg_electrical) || 0,
          avgThermal: parseFloat(row.avg_thermal) || 0,
          avgInsulation: parseFloat(row.avg_insulation) || 0,
          avgMechanical: parseFloat(row.avg_mechanical) || 0,
          minHealth: parseFloat(row.min_health) || 0,
          maxHealth: parseFloat(row.max_health) || 0,
          stddevHealth: parseFloat(row.stddev_health) || 0
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Health trends over time
analyticsRoutes.get('/health-trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId, assetId, days = '30', interval = 'day' } = req.query;

    let whereConditions = ['a.organization_id = $1'];
    const params: unknown[] = [req.user!.organizationId];
    let paramIndex = 2;

    if (siteId) {
      whereConditions.push(`a.site_id = $${paramIndex++}`);
      params.push(siteId);
    }
    if (assetId) {
      whereConditions.push(`a.id = $${paramIndex++}`);
      params.push(assetId);
    }

    const intervalMap: Record<string, string> = {
      'hour': '1 hour',
      'day': '1 day',
      'week': '1 week'
    };
    const sqlInterval = intervalMap[interval as string] || '1 day';

    const result = await query(
      `SELECT 
        date_trunc('${interval}', h.timestamp) as period,
        AVG(h.health_score) as avg_health,
        AVG(h.electrical_health) as avg_electrical,
        AVG(h.thermal_health) as avg_thermal,
        AVG(h.insulation_health) as avg_insulation,
        AVG(h.mechanical_health) as avg_mechanical,
        COUNT(DISTINCT h.asset_id) as asset_count
       FROM asset_health_history h
       JOIN assets a ON h.asset_id = a.id
       WHERE ${whereConditions.join(' AND ')}
       AND h.timestamp > NOW() - INTERVAL '${parseInt(days as string)} days'
       GROUP BY period
       ORDER BY period ASC`,
      params
    );

    res.json({
      success: true,
      data: {
        interval,
        days: parseInt(days as string),
        dataPoints: result.rows.map(row => ({
          timestamp: row.period,
          avgHealth: parseFloat(row.avg_health) || 0,
          avgElectrical: parseFloat(row.avg_electrical) || 0,
          avgThermal: parseFloat(row.avg_thermal) || 0,
          avgInsulation: parseFloat(row.avg_insulation) || 0,
          avgMechanical: parseFloat(row.avg_mechanical) || 0,
          assetCount: parseInt(row.asset_count)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Asset failure risk analysis
analyticsRoutes.get('/failure-risk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.query;

    let whereConditions = ['organization_id = $1'];
    const params: unknown[] = [req.user!.organizationId];

    if (siteId) {
      whereConditions.push('site_id = $2');
      params.push(siteId);
    }

    const result = await query(
      `SELECT 
        id,
        name,
        asset_tag,
        asset_type,
        vendor,
        health_score,
        health_trend,
        remaining_useful_life,
        CASE 
          WHEN health_score < 20 THEN 'critical'
          WHEN health_score < 40 THEN 'high'
          WHEN health_score < 60 AND health_trend = 'degrading' THEN 'medium'
          ELSE 'low'
        END as risk_level,
        electrical_health,
        thermal_health,
        insulation_health,
        mechanical_health
       FROM assets
       WHERE ${whereConditions.join(' AND ')}
       AND (health_score < 60 OR health_trend = 'degrading')
       ORDER BY health_score ASC
       LIMIT 50`,
      params
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        assetTag: row.asset_tag,
        assetType: row.asset_type,
        vendor: row.vendor,
        healthScore: row.health_score,
        healthTrend: row.health_trend,
        remainingUsefulLife: row.remaining_useful_life,
        riskLevel: row.risk_level,
        healthBreakdown: {
          electrical: row.electrical_health,
          thermal: row.thermal_health,
          insulation: row.insulation_health,
          mechanical: row.mechanical_health
        }
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Cross-vendor correlation analysis
analyticsRoutes.get('/cross-vendor-correlation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.query;

    // This would be a more complex analysis in production
    // Here we provide a simplified version showing correlations between adjacent assets

    const result = await query(
      `SELECT 
        a1.id as source_id,
        a1.name as source_name,
        a1.vendor as source_vendor,
        a1.health_score as source_health,
        a2.id as target_id,
        a2.name as target_name,
        a2.vendor as target_vendor,
        a2.health_score as target_health,
        c.relationship
       FROM asset_connections c
       JOIN assets a1 ON c.source_asset_id = a1.id
       JOIN assets a2 ON c.target_asset_id = a2.id
       WHERE a1.organization_id = $1
       AND a1.vendor != a2.vendor
       AND (a1.health_score < 70 OR a2.health_score < 70)
       ORDER BY LEAST(a1.health_score, a2.health_score) ASC
       LIMIT 20`,
      [req.user!.organizationId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        source: {
          id: row.source_id,
          name: row.source_name,
          vendor: row.source_vendor,
          healthScore: row.source_health
        },
        target: {
          id: row.target_id,
          name: row.target_name,
          vendor: row.target_vendor,
          healthScore: row.target_health
        },
        relationship: row.relationship,
        correlationAlert: row.source_health < 60 || row.target_health < 60
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Maintenance effectiveness report
analyticsRoutes.get('/maintenance-effectiveness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { months = '6' } = req.query;

    const result = await query(
      `SELECT 
        task_type,
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        AVG(actual_duration_hours) FILTER (WHERE status = 'completed') as avg_duration,
        AVG(EXTRACT(EPOCH FROM (completed_date - scheduled_date))/3600) FILTER (WHERE status = 'completed') as avg_delay_hours
       FROM maintenance_tasks
       WHERE organization_id = $1
       AND created_at > NOW() - INTERVAL '${parseInt(months as string)} months'
       GROUP BY task_type`,
      [req.user!.organizationId]
    );

    res.json({
      success: true,
      data: {
        period: `${months} months`,
        byTaskType: result.rows.map(row => ({
          taskType: row.task_type,
          totalTasks: parseInt(row.total_tasks),
          completed: parseInt(row.completed),
          completionRate: parseInt(row.total_tasks) > 0 
            ? (parseInt(row.completed) / parseInt(row.total_tasks) * 100).toFixed(1) 
            : 0,
          avgDurationHours: parseFloat(row.avg_duration) || null,
          avgDelayHours: parseFloat(row.avg_delay_hours) || null
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Asset lifecycle analysis
analyticsRoutes.get('/lifecycle-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT 
        asset_type,
        vendor,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (NOW() - installation_date))/86400/365) as avg_age_years,
        AVG(health_score) as avg_health,
        AVG(remaining_useful_life) as avg_rul_days,
        COUNT(*) FILTER (WHERE warranty_expiry < NOW()) as out_of_warranty,
        COUNT(*) FILTER (WHERE warranty_expiry BETWEEN NOW() AND NOW() + INTERVAL '90 days') as warranty_expiring_soon
       FROM assets
       WHERE organization_id = $1
       AND installation_date IS NOT NULL
       GROUP BY asset_type, vendor
       ORDER BY asset_type, vendor`,
      [req.user!.organizationId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        assetType: row.asset_type,
        vendor: row.vendor,
        count: parseInt(row.count),
        avgAgeYears: parseFloat(row.avg_age_years)?.toFixed(1) || null,
        avgHealth: parseFloat(row.avg_health)?.toFixed(1) || null,
        avgRulDays: parseInt(row.avg_rul_days) || null,
        outOfWarranty: parseInt(row.out_of_warranty),
        warrantyExpiringSoon: parseInt(row.warranty_expiring_soon)
      }))
    });
  } catch (error) {
    next(error);
  }
});
