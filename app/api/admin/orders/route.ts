import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { listOrders } from '@/lib/server/orders';
import { notificationSummary } from '@/lib/server/notifications';
import { errorResponse, privateJson } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const params = request.nextUrl.searchParams;
    const data = await listOrders({
      q: params.get('q') || '',
      status: params.get('status') || '',
      page: Math.trunc(Number(params.get('page'))) || 1,
      limit: Math.trunc(Number(params.get('limit'))) || 12,
    });
    return privateJson({ ...data, notifications: await notificationSummary() });
  } catch (error) {
    return errorResponse(error);
  }
}
