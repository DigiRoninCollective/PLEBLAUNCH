import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { validateRequest } from '../middleware/validator';
import { walletSchemas } from '../schemas/wallet.schema';

const router = Router();
const walletController = new WalletController();

router.post(
  '/generate',
  validateRequest(walletSchemas.generate),
  walletController.generateWallet
);
router.get(
  '/balance/:publicKey',
  validateRequest(walletSchemas.getBalance),
  walletController.getBalance
);
router.post(
  '/transfer',
  validateRequest(walletSchemas.transfer),
  walletController.transfer
);

export default router;