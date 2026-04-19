import { describe, it } from 'node:test';
import pactum from 'pactum';

const { spec } = pactum;

describe('api / provider / products', () => {
  it('returns health', async () => {
    await spec()
      .get('$M{hosts.provider}/health')
      .expectStatus(200)
      .expectJsonMatch({ status: 'ok', service: 'provider' });
  });

  it('lists all products including the seeded ones', async () => {
    await spec()
      .get('$M{hosts.provider}/api/products')
      .expectStatus(200)
      .expectJsonLike([
        { id: 1, name: 'Keyboard' },
        { id: 2, name: 'Mouse' },
        { id: 3, name: 'Monitor' },
      ]);
  });

  it('gets a product by id', async () => {
    await spec()
      .get('$M{hosts.provider}/api/products/$M{products.keyboard.id}')
      .expectStatus(200)
      .expectJsonMatch({ name: '$M{products.keyboard.name}' });
  });

  it('returns 404 for an unknown product', async () => {
    await spec()
      .get('$M{hosts.provider}/api/products/999')
      .expectStatus(404);
  });

  it('creates a product from a data template', async () => {
    await spec()
      .post('$M{hosts.provider}/api/products')
      .withJson({
        '@DATA:TEMPLATE@': 'Product:New',
        '@OVERRIDES@': { name: 'Headset', price: 59.99 },
      })
      .expectStatus(201)
      .expectJsonMatch({ name: 'Headset', price: 59.99, stock: 10 });
  });

  it('rejects an invalid create payload', async () => {
    await spec()
      .post('$M{hosts.provider}/api/products')
      .withJson({ name: 'Broken' })
      .expectStatus(400);
  });

  it('adjusts stock with a positive delta', async () => {
    await spec()
      .patch('$M{hosts.provider}/api/products/$M{products.keyboard.id}/stock')
      .withJson({ delta: 1 })
      .expectStatus(200);
  });

  it('rejects a stock adjustment that would go negative', async () => {
    await spec()
      .patch('$M{hosts.provider}/api/products/$M{products.monitor.id}/stock')
      .withJson({ delta: -9999 })
      .expectStatus(409);
  });

  it('gets a user by id', async () => {
    await spec()
      .get('$M{hosts.provider}/api/users/$M{users.alice.id}')
      .expectStatus(200)
      .expectJsonMatch({ name: '$M{users.alice.name}' });
  });
});
