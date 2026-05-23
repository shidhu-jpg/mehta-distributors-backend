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

  // Auto-record a transaction entry when amount increases
  const diff = amount_paid - Number(existing.amount_paid);
  if (diff > 0) {
    await supabase
      .from('payment_transactions')
      .insert([{ payment_id: id, amount: diff, notes: 'Payment recorded' }]);
  }

  res.json(data);
});

// GET /api/payments/:id/transactions — payment history for one retailer
router.get('/:id/transactions', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('payment_id', id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/payments/:id/transactions — record a payment instalment
router.post('/:id/transactions', async (req, res) => {
  const { id } = req.params;
  const { amount, notes } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Payment record not found' });

  const { data: txn, error: txnErr } = await supabase
    .from('payment_transactions')
    .insert([{ payment_id: id, amount, notes: notes || null }])
    .select()
    .single();

  if (txnErr) return res.status(500).json({ error: txnErr.message });

  const newAmountPaid = Number(existing.amount_paid) + amount;
  const total = Number(existing.total_order_value);
  const status = newAmountPaid >= total ? 'Paid' : newAmountPaid > 0 ? 'Partial' : 'Overdue';

  const { data: updatedPayment, error: updateErr } = await supabase
    .from('payments')
    .update({ amount_paid: newAmountPaid, status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.status(201).json({ transaction: txn, payment: updatedPayment });
});

export default router;
