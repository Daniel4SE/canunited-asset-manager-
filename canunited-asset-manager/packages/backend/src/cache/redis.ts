import { createClient, RedisClientType } from 'redis';
import { config } from '../config/index.js';

export let redisClient: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  redisClient = createClient({
    url: config.redis.url,
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

// Cache helpers with fallback when Redis is unavailable
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!redisClient) return;
  
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redisClient) return;
  
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  if (!redisClient) return;
  
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Cache invalidate pattern error:', error);
  }
}
