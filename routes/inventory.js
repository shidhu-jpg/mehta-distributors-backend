import { Router } from 'express';
import multer from 'multer';
import supabase from '../supabaseClient.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const VALID_UNITS = ['boxes', 'units', 'cartons'];
const BUCKET = 'product-images';

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.id === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
}

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
  const { product_name, category, stock_quantity, unit, price } = req.body;

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
    .insert([{
      product_name,
      category,
      stock_quantity,
      unit,
      price: price !== undefined ? Number(price) : null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// POST /api/inventory/:id/image — upload product image to Supabase Storage
router.post('/:id/image', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  await ensureBucket();

  const ext = req.file.mimetype.split('/')[1] || 'jpg';
  const path = `${id}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

  if (uploadErr) return res.status(500).json({ error: uploadErr.message });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from('inventory')
    .update({ image_url: publicUrl })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/inventory/:id — update stock quantity (and optionally price)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { stock_quantity, price } = req.body;

  if (stock_quantity === undefined || typeof stock_quantity !== 'number' || stock_quantity < 0) {
    return res.status(400).json({ error: 'stock_quantity must be a non-negative number' });
  }

  const updateData = { stock_quantity, updated_at: new Date().toISOString() };
  if (price !== undefined) updateData.price = Number(price);

  const { data, error } = await supabase
    .from('inventory')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

export default router;
