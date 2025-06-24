import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    wallet: string;
    role: string;
  };
}

export class AuthMiddleware {
  private pool: Pool;
  private jwtSecret: string;

  constructor(pool: Pool, jwtSecret: string) {
    this.pool = pool;
    this.jwtSecret = jwtSecret;
  }

  /**
   * Verify JWT token and authenticate user
   */
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        
        // Fetch user from database
        const userQuery = 'SELECT id, email, wallet, role FROM users WHERE id = $1 AND active = true';
        const userResult = await this.pool.query(userQuery, [decoded.userId]);
        
        if (userResult.rows.length === 0) {
          res.status(401).json({ error: 'User not found or inactive' });
          return;
        }

        req.user = userResult.rows[0];
        next();
      } catch (jwtError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  /**
   * Require specific roles
   */
  requireRole = (roles: string | string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  /**
   * Optional authentication - sets user if token is valid but doesn't require it
   */
  optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
      }

      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        
        const userQuery = 'SELECT id, email, wallet, role FROM users WHERE id = $1 AND active = true';
        const userResult = await this.pool.query(userQuery, [decoded.userId]);
        
        if (userResult.rows.length > 0) {
          req.user = userResult.rows[0];
        }
      } catch (jwtError) {
        // Invalid token, but that's okay for optional auth
      }

      next();
    } catch (error) {
      console.error('Optional authentication error:', error);
      next();
    }
  };

  /**
   * API Key authentication for external services
   */
  authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        res.status(401).json({ error: 'API key required' });
        return;
      }

      const keyQuery = 'SELECT user_id, permissions FROM api_keys WHERE key_hash = $1 AND active = true';
      const keyResult = await this.pool.query(keyQuery, [apiKey]);
      
      if (keyResult.rows.length === 0) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      const apiKeyData = keyResult.rows[0];
      
      // Fetch user data
      const userQuery = 'SELECT id, email, wallet, role FROM users WHERE id = $1 AND active = true';
      const userResult = await this.pool.query(userQuery, [apiKeyData.user_id]);
      
      if (userResult.rows.length === 0) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      (req as AuthenticatedRequest).user = {
        ...userResult.rows[0],
        apiPermissions: apiKeyData.permissions
      };

      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

// Export factory function
export const createAuthMiddleware = (pool: Pool, jwtSecret: string) => {
  return new AuthMiddleware(pool, jwtSecret);
};

// Export type for use in other files
export { AuthenticatedRequest };