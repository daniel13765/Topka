import { Link } from '@tanstack/react-router';
import MIcon from '../../shared/MIcon';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


/**
 * ProfileStats — Cartes de statistiques utilisateur (Commandes, Repères, Négociations).
 */
export default function ProfileStats() {
  const { t, isFr } = useLanguage();

  const stats = [
    {
      icon: 'shopping_bag',
      label: t('profile.ordersCount'),
      value: '12',
      sub: isFr ? tx("effectuées") : 'completed',
      iconBg: 'bg-primary-lighter text-primary-dark',
      link: '/profil',
    },
    {
      icon: 'location_on',
      label: t('profile.landmarksCount'),
      value: '3',
      sub: isFr ? tx("enregistrés") : 'saved',
      iconBg: 'bg-success-light text-success-dark',
      link: '/profil',
    },
    {
      icon: 'handshake',
      label: t('profile.negotiations'),
      value: '14 500 F',
      sub: isFr ? tx("économies réalisées") : 'savings made',
      iconBg: 'bg-amber-light text-amber-text',
      link: '/negociations',
    },
  ];

  return (
    <div className="mb-md grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-md">
      {stats.map((s) => (
        <Link
          key={s.label}
          to={s.link}
          className="flex items-center gap-md rounded-[14px] border border-line bg-white p-4 shadow-sm transition-transform hover:border-primary-light active:scale-98"
        >
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
            <MIcon name={s.icon} className="text-[24px]" />
          </div>
          <div>
            <p className="text-micro uppercase tracking-wider text-ink-3">{s.label}</p>
            <p className="text-lg font-bold text-ink sm:text-xl">{s.value}</p>
            <span className="text-[11px] text-ink-2">{s.sub}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
