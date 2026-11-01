import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { beforeEach, test } from 'node:test';
import { getDb } from '../lib/server/db';
import { ApiError, changeOrderStatus, createOrder, listOrders } from '../lib/server/orders';
import { checkoutSchema, validName, validPhone } from '../lib/validation';
import { formatPhone, money, normalizePhone } from '../lib/format';
import { orderMessage } from '../lib/server/telegram';

process.env.DATABASE_PATH = ':memory:';
const input = () => ({
  customerName: 'Ali Valiyev',
  phone: '+998 90 123 45 67',
  items: [{ productId: 'iphone-16-pro', quantity: 1 }],
  requestId: randomUUID(),
});
const count = (table: string) =>
  (getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
beforeEach(() => {
  getDb().exec(
    'DELETE FROM notification_outbox; DELETE FROM order_items; DELETE FROM orders; DELETE FROM admin_sessions;',
  );
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
test('order saves product snapshots and calculates the total on the server', () => {
  const parsed = checkoutSchema.parse({
    ...input(),
    items: [
      { productId: 'iphone-16-pro', quantity: 2 },
      { productId: 'airpods-pro-2', quantity: 1 },
    ],
  });
  const { order, reused } = createOrder(parsed);
  assert.equal(reused, false);
  assert.equal(order.total, 32900000);
  assert.equal(order.status, 'Yangi');
  assert.equal(order.phone, '+998901234567');
  assert.match(order.number, /^ISH-\d{8}-[A-F0-9]{8}$/);
  assert.match(order.id, /^[a-f0-9-]{36}$/);
  assert.equal(order.items.length, 2);
  assert.equal(count('orders'), 1);
  assert.equal(count('order_items'), 2);
  assert.equal(count('notification_outbox'), 1);
});
test('repeated network submission is idempotent and creates no duplicate notification', () => {
  const parsed = checkoutSchema.parse(input());
  const a = createOrder(parsed),
    b = createOrder(parsed);
  assert.equal(a.order.id, b.order.id);
  assert.equal(b.reused, true);
  assert.equal(count('orders'), 1);
  assert.equal(count('notification_outbox'), 1);
  assert.throws(
    () => createOrder({ ...parsed, customerName: 'Olim Karimov' }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});
test('guests can place multiple orders with the same name and phone', () => {
  const a = createOrder(checkoutSchema.parse(input())),
    b = createOrder(checkoutSchema.parse(input()));
  assert.notEqual(a.order.id, b.order.id);
  assert.equal(count('orders'), 2);
  assert.equal(count('notification_outbox'), 2);
});
test('actual status changes enqueue one event; unchanged status does not', () => {
  const { order } = createOrder(checkoutSchema.parse(input()));
  const changed = changeOrderStatus(order.id, 'Tasdiqlandi', 'Yangi');
  assert.equal(changed.changed, true);
  assert.equal(count('notification_outbox'), 2);
  assert.equal(changeOrderStatus(order.id, 'Tasdiqlandi').changed, false);
  assert.equal(count('notification_outbox'), 2);
  changeOrderStatus(order.id, 'Tayyorlanmoqda');
  changeOrderStatus(order.id, 'Bekor qilindi');
  assert.equal(count('notification_outbox'), 4);
  assert.throws(
    () => changeOrderStatus(order.id, 'Yangi'),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});
test('concurrent stale admin updates and terminal transitions are rejected', () => {
  const { order } = createOrder(checkoutSchema.parse(input()));
  changeOrderStatus(order.id, 'Tasdiqlandi');
  assert.throws(
    () => changeOrderStatus(order.id, 'Yetkazilmoqda', 'Yangi'),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
  changeOrderStatus(order.id, 'Yetkazildi');
  assert.throws(
    () => changeOrderStatus(order.id, 'Bekor qilindi'),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});
test('admin search finds name, phone and order number, with literal wildcard escaping', () => {
  const { order } = createOrder(checkoutSchema.parse(input()));
  createOrder(
    checkoutSchema.parse({ ...input(), customerName: 'Olim Karimov', phone: '+998931112233' }),
  );
  assert.equal(listOrders({ q: 'Ali' }).total, 1);
  assert.equal(listOrders({ q: '90123' }).total, 1);
  assert.equal(listOrders({ q: order.number }).orders[0].id, order.id);
  assert.equal(listOrders({ q: '%' }).total, 0);
  assert.equal(listOrders({ status: 'Yangi' }).total, 2);
  assert.equal(listOrders({ status: 'Yetkazildi' }).total, 0);
  assert.equal(listOrders({ limit: 1 }).pages, 2);
});
test('Telegram uses natural Uzbek and actual order data, without JSON or technical metadata', () => {
  const { order } = createOrder(checkoutSchema.parse(input()));
  assert.equal(
    orderMessage(order, 'new'),
    '🛍 Yangi buyurtma!\n👤 Ism: Ali Valiyev\n📞 Telefon: +998901234567\n📦 Mahsulot: iPhone 16 Pro\n🔢 Soni: 1 ta\n💰 Jami: 15 000 000 so‘m',
  );
  const multi = createOrder(
    checkoutSchema.parse({
      ...input(),
      items: [
        { productId: 'iphone-16-pro', quantity: 1 },
        { productId: 'airpods-pro-2', quantity: 2 },
      ],
    }),
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
