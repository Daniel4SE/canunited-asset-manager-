import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notFound, badRequest } from '../middleware/errorHandler.js';
import { UserRole, HealthStatus } from '../types/index.js';

export const siteRoutes = Router();

siteRoutes.use(authenticate);

const createSiteSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string().optional(),
    country: z.string(),
    postalCode: z.string()
  }),
  timezone: z.string().default('UTC'),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional()
});

// Get all sites
siteRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT s.*,
              COUNT(DISTINCT a.id) as asset_count,
              AVG(a.health_score) as avg_health_score,
              COUNT(DISTINCT CASE WHEN a.health_status = 'critical' THEN a.id END) as critical_count
       FROM sites s
       LEFT JOIN assets a ON s.id = a.site_id
       WHERE s.organization_id = $1
       GROUP BY s.id
       ORDER BY s.name`,
      [req.user!.organizationId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        address: row.address,
        timezone: row.timezone,
        coordinates: row.coordinates,
        assetCount: parseInt(row.asset_count) || 0,
        healthSummary: {
          avgHealthScore: parseFloat(row.avg_health_score) || 100,
          criticalAssets: parseInt(row.critical_count) || 0
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get single site with full health summary
siteRoutes.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const siteResult = await query(
      'SELECT * FROM sites WHERE id = $1 AND organization_id = $2',
      [id, req.user!.organizationId]
    );

    if (siteResult.rows.length === 0) {
      notFound('Site');
    }

    // Get health summary
    const healthResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN health_status = 'excellent' THEN 1 END) as excellent,
        COUNT(CASE WHEN health_status = 'good' THEN 1 END) as good,
        COUNT(CASE WHEN health_status = 'fair' THEN 1 END) as fair,
        COUNT(CASE WHEN health_status = 'poor' THEN 1 END) as poor,
        COUNT(CASE WHEN health_status = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN health_trend = 'degrading' THEN 1 END) as trending_down,
        AVG(health_score) as avg_score
       FROM assets
       WHERE site_id = $1`,
      [id]
    );

    // Get vendor breakdown
    const vendorResult = await query(
      `SELECT vendor, COUNT(*) as count, AVG(health_score) as avg_health
       FROM assets WHERE site_id = $1
       GROUP BY vendor`,
      [id]
    );

    // Get asset type breakdown
    const typeResult = await query(
      `SELECT asset_type, COUNT(*) as count, AVG(health_score) as avg_health
       FROM assets WHERE site_id = $1
       GROUP BY asset_type`,
      [id]
    );

    const site = siteResult.rows[0];
    const health = healthResult.rows[0];

    res.json({
      success: true,
      data: {
        id: site.id,
        name: site.name,
        code: site.code,
        address: site.address,
        timezone: site.timezone,
        coordinates: site.coordinates,
        healthSummary: {
          totalAssets: parseInt(health.total) || 0,
          avgHealthScore: parseFloat(health.avg_score) || 100,
          byStatus: {
            excellent: parseInt(health.excellent) || 0,
            good: parseInt(health.good) || 0,
            fair: parseInt(health.fair) || 0,
            poor: parseInt(health.poor) || 0,
            critical: parseInt(health.critical) || 0
          },
          trendingDown: parseInt(health.trending_down) || 0,
          byVendor: vendorResult.rows.reduce((acc, row) => {
            acc[row.vendor] = { count: parseInt(row.count), avgHealth: parseFloat(row.avg_health) };
            return acc;
          }, {} as Record<string, { count: number; avgHealth: number }>),
          byType: typeResult.rows.reduce((acc, row) => {
            acc[row.asset_type] = { count: parseInt(row.count), avgHealth: parseFloat(row.avg_health) };
            return acc;
          }, {} as Record<string, { count: number; avgHealth: number }>)
        },
        createdAt: site.created_at,
        updatedAt: site.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create site
siteRoutes.post('/', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSiteSchema.parse(req.body);
    
    // Check if code is unique within organization
    const existing = await query(
      'SELECT id FROM sites WHERE code = $1 AND organization_id = $2',
      [data.code.toUpperCase(), req.user!.organizationId]
    );
    
    if (existing.rows.length > 0) {
      badRequest('Site code already exists');
    }

    const id = uuidv4();
    const result = await query(
      `INSERT INTO sites (id, organization_id, name, code, address, timezone, coordinates)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        req.user!.organizationId,
        data.name,
        data.code.toUpperCase(),
        JSON.stringify(data.address),
        data.timezone,
        data.coordinates ? JSON.stringify(data.coordinates) : null
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        code: result.rows[0].code,
        address: result.rows[0].address,
        timezone: result.rows[0].timezone,
        coordinates: result.rows[0].coordinates,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update site
siteRoutes.patch('/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, address, timezone, coordinates } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (address) {
      updates.push(`address = $${paramIndex++}`);
      params.push(JSON.stringify(address));
    }
    if (timezone) {
      updates.push(`timezone = $${paramIndex++}`);
      params.push(timezone);
    }
    if (coordinates) {
      updates.push(`coordinates = $${paramIndex++}`);
      params.push(JSON.stringify(coordinates));
    }

    if (updates.length === 0) {
      badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');
    params.push(id, req.user!.organizationId);

    const result = await query(
      `UPDATE sites SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      notFound('Site');
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete site
siteRoutes.delete('/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if site has assets
    const assetCheck = await query(
      'SELECT COUNT(*) FROM assets WHERE site_id = $1',
      [id]
    );
    
    if (parseInt(assetCheck.rows[0].count) > 0) {
      badRequest('Cannot delete site with existing assets');
    }

    const result = await query(
      'DELETE FROM sites WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Site');
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});
