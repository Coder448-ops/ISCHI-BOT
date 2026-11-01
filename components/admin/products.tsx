'use client';
import { useState, type FormEvent } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { type Product, type Category, UNITS, effectivePrice, localized } from '@/lib/types';
import { money, groupNumber } from '@/lib/money';
import { Modal, Loading, Empty } from '@/components/ui';
import { adminRequest } from './client';
import {
  AdminError,
  AdminHeading,
  ConfirmAction,
  ImageUploader,
  LocalizedInput,
  SaveButton,
  Toggle,
  useAdminData,
} from './common';
const blank = (category: string): Product => ({
  id: '',
  name: { uz: '' },
  description: { uz: '' },
  images: [],
  categoryId: category,
  code: '',
  manufacturer: '',
  price: 1,
  discountPrice: null,
  stock: 0,
  minOrder: 1,
  step: 1,
  unit: 'kg',
  weight: null,
  measurements: {},
  materialType: '',
  specifications: [],
  enabled: true,
  relatedIds: [],
  lowStockThreshold: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  featured: false,
  demo: false,
});
export function AdminProducts() {
  const products = useAdminData<Product[]>('/products'),
    categories = useAdminData<Category[]>('/categories');
  const [editing, setEditing] = useState<Product | null>(null),
    [deleting, setDeleting] = useState<Product | null>(null),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const filtered = (products.data || []).filter((p) =>
    [p.code, p.name.uz, p.materialType].join(' ').toLowerCase().includes(query.toLowerCase()),
  );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await adminRequest(
        '/products' + (editing.id ? '/' + editing.id : ''),
        editing.id ? 'PATCH' : 'POST',
        editing,
      );
      setEditing(null);
      products.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = <K extends keyof Product>(key: K, value: Product[K]) =>
    setEditing((p) => (p ? { ...p, [key]: value } : p));
  const number = (value: string) => (value === '' ? 0 : Number(value));
  return (
    <>
      <AdminHeading
        title="Mahsulotlar"
        text="Narxlar, qoldiqlar, o‘lchov birliklari va texnik ma’lumotlar."
        action="Mahsulot qo‘shish"
        onAction={() => {
          setError('');
          setEditing(blank(categories.data?.[0]?.id || ''));
        }}
      />
      <div className="admin-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Nomi, kod yoki material bo‘yicha qidirish"
            aria-label="Mahsulotlarni qidirish"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <span>{filtered.length} ta mahsulot</span>
      </div>
      <AdminError error={products.error || categories.error} />
      {products.loading ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty
          title="Mahsulotlar yo‘q"
          text="Yangi mahsulot qo‘shing yoki qidiruvni o‘zgartiring."
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Kategoriya</th>
                <th>Narx / birlik</th>
                <th>Qoldiq</th>
                <th>Holat</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 20, page * 20).map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-product">
                      <img src={p.images[0]} alt="" width="50" height="45" />
                      <div>
                        <strong>{p.name.uz}</strong>
                        <small>
                          {p.code}
                          {p.demo ? ' · NAMUNA' : ''}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{categories.data?.find((c) => c.id === p.categoryId)?.name.uz}</td>
                  <td>
                    <strong>{money(effectivePrice(p))}</strong>
                    <small>/ {p.unit}</small>
                  </td>
                  <td className={p.stock <= p.lowStockThreshold ? 'orange-text' : ''}>
                    {groupNumber(p.stock)} {p.unit}
                  </td>
                  <td>
                    <span className={`status-badge ${!p.enabled ? 'cancelled' : ''}`}>
                      {p.enabled ? 'Faol' : 'O‘chirilgan'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        onClick={() => {
                          setEditing(structuredClone(p));
                          setError('');
                        }}
                        aria-label={`${p.name.uz}ni tahrirlash`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button danger-text"
                        onClick={() => setDeleting(p)}
                        aria-label={`${p.name.uz}ni o‘chirish`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Oldingi
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(filtered.length / 20))}
        </span>
        <button
          className="button secondary"
          disabled={page * 20 >= filtered.length}
          onClick={() => setPage(page + 1)}
        >
          Keyingi
        </button>
      </div>
      {editing && (
        <Modal
          title={editing.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
          onClose={() => setEditing(null)}
          wide
        >
          <form className="admin-product-form" onSubmit={save}>
            <div className="admin-form-grid">
              <section>
                <h3>Asosiy ma’lumotlar</h3>
                <LocalizedInput
                  label="Mahsulot nomi"
                  value={editing.name}
                  onChange={(v) => update('name', v)}
                />
                <LocalizedInput
                  label="Tavsif"
                  value={editing.description}
                  onChange={(v) => update('description', v)}
                  multiline
                />
                <div className="form-row">
                  <label>
                    Mahsulot kodi
                    <input
                      required
                      value={editing.code}
                      onChange={(e) => update('code', e.target.value)}
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Ishlab chiqaruvchi
                    <input
                      value={editing.manufacturer}
                      onChange={(e) => update('manufacturer', e.target.value)}
                      maxLength={200}
                    />
                  </label>
                </div>
                <label>
                  Kategoriya
                  <select
                    required
                    value={editing.categoryId}
                    onChange={(e) => update('categoryId', e.target.value)}
                  >
                    {categories.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.uz}
                      </option>
                    ))}
                  </select>
                </label>
                <ImageUploader
                  images={editing.images}
                  onChange={(v) => update('images', v)}
                  onError={setError}
                />
                <div className="form-actions">
                  <Toggle
                    label="Do‘konda faol"
                    checked={editing.enabled}
                    onChange={(v) => update('enabled', v)}
                  />
                  <Toggle
                    label="Ommabop mahsulot"
                    checked={editing.featured}
                    onChange={(v) => update('featured', v)}
                  />
                  <Toggle
                    label="Namoyish mahsuloti"
                    checked={editing.demo}
                    onChange={(v) => update('demo', v)}
                  />
                </div>
              </section>
              <section>
                <h3>Narx va o‘lchov</h3>
                <div className="form-row">
                  <label>
                    Narx (so‘m)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={editing.price || ''}
                      onChange={(e) => update('price', number(e.target.value))}
                    />
                  </label>
                  <label>
                    Chegirma narxi
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={editing.discountPrice ?? ''}
                      onChange={(e) =>
                        update('discountPrice', e.target.value ? number(e.target.value) : null)
                      }
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    O‘lchov birligi
                    <select
                      value={editing.unit}
                      onChange={(e) => update('unit', e.target.value as Product['unit'])}
                    >
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ombordagi qoldiq
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={editing.stock}
                      onChange={(e) => update('stock', number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Minimal buyurtma
                    <input
                      type="number"
                      min="0.000001"
                      step="any"
                      required
                      value={editing.minOrder || ''}
                      onChange={(e) => update('minOrder', number(e.target.value))}
                    />
                  </label>
                  <label>
                    Miqdor qadami
                    <input
                      type="number"
                      min="0.000001"
                      step="any"
                      required
                      value={editing.step || ''}
                      onChange={(e) => update('step', number(e.target.value))}
                    />
                  </label>
                </div>
                <label>
                  Kam qoldiq chegarasi
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editing.lowStockThreshold}
                    onChange={(e) => update('lowStockThreshold', number(e.target.value))}
                  />
                </label>
                <h3>Texnik o‘lchamlar</h3>
                <p className="muted small-text">
                  Faqat shu mahsulotga tegishli maydonlarni to‘ldiring. Uzunlik, kenglik, qalinlik
                  va diametr — mm.
                </p>
                <label>
                  Og‘irlik (kg)
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    value={editing.weight ?? ''}
                    onChange={(e) =>
                      update('weight', e.target.value ? number(e.target.value) : null)
                    }
                  />
                </label>
                <div className="form-row">
                  {(['length', 'width', 'thickness', 'diameter'] as const).map((key) => (
                    <label key={key}>
                      {
                        {
                          length: 'Uzunlik (mm)',
                          width: 'Kenglik (mm)',
                          thickness: 'Qalinlik (mm)',
                          diameter: 'Diametr (mm)',
                        }[key]
                      }
                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        value={editing.measurements[key] ?? ''}
                        onChange={(e) =>
                          update('measurements', {
                            ...editing.measurements,
                            [key]: e.target.value ? number(e.target.value) : undefined,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Material turi
                  <input
                    value={editing.materialType}
                    onChange={(e) => update('materialType', e.target.value)}
                    maxLength={120}
                  />
                </label>
                <label>
                  O‘xshash mahsulotlar
                  <select
                    multiple
                    value={editing.relatedIds}
                    onChange={(e) =>
                      update(
                        'relatedIds',
                        Array.from(e.target.selectedOptions)
                          .map((o) => o.value)
                          .slice(0, 12),
                      )
                    }
                  >
                    {products.data
                      ?.filter((p) => p.id !== editing.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name.uz}
                        </option>
                      ))}
                  </select>
                  <small>Ctrl / Cmd bilan bir nechta tanlang.</small>
                </label>
              </section>
            </div>
            <section className="spec-editor">
              <h3>Qo‘shimcha texnik xususiyatlar</h3>
              {editing.specifications.map((spec, i) => (
                <div className="form-row" key={i}>
                  <label>
                    Nomi
                    <input
                      value={spec.label}
                      required
                      onChange={(e) =>
                        update(
                          'specifications',
                          editing.specifications.map((s, j) =>
                            i === j ? { ...s, label: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Qiymati
                    <input
                      value={spec.value}
                      required
                      onChange={(e) =>
                        update(
                          'specifications',
                          editing.specifications.map((s, j) =>
                            i === j ? { ...s, value: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      update(
                        'specifications',
                        editing.specifications.filter((_, j) => j !== i),
                      )
                    }
                    aria-label="Xususiyatni o‘chirish"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button secondary"
                disabled={editing.specifications.length >= 40}
                onClick={() =>
                  update('specifications', [...editing.specifications, { label: '', value: '' }])
                }
              >
                Xususiyat qo‘shish
              </button>
            </section>
            <AdminError error={error} />
            <div className="form-actions sticky-actions">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                Bekor qilish
              </button>
              <SaveButton busy={busy} />
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <ConfirmAction
          title="Mahsulotni o‘chirish"
          text={`${deleting.name.uz} do‘kondan o‘chiriladi. Avvalgi buyurtmalardagi ma’lumotlar saqlanadi.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await adminRequest('/products/' + deleting.id, 'DELETE');
            products.reload();
          }}
        />
      )}
    </>
  );
}
