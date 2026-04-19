import pactum from 'pactum';

const { request, stash } = pactum;

request.setDefaultTimeout(5000);

stash.addDataMap({
  hosts: {
    provider: process.env.PROVIDER_URL ?? 'http://localhost:3001',
  },
  products: {
    keyboard: { id: 1, name: 'Keyboard' },
    mouse: { id: 2, name: 'Mouse' },
    monitor: { id: 3, name: 'Monitor' },
  },
  users: {
    alice: { id: 1, name: 'Alice' },
    bob: { id: 2, name: 'Bob' },
  },
});

stash.addDataTemplate({
  'Product:New': {
    name: 'Sample',
    price: 9.99,
    stock: 10,
  },
});
