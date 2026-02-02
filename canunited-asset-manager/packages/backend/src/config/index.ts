import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://canunited:canunited_secret@localhost:5432/canunited_asset_manager',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // InfluxDB
  influx: {
    url: process.env.INFLUX_URL || 'http://localhost:8086',
    token: process.env.INFLUX_TOKEN || 'canunited-super-secret-auth-token',
    org: process.env.INFLUX_ORG || 'canunited',
    bucket: process.env.INFLUX_BUCKET || 'asset_metrics',
  },

  // MQTT
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    clientId: process.env.MQTT_CLIENT_ID || 'canunited-backend',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'canunited-jwt-secret-change-in-production-2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // MFA
  mfa: {
    issuer: process.env.MFA_ISSUER || 'CANUnited Asset Manager',
    tokenWindow: 1, // Allow 1 step before/after for clock drift
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // Session
  session: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
  },
};
