import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function checkout(page: Page, name = 'Ali Valiyev') {
  await page.locator('.cart-button').click();
  await page.getByRole('button', { name: 'Buyurtma berish', exact: true }).click();
  await page.getByLabel('Ism va familiya').fill(name);
  const phone = page.getByLabel('Telefon raqami');
  await phone.click();
  await phone.pressSequentially('901234567');
  await expect(phone).toHaveValue('+998 90 123 45 67');
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Buyurtmani tasdiqlash' }).click();
  expect((await response).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Buyurtmangiz qabul qilindi!' })).toBeVisible();
}

test('guest storefront, two-field validation, Uzbek mask and repeat orders', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Yaxshi texnika. Yanada oson xarid.' }),
  ).toBeVisible();
  await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0);
  await expect(
    page.locator('a[href*="signup"], a[href*="register"], a[href*="login"]'),
  ).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/storefront-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'iPhone 16 Pro savatga qo‘shish', exact: true }).click();
  await page.getByRole('button', { name: 'AirPods Pro 2 savatga qo‘shish', exact: true }).click();
  await page.locator('.cart-button').click();
  await expect(page.locator('.cart-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Buyurtma berish', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input')).toHaveCount(2);
  await page.getByRole('button', { name: 'Buyurtmani tasdiqlash' }).click();
  await expect(
    page.getByText('Ism va familiyangizni to‘liq kiriting.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Telefon raqamini to‘liq kiriting: +998 XX XXX XX XX.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Ism va familiya').fill('Ali');
  await page.getByLabel('Telefon raqami').click();
  await page.getByLabel('Telefon raqami').pressSequentially('123');
  await page.getByRole('button', { name: 'Buyurtmani tasdiqlash' }).click();
  await expect(
    page.getByText('Ism va familiyangizni to‘liq kiriting.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Ism va familiya').fill('Ali Valiyev');
  await page.getByLabel('Telefon raqami').fill('');
  await page.getByLabel('Telefon raqami').pressSequentially('901234567');
  await expect(page.getByLabel('Telefon raqami')).toHaveValue('+998 90 123 45 67');
  await page.screenshot({ path: 'test-results/checkout-desktop.png', fullPage: true });
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Buyurtmani tasdiqlash' }).click();
  expect((await response).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Buyurtmangiz qabul qilindi!' })).toBeVisible();
  const firstNumber = await page.locator('.confirmation-card strong').first().textContent();
  await page.getByRole('button', { name: 'Xaridni davom ettirish' }).click();
  await expect(page.locator('.cart-count')).toHaveText('0');
  await page.getByRole('button', { name: 'MacBook Air M3 savatga qo‘shish', exact: true }).click();
  await checkout(page);
  expect(await page.locator('.confirmation-card strong').first().textContent()).not.toBe(
    firstNumber,
  );
});

test('protected admin can search, change status, cancel and inspect queued notifications', async ({
  page,
  request,
}) => {
  const payload = {
    customerName: 'Dilnoza Karimova',
    phone: '+998931112233',
    items: [
      { productId: 'iphone-16-pro', quantity: 2 },
      { productId: 'airpods-pro-2', quantity: 1 },
    ],
    requestId: randomUUID(),
  };
  const created = await request.post('/api/orders', {
    data: payload,
    headers: { Origin: 'http://127.0.0.1:3001' },
  });
  expect(created.status()).toBe(201);
  const { order } = await created.json();
  expect(order.total).toBe(32900000);
  expect((await request.get('/api/admin/orders')).status()).toBe(401);
  expect(
    (
      await request.patch(`/api/admin/orders/${order.id}`, { data: { status: 'Tasdiqlandi' } })
    ).status(),
  ).toBe(403);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('Administrator logini').fill('admin');
  await page.getByLabel('Parol', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Panelga kirish' }).click();
  await expect(page.locator('.error-banner[role="alert"]')).toContainText(
    'Login yoki parol noto‘g‘ri.',
  );
  await page.getByLabel('Parol', { exact: true }).fill('e2e-only-admin-password-2026');
  await page.getByRole('button', { name: 'Panelga kirish' }).click();
  await expect(page.getByRole('heading', { name: 'Buyurtmalar', exact: true })).toBeVisible();
  await page.getByLabel('Buyurtmalarni qidirish').fill('Dilnoza');
  await expect(page.locator('.orders-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: `${order.number} buyurtmasini ko‘rish` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Dilnoza Karimova', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Tasdiqlandi', exact: true }).click();
  await dialog.getByRole('button', { name: 'Holatni saqlash' }).click();
  await expect(dialog.locator('.drawer-header + .detail-content .status-badge')).toHaveText(
    'Tasdiqlandi',
  );
  await dialog.getByRole('button', { name: 'Buyurtmani bekor qilish' }).click();
  await dialog.getByRole('button', { name: 'Ha, bekor qilish' }).click();
  await expect(dialog.locator('.drawer-header + .detail-content .status-badge')).toHaveText(
    'Bekor qilindi',
  );
  await expect(
    dialog.getByText('Bu buyurtma yakunlangan. Holatini o‘zgartirib bo‘lmaydi.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Tafsilotlarni yopish' }).click();
  await page.getByLabel('Buyurtma holati bo‘yicha filtr').selectOption('Bekor qilindi');
  await page.getByLabel('Buyurtmalarni qidirish').fill('+998931112233');
  await expect(page.locator('.orders-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.orders-table tbody .status-badge')).toHaveText('Bekor qilindi');
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Telegram xabarlari' }).click();
  await expect(page.getByText('Bot tokeni kiritilmagan', { exact: true })).toBeVisible();
  await expect(page.locator('.notification-event').filter({ hasText: order.number })).toHaveCount(
    3,
  );
  await page.getByRole('button', { name: 'Administrator hisobidan chiqish' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await request.get('/api/admin/orders')).status()).toBe(401);
});

test('server rejects forged prices and unnecessary personal data; duplicate submission is safe', async ({
  request,
}) => {
  const payload = {
    customerName: 'Olim Karimov',
    phone: '+998901112233',
    items: [{ productId: 'iphone-16-pro', quantity: 1 }],
    requestId: randomUUID(),
  };
  const headers = { Origin: 'http://127.0.0.1:3001' };
  const empty = await request.post('/api/orders', { data: {}, headers });
  expect(empty.status()).toBe(400);
  expect((await empty.json()).error).toBe('Ism va familiyangizni kiriting.');
  expect(
    (
      await request.post('/api/orders', { data: { ...payload, email: 'no@example.com' }, headers })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/orders', {
        data: { ...payload, items: [{ ...payload.items[0], price: 1 }] },
        headers,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/orders', {
        data: payload,
        headers: { Origin: 'https://untrusted.example' },
      })
    ).status(),
  ).toBe(403);
  const first = await request.post('/api/orders', { data: payload, headers });
  const second = await request.post('/api/orders', { data: payload, headers });
  expect(first.status()).toBe(201);
  expect(second.status()).toBe(200);
  expect((await first.json()).order.id).toBe((await second.json()).order.id);
});

test('mobile catalog, navigation and checkout fit a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/storefront-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Menyuni ochish' }).click();
  await page
    .getByRole('navigation', { name: 'Asosiy menyu' })
    .getByRole('link', { name: 'Mahsulotlar', exact: true })
    .click();
  await page.getByLabel('Mahsulot qidirish').fill('AirPods');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'AirPods Pro 2 savatga qo‘shish', exact: true }).click();
  await page.locator('.cart-button').click();
  await page.getByRole('button', { name: 'Buyurtma berish', exact: true }).click();
  await expect(page.getByLabel('Ism va familiya')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/checkout-mobile.png' });
});
