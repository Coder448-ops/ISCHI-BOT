import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loadAdminSession } from '@/lib/server/data-source';
import { SESSION_COOKIE } from '@/lib/server/security';
import { AdminShell } from '@/components/admin/shell';
import '@/components/admin/admin.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Boshqaruv paneli', robots: { index: false, follow: false } };
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await loadAdminSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect('/admin/login');
  return <AdminShell username={session.username}>{children}</AdminShell>;
}
