import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import NotificationItem from '../../shared/NotificationItem';
import { notificationsApi, type ApiNotification } from '../../../services/api';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import { describeNotification, formatTime } from '../../../utils/notificationText';
import { alertApiError } from '../../../utils/apiError';
import type { AppNotification } from '../../../types/models';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


interface AdminNotificationBellProps {
  /** Classes du bouton : chaque barre garde le style de sa maquette. */
  className: string;
  /** Icône de la cloche (MIcon ou icône Tabler selon la maquette). */
  icon: ReactNode;
  /** Classes de la pastille « non lues » (affichée seulement s'il y en a). */
  dotClassName?: string;
}

/**
 * Cloche de l'espace admin — vraies notifications (GET /notifications), compteur des non lues,
 * liste déroulante (dernières notifications), clic = marquée comme lue (PATCH …/read),
 * rafraîchissement en temps réel, lien vers l'historique complet (/notifications).
 */
export default function AdminNotificationBell({ className, icon, dotClassName = 'absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full' }: AdminNotificationBellProps) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(() => {
    notificationsApi
      .getNotifications(1)
      .then((res) => {
        const list: ApiNotification[] = res?.data ?? (Array.isArray(res) ? res : []);
        setItems(
          list.map((n) => {
            const d = describeNotification(n, true);
            return { id: String(n.id), type: d.type, title: d.title, message: d.message, time: formatTime(n.created_at, true), unread: n.lu === false };
          }),
        );
      })
      .catch((e) => alertApiError(e, 'admin-notifications'));
  }, []);

  useEffect(() => {
    load();
    return subscribeRealtimeRefresh(['notifications'], load);
  }, [load]);

  const unread = items.filter((n) => n.unread).length;

  const markRead = (n: AppNotification) => {
    setOpen(false);
    if (!n.unread) return;
    setItems((l) => l.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    notificationsApi.markRead(n.id).catch((e) => alertApiError(e, 'admin-notifications'));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}
        className={`relative ${className}`}
      >
        {icon}
        {unread > 0 && <span className={dotClassName} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-sm w-[340px] overflow-hidden rounded-[14px] border-0.5 border-line bg-card shadow-lg">
            <div className="flex items-center justify-between border-b-0.5 border-line p-md">
              <span className="text-[13px] font-semibold text-ink">Notifications</span>
              <span className="text-[12px] text-ink-3">
                {unread} non lue{unread > 1 ? 's' : ''}
              </span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {items.length === 0 && <p className="p-md text-center text-[13px] text-ink-3">{tx("Aucune notification.")}</p>}
              {items.slice(0, 6).map((n) => (
                <NotificationItem key={n.id} notification={n} compact onClick={() => markRead(n)} />
              ))}
            </div>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block bg-surface p-md text-center text-[13px] font-medium text-primary transition-colors hover:bg-primary-lighter"
            >
              {tx("Voir tout l'historique")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
