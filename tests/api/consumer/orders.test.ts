import { describe, it, beforeEach, afterEach } from 'node:test';
import pactum from 'pactum';

const { spec, mock } = pactum;

describe('api / consumer / orders', () => {
  beforeEach(() => mock.clearInteractions());
  afterEach(() => mock.clearInteractions());

  it('returns health without talking to provider', async () => {
    await spec()
      .get('$M{hosts.consumer}/health')
      .expectStatus(200)
      .expectJsonMatch({ status: 'ok', service: 'consumer' });
  });

  it('creates an order when provider returns user, product, and accepts stock update', async () => {
    mock.addInteraction({
      strict: true,
      request: { method: 'GET', path: '/api/users/$M{users.alice.id}' },
      response: { status: 200, body: '$M{users.alice}' },
    });
    mock.addInteraction({
      strict: true,
      request: { method: 'GET', path: '/api/products/$M{products.mouse.id}' },
      response: { status: 200, body: '$M{products.mouse}' },
    });
    mock.addInteraction({
      strict: true,
      request: {
        method: 'PATCH',
        path: '/api/products/$M{products.mouse.id}/stock',
        body: { delta: -1 },
      },
      response: { status: 200, body: '$M{products.mouse}' },
    });

    await spec()
      .post('$M{hosts.consumer}/api/orders')
      .withJson({ '@DATA:TEMPLATE@': 'Order:New' })
      .expectStatus(201)
      .expectJsonMatch({
        user: { id: '$M{users.alice.id}', name: '$M{users.alice.name}' },
        product: { id: '$M{products.mouse.id}', name: '$M{products.mouse.name}' },
        quantity: 1,
        status: 'confirmed',
      });
  });

  it('returns 404 when provider reports user not found', async () => {
    mock.addInteraction({
      request: { method: 'GET', path: '/api/users/999' },
      response: { status: 404, body: { error: 'User not found' } },
    });

    await spec()
      .post('$M{hosts.consumer}/api/orders')
      .withJson({
        '@DATA:TEMPLATE@': 'Order:New',
        '@OVERRIDES@': { userId: 999 },
      })
      .expectStatus(404);
  });

  it('returns 409 when provider rejects stock delta', async () => {
    mock.addInteraction({
      request: { method: 'GET', path: '/api/users/$M{users.alice.id}' },
      response: { status: 200, body: '$M{users.alice}' },
    });
    mock.addInteraction({
      request: { method: 'GET', path: '/api/products/$M{products.mouse.id}' },
      response: { status: 200, body: '$M{products.mouse}' },
    });
    mock.addInteraction({
      request: {
        method: 'PATCH',
        path: '/api/products/$M{products.mouse.id}/stock',
        body: { delta: -9999 },
      },
      response: { status: 409, body: { error: 'Insufficient stock' } },
    });

    await spec()
      .post('$M{hosts.consumer}/api/orders')
      .withJson({
        '@DATA:TEMPLATE@': 'Order:New',
        '@OVERRIDES@': { quantity: 9999 },
      })
      .expectStatus(409);
  });

  it('rejects an incomplete payload without calling provider', async () => {
    await spec()
      .post('$M{hosts.consumer}/api/orders')
      .withJson({ userId: 1 })
      .expectStatus(400);
  });
});
