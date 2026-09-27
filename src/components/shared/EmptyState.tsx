import type { ReactNode } from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  /** Icône (élément) rendue dans le cercle crème. */
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** État vide centré (panier vide, aucun résultat…) — icône dans un cercle crème. */
export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-xl text-center', className)}>
      <span className="mb-md flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-lighter">
        {icon}
      </span>
      <h3 className="text-h3 text-ink">{title}</h3>
      {description && <p className="mt-sm max-w-[320px] text-secondary text-ink-2">{description}</p>}
      {action && <div className="mt-lg">{action}</div>}
    </div>
  );
}
