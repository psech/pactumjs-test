import { after } from 'node:test';
import { createRequire } from 'node:module';
import getPort from 'get-port';
import pactum from 'pactum';

const { request, mock, stash } = pactum;

const MOCK_PORT = await getPort({ port: Number(process.env.PROVIDER_MOCK_PORT ?? 3101) });
const CONSUMER_PORT = await getPort({ port: Number(process.env.CONSUMER_PORT ?? 3102) });

process.env.PROVIDER_URL = `http://localhost:${MOCK_PORT}`;
process.env.CONSUMER_PORT = String(CONSUMER_PORT);

await mock.start(MOCK_PORT);
console.log(`[api:consumer] provider mock listening on :${MOCK_PORT}`);

const requireCjs = createRequire(import.meta.url);
const consumerApp = requireCjs('../../../src/consumer/index.js');
const consumerServer = consumerApp.listen(CONSUMER_PORT);
console.log(`[api:consumer] consumer listening on :${CONSUMER_PORT}`);

request.setDefaultTimeout(5000);

stash.addDataMap({
  hosts: {
    consumer: `http://localhost:${CONSUMER_PORT}`,
    providerMock: `http://localhost:${MOCK_PORT}`,
  },
  users: {
    alice: { id: 1, name: 'Alice', email: 'alice@example.com' },
  },
  products: {
    mouse: { id: 2, name: 'Mouse', price: 19.99, stock: 30 },
  },
});

stash.addDataTemplate({
  'Order:New': {
    userId: '$M{users.alice.id}',
    productId: '$M{products.mouse.id}',
    quantity: 1,
  },
});

after(async () => {
  await new Promise<void>((resolve) => consumerServer.close(() => resolve()));
  await mock.stop();
});
