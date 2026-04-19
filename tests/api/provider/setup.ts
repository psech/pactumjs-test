import { after } from 'node:test';
import { createRequire } from 'node:module';
import getPort from 'get-port';
import pactum from 'pactum';

const requireCjs = createRequire(import.meta.url);

const { request, stash } = pactum;

const PROVIDER_PORT = await getPort({ port: Number(process.env.PROVIDER_PORT ?? 3001) });
process.env.PROVIDER_PORT = String(PROVIDER_PORT);

const providerApp = requireCjs('../../../src/provider/index.js');
const providerServer = providerApp.listen(PROVIDER_PORT);
console.log(`[api:provider] provider listening on :${PROVIDER_PORT}`);

request.setDefaultTimeout(5000);

stash.addDataMap({
  hosts: {
    provider: `http://localhost:${PROVIDER_PORT}`,
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

after(async () => {
  await new Promise<void>((resolve) => providerServer.close(() => resolve()));
});
