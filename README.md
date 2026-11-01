# ISCHI — hisobsiz buyurtma tizimi

O‘zbek tilidagi mobil moslashuvchan do‘kon, ikki maydonli mehmon checkouti, doimiy buyurtmalar bazasi, Telegram bildirishnomalari va alohida himoyalangan administrator paneli.

**Mijozlar uchun ro‘yxatdan o‘tish, kirish, parol, email yoki mijoz hisobi yo‘q.** `/admin/login` faqat administrator uchun.

## Muhim: Vercel uchun ma’lumotlar bazasi

Vercel serverless funksiyalari lokal SQLite faylini doimiy saqlay olmaydi. Shu sababli production/Vercel uchun **Turso (libSQL)** ishlatiladi. Lokal ishlab chiqishda oddiy SQLite fayli ishlayveradi.

### Vercel + Turso sozlash

1. [Turso](https://turso.tech/) da database yarating yoki Vercel Marketplace orqali Turso integratsiyasini ulang.
2. Vercel loyihasi **Settings → Environment Variables** ga qo‘shing:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-token
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password-at-least-12-characters
TELEGRAM_BOT_TOKEN=your-new-bot-token
TELEGRAM_CHAT_ID=@Navroz0909
```

3. Vercel’da **Redeploy** qiling.
4. Tekshirish uchun `https://your-site.vercel.app/api/health` oching. `ok: true` va `storage: "turso"` bo‘lishi kerak.

Agar Turso CLI ishlatilsa:

```bash
turso db create ischi
turso db show ischi --url
turso db tokens create ischi
```

Chiqqan URL va tokenni Vercel environment variables ga joylang.

## Lokal ishga tushirish

Node.js **20.9 yoki yangi kerak** (22 LTS tavsiya etiladi).

```bash
npm ci
cp .env.example .env.local
# .env.local ichida kuchli ADMIN_PASSWORD kiriting (kamida 12 belgi).
npm run dev
```

- Do‘kon: `http://localhost:3000`
- Administrator: `http://localhost:3000/admin`
- Lokal baza: `.data/orders.sqlite`
- Health: `http://localhost:3000/api/health`

Lokal muhitda `TURSO_DATABASE_URL` bo‘sh qoldirilsa, faylli SQLite ishlatiladi. Vercel/serverless muhitida Turso sozlanmagan bo‘lsa, checkout endi umumiy “texnik xatolik” o‘rniga aniq sozlash xabarini qaytaradi.

## Server sozlamalari

| O‘zgaruvchi          | Vazifasi                                               |
| -------------------- | ------------------------------------------------------ |
| `TURSO_DATABASE_URL` | Vercel/production uchun Turso libSQL URL               |
| `TURSO_AUTH_TOKEN`   | Turso database tokeni                                  |
| `DATABASE_PATH`      | Lokal/VPS SQLite fayli; standart `.data/orders.sqlite` |
| `TELEGRAM_BOT_TOKEN` | BotFather bergan maxfiy bot tokeni                     |
| `TELEGRAM_CHAT_ID`   | Administrator chat IDsi; raqamli ID yoki `@Navroz0909` |
| `ADMIN_USERNAME`     | Administrator logini; standart `admin`                 |
| `ADMIN_PASSWORD`     | Kamida 12 belgili kuchli administrator paroli          |

Barcha qiymatlar **faqat serverda** ishlatiladi. `NEXT_PUBLIC_` prefiksini qo‘shmang. `.env.example` faqat bo‘sh namuna; unga haqiqiy token yoki parol yozmang.

### Xavfsizlik eslatmasi

Agar bot tokeni yoki administrator paroli oldin GitHub’ga commit qilingan bo‘lsa, uni **darhol almashtiring**:

- BotFather orqali bot tokenini revoke/recreate qiling.
- Administrator parolini yangilang.
- Yangi qiymatlarni faqat Vercel Environment Variables yoki lokal `.env.local` ga joylang.

Eski commit tarixida sir saqlanib qolishi mumkin; faylni keyin o‘chirish tokenni xavfsiz qilmaydi.

## Telegramni ulash

1. BotFather orqali bot yarating va tokenini `TELEGRAM_BOT_TOKEN` ga joylang.
2. `TELEGRAM_CHAT_ID` ga administrator chatini kiriting.
3. Administrator botni ochib **Start** bosishi kerak. Bot foydalanuvchiga o‘zi birinchi xabar yubora olmaydi.
4. Sinov buyurtmasini yuboring.

Telegram sozlanmagan yoki vaqtinchalik ishlamasa ham buyurtma bazaga saqlanadi. Mijozga Telegram yuborilgani haqida yolg‘on tasdiq ko‘rsatilmaydi. Administrator panelida xabar navbati va yetkazish holati ko‘rinadi.

## Xarid qilish

1. Mahsulotni savatga qo‘shish.
2. **Buyurtma berish** tugmasi checkout formasini ochadi.
3. Faqat **Ism va familiya** va **+998 XX XXX XX XX** telefon raqami kiritiladi.
4. Server ma’lumotlarni tekshiradi, narxlarni server katalogidan oladi, buyurtma va unikal raqam yaratadi.
5. Buyurtma va Telegram xabari bitta tranzaksiyada saqlanadi.
6. O‘zbek tilidagi tasdiq ko‘rsatiladi. Savat bo‘shaydi; mijoz yana hisobsiz buyurtma berishi mumkin.

Narx, email, parol, mijoz IDsi yoki boshqa keraksiz maydonlar qabul qilinmaydi. So‘rov hajmi 16 KB bilan cheklangan. Bir mahsulotdan 1–20 ta, bir buyurtmada ko‘pi bilan 20 xil mahsulot mumkin. Savat faqat mijoz qurilmasidagi `localStorage` da saqlanadi; bu mijoz hisobi emas.

## Administrator imkoniyatlari

- Barcha buyurtmalar, mijoz ismi, telefon raqami, mahsulotlar, soni va jami narx.
- Ism, telefon yoki buyurtma raqami bo‘yicha qidiruv; holat filtri va sahifalash.
- Holatni o‘zgartirish va ikki bosqichli bekor qilish.
- Yangi, faol, jami buyurtmalar va yetkazilgan buyurtmalar summasi.
- Telegram yetkazish holatlari va xavfsiz qayta urinish boshqaruvi.

Holatlar: **Yangi → Tasdiqlandi → Tayyorlanmoqda → Yetkazilmoqda → Yetkazildi**, yoki **Bekor qilindi**. `Yetkazildi` va `Bekor qilindi` yakuniy holatlar. Bir xil holatni qayta saqlash yangi xabar yaratmaydi.

Administrator sessiyasi 8 soat. Cookie `HttpOnly`, `SameSite=Strict`, HTTPSda `Secure`; bazaga faqat session token hashi yoziladi. Chiqish sessiyani bekor qiladi. Kirish urinishlari cheklangan, so‘rov manbasi tekshiriladi.

## Takroriy xabarlardan himoya

- Bitta checkout `requestId`si uchun unikal buyurtma; takroriy so‘rov avvalgi buyurtmani qaytaradi.
- Bajarilgan holat o‘zgarishigina bitta bildirishnoma voqeasini yaratadi.
- Tranzaksiyadagi `notification_outbox` qayta ishga tushirishdan keyin ham saqlanadi.
- Fon ishchisi har 30 soniyada navbatni tekshiradi.
- Yuborilgan xabar qayta yuborilmaydi. Tasdiqlangan rad etish/429 javoblari cheklangan marta qayta uriniladi.
- Timeout, uzilish yoki 5xx javobida xabar `Tekshiruv kutilmoqda` holatida qoladi; avtomatik qayta yuborilmaydi.
- Administrator Telegram chatini tekshirib, xabarni yuborilgan deb belgilashi yoki yetib bormaganini tekshirgach qayta yuborishi mumkin.

## Namoyish katalogi

`lib/catalog.ts` ichida to‘rtta **namoyish mahsuloti** va namunaviy narxlar bor. Rasmlar `/public/images` ichida AI bilan yaratilgan illustrativ tasvirlar. Ishga tushirishdan oldin katalog, narx, rasm va do‘kon matnlarini haqiqiy biznes ma’lumotlariga almashtiring.

Narxlar butun UZS sonida. Yetkazib berish haqi hisobga qo‘shilmagan: sayt yetkazish shartlarini operator tasdiqlashini aytadi. Checkout buyurtmani qabul qiladi, to‘lov olmaydi.

## Tekshiruvlar

```bash
npm run check       # TypeScript + unit/integration testlar
npm run test:e2e    # production build + brauzer testlari
```

Brauzer testlari alohida `.data/e2e.sqlite` bazasidan foydalanadi va asosiy bazani o‘zgartirmaydi. Test serveri 3001-portda ishga tushadi va test yakunida to‘xtaydi. E2E Telegram tokeni bo‘sh: testlar haqiqiy administratorga xabar yubormaydi.

## Production

Vercel uchun Yuqoridagi **Vercel + Turso** bo‘limiga amal qiling. VPS/doimiy diskli Node hostingda `DATABASE_PATH` ni doimiy diskka yo‘naltirish mumkin:

```bash
npm ci
npm run build
npm start
```

Baza va `-wal`/`-shm` fayllarini izchil zaxiralang. Bir nechta mustaqil serverless instance uchun Turso kabi umumiy doimiy baza kerak.

## Tuzilma

- `app/` — Next.js App Router sahifalari va APIlar.
- `components/storefront.tsx` — katalog, savat, ikki maydonli checkout va tasdiq.
- `components/admin-*.tsx`, `components/notifications-panel.tsx` — administrator interfeysi.
- `lib/server/db.ts` — Turso/libSQL yoki lokal SQLite, sxema va tranzaksiyalar.
- `lib/server/orders.ts` — buyurtma yaratish, qidiruv va holatlar.
- `lib/server/telegram.ts`, `notifications.ts` — o‘zbekcha xabarlar va doimiy navbat.
- `lib/server/auth.ts` — faqat administrator sessiyalari.
- `tests/`, `e2e/` — avtomatik tekshiruvlar.

Texnologiyalar: Next.js 16, React 19, TypeScript, libSQL/Turso, Zod, Lucide, lokal Manrope/DM Sans shriftlari.
