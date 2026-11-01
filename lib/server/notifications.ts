import { randomUUID } from 'node:crypto';
import type { NotificationEvent, Order } from '../types';
import { withStore, readStore } from './storage';
import { orderMessage, sendOrderMessage, telegramConfig } from './telegram';
export function newEvent(order: Order, kind: NotificationEvent['kind']): NotificationEvent {
  return {
    id: kind === 'new' ? `new:${order.id}` : `status:${order.id}:${randomUUID()}`,
    orderId: order.id,
    kind,
    message: orderMessage(order, kind),
    state: 'pending',
    attempts: 0,
    nextAttemptAt: Date.now(),
    lockedAt: null,
    createdAt: Date.now(),
    deliveredAt: null,
    error: null,
  };
}
const globalWorker = globalThis as unknown as {
  ischiNotificationFlush?: Promise<void>;
  ischiNotificationTimer?: ReturnType<typeof setInterval>;
};
export function flushNotifications(): Promise<void> {
  if (globalWorker.ischiNotificationFlush) return globalWorker.ischiNotificationFlush;
  const work = async () => {
    if (!telegramConfig()) return;
    await withStore(
      (data) => {
        // Reconcile intents if a crash happened between file replacements.
        for (const order of data.orders) {
          if (!data.notifications.some((n) => n.id === `new:${order.id}`))
            data.notifications.push(newEvent(order, 'new'));
        }
        for (const event of data.notifications)
          if (event.state === 'sending' && (event.lockedAt || 0) < Date.now() - 120000) {
            event.state = 'uncertain';
            event.error = 'Yuborish jarayoni tugallanmagan. Avval Telegram chatini tekshiring.';
          }
      },
      ['notifications'],
    );
    for (let i = 0; i < 10; i++) {
      const event = await withStore(
        (data) => {
          const next = data.notifications
            .filter(
              (n) =>
                n.state === 'pending' &&
                n.nextAttemptAt <= Date.now() &&
                !data.notifications.some(
                  (earlier) =>
                    earlier.orderId === n.orderId &&
                    earlier.createdAt < n.createdAt &&
                    earlier.state !== 'sent',
                ),
            )
            .sort((a, b) => a.createdAt - b.createdAt)[0];
          if (!next) return null;
          next.state = 'sending';
          next.lockedAt = Date.now();
          next.attempts++;
          return structuredClone(next);
        },
        ['notifications'],
      );
      if (!event) break;
      const result = await sendOrderMessage(event.message);
      await withStore(
        (data) => {
          const current = data.notifications.find((n) => n.id === event.id);
          if (!current || current.state !== 'sending') return;
          current.lockedAt = null;
          if (result.kind === 'sent') {
            current.state = 'sent';
            current.deliveredAt = Date.now();
            current.error = null;
          } else if (result.kind === 'retry' && current.attempts < 8) {
            current.state = 'pending';
            current.nextAttemptAt = Date.now() + (result.delayMs || 60000);
            current.error = result.error || 'Navbatda';
          } else {
            current.state =
              result.kind === 'uncertain' || result.kind === 'missing' ? 'uncertain' : 'failed';
            current.error = result.error || 'Xabar yuborilmadi.';
          }
        },
        ['notifications'],
      );
      if (result.kind !== 'sent') break;
    }
  };
  globalWorker.ischiNotificationFlush = work()
    .catch(() => undefined)
    .finally(() => {
      globalWorker.ischiNotificationFlush = undefined;
    });
  return globalWorker.ischiNotificationFlush;
}
export function startNotificationWorker() {
  if (globalWorker.ischiNotificationTimer || process.env.VERCEL) return;
  globalWorker.ischiNotificationTimer = setInterval(() => void flushNotifications(), 30000);
  globalWorker.ischiNotificationTimer.unref();
  void flushNotifications();
}
export async function notificationSummary() {
  const events = await readStore('notifications');
  return {
    total: events.length,
    pending: events.filter((e) => ['pending', 'sending'].includes(e.state)).length,
    sent: events.filter((e) => e.state === 'sent').length,
    uncertain: events.filter((e) => e.state === 'uncertain').length,
    failed: events.filter((e) => e.state === 'failed').length,
    configured: Boolean(telegramConfig()),
    recipient: telegramConfig()?.chatId || '@Navroz0909',
  };
}
