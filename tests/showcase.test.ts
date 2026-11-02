import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { buildBootstrap } from '../lib/server/commerce';
import { seedStore } from '../lib/server/storage';

test('ko‘rgazma ma’lumoti seeds/ dan o‘qiladi va tekshiriladi', async () => {
  const data = await seedStore();
  assert.equal(data.categories.length, 22);
  assert.ok(data.products.length >= 22);
  assert.equal(data.settings.demoCatalog, true);
  // Seeds are demo content: no invented phone numbers or addresses are shipped.
  assert.deepEqual(data.settings.phones, []);
  assert.deepEqual(data.orders, []);
});

test('ko‘rgazma bootstrap buyurtmani o‘chirilgan deb belgilaydi', async () => {
  const data = await seedStore();
  const bootstrap = buildBootstrap(data, { readOnly: true });
  assert.equal(bootstrap.readOnly, true);
  assert.equal(bootstrap.demo, true);
  assert.equal(bootstrap.categories.length, 22);
  assert.ok(bootstrap.home.popular.length > 0);
  assert.ok(bootstrap.home.newest.length > 0);
});

test('oddiy bootstrap ko‘rgazma rejimida emas', async () => {
  const data = await seedStore();
  assert.equal(buildBootstrap(data).readOnly, false);
});

test('ko‘rgazma rejimida API buyurtmani qabul qilmaydi va admin yopiq', async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const { handleApi } = await import('../lib/server/api');
    const call = (path: string[], init: { method?: string; body?: string } = {}) =>
      handleApi(
        new NextRequest(`https://shop.example/api/${path.join('/')}`, {
          method: init.method || 'GET',
          body: init.body,
          headers: { 'content-type': 'application/json', origin: 'https://shop.example' },
        }) as never,
        { params: Promise.resolve({ path }) },
      );
    const health = await call(['health']);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).mode, 'showcase');
    const bootstrap = await call(['bootstrap']);
    assert.equal(bootstrap.status, 200);
    assert.equal((await bootstrap.json()).readOnly, true);
    const order = await call(['orders'], {
      method: 'POST',
      body: JSON.stringify({
        requestId: '44444444-4444-4444-8444-444444444444',
        customerName: 'Ali Valiyev',
        phone: '+998901234567',
        items: [{ productId: 'armatura-sample', quantity: 500 }],
        expectedTotal: 5900000,
      }),
    });
    assert.equal(order.status, 503);
    assert.equal((await order.json()).code, 'READ_ONLY_DEMO');
    const admin = await call(['admin', 'login'], {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'whatever-goes-here' }),
    });
    assert.equal(admin.status, 403);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
