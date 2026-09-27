import clsx from 'clsx';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}

/** Pagination carrés 40px : actif orange, ellipsis si beaucoup de pages (maquettes). */
export default function Pagination({ page, pageCount, onChange, className }: PaginationProps) {
  useLanguage();
  const pages: (number | '…')[] =
    pageCount <= 5
      ? Array.from({ length: pageCount }, (_, i) => i + 1)
      : page <= 3
        ? [1, 2, 3, '…', pageCount]
        : page >= pageCount - 2
          ? [1, '…', pageCount - 2, pageCount - 1, pageCount]
          : [1, '…', page, '…', pageCount];

  const cell =
    'flex h-10 w-10 items-center justify-center rounded-[10px] text-sm font-medium transition-colors duration-150 active:scale-[0.97]';

  return (
    <nav className={clsx('flex items-center justify-center gap-sm', className)} aria-label="Pagination">
      <button
        type="button"
        className={clsx(cell, 'bg-card text-ink-2 hover:text-ink disabled:opacity-40')}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label={tx("Page précédente")}
      >
        <IconChevronLeft size={18} />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-xs text-sm text-ink-3">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={clsx(
              cell,
              p === page ? 'bg-primary text-white' : 'bg-card text-ink-2 hover:text-ink',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={clsx(cell, 'bg-card text-ink-2 hover:text-ink disabled:opacity-40')}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        aria-label={tx("Page suivante")}
      >
        <IconChevronRight size={18} />
      </button>
    </nav>
  );
}
