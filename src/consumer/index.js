const express = require('express');

const app = express();
app.use(express.json());

const providerUrl = process.env.PROVIDER_URL || 'http://localhost:3001';

const log = (...args) => console.log(`[consumer ${new Date().toISOString()}]`, ...args);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

const orders = new Map();
let nextOrderId = 1;

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'consumer' }));

app.get('/api/orders', (_req, res) => {
  res.json(Array.from(orders.values()));
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders', async (req, res) => {
  const { userId, productId, quantity } = req.body;
  if (!userId || !productId || !quantity) {
    return res.status(400).json({ error: 'userId, productId and quantity are required' });
  }

  const callProvider = async (method, path, body) => {
    const started = Date.now();
    const res = await fetch(`${providerUrl}${path}`, body ? {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined);
    log(`-> provider ${method} ${path} <- ${res.status} (${Date.now() - started}ms)`);
    return res;
  };

  try {
    const userRes = await callProvider('GET', `/api/users/${userId}`);
    if (userRes.status === 404) return res.status(404).json({ error: 'User not found' });
    if (!userRes.ok) return res.status(502).json({ error: 'Provider error fetching user' });
    const user = await userRes.json();

    const productRes = await callProvider('GET', `/api/products/${productId}`);
    if (productRes.status === 404) return res.status(404).json({ error: 'Product not found' });
    if (!productRes.ok) return res.status(502).json({ error: 'Provider error fetching product' });
    const product = await productRes.json();

    const stockRes = await callProvider('PATCH', `/api/products/${productId}/stock`, { delta: -quantity });
    if (stockRes.status === 409) return res.status(409).json({ error: 'Insufficient stock' });
    if (!stockRes.ok) return res.status(502).json({ error: 'Provider error updating stock' });

    const order = {
      id: nextOrderId++,
      user: { id: user.id, name: user.name },
      product: { id: product.id, name: product.name },
      quantity,
      total: +(product.price * quantity).toFixed(2),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    orders.set(order.id, order);
    res.status(201).json(order);
  } catch (err) {
    res.status(502).json({ error: 'Provider unreachable', detail: err.message });
  }
});

app.delete('/api/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!orders.has(id)) return res.status(404).json({ error: 'Order not found' });
  orders.delete(id);
  res.status(204).end();
});

const port = process.env.CONSUMER_PORT || 3002;
if (require.main === module) {
  app.listen(port, () => log(`listening on ${port}, provider=${providerUrl}`));
}

module.exports = app;
