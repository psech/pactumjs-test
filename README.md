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

## Prerequisites

- Node.js 18+ (the consumer uses global `fetch`)
- npm

## Install

```bash
npm install
```

## Run

Start both services together:

```bash
npm start
```

Or individually in separate terminals:

```bash
npm run start:provider   # http://localhost:3001
npm run start:consumer   # http://localhost:3002
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

## Quick smoke test

```bash
# list products (provider)
curl http://localhost:3001/api/products

# create an order (consumer → provider)
curl -X POST http://localhost:3002/api/orders \
  -H 'content-type: application/json' \
  -d '{"userId":1,"productId":2,"quantity":3}'
```

## Optional: PactumJS Flows UI

[docker-compose.yml](docker-compose.yml) runs the PactumJS Flows dashboard (MongoDB-backed) for visualising test flows:

```bash
docker compose up
# open http://localhost:8080
```

## Project layout

```
src/
  provider/index.js   # products + users API
  consumer/index.js   # orders API, calls provider
tests/                # PactumJS tests (to be added)
docker-compose.yml    # PactumJS Flows + MongoDB
```

## Status

Early setup. Tests will be added under [tests/](tests/) to cover the four testing styles from the PactumJS guides:

- [API testing](https://pactumjs.github.io/guides/api-testing.html)
- [Integration testing](https://pactumjs.github.io/guides/integration-testing.html)
- [E2E testing](https://pactumjs.github.io/guides/e2e-testing.html)
- [Contract testing](https://pactumjs.github.io/guides/contract-testing.html)
