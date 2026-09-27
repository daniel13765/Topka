import clsx from 'clsx';
import { IconCheck } from '@tabler/icons-react';

interface StepperProps {
  steps: string[];
  /** Étape courante, 1-based */
  current: number;
}

/**
 * Stepper horizontal (maquettes Stitch v2 — inscription 2 étapes) :
 * pastille 32px avec halo crème, étape faite = coche blanche,
 * ligne de progression orange derrière, libellés 13px.
 */
export default function Stepper({ steps, current }: StepperProps) {
  // Largeur de la ligne orange calibrée sur les maquettes.
  const progress = Math.min(100, ((current - 0.3) / steps.length) * 100 + 10);

  return (
    <div className="relative mb-10 px-6">
      <div className="absolute left-0 right-0 top-4 h-[2px] bg-line" aria-hidden="true" />
      <div
        className="absolute left-0 top-4 h-[2px] bg-primary transition-all duration-300"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
      <div className="relative flex justify-between">
        {steps.map((label, i) => {
          const n = i + 1;
          const state = n < current ? 'done' : n === current ? 'active' : 'todo';
          return (
            <div key={label} className="z-10 flex flex-col items-center gap-sm">
              <span
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                  state === 'todo'
                    ? 'bg-line text-ink-2'
                    : 'bg-primary text-white shadow-[0_0_0_4px_var(--color-primary-lighter)]',
                )}
              >
                {state === 'done' ? <IconCheck size={16} stroke={3} /> : n}
              </span>
              <span
                className={clsx(
                  'text-[13px]',
                  state === 'active' && 'font-semibold text-primary',
                  state === 'done' && 'font-medium text-ink',
                  state === 'todo' && 'font-medium text-ink-2',
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
