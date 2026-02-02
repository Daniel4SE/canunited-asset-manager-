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
    version: '1.0.0',
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
    version: '1.0.0',
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
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('⚠️ Migration error (may be ignored):', error);
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
