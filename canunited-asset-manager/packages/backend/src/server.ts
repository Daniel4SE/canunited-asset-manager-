import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/index.js';
import { connectDatabase, pool } from './db/connection.js';
import { setupRoutes } from './routes/index.js';
import { connectRedis, redisClient } from './cache/redis.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// Check for database availability
const hasDatabase = !!process.env.DATABASE_URL;
const hasRedis = !!process.env.REDIS_URL;

console.log('🚀 Starting CANUnited Backend...');
console.log(`📌 PORT: ${config.port}`);
console.log(`📌 NODE_ENV: ${config.nodeEnv}`);
console.log(`📌 DATABASE: ${hasDatabase ? '✓ PostgreSQL' : '✗ Demo mode (in-memory)'}`);
console.log(`📌 REDIS: ${hasRedis ? '✓ Connected' : '✗ Not configured'}`);

// Health check - always available
app.get('/health', async (req, res) => {
  let dbStatus = 'not configured';
  if (hasDatabase) {
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.4-schema-sync',
    service: 'canunited-backend',
    mode: hasDatabase ? 'production' : 'demo',
    database: dbStatus,
    redis: hasRedis ? 'configured' : 'not configured',
  });
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));
app.use(compression());
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CANUnited Asset Manager API',
    version: '1.0.4-schema-sync',
    mode: hasDatabase ? 'production' : 'demo',
    documentation: '/api/v1',
  });
});

// Setup routes
setupRoutes(app);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// Error handler
app.use(errorHandler);

// WebSocket setup
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await pool.end();
  if (redisClient) await redisClient.quit();
  server.close(() => process.exit(0));
});

// Initialize database schema if needed
async function initDatabase() {
  try {
    // Check if tables exist
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('📦 Initializing database schema...');
      const sqlPath = join(__dirname, '../sql/init.sql');
      const sql = readFileSync(sqlPath, 'utf8');
      await pool.query(sql);
      console.log('✅ Database schema initialized with seed data');
    } else {
      console.log('✅ Database schema already exists');

      // Run migrations for missing columns
      await runMigrations();
    }
  } catch (error) {
    console.error('⚠️ Database initialization failed:', error);
    throw error;
  }
}

// Run any pending migrations
async function runMigrations() {
  try {
    // Add details column to audit_logs if missing
    await pool.query(`
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
    `);
    // Make tenant_id nullable in audit_logs
    await pool.query(`
      ALTER TABLE audit_logs ALTER COLUMN tenant_id DROP NOT NULL;
    `);

    // Add organization_id to sensors if missing (copy from tenant_id)
    await pool.query(`
      ALTER TABLE sensors ADD COLUMN IF NOT EXISTS organization_id UUID;
      UPDATE sensors SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);

    // Add organization_id to maintenance_tasks if missing
    await pool.query(`
      ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS organization_id UUID;
      UPDATE maintenance_tasks SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);

    // Add notes and actual_duration_hours to maintenance_tasks if missing
    await pool.query(`
      ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS actual_duration_hours DECIMAL(5, 2);
    `);

    // Add missing columns to alerts table for mock data compatibility
    await pool.query(`
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'system';
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'system';
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS organization_id UUID;
      UPDATE alerts SET triggered_at = created_at WHERE triggered_at IS NULL;
      UPDATE alerts SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);

    // Add organization_id to sites if missing
    await pool.query(`
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS organization_id UUID;
      UPDATE sites SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);

    // Add organization_id and asset_type to assets if missing
    await pool.query(`
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id UUID;
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50);
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS health_score INTEGER;
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS health_status VARCHAR(20);
      UPDATE assets SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);

    // Update assets health_score and health_status from asset_health table
    await pool.query(`
      UPDATE assets a SET
        health_score = ah.overall_score,
        health_status = CASE
          WHEN ah.overall_score >= 85 THEN 'excellent'
          WHEN ah.overall_score >= 70 THEN 'good'
          WHEN ah.overall_score >= 50 THEN 'fair'
          WHEN ah.overall_score >= 30 THEN 'poor'
          ELSE 'critical'
        END
      FROM asset_health ah
      WHERE ah.asset_id = a.id
      AND (a.health_score IS NULL OR a.health_status IS NULL);
    `);

    // Create asset connections for topology if table is empty
    await createAssetConnections();

    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('⚠️ Migration error (may be ignored):', error);
  }
}

// Create logical asset connections for topology visualization
async function createAssetConnections() {
  try {
    // Check if we already have connections
    const existing = await pool.query('SELECT COUNT(*) FROM asset_connections');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`📊 Asset connections already exist (${existing.rows[0].count})`);
      return;
    }

    console.log('🔗 Creating asset connections for topology...');

    // Get all sites
    const sitesResult = await pool.query('SELECT id FROM sites');

    for (const site of sitesResult.rows) {
      // Get assets for this site, ordered by type for logical connections
      const assetsResult = await pool.query(`
        SELECT id, name, asset_type
        FROM assets
        WHERE site_id = $1
        ORDER BY
          CASE asset_type
            WHEN 'transformer' THEN 1
            WHEN 'mv_switchgear' THEN 2
            WHEN 'circuit_breaker' THEN 3
            WHEN 'relay' THEN 4
            WHEN 'vfd' THEN 5
            WHEN 'motor' THEN 6
            WHEN 'battery_system' THEN 7
            ELSE 8
          END,
          name
      `, [site.id]);

      const assets = assetsResult.rows;
      if (assets.length < 2) continue;

      // Group assets by type
      const byType: Record<string, any[]> = {};
      for (const asset of assets) {
        if (!byType[asset.asset_type]) byType[asset.asset_type] = [];
        byType[asset.asset_type].push(asset);
      }

      const connections: Array<{source: string, target: string, rel: string, type: string, critical: boolean}> = [];

      const transformers = byType['transformer'] || [];
      const switchgears = byType['mv_switchgear'] || [];
      const breakers = byType['circuit_breaker'] || [];
      const vfds = byType['vfd'] || [];
      const motors = byType['motor'] || [];
      const batteries = byType['battery_system'] || [];

      // Transformer -> Switchgear
      for (let i = 0; i < transformers.length && i < switchgears.length; i++) {
        connections.push({ source: transformers[i].id, target: switchgears[i].id, rel: 'feeds', type: 'electrical', critical: true });
      }

      // Switchgear -> Breakers
      let breakerIdx = 0;
      for (const sg of switchgears) {
        for (let i = 0; i < 3 && breakerIdx < breakers.length; i++, breakerIdx++) {
          connections.push({ source: sg.id, target: breakers[breakerIdx].id, rel: 'feeds', type: 'electrical', critical: i === 0 });
        }
      }

      // Breakers -> VFDs/Motors
      let vfdIdx = 0, motorIdx = 0;
      for (const breaker of breakers) {
        if (vfdIdx < vfds.length) {
          connections.push({ source: breaker.id, target: vfds[vfdIdx++].id, rel: 'feeds', type: 'electrical', critical: false });
        }
        if (motorIdx < motors.length) {
          connections.push({ source: breaker.id, target: motors[motorIdx++].id, rel: 'feeds', type: 'electrical', critical: false });
        }
      }

      // VFDs -> Motors
      for (let i = 0; i < vfds.length && i < motors.length; i++) {
        connections.push({ source: vfds[i].id, target: motors[i].id, rel: 'controls', type: 'electrical', critical: false });
      }

      // Batteries -> Switchgears (backup)
      for (let i = 0; i < batteries.length && i < switchgears.length; i++) {
        connections.push({ source: batteries[i].id, target: switchgears[i].id, rel: 'backup', type: 'electrical', critical: true });
      }

      // Fallback: chain assets if no type-based connections
      if (connections.length === 0) {
        for (let i = 0; i < assets.length - 1; i++) {
          connections.push({ source: assets[i].id, target: assets[i + 1].id, rel: 'connected', type: 'electrical', critical: i === 0 });
        }
      }

      // Insert connections
      for (const conn of connections) {
        await pool.query(`
          INSERT INTO asset_connections (id, source_asset_id, target_asset_id, relationship, connection_type, is_critical_path)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
          ON CONFLICT (source_asset_id, target_asset_id) DO NOTHING
        `, [conn.source, conn.target, conn.rel, conn.type, conn.critical]);
      }
    }

    const total = await pool.query('SELECT COUNT(*) FROM asset_connections');
    console.log(`✅ Created ${total.rows[0].count} asset connections`);
  } catch (error) {
    console.error('⚠️ Error creating asset connections:', error);
  }
}

// Start server
async function start() {
  let dbConnected = false;
  let redisConnected = false;

  // Try to connect to database (don't fail if it doesn't work)
  if (hasDatabase) {
    try {
      await connectDatabase();
      dbConnected = true;
      console.log('✅ Database connected');

      // Initialize schema if needed
      await initDatabase();
    } catch (error) {
      console.error('⚠️ Database connection failed:', error);
      console.log('⚠️ Server will start without database (health check will still work)');
    }
  }

  // Try to connect to Redis (don't fail if it doesn't work)
  if (hasRedis) {
    try {
      await connectRedis();
      redisConnected = true;
      console.log('✅ Redis connected');
    } catch (error) {
      console.error('⚠️ Redis connection failed:', error);
    }
  }

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🏭 CANUnited Asset Manager Backend                      ║
║   Server running on http://0.0.0.0:${config.port}                   ║
║   Environment: ${config.nodeEnv.padEnd(40)}║
║   Database: ${dbConnected ? 'Connected ✓' : 'Not connected ✗'}                              ║
║   Redis: ${redisConnected ? 'Connected ✓' : 'Not connected ✗'}                                 ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

start();
