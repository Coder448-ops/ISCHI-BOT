import { ArrowLeft, PackageSearch } from 'lucide-react';
export default function NotFound() {
  return (
    <main className="page-container">
      <div className="empty-state" style={{ minHeight: '75vh' }}>
        <PackageSearch size={55} />
        <span className="eyebrow">404 / ISCHI INDUSTRIAL</span>
        <h1>Sahifa topilmadi</h1>
        <p>Manzil o‘zgargan yoki sahifa mavjud emas.</p>
        <a className="button primary" href="/">
          <ArrowLeft size={18} />
          Bosh sahifaga qaytish
        </a>
      </div>
    </main>
  );
}
