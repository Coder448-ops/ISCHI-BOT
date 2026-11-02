# Xavfsizlik, zaxira va tiklash

## Saqlash kafolatlari va chegaralari

- `DATA_DIR` faqat serverda. Public/build papkalari va aniqlangan serverless muhitlar rad etiladi.
- Har bir yozuvdan oldin schema va bog‘lanishlar tekshiriladi.
- Bir jarayonda navbat, jarayonlar orasida `proper-lockfile` write lock. Bu bir mounted diskdagi jarayonlar uchun; bir nechta mustaqil server uchun distributed lock emas.
- Avval o‘zgargan fayllar zaxirasi, keyin fsync qilingan jurnal, keyin temp fayl + fsync + atomic rename + directory fsync.
- Restartda tugallanmagan jurnal qayta qo‘llanadi. Buyurtma/qoldiq/kupon/outbox bir tranzaksiyada.
- Buzilgan yoki yo‘qolgan runtime fayl seed bilan almashtirilmaydi. Xato beradi; zaxiradan tiklang.
- Oxirgi 40 tranzaksiya zaxirasi mtime bo‘yicha saqlanadi. Bu off-server zaxira o‘rnini bosmaydi.
- Disk to‘lsa yoki ruxsat yo‘q bo‘lsa, buyurtma muvaffaqiyatli deb ko‘rsatilmaydi.

Ushbu yechim elektr uzilishi, filesystem, operator xatosi yoki disk yo‘qolishidan to‘liq himoya kafolati bermaydi. Hosting SLA, disk monitoring, UPS/provider redundancy va off-server zaxira sizning javobgarligingiz.

## Off-server zaxira

Eng oddiy izchil usul — qisqa maintenance oynasida app ni to‘xtatib volume nusxasini olish:

```bash
mkdir -p ~/ischi-offsite-backups
docker compose stop app
docker run --rm \
  -v ischi-industrial_shop-data:/source:ro \
  -v "$HOME/ischi-offsite-backups:/backup" \
  alpine tar -czf /backup/ischi-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /source .
docker compose start app
```

Volume nomi `docker volume ls` bilan tekshiriladi. Arxivda mijoz ism/telefoni, sessiya hashlari va receipt secret bor. Shifrlang, kirishni cheklang, alohida joyga ko‘chiring, muntazam tiklashni sinang. Masalan, GPG bilan simmetrik shifrlash yoki ishonchli backup provayderining shifrlangan agentidan foydalaning. Parolni backup yonida saqlamang.

Avtomatlashtirishdan oldin maintenance oynasi, retention, shifrlash kaliti va tiklash testini hujjatlashtiring. Ishlayotgan volume ni faylma-fayl nusxalash izchil tranzaksiya kafolatini bermaydi.

## Tiklash

Admin → Zaxira nusxalar faqat oxirgi 40 lokal tranzaksiyani ko‘rsatadi. Tiklash butun tranzaksiyani birga qaytaradi, joriy holatdan yana zaxira oladi. Keyinroq qilingan buyurtmalar tanlangan eski snapshotda bo‘lmasligi mumkin. Avval off-server nusxa oling.

To‘liq off-server tiklash:

```bash
docker compose stop app
# Mavjud volume holatini avval alohida arxivlang.
docker run --rm \
  -v ischi-industrial_shop-data:/target \
  -v "$HOME/ischi-offsite-backups:/backup:ro" \
  alpine sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -xzf /backup/SELECTED.tar.gz -C /target'
docker compose start app
```

`SELECTED.tar.gz` ni haqiqiy fayl nomiga almashtiring. App user (UID 1001) o‘qiy/yozishi uchun fayl egalik/ruxsatlarini tekshiring. Sessiyalarni tiklash shart emas: shubha bo‘lsa `sessions.json` ichidagi arrayni `[]` qilib, barcha adminlarni qayta kiritishga majburlang. Buni app to‘xtatilganida bajaring.

`.receipt-secret` ni yo‘qotmang: eski qurilmalardagi kvitansiya tokenlari ishlamay qoladi. Yangi secret yaratilsa, eski mijoz kvitansiyalarini admin qo‘lda tekshiradi.

## Telegram outbox

Buyurtma JSON’ga yozilganda xabar ham shu tranzaksiyada navbatga qo‘shiladi. Worker 30 soniyada va buyurtmadan keyin ishlaydi. Faqat `sent` holati qayta yuborilmaydi. 429/rad etilgan xabar backoff bilan qayta urinadi. Timeout yoki noaniq javob `uncertain` bo‘ladi.

`uncertain` xabar uchun administrator haqiqiy chatni tekshiradi:

- Xabar borgan: “Telegramda yuborilgan”.
- Xabar bormagan: “Yuborilmagan — qayta yuborish”.

Bu mexanizm takroriylikni kamaytiradi, lekin Telegram va disk o‘rtasida distributed exactly-once kafolati yo‘q. Restore qilingan pending xabarlar ham tekshiruvga o‘tadi; oldingi sent faktlari saqlanadi.

## Maxfiy qiymatlar

- `.env`, `.env.local`, JKS, APK va runtime `data/` Git’ga kirmaydi.
- Admin paroli kamida 12 belgi; `npm run admin:hash` tavsiya.
- `NEXT_PUBLIC_` yoki `VITE_` ostida hech qanday secret yo‘q.
- Eski Git tarixida chiqqan token/parollarni rotate qiling.
- HTTPS, HttpOnly/Strict/Secure admin cookie, origin tekshiruvi, rate limit, schema validatsiya.
- Rasm MIME + sharp decode + hajm/pixel tekshiruvi, random UUID fayl nomi, metadata qayta kodlanadi.
- Mijoz kvitansiyasi HMAC token bilan. Uni URL/querystring/loglarga chiqarmang.
- Admin panelni faqat vakolatli xodimlarga bering; umumiy parolni muntazam almashtiring.

## Hodisaga javob

1. App ni public yozuvdan vaqtincha cheklang, diskni o‘chirmang.
2. Log reference, disk joyi, permissions, `.journals`, health ni tekshiring.
3. Nusxa oling, keyin tiklang.
4. Secret chiqqan bo‘lsa token/parolni almashtiring, sessiyalarni tozalang.
5. Buyurtma/outbox izchilligini tekshiring, mijozlarga zarur bo‘lsa qo‘lda xabar bering.

## Bir nechta jarayon va yangilash

`npm start` har safar `.next/static`, `public` va `seeds` ni `.next/standalone` ichiga ko‘chiradi. Bu qadam `.next/stage.lock` bilan ketma-ketlashtirilgan va mavjud fayllarni o‘chirmaydi (`force: false`), shuning uchun ishlab turgan serverning chunk/rasmlari ikkinchi jarayon tomonidan o‘chirilmaydi.

- Yangilash tartibi: `git pull` → `npm ci` → `npm run build` → `systemctl restart ischi` (yoki `docker compose up -d --build`).
- Build tugagach sahifani **to‘liq yangilang**: eski build’ning hash’langan chunk’lari brauzer keshida qolishi mumkin. `app/error.tsx` shu holatda sahifani bir marta avtomatik qayta yuklaydi, takrorlansa «Server holati» havolasi orqali `/api/health` ni ko‘rsatadi.
- `EACCES/EROFS/ENOSPC` kabi disk xatolari endi `503 STORAGE_UNAVAILABLE` bilan aniq o‘zbekcha xabar beradi; sahifa o‘rniga «Ma’lumot ombori ochilmadi» ko‘rsatmasi chiqadi.
