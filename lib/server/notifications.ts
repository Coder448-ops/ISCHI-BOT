import { dbAll, dbGet, dbRun, getPool, withTransaction } from './db';
import { sendTelegram, telegramConfig } from './telegram';

const globalWorker = globalThis as unknown as {
  ischiFlush?: Promise<void>;
  ischiTimer?: ReturnType<typeof setInterval>;
};
type OutboxRow = { id: number; message: string; attempts: number };

async function claimNext(now: number): Promise<OutboxRow | undefined> {
  return withTransaction(async (tx) => {
    const row = await dbGet<OutboxRow>(
      `SELECT o.id, o.message, o.attempts FROM notification_outbox o
       WHERE o.state = 'pending' AND o.next_attempt_at <= ?
       AND NOT EXISTS (
         SELECT 1 FROM notification_outbox earlier
         WHERE earlier.order_id = o.order_id AND earlier.id < o.id AND earlier.state != 'sent'
       )
       ORDER BY o.id LIMIT 1 FOR UPDATE OF o`,
      [now],
      tx,
    );
    if (!row) return undefined;
    const claimed = await dbRun(
      "UPDATE notification_outbox SET state = 'sending', locked_at = ?, attempts = attempts + 1 WHERE id = ? AND state = 'pending'",
      [now, row.id],
      tx,
    );
    return claimed.changes ? row : undefined;
  });
}

export function flushNotifications(): Promise<void> {
  if (globalWorker.ischiFlush) return globalWorker.ischiFlush;
  const work = async () => {
    if (!telegramConfig()) return;
    await getPool();
    const now = Date.now();
    await dbRun(
      "UPDATE notification_outbox SET state = 'uncertain', last_error = 'Yuborish vaqti tugadi. Takroriy xabar yuborilmadi.' WHERE state = 'sending' AND locked_at < ?",
      [now - 120000],
    );
    for (let i = 0; i < 10; i++) {
      const row = await claimNext(now);
      if (!row) break;
      const result = await sendTelegram(row.message);
      if (result.kind === 'sent') {
        await dbRun(
          "UPDATE notification_outbox SET state = 'sent', delivered_at = ?, locked_at = NULL, last_error = NULL WHERE id = ?",
          [Date.now(), row.id],
        );
      } else if (result.kind === 'retry' && row.attempts < 8) {
        await dbRun(
          "UPDATE notification_outbox SET state = 'pending', next_attempt_at = ?, locked_at = NULL, last_error = ? WHERE id = ?",
          [Date.now() + (result.delayMs || 30000), result.error || 'Xabar navbatda.', row.id],
        );
        break;
      } else {
        await dbRun(
          'UPDATE notification_outbox SET state = ?, locked_at = NULL, last_error = ? WHERE id = ?',
          [
            result.kind === 'uncertain' ? 'uncertain' : 'failed',
            result.error || 'Xabarni yuborib bo‘lmadi.',
            row.id,
          ],
        );
      }
    }
  };
  globalWorker.ischiFlush = work()
    .catch(() => {
      // Keep customer data and credentials out of logs.
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

export async function notificationSummary() {
  const summary = await dbGet<Record<string, number>>(
    `SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE state = 'sent') AS sent,
      COUNT(*) FILTER (WHERE state IN ('pending','sending')) AS pending,
      COUNT(*) FILTER (WHERE state = 'uncertain') AS uncertain,
      COUNT(*) FILTER (WHERE state = 'failed') AS failed
     FROM notification_outbox`,
  );
  return {
    total: Number(summary?.total || 0),
    sent: Number(summary?.sent || 0),
    pending: Number(summary?.pending || 0),
    uncertain: Number(summary?.uncertain || 0),
    failed: Number(summary?.failed || 0),
    configured: Boolean(telegramConfig()),
    recipient: process.env.TELEGRAM_CHAT_ID?.trim() || '@Navroz0909',
  };
}

export async function retryConfirmedFailures() {
  const result = await dbRun(
    "UPDATE notification_outbox SET state = 'pending', next_attempt_at = 0, last_error = NULL WHERE state = 'failed' OR (state = 'pending' AND last_error IS NOT NULL)",
  );
  return result.changes;
}

export async function listNotificationEvents() {
  const rows = await dbAll<{
    id: number;
    kind: 'new' | 'status' | 'cancel';
    state: 'pending' | 'sending' | 'sent' | 'uncertain' | 'failed';
    attempts: number;
    error: string | null;
    createdat: string | number;
    number: string;
  }>(
    `SELECT o.id, o.kind, o.state, o.attempts, o.last_error AS error, o.created_at AS createdAt, r.number
     FROM notification_outbox o JOIN orders r ON r.id = o.order_id
     ORDER BY o.id DESC LIMIT 100`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    kind: row.kind,
    state: row.state,
    attempts: Number(row.attempts),
    error: row.error,
    createdAt: Number(row.createdat),
    number: row.number,
  }));
}

export async function resolveUncertainEvent(id: number, resolution: 'confirmed' | 'resend') {
  const result = await dbRun(
    "UPDATE notification_outbox SET state = ?, delivered_at = ?, next_attempt_at = 0, last_error = ? WHERE id = ? AND state = 'uncertain'",
    [
      resolution === 'confirmed' ? 'sent' : 'pending',
      resolution === 'confirmed' ? Date.now() : null,
      resolution === 'confirmed'
        ? 'Administrator Telegramda yuborilganini tasdiqladi.'
        : 'Administrator xabar yuborilmaganini tekshirdi.',
      id,
    ],
  );
  return result.changes;
}
