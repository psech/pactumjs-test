import { before, after } from 'node:test';
import { createRequire } from 'node:module';
import pactum from 'pactum';

const requireCjs = createRequire(import.meta.url);
const pjr = requireCjs('pactum-json-reporter');
pjr.path = 'reports';
pjr.file = 'e2e.pactum.json';

const { request, stash, reporter } = pactum;

request.setDefaultTimeout(5000);

stash.addDataMap({
  hosts: {
    provider: process.env.PROVIDER_URL ?? 'http://localhost:3001',
    consumer: process.env.CONSUMER_URL ?? 'http://localhost:3002',
  },
  users: {
    alice: { id: 1, name: 'Alice' },
  },
  products: {
    keyboard: { id: 1, name: 'Keyboard' },
    mouse: { id: 2, name: 'Mouse' },
  },
});

stash.addDataTemplate({
  'Product:New': {
    name: 'Sample',
    price: 9.99,
    stock: 10,
  },
});

before(() => {
  reporter.add(pjr);
});

after(async () => {
  await reporter.end();
});
