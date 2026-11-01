import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { temporaryStore, input, resetProduct } from './helpers';
import { createOrder, changeOrderStatus } from '../lib/server/commerce';
import { flushNotifications } from '../lib/server/notifications';
import { orderMessage } from '../lib/server/telegram';
import { readStore, withStore } from '../lib/server/storage';
let store: Awaited<ReturnType<typeof temporaryStore>>;
const originalFetch = globalThis.fetch;
before(async () => {
  store = await temporaryStore();
  process.env.TELEGRAM_BOT_TOKEN = 'test-only-token';
  process.env.TELEGRAM_CHAT_ID = '@Navroz0909';
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.TELEGRAM_BOT_TOKEN;
  await store.cleanup();
});
test('new, status and cancellation messages are simple Uzbek', async () => {
  const p = (await readStore('products'))[0];
  await resetProduct(p.id);
  const { order: publicOrder } = await createOrder(await input(p.id));
  const order = (await readStore('orders')).find((x) => x.id === publicOrder.id)!;
  for (const kind of ['new', 'status', 'cancel'] as const) {
    const text = orderMessage({ ...order, status: 'Tasdiqlandi' }, kind);
    assert.match(text, /Telefon|Ism/);
    assert.ok(!text.includes('JSON'));
    assert.ok(!text.includes('requestId'));
    assert.ok(text.includes('so‘m'));
  }
  assert.match(orderMessage(order, 'new'), /^🛒 Yangi buyurtma!/);
});
test('outbox delivers once across repeated flushes', async () => {
  const p = (await readStore('products'))[1];
  await resetProduct(p.id);
  const { order } = await createOrder(await input(p.id));
  let sends = 0;
  globalThis.fetch = async (_url, init) => {
    if (String(init?.body).includes('Shveller 12P')) sends++;
    return Response.json({ ok: true, result: { message_id: 1 } });
  };
  await flushNotifications();
  await flushNotifications();
  assert.equal(sends, 1);
  assert.equal(
    (await readStore('notifications')).find((x) => x.orderId === order.id)?.state,
    'sent',
  );
});
test('ambiguous network response is held for manual verification, never blindly resent', async () => {
  const p = (await readStore('products'))[2];
  await resetProduct(p.id);
  const { order } = await createOrder(await input(p.id));
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    throw new Error('network lost after request');
  };
  await flushNotifications();
  await flushNotifications();
  assert.equal(sends, 1);
  assert.equal(
    (await readStore('notifications')).find((x) => x.orderId === order.id)?.state,
    'uncertain',
  );
});
test('429 schedules retry without duplicating an already sent event', async () => {
  const p = (await readStore('products'))[3];
  await resetProduct(p.id);
  const { order } = await createOrder(await input(p.id));
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    return sends === 1
      ? Response.json({ ok: false, parameters: { retry_after: 60 } }, { status: 429 })
      : Response.json({ ok: true, result: { message_id: 2 } });
  };
  await flushNotifications();
  let event = (await readStore('notifications')).find((x) => x.orderId === order.id);
  assert.equal(event?.state, 'pending');
  assert.ok(event!.nextAttemptAt > Date.now());
  await withStore(
    (data) => {
      data.notifications.find((x) => x.id === event!.id)!.nextAttemptAt = 0;
    },
    ['notifications'],
  );
  await flushNotifications();
  await flushNotifications();
  assert.equal(sends, 2);
});
test('crash while sending becomes uncertain on restart flush', async () => {
  const p = (await readStore('products'))[4];
  await resetProduct(p.id);
  const { order } = await createOrder(await input(p.id));
  await withStore(
    (data) => {
      const n = data.notifications.find((x) => x.orderId === order.id)!;
      n.state = 'sending';
      n.lockedAt = Date.now() - 180000;
    },
    ['notifications'],
  );
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    return Response.json({ ok: true });
  };
  await flushNotifications();
  assert.equal(sends, 0);
  assert.equal(
    (await readStore('notifications')).find((x) => x.orderId === order.id)?.state,
    'uncertain',
  );
});
