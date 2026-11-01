import { getDb } from './db';
import { sendTelegram, telegramConfig } from './telegram';

const globalWorker = globalThis as unknown as {
  ischiFlush?: Promise<void>;
  ischiTimer?: ReturnType<typeof setInterval>;
};
type OutboxRow = { id: number; message: string; attempts: number };
export function flushNotifications(): Promise<void> {
  if (globalWorker.ischiFlush) return globalWorker.ischiFlush;
  const work = async () => {
    if (!telegramConfig()) return;
    const db = getDb();
    const now = Date.now();
    db.prepare(
      "UPDATE notification_outbox SET state = 'uncertain', last_error = 'Yuborish vaqti tugadi. Takroriy xabar yuborilmadi.' WHERE state = 'sending' AND locked_at < ?",
    ).run(now - 120000);
    for (let i = 0; i < 10; i++) {
      // Keep each order's notifications in their original sequence.
      const row = db
        .prepare(
          `SELECT o.id, o.message, o.attempts FROM notification_outbox o
        WHERE o.state = 'pending' AND o.next_attempt_at <= ?
        AND NOT EXISTS (SELECT 1 FROM notification_outbox earlier WHERE earlier.order_id = o.order_id AND earlier.id < o.id AND earlier.state != 'sent')
        ORDER BY o.id LIMIT 1`,
        )
        .get(now) as unknown as OutboxRow | undefined;
      if (!row) break;
      const claimed = db
        .prepare(
          "UPDATE notification_outbox SET state = 'sending', locked_at = ?, attempts = attempts + 1 WHERE id = ? AND state = 'pending'",
        )
        .run(now, row.id);
      if (!claimed.changes) continue;
      const result = await sendTelegram(row.message);
      if (result.kind === 'sent') {
        db.prepare(
          "UPDATE notification_outbox SET state = 'sent', delivered_at = ?, locked_at = NULL, last_error = NULL WHERE id = ?",
        ).run(Date.now(), row.id);
      } else if (result.kind === 'retry' && row.attempts < 8) {
        db.prepare(
          "UPDATE notification_outbox SET state = 'pending', next_attempt_at = ?, locked_at = NULL, last_error = ? WHERE id = ?",
        ).run(Date.now() + (result.delayMs || 30000), result.error || 'Xabar navbatda.', row.id);
        break;
      } else {
        db.prepare(
          'UPDATE notification_outbox SET state = ?, locked_at = NULL, last_error = ? WHERE id = ?',
        ).run(
          result.kind === 'uncertain' ? 'uncertain' : 'failed',
          result.error || 'Xabarni yuborib bo‘lmadi.',
          row.id,
        );
      }
    }
  };
  globalWorker.ischiFlush = work()
    .catch(() => {
      /* Keep private customer data and bot credentials out of logs. */
    })
    .finally(() => {
      globalWorker.ischiFlush = undefined;
    });
  return globalWorker.ischiFlush;
}
export function startNotificationWorker() {
  if (globalWorker.ischiTimer) return;
  globalWorker.ischiTimer = setInterval(() => {
    void flushNotifications();
  }, 30000);
  globalWorker.ischiTimer.unref();
  void flushNotifications();
}
export function notificationSummary() {
  const db = getDb();
  const summary = db
    .prepare(
      `SELECT
    COUNT(*) AS total,
    COALESCE(SUM(state = 'sent'), 0) AS sent,
    COALESCE(SUM(state IN ('pending','sending')), 0) AS pending,
    COALESCE(SUM(state = 'uncertain'), 0) AS uncertain,
    COALESCE(SUM(state = 'failed'), 0) AS failed
    FROM notification_outbox`,
    )
    .get() as Record<string, number>;
  return {
    total: Number(summary.total),
    sent: Number(summary.sent),
    pending: Number(summary.pending),
    uncertain: Number(summary.uncertain),
    failed: Number(summary.failed),
    configured: Boolean(telegramConfig()),
    recipient: process.env.TELEGRAM_CHAT_ID?.trim() || '@Navroz0909',
  };
}
export function retryConfirmedFailures() {
  // Only explicitly rejected messages are retryable. Ambiguous/sent messages are never reset.
  const result = getDb()
    .prepare(
      "UPDATE notification_outbox SET state = 'pending', next_attempt_at = 0, last_error = NULL WHERE state = 'failed' OR (state = 'pending' AND last_error IS NOT NULL)",
    )
    .run();
  return Number(result.changes);
}
