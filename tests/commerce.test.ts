import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { temporaryStore, input, resetProduct } from './helpers';
import {
  calculateQuote,
  changeOrderStatus,
  createOrder,
  getReceiptOrder,
  queryCatalog,
} from '../lib/server/commerce';
import { readStore, withStore } from '../lib/server/storage';
let store: Awaited<ReturnType<typeof temporaryStore>>;
before(async () => {
  store = await temporaryStore();
});
after(async () => {
  await store.cleanup();
});
test('server prices every unit and ignores arbitrary client price fields', async () => {
  const quote = await withStore((data) => {
    for (const [i, unit] of (['kg', 'ton', 'm', 'm²', 'dona', 'qop'] as const).entries()) {
      data.products[i].unit = unit;
      data.products[i].price = 10000;
      data.products[i].discountPrice = null;
      data.products[i].minOrder = 1;
      data.products[i].step = 1;
      data.products[i].stock = 100;
    }
    return calculateQuote(
      data,
      data.products.slice(0, 6).map((p) => ({ productId: p.id, quantity: 2 })),
    );
  });
  assert.equal(quote.total, 120000);
  assert.deepEqual(
    quote.items.map((x) => x.unit),
    ['kg', 'ton', 'm', 'm²', 'dona', 'qop'],
  );
  const parsed = require('../lib/server/schemas').checkoutSchema.safeParse({
    customerName: 'Test Mijoz',
    phone: '998901234567',
    items: [{ productId: 'rebar-sample', quantity: 1, price: 1 }],
    requestId: randomUUID(),
    expectedTotal: 1,
  });
  assert.equal(parsed.success, false);
});
test('minimum, step, stock and disabled product checks', async () => {
  const p = (await readStore('products'))[0];
  await resetProduct(p.id, 10);
  await withStore(
    (data) => {
      const x = data.products[0];
      x.minOrder = 2;
      x.step = 2;
    },
    ['products'],
  );
  for (const quantity of [1, 3, 12])
    await assert.rejects(createOrder(await input(p.id, quantity, 1)));
  await withStore(
    (data) => {
      data.products[0].enabled = false;
    },
    ['products'],
  );
  await assert.rejects(createOrder(await input(p.id, 2, 1)));
  await withStore(
    (data) => {
      data.products[0].enabled = true;
      data.products[0].minOrder = 1;
      data.products[0].step = 1;
    },
    ['products'],
  );
});
test('simultaneous duplicate request creates one order and one notification', async () => {
  const p = (await readStore('products'))[1];
  await resetProduct(p.id, 100);
  const orderInput = await input(p.id, 2, Math.round((p.discountPrice ?? p.price) * 2));
  const [a, b] = await Promise.all([createOrder(orderInput), createOrder(orderInput)]);
  assert.equal(a.order.id, b.order.id);
  assert.equal((await readStore('orders')).filter((o) => o.id === a.order.id).length, 1);
  assert.equal(
    (await readStore('notifications')).filter((n) => n.orderId === a.order.id).length,
    1,
  );
  assert.equal((await readStore('products')).find((x) => x.id === p.id)?.stock, 98);
});
test('same request with changed payload is rejected', async () => {
  const p = (await readStore('products'))[2];
  await resetProduct(p.id);
  const value = await input(p.id);
  const first = await createOrder(value);
  await assert.rejects(
    createOrder({ ...value, expectedTotal: value.expectedTotal + 1 }),
    /o‘zgargan/,
  );
  assert.ok(first.order.id);
});
test('different requests from same guest are allowed', async () => {
  const p = (await readStore('products'))[3];
  await resetProduct(p.id);
  const a = await input(p.id),
    b = await input(p.id);
  const first = await createOrder(a),
    second = await createOrder(b);
  assert.notEqual(first.order.id, second.order.id);
});
test('overselling is prevented under concurrency', async () => {
  const p = (await readStore('products'))[4];
  await resetProduct(p.id, 1);
  const values = await Promise.all(Array.from({ length: 8 }, () => input(p.id, 1)));
  const results = await Promise.allSettled(values.map(createOrder));
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await readStore('products')).find((x) => x.id === p.id)?.stock, 0);
});
test('coupon usage is atomic and cancellation restores stock and usage once', async () => {
  const p = (await readStore('products'))[5];
  await resetProduct(p.id, 100);
  await withStore(
    (data) => {
      data.coupons = [
        {
          id: 'test',
          code: 'TEST10',
          type: 'percent',
          value: 10,
          minSubtotal: 0,
          maxDiscount: null,
          usageLimit: 1,
          usedCount: 0,
          expiresAt: null,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ];
    },
    ['coupons'],
  );
  const subtotal = Math.round((p.discountPrice ?? p.price) * 2);
  const value = await input(p.id, 2, subtotal - Math.round(subtotal * 0.1), 'TEST10');
  const created = await createOrder(value);
  assert.equal(created.order.discount, Math.round((p.discountPrice ?? p.price) * 2 * 0.1));
  await assert.rejects(
    createOrder(await input(p.id, 1, p.discountPrice ?? p.price, 'TEST10')),
    /Kupon/,
  );
  await changeOrderStatus(created.order.id, 'Bekor qilindi');
  await changeOrderStatus(created.order.id, 'Bekor qilindi');
  assert.equal((await readStore('products')).find((x) => x.id === p.id)?.stock, 100);
  assert.equal((await readStore('coupons'))[0].usedCount, 0);
  await assert.rejects(changeOrderStatus(created.order.id, 'Tasdiqlandi'), /Yakunlangan/);
});
test('stale displayed total is rejected', async () => {
  const p = (await readStore('products'))[6];
  await resetProduct(p.id);
  await assert.rejects(createOrder(await input(p.id, 1, (p.discountPrice ?? p.price) + 1)), /Narx/);
});
test('receipt requires secret token and omits idempotency metadata', async () => {
  const p = (await readStore('products'))[7];
  await resetProduct(p.id);
  const created = await createOrder(await input(p.id));
  const receipt = await getReceiptOrder(created.order.id, created.receiptToken);
  assert.equal(receipt.id, created.order.id);
  assert.ok(!('fingerprint' in receipt));
  assert.ok(!('requestId' in receipt));
  await assert.rejects(getReceiptOrder(created.order.id, 'A'.repeat(43)), /topilmadi/);
});
test('catalog search, unit model, filters, sort and pagination', async () => {
  const result = await withStore((data) =>
    queryCatalog(data.products, data.categories, data.orders, { q: 'DEMO-0001', limit: 1 }),
  );
  assert.equal(result.total, 1);
  const all = await withStore((data) =>
    queryCatalog(data.products, data.categories, data.orders, {
      sort: 'price-asc',
      page: 2,
      limit: 5,
    }),
  );
  assert.equal(all.products.length, 5);
  assert.equal(all.page, 2);
  assert.ok(all.products.every((p) => p.unit));
});
