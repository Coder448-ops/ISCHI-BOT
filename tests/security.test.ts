import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { NextRequest } from 'next/server';
import {
  adminConfigured,
  createSession,
  deleteSession,
  requireAdmin,
  SESSION_COOKIE,
  verifyCredentials,
} from '../lib/server/auth';
import { dbGet, dbRun } from '../lib/server/db';
import { setupTestDatabase } from './helpers/database';
import { assertSameOrigin, readJson } from '../lib/server/http';
import { ApiError } from '../lib/server/orders';

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-only-strong-admin-password';
const request = (cookie = '', headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost:3000/api/admin/orders', {
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  });

let cleanup: () => Promise<void>;
before(async () => {
  cleanup = await setupTestDatabase();
});
beforeEach(async () => {
  await dbRun('DELETE FROM admin_sessions');
});
after(async () => {
  await cleanup();
});

test('only configured administrator credentials are accepted', () => {
  assert.equal(adminConfigured(), true);
  assert.equal(verifyCredentials('admin', process.env.ADMIN_PASSWORD!), true);
  assert.equal(verifyCredentials('customer', process.env.ADMIN_PASSWORD!), false);
  assert.equal(verifyCredentials('admin', 'wrong'), false);
  process.env.ADMIN_PASSWORD = '';
  assert.equal(adminConfigured(), false);
  assert.equal(verifyCredentials('admin', ''), false);
  process.env.ADMIN_PASSWORD = 'test-only-strong-admin-password';
});

test('sessions are opaque, hashed at rest, revocable and expire', async () => {
  const session = await createSession('admin', true);
  assert.equal(session.options.httpOnly, true);
  assert.equal(session.options.secure, true);
  assert.equal(session.options.sameSite, 'strict');
  const authenticated = request(`${SESSION_COOKIE}=${session.token}`);
  assert.equal((await requireAdmin(authenticated)).username, 'admin');
  await assert.rejects(
    () => requireAdmin(request()),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  const stored = await dbGet<{ token_hash: string }>('SELECT token_hash FROM admin_sessions');
  assert.notEqual(stored?.token_hash, session.token);
  assert.equal(stored?.token_hash.length, 64);
  await dbRun('UPDATE admin_sessions SET expires_at = 0');
  await assert.rejects(
    () => requireAdmin(authenticated),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  const second = await createSession('admin', false);
  await deleteSession(request(`${SESSION_COOKIE}=${second.token}`));
  await assert.rejects(
    () => requireAdmin(request(`${SESSION_COOKIE}=${second.token}`)),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
});

test('cross-site mutations and admin mutations without Origin are rejected', () => {
  assert.throws(
    () =>
      assertSameOrigin(
        request('', { origin: 'https://evil.example', host: 'localhost:3000' }),
        true,
      ),
    (e: unknown) => e instanceof ApiError && e.status === 403,
  );
  assert.throws(
    () => assertSameOrigin(request(), true),
    (e: unknown) => e instanceof ApiError && e.status === 403,
  );
  assert.doesNotThrow(() =>
    assertSameOrigin(
      request('', { origin: 'https://shop.example', 'x-forwarded-host': 'shop.example' }),
      true,
    ),
  );
});

test('JSON body limit is enforced even without Content-Length', async () => {
  const req = new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: 'x'.repeat(17000) }),
    duplex: 'half',
  } as ConstructorParameters<typeof NextRequest>[1]);
  await assert.rejects(
    () => readJson(req),
    (e: unknown) => e instanceof ApiError && e.status === 413,
  );
});
