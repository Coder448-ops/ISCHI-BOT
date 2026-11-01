# ISCHI — hisobsiz buyurtma tizimi

O‘zbek tilidagi mobil moslashuvchan do‘kon, ikki maydonli mehmon checkouti, PostgreSQL buyurtmalar bazasi, Telegram bildirishnomalari va alohida himoyalangan administrator paneli.

**Mijozlar uchun ro‘yxatdan o‘tish, kirish, parol, email yoki mijoz hisobi yo‘q.** `/admin/login` faqat administrator uchun.

## Muhim: Vercel uchun PostgreSQL

Vercel serverless funksiyalari lokal fayl bazasini doimiy saqlay olmaydi. Shu sababli buyurtmalar **PostgreSQL** da saqlanadi. Neon, Supabase yoki Vercel Marketplace’dagi PostgreSQL xizmatidan foydalanish mumkin.

### Vercel + PostgreSQL sozlash

1. PostgreSQL database yarating: masalan [Neon](https://neon.tech/), [Supabase](https://supabase.com/) yoki Vercel Marketplace PostgreSQL integratsiyasi.
2. Vercel loyihasi **Settings → Environment Variables** ga qo‘shing:

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password-at-least-12-characters
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=@Navroz0909
```

Agar integratsiya `POSTGRES_URL` bersa, uni ham ishlatish mumkin. `DATABASE_URL` birinchi o‘rinda tekshiriladi.

3. Vercel’da **Redeploy** qiling.
4. Tekshirish uchun `https://your-site.vercel.app/api/health` oching. `ok: true` va `storage: "postgresql"` bo‘lishi kerak.

Jadvallar birinchi ulanishda avtomatik yaratiladi. Alohida migration bosqichi talab qilinmaydi.

## Lokal ishga tushirish

Node.js **20.9 yoki yangi kerak** (22 LTS tavsiya etiladi). Lokal ishlab chiqish uchun ham PostgreSQL kerak.

Docker orqali tez baza:

```bash
docker run --name ischi-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ischi \
  -p 5432:5432 -d postgres:16
```

So‘ng:

```bash
npm ci
cp .env.example .env.local
```

`.env.local` ichida:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ischi
ADMIN_USERNAME=admin
ADMIN_PASSWORD=kamida-12-belgili-kuchli-parol
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=@Navroz0909
```

Ishga tushirish:

```bash
npm run dev
```

- Do‘kon: `http://localhost:3000`
- Administrator: `http://localhost:3000/admin`
- Health: `http://localhost:3000/api/health`

Agar PostgreSQL sozlanmagan bo‘lsa, checkout umumiy “texnik xatolik” o‘rniga aniq sozlash xabarini qaytaradi.

## Server sozlamalari

| O‘zgaruvchi          | Vazifasi                                                         |
| -------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL ulanish manzili; Vercel va lokal ishlab chiqish uchun |
| `POSTGRES_URL`       | Muqobil PostgreSQL ulanish manzili; `DATABASE_URL` bo‘lmasa      |
| `TELEGRAM_BOT_TOKEN` | BotFather bergan maxfiy bot tokeni                               |
| `TELEGRAM_CHAT_ID`   | Administrator chat IDsi; raqamli ID yoki `@Navroz0909`           |
| `ADMIN_USERNAME`     | Administrator logini; standart `admin`                           |
| `ADMIN_PASSWORD`     | Kamida 12 belgili kuchli administrator paroli                    |

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

Testlar PostgreSQL sintaksisini dev-only PGlite orqali ishga tushiradi va tashqi database talab qilmaydi. Brauzer testlari alohida vaqtinchalik bazadan foydalanadi va asosiy bazani o‘zgartirmaydi. Test serveri 3001-portda ishga tushadi va test yakunida to‘xtaydi. E2E Telegram tokeni bo‘sh: testlar haqiqiy administratorga xabar yubormaydi.

## Production

Vercel uchun yuqoridagi **Vercel + PostgreSQL** bo‘limiga amal qiling. Boshqa Node hostingda ham `DATABASE_URL` orqali PostgreSQLga ulanish mumkin:

```bash
npm ci
npm run build
npm start
```

PostgreSQL bazasini muntazam zaxiralang. Serverless muhitda ulanishlar sonini nazorat qilish uchun pooling/rejimdan foydalaning; kerak bo‘lsa `DATABASE_POOL_MAX` bilan maksimum ulanishlar sonini kamaytirish mumkin.

## Tuzilma

- `app/` — Next.js App Router sahifalari va APIlar.
- `components/storefront.tsx` — katalog, savat, ikki maydonli checkout va tasdiq.
- `components/admin-*.tsx`, `components/notifications-panel.tsx` — administrator interfeysi.
- `lib/server/db.ts` — PostgreSQL pool, sxema va tranzaksiyalar.
- `lib/server/orders.ts` — buyurtma yaratish, qidiruv va holatlar.
- `lib/server/telegram.ts`, `notifications.ts` — o‘zbekcha xabarlar va doimiy navbat.
- `lib/server/auth.ts` — faqat administrator sessiyalari.
- `tests/`, `e2e/` — avtomatik tekshiruvlar.

Texnologiyalar: Next.js 16, React 19, TypeScript, PostgreSQL, Zod, Lucide, lokal Manrope/DM Sans shriftlari.
