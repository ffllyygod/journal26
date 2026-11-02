'use client';

import { useEffect, useRef, type ReactNode, type SVGProps } from 'react';

export type IconName =
  | 'sun'
  | 'book'
  | 'chart'
  | 'briefcase'
  | 'review'
  | 'settings'
  | 'arrow'
  | 'chevron'
  | 'plus'
  | 'check'
  | 'close'
  | 'leaf'
  | 'flame'
  | 'clock'
  | 'image'
  | 'download'
  | 'logout'
  | 'target'
  | 'edit'
  | 'trash'
  | 'search'
  | 'lock'
  | 'external'
  | 'menu'
  | 'play'
  | 'stop';
const paths: Record<IconName, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  book: (
    <>
      <path d="M4 3h12a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3m-3 15a3 3 0 0 1 3-3h13M8 7h7M8 10h5" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18M7 15l4-5 4 3 6-8" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V4h8v3M3 12a22 22 0 0 0 18 0M10 13h4" />
    </>
  ),
  review: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18M8 15l3 3 5-5" />
    </>
  ),
  settings: (
    <>
      <path d="m10 3-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 3 3-1 1-3 3-1v-4l-3-1-1-3-3-1Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  leaf: (
    <>
      <path d="M20 3C8 2 2 8 5 16c8 5 16-1 15-13ZM4 21l12-13" />
    </>
  ),
  flame: <path d="M13 2c1 5 5 6 5 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 4 2 5 2 5s4-3 2-10Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8" cy="8" r="1" />
      <path d="m3 17 5-5 4 4 4-7 5 8" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H4v18h5m6-14 5 5-5 5M8 12h12" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  edit: (
    <>
      <path d="m15 4 5 5M3 21l5-1L21 7l-5-5L3 15v6Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M9 10v7m6-7v7" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M9 4H3v17h17v-6" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  play: <path d="M7 4v16l13-8Z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
};
export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog" type="button">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function EmptyState({
  icon = 'book',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
