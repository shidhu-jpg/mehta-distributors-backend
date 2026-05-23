import { Router } from 'express';
import supabase from '../supabaseClient.js';

const router = Router();
const VALID_UNITS = ['boxes', 'units', 'cartons'];

// GET /api/inventory — fetch all, alphabetically
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('product_name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/inventory — add product
router.post('/', async (req, res) => {
  const { product_name, category, stock_quantity, unit } = req.body;

  if (!product_name || !category || stock_quantity === undefined || !unit) {
    return res.status(400).json({ error: 'product_name, category, stock_quantity, and unit are required' });
  }
  if (!VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: `unit must be one of: ${VALID_UNITS.join(', ')}` });
  }
  if (typeof stock_quantity !== 'number' || stock_quantity < 0) {
    return res.status(400).json({ error: 'stock_quantity must be a non-negative number' });
  }

  const { data, error } = await supabase
    .from('inventory')
    .insert([{ product_name, category, stock_quantity, unit }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/inventory/:id — update stock quantity
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { stock_quantity } = req.body;

  if (stock_quantity === undefined || typeof stock_quantity !== 'number' || stock_quantity < 0) {
    return res.status(400).json({ error: 'stock_quantity must be a non-negative number' });
  }

  const { data, error } = await supabase
    .from('inventory')
    .update({ stock_quantity })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

export default router;
