import { after, type NextRequest } from 'next/server';
import { checkoutSchema } from '@/lib/validation';
import { createOrder, ApiError } from '@/lib/server/orders';
import { flushNotifications } from '@/lib/server/notifications';
import { assertSameOrigin, errorResponse, privateJson, readJson } from '@/lib/server/http';
export const runtime = 'nodejs';
const limits = new Map<string, { count: number; until: number }>();
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const now = Date.now();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (limits.size > 5000)
      for (const [key, value] of limits) if (value.until < now) limits.delete(key);
    const previous = limits.get(ip);
    const bucket =
      previous && previous.until > now ? previous : { count: 0, until: now + 10 * 60 * 1000 };
    bucket.count++;
    limits.set(ip, bucket);
    if (bucket.count > 30)
      throw new ApiError(
        429,
        'Juda ko‘p buyurtma yuborildi. 10 daqiqadan so‘ng qayta urinib ko‘ring.',
      );
    const parsed = checkoutSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const error =
        issue.code === 'unrecognized_keys'
          ? 'Faqat ism, telefon raqami va buyurtma mahsulotlari qabul qilinadi.'
          : issue.message;
      return privateJson({ error, field: issue.path[0] }, 400);
    }
    const result = createOrder(parsed.data);
    if (!result.reused) after(() => flushNotifications());
    return privateJson({ order: result.order }, result.reused ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
