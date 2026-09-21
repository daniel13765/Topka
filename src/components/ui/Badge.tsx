import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  tone?: 'orange' | 'green' | 'blue' | 'indigo' | 'slate';
}

export function Badge({ children, tone = 'slate' }: BadgeProps) {
  const tones = {
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  };

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
