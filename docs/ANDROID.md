# Android APK — Android Studio siz

## Nima quriladi?

Capacitor 8, Android API 36, minimum Android 7/API 24, JDK 21, Gradle wrapper 8.14.3. `npm run build:mobile` shared React komponentlardan `dist-mobile/` statik fayllarini yaratadi. `cap sync android` ularni native loyihaga ko‘chiradi. Server kodi, admin paroli va bot tokeni APK ichiga kiritilmaydi.

Next.js server sahifalari APK ichida ishlamaydi. Shu sababli `mobile/main.tsx` + Vite ishlatiladi. Ilova HTTPS API orqali aynan sayt ishlatadigan JSON ma’lumotlarni oladi.

## Debug APK

1. Backendni doimiy diskli HTTPS serverga deploy qiling.
2. GitHub → Settings → Secrets and variables → Actions → Variables.
3. `ANDROID_API_URL` yarating: `https://shop.your-company.example` (faqat origin, oxirida `/` yoki `/api` yo‘q). Bu public manzil, secret emas.
4. Actions → **Android APK** → Run workflow. `signed_release` ni belgilamang.
5. Yakunlangan run → Artifacts → `ISCHI-Android-...` zipni yuklab oling.
6. Ichidagi `ISCHI-Industrial-debug.apk` ni Android 7+ telefonga o‘tkazing.
7. Faylni oching, faqat ishonchli manba uchun “Install unknown apps” ruxsatini bering. O‘rnatgach ruxsatni o‘chirib qo‘ying.
8. Katalog, savat va buyurtmani tekshiring; buyurtma sayt admin panelida ko‘rinishi kerak.

Debug APK Android debug kaliti bilan imzolanadi; test uchun. Play Store yoki keng tarqatish uchun release kalitingiz bilan signed release quring.

`ANDROID_API_URL` sozlanmasa workflow ataylab to‘xtaydi. Soxta yoki vaqtinchalik preview URL bilan production APK tarqatmang. Backend URL o‘zgarsa APK ni qayta qurish kerak.

## Signed release

O‘z Java keystore ingizni yarating va xavfsiz saqlang. Masalan, ishonchli lokal kompyuterda JDK bilan:

```bash
keytool -genkeypair -v -keystore ischi-release.jks \
  -alias ischi -keyalg RSA -keysize 4096 -validity 10000
```

Parollarni chatga, README ga yoki repozitoriyaga yozmang. Kalitni yo‘qotsangiz, mavjud ilovani shu kalit bilan yangilay olmaysiz. Kalit va parollarning alohida shifrlangan zaxirasini saqlang.

GitHub Actions **Secrets** bo‘limiga:

| Secret                      | Qiymat                     |
| --------------------------- | -------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | JKS faylining base64 matni |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore paroli            |
| `ANDROID_KEY_ALIAS`         | Kalit alias i              |
| `ANDROID_KEY_PASSWORD`      | Kalit paroli               |

Base64 yaratish (matnni terminal tarixiga chiqarmaslik uchun faylga yo‘naltiring):

```bash
base64 -w 0 ischi-release.jks > ischi-release.jks.base64
```

Fayl matnini secret ga joylang, vaqtinchalik base64 faylini xavfsiz o‘chiring. Workflow keyni runner vaqtinchalik papkasida ochadi, release APK ni imzolaydi va yakunda faylni o‘chiradi. Kalit artifact bo‘lmaydi. Gradle cache ga keystore kiritilmaydi.

Actions → Android APK → Run workflow → `signed_release=true`. Artifact ichida `ISCHI-Industrial-release.apk` va SHA-256 fayli bo‘ladi. Release signing secretlari to‘liq bo‘lmasa build xato bilan to‘xtaydi; imzolanmagan release chiqmaydi.

GitHub Actions artifactlari odatda GitHub hisobi bilan kirishni talab qiladi. Ommaviy yuklab olish uchun APK ni GitHub Release asset yoki HTTPS saytga alohida joylang. APK ni Git source tree ga commit qilmang.

## Lokal qurish

Android Studio shart emas, lekin JDK 21 + Android SDK command-line tools + API 36/build-tools kerak:

```bash
npm ci
cp .env.mobile.example mobile/.env.local
# VITE_API_URL ni haqiqiy HTTPS origin ga almashtiring.
VITE_API_URL=https://your-real-backend.example npm run mobile:sync
cd android
./gradlew assembleDebug
```

PowerShell da `$env:VITE_API_URL='https://...'` orqali o‘rnating. Release uchun to‘rtta `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` environment qiymatini bering; `./gradlew assembleRelease`.

## Native xatti-harakat

- Orqa tugasi: avval modal/menyu, keyin sahifa tarixi, asosiy sahifada ilovani background ga olish.
- Status bar va splash brend ranglari.
- Keyboard resize, safe-area CSS, pastki mobil navigatsiya.
- `uz.ischi.industrial://` custom scheme; HTTPS App Links uchun o‘z domeningiz va `assetlinks.json` bilan alohida sozlash kerak.
- INTERNET ruxsati; kamera, kontaktlar, SMS yoki joylashuv ruxsati so‘ralmaydi.
- `allowBackup=false`, cleartext HTTP yo‘q, WebView debugging o‘chiq.
- Savat/til/kvitansiyalar LocalStorage da. Backend o‘chiq bo‘lsa yangi buyurtma yuborilmaydi; soxta offline success ko‘rsatilmaydi.

## Cheklov

Ushbu sandboxda Java/Android SDK yo‘q. Shu sababli native compile va real qurilmada o‘rnatish bu yerda bajarilgan deb da’vo qilinmaydi. Workflow JDK/SDK o‘rnatib haqiqiy Gradle build qiladi. GitHub run natijasi va imzolash secretlari sizning repository sozlamalaringizga bog‘liq.
