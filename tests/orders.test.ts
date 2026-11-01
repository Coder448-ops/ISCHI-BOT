import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { dbGet, dbRun } from '../lib/server/db';
import { setupTestDatabase } from './helpers/database';
import { ApiError, changeOrderStatus, createOrder, listOrders } from '../lib/server/orders';
import { checkoutSchema, validName, validPhone } from '../lib/validation';
import { formatPhone, money, normalizePhone } from '../lib/format';
import { orderMessage } from '../lib/server/telegram';

const input = () => ({
  customerName: 'Ali Valiyev',
  phone: '+998 90 123 45 67',
  items: [{ productId: 'iphone-16-pro', quantity: 1 }],
  requestId: randomUUID(),
});
const count = async (table: string) =>
  Number((await dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n || 0);

let cleanup: () => Promise<void>;
before(async () => {
  cleanup = await setupTestDatabase();
});
beforeEach(async () => {
  await dbRun('DELETE FROM notification_outbox');
  await dbRun('DELETE FROM order_items');
  await dbRun('DELETE FROM orders');
  await dbRun('DELETE FROM admin_sessions');
});
after(async () => {
  await cleanup();
});

test('Uzbek names accept Latin, Cyrillic and apostrophes, reject incomplete or injected values', () => {
  for (const name of ['Ali Valiyev', 'G‘olibbek O‘tkirov', 'Али Валиев', 'Anna O’Connor-Smith'])
    assert.equal(validName(name), true, name);
  for (const name of [
    '',
    'Ali',
    '123456',
    '<script>Ali</script>',
    'Ali https://example.com',
    'a'.repeat(101),
  ])
    assert.equal(validName(name), false, name);
});

test('phone mask round-trips exactly nine Uzbek subscriber digits', () => {
  assert.equal(formatPhone('901234567'), '+998 90 123 45 67');
  assert.equal(formatPhone('+998 (90) 123-45-67'), '+998 90 123 45 67');
  assert.equal(normalizePhone('+998 90 123 45 67'), '+998901234567');
  assert.equal(validPhone('+998 90 123 45 67'), true);
  for (const value of [
    '+99890123456',
    '+9989012345678',
    '+7901234567',
    '901234567',
    '+99890ABC4567',
  ])
    assert.equal(validPhone(value), false);
});

test('UZS formatting uses readable groups', () => {
  assert.equal(money(15000000), '15 000 000 so‘m');
});

test('strict checkout rejects extra personal information, client prices and invalid products', () => {
  assert.equal(checkoutSchema.safeParse(input()).success, true);
  for (const change of [
    { email: 'a@example.com' },
    { password: 'test' },
    { items: [{ productId: 'iphone-16-pro', quantity: 1, price: 1 }] },
    { items: [{ productId: 'missing', quantity: 1 }] },
    { items: [{ productId: 'iphone-16-pro', quantity: 0 }] },
    { items: [{ productId: 'iphone-16-pro', quantity: 21 }] },
    {
      items: [
        { productId: 'iphone-16-pro', quantity: 1 },
        { productId: 'iphone-16-pro', quantity: 1 },
      ],
    },
    { items: [] },
  ])
    assert.equal(checkoutSchema.safeParse({ ...input(), ...change }).success, false);
});

test('order saves product snapshots and calculates the total on the server', async () => {
  const parsed = checkoutSchema.parse({
    ...input(),
    items: [
      { productId: 'iphone-16-pro', quantity: 2 },
      { productId: 'airpods-pro-2', quantity: 1 },
    ],
  });
  const { order, reused } = await createOrder(parsed);
  assert.equal(reused, false);
  assert.equal(order.total, 32900000);
  assert.equal(order.status, 'Yangi');
  assert.equal(order.phone, '+998901234567');
  assert.match(order.number, /^ISH-\d{8}-[A-F0-9]{8}$/);
  assert.match(order.id, /^[a-f0-9-]{36}$/);
  assert.equal(order.items.length, 2);
  assert.equal(await count('orders'), 1);
  assert.equal(await count('order_items'), 2);
  assert.equal(await count('notification_outbox'), 1);
});

test('repeated network submission is idempotent and creates no duplicate notification', async () => {
  const parsed = checkoutSchema.parse(input());
  const a = await createOrder(parsed);
  const b = await createOrder(parsed);
  assert.equal(a.order.id, b.order.id);
  assert.equal(b.reused, true);
  assert.equal(await count('orders'), 1);
  assert.equal(await count('notification_outbox'), 1);
  await assert.rejects(
    () => createOrder({ ...parsed, customerName: 'Olim Karimov' }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});

test('guests can place multiple orders with the same name and phone', async () => {
  const a = await createOrder(checkoutSchema.parse(input()));
  const b = await createOrder(checkoutSchema.parse(input()));
  assert.notEqual(a.order.id, b.order.id);
  assert.equal(await count('orders'), 2);
  assert.equal(await count('notification_outbox'), 2);
});

test('actual status changes enqueue one event; unchanged status does not', async () => {
  const { order } = await createOrder(checkoutSchema.parse(input()));
  const changed = await changeOrderStatus(order.id, 'Tasdiqlandi', 'Yangi');
  assert.equal(changed.changed, true);
  assert.equal(await count('notification_outbox'), 2);
  assert.equal((await changeOrderStatus(order.id, 'Tasdiqlandi')).changed, false);
  assert.equal(await count('notification_outbox'), 2);
  await changeOrderStatus(order.id, 'Tayyorlanmoqda');
  await changeOrderStatus(order.id, 'Bekor qilindi');
  assert.equal(await count('notification_outbox'), 4);
  await assert.rejects(
    () => changeOrderStatus(order.id, 'Yangi'),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});

test('concurrent stale admin updates and terminal transitions are rejected', async () => {
  const { order } = await createOrder(checkoutSchema.parse(input()));
  await changeOrderStatus(order.id, 'Tasdiqlandi');
  await assert.rejects(
    () => changeOrderStatus(order.id, 'Yetkazilmoqda', 'Yangi'),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
  await changeOrderStatus(order.id, 'Yetkazildi');
  await assert.rejects(
    () => changeOrderStatus(order.id, 'Bekor qilindi'),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});

test('admin search finds name, phone and order number, with literal wildcard escaping', async () => {
  const { order } = await createOrder(checkoutSchema.parse(input()));
  await createOrder(
    checkoutSchema.parse({ ...input(), customerName: 'Olim Karimov', phone: '+998931112233' }),
  );
  assert.equal((await listOrders({ q: 'Ali' })).total, 1);
  assert.equal((await listOrders({ q: '90123' })).total, 1);
  assert.equal((await listOrders({ q: order.number })).orders[0].id, order.id);
  assert.equal((await listOrders({ q: '%' })).total, 0);
  assert.equal((await listOrders({ status: 'Yangi' })).total, 2);
  assert.equal((await listOrders({ status: 'Yetkazildi' })).total, 0);
  assert.equal((await listOrders({ limit: 1 })).pages, 2);
});

test('Telegram uses natural Uzbek and actual order data, without JSON or technical metadata', async () => {
  const { order } = await createOrder(checkoutSchema.parse(input()));
  assert.equal(
    orderMessage(order, 'new'),
    '🛍 Yangi buyurtma!\n👤 Ism: Ali Valiyev\n📞 Telefon: +998901234567\n📦 Mahsulot: iPhone 16 Pro\n🔢 Soni: 1 ta\n💰 Jami: 15 000 000 so‘m',
  );
  const multi = (
    await createOrder(
      checkoutSchema.parse({
        ...input(),
        items: [
          { productId: 'iphone-16-pro', quantity: 1 },
          { productId: 'airpods-pro-2', quantity: 2 },
        ],
      }),
    )
  ).order;
  const text = orderMessage(multi, 'new');
  assert.match(text, /Mahsulotlar:/);
  assert.match(text, /AirPods Pro 2 — 2 ta/);
  assert.match(text, /20 800 000/);
  assert.ok(!text.includes(order.id));
  assert.ok(!text.includes('{'));
  assert.match(
    orderMessage({ ...order, status: 'Bekor qilindi' }, 'cancel'),
    /Buyurtma bekor qilindi/,
  );
  assert.match(
    orderMessage({ ...order, status: 'Tasdiqlandi' }, 'status'),
    /Buyurtma holati: Tasdiqlandi/,
  );
});
