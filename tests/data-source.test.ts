import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiOrigin } from '../lib/server/data-source';
test('normalizeApiOrigin returns null when the app serves its own JSON store', () => {
  assert.equal(normalizeApiOrigin(undefined), null);
  assert.equal(normalizeApiOrigin(''), null);
  assert.equal(normalizeApiOrigin('   '), null);
});
test('normalizeApiOrigin accepts https origins and strips trailing slashes', () => {
  assert.equal(normalizeApiOrigin('https://api.example.com'), 'https://api.example.com');
  assert.equal(normalizeApiOrigin('  https://api.example.com///  '), 'https://api.example.com');
  assert.equal(normalizeApiOrigin('https://api.example.com:8443'), 'https://api.example.com:8443');
});
test('normalizeApiOrigin allows plain http only for local development', () => {
  assert.equal(normalizeApiOrigin('http://localhost:4000'), 'http://localhost:4000');
  assert.equal(normalizeApiOrigin('http://127.0.0.1:4000'), 'http://127.0.0.1:4000');
  assert.throws(() => normalizeApiOrigin('http://api.example.com'), /https/);
});
test('normalizeApiOrigin rejects URLs with a path, credentials or junk', () => {
  assert.throws(() => normalizeApiOrigin('https://api.example.com/api'), /manzil/);
  assert.throws(() => normalizeApiOrigin('https://user:pass@api.example.com'), /manzil/);
  assert.throws(() => normalizeApiOrigin('https://api.example.com/?x=1'), /manzil/);
  assert.throws(() => normalizeApiOrigin('not a url'), /manzil/);
  assert.throws(() => normalizeApiOrigin('ftp://api.example.com'), /https/);
});
