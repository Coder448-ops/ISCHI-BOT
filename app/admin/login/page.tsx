import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { loadAdminSession, showcaseMode } from '@/lib/server/data-source';
import { SESSION_COOKIE } from '@/lib/server/security';
import { AdminLogin } from '@/components/admin/login';
import { Brand } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administrator kirishi', robots: { index: false, follow: false } };
export default async function LoginPage() {
  if (showcaseMode())
    return (
      <main className="admin-login-page">
        <div className="admin-login-card">
          <Brand name="ISCHI Industrial" />
          <span className="eyebrow">BOSHQARUV PANELI</span>
          <h1>Panel bu nusxada ishlamaydi</h1>
          <p>
            Sayt ko‘rgazma rejimida ishlayapti: ma’lumotlar faqat o‘qish uchun ko‘rsatiladi va hech
            narsa saqlanmaydi. Administrator paneli doimiy diskli serverda ishlaydi.
          </p>
          <a className="text-link" href="/">
            Do‘konga qaytish
          </a>
        </div>
      </main>
    );
  if (await loadAdminSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/admin');
  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <Brand name="ISCHI Industrial" />
        <span className="eyebrow">BOSHQARUV PANELI</span>
        <h1>Administrator kirishi</h1>
        <p>Faqat vakolatli xodimlar uchun.</p>
        <AdminLogin />
        <a className="text-link" href="/">
          Do‘konga qaytish
        </a>
      </div>
    </main>
  );
}
