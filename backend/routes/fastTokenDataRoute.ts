import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Simple API key middleware for subscription gating
const API_KEY = process.env.FAST_DATA_API_KEY || 'testkey';
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (key !== API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing API key' });
  }
  next();
}

// Fast token data endpoint using Helius RPC
router.get('/fast-token-data', requireApiKey, (async (req, res) => {
  const { mint } = req.query;
  if (!mint || typeof mint !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid mint address' });
  }
  try {
    // Example: Fetch token account info from Helius
    const heliusRpc = process.env.HELIUS_RPC_URL;
    if (!heliusRpc) return res.status(500).json({ error: 'HELIUS_RPC_URL not set' });
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenSupply',
      params: [mint]
    };
    const response = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json() as any;
    res.json({ mint, supply: data.result?.value?.amount || null, raw: data });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch token data', details: err.message });
  }
}) as any);

export default router;
