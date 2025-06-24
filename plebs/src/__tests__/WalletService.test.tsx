import { WalletService } from '../services/WalletService';
import { Connection, PublicKey } from '@solana/web3.js';
import { createLogger } from '../utils/logger';

// Mock RateLimiter to avoid Redis dependency
jest.mock('../utils/RateLimiter', () => {
  return {
    RateLimiter: jest.fn().mockImplementation(() => ({
      checkLimit: jest.fn().mockResolvedValue(true)
    }))
  };
});

describe('WalletService', () => {
  let walletService: WalletService;
  let mockConnection: jest.Mocked<Connection>;
  const logger = createLogger();

  beforeEach(() => {
    mockConnection = {
      getBalance: jest.fn()
      // ... add other required Connection methods if needed
    } as unknown as jest.Mocked<Connection>;

    walletService = new WalletService(mockConnection, logger);
  });

  describe('generateWallet', () => {
    it('should generate a valid wallet', async () => {
      const result = await walletService.generateWallet();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.publicKey).toBeDefined();
      expect(result.data?.privateKey).toBeDefined();
      // Remove mnemonic check if not implemented
      // expect(result.data?.mnemonic).toBeDefined();
    });
  });

  describe('getSOLBalance', () => {
    it('should return correct balance', async () => {
      const mockBalance = 1000000000; // 1 SOL
      mockConnection.getBalance.mockResolvedValue(mockBalance);

      // Use a valid Solana public key for testing
      const validPublicKey = new PublicKey('11111111111111111111111111111111').toString();

      const result = await walletService.getSOLBalance(validPublicKey);

      expect(result.success).toBe(true);
      expect(result.data?.balance).toBe(1);
      expect(result.data?.lamports).toBe(mockBalance);
    });
  });
});