'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, Bell, LayoutGrid, LogOut, ShoppingBag } from 'lucide-react';
export default function AdminShell({
  username,
  children,
}: {
  username: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      router.replace('/admin/login');
      router.refresh();
    } catch {
      setError('Chiqib bo‘lmadi. Qayta urinib ko‘ring.');
      setBusy(false);
    }
  }
  return (
    <div className="admin-body">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="logo logo-light" href="/admin">
            <span className="logo-symbol">
              <ShoppingBag size={21} />
            </span>
            <span>
              ishchi<span className="logo-dot">.</span>
            </span>
          </Link>
          <div className="admin-workspace">ADMINISTRATOR PANELI</div>
          <nav className="admin-nav" aria-label="Administrator menyusi">
            <Link href="/admin" className={pathname === '/admin' ? 'active' : ''}>
              <LayoutGrid size={17} /> Buyurtmalar
            </Link>
            <Link
              href="/admin/notifications"
              className={pathname === '/admin/notifications' ? 'active' : ''}
            >
              <Bell size={17} /> Telegram xabarlari
            </Link>
          </nav>
          <div className="admin-sidebar-bottom">
            <Link href="/" target="_blank">
              Do‘konni ko‘rish <ArrowUpRight size={15} />
            </Link>
            <div className="admin-user">
              <span className="admin-avatar">{username.slice(0, 1).toUpperCase()}</span>
              <div>
                {username}
                <small>Administrator</small>
              </div>
              <button
                title="Chiqish"
                aria-label="Administrator hisobidan chiqish"
                disabled={busy}
                onClick={logout}
              >
                <LogOut size={17} />
              </button>
            </div>
            {error && (
              <p role="alert" className="small">
                {error}
              </p>
            )}
          </div>
        </aside>
        <main className="admin-main">
          <div className="admin-topbar">
            <div className="admin-breadcrumb">
              Boshqaruv <span>/</span>{' '}
              {pathname === '/admin/notifications' ? 'Telegram xabarlari' : 'Buyurtmalar'}
            </div>
            <div className="admin-topbar-right">
              <span className="live-dot" /> Buyurtmalar boshqaruvi
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
