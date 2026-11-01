import { redirect } from 'next/navigation';
import { pageAdmin } from '@/lib/server/page-auth';
import AdminShell from '@/components/admin-shell';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administrator', robots: { index: false, follow: false } };
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await pageAdmin();
  if (!admin) redirect('/admin/login');
  return <AdminShell username={admin.username}>{children}</AdminShell>;
}
