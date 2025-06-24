import { createClient, RedisClientType } from 'redis';

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private redisClient: RedisClientType;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.redisClient = createClient({
      url: process.env.REDIS_URL
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    this.redisClient.connect().catch((err) => {
      console.error('Failed to connect to Redis:', err);
    });
  }

  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const multi = this.redisClient.multi();
    multi.zRemRangeByScore(key, '-inf', windowStart.toString());
    multi.zAdd(key, [{ score: now, value: `${now}-${Math.random()}` }]);
    multi.zCard(key);
    multi.expire(key, Math.ceil(this.windowMs / 1000));

    const results = await multi.exec();
    if (!results || results.length < 3) {
      throw new Error('Redis rate limiter error');
    }
    const requestCount = typeof results[2] === 'number' ? results[2] : parseInt(results[2] as string, 10);

    if (requestCount > this.maxRequests) {
      throw new Error('Rate limit exceeded');
    }

    return true;
  }

  async disconnect() {
    await this.redisClient.disconnect();
  }
}