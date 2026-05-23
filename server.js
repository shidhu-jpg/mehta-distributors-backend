import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import ordersRouter from './routes/orders.js';
import inventoryRouter from './routes/inventory.js';
import paymentsRouter from './routes/payments.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.WEBSITE_URL  || 'https://your-website.pages.dev',
      process.env.DASHBOARD_URL || 'https://your-dashboard.pages.dev',
    ]
  : '*';

app.use(cors({ origin: allowedOrigins }));

// ── BODY PARSING ──────────────────────────────────────────────
app.use(express.json());

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── ROUTES ────────────────────────────────────────────────────
app.use('/api/orders',    ordersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/payments',  paymentsRouter);

// ── 404 HANDLER ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Mehta Distributors API running on port ${PORT}`);
});
