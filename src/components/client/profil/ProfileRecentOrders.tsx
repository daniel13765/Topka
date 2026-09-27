import { Link } from '@tanstack/react-router';
import MIcon from '../../shared/MIcon';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


const RECENT_ORDERS = [
  { id: 'TOK-2847', date: 'Aujourd’hui', totalLabel: '3 980 FCFA', statusFr: 'En livraison', statusEn: 'Out for delivery', active: true },
  { id: 'TOK-2840', date: '08 Oct 2023', totalLabel: '12 400 FCFA', statusFr: 'Livré', statusEn: 'Delivered', active: false },
  { id: 'TOK-2831', date: '02 Oct 2023', totalLabel: '5 200 FCFA', statusFr: 'Livré', statusEn: 'Delivered', active: false },
];

/**
 * ProfileRecentOrders — Carte des commandes récentes du client.
 */
export default function ProfileRecentOrders() {
  const { t, isFr } = useLanguage();

  return (
    <section className="mb-md">
      <div className="mb-sm flex items-center justify-between">
        <h3 className="font-h3 text-h3 text-ink">{t('profile.myOrders')}</h3>
        <Link to="/commandes" className="font-label text-xs font-bold text-primary hover:underline sm:text-sm">
          {t('common.seeAll')}
        </Link>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-line bg-white shadow-sm">
        <div className="divide-y divide-line">
          {RECENT_ORDERS.map((o) => (
            <div
              key={o.id}
              className="flex flex-col gap-2 p-md transition-colors hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center justify-between sm:justify-start sm:gap-lg">
                <div className="flex flex-col">
                  <span className="font-bold text-ink">#{o.id}</span>
                  <span className="text-xs text-ink-3">{o.date}</span>
                </div>
                <div className="font-bold text-primary sm:hidden">{o.totalLabel}</div>
              </div>

              <div className="hidden font-bold text-primary sm:block">{o.totalLabel}</div>

              <div className="flex items-center justify-between gap-md sm:justify-end">
                <span
                  className={
                    o.active
                      ? 'rounded-full bg-primary-tint border border-primary-light px-2.5 py-1 text-micro font-bold uppercase text-primary-dark'
                      : 'rounded-full bg-success-light px-2.5 py-1 text-micro font-bold uppercase text-success-dark'
                  }
                >
                  {isFr ? o.statusFr : o.statusEn}
                </span>
                <Link
                  to={o.active ? '/commandes/suivi' : '/confirmation'}
                  className="flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
                >
                  {o.active ? (isFr ? tx("Suivre") : 'Track') : (isFr ? tx("Détails") : 'Details')}
                  <MIcon name="chevron_right" className="text-sm" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
