import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StoreApp } from '@/components/store-app';
import '@/app/globals.css';
const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const native = Capacitor.isNativePlatform();
const valid =
  !configured ||
  /^https:\/\/[^/]+$/.test(configured) ||
  (!native && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(configured));
function MobileRoot() {
  if (native && (!configured || !valid))
    return (
      <main className="page-container error-state" style={{ minHeight: '80vh' }}>
        <h1>Backend manzili sozlanmagan</h1>
        <p>
          Ilova ishlashi uchun ishlab chiqaruvchi HTTPS API manzilini kiritib, APKni qayta yaratishi
          kerak. Bu qurilmada mijoz paroli yoki maxfiy kalit talab qilinmaydi.
        </p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Qayta tekshirish
        </button>
      </main>
    );
  return <StoreApp apiBase={configured} mobile initialPath="/" />;
}
createRoot(document.getElementById('root')!).render(<MobileRoot />);
