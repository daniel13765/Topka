import clsx from 'clsx';
import MIcon from './MIcon';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/** Chargement en cours (même icône que la fiche produit) — à la place des anciennes données factices. */
export default function LoadingState({ label, className }: { label?: string; className?: string }) {
  useLanguage();
  return (
    <div className={clsx('flex flex-col items-center justify-center py-xl text-center text-ink-2', className)}>
      <MIcon name="sync" className="animate-spin text-4xl text-primary" />
      <p className="mt-sm text-secondary">{label ?? tx("Chargement…")}</p>
    </div>
  );
}
