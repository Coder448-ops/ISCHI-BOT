import type { NextRequest } from 'next/server';
import { deleteSession, requireAdmin, SESSION_COOKIE } from '@/lib/server/auth';
import { assertSameOrigin, errorResponse, privateJson } from '@/lib/server/http';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request, true);
    await requireAdmin(request);
    await deleteSession(request);
    const response = privateJson({ ok: true });
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
