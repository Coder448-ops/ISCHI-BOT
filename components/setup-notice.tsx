/**
 * Shown when the site cannot reach its data. The shop never invents content, so explain
 * exactly which piece is missing instead of showing a raw server error.
 */
import type { DataSourceIssue } from '@/lib/server/data-source';

const reasons: Record<
  DataSourceIssue,
  { title: string; lead: string; steps: string[]; hint: string }
> = {
  'api-origin': {
    title: 'Sayt hali ma’lumot serveriga ulanmagan',
    lead: 'Bu hostingda doimiy disk yo‘q, shuning uchun mahsulotlar va buyurtmalar shu yerda saqlanmaydi. Hech qanday buyurtma yo‘qolmadi — hozircha ma’lumot manbasi ko‘rsatilmagan.',
    steps: [
      'JSON omborini doimiy diskli serverda ishga tushiring (Docker + Caddy, VPS yoki doimiy volume berilgan hosting).',
      'Shu loyihaning Environment Variables bo‘limiga API_ORIGIN qiymatini qo‘shing, masalan https://api.mening-dokonim.uz. Faqat origin yoziladi: oxirida / yoki /api bo‘lmaydi.',
      'API serverda PUBLIC_WEB_ORIGIN ga shu saytning manzilini yozing va qayta deploy qiling.',
    ],
    hint: 'Tekshirish: /api/health javobi {"ok":true,"mode":"proxy"} bo‘lishi kerak.',
  },
  upstream: {
    title: 'Ma’lumot serveri javob bermayapti',
    lead: 'Sayt manzilni biladi, lekin API serverdan javob kelmadi. Buyurtmalar shu vaqt ichida qabul qilinmaydi — hech narsa yo‘qolmadi.',
    steps: [
      'API server ishlab turganini tekshiring (docker compose ps yoki systemctl status ischi).',
      'API_ORIGIN manzili to‘g‘ri va HTTPS ekanini tekshiring.',
      'API serverda PUBLIC_WEB_ORIGIN ichida shu sayt domeni borligini tekshiring.',
    ],
    hint: 'API serverdagi /api/health javobi {"ok":true} bo‘lishi kerak.',
  },
  storage: {
    title: 'Ma’lumot ombori ochilmadi',
    lead: 'Server JSON fayllarni o‘qiy olmadi yoki ularni yozish huquqi yo‘q. Buyurtmalar qabul qilinmaydi, mavjud ma’lumot o‘chirilmagan.',
    steps: [
      'DATA_DIR mounted doimiy diskda ekanini va foydalanuvchida yozish huquqi borligini tekshiring.',
      'data/*.json fayllari buzilmaganini tekshiring; buzilgan bo‘lsa administrator zaxirasidan tiklang (docs/OPERATIONS.md).',
      'Serverless hostingda bo‘lsangiz, API_ORIGIN ni doimiy diskli API serverga qarating (docs/DEPLOYMENT.md).',
    ],
    hint: 'Tekshirish: /api/health javobi va serverdagi [ISCHI] xato yozuvlari.',
  },
};

export function SetupNotice({ issue }: { issue: DataSourceIssue }) {
  const reason = reasons[issue];
  return (
    <main className="setup-notice">
      <div className="setup-card">
        <span className="eyebrow">SOZLASH KERAK</span>
        <h1>{reason.title}</h1>
        <p>{reason.lead}</p>
        <ol>
          {reason.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="setup-check">{reason.hint}</p>
        <p className="setup-meta">
          Batafsil: docs/DEPLOYMENT.md · docs/OPERATIONS.md · holat: <code>/api/health</code>
        </p>
      </div>
    </main>
  );
}
