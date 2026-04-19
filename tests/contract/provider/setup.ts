import { before, after } from 'node:test';
import { createRequire } from 'node:module';
import getPort from 'get-port';
import pactum from 'pactum';

const requireCjs = createRequire(import.meta.url);
const pf = requireCjs('pactum-flow-plugin');
const pjr = requireCjs('pactum-json-reporter');
pjr.path = 'reports';
pjr.file = 'contract-provider.pactum.json';

const { version: providerVersion } = requireCjs('../../../src/provider/package.json');

const { request, stash, reporter } = pactum;

const PROVIDER_PORT = await getPort({ port: 3011 });
process.env.PROVIDER_PORT = String(PROVIDER_PORT);

pf.config.url = process.env.FLOW_SERVER_URL ?? 'http://localhost:8080';
pf.config.projectId = 'provider';
pf.config.projectName = 'provider';
pf.config.version = process.env.BUILD_VERSION ?? providerVersion;
pf.config.publish = process.env.FLOW_SERVER_URL !== undefined;
pf.config.username = process.env.FLOW_USERNAME ?? 'admin';
pf.config.password = process.env.FLOW_PASSWORD ?? 'admin';

const providerApp = requireCjs('../../../src/provider/index.js');
const providerServer = providerApp.listen(PROVIDER_PORT);
console.log(`[contract:provider] provider listening on :${PROVIDER_PORT}`);

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
  reporter.add(pjr);
});

after(async () => {
  await reporter.end();
  await new Promise<void>((resolve) => providerServer.close(() => resolve()));
});
