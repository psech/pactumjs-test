import { describe, it, beforeEach, afterEach } from 'node:test';
import { createRequire } from 'node:module';
import pactum from 'pactum';

const requireCjs = createRequire(import.meta.url);
const { like } = requireCjs('pactum-matchers');

const { spec, mock } = pactum;

describe('contract / consumer / orders', () => {
  beforeEach(() => mock.clearInteractions());
  afterEach(() => mock.clearInteractions());

  it('assumes provider returns a user, a product, and accepts a stock decrement', async () => {
    mock.addInteraction({
      provider: 'provider',
      flow: 'get user by id',
      request: { method: 'GET', path: '/api/users/1' },
      response: {
        status: 200,
        body: like({ id: 1, name: 'Alice', email: 'alice@example.com' }),
      },
    });
    mock.addInteraction({
      provider: 'provider',
      flow: 'get product by id',
      request: { method: 'GET', path: '/api/products/2' },
      response: {
        status: 200,
        body: like({ id: 2, name: 'Mouse', price: 19.99, stock: 30 }),
      },
    });
    mock.addInteraction({
      provider: 'provider',
      flow: 'decrement product stock',
      request: {
        method: 'PATCH',
        path: '/api/products/2/stock',
        body: { delta: like(-1) },
      },
      response: {
        status: 200,
        body: like({ id: 2, name: 'Mouse', price: 19.99, stock: 29 }),
      },
    });

    await spec()
      .post('$M{hosts.consumer}/api/orders')
      .withJson({ userId: 1, productId: 2, quantity: 1 })
      .expectStatus(201);
  });

  it('assumes provider returns 404 for an unknown user', async () => {
    mock.addInteraction({
      provider: 'provider',
      flow: 'get unknown user',
      request: { method: 'GET', path: '/api/users/999' },
      response: {
        status: 404,
        body: like({ error: 'User not found' }),
      },
    });

    await spec()
      .post('$M{hosts.consumer}/api/orders')
      .withJson({ userId: 999, productId: 2, quantity: 1 })
      .expectStatus(404);
  });
});
