import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  faBagShopping,
  faBell,
  faCheckDouble,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faGrip,
  faLightbulb,
  faMagnifyingGlass,
  faShieldHalved,
  faTag,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Icon } from '../../components/ui/Icon';
import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useListNotificationsQuery } from '../../services/api/notificationsApi';
import type { AppNotification, NotificationType } from '../../types/domain';

type NotificationFilter = 'all' | 'orders' | 'promotions' | 'security';

const PAGE_SIZE = 5;

const filters: Array<{ id: NotificationFilter; label: string; icon: IconDefinition }> = [
  { id: 'all', label: 'Toutes', icon: faGrip },
  { id: 'orders', label: 'Commandes', icon: faBagShopping },
  { id: 'promotions', label: 'Promotions', icon: faTag },
  { id: 'security', label: 'Sécurité', icon: faShieldHalved },
];

const visualByType: Record<NotificationType, { icon: IconDefinition; iconTone: string; iconBackground: string }> = {
  order: { icon: faBagShopping, iconTone: 'text-emerald-600', iconBackground: 'border-emerald-200 bg-emerald-50' },
  promotion: { icon: faTag, iconTone: 'text-amber-600', iconBackground: 'border-amber-200 bg-amber-50' },
  security: { icon: faShieldHalved, iconTone: 'text-rose-500', iconBackground: 'border-rose-200 bg-rose-50' },
  info: { icon: faCircleInfo, iconTone: 'text-orange-500', iconBackground: 'border-orange-200 bg-orange-50' },
};

function matchesFilter(notification: AppNotification, filter: NotificationFilter) {
  if (filter === 'all') return true;
  if (filter === 'orders') return notification.type === 'order';
  if (filter === 'promotions') return notification.type === 'promotion';
  return notification.type === 'security';
}

export function NotificationsPage() {
  const { data: notifications = [], isLoading, isFetching } = useListNotificationsQuery();
  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();
  const [markRead] = useMarkNotificationReadMutation();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [locallyRead, setLocallyRead] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  const isRead = (notification: AppNotification) => notification.read || locallyRead.has(notification.id);

  const unreadCount = notifications.filter((notification) => !isRead(notification)).length;
  const filteredNotifications = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return notifications.filter((notification) => {
      const inCategory = matchesFilter(notification, activeFilter);
      const inSearch = !normalizedSearch || `${notification.title} ${notification.message}`.toLocaleLowerCase().includes(normalizedSearch);
      return inCategory && inSearch;
    });
  }, [activeFilter, notifications, search]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const visibleNotifications = filteredNotifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const announce = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3200);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
      setLocallyRead(new Set(notifications.map((notification) => notification.id)));
      announce('Toutes les notifications sont maintenant marquées comme lues.');
    } catch {
      announce('Impossible de mettre à jour les notifications.');
    }
  };

  const handleMarkRead = async (notification: AppNotification) => {
    if (isRead(notification)) return;
    try {
      await markRead(notification.id).unwrap();
      setLocallyRead((current) => new Set(current).add(notification.id));
    } catch {
      announce('Impossible de marquer cette notification comme lue.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[78px] max-w-[1500px] items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="TOKPa, retour à l'accueil">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-xl text-brand-500"><Icon icon={faBagShopping} /></span>
            <span className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">TOK<span className="text-brand-500">Pa</span></span>
          </Link>

          <label className="relative hidden max-w-[430px] flex-1 md:block">
            <span className="sr-only">Rechercher une notification</span>
            <Icon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Rechercher des notifications…" className="w-full rounded-xl border border-transparent bg-[#f5eee9] py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-500 focus:border-orange-200 focus:bg-white focus:ring-4 focus:ring-orange-100" />
          </label>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Link to="/client/notifications" className="relative grid h-11 w-11 place-items-center rounded-xl bg-[#f5eee9] text-slate-900 transition hover:bg-orange-100 hover:text-brand-600" aria-label="Notifications">
              <Icon icon={faBell} />
              {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-[#f5eee9]" />}
            </Link>
            <span className="hidden text-sm font-semibold text-slate-500 sm:block">Aïcha</span>
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-500"><Icon icon={faUser} /></span>
          </div>
        </div>
        <div className="px-5 pb-3 md:hidden">
          <label className="relative block">
            <span className="sr-only">Rechercher une notification</span>
            <Icon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Rechercher…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-orange-200 focus:bg-white focus:ring-4 focus:ring-orange-100" />
          </label>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-78px)] max-w-[1500px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white px-5 py-10 lg:flex lg:flex-col">
          <p className="px-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Filtres</p>
          <nav className="mt-6 space-y-2" aria-label="Filtrer les notifications">
            {filters.map((filter) => (
              <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-base font-semibold transition ${activeFilter === filter.id ? 'bg-orange-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon icon={filter.icon} className="w-5" />
                <span>{filter.label}</span>
                {filter.id === 'all' && unreadCount > 0 && <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-brand-700">{unreadCount}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm leading-6 text-orange-900">
            <div className="flex items-center gap-3 font-bold text-orange-700"><Icon icon={faLightbulb} /> Astuce TOKPa</div>
            <p className="mt-3">Activez les notifications SMS pour ne manquer aucune négociation en direct.</p>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-8 sm:px-8 sm:py-10 xl:px-16">
          <div className="mx-auto max-w-[1100px]">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="eyebrow">Centre de communication</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Historique des notifications</h1>
                <p className="mt-2 text-base text-slate-500">Vous avez {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}</p>
              </div>
              <button type="button" disabled={isMarkingAll || unreadCount === 0} onClick={() => void handleMarkAllRead()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-500 px-4 py-3 text-sm font-bold text-brand-600 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"><Icon icon={faCheckDouble} /> {isMarkingAll ? 'Mise à jour…' : 'Tout marquer comme lu'}</button>
            </div>

            <div className="mt-7 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {filters.map((filter) => <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${activeFilter === filter.id ? 'bg-orange-100 text-brand-700' : 'bg-white text-slate-600'}`}><Icon icon={filter.icon} />{filter.label}</button>)}
            </div>

            <div className="mt-7 space-y-4" aria-live="polite">
              {isLoading && Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[104px] animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
              {!isLoading && visibleNotifications.map((notification, index) => {
                const visual = visualByType[notification.type];
                const read = isRead(notification);
                return (
                  <article key={notification.id} style={{ animationDelay: `${index * 70}ms` }} className={`motion-enter rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${read ? 'border-slate-200' : 'border-orange-100'}`}>
                    <div className="flex items-start gap-4 sm:gap-5">
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border text-lg ${visual.iconBackground} ${visual.iconTone}`}><Icon icon={visual.icon} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <h2 className={`text-base font-black sm:text-lg ${read ? 'text-slate-800' : 'text-slate-950'}`}>{notification.title}</h2>
                          <div className="flex shrink-0 items-center gap-3 text-xs font-medium text-slate-400"><span>{notification.relativeTime}</span>{!read && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-label="Non lue" />}</div>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">{notification.message}</p>
                        {!read && <button type="button" onClick={() => void handleMarkRead(notification)} className="mt-3 text-xs font-bold text-brand-600 hover:text-brand-700">Marquer comme lue</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
              {!isLoading && visibleNotifications.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-xl text-slate-400"><Icon icon={faBell} /></span><h2 className="mt-4 text-lg font-black">Aucune notification trouvée</h2><p className="mt-2 text-sm text-slate-500">Essayez un autre filtre ou une autre recherche.</p></div>}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              <button type="button" disabled={page === 1 || isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"><Icon icon={faChevronLeft} /></button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold transition ${page === pageNumber ? 'bg-brand-500 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-brand-600'}`}>{pageNumber}</button>)}
              <button type="button" disabled={page === totalPages || isFetching} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"><Icon icon={faChevronRight} /></button>
            </div>
          </div>
        </main>
      </div>

      {message && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl motion-enter">{message}</div>}
    </div>
  );
}
