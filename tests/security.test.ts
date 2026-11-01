import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { randomBytes, scryptSync } from 'node:crypto';
import { temporaryStore } from './helpers';
import {
  adminConfigured,
  allowedOrigin,
  assertOrigin,
  createSession,
  deleteSession,
  getSession,
  rateLimit,
  verifyCredentials,
} from '../lib/server/security';
import { checkoutSchema, productSchema, imagePath } from '../lib/server/schemas';
import { readStore } from '../lib/server/storage';
let store: Awaited<ReturnType<typeof temporaryStore>>;
before(async () => {
  store = await temporaryStore();
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'unique-test-password-2026';
  delete process.env.ADMIN_PASSWORD_HASH;
});
after(async () => {
  await store.cleanup();
});
const request = (headers: Record<string, string> = {}) =>
  new NextRequest('https://shop.example/api/orders', { headers });
test('only administrator credentials are supported; wrong credentials fail', () => {
  assert.ok(adminConfigured());
  assert.ok(verifyCredentials('admin', 'unique-test-password-2026'));
  assert.equal(verifyCredentials('admin', 'wrong'), false);
  assert.equal(verifyCredentials('customer', 'unique-test-password-2026'), false);
});
test('scrypt password hash works and malformed hash fails closed', () => {
  const previous = process.env.ADMIN_PASSWORD_HASH;
  const salt = randomBytes(16).toString('hex');
  try {
    process.env.ADMIN_PASSWORD_HASH = `scrypt:${salt}:${scryptSync('unique-test-password-2026', salt, 64).toString('hex')}`;
    assert.ok(verifyCredentials('admin', 'unique-test-password-2026'));
    process.env.ADMIN_PASSWORD_HASH = 'scrypt:bad:bad';
    assert.equal(verifyCredentials('admin', 'unique-test-password-2026'), false);
  } finally {
    if (previous) process.env.ADMIN_PASSWORD_HASH = previous;
    else delete process.env.ADMIN_PASSWORD_HASH;
  }
});
test('sessions store only a hash, expire and revoke', async () => {
  const session = await createSession('admin', true);
  assert.equal(session.options.httpOnly, true);
  assert.equal(session.options.secure, true);
  assert.equal(session.options.sameSite, 'strict');
  assert.equal((await getSession(session.token))?.username, 'admin');
  const stored = await readStore('sessions');
  assert.ok(stored.every((x) => x.tokenHash !== session.token));
  await deleteSession(session.token);
  assert.equal(await getSession(session.token), null);
  assert.equal(await getSession('bad'), null);
});
test('admin cross-origin and missing-origin mutations are rejected', () => {
  assert.throws(() =>
    assertOrigin(request({ origin: 'https://evil.example', host: 'shop.example' }), true),
  );
  assert.throws(() => assertOrigin(request({ host: 'shop.example' }), true));
  assert.doesNotThrow(() =>
    assertOrigin(request({ origin: 'https://shop.example', host: 'shop.example' }), true),
  );
  assert.equal(
    allowedOrigin(request({ origin: 'https://localhost', host: 'shop.example' }), true).allowed,
    false,
  );
});
test('Capacitor origin is allowed for public checkout only', () => {
  assert.ok(allowedOrigin(request({ origin: 'https://localhost', host: 'api.example' })).allowed);
  assert.doesNotThrow(() =>
    assertOrigin(request({ origin: 'https://localhost', host: 'api.example' })),
  );
  assert.throws(() =>
    assertOrigin(request({ origin: 'https://evil.example', host: 'api.example' })),
  );
});
test('rate limits stop repeated login attempts', () => {
  const r = request({ 'x-forwarded-for': '192.0.2.55' });
  for (let i = 0; i < 8; i++) rateLimit(r, 'test-login', 8, 900000);
  assert.throws(() => rateLimit(r, 'test-login', 8, 900000), /so‘rov/);
});
test('checkout requires exactly two personal fields and valid Uzbek phone', () => {
  const base = {
    customerName: 'Ali Valiyev',
    phone: '+998 (90) 123-45-67',
    items: [{ productId: 'armatura-sample', quantity: 1 }],
    requestId: '3e1ab6b6-7ef1-4e5a-9a5e-2c05b6a4e9ef',
    expectedTotal: 100,
  };
  assert.equal(checkoutSchema.parse(base).phone, '998901234567');
  for (const patch of [
    { phone: '99890123' },
    { customerName: 'Ali' },
    { email: 'a@example.com' },
    { password: 'secret' },
  ])
    assert.equal(checkoutSchema.safeParse({ ...base, ...patch }).success, false);
});
test('file paths cannot escape image directories', () => {
  for (const value of [
    '/api/media/../../orders.json',
    '/images/products/../orders.json',
    'https://evil.example/a.png',
    '/images/products/x.svg',
  ])
    assert.equal(imagePath.safeParse(value).success, false);
  assert.ok(imagePath.safeParse('/api/media/0e0cb4f2-44e4-4f2e-842e-0efb0ceccad2.webp').success);
});
