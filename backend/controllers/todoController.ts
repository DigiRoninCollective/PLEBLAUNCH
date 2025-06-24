import { Request, Response } from 'express';
import { supabase } from '../utils/superbase';

export async function getTodos(req: Request, res: Response) {
  const { data, error } = await supabase.from('todos').select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
