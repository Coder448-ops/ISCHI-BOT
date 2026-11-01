import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import { ApiError } from '@/lib/server/orders';
import {
  flushNotifications,
  notificationSummary,
  retryConfirmedFailures,
} from '@/lib/server/notifications';
import { assertSameOrigin, errorResponse, privateJson, readJson } from '@/lib/server/http';
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const events = getDb()
      .prepare(
        'SELECT o.id, o.kind, o.state, o.attempts, o.last_error AS error, o.created_at AS createdAt, r.number FROM notification_outbox o JOIN orders r ON r.id = o.order_id ORDER BY o.id DESC LIMIT 100',
      )
      .all();
    return privateJson({ events, summary: notificationSummary() });
  } catch (error) {
    return errorResponse(error);
  }
}
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('retry') }).strict(),
  z
    .object({
      action: z.literal('resolve'),
      id: z.number().int().positive(),
      resolution: z.enum(['confirmed', 'resend']),
    })
    .strict(),
]);
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request, true);
    requireAdmin(request);
    const parsed = actionSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, 'Amalni tekshiring.');
    if (parsed.data.action === 'retry') retryConfirmedFailures();
    else {
      const { id, resolution } = parsed.data;
      const result = getDb()
        .prepare(
          "UPDATE notification_outbox SET state = ?, delivered_at = ?, next_attempt_at = 0, last_error = ? WHERE id = ? AND state = 'uncertain'",
        )
        .run(
          resolution === 'confirmed' ? 'sent' : 'pending',
          resolution === 'confirmed' ? Date.now() : null,
          resolution === 'confirmed'
            ? 'Administrator Telegramda yuborilganini tasdiqladi.'
            : 'Administrator xabar yuborilmaganini tekshirdi.',
          id,
        );
      if (!result.changes) throw new ApiError(409, 'Xabar holati o‘zgargan. Sahifani yangilang.');
    }
    after(() => flushNotifications());
    return privateJson({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
