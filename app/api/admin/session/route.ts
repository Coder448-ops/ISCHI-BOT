import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { errorResponse, privateJson } from '@/lib/server/http';

export async function GET(request: NextRequest) {
  try {
    return privateJson(await requireAdmin(request));
  } catch (error) {
    return errorResponse(error);
  }
}
