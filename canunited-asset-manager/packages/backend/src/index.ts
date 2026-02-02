import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config/index.js';
import { setupRoutes } from './routes/index.js';
import { setupWebSocket } from './websocket/index.js';
import { connectDatabase } from './db/connection.js';
import { connectRedis } from './cache/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

async function bootstrap() {
  const app = express();
  const server = createServer(app);

  // Security & Compression
  app.use(helmet());
  app.use(compression());

  // CORS
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(morgan('combined'));
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'canunited-backend'
    });
  });

  // Connect to databases
  try {
    await connectDatabase();
    console.log('✅ Connected to PostgreSQL');
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error);
  }

  try {
    await connectRedis();
    console.log('✅ Connected to Redis');
  } catch (error) {
    console.error('⚠️ Redis connection failed, continuing without cache:', error);
  }

  // Setup API routes
  setupRoutes(app);

  // Setup WebSocket
  const wss = new WebSocketServer({ server, path: '/ws' });
  setupWebSocket(wss);

  // Error handling
  app.use(errorHandler);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
      }
    });
  });

  // Start server
  server.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏭 CANUnited Asset Manager Backend                      ║
║                                                           ║
║   Server running on http://localhost:${config.port}              ║
║   WebSocket on ws://localhost:${config.port}/ws                  ║
║   Environment: ${config.nodeEnv.padEnd(40)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

bootstrap().catch(console.error);
