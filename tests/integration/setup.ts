import pactum from 'pactum';

const { request, stash } = pactum;

request.setDefaultTimeout(5000);

stash.addDataMap({
  hosts: {
    provider: process.env.PROVIDER_URL ?? 'http://localhost:3001',
    consumer: process.env.CONSUMER_URL ?? 'http://localhost:3002',
  },
  users: {
    alice: { id: 1, name: 'Alice' },
    bob: { id: 2, name: 'Bob' },
  },
  products: {
    keyboard: { id: 1, name: 'Keyboard' },
    mouse: { id: 2, name: 'Mouse' },
  },
});
