import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Marks the card as printable-report content. */
  report?: boolean;
  id?: string;
}

/** Standard white card with an optional header row. */
export function Card({ title, subtitle, icon, action, children, className = '', report = false, id }: CardProps) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${report ? 'report-card' : ''} ${className}`}
      aria-labelledby={title && id ? `${id}-title` : undefined}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700" aria-hidden="true">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold text-slate-900">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

interface PillProps {
  children: ReactNode;
  className?: string;
}

/** Small rounded label. Pass colour classes through `className`. */
export function Pill({ children, className = '' }: PillProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
}

export function Stat({ label, value, hint }: StatProps) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900">{value}</dd>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
