import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';

// Get port from environment
const PORT = parseInt(process.env.PORT || '4000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🚀 Starting CANUnited Backend...');
console.log(`📌 PORT: ${PORT}`);
console.log(`📌 NODE_ENV: ${NODE_ENV}`);

const app = express();
const server = createServer(app);

// Health check endpoint - FIRST, before anything else
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'canunited-backend',
    port: PORT
  });
});

// Basic middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CANUnited Asset Manager API',
    version: '1.0.0',
    health: '/health'
  });
});

// API placeholder
app.get('/api/v1/status', (req, res) => {
  res.json({ status: 'ok', mode: 'demo' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🏭 CANUnited Asset Manager Backend                      ║
║   Server running on http://0.0.0.0:${PORT}                       ║
║   Environment: ${NODE_ENV}                                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
