import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notFound, badRequest } from '../middleware/errorHandler.js';
import { UserRole } from '@canunited/shared';

export const topologyRoutes = Router();

topologyRoutes.use(authenticate);

// Get topology graph for a site
topologyRoutes.get('/site/:siteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.params;
    const { includeOffline = 'true' } = req.query;

    // Verify site access
    const siteCheck = await query(
      'SELECT id FROM sites WHERE id = $1 AND organization_id = $2',
      [siteId, req.user!.organizationId]
    );

    if (siteCheck.rows.length === 0) {
      notFound('Site');
    }

    // Get all assets as nodes
    const nodesResult = await query(
      `SELECT 
        id,
        name,
        asset_tag,
        asset_type,
        vendor,
        health_score,
        health_status,
        location
       FROM assets
       WHERE site_id = $1`,
      [siteId]
    );

    // Get all connections as edges
    const edgesResult = await query(
      `SELECT 
        c.id,
        c.source_asset_id,
        c.target_asset_id,
        c.relationship,
        c.connection_type,
        c.is_critical_path
       FROM asset_connections c
       JOIN assets a ON c.source_asset_id = a.id
       WHERE a.site_id = $1`,
      [siteId]
    );

    const nodes = nodesResult.rows.map(row => ({
      id: row.id,
      assetId: row.id,
      label: row.name,
      assetTag: row.asset_tag,
      type: row.asset_type,
      vendor: row.vendor,
      healthScore: row.health_score,
      status: row.health_status,
      location: row.location
    }));

    const edges = edgesResult.rows.map(row => ({
      id: row.id,
      source: row.source_asset_id,
      target: row.target_asset_id,
      type: row.connection_type,
      relationship: row.relationship,
      isCriticalPath: row.is_critical_path
    }));

    res.json({
      success: true,
      data: {
        siteId,
        nodes,
        edges,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create connection between assets
topologyRoutes.post('/connections', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceAssetId, targetAssetId, relationship, connectionType, isCriticalPath } = req.body;

    if (!sourceAssetId || !targetAssetId) {
      badRequest('Source and target asset IDs are required');
    }

    // Verify both assets exist and belong to same organization
    const assetCheck = await query(
      `SELECT id, site_id FROM assets 
       WHERE id IN ($1, $2) AND organization_id = $3`,
      [sourceAssetId, targetAssetId, req.user!.organizationId]
    );

    if (assetCheck.rows.length !== 2) {
      badRequest('One or both assets not found');
    }

    const id = uuidv4();
    const result = await query(
      `INSERT INTO asset_connections (
        id, source_asset_id, target_asset_id, relationship, connection_type, is_critical_path
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (source_asset_id, target_asset_id) DO UPDATE
      SET relationship = $4, connection_type = $5, is_critical_path = $6
      RETURNING *`,
      [
        id,
        sourceAssetId,
        targetAssetId,
        relationship || 'connected',
        connectionType || 'electrical',
        isCriticalPath || false
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete connection
topologyRoutes.delete('/connections/:id', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM asset_connections c
       USING assets a
       WHERE c.id = $1 
       AND c.source_asset_id = a.id 
       AND a.organization_id = $2
       RETURNING c.id`,
      [id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Connection');
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});

// Get critical path analysis
topologyRoutes.get('/critical-path/:siteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.params;

    const result = await query(
      `WITH critical_assets AS (
        SELECT DISTINCT 
          CASE WHEN c.is_critical_path THEN a1.id END as asset_id
        FROM asset_connections c
        JOIN assets a1 ON c.source_asset_id = a1.id
        WHERE a1.site_id = $1 AND c.is_critical_path = true
        UNION
        SELECT DISTINCT 
          CASE WHEN c.is_critical_path THEN a2.id END as asset_id
        FROM asset_connections c
        JOIN assets a2 ON c.target_asset_id = a2.id
        WHERE a2.site_id = $1 AND c.is_critical_path = true
      )
      SELECT 
        a.id,
        a.name,
        a.asset_tag,
        a.asset_type,
        a.vendor,
        a.health_score,
        a.health_status
      FROM assets a
      JOIN critical_assets ca ON a.id = ca.asset_id
      WHERE ca.asset_id IS NOT NULL
      ORDER BY a.health_score ASC`,
      [siteId]
    );

    res.json({
      success: true,
      data: {
        criticalAssets: result.rows,
        riskLevel: result.rows.some(r => r.health_score < 40) ? 'high' 
                 : result.rows.some(r => r.health_score < 60) ? 'medium' 
                 : 'low'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single-line diagram data (simplified electrical topology)
topologyRoutes.get('/single-line/:siteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.params;

    // Get hierarchical structure based on electrical connections
    const result = await query(
      `WITH RECURSIVE hierarchy AS (
        -- Start with assets that have no upstream connection (root nodes)
        SELECT 
          a.id,
          a.name,
          a.asset_tag,
          a.asset_type,
          a.vendor,
          a.health_score,
          a.specifications,
          0 as level,
          NULL::uuid as parent_id
        FROM assets a
        WHERE a.site_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM asset_connections c 
          WHERE c.target_asset_id = a.id AND c.relationship IN ('feeds', 'upstream')
        )
        
        UNION ALL
        
        -- Recursively add downstream assets
        SELECT 
          a.id,
          a.name,
          a.asset_tag,
          a.asset_type,
          a.vendor,
          a.health_score,
          a.specifications,
          h.level + 1,
          h.id as parent_id
        FROM assets a
        JOIN asset_connections c ON c.target_asset_id = a.id
        JOIN hierarchy h ON c.source_asset_id = h.id
        WHERE c.relationship IN ('feeds', 'downstream')
        AND h.level < 10  -- Prevent infinite recursion
      )
      SELECT * FROM hierarchy ORDER BY level, name`,
      [siteId]
    );

    res.json({
      success: true,
      data: {
        siteId,
        hierarchy: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          assetTag: row.asset_tag,
          assetType: row.asset_type,
          vendor: row.vendor,
          healthScore: row.health_score,
          specifications: row.specifications,
          level: row.level,
          parentId: row.parent_id
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});
