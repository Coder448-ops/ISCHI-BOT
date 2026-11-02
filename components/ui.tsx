'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, Box, LoaderCircle, X, WifiOff } from 'lucide-react';
export function Loading({ label = 'Yuklanmoqda...' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={27} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Box size={30} />
      </div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action && (
        <button className="button primary" onClick={onAction}>
          {action}
          <ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
  label = 'Qayta urinish',
}: {
  message: string;
  retry: () => void;
  label?: string;
}) {
  return (
    <div className="error-state" role="alert">
      <WifiOff size={28} />
      <h2>{message}</h2>
      <button className="button secondary" onClick={retry}>
        {label}
      </button>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
        ) || [],
      );
    focusables()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const list = focusables();
        const first = list[0],
          last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Yopish / Закрыть / Close">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Brand({ name = 'ISCHI', logo = '' }: { name?: string; logo?: string }) {
  return (
    <span className="brand">
      {logo ? (
        <img src={logo} alt="" />
      ) : (
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <span className="brand-word">
        {name.split(' ')[0]}
        <small>{name.split(' ').slice(1).join(' ') || 'INDUSTRIAL'}</small>
      </span>
    </span>
  );
}
