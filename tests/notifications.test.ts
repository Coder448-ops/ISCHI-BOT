import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { getDb } from '../lib/server/db';
import { changeOrderStatus, createOrder } from '../lib/server/orders';
import {
  flushNotifications,
  notificationSummary,
  retryConfirmedFailures,
} from '../lib/server/notifications';
import { checkoutSchema } from '../lib/validation';
process.env.DATABASE_PATH = ':memory:';
const ok = async () =>
  new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
function addOrder() {
  return createOrder(
    checkoutSchema.parse({
      customerName: 'Ali Valiyev',
      phone: '+998901234567',
      items: [{ productId: 'iphone-16-pro', quantity: 1 }],
      requestId: randomUUID(),
    }),
  ).order;
}
beforeEach(() => {
  getDb().exec('DELETE FROM notification_outbox; DELETE FROM order_items; DELETE FROM orders;');
  process.env.TELEGRAM_BOT_TOKEN = 'test-server-token';
  process.env.TELEGRAM_CHAT_ID = '@Navroz0909';
});
afterEach(() => mock.restoreAll());
test('missing credentials retain orders and queued notifications without calling Telegram', async () => {
  process.env.TELEGRAM_BOT_TOKEN = '';
  const order = addOrder();
  const fetchMock = mock.method(globalThis, 'fetch', ok);
  await flushNotifications();
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(notificationSummary().pending, 1);
  assert.equal(
    (getDb().prepare('SELECT total FROM orders WHERE id = ?').get(order.id) as { total: number })
      .total,
    15000000,
  );
});
test('a new order is delivered once even when flushing repeatedly', async () => {
  addOrder();
  const fetchMock = mock.method(globalThis, 'fetch', ok);
  await Promise.all([flushNotifications(), flushNotifications()]);
  await flushNotifications();
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(notificationSummary().sent, 1);
  const request = fetchMock.mock.calls[0].arguments[1] as RequestInit;
  const body = JSON.parse(String(request.body));
  assert.equal(body.chat_id, '@Navroz0909');
  assert.match(body.text, /Yangi buyurtma/);
  assert.equal(body.parse_mode, undefined);
});
test('rate limit rejection is retried, then marked sent only once', async () => {
  addOrder();
  let calls = 0;
  mock.method(globalThis, 'fetch', async () =>
    ++calls === 1
      ? new Response(JSON.stringify({ ok: false, parameters: { retry_after: 1 } }), { status: 429 })
      : ok(),
  );
  await flushNotifications();
  assert.equal(notificationSummary().pending, 1);
  getDb().prepare('UPDATE notification_outbox SET next_attempt_at = 0').run();
  await flushNotifications();
  await flushNotifications();
  assert.equal(calls, 2);
  assert.equal(notificationSummary().sent, 1);
});
test('ambiguous timeout is held, not blindly resent; later events retain their sequence', async () => {
  const order = addOrder();
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('timeout');
  });
  await flushNotifications();
  changeOrderStatus(order.id, 'Tasdiqlandi');
  await flushNotifications();
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(notificationSummary().uncertain, 1);
  assert.equal(notificationSummary().pending, 1);
});
test('server errors are not assumed to be rejected', async () => {
  addOrder();
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('', { status: 502 }));
  await flushNotifications();
  await flushNotifications();
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(notificationSummary().uncertain, 1);
});
test('confirmed rejection can retry after configuration; sent events are never reset', async () => {
  addOrder();
  let calls = 0;
  mock.method(globalThis, 'fetch', async () =>
    ++calls === 1 ? new Response('', { status: 403 }) : ok(),
  );
  await flushNotifications();
  assert.equal(notificationSummary().failed, 1);
  assert.equal(retryConfirmedFailures(), 1);
  await flushNotifications();
  assert.equal(notificationSummary().sent, 1);
  assert.equal(retryConfirmedFailures(), 0);
  await flushNotifications();
  assert.equal(calls, 2);
});
test('a stale in-flight notification is held for review, not automatically resent', async () => {
  addOrder();
  getDb()
    .prepare("UPDATE notification_outbox SET state = 'sending', locked_at = ?")
    .run(Date.now() - 121000);
  const fetchMock = mock.method(globalThis, 'fetch', ok);
  await flushNotifications();
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(notificationSummary().uncertain, 1);
});
