import { Link } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import MIcon from '../../shared/MIcon';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';


const soon = (label: string) => () => toast(tr(`${label} — bientôt disponible`, `${tx(label)} — coming soon`));

/** Footer sombre de l'accueil — copie conforme du code.html Stitch. */
export default function DarkFooter() {
  const { isFr } = useLanguage();

  return (
    <footer className="mt-xl bg-on-surface py-xl text-warm">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-xl px-4 md:grid-cols-4">
        <div className="col-span-1">
          <h2 className="mb-md font-h2 text-h2 text-primary-light">TOKPa</h2>
          <p className="text-body text-surface-variant">
            {isFr
              ? tx("Le meilleur du marché béninois dans votre poche. Fraîcheur garantie et prix négociables.")
              : 'The best of the Benin market in your pocket. Guaranteed freshness and negotiable prices.'}
          </p>
        </div>

        <div>
          <h4 className="mb-md font-bold">{isFr ? 'Plateforme' : 'Platform'}</h4>
          <ul className="flex flex-col gap-sm text-body text-surface-variant">
            <li>
              <Link to="/catalogue" className="hover:text-white">
                {isFr ? tx("Explorer le marché") : 'Explore market'}
              </Link>
            </li>
            <li>
              <Link to="/negociations" className="hover:text-white">
                {isFr ? tx("Mes Négociations") : 'My Negotiations'}
              </Link>
            </li>
            <li>
              <Link to="/admin/catalogue" className="hover:text-white">
                {isFr ? 'Espace Administration' : 'Admin Area'}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-md font-bold">{isFr ? tx("Aide & Suivi") : 'Help & Tracking'}</h4>
          <ul className="flex flex-col gap-sm text-body text-surface-variant">
            <li>
              <Link to="/messagerie" className="hover:text-white">
                {isFr ? 'Messagerie Client ↔ Livreur' : 'Rider Messaging'}
              </Link>
            </li>
            <li>
              <Link to="/commandes/suivi" className="hover:text-white">
                {isFr ? tx("Suivi en Temps Réel") : 'Live Order Tracking'}
              </Link>
            </li>
            <li>
              <Link to="/profil" className="hover:text-white">
                {isFr ? tx("Mon Compte") : 'My Account'}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-md font-bold">{isFr ? 'Suivez-nous' : 'Follow Us'}</h4>
          <div className="flex gap-md">
            <button
              type="button"
              onClick={soon('Facebook')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-on-surface-variant transition-colors hover:bg-primary-shade cursor-pointer"
              aria-label="Facebook"
            >
              <MIcon name="face_nod" />
            </button>
            <button
              type="button"
              onClick={soon(tx("Partager"))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-on-surface-variant transition-colors hover:bg-primary-shade cursor-pointer"
              aria-label={tx("Partager")}
            >
              <MIcon name="share" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-xl max-w-[1200px] border-t border-on-surface-variant px-4 pt-lg text-center text-label text-surface-variant">
        © 2026 TOKPa. {isFr ? tx("Tous droits réservés.") : 'All rights reserved.'} Cotonou, Bénin.
      </div>
    </footer>
  );
}
