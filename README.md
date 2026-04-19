# pactumjs-test

A learning sandbox for [PactumJS](https://pactumjs.github.io/) — API, integration, E2E, and contract testing. The repo hosts two small Express services that talk to each other so we have something realistic to test.

## Architecture

```
┌──────────────┐   HTTP    ┌──────────────┐
│   consumer   │ ────────▶ │   provider   │
│  (orders)    │           │ (products/   │
│  :3002       │           │  users)      │
└──────────────┘           │  :3001       │
                           └──────────────┘
```

- **provider** ([src/provider/index.js](src/provider/index.js)) — owns products and users. In-memory data.
- **consumer** ([src/consumer/index.js](src/consumer/index.js)) — owns orders. To create an order it calls the provider to look up the user, look up the product, and decrement stock.
- Both services emit structured request/response logs and the consumer logs outbound provider calls.

## Prerequisites

- Node.js **24.15** (see [.nvmrc](.nvmrc)) — tests are written in TypeScript and rely on Node's built-in type stripping, so no transpiler is needed.
- npm
- Docker (only for contract publishing via the Flows server)

## Install

```bash
nvm use
npm install
```

## Run the services

```bash
npm start                 # both services with concurrently
# or
npm run start:provider    # http://localhost:3001
npm run start:consumer    # http://localhost:3002
```

Environment overrides:

- `PROVIDER_PORT` (default `3001`)
- `CONSUMER_PORT` (default `3002`)
- `PROVIDER_URL` on the consumer (default `http://localhost:3001`)

## Endpoints

### Provider — `:3001`

| Method | Path                          | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/health`                     | Health check                         |
| GET    | `/api/products`               | List products                        |
| GET    | `/api/products/:id`           | Get product by id                    |
| POST   | `/api/products`               | Create product `{name, price, stock}`|
| PATCH  | `/api/products/:id/stock`     | Adjust stock `{delta}` (409 if < 0)  |
| GET    | `/api/users/:id`              | Get user by id                       |

### Consumer — `:3002`

| Method | Path                | Description                                      |
| ------ | ------------------- | ------------------------------------------------ |
| GET    | `/health`           | Health check                                     |
| GET    | `/api/orders`       | List orders                                      |
| GET    | `/api/orders/:id`   | Get order by id                                  |
| POST   | `/api/orders`       | Create order `{userId, productId, quantity}`     |
| DELETE | `/api/orders/:id`   | Delete order                                     |

A handful of ready-to-fire requests lives in [src/requests.http](src/requests.http) (works with the VS Code REST Client).

## Tests

The suite is split into four independent layers matching the test pyramid. Consumer and provider trees are kept **convention-separate** (no cross-imports) so either could lift into its own repo unchanged.

```
tests/
  package.json              # { "type": "module" } — scopes ESM to tests/
  api/
    provider/               # hits provider directly, no mocks
    consumer/               # boots pactum.mock + consumer in-process
  contract/
    provider/               # pactum flow() → publishes actual behaviour
    consumer/               # interactions → publishes assumed behaviour
  integration/              # chained calls across both services
  e2e/                      # e2e()/step()/clean() user journeys
```

Each suite owns its own `setup.ts` and is gated by a dedicated npm script.

### Scripts → pipeline stages

| Script                       | What it does                                                                                                                  | Stage in the pipeline              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `npm run test:api:provider`  | Boots the provider in-process on `:3001` (next free port if taken); no external service needed                                | **1a** API (parallel)              |
| `npm run test:api:consumer`  | Boots `pactum.mock` on `:3101` and the consumer on `:3102` in-process (next free port each); no external service needed       | **1b** API (parallel)              |
| `npm run test:contract:consumer` | In-process mock + consumer like api:consumer; publishes assumed interactions to the Flows server when `FLOW_SERVER_URL` set  | **2** Contract — consumer          |
| `npm run test:contract:provider` | Boots provider in-process and records `flow()`-wrapped specs; publishes actual flows when `FLOW_SERVER_URL` set             | **3** Contract — provider          |
| `npm run test:integration`   | Expects both services running; exercises multi-step chains                                                                    | **5** Integration (post-deploy)    |
| `npm run test:e2e`           | Expects both services running; user journey with LIFO cleanup                                                                 | **6** E2E (post-deploy)            |

All four api/contract suites are **hermetic** — they boot their own service instances from `src/` via [get-port](https://www.npmjs.com/package/get-port) (preferred port, or the next free one if busy). The assigned port is logged at startup, e.g. `[api:consumer] consumer listening on :3102`. Integration and e2e suites are the only ones that require externally-running services (they target a real deployed environment).

### Reports

Every suite writes artefacts to `reports/` (created automatically, git-ignored).

| File                                   | Producer                    | Suites                                            |
| -------------------------------------- | --------------------------- | ------------------------------------------------- |
| `<suite>.junit.xml`                    | Node's built-in junit reporter | all six                                        |
| `<suite>.pactum.json`                  | `pactum-json-reporter`      | `contract:consumer`, `contract:provider`, `e2e`   |

The JUnit XML is consumable by Jenkins' `junit` step for trend graphs and per-test drilldown. The Pactum JSON captures full request/response payloads for each spec (useful for diagnosing failures in suites where post-mortem debugging is hardest). TAP output also streams to stdout via the `spec` reporter so console runs stay readable.

### TypeScript without transpilers

All tests are plain `.ts` files. Node 24's built-in type stripping runs them directly — no `ts-node`, `tsx`, or `tsc` build step. Only type-erasable syntax is allowed (no `enum`, `namespace`, parameter properties, or legacy decorators); the root [tsconfig.json](tsconfig.json) sets `erasableSyntaxOnly: true` so the editor/type-checker rejects anything Node can't handle.

`tests/package.json` marks the test tree as ESM so we can use `import` syntax without switching the root package to modules (keeps `src/` as CommonJS).

### Data management

Every setup file registers [data maps and templates](https://pactumjs.github.io/guides/data-management.html) via `stash.addDataMap` / `stash.addDataTemplate`. Tests then reference them with `$M{...}` (map lookups), `$S{...}` (stored values), and `@DATA:TEMPLATE@` + `@OVERRIDES@` in request bodies. This keeps host URLs, seed users/products, and request skeletons out of test bodies.

### Mocking

- **api:consumer** — the real provider is **off**. `setup.ts` starts `pactum.mock` on `:3101`, imports the consumer Express app, and starts it on `:3102` pointed at the mock. Tests register interactions per-case with `mock.addInteraction(...)` and clear them in `beforeEach`/`afterEach`.
- **api:provider** — no mocks (the provider has no outbound calls); the provider is booted in-process for the same hermetic-run reason as api:consumer.
- **contract** — no counterpart runs; each side publishes its half of the contract independently.
- **integration / e2e** — nothing internal is mocked.

### Matchers in contract tests

The consumer side uses [pactum-matchers](https://pactumjs.github.io/guides/matching.html) to keep assumed interactions from over-specifying. `like(shape)` on response bodies lets provider field values drift (different stock counts, timestamps, etc.) without breaking the contract. Matchers work inside **request body**, **query params**, **headers**, and **response body**, but **not** in paths — Pactum's mock must route inbound requests by literal path, so variable path segments should be kept concrete and aligned on both sides.

## Contract publishing via the Flows server

[docker-compose.yml](docker-compose.yml) runs the PactumJS Flows dashboard (MongoDB-backed).

```bash
npm run flow-server:up      # starts flows + mongo (detached)
# open http://localhost:8080
npm run flow-server:down
```

To publish contracts, set the env vars expected by [pactum-flow-plugin](https://github.com/pactumjs/pactum-flow-plugin):

```bash
FLOW_SERVER_URL=http://localhost:8080 BUILD_VERSION=1.0.0 npm run test:contract:consumer
FLOW_SERVER_URL=http://localhost:8080 BUILD_VERSION=1.0.0 npm run test:contract:provider
```

Env vars used:

| Variable           | Default            | Purpose                                                          |
| ------------------ | ------------------ | ---------------------------------------------------------------- |
| `FLOW_SERVER_URL`  | (unset)            | Turns publishing on when set; plugin posts to this URL           |
| `BUILD_VERSION`    | `local`            | Unique id for this analysis — use a git sha or build number in CI|
| `FLOW_USERNAME`    | `admin`            | Login for the Flows captain API                                  |
| `FLOW_PASSWORD`    | `admin`            | Login for the Flows captain API                                  |

The plugin handles the admin login itself (`POST /api/flow/captain/v1/session` with Basic auth) — you just give it credentials.

Without `FLOW_SERVER_URL`, the contract suites still run the specs — they just skip the publish step (`pf.config.publish = false`).

**Analysis uniqueness**: `projectId + BUILD_VERSION` identifies an analysis. Re-publishing the same pair returns `400 "Analysis already exists"`. In CI, derive `BUILD_VERSION` from `git rev-parse --short HEAD` (or `$BUILD_NUMBER`) so every build gets a fresh, traceable version.

## Jenkins pipeline target

```
1. Parallel
   1a. test:api:provider
   1b. test:api:consumer       (provider mocked)
2. test:contract:consumer      (publish assumed behaviour)
3. test:contract:provider      (publish actual behaviour)
4. deploy
5. test:integration            (consumer + provider deployed)
6. test:e2e                    (consumer + provider deployed)
```

Each numbered stage maps 1:1 to a script above.

## Project layout

```
src/
  provider/index.js       # products + users API
  consumer/index.js       # orders API, calls provider
  requests.http           # sample requests for REST Client
tests/                    # see Tests section above
docker-compose.yml        # PactumJS Flows + MongoDB
tsconfig.json             # noEmit, erasableSyntaxOnly, strict
.nvmrc                    # 24.15
```

## Notes on PactumJS's contract model

PactumJS is **not** classic consumer-driven Pact. It's **bi-directional**:

- The consumer publishes **assumed** interactions.
- The provider publishes **actual** flows (recorded by `flow()` wrapping real specs).
- The Flows server compares both and produces a compatibility matrix.

Neither side "verifies the other's contract" at test time — both publish independently, and the server does the comparison asynchronously. This means the two contract suites can run in parallel; the sequencing in the Jenkins flow above is convention, not a requirement.

### Matching pitfalls when the Flow Server reports `compatibility failures`

- The consumer's example path must be a concrete path that also occurs in the provider's recorded flow. Path matchers (regex) aren't honoured by the mock, so variable segments have to stay literal and aligned on both sides (we point both sides at the same `products.mouse.id`, for example).
- Body matchers (`like`, `eachLike`, `regex`, `email`, `gt`...) are the right way to absorb value drift. Use them on request bodies and response bodies rather than pinning exact values.
- Mismatches in `flow` names mean the server has nothing to compare against — keep `flow` names identical on both sides.
