import { describe, it } from 'node:test';
import pactum from 'pactum';

const { flow } = pactum;

describe('contract / provider / products', () => {
  it('flow: get user by id', async () => {
    await flow('get user by id')
      .get('$M{hosts.provider}/api/users/$M{users.alice.id}')
      .expectStatus(200);
  });

  it('flow: get product by id', async () => {
    await flow('get product by id')
      .get('$M{hosts.provider}/api/products/$M{products.mouse.id}')
      .expectStatus(200);
  });

  it('flow: decrement product stock', async () => {
    await flow('decrement product stock')
      .patch('$M{hosts.provider}/api/products/$M{products.mouse.id}/stock')
      .withJson({ delta: -1 })
      .expectStatus(200);
  });

  it('flow: get unknown user', async () => {
    await flow('get unknown user')
      .get('$M{hosts.provider}/api/users/999')
      .expectStatus(404);
  });
});
