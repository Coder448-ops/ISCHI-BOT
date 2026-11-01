import { NextResponse } from 'next/server';
import { adminConfigured } from '@/lib/server/auth';
import { dbGet, isRemoteStorage, StorageError } from '@/lib/server/db';
import { telegramConfig } from '@/lib/server/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbGet('SELECT 1 AS ok');
    return NextResponse.json(
      {
        ok: true,
        storage: isRemoteStorage() ? 'turso' : 'local',
        telegramConfigured: Boolean(telegramConfig()),
        adminConfigured: adminConfigured(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof StorageError ? error.message : 'Buyurtmalar bazasiga ulanib bo‘lmadi.';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
