import { Router } from 'express';
import supabase from '../supabaseClient.js';

const router = Router();
const VALID_STATUSES = ['New', 'Processing', 'Dispatched'];

// GET /api/orders — fetch all, newest first
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/orders — create new order
router.post('/', async (req, res) => {
  const { retailer_name, phone, product, quantity, note } = req.body;

  if (!retailer_name || !phone || !product || !quantity) {
    return res.status(400).json({ error: 'retailer_name, phone, product, and quantity are required' });
  }
  if (typeof quantity !== 'number' || quantity < 1) {
    return res.status(400).json({ error: 'quantity must be a positive number' });
  }

  const { data, error } = await supabase
    .from('orders')
    .insert([{ retailer_name, phone, product, quantity, note: note || null }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/orders/:id — update status
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Order not found' });
  res.json(data);
});

export default router;
