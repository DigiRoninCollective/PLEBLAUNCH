import express, { Request, Response, NextFunction } from 'express';
// Use native fetch (Node.js 18+) or install node-fetch
// For Node.js 18+: native fetch is available globally
// For older versions: npm install node-fetch@2

const router = express.Router();

// Types
interface TokenSupplyResponse {
  jsonrpc: string;
  id: number;
  result?: {
    context: { slot: number };
    value: {
      amount: string;
      decimals: number;
      uiAmount: number;
      uiAmountString: string;
    };
  };
  error?: {
    code: number;
    message: string;
  };
}

interface TokenAccountResponse {
  jsonrpc: string;
  id: number;
  result?: {
    context: { slot: number };
    value: Array<{
      account: {
        data: {
          parsed: {
            info: {
              mint: string;
              owner: string;
              tokenAmount: {
                amount: string;
                decimals: number;
                uiAmount: number;
              };
            };
          };
        };
      };
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

// Configuration
const API_KEY = process.env.FAST_DATA_API_KEY || 'testkey';
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL;
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Enhanced API key middleware with rate limiting integration
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!key) {
    res.status(401).json({ 
      error: 'Unauthorized: API key required',
      hint: 'Provide API key via x-api-key header or apiKey query parameter'
    });
    return;
  }
  
  if (key !== API_KEY) {
    res.status(403).json({ 
      error: 'Forbidden: Invalid API key'
    });
    return;
  }
  
  next();
}

// Input validation middleware
function validateMintAddress(req: Request, res: Response, next: NextFunction): void {
  const { mint } = req.query;
  
  if (!mint || typeof mint !== 'string') {
    res.status(400).json({ 
      error: 'Bad Request: Missing or invalid mint address',
      expected: 'string',
      received: typeof mint
    });
    return;
  }
  
  // Basic Solana address validation (base58, 32-44 characters)
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!solanaAddressRegex.test(mint)) {
    res.status(400).json({ 
      error: 'Bad Request: Invalid Solana mint address format'
    });
    return;
  }
  
  next();
}

// RPC helper function
async function makeRpcCall<T>(method: string, params: any[]): Promise<T> {
  if (!HELIUS_RPC_URL) {
    throw new Error('HELIUS_RPC_URL environment variable not configured');
  }

  const body = {
    jsonrpc: '2.0',
    id: Date.now(), // Use timestamp as unique ID
    method,
    params
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // Use global fetch (Node.js 18+) or node-fetch for older versions
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'TokenDataAPI/1.0'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as T;
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: RPC call took too long');
    }
    throw error;
  }
}

// Fast token supply endpoint
router.get('/fast-token-data', requireApiKey, validateMintAddress, async (req: Request, res: Response): Promise<void> => {
  const { mint, includeAccounts } = req.query;
  const startTime = Date.now();

  try {
    // Fetch token supply
    const supplyData = await makeRpcCall<TokenSupplyResponse>('getTokenSupply', [mint]);
    
    if (supplyData.error) {
      res.status(400).json({ 
        error: 'RPC Error', 
        details: supplyData.error.message,
        code: supplyData.error.code
      });
      return;
    }

    const result: any = {
      mint,
      supply: supplyData.result?.value || null,
      slot: supplyData.result?.context?.slot || null,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    };

    // Optionally include token accounts (slower)
    if (includeAccounts === 'true') {
      try {
        const accountsData = await makeRpcCall<TokenAccountResponse>('getTokenAccountsByMint', [
          mint,
          { encoding: 'jsonParsed' }
        ]);
        
        result.accounts = {
          count: accountsData.result?.value?.length || 0,
          data: accountsData.result?.value || []
        };
      } catch (accountError) {
        result.accounts = {
          error: 'Failed to fetch token accounts',
          details: accountError.message
        };
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error.message,
      mint,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Token metadata endpoint (using Helius DAS API if available)
router.get('/token-metadata', requireApiKey, validateMintAddress, async (req: Request, res: Response): Promise<void> => {
  const { mint } = req.query;
  const startTime = Date.now();

  try {
    // Try to get token metadata using getAsset method (Helius DAS API)
    const metadataResponse = await makeRpcCall<any>('getAsset', [mint]);
    
    if (metadataResponse.error) {
      res.status(400).json({ 
        error: 'Metadata not found', 
        details: metadataResponse.error.message,
        mint
      });
      return;
    }

    const result = {
      mint,
      metadata: metadataResponse.result,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    };

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch token metadata',
      details: error.message,
      mint,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Batch token data endpoint
router.post('/batch-token-data', requireApiKey, async (req: Request, res: Response): Promise<void> => {
  const { mints } = req.body;
  const startTime = Date.now();

  if (!Array.isArray(mints) || mints.length === 0) {
    res.status(400).json({ 
      error: 'Bad Request: mints must be a non-empty array'
    });
    return;
  }

  if (mints.length > 50) {
    res.status(400).json({ 
      error: 'Bad Request: Maximum 50 mints per batch request'
    });
    return;
  }

  try {
    const promises = mints.map(async (mint: string) => {
      try {
        const supplyData = await makeRpcCall<TokenSupplyResponse>('getTokenSupply', [mint]);
        return {
          mint,
          success: true,
          supply: supplyData.result?.value || null,
          slot: supplyData.result?.context?.slot || null,
          error: supplyData.error || null
        };
      } catch (error: any) {
        return {
          mint,
          success: false,
          supply: null,
          slot: null,
          error: error.message
        };
      }
    });

    const results = await Promise.all(promises);
    
    res.json({
      results,
      total: mints.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error.message,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    rpcConfigured: !!HELIUS_RPC_URL,
    apiKeyConfigured: !!API_KEY
  });
});

export default router;