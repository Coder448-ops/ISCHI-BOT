'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Settings,
  Bell,
  TicketPercent,
  LifeBuoy,
  ArchiveRestore,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { Brand } from '@/components/ui';
const navigation = [
  ['/', 'Umumiy ko‘rinish', LayoutDashboard],
  ['/products', 'Mahsulotlar', Package],
  ['/categories', 'Kategoriyalar', FolderTree],
  ['/orders', 'Buyurtmalar', ShoppingBag],
  ['/coupons', 'Kuponlar', TicketPercent],
  ['/settings', 'Kompaniya sozlamalari', Settings],
  ['/notifications', 'Telegram xabarlari', Bell],
  ['/support', 'Mijozlar xabarlari', LifeBuoy],
  ['/backups', 'Zaxira nusxalar', ArchiveRestore],
] as const;
export function AdminShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const logout = async () => {
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Chiqishda xatolik.');
      window.location.assign('/admin/login');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="admin-brand">
          <a href="/admin">
            <Brand name="ISCHI Industrial" />
          </a>
          <button
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Menyuni yopish"
          >
            <X size={19} />
          </button>
        </div>
        <span className="admin-sidebar-label">BOSHQARUV</span>
        <nav>
          {navigation.map(([url, label, Icon]) => (
            <a
              key={url}
              href={'/admin' + url}
              className={
                (url === '/' ? path === '/admin' : path.startsWith('/admin' + url)) ? 'active' : ''
              }
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/" target="_blank">
            <ExternalLink size={17} />
            Do‘konni ochish
          </a>
          <button onClick={logout}>
            <LogOut size={17} />
            Hisobdan chiqish
          </button>
          <span>{username} · Administrator</span>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="icon-button"
            onClick={() => setOpen(!open)}
            aria-label="Boshqaruv menyusi"
          >
            <Menu size={22} />
          </button>
          <span>ISCHI / Boshqaruv paneli</span>
          <span className="admin-live">
            <i />
            JSON fayl ombori
          </span>
        </header>
        {error && <div className="form-error">{error}</div>}
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
