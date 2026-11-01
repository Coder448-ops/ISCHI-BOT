import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { StorageError } from './db';
import { ApiError } from './orders';

export function assertSameOrigin(request: NextRequest, requireOrigin = false) {
  const origin = request.headers.get('origin');
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    request.nextUrl.host;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (requireOrigin && !origin))
    throw new ApiError(403, 'So‘rov manbasi rad etildi.');
  if (origin) {
    try {
      if (new URL(origin).host !== host) throw new Error('origin');
    } catch {
      throw new ApiError(403, 'So‘rov manbasi rad etildi.');
    }
  }
}

export async function readJson(request: NextRequest) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new ApiError(415, 'JSON formatida so‘rov yuboring.');
  if (Number(request.headers.get('content-length') || 0) > 16384)
    throw new ApiError(413, 'So‘rov hajmi juda katta.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'So‘rov bo‘sh.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new ApiError(413, 'So‘rov hajmi juda katta.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new ApiError(400, 'So‘rov ma’lumotlari noto‘g‘ri.');
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  if (error instanceof StorageError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );

  const reference = randomUUID().slice(0, 8).toUpperCase();
  const name = error instanceof Error ? error.name : typeof error;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  // Do not log request bodies, customer fields, SQL parameters, or environment values.
  console.error(
    `[ISCHI] request failed reference=${reference} name=${name}${code ? ` code=${code}` : ''}`,
  );
  return NextResponse.json(
    {
      error: `Texnik xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring. Xato kodi: ${reference}`,
      reference,
    },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

export const privateJson = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
