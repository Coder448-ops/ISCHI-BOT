import { handleApi } from '@/lib/server/api';
import { remoteMode } from '@/lib/server/data-source';
import { proxyApi } from '@/lib/server/proxy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
const handle = (request: Parameters<typeof handleApi>[0], context: Context) =>
  remoteMode() ? proxyApi(request, context) : handleApi(request, context);
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
