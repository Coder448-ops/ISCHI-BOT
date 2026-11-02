# Tekshiruv

## Avtomatik

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run build:mobile
npm run test:e2e
npm audit --audit-level=moderate
```

Unit/integration testlar vaqtinchalik `DATA_DIR` ishlatadi, asosiy ma’lumotlarni o‘zgartirmaydi. Qamrov:

- 22 kategoriya, demo belgilari, bo‘sh kontaktlar.
- Serial concurrent writes, JSON parse, multi-file crash journal recovery.
- Buzilgan/yo‘qolgan faylda fail-closed, backup retention/restore, path/serverless guard.
- 6 birlik, server pricing, min/step/stock, parallel oversell, duplicate request, altered payload.
- Coupon atomic usage, cancel-once restock, terminal status, stale total.
- Receipt token, admin scrypt/session/origin/rate limit, two-field checkout.
- Uzbek Telegram, repeated flush, timeout uncertainty, 429 backoff, crash while sending.

E2E alohida production server va vaqtinchalik diskda ishlaydi: homepage/catalog/detail, guest checkout/receipt, favorites/compare/theme/language, admin login/order status/cancel, product/category/coupon CRUD, real PNG→WebP upload, support, SEO/404, mobile overflow, unauthorized API/price tampering.

Chromium `@sparticuz/chromium` orqali npm dan keladi. CI Ubuntu’da kerakli Linux library lar bilan ishlaydi. Boshqa muhitda `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` berish mumkin.

## APK

`.github/workflows/android.yml` JDK 21, Android SDK 36, Gradle wrapper bilan `assembleDebug` yoki signing secretlar bilan `assembleRelease` bajaradi. APK va SHA-256 artifactga chiqadi. Repository variable `ANDROID_API_URL` bo‘lmasa build ataylab to‘xtaydi.

Real qurilmada tekshiring: o‘rnatish, cold start, internet uzilishi, orqa tugasi, keyboard, kichik ekran, mahsulot rasmlari, kupon, buyurtma, sayt adminida ko‘rinish, app restartdan keyin savat/kvitansiya.

## Qo‘lda production smoke test

- Hosting restart/redeploydan keyin order qoladi.
- Admin HTTPS cookie Secure/HttpOnly/Strict.
- Telegram `/start`, verify, test; yangi/status/cancel xabarlari faqat o‘zbekcha.
- Ikki marta submit bitta order; savat o‘zgarsa yangi order.
- Admin narxni o‘zgartirsa eski checkout total rad etiladi.
- Kupon limiti, bekor qilish, qoldiq qaytishi.
- Rasm yuklash, noto‘g‘ri fayl rad etilishi.
- O‘zgartirilgan kontaktlar saytda ko‘rinadi, demo belgisi o‘chiriladi.
- Zaxira olish va alohida test serverda tiklash.

## Halol cheklovlar

Real Telegram delivery foydalanuvchining tokeni va `/start` siz tekshirilmaydi. Real Android compile GitHub Actions da, real qurilma testi sizning telefoningizda bajariladi. Hosting disk doimiyligi provider kafolati va amaliy redeploy testi bilan tasdiqlanadi. Ushbu testlar barcha xavfsizlik yoki uzluksizlik kafolatini bermaydi.
