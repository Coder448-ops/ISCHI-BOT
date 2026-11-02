import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
const password = 'e2e-only-admin-password-2026';
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Administrator logini').fill('admin');
  await page.getByLabel('Parol', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Panelga kirish' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function addFirst(page: Page) {
  await page.goto('/product/armatura-sample');
  await page.getByRole('button', { name: 'Savatga', exact: true }).click();
}
test('home, 22 categories, catalog search, filters, pagination and detail units', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Mustahkam loyihalar. To‘g‘ri materiallar.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ro‘yxatdan o‘tish', exact: true })).toHaveCount(0);
  const bootstrap = await page.request.get('/api/bootstrap');
  const data = await bootstrap.json();
  expect(data.categories).toHaveLength(22);
  await page.goto('/catalog');
  await expect(page.locator('.product-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Keyingi', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(10);
  await page.goto('/catalog?q=Armatura');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.locator('.product-card .product-title').click();
  await expect(page.getByRole('heading', { name: 'Armatura 12 mm • A500C' })).toBeVisible();
  await expect(page.locator('.detail-price')).toContainText('kg');
  await page.getByRole('button', { name: 'Keyingi', exact: true }).click();
  await expect(page.locator('.quantity-control input')).not.toHaveValue('500');
  await page.goto('/catalog?availability=discount');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Ro‘yxat', exact: true }).click();
  await expect(page.locator('.list-layout')).toBeVisible();
  await page.goto('/catalog?q=not-a-real-product-xyz');
  await expect(page.getByRole('heading', { name: 'Mos mahsulot topilmadi' })).toBeVisible();
});
test('quantity box keeps any number typed for kg products', async ({ page }) => {
  await page.goto('/product/armatura-sample');
  const box = page.locator('.quantity-control input');
  await expect(box).toHaveValue('500');
  await box.fill('');
  await box.type('1250', { delay: 40 });
  await expect(box).toHaveValue('1250');
  await expect(page.locator('.line-total strong')).toContainText('14 750 000');
  await box.blur();
  await expect(box).toHaveValue('1250');
  await page.getByRole('button', { name: 'Savatga', exact: true }).click();
  await page.getByRole('button', { name: /^Savat \(/ }).click();
  await expect(page.locator('.cart-line .quantity-input')).toHaveValue('1250');
  // A number outside the allowed range is reported, not silently rewritten.
  await page.goto('/product/armatura-sample');
  await page.locator('.quantity-control input').fill('120');
  await expect(page.locator('.quantity-hint')).toContainText('500');
  await expect(page.locator('.quantity-control input')).toHaveValue('120');
  await page.getByRole('button', { name: 'Savatga', exact: true }).click();
  await expect(page.locator('.toast, [role="status"]').first()).toBeVisible();
});

test('guest checkout has only name and phone, persists receipt and prevents duplicate submit', async ({
  page,
}) => {
  await addFirst(page);
  await page.getByRole('button', { name: /^Savat \(/ }).click();
  await page.getByRole('button', { name: 'Buyurtma berish', exact: true }).click();
  await expect(page.locator('.checkout-form input')).toHaveCount(2);
  await page.getByLabel('Ism va familiya', { exact: true }).fill('Ali Valiyev');
  await page.getByLabel('Telefon raqami', { exact: true }).fill('+998 90 123 45 67');
  let posts = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/orders') && r.method() === 'POST') posts++;
  });
  await page.getByRole('button', { name: 'Buyurtmani tasdiqlash' }).click();
  await expect(page.getByRole('heading', { name: 'Buyurtmangiz qabul qilindi!' })).toBeVisible();
  await expect(page.locator('.confirmation-card')).toContainText('ISH-');
  expect(posts).toBe(1);
  await page.reload();
  await page.goto('/orders');
  await expect(page.locator('.receipt-card')).toHaveCount(1);
  await expect(page.locator('.receipt-card')).toContainText('Yangi buyurtma');
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ischi-v2-receipts') || '[]'),
  );
  expect(stored[0].token).toBeTruthy();
});
test('favorites, comparison, language and theme survive reload', async ({ page }) => {
  await page.goto('/product/armatura-sample');
  await page.locator('.detail-tools').getByRole('button', { name: 'Sevimlilar' }).click();
  await page.locator('.detail-tools').getByRole('button', { name: 'Taqqoslash' }).click();
  await page.goto('/favorites');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.goto('/compare');
  await expect(page.locator('.comparison-table')).toBeVisible();
  await page.locator('.topbar select').selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.getByRole('button', { name: 'Тема' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/favorites');
  await expect(page.locator('.product-card')).toHaveCount(1);
});
test('admin login protects APIs and order status/cancellation works', async ({ page }) => {
  expect((await page.request.get('/api/admin/orders')).status()).toBe(401);
  const products = await (await page.request.get('/api/products?limit=1')).json();
  const p = products.products[0];
  const created = await page.request.post('/api/orders', {
    data: {
      customerName: 'Admin Valiyev',
      phone: '998901234567',
      items: [{ productId: p.id, quantity: p.minOrder }],
      expectedTotal: Math.round((p.discountPrice ?? p.price) * p.minOrder),
      requestId: '11111111-1111-4111-8111-111111111111',
    },
  });
  expect(created.status()).toBe(201);
  const order = (await created.json()).order;
  await login(page);
  await page.goto('/admin/orders');
  await page.getByPlaceholder('Ism, telefon yoki buyurtma raqami').fill(order.number);
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: order.number + ' buyurtmasini ko‘rish' }).click();
  await page.getByLabel('Yangi holat').selectOption('Tasdiqlandi');
  await page.getByRole('button', { name: 'Holatni saqlash' }).click();
  await expect(page.locator('.order-detail-customer .status-badge')).toHaveText('Tasdiqlandi');
  await page.getByLabel('Yangi holat').selectOption('Bekor qilindi');
  await page.getByRole('button', { name: 'Holatni saqlash' }).click();
  await page.getByRole('button', { name: 'Ha, bekor qilish' }).click();
  await expect(page.locator('.order-detail-customer .status-badge')).toHaveText('Bekor qilindi');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Umumiy ko‘rinish' })).toBeVisible();
  await page.goto('/admin/settings');
  await expect(page.getByRole('heading', { name: 'Kompaniya sozlamalari' })).toBeVisible();
  await page.goto('/admin/backups');
  await expect(page.getByRole('heading', { name: 'Zaxira nusxalar' })).toBeVisible();
});
test('admin product/category/coupon CRUD and secure image upload', async ({ page }) => {
  await login(page);
  const suffix = Date.now();
  const adminHeaders = { Origin: 'http://127.0.0.1:3001' };
  const category = await page.request.post('/api/admin/categories', {
    headers: adminHeaders,
    data: {
      name: { uz: 'E2E kategoriya' },
      group: 'metal',
      description: '',
      image: '/images/products/steel-pipes.webp',
      sort: 99,
      enabled: true,
    },
  });
  expect(category.status()).toBe(201);
  const cat = await category.json();
  const product = await page.request.post('/api/admin/products', {
    headers: adminHeaders,
    data: {
      name: { uz: 'E2E mahsulot' },
      description: { uz: 'Sinov uchun' },
      images: ['/images/products/rebar.webp'],
      categoryId: cat.id,
      code: 'E2E-' + suffix,
      manufacturer: '',
      price: 1000,
      discountPrice: null,
      stock: 20,
      minOrder: 1,
      step: 1,
      unit: 'dona',
      weight: null,
      measurements: {},
      materialType: 'Po‘lat',
      specifications: [],
      enabled: true,
      relatedIds: [],
      lowStockThreshold: 2,
      featured: false,
    },
  });
  expect(product.status()).toBe(201);
  const p = await product.json();
  const png = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#e76f32' } })
    .png()
    .toBuffer();
  const upload = await page.request.post('/api/admin/uploads', {
    headers: adminHeaders,
    multipart: { file: { name: 'test.png', mimeType: 'image/png', buffer: png } },
  });
  expect(upload.status(), await upload.text()).toBe(201);
  const image = await upload.json();
  expect((await page.request.get(image.url)).headers()['content-type']).toBe('image/webp');
  const coupon = await page.request.post('/api/admin/coupons', {
    headers: adminHeaders,
    data: {
      code: 'E2E' + suffix,
      type: 'percent',
      value: 5,
      minSubtotal: 0,
      maxDiscount: null,
      usageLimit: null,
      expiresAt: null,
      enabled: true,
    },
  });
  expect(coupon.status()).toBe(201);
  const c = await coupon.json();
  expect(
    (
      await page.request.delete('/api/admin/categories/' + cat.id, { headers: adminHeaders })
    ).status(),
  ).toBe(409);
  expect(
    (await page.request.delete('/api/admin/products/' + p.id, { headers: adminHeaders })).status(),
  ).toBe(200);
  expect(
    (
      await page.request.delete('/api/admin/categories/' + cat.id, { headers: adminHeaders })
    ).status(),
  ).toBe(200);
  expect(
    (await page.request.delete('/api/admin/coupons/' + c.id, { headers: adminHeaders })).status(),
  ).toBe(200);
  await page.goto('/admin/products');
  await page.getByPlaceholder('Nomi, kod yoki material bo‘yicha qidirish').fill('Armatura');
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);
});
test('support, SEO, unknown routes and mobile layout', async ({ page }) => {
  const support = await page.request.post('/api/support', {
    data: { name: 'Ali Valiyev', phone: '998901234567', message: 'Iltimos, men bilan bog‘laning.' },
  });
  expect(support.status()).toBe(201);
  await page.goto('/product/armatura-sample');
  await expect(page).toHaveTitle(/Armatura/);
  expect(await page.locator('script[type="application/ld+json"]').first().textContent()).toContain(
    'UZS',
  );
  expect((await page.request.get('/robots.txt')).status()).toBe(200);
  expect((await page.request.get('/sitemap.xml')).status()).toBe(200);
  expect((await page.request.get('/does-not-exist')).status()).toBe(404);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await addFirst(page);
  await page.locator('.mobile-bottom-nav').getByRole('button', { name: /Savat/ }).click();
  await page.getByRole('button', { name: 'Buyurtma berish', exact: true }).click();
  await expect(page.getByLabel('Ism va familiya', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('API rejects price tampering, cross-origin checkout and unauthorized uploads', async ({
  page,
}) => {
  const products = await (await page.request.get('/api/products?limit=1')).json();
  const p = products.products[0];
  const bad = await page.request.post('/api/orders', {
    data: {
      customerName: 'Ali Valiyev',
      phone: '998901234567',
      items: [{ productId: p.id, quantity: p.minOrder, price: 1 }],
      expectedTotal: 1,
      requestId: '22222222-2222-4222-8222-222222222222',
    },
  });
  expect(bad.status()).toBe(400);
  const cross = await page.request.post('/api/orders', {
    headers: { Origin: 'https://evil.example' },
    data: {},
  });
  expect(cross.status()).toBe(403);
  expect(
    (
      await page.request.post('/api/admin/uploads', {
        headers: { Origin: 'http://127.0.0.1:3001' },
        multipart: {
          file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('secret') },
        },
      })
    ).status(),
  ).toBe(401);
  expect((await page.request.get('/api/media/..%2Forders.json')).status()).toBe(404);
});
