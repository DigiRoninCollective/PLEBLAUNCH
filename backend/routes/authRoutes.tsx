import express, { Request, Response } from 'express';
const router = express.Router();

// Placeholder login route
router.post('/login', (req: Request, res: Response) => {
  res.json({ message: 'Auth route working' });
});

export default router;
