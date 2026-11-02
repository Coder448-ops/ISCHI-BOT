# API

Base URL: `https://your-real-domain`. Barcha javoblar JSON (media bundan mustasno). Xatolar `{error, field?, code?, reference?}`. Admin javoblari `Cache-Control: no-store`.

## Public

| Method | Path                    | Vazifa                                           |
| ------ | ----------------------- | ------------------------------------------------ |
| GET    | `/api/health`           | JSON ombor, admin/Telegram sozlanganligi         |
| GET    | `/api/bootstrap`        | Sozlamalar, kategoriyalar, homepage mahsulotlari |
| GET    | `/api/products`         | Katalog                                          |
| GET    | `/api/products/:id`     | Mahsulot va o‘xshashlar                          |
| POST   | `/api/quote`            | Serverda joriy narx/chegirma                     |
| POST   | `/api/orders`           | Mehmon buyurtmasi                                |
| GET    | `/api/orders/:id`       | Kvitansiya, `X-Order-Token` header kerak         |
| POST   | `/api/support`          | Qo‘ng‘iroq/yordam arizasi                        |
| GET    | `/api/media/:uuid.webp` | Yuklangan rasm                                   |

Katalog query: `q`, `category`, `minPrice`, `maxPrice`, `availability=in|out|discount`, `material`, `thicknessMin/Max`, `lengthMin/Max`, `diameterMin/Max`, `sort=newest|popular|price-asc|price-desc`, `page`, `limit` (1–48), `ids` (vergul bilan).

`POST /api/quote`:

```json
{ "items": [{ "productId": "armatura-sample", "quantity": 500 }], "couponCode": "" }
```

`POST /api/orders`:

```json
{
  "customerName": "Ism Familiya",
  "phone": "+998 90 123 45 67",
  "items": [{ "productId": "armatura-sample", "quantity": 500 }],
  "expectedTotal": 6250000,
  "requestId": "replace-with-a-random-uuid",
  "couponCode": ""
}
```

Misol summasi namunaviy; avval `/quote` javobidagi haqiqiy `total` dan foydalaning. `expectedTotal` o‘zgarsa 409 qaytadi, mijoz yangi summani tasdiqlashi kerak. Mijoz yuborgan narx qabul qilinmaydi. `requestId` bir xil payload uchun qayta urinishda saqlanadi; savat/kontakt/kupon o‘zgarsa yangilanadi. Bir xil ID bilan boshqa payload 409 oladi. Bir mijoz boshqa UUID bilan yana buyurtma bera oladi.

Muvaffaqiyat: `{order, receiptToken}`. Tokenni qurilmada saqlang, public URL ga qo‘shmang. Kvitansiya javobida `requestId` va ichki fingerprint yo‘q.

`POST /api/support`: `{name, phone, message}`.

## Admin

`POST /api/admin/login` with `{username,password}` HttpOnly/Strict cookie o‘rnatadi. HTTPS da Secure. Sessiya 8 soat, serverda faqat token hash saqlanadi. Admin mutatsiyalarida same-origin `Origin` header talab qilinadi. Mobile origin faqat public API uchun ruxsat etiladi.

| Method           | Path                                           | Vazifa                                               |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------- |
| GET              | `/api/admin/session`                           | Sessiya                                              |
| POST             | `/api/admin/logout`                            | Chiqish                                              |
| GET              | `/api/admin/overview`                          | Haqiqiy statistika                                   |
| GET/POST         | `/api/admin/products`                          | Ro‘yxat/yaratish                                     |
| GET/PATCH/DELETE | `/api/admin/products/:id`                      | Bitta mahsulot                                       |
| GET/POST         | `/api/admin/categories`                        | Kategoriya                                           |
| GET/PATCH/DELETE | `/api/admin/categories/:id`                    | Tahrirlash/o‘chirish                                 |
| GET/POST         | `/api/admin/coupons`                           | Kupon                                                |
| GET/PATCH/DELETE | `/api/admin/coupons/:id`                       | Tahrirlash/o‘chirish                                 |
| GET/PATCH        | `/api/admin/settings`                          | Kompaniya sozlamalari                                |
| POST             | `/api/admin/uploads`                           | Multipart `file`, JPG/PNG/WebP, 5 MB                 |
| GET              | `/api/admin/orders?q=&status=&from=&to=&page=` | Qidiruv/filtr                                        |
| PATCH            | `/api/admin/orders/:id`                        | `{status,expectedStatus}`                            |
| GET              | `/api/admin/support`                           | Arizalar                                             |
| PATCH            | `/api/admin/support/:id`                       | `{resolved}`                                         |
| GET/POST         | `/api/admin/notifications`                     | Outbox / flush / retry / resolve                     |
| POST             | `/api/admin/telegram`                          | `{action:"verify"                                    | "test"}` |
| GET/POST         | `/api/admin/backups`                           | Zaxiralar / `{id}` bilan butun tranzaksiyani tiklash |

Mahsulot/kategoriya/kupon POST body to‘liq model bo‘lsin; identifikator serverda slug orqali yaratiladi. PATCH mavjud modelni to‘liq yangilaydi. Rasm yo‘llari faqat ruxsat etilgan statik katalog yoki `/api/media/<uuid>.webp`. Tashqi URL, SVG va path traversal rad etiladi.

Buyurtma holatlari aynan: `Yangi buyurtma`, `Tasdiqlandi`, `Tayyorlanmoqda`, `Yetkazilmoqda`, `Yetkazildi`, `Bekor qilindi`. `expectedStatus` race holatini 409 bilan to‘xtatadi.

## CORS va limitlar

Public API Capacitor `https://localhost` originiga ruxsat beradi. Brauzer sayti same-origin yoki `PUBLIC_WEB_ORIGIN` dan keladi. Cookie credentials mobil API ga yuborilmaydi. Admin API boshqa originlarga ochilmaydi.

JSON body 64 KB; rasm 5 MB, 24 megapixel, 1600×1600 gacha WebP. Rate limitlar: login 8/15 min/IP, order 20/10 min/IP, support 5/10 min/IP, quote 100/10 min/IP, admin write 120/min/IP. Bular bitta jarayon xotirasida; restartda tozalanadi. Reverse proxy haqiqiy IP headerini almashtirishi shart.
