import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notFound, badRequest } from '../middleware/errorHandler.js';
import { UserRole, AlertSeverity, AlertStatus } from '../types/index.js';
import { broadcastToOrganization } from '../websocket/index.js';
import { WSEventType } from '../types/index.js';

export const alertRoutes = Router();

alertRoutes.use(authenticate);

// Get all alerts
alertRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      siteId, 
      assetId, 
      severity, 
      status = 'active',
      page = '1',
      perPage = '50'
    } = req.query;

    let whereConditions = ['a.organization_id = $1'];
    const params: unknown[] = [req.user!.organizationId];
    let paramIndex = 2;

    if (siteId) {
      whereConditions.push(`a.site_id = $${paramIndex++}`);
      params.push(siteId);
    }
    if (assetId) {
      whereConditions.push(`a.asset_id = $${paramIndex++}`);
      params.push(assetId);
    }
    if (severity) {
      whereConditions.push(`a.severity = $${paramIndex++}`);
      params.push(severity);
    }
    if (status) {
      whereConditions.push(`a.status = $${paramIndex++}`);
      params.push(status);
    }

    const offset = (parseInt(page as string) - 1) * parseInt(perPage as string);
    const limit = parseInt(perPage as string);

    // Get count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM alerts a WHERE ${whereConditions.join(' AND ')}`,
      params
    );

    // Get alerts
    const result = await query(
      `SELECT a.*, 
              s.name as site_name,
              ast.name as asset_name,
              ast.asset_tag
       FROM alerts a
       LEFT JOIN sites s ON a.site_id = s.id
       LEFT JOIN assets ast ON a.asset_id = ast.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY 
         CASE a.severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
           ELSE 5 
         END,
         a.triggered_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        siteId: row.site_id,
        siteName: row.site_name,
        assetId: row.asset_id,
        assetName: row.asset_name,
        assetTag: row.asset_tag,
        severity: row.severity,
        status: row.status,
        title: row.title,
        description: row.description,
        category: row.category,
        source: row.source,
        triggeredAt: row.triggered_at,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledged_by,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
        resolutionNotes: row.resolution_notes,
        metadata: row.metadata
      })),
      meta: {
        page: parseInt(page as string),
        perPage: limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get alert counts by severity
alertRoutes.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.query;

    let whereConditions = ['organization_id = $1', "status = 'active'"];
    const params: unknown[] = [req.user!.organizationId];

    if (siteId) {
      whereConditions.push('site_id = $2');
      params.push(siteId);
    }

    const result = await query(
      `SELECT 
        severity,
        COUNT(*) as count
       FROM alerts
       WHERE ${whereConditions.join(' AND ')}
       GROUP BY severity`,
      params
    );

    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0
    };

    result.rows.forEach(row => {
      summary[row.severity as keyof typeof summary] = parseInt(row.count);
      summary.total += parseInt(row.count);
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// Acknowledge alert
alertRoutes.post('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE alerts 
       SET status = 'acknowledged', 
           acknowledged_at = NOW(), 
           acknowledged_by = $1
       WHERE id = $2 AND organization_id = $3 AND status = 'active'
       RETURNING *`,
      [req.user!.userId, id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Alert or already acknowledged');
    }

    // Broadcast update
    broadcastToOrganization(req.user!.organizationId, {
      type: WSEventType.ALERT_UPDATED,
      payload: { alertId: id, status: 'acknowledged' },
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Resolve alert
alertRoutes.post('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;

    const result = await query(
      `UPDATE alerts 
       SET status = 'resolved', 
           resolved_at = NOW(), 
           resolved_by = $1,
           resolution_notes = $2
       WHERE id = $3 AND organization_id = $4 AND status IN ('active', 'acknowledged')
       RETURNING *`,
      [req.user!.userId, resolutionNotes || null, id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Alert or already resolved');
    }

    // Broadcast update
    broadcastToOrganization(req.user!.organizationId, {
      type: WSEventType.ALERT_UPDATED,
      payload: { alertId: id, status: 'resolved' },
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Create alert (internal use / testing)
alertRoutes.post('/', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId, assetId, severity, title, description, category, source } = req.body;
    const id = uuidv4();

    const result = await query(
      `INSERT INTO alerts (
        id, organization_id, site_id, asset_id, severity, status, title, description, category, source
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        req.user!.organizationId,
        siteId,
        assetId || null,
        severity || AlertSeverity.MEDIUM,
        title,
        description,
        category || 'system',
        source || 'manual'
      ]
    );

    // Broadcast new alert
    broadcastToOrganization(req.user!.organizationId, {
      type: WSEventType.ALERT_CREATED,
      payload: result.rows[0],
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
