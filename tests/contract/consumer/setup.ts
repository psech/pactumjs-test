import { before, after } from 'node:test';
import { createRequire } from 'node:module';
import getPort from 'get-port';
import pactum from 'pactum';

const requireCjs = createRequire(import.meta.url);
const pf = requireCjs('pactum-flow-plugin');
const pjr = requireCjs('pactum-json-reporter');
pjr.path = 'reports';
pjr.file = 'contract-consumer.pactum.json';

const { version: consumerVersion } = requireCjs('../../../src/consumer/package.json');

const { request, mock, stash, reporter } = pactum;

const MOCK_PORT = await getPort({ port: 3111 });
const CONSUMER_PORT = await getPort({ port: 3112 });

process.env.PROVIDER_URL = `http://localhost:${MOCK_PORT}`;
process.env.CONSUMER_PORT = String(CONSUMER_PORT);

pf.config.url = process.env.FLOW_SERVER_URL ?? 'http://localhost:8080';
pf.config.projectId = 'consumer';
pf.config.projectName = 'consumer';
pf.config.version = process.env.BUILD_VERSION ?? consumerVersion;
pf.config.publish = process.env.FLOW_SERVER_URL !== undefined;
pf.config.username = process.env.FLOW_USERNAME ?? 'admin';
pf.config.password = process.env.FLOW_PASSWORD ?? 'admin';

await mock.start(MOCK_PORT);
console.log(`[contract:consumer] provider mock listening on :${MOCK_PORT}`);

const consumerApp = requireCjs('../../../src/consumer/index.js');
const consumerServer = consumerApp.listen(CONSUMER_PORT);
console.log(`[contract:consumer] consumer listening on :${CONSUMER_PORT}`);

request.setDefaultTimeout(5000);

stash.addDataMap({
  hosts: {
    consumer: `http://localhost:${CONSUMER_PORT}`,
  },
  users: {
    alice: { id: 1, name: 'Alice', email: 'alice@example.com' },
  },
  products: {
    mouse: { id: 2, name: 'Mouse', price: 19.99, stock: 30 },
  },
});

before(() => {
  reporter.add(pf.reporter);
  reporter.add(pjr);
});

after(async () => {
  await reporter.end();
  await new Promise<void>((resolve) => consumerServer.close(() => resolve()));
  await mock.stop();
});
