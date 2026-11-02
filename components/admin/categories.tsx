'use client';
import { useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Category } from '@/lib/types';
import { Modal, Loading } from '@/components/ui';
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
export function AdminCategories() {
  const { data, error, loading, reload } = useAdminData<Category[]>('/categories');
  const [editing, setEditing] = useState<Category | null>(null),
    [deleting, setDeleting] = useState<Category | null>(null),
    [formError, setFormError] = useState(''),
    [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError('');
    try {
      await adminRequest(
        '/categories' + (editing.id ? '/' + editing.id : ''),
        editing.id ? 'PATCH' : 'POST',
        editing,
      );
      setEditing(null);
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminHeading
        title="Kategoriyalar"
        text="Metall va qurilish materiallari bo‘limlarini boshqaring."
        action="Kategoriya qo‘shish"
        onAction={() => {
          setFormError('');
          setEditing({
            id: '',
            name: { uz: '' },
            group: 'metal',
            description: '',
            image: '/images/products/steel-pipes.webp',
            sort: data?.length || 0,
            enabled: true,
          });
        }}
      />
      <AdminError error={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="admin-category-grid">
          {data?.map((c) => (
            <article className="admin-category-card" key={c.id}>
              <img src={c.image} alt="" width="240" height="140" />
              <div>
                <span className="eyebrow">
                  {c.group === 'metal' ? 'METALL MAHSULOTLARI' : 'QURILISH MATERIALLARI'}
                </span>
                <h3>{c.name.uz}</h3>
                <p>
                  {c.enabled ? 'Faol' : 'O‘chirilgan'} · Tartib: {c.sort}
                </p>
                <div className="table-actions">
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditing(structuredClone(c));
                      setFormError('');
                    }}
                  >
                    <Pencil size={15} />
                    Tahrirlash
                  </button>
                  <button
                    className="icon-button danger-text"
                    onClick={() => setDeleting(c)}
                    aria-label={`${c.name.uz}ni o‘chirish`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={editing.id ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
          onClose={() => setEditing(null)}
        >
          <form className="admin-modal-body" onSubmit={save}>
            <LocalizedInput
              label="Kategoriya nomi"
              value={editing.name}
              onChange={(name) => setEditing({ ...editing, name })}
            />
            <label>
              Guruh
              <select
                value={editing.group}
                onChange={(e) =>
                  setEditing({ ...editing, group: e.target.value as Category['group'] })
                }
              >
                <option value="metal">Metall mahsulotlari</option>
                <option value="construction">Qurilish materiallari</option>
              </select>
            </label>
            <label>
              Tavsif
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                maxLength={2000}
                rows={3}
              />
            </label>
            <label>
              Tartib raqami
              <input
                type="number"
                min="0"
                max="10000"
                required
                value={editing.sort}
                onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) })}
              />
            </label>
            <ImageUploader
              images={[editing.image]}
              multiple={false}
              onChange={(images) => setEditing({ ...editing, image: images[0] || '' })}
              onError={setFormError}
            />
            <Toggle
              label="Do‘konda ko‘rsatish"
              checked={editing.enabled}
              onChange={(enabled) => setEditing({ ...editing, enabled })}
            />
            <AdminError error={formError} />
            <div className="form-actions">
              <SaveButton busy={busy} />
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <ConfirmAction
          title="Kategoriyani o‘chirish"
          text={`${deleting.name.uz} o‘chiriladi. Kategoriyada mahsulot bo‘lsa, avval ularni boshqa kategoriyaga ko‘chiring.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await adminRequest('/categories/' + deleting.id, 'DELETE');
            reload();
          }}
        />
      )}
    </>
  );
}
