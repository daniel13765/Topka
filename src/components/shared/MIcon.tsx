import clsx from 'clsx';
import type { CSSProperties } from 'react';

interface MIconProps {
  /** Nom de l'icône Material Symbols (ligature), ex. "shopping_cart". */
  name: string;
  className?: string;
  /** Active le remplissage (FILL 1) pour les icônes pleines (étoile…). */
  filled?: boolean;
  style?: CSSProperties;
}

/** Icône Material Symbols conforme aux exports Stitch (code.html). */
export default function MIcon({ name, className, filled, style }: MIconProps) {
  const merged: CSSProperties | undefined = filled
    ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24", ...style }
    : style;
  return (
    <span className={clsx('material-symbols-outlined', className)} style={merged} aria-hidden="true">
      {name}
    </span>
  );
}
