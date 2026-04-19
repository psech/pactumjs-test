import { describe, it } from 'node:test';
import pactum from 'pactum';

const { spec } = pactum;

describe('integration / order lifecycle (consumer -> provider)', () => {
  it('creates an order through the consumer and sees the effect on the provider', async () => {
    const initial = await spec()
      .name('read initial stock')
      .get('$M{hosts.provider}/api/products/$M{products.mouse.id}')
      .expectStatus(200)
      .returns('stock');
    const startingStock = Number(initial);

    const orderId = await spec()
      .name('create order via consumer')
      .post('$M{hosts.consumer}/api/orders')
      .withJson({
        userId: '$M{users.alice.id}',
        productId: '$M{products.mouse.id}',
        quantity: 2,
      })
      .expectStatus(201)
      .returns('id');

    await spec()
      .name('stock decreased by 2 on provider')
      .get('$M{hosts.provider}/api/products/$M{products.mouse.id}')
      .expectStatus(200)
      .expectJsonMatch({ stock: startingStock - 2 });

    await spec()
      .name('order is visible via consumer')
      .get(`$M{hosts.consumer}/api/orders/${orderId}`)
      .expectStatus(200)
      .expectJsonMatch({
        user: { id: '$M{users.alice.id}' },
        product: { id: '$M{products.mouse.id}' },
        quantity: 2,
        status: 'confirmed',
      });

    await spec()
      .name('order can be deleted via consumer')
      .delete(`$M{hosts.consumer}/api/orders/${orderId}`)
      .expectStatus(204);
  });
});
