import { Router } from 'express';
import supabase from '../supabaseClient.js';

const router = Router();

// GET /api/payments — fetch all, by due date ascending
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/payments/:id — update payment with auto status recalc
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { amount_paid } = req.body;

  if (amount_paid === undefined || typeof amount_paid !== 'number' || amount_paid < 0) {
    return res.status(400).json({ error: 'amount_paid must be a non-negative number' });
  }

  // Fetch current record to get total_order_value
  const { data: existing, error: fetchErr } = await supabase
    .from('payments')
    .select('total_order_value')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Payment record not found' });

  // Recalculate status automatically
  let status;
  if (amount_paid >= existing.total_order_value) {
    status = 'Paid';
  } else if (amount_paid > 0) {
    status = 'Partial';
  } else {
    status = 'Overdue';
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ amount_paid, status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
