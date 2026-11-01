'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export default function Dialog({
  children,
  onClose,
  titleId,
  className = '',
  closeDisabled = false,
}: {
  children: ReactNode;
  onClose: () => void;
  titleId: string;
  className?: string;
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const disabledRef = useRef(closeDisabled);
  closeRef.current = onClose;
  disabledRef.current = closeDisabled;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    const timer = setTimeout(() => (focusable()[0] || root)?.focus(), 30);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disabledRef.current) closeRef.current();
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0],
          last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          root?.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === root)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div className="dialog-layer">
      <button
        className="dialog-backdrop"
        aria-label="Oynani yopish"
        tabIndex={-1}
        disabled={closeDisabled}
        onClick={onClose}
      />
      <div
        className={`dialog ${className}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
