import clsx from 'clsx';
import {
  IconShoppingBag,
  IconTag,
  IconShieldCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import type { AppNotification, NotificationType } from '../../types/models';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


const STYLES: Record<NotificationType, { icon: TablerIcon; circle: string }> = {
  order: { icon: IconShoppingBag, circle: 'bg-success-light text-success-dark' },
  promo: { icon: IconTag, circle: 'bg-amber-light text-amber-text' },
  security: { icon: IconShieldCheck, circle: 'bg-error-light text-error-dark' },
  info: { icon: IconInfoCircle, circle: 'bg-primary-lighter text-primary-dark' },
};

interface NotificationItemProps {
  notification: AppNotification;
  /** Version compacte pour le dropdown de la cloche */
  compact?: boolean;
  onClick?: () => void;
}

/** Ligne de notification (maquette historique) : cercle icône, titre, message, temps, pastille non lue. */
export default function NotificationItem({ notification, compact, onClick }: NotificationItemProps) {
  useLanguage();
  const { icon: Icon, circle } = STYLES[notification.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-md rounded-[14px] bg-card p-md text-left transition-colors duration-150 hover:bg-surface',
        compact && 'rounded-none border-b-0.5 border-line p-md hover:bg-primary-lighter',
      )}
    >
      <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', circle)}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-sm">
          <span className="truncate text-[15px] font-semibold text-ink">{notification.title}</span>
          <span className="shrink-0 text-[12px] text-ink-3">{notification.time}</span>
        </span>
        {!compact && (
          <span className="mt-xs block text-secondary text-ink-2">{notification.message}</span>
        )}
      </span>
      {notification.unread && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={tx("Non lue")} />
      )}
    </button>
  );
}
