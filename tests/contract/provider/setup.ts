import { before, after } from 'node:test';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import pactum from 'pactum';

const requireCjs = createRequire(import.meta.url);
const pf = requireCjs('pactum-flow-plugin');

const { request, stash, reporter } = pactum;

const getFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });

const PROVIDER_PORT = await getFreePort();
process.env.PROVIDER_PORT = String(PROVIDER_PORT);

pf.config.url = process.env.FLOW_SERVER_URL ?? 'http://localhost:8080';
pf.config.projectId = 'provider';
pf.config.projectName = 'provider';
pf.config.version = process.env.BUILD_VERSION ?? 'local';
pf.config.publish = process.env.FLOW_SERVER_URL !== undefined;
pf.config.username = process.env.FLOW_USERNAME ?? 'admin';
pf.config.password = process.env.FLOW_PASSWORD ?? 'admin';

const providerApp = requireCjs('../../../src/provider/index.js');
const providerServer = providerApp.listen(PROVIDER_PORT);

request.setDefaultTimeout(5000);

stash.addDataMap({
  hosts: {
    provider: `http://localhost:${PROVIDER_PORT}`,
  },
  users: {
    alice: { id: 1, name: 'Alice' },
  },
  products: {
    keyboard: { id: 1, name: 'Keyboard' },
    mouse: { id: 2, name: 'Mouse' },
  },
});

before(() => {
  reporter.add(pf.reporter);
});

after(async () => {
  await reporter.end();
  await new Promise<void>((resolve) => providerServer.close(() => resolve()));
});
