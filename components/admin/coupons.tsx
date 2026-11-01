'use client';
import { useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Coupon } from '@/lib/types';
import { money } from '@/lib/money';
import { Loading, Modal } from '@/components/ui';
import { adminRequest } from './client';
import {
  AdminError,
  AdminHeading,
  ConfirmAction,
  SaveButton,
  Toggle,
  useAdminData,
} from './common';
export function AdminCoupons() {
  const { data, error, loading, reload } = useAdminData<Coupon[]>('/coupons');
  const [editing, setEditing] = useState<Coupon | null>(null),
    [deleting, setDeleting] = useState<Coupon | null>(null),
    [formError, setFormError] = useState(''),
    [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError('');
    try {
      await adminRequest(
        '/coupons' + (editing.id ? '/' + editing.id : ''),
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
        title="Kuponlar"
        text="Chegirmalarni yarating va foydalanish limitlarini boshqaring."
        action="Kupon qo‘shish"
        onAction={() => {
          setFormError('');
          setEditing({
            id: '',
            code: '',
            type: 'percent',
            value: 5,
            minSubtotal: 0,
            maxDiscount: null,
            usageLimit: null,
            usedCount: 0,
            expiresAt: null,
            enabled: true,
            createdAt: new Date().toISOString(),
          });
        }}
      />
      <AdminError error={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Chegirma</th>
                <th>Minimal summa</th>
                <th>Foydalanish</th>
                <th>Muddat</th>
                <th>Holat</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.code}</strong>
                  </td>
                  <td>{c.type === 'percent' ? c.value + '%' : money(c.value)}</td>
                  <td>{money(c.minSubtotal)}</td>
                  <td>
                    {c.usedCount} / {c.usageLimit ?? '∞'}
                  </td>
                  <td>
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('uz-UZ') : 'Cheksiz'}
                  </td>
                  <td>{c.enabled ? 'Faol' : 'O‘chirilgan'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        onClick={() => {
                          setEditing(structuredClone(c));
                          setFormError('');
                        }}
                        aria-label={`${c.code} kuponini tahrirlash`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setDeleting(c)}
                        aria-label={`${c.code} kuponini o‘chirish`}
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
      {editing && (
        <Modal
          title={editing.id ? 'Kuponni tahrirlash' : 'Yangi kupon'}
          onClose={() => setEditing(null)}
        >
          <form className="admin-modal-body" onSubmit={save}>
            <label>
              Kupon kodi
              <input
                required
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                minLength={3}
                maxLength={40}
                pattern="[A-Z0-9-]+"
              />
            </label>
            <div className="form-row">
              <label>
                Chegirma turi
                <select
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({ ...editing, type: e.target.value as Coupon['type'] })
                  }
                >
                  <option value="percent">Foiz (%)</option>
                  <option value="fixed">So‘m</option>
                </select>
              </label>
              <label>
                Qiymati
                <input
                  type="number"
                  min="1"
                  max={editing.type === 'percent' ? 100 : 1000000000000}
                  required
                  value={editing.value || ''}
                  onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              Minimal buyurtma summasi
              <input
                type="number"
                min="0"
                value={editing.minSubtotal}
                onChange={(e) => setEditing({ ...editing, minSubtotal: Number(e.target.value) })}
              />
            </label>
            <div className="form-row">
              <label>
                Maksimal chegirma
                <input
                  type="number"
                  min="1"
                  placeholder="Cheksiz"
                  value={editing.maxDiscount ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      maxDiscount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
              <label>
                Foydalanish limiti
                <input
                  type="number"
                  min="1"
                  placeholder="Cheksiz"
                  value={editing.usageLimit ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      usageLimit: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
            </div>
            <label>
              Amal qilish muddati
              <input
                type="datetime-local"
                value={editing.expiresAt ? editing.expiresAt.slice(0, 16) : ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </label>
            <Toggle
              label="Kupon faol"
              checked={editing.enabled}
              onChange={(enabled) => setEditing({ ...editing, enabled })}
            />
            <AdminError error={formError} />
            <SaveButton busy={busy} />
          </form>
        </Modal>
      )}
      {deleting && (
        <ConfirmAction
          title="Kuponni o‘chirish"
          text={`${deleting.code} kuponi o‘chiriladi. Avvalgi buyurtmalar saqlanadi.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await adminRequest('/coupons/' + deleting.id, 'DELETE');
            reload();
          }}
        />
      )}
    </>
  );
}
