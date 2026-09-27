import clsx from 'clsx';
import { IconCheck } from '@tabler/icons-react';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';

const STEPS = ['Panier', 'Livraison', 'Paiement', 'Confirmation'];

interface CheckoutStepperProps {
  /** Étape courante, 1-based */
  current: number;
}

/** Stepper de commande 4 étapes (maquette panier) : fait = coche, actif = orange, à venir = gris. */
export default function CheckoutStepper({ current }: CheckoutStepperProps) {
  useLanguage();
  const fill = `${((current - 1) / (STEPS.length - 1)) * 100}%`;

  return (
    <div className="mb-xl w-full overflow-x-auto">
      <div className="relative flex min-w-[600px] items-center justify-between px-xl md:w-full">
        <div className="absolute left-[60px] right-[60px] top-[18px] -z-10 h-[3px] rounded-full bg-line" aria-hidden="true" />
        <div
          className="absolute left-[60px] top-[18px] -z-10 h-[3px] rounded-full bg-primary transition-all duration-300"
          style={{ width: `calc((100% - 120px) * ${(current - 1) / (STEPS.length - 1)})` }}
          aria-hidden="true"
        />
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? 'done' : n === current ? 'active' : 'todo';
          return (
            <div key={label} className="flex flex-col items-center gap-sm">
              <span
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-h3 font-bold transition-all duration-300',
                  state === 'done' && 'border-primary bg-card text-primary',
                  state === 'active' && 'border-primary bg-primary text-white shadow-md',
                  state === 'todo' && 'border-[#D1D5DB] bg-page text-ink-3',
                )}
              >
                {state === 'done' ? <IconCheck size={20} /> : n}
              </span>
              <span
                className={clsx(
                  'text-label',
                  state === 'active' ? 'font-bold text-primary' : state === 'done' ? 'text-primary' : 'text-ink-3',
                )}
              >
{tx(label)}
              </span>
            </div>
          );
        })}
        <span className="sr-only">{fill}</span>
      </div>
    </div>
  );
}
