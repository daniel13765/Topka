import EmptyState from './EmptyState';
import MIcon from './MIcon';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';

interface ApiErrorStateProps {
  /** Ce qui n'a pas pu être chargé, ex. « Impossible de charger les produits ». */
  title: string;
  /** Message renvoyé par l'API (statut + texte exact, cf. alertApiError). */
  message: string;
  /** Relance l'appel ; absent = pas de bouton. */
  onRetry?: () => void;
  className?: string;
}

/** Échec d'un appel API : message exact du backend + « Réessayer » (jamais de données factices). */
export default function ApiErrorState({ title, message, onRetry, className }: ApiErrorStateProps) {
  useLanguage();
  return (
    <EmptyState
      icon={<MIcon name="cloud_off" className="text-4xl text-primary" />}
      title={title}
      description={message}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-primary-container px-lg py-3 font-bold text-white transition-all active:scale-[0.97]"
          >
{tx("Réessayer")}
          </button>
        )
      }
      className={className}
    />
  );
}
