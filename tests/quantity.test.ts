import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuantity, parseQuantity, quantityIssue } from '../lib/money';
test('parseQuantity keeps every keystroke the customer types', () => {
  assert.equal(parseQuantity('1'), 1);
  assert.equal(parseQuantity('1200'), 1200);
  assert.equal(parseQuantity('1 250'), 1250);
  assert.equal(parseQuantity('2,5'), 2.5);
  assert.equal(parseQuantity('2.5'), 2.5);
  assert.equal(parseQuantity('0.125'), 0.125);
});
test('parseQuantity reports partial or unusable input instead of forcing a value', () => {
  for (const raw of ['', ' ', '.', ',', 'abc', '1,2,3', '-5', '1e5', '12kg'])
    assert.ok(Number.isNaN(parseQuantity(raw)), raw);
});
test('quantityIssue describes why a typed number cannot be ordered', () => {
  assert.equal(quantityIssue(1200, 500, 50000, 1), null);
  assert.equal(quantityIssue(Number.NaN, 500, 50000, 1), 'empty');
  assert.equal(quantityIssue(0, 500, 50000, 1), 'empty');
  assert.equal(quantityIssue(499, 500, 50000, 1), 'min');
  assert.equal(quantityIssue(50001, 500, 50000, 1), 'max');
  assert.equal(quantityIssue(1250.5, 500, 50000, 1), 'step');
  assert.equal(quantityIssue(506, 6, 3000, 6), 'step');
  assert.equal(quantityIssue(12, 6, 3000, 6), null);
});
test('normalizeQuantity clamps and snaps to the product step grid', () => {
  assert.equal(normalizeQuantity(1200, 500, 50000, 1), 1200);
  assert.equal(normalizeQuantity(1200, 500, 50000, 100), 1200);
  assert.equal(normalizeQuantity(1249, 500, 50000, 100), 1200);
  assert.equal(normalizeQuantity(1251, 500, 50000, 100), 1300);
  assert.equal(normalizeQuantity(10, 500, 50000, 1), 500);
  assert.equal(normalizeQuantity(99999, 500, 50000, 1), 50000);
  assert.equal(normalizeQuantity(7, 6, 3000, 6), 6);
  assert.equal(normalizeQuantity(Number.NaN, 6, 3000, 6), 6);
  assert.equal(normalizeQuantity(2.5, 1, 10, 0.5), 2.5);
});
