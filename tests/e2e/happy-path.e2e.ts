import { describe, it } from 'node:test';
import pactum from 'pactum';

const { e2e } = pactum;

describe('e2e / customer-places-and-cancels-order', () => {
  it('runs the journey with LIFO cleanup', async () => {
    const journey = e2e('customer places and cancels an order');

    await journey
      .step('seed a new product on the provider')
      .spec()
      .post('$M{hosts.provider}/api/products')
      .withJson({
        '@DATA:TEMPLATE@': 'Product:New',
        '@OVERRIDES@': { name: 'E2E Widget', price: 5, stock: 2 },
      })
      .expectStatus(201)
      .stores('productId', 'id')
      .clean()
      .patch('$M{hosts.provider}/api/products/$S{productId}/stock')
      .withJson({ delta: 2 })
      .expectStatus(200);

    await journey
      .step('customer places an order via consumer')
      .spec()
      .post('$M{hosts.consumer}/api/orders')
      .withJson({
        userId: '$M{users.alice.id}',
        productId: '$S{productId}',
        quantity: 1,
      })
      .expectStatus(201)
      .stores('orderId', 'id')
      .clean()
      .delete('$M{hosts.consumer}/api/orders/$S{orderId}')
      .expectStatus(204);

    await journey
      .step('order is retrievable')
      .spec()
      .get('$M{hosts.consumer}/api/orders/$S{orderId}')
      .expectStatus(200)
      .expectJsonMatch({ status: 'confirmed', quantity: 1 });

    await journey
      .step('provider stock reflects the order')
      .spec()
      .get('$M{hosts.provider}/api/products/$S{productId}')
      .expectStatus(200)
      .expectJsonMatch({ stock: 1 });

    await journey.cleanup();
  });
});
