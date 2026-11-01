# ISCHI — hisobsiz buyurtma tizimi

O‘zbek tilidagi mobil moslashuvchan do‘kon, ikki maydonli mehmon checkouti, SQLite buyurtmalar bazasi, Telegram bildirishnomalari va alohida himoyalangan administrator paneli.

**Mijozlar uchun ro‘yxatdan o‘tish, kirish, parol, email yoki mijoz hisobi yo‘q.** `/admin/login` faqat administrator uchun.

## Ishga tushirish

Node.js **22.13 yoki yangi kerak** (22 LTS tavsiya etiladi). SQLite Node.js ichidagi `node:sqlite` orqali ishlaydi; alohida ma’lumotlar bazasi serveri kerak emas. Node 22 da SQLite uchun experimental ogohlantirish chiqishi mumkin.

```bash
npm ci
cp .env.example .env.local
# .env.local faylida kuchli ADMIN_PASSWORD kiriting (kamida 12 belgi).
npm run dev
```

- Do‘kon: `http://localhost:3000`
- Administrator: `http://localhost:3000/admin`
- Baza: `.data/orders.sqlite` (standart)

Ushbu Arena muhitida `.env.local` allaqachon tasodifiy kuchli administrator paroli bilan yaratilgan. U Gitga kiritilmaydi. Mahalliy administrator logini `admin`; parolni workspace ichidagi `.env.local` faylidan oling. Bu maxfiy faylni ommaviy chatga yoki repozitoriyga joylamang.

## Server sozlamalari

| O‘zgaruvchi          | Vazifasi                                                         |
| -------------------- | ---------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | BotFather bergan maxfiy bot tokeni                               |
| `TELEGRAM_CHAT_ID`   | Administrator chat IDsi; afzalroq raqamli ID, yoki `@Navroz0909` |
| `ADMIN_USERNAME`     | Administrator logini (standart: `admin`)                         |
| `ADMIN_PASSWORD`     | Kamida 12 belgili kuchli administrator paroli                    |
| `DATABASE_PATH`      | SQLite fayli; productionda doimiy diskdagi mutlaq yo‘l           |

Barcha qiymatlar **faqat serverda** ishlatiladi. `NEXT_PUBLIC_` prefiksini qo‘shmang. Haqiqiy token yoki parolni repozitoriyga yozmang.

### Telegramni ulash

1. BotFather orqali bot yarating va tokenini `TELEGRAM_BOT_TOKEN` ga joylang.
2. `TELEGRAM_CHAT_ID=@Navroz0909` ni saqlang yoki administratorning raqamli chat IDsidan foydalaning.
3. **@Navroz0909 egasi botni ochib, Start tugmasini bosishi kerak.** Bot oddiy foydalanuvchiga o‘zi birinchi xabar yubora olmaydi. Username ishlamasa, administrator botga `/start` yuborgan chatning raqamli IDsi bilan almashtiring.
4. Serverni qayta ishga tushiring va sinov buyurtmasini yuboring.

Telegram sozlanmagan yoki vaqtinchalik ishlamasa ham buyurtma bazaga saqlanadi. Mijozga Telegram yuborilgani haqida yolg‘on tasdiq ko‘rsatilmaydi. Administrator panelida xabar navbati va yetkazish holati ko‘rinadi.

Bu muhitda haqiqiy bot tokeni berilmagan: real Telegram yetkazish tekshirilmagan. API adapteri, navbat, takroriy yuborishdan himoya va xato holatlari avtomatik testlarda tekshiriladi. Tashqi joylashtirishda `api.telegram.org` ga chiqish imkoniyati kerak.

## Xarid qilish

1. Mahsulotni savatga qo‘shish.
2. **Buyurtma berish** tugmasi checkout formasini ochadi.
3. Faqat **Ism va familiya** va **+998 XX XXX XX XX** telefon raqami kiritiladi.
4. Server ma’lumotlarni tekshiradi, mahsulot narxlarini server katalogidan oladi, buyurtma va unikal raqam yaratadi.
5. Buyurtma va Telegram xabari bitta SQLite tranzaksiyasida saqlanadi.
6. O‘zbek tilidagi tasdiq ko‘rsatiladi. Savat bo‘shaydi; mijoz yana hisobsiz buyurtma berishi mumkin.

Narx, email, parol, mijoz IDsi yoki boshqa keraksiz maydonlar qabul qilinmaydi. So‘rov hajmi 16 KB bilan cheklangan. Bir mahsulotdan 1–20 ta, bir buyurtmada ko‘pi bilan 20 xil mahsulot mumkin. Savat faqat mijoz qurilmasidagi `localStorage` da saqlanadi; bu mijoz hisobi emas.

## Administrator imkoniyatlari

- Barcha buyurtmalar, mijoz ismi, telefon raqami, mahsulotlar, soni va jami narx.
- Ism, telefon yoki buyurtma raqami bo‘yicha qidiruv; holat filtri va sahifalash.
- Holatni o‘zgartirish va ikki bosqichli bekor qilish.
- Yangi, faol, jami buyurtmalar va yetkazilgan buyurtmalar summasi.
- Telegram yetkazish holatlari va xavfsiz qayta urinish boshqaruvi.
- Mobil moslashuvchan panel; buyurtmalar PIIsi ochiq APIda ko‘rinmaydi.

Holatlar: **Yangi → Tasdiqlandi → Tayyorlanmoqda → Yetkazilmoqda → Yetkazildi**, yoki **Bekor qilindi**. Faol buyurtmada boshqa faol holatni ham tanlash mumkin. `Yetkazildi` va `Bekor qilindi` yakuniy holatlar. Bir xil holatni qayta saqlash yangi xabar yaratmaydi.

Administrator sessiyasi 8 soat davom etadi. Cookie `HttpOnly`, `SameSite=Strict`, HTTPSda `Secure`; bazaga faqat tasodifiy session token hashi yoziladi. Chiqish sessiyani bekor qiladi. Kirishda urinishlar cheklangan, so‘rov manbasi tekshiriladi. Kuchli parol va HTTPS bilan joylashtiring; ishonchli reverse proxy orqasida haqiqiy `X-Forwarded-Host` / `X-Forwarded-Proto` / `X-Forwarded-For` qiymatlarini o‘rnating.

## Takroriy xabarlardan himoya

- Bitta checkout `requestId`si uchun unikal buyurtma; takroriy so‘rov avvalgi buyurtmani qaytaradi.
- Bajarilgan holat o‘zgarishigina bitta bildirishnoma voqeasini yaratadi.
- Tranzaksiyadagi `notification_outbox` qayta ishga tushirishdan keyin ham saqlanadi.
- Fon ishchisi har 30 soniyada navbatni tekshiradi; buyurtma va statusdan keyin ham ishga tushadi.
- Yuborilgan xabar qayta yuborilmaydi. Tasdiqlangan rad etish/429 javoblari cheklangan marta qayta uriniladi.
- Timeout, uzilish, 5xx yoki process uzilishida xabar Telegramga borgan-bormagani noma’lum bo‘lishi mumkin. Telegram Bot API idempotency kalitini bermagani uchun bunday xabar **avtomatik qayta yuborilmaydi**. U `Tekshiruv kutilmoqda` holatida qoladi; keyingi xabarlar ham tartibini saqlaydi.
- Administrator Telegram chatini tekshirib, xabarni yuborilgan deb belgilashi yoki yetib bormaganini tekshirgach qayta yuborishi mumkin. Bu ikkinchi amal ochiq ogohlantirish va tasdiqlash bilan bajariladi.

Bu tizim bir xil buyurtma voqeasining takroriy navbatga olinishini va ma’lum yetkazilgan xabar qayta yuborilishini oldini oladi. Tarmoq javobi noaniq bo‘lganda tashqi Telegram APIning o‘zi kafolatli exactly-once yetkazishni bermaydi.

## Namoyish katalogi

Boshlang‘ich repozitoriy bo‘sh bo‘lgani uchun `lib/catalog.ts` ichida to‘rtta **namoyish mahsuloti** va namunaviy narxlar bor. Rasmlar `/public/images` ichida AI bilan yaratilgan illustrativ mahsulot tasvirlari; haqiqiy sotuvchi mahsulot rasmlari emas. Ishga tushirishdan oldin katalog, narx, rasm va do‘kon matnlarini haqiqiy biznes ma’lumotlariga almashtiring. Namoyish yozuvi sayt footerida ko‘rsatilgan.

Narxlar butun UZS sonida. Yetkazib berish haqi hisobga qo‘shilmagan: sayt yetkazish shartlarini operator tasdiqlashini aytadi. Checkout buyurtmani qabul qiladi, to‘lov olmaydi.

## Tekshiruvlar

```bash
npm run check       # TypeScript + 22 unit/integration test
npm run test:e2e    # production build + haqiqiy brauzer testlari
```

Brauzer testlari npm orqali olinadigan Chromium bilan ishlaydi, alohida `.data/e2e.sqlite` bazasidan foydalanadi va asosiy bazani o‘zgartirmaydi. Test serveri 3001-portda ishga tushadi va test yakunida to‘xtaydi. E2E Telegram tokeni bo‘sh: testlar haqiqiy administratorga xabar yubormaydi.

Qamrov: ism/telefon validatsiyasi, server narxlari, mehmonning ketma-ket buyurtmalari, idempotency, buyurtma qidiruvi, holatlar, administrator autentifikatsiyasi va sessiyani bekor qilish, CSRF, so‘rov hajmi, mobil checkout, Telegram navbati va noaniq javoblarda qayta yuborishdan himoya.

## Production va saqlash

```bash
npm ci
npm run build
npm start
```

`DATABASE_PATH` ni doimiy diskka yo‘naltiring, masalan `/var/lib/ischi/orders.sqlite`. Konteynerning vaqtinchalik filesystemiga tayanmang. Baza va `-wal`/`-shm` fayllarini izchil zaxiralang (SQLite backup API yoki server to‘xtatilganida fayl nusxasi). Bir nechta mustaqil konteynerga emas, bitta doimiy diskli Node serveriga mos; gorizontal masshtablash uchun umumiy PostgreSQL/Redis kabi alohida saqlash va navbat joriy qiling.

Qo‘shimcha himoya qatlami sifatida reverse proxyda so‘rov tezligini cheklang va TLSni majburiy qiling. Administrator parolini muntazam almashtiring. Maxfiy qiymatlar hech qachon mijoz JavaScript bundleiga kiritilmaydi.

## Tuzilma

- `app/` — Next.js App Router sahifalari va APIlar.
- `components/storefront.tsx` — katalog, savat, ikki maydonli checkout va tasdiq.
- `components/admin-*.tsx`, `components/notifications-panel.tsx` — administrator interfeysi.
- `lib/server/db.ts` — SQLite sxemasi va tranzaksiyalar.
- `lib/server/orders.ts` — buyurtma yaratish, qidiruv va holatlar.
- `lib/server/telegram.ts`, `notifications.ts` — oddiy o‘zbekcha xabarlar va doimiy navbat.
- `lib/server/auth.ts` — faqat administrator sessiyalari.
- `tests/`, `e2e/` — avtomatik tekshiruvlar.

Texnologiyalar: Next.js 16, React 19, TypeScript, Node SQLite, Zod, Lucide, lokal Manrope/DM Sans shriftlari. Mijoz tomonida tashqi font yoki rasm CDNiga bog‘liqlik yo‘q.
