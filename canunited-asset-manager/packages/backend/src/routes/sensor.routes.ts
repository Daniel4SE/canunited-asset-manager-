import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notFound, badRequest } from '../middleware/errorHandler.js';
import { UserRole, SensorType, VendorType, ProtocolType } from '../types/index.js';

export const sensorRoutes = Router();

sensorRoutes.use(authenticate);

const createSensorSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1),
  sensorType: z.nativeEnum(SensorType),
  vendor: z.nativeEnum(VendorType),
  model: z.string().min(1),
  serialNumber: z.string().optional(),
  protocol: z.nativeEnum(ProtocolType),
  gatewayId: z.string().uuid().optional(),
  assignedAssetId: z.string().uuid().optional()
});

// Get all sensors
sensorRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId, sensorType, vendor, isOnline } = req.query;

    // Use tenant_id as fallback for organization_id
    let whereConditions = ['(s.organization_id = $1 OR s.tenant_id = $1)'];
    const params: unknown[] = [req.user!.organizationId];
    let paramIndex = 2;

    if (siteId) {
      whereConditions.push(`s.site_id = $${paramIndex++}`);
      params.push(siteId);
    }
    if (sensorType) {
      whereConditions.push(`s.sensor_type = $${paramIndex++}`);
      params.push(sensorType);
    }
    if (vendor) {
      whereConditions.push(`s.vendor = $${paramIndex++}`);
      params.push(vendor);
    }
    if (isOnline !== undefined) {
      whereConditions.push(`s.is_online = $${paramIndex++}`);
      params.push(isOnline === 'true');
    }

    const result = await query(
      `SELECT s.id, s.site_id, s.name, s.sensor_type, s.vendor, s.model,
              s.serial_number, s.protocol, s.gateway_id, s.is_online,
              s.battery_level, s.signal_strength, s.last_reading_at, s.created_at,
              s.asset_id, a.name as assigned_asset_name
       FROM sensors s
       LEFT JOIN assets a ON s.asset_id = a.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY s.name`,
      params
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        siteId: row.site_id,
        name: row.name,
        sensorType: row.sensor_type,
        vendor: row.vendor,
        model: row.model,
        serialNumber: row.serial_number,
        protocol: row.protocol,
        gatewayId: row.gateway_id,
        gatewayName: row.gateway_name,
        assignedAssetId: row.asset_id,
        assignedAssetName: row.assigned_asset_name,
        calibrationDate: row.calibration_date,
        batteryLevel: row.battery_level,
        signalStrength: row.signal_strength,
        isOnline: row.is_online,
        lastReadingAt: row.last_reading_at,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get sensor readings
sensorRoutes.get('/:id/readings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { hours = '24', limit = '1000' } = req.query;

    const result = await query(
      `SELECT timestamp, values, unit, quality
       FROM sensor_readings
       WHERE sensor_id = $1
       AND timestamp > NOW() - INTERVAL '${parseInt(hours as string)} hours'
       ORDER BY timestamp DESC
       LIMIT $2`,
      [id, parseInt(limit as string)]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        timestamp: row.timestamp,
        values: row.values,
        unit: row.unit,
        quality: row.quality
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Create sensor
sensorRoutes.post('/', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSensorSchema.parse(req.body);
    const id = uuidv4();

    const result = await query(
      `INSERT INTO sensors (
        id, site_id, organization_id, name, sensor_type, vendor, model,
        serial_number, protocol, gateway_id, assigned_asset_id, is_online
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
      RETURNING *`,
      [
        id,
        data.siteId,
        req.user!.organizationId,
        data.name,
        data.sensorType,
        data.vendor,
        data.model,
        data.serialNumber || null,
        data.protocol,
        data.gatewayId || null,
        data.assignedAssetId || null
      ]
    );

    // Create sensor assignment if asset provided
    if (data.assignedAssetId) {
      await query(
        `INSERT INTO sensor_assignments (sensor_id, asset_id, sensor_type, mounting_location)
         VALUES ($1, $2, $3, 'default')
         ON CONFLICT (sensor_id, asset_id) DO NOTHING`,
        [id, data.assignedAssetId, data.sensorType]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Assign sensor to asset
sensorRoutes.post('/:id/assign', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.FIELD_TECHNICIAN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assetId, mountingLocation } = req.body;

    if (!assetId) {
      badRequest('Asset ID is required');
    }

    // Get sensor info
    const sensorResult = await query(
      'SELECT sensor_type FROM sensors WHERE id = $1 AND organization_id = $2',
      [id, req.user!.organizationId]
    );

    if (sensorResult.rows.length === 0) {
      notFound('Sensor');
    }

    // Update sensor
    await query(
      'UPDATE sensors SET assigned_asset_id = $1 WHERE id = $2',
      [assetId, id]
    );

    // Create assignment
    await query(
      `INSERT INTO sensor_assignments (sensor_id, asset_id, sensor_type, mounting_location)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (sensor_id, asset_id) DO UPDATE SET mounting_location = $4`,
      [id, assetId, sensorResult.rows[0].sensor_type, mountingLocation || 'default']
    );

    res.json({ success: true, data: { sensorId: id, assetId, mountingLocation } });
  } catch (error) {
    next(error);
  }
});

// Unassign sensor from asset
sensorRoutes.post('/:id/unassign', authorize(UserRole.ADMIN, UserRole.ASSET_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE sensors SET assigned_asset_id = NULL WHERE id = $1 AND organization_id = $2',
      [id, req.user!.organizationId]
    );

    await query('DELETE FROM sensor_assignments WHERE sensor_id = $1', [id]);

    res.json({ success: true, data: { sensorId: id } });
  } catch (error) {
    next(error);
  }
});

// Delete sensor
sensorRoutes.delete('/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM sensors WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user!.organizationId]
    );

    if (result.rows.length === 0) {
      notFound('Sensor');
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});
