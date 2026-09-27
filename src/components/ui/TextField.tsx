import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Icône Tabler affichée à gauche dans le champ */
  iconLeft?: ReactNode;
  /** Élément interactif à droite (ex : œil mot de passe) */
  rightSlot?: ReactNode;
  /** Bordure rouge (état erreur, cf. maquette Stitch) */
  error?: boolean;
  /** Élément aligné à droite du label (ex : lien « Mot de passe oublié ? ») */
  labelRight?: ReactNode;
}

/** Champ label + input, fidèle au design system TOKPa (design.md §4.2). */
export default function TextField({
  label,
  iconLeft,
  rightSlot,
  error,
  labelRight,
  className,
  id,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="w-full">
      <div className="mb-[6px] flex items-center justify-between gap-sm">
        <label htmlFor={inputId} className="label mb-0">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-ink-2">
            {iconLeft}
          </span>
        )}
        <input
          id={inputId}
          className={clsx(
            'input',
            iconLeft && 'pl-[42px]',
            rightSlot && 'pr-[42px]',
            error && 'border-error',
            className,
          )}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute right-[10px] top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
    </div>
  );
}
