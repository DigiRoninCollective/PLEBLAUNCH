import express from 'express';
import { getTodos } from '../controllers/todoController';

const router = express.Router();

router.get('/todos', getTodos);

export default router;
