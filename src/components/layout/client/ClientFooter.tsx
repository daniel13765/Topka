import toast from 'react-hot-toast';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


/** Footer clair des pages marchandes (maquette panier/caisse). */
export default function ClientFooter() {
  const { isFr } = useLanguage();

  const links = [
    { label: isFr ? 'Aide' : 'Help' },
    { label: isFr ? tx("Conditions d'utilisation") : 'Terms of Service' },
    { label: isFr ? tx("Politique de confidentialité") : 'Privacy Policy' },
    { label: isFr ? 'Contact' : 'Contact' },
  ];

  return (
    <footer className="mt-auto w-full border-t border-line bg-surface px-lg py-xl">
      <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-lg md:flex-row md:items-center">
        <div className="flex flex-col gap-sm">
          <span className="text-h3 font-medium text-primary">TOKPa</span>
          <p className="text-secondary text-ink-2">© 2024 TOKPa. {isFr ? tx("Tous droits réservés.") : 'All rights reserved.'}</p>
        </div>
        <nav className="flex flex-wrap gap-lg">
          {links.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => toast(`${item.label} — ${isFr ? tx("à venir") : 'coming soon'}`)}
              className="text-secondary text-ink-2 opacity-80 transition-all hover:text-primary hover:opacity-100"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
