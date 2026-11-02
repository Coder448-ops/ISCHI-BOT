import { NextRequest, NextResponse } from 'next/server';
import { apiOrigin } from './data-source';

/** Headers that must not be forwarded between the two HTTP hops. */
const skipped = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
  'proxy-authorization',
  'te',
  'trailer',
  'content-length',
  'accept-encoding',
  'expect',
]);
const skippedResponse = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);
const noBody = new Set(['GET', 'HEAD', 'OPTIONS']);

function forwardableHeaders(request: NextRequest) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (!skipped.has(name) && !name.startsWith('next-')) headers.set(name, value);
  });
  const host = request.headers.get('host');
  if (host) headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  return headers;
}

/**
 * Streams one API request to the persistent backend (API_ORIGIN) and back.
 * Cookies, multipart uploads and JSON bodies are passed through untouched, so the
 * browser keeps talking to this origin and no CORS or cross-site cookie rules apply.
 */
export async function proxyApi(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const origin = apiOrigin();
  if (!origin) return NextResponse.json({ error: 'API_ORIGIN sozlanmagan.' }, { status: 500 });
  const { path } = await context.params;
  if (path[0] === 'health' && request.method === 'GET') return health(origin);
  const target = new URL(origin + '/api/' + path.map((part) => encodeURIComponent(part)).join('/'));
  target.search = request.nextUrl.search;
  const started = Date.now();
  try {
    // Node's fetch needs `duplex: 'half'` to stream a request body; TypeScript's DOM types omit it.
    const init: RequestInit & { duplex: 'half' } = {
      method: request.method,
      headers: forwardableHeaders(request),
      body: noBody.has(request.method) ? undefined : request.body,
      duplex: 'half',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
    };
    const upstream = await fetch(target, init);
    const headers = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!skippedResponse.has(key.toLowerCase())) headers.set(key, value);
    });
    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) {
      headers.delete('set-cookie');
      for (const cookie of cookies) headers.append('set-cookie', cookie);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    console.error(`proxy ${target.pathname} failed after ${Date.now() - started}ms`);
    return NextResponse.json(
      {
        error:
          'Backend server bilan aloqa yo‘q. Administrator API_ORIGIN manzilini va serverni tekshirsin.',
        code: 'UPSTREAM_UNAVAILABLE',
      },
      { status: 502 },
    );
  }
}

async function health(origin: string) {
  try {
    const response = await fetch(origin + '/api/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      headers: { accept: 'application/json' },
    });
    const upstream: unknown = await response.json().catch(() => null);
    return NextResponse.json(
      {
        ok: response.ok,
        mode: 'proxy',
        storage: 'remote-json-files',
        upstream: origin,
        upstreamStatus: response.status,
        upstreamHealth: upstream,
        checkedAt: new Date().toISOString(),
      },
      { status: response.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        mode: 'proxy',
        storage: 'remote-json-files',
        upstream: origin,
        error: 'Backend server javob bermayapti.',
        code: 'UPSTREAM_UNAVAILABLE',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
