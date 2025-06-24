import { Router } from 'express';
import walletRoutes from './wallet.routes';
import nftRoutes from './nft.routes';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.use('/wallet', walletRoutes);

// Protected routes
router.use('/nft', authenticate, nftRoutes);

export default router;