import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/orders';
import {
  flushNotifications,
  listNotificationEvents,
  notificationSummary,
  resolveUncertainEvent,
  retryConfirmedFailures,
} from '@/lib/server/notifications';
import { assertSameOrigin, errorResponse, privateJson, readJson } from '@/lib/server/http';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const events = await listNotificationEvents();
    return privateJson({ events, summary: await notificationSummary() });
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
    await requireAdmin(request);
    const parsed = actionSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, 'Amalni tekshiring.');
    if (parsed.data.action === 'retry') {
      await retryConfirmedFailures();
    } else {
      const changed = await resolveUncertainEvent(parsed.data.id, parsed.data.resolution);
      if (!changed) throw new ApiError(409, 'Xabar holati o‘zgargan. Sahifani yangilang.');
    }
    after(() => flushNotifications());
    return privateJson({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
