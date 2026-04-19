# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. The [README.md](README.md) covers architecture, scripts, and user-facing docs — this file only captures non-obvious rules.

## Overview

Two small Express services ([src/provider](src/provider), [src/consumer](src/consumer)) exercised by four independent PactumJS test suites under [tests/](tests/): `api/`, `contract/`, `integration/`, `e2e/`. Each suite has its own `setup.ts` and npm script.

## Keep the README current

Whenever a change alters anything a user of this repo would observe or need to run — `package.json` scripts or deps, layout under `src/`/`tests/`, service boot behaviour (ports, env vars), new tooling (docker-compose, CI scripts), test authoring patterns, or externally-visible service behaviour — update [README.md](README.md) in the **same turn** as the change. Do not wait to be asked. Purely internal edits (refactors, private renames, comments) don't need README updates.

## Runtime and modules

- Node **24.15** (see [.nvmrc](.nvmrc)). Tests are plain `.ts` files run directly via Node's type stripping — no `ts-node`/`tsx`/`tsc`.
- Only **type-erasable TypeScript** is allowed: no `enum`, `namespace`, parameter properties (`constructor(private x: number)`), or legacy decorators. [tsconfig.json](tsconfig.json) enforces this via `erasableSyntaxOnly: true`.
- Root package is **CommonJS**. The `tests/` tree is **ESM**, scoped by [tests/package.json](tests/package.json). To load CJS from ESM, use `createRequire(import.meta.url)`.
- `pactum` and `pactum-flow-plugin` are CommonJS. Import as `import pactum from 'pactum'; const { spec, mock, stash } = pactum;` — never named imports.

## In-process service pattern

All four api/contract setup files boot services in the same process as the tests. Follow this pattern:

```ts
import { after } from 'node:test';
import { createRequire } from 'node:module';
import getPort from 'get-port';

const requireCjs = createRequire(import.meta.url);
const PORT = await getPort({ port: <preferred> });
const app = requireCjs('../../../src/<service>/index.js');
const server = app.listen(PORT);
console.log(`[suite] service listening on :${PORT}`);

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});
```

Why `get-port` with a preferred port: `node --test --import ./setup.ts` evaluates the setup in the test runner parent **and** each test-file worker. Fixed ports collide; `get-port` falls back to the next free one.

## PactumJS specifics

- `pactum.mock` routes by **literal path**. Matchers from `pactum-matchers` (`like`, `regex`, `eachLike`, `email`, `gt`, ...) work in request **body / query / headers** and response **body**, but not in path. For variable path segments keep the example concrete and aligned between consumer interaction and provider flow.
- `mock.addInteraction` matches bodies exactly when specified. Omitting `body` does **not** mean "accept any body" — for PATCH/POST interactions the body must match what the caller actually sends.
- Interactions within a test should be cleared per-test: `beforeEach(() => mock.clearInteractions())` and the same in `afterEach`.
- Data references in setup are `$M{hosts.provider}/...`; values stored by `stores('x', 'id')` become `$S{x}`; request bodies can use `{ '@DATA:TEMPLATE@': 'Name', '@OVERRIDES@': {...} }`. Prefer these over hardcoded hosts / seed records / request skeletons.

## pactum-flow-plugin

- Publishing is gated by `FLOW_SERVER_URL` — when unset, suites run locally without publishing.
- Use `pf.config.username` / `pf.config.password` (default `admin`/`admin` for the bundled Flows server). The plugin handles the session exchange itself; do **not** manually call `/api/flow/captain/v1/session`.
- `projectId + BUILD_VERSION` = analysis. Republishing the same pair returns `400 "Analysis already exists"`. In CI derive `BUILD_VERSION` from `git rev-parse --short HEAD` or a build number.
- Contract failure `Failed to match request path`: consumer and provider recorded the same `flow` name with different concrete paths. Align them (or move the variance into a body matcher).

## Test tree conventions

- No imports cross the consumer ↔ provider boundary in `tests/api/` and `tests/contract/`. Each leaf owns its own `setup.ts` and data maps. Treat them as if they live in separate repos.
- File-name globs drive which suite runs which file:
  - `tests/api/**/*.test.ts`
  - `tests/contract/consumer/**/*.contract.ts`
  - `tests/contract/provider/**/*.flow.ts`
  - `tests/integration/**/*.test.ts`
  - `tests/e2e/**/*.e2e.ts`
- Cleanup runs via `after()` from `node:test`, imported and registered at module top level of `setup.ts`.
