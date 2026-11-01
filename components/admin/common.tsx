'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { adminRequest } from './client';
import { Loading, Modal } from '@/components/ui';
import {
  localized,
  UNITS,
  type Localized,
  type Product,
  type Category,
  type Coupon,
} from '@/lib/types';
export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    adminRequest<T>(path)
      .then((value) => {
        if (active) {
          setData(value);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, setData, error, setError, loading, reload: () => setRevision((x) => x + 1) };
}
export function AdminHeading({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action && (
        <button className="button primary" onClick={onAction}>
          <Plus size={17} />
          {action}
        </button>
      )}
    </div>
  );
}
export function AdminError({ error }: { error: string }) {
  return error ? (
    <div className="form-error" role="alert">
      {error}
    </div>
  ) : null;
}
export function SaveButton({ busy, label = 'Saqlash' }: { busy: boolean; label?: string }) {
  return (
    <button className="button primary" disabled={busy}>
      <Save size={16} />
      {busy ? 'Saqlanmoqda...' : label}
    </button>
  );
}
export function LocalizedInput({
  label,
  value,
  onChange,
  multiline = false,
  required = true,
}: {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <fieldset className="localized-input">
      <legend>{label}</legend>
      {(['uz', 'ru', 'en'] as const).map((lang) => (
        <label key={lang}>
          <span>
            {lang.toUpperCase()}
            {lang !== 'uz' && <small> (ixtiyoriy)</small>}
          </span>
          {multiline ? (
            <textarea
              value={value[lang] || ''}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              rows={lang === 'uz' ? 4 : 2}
              required={lang === 'uz' && required}
              maxLength={10000}
            />
          ) : (
            <input
              value={value[lang] || ''}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              required={lang === 'uz' && required}
              maxLength={300}
            />
          )}
        </label>
      ))}
    </fieldset>
  );
}
export function ImageUploader({
  images,
  onChange,
  multiple = true,
  onError,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, multiple ? 12 - images.length : 1)) {
        const form = new FormData();
        form.append('file', file);
        const result = await adminRequest<{ url: string }>('/uploads', 'POST', form);
        uploaded.push(result.url);
      }
      onChange(multiple ? [...images, ...uploaded] : uploaded);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="image-uploader">
      <label>Rasmlar {!multiple && '(bitta)'}</label>
      <div className="upload-previews">
        {images.map((image, i) => (
          <div key={image}>
            <img src={image} alt={`Mahsulot rasmi ${i + 1}`} width="120" height="90" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, index) => i !== index))}
              aria-label="Rasmni olib tashlash"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {(multiple ? images.length < 12 : !images.length) && (
          <label className="upload-drop">
            <ImagePlus size={25} />
            <span>{busy ? 'Yuklanmoqda...' : 'Rasm yuklash'}</span>
            <small>JPG, PNG, WebP · 5 MB</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={multiple}
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
export function ConfirmAction({
  title,
  text,
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <div className="admin-modal-body">
        <p>{text}</p>
        <AdminError error={error} />
        <div className="form-actions">
          <button className="button secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Bajarilmoqda...' : 'Ha, tasdiqlayman'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
export function Pager({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return pages > 1 ? (
    <div className="pagination">
      <button className="button secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} />
        Oldingi
      </button>
      <span>
        {page} / {pages}
      </span>
      <button
        className="button secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Keyingi
        <ChevronRight size={16} />
      </button>
    </div>
  ) : null;
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle-label">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
