import { Request, Response, NextFunction } from 'express';

interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

interface CorsPresets {
  development: CorsOptions;
  production: CorsOptions;
  trading: CorsOptions;
  strict: CorsOptions;
}

export class CorsHandler {
  private defaultOptions: CorsOptions = {
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: [],
    credentials: false,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  /**
   * Predefined CORS configurations for different environments
   */
  public presets: CorsPresets = {
    development: {
      origin: true, // Allow all origins in development
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
      credentials: true,
      maxAge: 3600
    },
    
    production: {
      origin: [
        'https://yourdomain.com',
        'https://www.yourdomain.com',
        'https://app.yourdomain.com'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400
    },
    
    trading: {
      origin: [
        'https://trading.yourdomain.com',
        'https://dashboard.yourdomain.com'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-API-Key',
        'X-Trading-Session',
        'X-Risk-Token'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ],
      credentials: true,
      maxAge: 3600 // Shorter cache for trading apps
    },
    
    strict: {
      origin: false, // No cross-origin requests allowed
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: false,
      maxAge: 0
    }
  };

  /**
   * Create CORS middleware with custom options
   */
  createCors = (options: CorsOptions = {}): ((req: Request, res: Response, next: NextFunction) => void) => {
    const config = { ...this.defaultOptions, ...options };

    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const origin = req.headers.origin;
        const method = req.method;

        // Handle preflight requests
        if (method === 'OPTIONS') {
          this.handlePreflight(req, res, config);
          return;
        }

        // Handle simple requests
        this.handleSimpleRequest(req, res, config);
        next();

      } catch (error) {
        console.error('CORS error:', error);
        next(error);
      }
    };
  };

  /**
   * Handle preflight OPTIONS requests
   */
  private handlePreflight(req: Request, res: Response, config: CorsOptions): void {
    const origin = req.headers.origin;
    const requestMethod = req.headers['access-control-request-method'];
    const requestHeaders = req.headers['access-control-request-headers'];

    // Check origin
    if (!this.isOriginAllowed(origin, config.origin)) {
      res.status(403).json({ error: 'CORS policy violation: Origin not allowed' });
      return;
    }

    // Set CORS headers for preflight
    this.setOriginHeader(res, origin, config.origin);
    this.setCredentialsHeader(res, config.credentials);
    this.setMethodsHeader(res, config.methods);
    this.setAllowedHeadersHeader(res, config.allowedHeaders, requestHeaders);
    this.setMaxAgeHeader(res, config.maxAge);

    // Send preflight response
    res.status(config.optionsSuccessStatus || 204);
    
    if (config.preflightContinue) {
      return; // Continue to next middleware
    }
    
    res.end();
  }

  /**
   * Handle simple CORS requests
   */
  private handleSimpleRequest(req: Request, res: Response, config: CorsOptions): void {
    const origin = req.headers.origin;

    // Check origin
    if (!this.isOriginAllowed(origin, config.origin)) {
      // Don't set CORS headers for disallowed origins
      return;
    }

    // Set CORS headers for simple requests
    this.setOriginHeader(res, origin, config.origin);
    this.setCredentialsHeader(res, config.credentials);
    this.setExposedHeadersHeader(res, config.exposedHeaders);
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(
    origin: string | undefined, 
    allowedOrigin: CorsOptions['origin']
  ): boolean {
    if (allowedOrigin === true) return true;
    if (allowedOrigin === false) return false;
    if (!origin && allowedOrigin !== true) return false;

    if (typeof allowedOrigin === 'string') {
      return origin === allowedOrigin;
    }

    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.includes(origin!);
    }

    if (typeof allowedOrigin === 'function') {
      return new Promise((resolve) => {
        allowedOrigin(origin, (err, allow) => {
          resolve(!err && allow === true);
        });
      }) as any; // Simplified for sync operation
    }

    return false;
  }

  /**
   * Set Access-Control-Allow-Origin header
   */
  private setOriginHeader(
    res: Response, 
    origin: string | undefined, 
    allowedOrigin: CorsOptions['origin']
  ): void {
    if (allowedOrigin === true && origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    } else if (typeof allowedOrigin === 'string') {
      res.header('Access-Control-Allow-Origin', allowedOrigin);
    } else if (Array.isArray(allowedOrigin) && origin && allowedOrigin.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
  }

  /**
   * Set Access-Control-Allow-Credentials header
   */
  private setCredentialsHeader(res: Response, credentials?: boolean): void {
    if (credentials === true) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }

  /**
   * Set Access-Control-Allow-Methods header
   */
  private setMethodsHeader(res: Response, methods?: string | string[]): void {
    if (methods) {
      const methodsStr = Array.isArray(methods) ? methods.join(', ') : methods;
      res.header('Access-Control-Allow-Methods', methodsStr);
    }
  }

  /**
   * Set Access-Control-Allow-Headers header
   */
  private setAllowedHeadersHeader(
    res: Response, 
    allowedHeaders?: string | string[], 
    requestHeaders?: string
  ): void {
    if (allowedHeaders) {
      const headersStr = Array.isArray(allowedHeaders) 
        ? allowedHeaders.join(', ') 
        : allowedHeaders;
      res.header('Access-Control-Allow-Headers', headersStr);
    } else if (requestHeaders) {
      res.header('Access-Control-Allow-Headers', requestHeaders);
    }
  }

  /**
   * Set Access-Control-Expose-Headers header
   */
  private setExposedHeadersHeader(res: Response, exposedHeaders?: string | string[]): void {
    if (exposedHeaders && exposedHeaders.length > 0) {
      const headersStr = Array.isArray(exposedHeaders) 
        ? exposedHeaders.join(', ') 
        : exposedHeaders;
      res.header('Access-Control-Expose-Headers', headersStr);
    }
  }

  /**
   * Set Access-Control-Max-Age header
   */
  private setMaxAgeHeader(res: Response, maxAge?: number): void {
    if (typeof maxAge === 'number') {
      res.header('Access-Control-Max-Age', maxAge.toString());
    }
  }

  /**
   * Get preset configuration
   */
  getPreset(preset: keyof CorsPresets): CorsOptions {
    return this.presets[preset];
  }

  /**
   * Create CORS middleware with preset
   */
  createPresetCors(preset: keyof CorsPresets) {
    return this.createCors(this.getPreset(preset));
  }
}

// Create and export default instance
export const corsHandler = new CorsHandler();

// Export preset middlewares for easy use
export const developmentCors = corsHandler.createPresetCors('development');
export const productionCors = corsHandler.createPresetCors('production');
export const tradingCors = corsHandler.createPresetCors('trading');
export const strictCors = corsHandler.createPresetCors('strict');

// Export custom CORS creator
export const createCors = corsHandler.createCors;

// Usage examples:
/*
// Basic usage
app.use(developmentCors);

// Custom configuration
app.use(createCors({
  origin: ['https://myapp.com', 'https://admin.myapp.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// Route-specific CORS
app.get('/api/public', createCors({ origin: true }), handler);
app.post('/api/trading', tradingCors, handler);
*/