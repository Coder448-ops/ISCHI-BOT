# ISCHI Industrial

Bitta kompaniya uchun metall prokati va qurilish materiallari do‘koni. Mijoz hisobi yo‘q: xarid qilish uchun faqat **ism va familiya** hamda **telefon raqami** yetarli. Administrator paneli alohida himoyalangan.

**Ma’lumotlar bazasi ishlatilmaydi.** Barcha katalog, buyurtma, kupon, sozlama va bildirishnomalar serverdagi JSON fayllarda saqlanadi. Sayt va Android ilova bitta backend API dan foydalanadi.

> Bu demo katalog bilan keladi: 22 kategoriya, 22 namoyish mahsuloti, namunaviy narxlar va AI bilan yaratilgan mahsulot rasmlari. Kompaniya telefoni, manzili va mijoz fikrlari to‘qib chiqarilmagan. Ishga tushirishdan oldin administrator haqiqiy ma’lumotlarni kiritadi.

## Imkoniyatlar

- O‘zbek/rus/ingliz interfeysi, o‘zbek tili asosiy; qorong‘i/yorug‘ rejim.
- 13 metall + 9 qurilish kategoriyasi, yangi kategoriyalar qo‘shish.
- Ko‘p rasmlar, kod, ishlab chiqaruvchi, narx/chegirma, qoldiq, minimal buyurtma, qadam, og‘irlik, uzunlik, kenglik, qalinlik, diametr, material, texnik xususiyatlar va o‘xshash mahsulotlar.
- Har bir mahsulot uchun `kg`, `ton`, `m`, `m²`, `dona`, `qop` birligi.
- Qidiruv, filtr, saralash, katak/ro‘yxat, sahifalash, galereya, savat, kuponlar.
- Sevimlilar, 4 tagacha taqqoslash, yaqinda ko‘rilganlar, qurilmada buyurtma kvitansiyalari.
- Mehmon buyurtmasi, serverda narx hisoblash, qoldiq band qilish, takroriy so‘rovdan himoya.
- O‘zbek tilidagi Telegram xabarlari, persistent outbox, bekor qilish va holat xabarlari.
- Administrator: statistika, mahsulot/kategoriya/kupon/rasm/sozlama/buyurtma/yordam/xabar/zaxira boshqaruvi.
- Capacitor Android, statik Vite WebView, GitHub Actions orqali APK.
- Docker/Caddy bilan doimiy diskli deploy, JSON jurnali, atomik yozuv, zaxira va tiklash.

## Muhim: qayerda ishlaydi?

**Ma’lumot doimiy diskda turishi shart.** Vercel, Netlify Functions va AWS Lambda diski vaqtinchalik: yangi instance, qayta deploy yoki sovuq start JSON buyurtmalarni yo‘qotadi. Shu sababli backend bu muhitlarda `PERSISTENT_DISK_REQUIRED` bilan ataylab ishlashni rad etadi.

Ikki yo‘l bor:

- **Tavsiya:** butun ilovani Docker/Caddy bilan doimiy diskli VPS’ga qo‘yish.
- **Vercel’da faqat UI:** doimiy API serverni alohida ko‘tarib, Vercel’da `API_ORIGIN` o‘rnatish. Sayt `/api/*` so‘rovlarini o‘sha serverga uzatadi va o‘zi hech narsa saqlamaydi. Batafsil: [Deployment](docs/DEPLOYMENT.md#vercel-ui--doimiy-api-server).

Docker volume yoki VPS diskida ishlatish uchun mo‘ljallangan. Hosting provayderi diskning doimiyligini kafolatlashi shart. `DATA_DIR` oddiy konteyner ichida emas, mounted volume ichida bo‘lsin. Bir vaqtda **bitta backend instance** ishlating. JSON ombori kichik/o‘rta do‘kon uchun; yuq yuk yoki ko‘p serverli arxitektura uchun mos emas.

Batafsil: [Deployment](docs/DEPLOYMENT.md) · [Android](docs/ANDROID.md) · [API](docs/API.md) · [Xavfsizlik va tiklash](docs/OPERATIONS.md) · [Tekshiruv](docs/TESTING.md).

## Lokal ishga tushirish

Node.js **22.12+** kerak.

```bash
npm ci
cp .env.example .env.local
# .env.local ichida ADMIN_PASSWORD ga kuchli noyob parol kiriting.
npm run dev
```

- Do‘kon: `http://localhost:3000`
- Administrator: `http://localhost:3000/admin`
- Birinchi startda `seeds/` fayllari `DATA_DIR` ga ko‘chiriladi. Keyingi startlarda mavjud fayllar qayta yozilmaydi.
- `data/` Git’ga kiritilmaydi. Unda mijoz ma’lumotlari va maxfiy kvitansiya kaliti bor.
- `.env.local` ni hech qachon commit qilmang.

Parol hashini terminalda yaratish:

```bash
npm run admin:hash
```

Chiqqan `ADMIN_PASSWORD_HASH` ni server muhitiga joylang va `ADMIN_PASSWORD` ni bo‘sh qoldiring.

## Asosiy buyruqlar

```bash
npm run typecheck
npm test                 # JSON, xavfsizlik, buyurtma, Telegram testlari
npm run build            # Next.js server sayti
npm run build:mobile     # statik Android frontend
npm run test:e2e         # production server + Chromium E2E
npm run check            # typecheck, unit, website va mobile build
npm audit
```

## Production Docker deploy

1. DNS A/AAAA yozuvini haqiqiy VPS IP manziliga qarating.
2. `.env.example` dan `.env` yarating; kuchli admin paroli, Telegram tokeni va haqiqiy domenni kiriting.
3. `.env` faylida `DOMAIN=shop.your-company.example` ni o‘z domeningizga almashtiring.
4. Quyidagilarni bajaring:

```bash
docker compose up -d --build
docker compose ps
curl https://YOUR-REAL-DOMAIN/api/health
```

Caddy HTTPS sertifikatini oladi. `shop-data` volume buyurtmalar, katalog, rasmlar va zaxiralarni saqlaydi. **`docker compose down -v` buyurtmalarni o‘chiradi — ishlatmang.** Off-server zaxira hali ham zarur.

## Telegram

`TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` faqat serverda. Standart qabul qiluvchi `@Navroz0909`. Shaxsiy chat uchun administrator BotFather botini ochib `/start` bosadi; ishonchli usul — `getChat` orqali olingan raqamli chat ID ni env’ga joylash. Guruh bo‘lsa, botni guruhga qo‘shing va guruh ID sidan foydalaning.

Panel → Kompaniya sozlamalari → Ulanishni tekshirish → Sinov xabari. Xabar yuborilmasa buyurtma baribir JSON’ga saqlanadi. Admin Telegram navbatini ko‘radi. Tarmoq javobi noaniq bo‘lsa, takroriy xabar yubormaslik uchun administrator chatni tekshiradi. Telegram exactly-once kafolatini bermagani uchun “kafolatlangan bir marta” deb da’vo qilinmaydi.

## Android APK

Android Studio talab qilinmaydi. GitHub repository Settings → Secrets and variables → Actions → Variables bo‘limida `ANDROID_API_URL` ga haqiqiy `https://...` backend origin kiriting. **Android APK** workflow ni ishga tushiring. Debug APK artifact sifatida chiqadi. Signed release uchun to‘rtta signing secret kerak; kalitlar Git’ga yoki APK ichiga kiritilmaydi.

Mobil frontend `mobile/` + Vite orqali statik quriladi. Next.js server sahifalari WebView ichida ishlamaydi. Ilova `/api/*` ni hosted backend’dan oladi. Backend URL ni o‘zgartirish APK ni qayta qurishni talab qiladi.

## Checkout va buyurtmalar

Mijozdan email, parol yoki hisob so‘ralmaydi. Telefon `+998 XX XXX XX XX`. Server mahsulot narxi, qoldiq, minimal miqdor, qadam va kuponni o‘zi tekshiradi. Mijoz yuborgan narxga ishonilmaydi. Kvitansiya maxfiy tokeni faqat shu qurilmada saqlanadi.

Holatlar: **Yangi buyurtma → Tasdiqlandi → Tayyorlanmoqda → Yetkazilmoqda → Yetkazildi**. Istalgan yakunlanmagan bosqichdan **Bekor qilindi** ga o‘tish mumkin. Bekor qilish qoldiq va kupon limitini bir marta qaytaradi. Yakunlangan buyurtma holati o‘zgarmaydi.

Yetkazish/to‘lov operator bilan kelishiladi. Onlayn to‘lov, SMS gateway yoki yetkazish xizmati integratsiyasi yo‘q; ular ishlayotgani haqida soxta tugmalar ko‘rsatilmaydi.

## Katalog va fayllar

- `seeds/`: faqat birinchi ishga tushirish uchun namunalar.
- `DATA_DIR/*.json`: haqiqiy runtime ma’lumotlar.
- `DATA_DIR/uploads/`: admin yuklagan WebP rasmlar.
- `DATA_DIR/backups/`: oxirgi 40 tranzaksiya zaxirasi.
- `DATA_DIR/.journals/`: crash recovery jurnali.
- `public/images/`: demo/optimize qilingan statik rasmlar.
- `assets/` va `android/`: Android ikon/splash/native loyiha.

## Git va eski deploy

Bu repozitoriy avval boshqa saqlash usullari bilan ishlagan. Eski deployni yangilashdan oldin zaxira oling. Ushbu versiya eski backend ma’lumotlarini avtomatik JSON’ga ko‘chirmaydi. Eski muhit o‘zgaruvchilari kerak emas. Git tarixida oldin noto‘g‘ri joylangan maxfiy qiymatlar qolgan bo‘lishi mumkin: bot tokeni va admin parolini almashtiring, tarixni tozalashni alohida rejalashtiring.

## Litsenziya va maxfiylik

Kod litsenziyasi repozitoriy egasiga tegishli. Demo rasmlar AI yordamida yaratilgan. Ishlab chiqarishda faqat foydalanish huquqi bo‘lgan haqiqiy mahsulot rasmlarini joylang. Mijoz ism/telefoni shaxsiy ma’lumot: kirishni cheklang, HTTPS ishlating, zaxiralarni shifrlang va kompaniyangizning rasmiy maxfiylik siyosatini kiriting.
