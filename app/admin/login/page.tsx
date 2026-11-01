import { redirect } from 'next/navigation';
import { pageAdmin } from '@/lib/server/page-auth';
import AdminLogin from '@/components/admin-login';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administrator kirishi', robots: { index: false, follow: false } };
export default async function LoginPage() {
  if (await pageAdmin()) redirect('/admin');
  return <AdminLogin />;
}
