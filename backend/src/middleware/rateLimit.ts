import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Create rate limiting middleware
   */
  createLimiter = (options: RateLimitOptions) => {
    const {
      windowMs,
      maxRequests,
      message = 'Too many requests, please try again later.',
      statusCode = 429,
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.generateKey(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get or create rate limit entry
        if (!this.store[key] || this.store[key].resetTime <= now) {
          this.store[key] = {
            count: 0,
            resetTime: now + windowMs
          };
        }

        const entry = this.store[key];

        // Check if limit exceeded
        if (entry.count >= maxRequests) {
          res.status(statusCode).json({
            error: message,
            retryAfter: Math.ceil((entry.resetTime - now) / 1000)
          });
          return;
        }

        // Increment counter
        entry.count++;

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, maxRequests - entry.count).toString(),
          'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString()
        });

        // Store original end function
        const originalEnd = res.end;
        let responseSent = false;

        // Override end function to track response status
        res.end = function(...args: any[]) {
          if (!responseSent) {
            responseSent = true;
            const isSuccessful = res.statusCode >= 200 && res.statusCode < 400;
            const isFailed = res.statusCode >= 400;

            // Adjust counter based on skip options
            if ((skipSuccessfulRequests && isSuccessful) || 
                (skipFailedRequests && isFailed)) {
              entry.count--;
            }
          }
          return originalEnd.apply(this, args);
        };

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next();
      }
    };
  };

  /**
   * Trading-specific rate limits
   */
  tradingLimiter = this.createLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many trading requests. Please slow down.',
    skipFailedRequests: true
  });

  /**
   * Order creation rate limit
   */
  orderLimiter = this.createLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many order requests. Maximum 20 orders per minute.'
  });

  /**
   * Authentication rate limit
   */
  authLimiter = this.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  });

  /**
   * General API rate limit
   */
  apiLimiter = this.createLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    message: 'API rate limit exceeded.'
  });

  /**
   * Strict rate limit for sensitive operations
   */
  strictLimiter = this.createLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Rate limit exceeded for sensitive operation.'
  });

  /**
   * Generate unique key for rate limiting
   */
  private generateKey(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime <= now) {
        delete this.store[key];
      }
    });
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(req: Request): void {
    const key = this.generateKey(req);
    delete this.store[key];
  }

  /**
   * Get current rate limit status
   */
  getStatus(req: Request): { count: number; remaining: number; resetTime: number } | null {
    const key = this.generateKey(req);
    const entry = this.store[key];
    
    if (!entry) {
      return null;
    }

    return {
      count: entry.count,
      remaining: Math.max(0, 100 - entry.count), // Default max
      resetTime: entry.resetTime
    };
  }
}

// Create and export default instance
export const rateLimiter = new RateLimiter();

// Export specific limiters for easy use
export const {
  tradingLimiter,
  orderLimiter,
  authLimiter,
  apiLimiter,
  strictLimiter
} = rateLimiter;