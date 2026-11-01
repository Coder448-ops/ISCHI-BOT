import type { NextRequest } from 'next/server';
import { loginSchema } from '@/lib/validation';
import {
  adminConfigured,
  checkLoginLimit,
  createSession,
  isSecureRequest,
  SESSION_COOKIE,
  verifyCredentials,
} from '@/lib/server/auth';
import { assertSameOrigin, errorResponse, privateJson, readJson } from '@/lib/server/http';
import { ApiError } from '@/lib/server/orders';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request, true);
    checkLoginLimit(request);
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, 'Login va parolni kiriting.');
    if (!adminConfigured())
      throw new ApiError(
        503,
        'Administrator kirishi hali sozlanmagan. ADMIN_PASSWORD kamida 12 belgidan iborat bo‘lsin.',
      );
    if (!verifyCredentials(parsed.data.username, parsed.data.password))
      throw new ApiError(401, 'Login yoki parol noto‘g‘ri.');
    const session = await createSession(parsed.data.username, isSecureRequest(request));
    const response = privateJson({ ok: true });
    response.cookies.set(SESSION_COOKIE, session.token, session.options);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
