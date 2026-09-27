import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientFooter from '../../../components/layout/client/ClientFooter';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import Pagination from '../../../components/shared/Pagination';
import EmptyState from '../../../components/shared/EmptyState';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import { alertApiError } from '../../../utils/apiError';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { useLanguage } from '../../../context/LanguageContext';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import { notificationsApi, type ApiNotification } from '../../../services/api';
import type { NotificationType } from '../../../types/models';
import { describeNotification, formatTime } from '../../../utils/notificationText';
import { tx } from '../../../i18n/tx';


type FilterKey = 'all' | NotificationType;

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'Toutes', icon: 'grid_view' },
  { key: 'order', label: 'Commandes', icon: 'shopping_bag' },
  { key: 'promo', label: 'Promotions', icon: 'local_offer' },
  { key: 'security', label: 'Sécurité', icon: 'shield' },
];

interface UiNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  orderId?: number;
}

/** Libellés statuts backend (machine à états Commande + BudgetPropose). */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthGuard('/connexion');
  const { isFr } = useLanguage();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [hasLoaded, setHasLoaded] = useState(false);
  // Échec du chargement : message de l'API + Réessayer (avant : « Aucune notification », trompeur).
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPage = useCallback(
    (p: number) => {
      if (!isAuthenticated) return;
      notificationsApi
        .getNotifications(p)
        .then((res) => {
          const items: ApiNotification[] = res?.data ?? (Array.isArray(res) ? res : []);
          const mapped: UiNotification[] = items.map((n) => {
            const desc = describeNotification(n, isFr);
            return {
              id: String(n.id),
              type: desc.type,
              title: desc.title,
              message: desc.message,
              time: formatTime(n.created_at, isFr),
              unread: n.lu === false,
              orderId: desc.orderId,
            };
          });
          setNotifications(mapped);
          if (res?.last_page) setPageCount(res.last_page);
          setLoadError(null);
          setHasLoaded(true);
        })
        .catch((err) => {
          setLoadError(alertApiError(err, 'notifications-load'));
          setHasLoaded(true);
        });
    },
    [isAuthenticated, isFr],
  );

  useEffect(() => {
    loadPage(page);
  }, [loadPage, page]);

  // Temps réel : un événement push sur notifications.{userId} → rechargement silencieux
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeRealtimeRefresh(['notifications'], () => loadPage(page));
  }, [isAuthenticated, loadPage, page]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="bg-bg-app min-h-screen flex items-center justify-center font-body text-text-main">
        <MIcon name="sync" className="text-primary text-4xl animate-spin" />
      </div>
    );
  }

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);
  const unreadCount = notifications.filter((n) => n.unread).length;

  const markRead = (item: UiNotification) => {
    if (!item.unread) return;
    notificationsApi.markRead(item.id).catch(() => {});
    setNotifications((list) => list.map((n) => (n.id === item.id ? { ...n, unread: false } : n)));
  };

  const markAllRead = () => {
    setNotifications((list) =>
      list.map((n) => {
        if (n.unread) notificationsApi.markRead(n.id).catch(() => {});
        return { ...n, unread: false };
      }),
    );
  };

  const handleNotificationClick = (item: UiNotification) => {
    markRead(item);
    if (item.orderId) {
      navigate({ to: '/commandes/suivi', search: { order: String(item.orderId) } });
    } else if (item.type === "promo") {
      navigate({ to: '/negociations' });
    } else {
      navigate({ to: '/profil' });
    }
  };

  return (
    <div className="bg-bg-app font-body text-text-main min-h-screen flex flex-col">
      <ClientNavbar />

      <div className="mt-[52px] md:mt-[64px] flex flex-1 max-w-[1200px] w-full mx-auto pb-24">
        {/* Sidebar Navigation */}
        <aside className="hidden md:flex w-64 border-r border-border-default bg-white flex-col p-4 gap-2 shrink-0">
          <div className="px-2 py-3">
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider">{tx("Filtres")}</p>
          </div>
          <nav className="space-y-1">
            {FILTERS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer',
                  filter === key
                    ? 'bg-primary-tint text-primary font-bold border-l-2 border-primary'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-main',
                )}
              >
                <MIcon name={icon} className="text-lg" />
                <span>{tx(label)}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto p-4 bg-primary-tint rounded-xl border border-primary-light">
            <div className="flex items-center gap-2 mb-2">
              <MIcon name="lightbulb" className="text-primary" />
              <span className="text-xs font-bold text-primary-dark">{tx("Astuce TOKPa")}</span>
            </div>
            <p className="text-xs text-primary-deep leading-relaxed">
              {tx("Les notifications de statut de commande arrivent en temps réel — aucune actualisation nécessaire.")}
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 bg-bg-app p-4 sm:p-6 md:p-8 min-w-0">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-h2 md:text-h1 font-bold text-text-main mb-1">
                  {tx("Historique des notifications")}
                </h1>
                <p className="text-text-secondary text-sm">
                  {unreadCount > 0
                    ? `Vous avez ${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                    : "Vous n'avez aucune notification non lue"}
                </p>
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="px-4 py-2.5 rounded-xl border border-primary text-primary hover:bg-primary-tint transition-all flex items-center gap-2 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                <MIcon name="done_all" />
                {tx("Tout marquer comme lu")}
              </button>
            </div>

            {/* Mobile Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 md:hidden">
              {FILTERS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer',
                    filter === key
                      ? 'bg-primary-container text-white font-bold'
                      : 'bg-white text-text-secondary border border-border-default',
                  )}
                >
                  <MIcon name={icon} className="text-sm" />
                  <span>{tx(label)}</span>
                </button>
              ))}
            </div>

            {/* Notification List */}
            {loadError ? (
              <div className="bg-white border border-border-default rounded-xl">
                <ApiErrorState
                  title={tx("Impossible de charger les notifications")}
                  message={loadError}
                  onRetry={() => loadPage(page)}
                />
              </div>
            ) : filtered.length === 0 && hasLoaded ? (
              <div className="bg-white border border-border-default rounded-xl">
                <EmptyState
                  icon={<MIcon name="notifications" className="text-4xl text-primary" />}
                  title={filter === 'all' ? tx("Aucune notification") : 'Aucune notification de ce type'}
                  description={tx("Vos alertes (commandes, négociations, paiements) apparaîtront ici.")}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const isUnread = item.unread;
                  const typeIcon =
                    item.type === 'order'
                      ? 'shopping_bag'
                      : item.type === "promo"
                        ? 'local_offer'
                        : item.type === 'security'
                          ? 'shield'
                          : 'info';

                  const iconBg =
                    item.type === 'order'
                      ? 'bg-success-light text-success-dark border-success-dark/20'
                      : item.type === "promo"
                        ? 'bg-amber-light text-amber-text border-amber-hover/20'
                        : item.type === 'security'
                          ? 'bg-error-light text-error-dark border-error-dark/20'
                          : 'bg-primary-tint text-primary border-primary-light';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={clsx(
                        'p-4 rounded-xl border border-border-default flex items-start gap-4 transition-all hover:border-primary-container hover:shadow-sm cursor-pointer',
                        isUnread ? 'bg-white' : 'bg-white/80 opacity-80',
                      )}
                    >
                      <div className={clsx('w-10 h-10 shrink-0 rounded-full flex items-center justify-center border', iconBg)}>
                        <MIcon name={typeIcon} className="text-xl" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-h3 font-bold truncate text-text-main">{item.title}</h3>
                          <span className="text-micro text-text-tertiary shrink-0 ml-2">{item.time}</span>
                        </div>
                        <p className="text-body text-text-secondary line-clamp-2">{item.message}</p>
                      </div>
                      {isUnread && (
                        <div className="shrink-0 pt-1">
                          <div className="w-2 h-2 rounded-full bg-primary-container" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pageCount > 1 && (
              <Pagination page={page} pageCount={pageCount} onChange={setPage} className="mt-8" />
            )}
          </div>
        </section>
      </div>

      <ClientFooter />
      <ClientBottomNav />
    </div>
  );
}
