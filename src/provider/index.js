const express = require('express');

const app = express();
app.use(express.json());

const log = (...args) => console.log(`[provider ${new Date().toISOString()}]`, ...args);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

const products = new Map([
  [1, { id: 1, name: 'Keyboard', price: 49.99, stock: 12 }],
  [2, { id: 2, name: 'Mouse', price: 19.99, stock: 30 }],
  [3, { id: 3, name: 'Monitor', price: 249.0, stock: 5 }],
]);

const users = new Map([
  [1, { id: 1, name: 'Alice', email: 'alice@example.com' }],
  [2, { id: 2, name: 'Bob', email: 'bob@example.com' }],
]);

let nextProductId = 4;

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'provider' }));

app.get('/api/products', (_req, res) => {
  res.json(Array.from(products.values()));
});

app.get('/api/products/:id', (req, res) => {
  const product = products.get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/products', (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'name and numeric price are required' });
  }
  const product = { id: nextProductId++, name, price, stock: stock ?? 0 };
  products.set(product.id, product);
  res.status(201).json(product);
});

app.patch('/api/products/:id/stock', (req, res) => {
  const product = products.get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const { delta } = req.body;
  if (typeof delta !== 'number') {
    return res.status(400).json({ error: 'numeric delta is required' });
  }
  if (product.stock + delta < 0) {
    return res.status(409).json({ error: 'Insufficient stock' });
  }
  product.stock += delta;
  res.json(product);
});

app.get('/api/users/:id', (req, res) => {
  const user = users.get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

const port = process.env.PROVIDER_PORT || 3001;
if (require.main === module) {
  app.listen(port, () => log(`listening on ${port}`));
}

module.exports = app;
