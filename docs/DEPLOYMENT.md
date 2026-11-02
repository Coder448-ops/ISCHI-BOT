# Doimiy diskli deployment

## Arxitektura

```text
Brauzer → Next.js sayt + /api/* → DATA_DIR (persistent disk)
Android WebView → o‘sha /api/* → o‘sha DATA_DIR
                         └→ Telegram Bot API
```

Mobil ilova alohida statik frontend, alohida ma’lumotlar ombori emas. Ikkala mijoz ham bitta API, narx va buyurtmalardan foydalanadi. Server JSON fayllarini brauzerga to‘g‘ridan-to‘g‘ri bermaydi.

## Vercel, Netlify, Lambda: ma’lumot qayerda turadi?

Vercel serverless funksiya diski vaqtinchalik. Instance almashsa, redeploy yoki cold start bo‘lsa, yozilgan JSON fayl yo‘qolishi mumkin. Bir nechta funksiya bir faylni ulashmaydi. Shu sababli backend Vercel/Lambda/Netlify muhitini aniqlasa, JSON omborini ochishni rad etadi (`PERSISTENT_DISK_REQUIRED`). Bu xatoni chetlab o‘tmang va `/tmp` ni doimiy disk deb hisoblamang.

Ikki to‘g‘ri yechim bor:

1. **Butun ilovani doimiy diskli serverga qo‘yish** (quyidagi Docker/Caddy yoki systemd bo‘limi). Eng sodda va tavsiya etiladi.
2. **Vercel’da faqat ko‘rinish (UI), ma’lumot esa doimiy API serverda.** Buning uchun Vercel loyihasida `API_ORIGIN` o‘rnatiladi. Sayt `/api/*` so‘rovlarini o‘sha serverga uzatadi; o‘zi hech qanday fayl saqlamaydi.

## Ko‘rgazma rejimi (API_ORIGIN berilmagan serverless hosting)

Vercel/Netlify kabi doimiy disk yo‘q hostingda `API_ORIGIN` berilmagan bo‘lsa, sayt **o‘zi bilan kelgan `seeds/*.json` kontentini faqat o‘qish uchun** ko‘rsatadi:

- homepage, 22 kategoriya, katalog (qidiruv, filtr, saralash, sahifalash), mahsulot sahifasi, galereya, UZ/RU/EN, tungi rejim, SEO — hammasi ishlaydi;
- savat va summa hisob-kitobi ishlaydi (narx serverda, `seeds` bo‘yicha), lekin **buyurtma yuborilmaydi**: `/api/orders` `503 READ_ONLY_DEMO` qaytaradi va sahifada «Buyurtmalar vaqtincha qabul qilinmaydi» ogohlantirishi chiqadi;
- `/admin` yopiq, `/api/admin/*` `403`;
- yuqorida `KO‘RGAZMA` belgisi turadi, `/api/health` esa `{"ok":true,"mode":"showcase","storage":"seeds-read-only"}` qaytaradi;
- hech qanday fayl yozilmaydi: `DATA_DIR` ochilmaydi, buyurtma yo‘qolmaydi (chunki qabul qilinmaydi).

Bu rejim API server ulanganda avtomatik o‘chadi: `API_ORIGIN` qo‘yilishi bilan sayt proksi rejimiga o‘tadi va buyurtmalar qabul qilina boshlaydi. `seeds/` fayllari serverless bundle ichiga `outputFileTracingIncludes` orqali qo‘shiladi.

## Vercel UI + doimiy API server

```text
Brauzer → Vercel (Next.js sahifalar, /api/* proksisi) → API_ORIGIN/api/* → DATA_DIR
                                                        └→ Telegram Bot API
```

**1-qadam — API server.** Yuqoridagi Docker + Caddy bo‘limi bo‘yicha `https://api.mening-dokonim.uz` manzilida backend’ni ishga tushiring. `DATA_DIR` mounted volume bo‘lsin, `PUBLIC_WEB_ORIGIN` ichiga Vercel manzilini ham yozing (vergul bilan bir nechta origin mumkin):

```bash
PUBLIC_WEB_ORIGIN=https://ischi.vercel.app
```

Admin panel ham shu sayt orqali ishlaydi, shuning uchun Vercel origin’i ro‘yxatda bo‘lishi shart.

**2-qadam — Vercel loyihasi.** Environment Variables:

| Nomi                | Qiymat                          | Izoh                                                                              |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `API_ORIGIN`        | `https://api.mening-dokonim.uz` | Faqat origin, oxirida `/` yoki `/api` bo‘lmasin. `http://` faqat localhost uchun. |
| `PUBLIC_WEB_ORIGIN` | `https://ischi.vercel.app`      | Canonical va sitemap uchun.                                                       |

`DATA_DIR`, `ADMIN_*`, `TELEGRAM_*` Vercel’ga qo‘yilmaydi: ular API serverda qoladi. Vercel’da `API_ORIGIN` bo‘sh bo‘lsa, sayt avvalgidek lokal JSON omborini ochishga urinadi va `PERSISTENT_DISK_REQUIRED` xatosini beradi.

**3-qadam — tekshirish.** `https://ischi.vercel.app/api/health` quyidagicha javob berishi kerak:

```json
{
  "ok": true,
  "mode": "proxy",
  "storage": "remote-json-files",
  "upstream": "https://api.mening-dokonim.uz"
}
```

`ok: false` va `503` — API server javob bermayapti yoki `API_ORIGIN` xato.

Proksisining cheklovlari:

- Vercel funksiyasiga kiruvchi so‘rov tanasi ~4,5 MB bilan cheklangan. Katta rasm yuklash uchun admin panelni API server domeni orqali oching yoki rasmni oldindan kichraytiring (`sharp` baribir WebP’ga aylantiradi).
- Vercel funksiyasi 60 soniyada tugashi kerak (`maxDuration` shu qiymatda).
- Yozuvlar bitta API instance’da ketadi; `DATA_DIR` bitta serverda bo‘lsin.
- Ikkala domen ham HTTPS bo‘lishi shart. Cookie `ischi_admin` birinchi tomon cookie bo‘lib qoladi, chunki brauzer faqat Vercel bilan gaplashadi.

VPS, doimiy diskli VM yoki persistent volume kafolatlangan konteyner hostingidan foydalaning. Provider panelida volume redeploy/restartdan keyin saqlanishini tekshiring. Faqat `docker run` ichidagi faylga tayanmang.

## Docker + Caddy

Talablar: Linux VPS, Docker Compose, domen, 80/443 portlari, kamida 1 GB RAM (2 GB tavsiya). DNS provayder domen orqali sertifikat olishga imkon berishi kerak.

```bash
git clone https://github.com/Coder448-ops/ISCHI-BOT.git
cd ISCHI-BOT
cp .env.example .env
chmod 600 .env
```

`.env` ni tahrirlang:

```dotenv
DOMAIN=shop.your-company.example
PUBLIC_WEB_ORIGIN=https://shop.your-company.example
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-long-unique-password
ADMIN_PASSWORD_HASH=
TELEGRAM_BOT_TOKEN=your-real-server-side-token
TELEGRAM_CHAT_ID=@Navroz0909
```

`DOMAIN` compose/Caddy uchun; qolganlari backend uchun. `DATA_DIR` compose tomonidan `/var/lib/ischi/data` ga majburan o‘rnatiladi.

```bash
docker compose up -d --build
docker compose logs --tail=100 app
curl https://shop.your-company.example/api/health
```

`ok:true` health javobi JSON ombor ochilganini bildiradi, hosting disk kafolatining o‘rnini bosmaydi. Quyidagi amaliy testni bajaring:

1. Admin orqali sinov mahsuloti yarating.
2. Sinov buyurtmasini yuboring va raqamini yozib oling.
3. `docker compose restart app` qiling.
4. Buyurtma admin panelda qolganini tekshiring.
5. `docker compose up -d --build --force-recreate app` qiling.
6. Buyurtma va rasm hali ham mavjudligini tekshiring.
7. Sinov buyurtmasini bekor qiling, sinov mahsulotini o‘chiring.

Caddy `X-Forwarded-For` ni haqiqiy client IP bilan almashtiradi. Boshqa reverse proxy ishlatsangiz, untrusted forwarded headerlarni o‘zingiz almashtiring. App portini internetga ochmang; faqat HTTPS proxy orqali kiring.

## Yangilash

```bash
# Avval OPERATIONS.md bo‘yicha off-server zaxira oling.
git pull --ff-only
docker compose up -d --build
```

Volume yangilanmaydi. `docker compose down -v`, `docker volume prune` yoki volume o‘chirish buyurtmalarni yo‘qotadi. Seedlar mavjud runtime fayllarni almashtirmaydi.

## Systemd muqobil

Node 22 o‘rnating. Repozitoriyani `/opt/ischi` ga joylang, `npm ci && npm run build` bajaring. `ischi` system user yarating. `/etc/ischi/env` faylini root:ischi, 0640 qilib env qiymatlarini kiriting. `deploy/ischi.service` ni `/etc/systemd/system/` ga ko‘chiring.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ischi
sudo systemctl status ischi
```

Nginx/Caddy orqali `127.0.0.1:3000` ga HTTPS proxy qiling. `/opt/ischi/.next/static`, `public`, `seeds` standalone server yonida mavjud bo‘lishi kerak; Dockerfile buni avtomatik bajaradi. Systemd deployda build artifacts ni saqlang.

## Sozlamalar

Admin → Kompaniya sozlamalari:

- Haqiqiy kompaniya nomi, telefon va WhatsApp.
- Haqiqiy manzil va ish vaqti.
- Ommaviy HTTPS sayt URL i (Android share linklari uchun).
- Yetkazish, to‘lov, maxfiylik, FAQ.
- Faqat rozilik olingan haqiqiy mijoz fikrlari.
- Haqiqiy mahsulotlarni kiriting, `demo` belgisini olib tashlang, so‘ng demo ogohlantirishini o‘chiring.

## Masshtab va cheklovlar

Bu ataylab database’siz, bitta instance uchun yechim. Har bir tranzaksiya fayllarni o‘qiydi/yozadi; juda katta buyurtmalar tarixi yoki yuqori parallel trafik uchun mos emas. Bir nechta app replikasi, autoscaling yoki regionlar ishlatmang. JSON hajmi va disk bo‘sh joyini monitoring qiling. Keyinroq talab oshsa, ma’lumotlarni boshqa arxitekturaga ko‘chirish alohida migratsiya loyihasi bo‘ladi.
