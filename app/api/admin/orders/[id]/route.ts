import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ORDER_STATUSES } from '@/lib/format';
import { requireAdmin } from '@/lib/server/auth';
import { changeOrderStatus, ApiError } from '@/lib/server/orders';
import { flushNotifications } from '@/lib/server/notifications';
import { assertSameOrigin, errorResponse, privateJson, readJson } from '@/lib/server/http';

const schema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    expectedStatus: z.enum(ORDER_STATUSES).optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request, true);
    await requireAdmin(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, 'Buyurtma holatini tanlang.');
    const { id } = await context.params;
    const result = await changeOrderStatus(id, parsed.data.status, parsed.data.expectedStatus);
    if (result.changed) after(() => flushNotifications());
    return privateJson(result);
  } catch (error) {
    return errorResponse(error);
  }
}
