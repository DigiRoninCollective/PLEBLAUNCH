import dotenv from 'dotenv';
import { Connection, Keypair } from '@solana/web3.js';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

dotenv.config();

interface Config {
  solana: {
    connection: Connection;
    feePayerKeypair: Keypair;
    rpcUrl: string;
    network: 'mainnet-beta' | 'testnet' | 'devnet';
  };
  platform: {
    feeBps: number;
    feeAccount: string;
  };
  security: {
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
    jwt: {
      secret: string;
      expiresIn: string;
    };
  };
  logger: Logger;
}

const config: Config = {
  solana: {
    connection: new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    ),
    feePayerKeypair: Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.FEE_PAYER_PRIVATE_KEY || '[]'))
    ),
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    network: (process.env.SOLANA_NETWORK || 'mainnet-beta') as 'mainnet-beta' | 'testnet' | 'devnet'
  },
  platform: {
    feeBps: parseInt(process.env.PLATFORM_FEE_BPS || '30'),
    feeAccount: process.env.PLATFORM_FEE_ACCOUNT || ''
  },
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  },
  logger: createLogger()
};

export default config;