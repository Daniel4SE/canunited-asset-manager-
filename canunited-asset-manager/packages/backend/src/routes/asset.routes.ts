import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notFound, badRequest } from '../middleware/errorHandler.js';
import { cacheGet, cacheSet, cacheDelete } from '../cache/redis.js';
import { 
  AssetType, 
  VendorType, 
  HealthStatus, 
  UserRole,
  getHealthStatus,
  generateAssetTag
} from '@canunited/shared';

export const assetRoutes = Router();

// Apply authentication to all routes
assetRoutes.use(authenticate);

// Validation schemas
const createAssetSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1),
  assetType: z.nativeEnum(AssetType),
  vendor: z.nativeEnum(VendorType),
  vendorModel: z.string().min(1),
  serialNumber: z.string().optional(),
  installationDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  location: z.object({
    building: z.string().optional(),
    floor: z.string().optional(),
    room: z.string().optional(),
    panel: z.string().optional(),
    position: z.string().optional()
  }).optional(),
  specifications: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

const updateAssetSchema = createAssetSchema.partial();

// Get all assets with filtering
assetRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      siteId, 
      assetType, 
      vendor, 
      healthStatus,
      search,
      page = '1', 
      perPage = '20',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(perPage as string);
    const limit = parseInt(perPage as string);
    
    let whereConditions = ['a.organization_id = $1'];
    const params: unknown[] = [req.user!.organizationId];
    let paramIndex = 2;

    if (siteId) {
      whereConditions.push(`a.site_id = $${paramIndex++}`);
      params.push(siteId);
    }

    if (assetType) {
      whereConditions.push(`a.asset_type = $${paramIndex++}`);
      params.push(assetType);
    }

    if (vendor) {
      whereConditions.push(`a.vendor = $${paramIndex++}`);
      params.push(vendor);
    }

    if (healthStatus) {
      whereConditions.push(`a.health_status = $${paramIndex++}`);
      params.push(healthStatus);
    }

    if (search) {
      whereConditions.push(`(a.name ILIKE $${paramIndex} OR a.asset_tag ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');
    const validSortColumns = ['name', 'asset_type', 'vendor', 'health_score', 'created_at'];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'name';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Count total
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM assets a WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get assets
    const result = await query(
      `SELECT a.*, s.name as site_name
       FROM assets a
       LEFT JOIN sites s ON a.site_id = s.id
       WHERE ${whereClause}
       ORDER BY a.${sortColumn} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows.map(row => formatAssetResponse(row)),
      meta: {
        page: parseInt(page as string),
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single asset
assetRoutes.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Try cache first
    const cacheKey = `asset:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const result = await query(
      `SELECT a.*, s.name as site_name,
              json_agg(DISTINCT c.*) FILTER (WHERE c.id IS NOT NULL) as connections,
              json_agg(DISTINCT sa.*) FILTER (WHERE sa.sensor_id IS NOT NULL) as sensors
       FROM assets a
       LEFT JOIN sites s ON a.site_id = s.id
       LEFT JOIN asset_connections c ON a.id = c.source_asset_id
       LEFT JOIN sensor_assignments sa ON a.id = sa.asset_id
       WHERE a.id = $1 AND a.organization_id = $2
       GROUP BY a.id, s.name`,
      [id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Asset');
    }

    const asset = formatAssetResponse(result.rows[0]);
    await cacheSet(cacheKey, asset, 60);
    
    res.json({ success: true, data: asset });
  } catch (error) {
    next(error);
  }
});

// Create asset
assetRoutes.post('/', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createAssetSchema.parse(req.body);
    const id = uuidv4();
    
    // Get site code for asset tag
    const siteResult = await query<{ code: string }>(
      'SELECT code FROM sites WHERE id = $1',
      [data.siteId]
    );
    
    if (siteResult.rows.length === 0) {
      badRequest('Site not found');
    }

    // Get next sequence number
    const seqResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM assets WHERE site_id = $1 AND asset_type = $2`,
      [data.siteId, data.assetType]
    );
    const sequence = parseInt(seqResult.rows[0].count) + 1;
    
    const assetTag = generateAssetTag(siteResult.rows[0].code, data.assetType, sequence);
    
    // Generate QR code
    const qrCodeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assets/${id}`;
    const qrCode = await QRCode.toDataURL(qrCodeUrl);

    const result = await query(
      `INSERT INTO assets (
        id, site_id, organization_id, name, asset_tag, qr_code, asset_type, vendor, vendor_model,
        serial_number, installation_date, warranty_expiry, location, specifications, metadata,
        health_score, health_status, electrical_health, thermal_health, insulation_health, mechanical_health
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 100, 'excellent', 100, 100, 100, 100)
      RETURNING *`,
      [
        id,
        data.siteId,
        req.user!.organizationId,
        data.name,
        assetTag,
        qrCode,
        data.assetType,
        data.vendor,
        data.vendorModel,
        data.serialNumber || null,
        data.installationDate || null,
        data.warrantyExpiry || null,
        JSON.stringify(data.location || {}),
        JSON.stringify(data.specifications || {}),
        JSON.stringify(data.metadata || {})
      ]
    );

    res.status(201).json({ success: true, data: formatAssetResponse(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Update asset
assetRoutes.patch('/:id', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = updateAssetSchema.parse(req.body);
    
    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.vendorModel !== undefined) {
      updates.push(`vendor_model = $${paramIndex++}`);
      params.push(data.vendorModel);
    }
    if (data.serialNumber !== undefined) {
      updates.push(`serial_number = $${paramIndex++}`);
      params.push(data.serialNumber);
    }
    if (data.location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      params.push(JSON.stringify(data.location));
    }
    if (data.specifications !== undefined) {
      updates.push(`specifications = $${paramIndex++}`);
      params.push(JSON.stringify(data.specifications));
    }
    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) {
      badRequest('No fields to update');
    }

    updates.push('updated_at = NOW()');
    params.push(id, req.user!.organizationId);

    const result = await query(
      `UPDATE assets SET ${updates.join(', ')} 
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      notFound('Asset');
    }

    // Invalidate cache
    await cacheDelete(`asset:${id}`);

    res.json({ success: true, data: formatAssetResponse(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Delete asset
assetRoutes.delete('/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM assets WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Asset');
    }

    await cacheDelete(`asset:${id}`);

    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});

// Get asset QR code
assetRoutes.get('/:id/qrcode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { format = 'base64' } = req.query;

    const result = await query<{ qr_code: string; asset_tag: string }>(
      'SELECT qr_code, asset_tag FROM assets WHERE id = $1 AND organization_id = $2',
      [id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Asset');
    }

    if (format === 'svg') {
      const qrCodeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assets/${id}`;
      const svg = await QRCode.toString(qrCodeUrl, { type: 'svg' });
      res.type('image/svg+xml').send(svg);
    } else {
      res.json({
        success: true,
        data: {
          assetTag: result.rows[0].asset_tag,
          qrCode: result.rows[0].qr_code
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get asset health history
assetRoutes.get('/:id/health-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { days = '30' } = req.query;

    const result = await query(
      `SELECT timestamp, health_score, electrical_health, thermal_health, 
              insulation_health, mechanical_health
       FROM asset_health_history
       WHERE asset_id = $1
       AND timestamp > NOW() - INTERVAL '${parseInt(days as string)} days'
       ORDER BY timestamp ASC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        timestamp: row.timestamp,
        healthScore: row.health_score,
        electricalHealth: row.electrical_health,
        thermalHealth: row.thermal_health,
        insulationHealth: row.insulation_health,
        mechanicalHealth: row.mechanical_health
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to format asset response
function formatAssetResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name,
    organizationId: row.organization_id,
    name: row.name,
    assetTag: row.asset_tag,
    qrCode: row.qr_code,
    assetType: row.asset_type,
    vendor: row.vendor,
    vendorModel: row.vendor_model,
    serialNumber: row.serial_number,
    installationDate: row.installation_date,
    warrantyExpiry: row.warranty_expiry,
    location: row.location,
    specifications: row.specifications,
    health: {
      overallScore: row.health_score,
      status: row.health_status,
      electricalHealth: row.electrical_health,
      thermalHealth: row.thermal_health,
      insulationHealth: row.insulation_health,
      mechanicalHealth: row.mechanical_health,
      lastAssessment: row.last_health_assessment,
      trend: row.health_trend,
      remainingUsefulLife: row.remaining_useful_life,
      nextMaintenance: row.next_maintenance
    },
    connections: row.connections,
    sensors: row.sensors,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
