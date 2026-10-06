import { useEffect, useState } from 'react';
import { Link, useRouterState, useSearch } from '@tanstack/react-router';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import FaIcon from '../../../components/shared/FaIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import { alertApiError } from '../../../utils/apiError';
import { currentUserName } from '../../../routes/authGuard';
import { fmtFcfa } from '../../../services/api/unwrap';
import {
  articlesCount,
  destination,
  dureeMinutes,
  fetchDeliveredOrder,
  fmtDuree,
  tokRef,
  type LivreurOrder,
  libelleArticle,
} from '../livreurData';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';

/** Cartes de la maquette : rayon 14px, bordure 0.5px #E5E7EB, ombre discrète. */
const CARD = 'overflow-hidden rounded-lg border-[0.5px] border-border-default bg-bg-card shadow-sm';
const EYEBROW = 'text-xs font-semibold uppercase tracking-wider text-text-secondary';

/**
 * Récapitulatif de fin de course — maquette Stitch « r_capitulatif_de_fin_de_course_tokpa ».
 *
 * Sources réelles : commande transmise par la page Course active (PATCH /livreur/deliveries/{id}/status
 * renvoie `$order->fresh()`, donc l'heure de livraison) ; à défaut, relue dans GET /livreur/history.
 * Écarts assumés avec la maquette (aucune donnée inventée) : le backend n'a ni colonne « note client »,
 * ni « pourboire » (grep vide dans database/migrations), ni horodatage de livraison dans l'historique,
 * ni trace GPS consultable par le livreur → ces cases affichent un tiret avec leur explication.
 */
export default function LivreurRecapPage() {
  useLanguage();
  const { commande } = useSearch({ from: '/livreur/recapitulatif' });
  const navState = useRouterState({
    select: (s) => s.location.state as { order?: LivreurOrder; deliveredAt?: string | null } | undefined,
  });
  const fromNav = navState?.order && navState.order.id === commande ? navState.order : null;
  const [order, setOrder] = useState<LivreurOrder | null>(fromNav ?? null);
  // Horodatage lu dans la réponse du PATCH (aucun equivalent dans GET /livreur/history).
  const deliveredAt = fromNav ? (navState?.deliveredAt ?? null) : null;
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const prenom = (currentUserName() ?? '').split(' ')[0];

  // Rechargement direct (plus d'état de navigation) → commande relue dans l'historique réel.
  useEffect(() => {
    if (order || !commande) return;
    let alive = true;
    setErr(null);
    fetchDeliveredOrder(commande)
      .then((found) => {
        if (!alive) return;
        if (found) setOrder(found);
        else
          setErr(
            tr(
              `La commande ${tokRef(commande)} ne figure pas parmi vos dernières livraisons.`,
              `Order ${tokRef(commande)} is not among your recent deliveries.`,
            ),
          );
      })
      .catch((e) => alive && setErr(alertApiError(e, 'livreur-load')));
    return () => {
      alive = false;
    };
  }, [order, commande, reloadKey]);

  const heure = deliveredAt
    ? new Date(deliveredAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const duree = dureeMinutes(order?.created_at, deliveredAt);

  const meta = (label: string, value: string, hint?: string) => (
    <div className="flex flex-col">
      <span className={EYEBROW}>{label}</span>
      <span className="mt-0.5 text-sm font-medium text-text-main" title={hint}>
        {value}
      </span>
    </div>
  );

  /** Colonne de statistique de la maquette : icône, valeur forte, libellé discret. */
  const stat = (icon: string, value: string, label: string, hint: string, accent?: string) => (
    <div className="flex flex-col items-center justify-center gap-1 py-1" title={hint}>
      <FaIcon name={icon} className={`text-[20px] ${accent ?? 'text-text-secondary'}`} />
      <span className="text-[24px] font-bold leading-none text-text-main">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );

  return (
    <LivreurLayout>
      <div className="flex flex-col items-center p-md sm:p-xl">
        <div className="w-full max-w-[800px]">
          {!order ? (
            err || !commande ? (
              <ApiErrorState
                title={tx('Récapitulatif indisponible')}
                message={err ?? tx('Aucune commande indiquée.')}
                onRetry={commande ? () => setReloadKey((k) => k + 1) : undefined}
                className={`${CARD} px-md`}
              />
            ) : (
              <LoadingState label={tx('Chargement du récapitulatif…')} className={CARD} />
            )
          ) : (
            <>
              {/* En-tête de succès — pastille qui apparaît, titre, message personnalisé. */}
              <header className="mb-8 text-center">
                <div className="tokpa-pop mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border border-success/30 bg-success-light shadow-sm">
                  <FaIcon name="check_circle" className="text-[38px] text-success" />
                </div>
                <h1 className="text-[24px] font-bold leading-tight text-text-main sm:text-[28px]">
                  {tx('Course terminée avec succès !')}
                </h1>
                <p className="mt-1.5 text-[15px] text-text-secondary">
                  {tx('Félicitations pour cette livraison')}
                  {prenom ? `, ${prenom}` : ''}.
                </p>
              </header>

              {/* Carte principale : revenus, métadonnées de la course, statistiques. */}
              <section className={`${CARD} tokpa-rise mb-6`} style={{ animationDelay: '80ms' }}>
                <div className="border-b border-border-default p-6 text-center">
                  <p className={`${EYEBROW} mb-1.5`}>{tx('Revenus totaux')}</p>
                  <h2 className="flex flex-wrap items-center justify-center gap-2 text-[26px] font-bold leading-tight text-text-main sm:text-[32px]">
                    <span>{tx('Gain de la course :')}</span>
                    <span
                      className="font-bold text-primary"
                      title={tx(
                        'Frais de livraison de la commande : le backend ne calcule aucun autre reversement au livreur.',
                      )}
                    >
                      {fmtFcfa(order.frais_livraison)}
                    </span>
                  </h2>
                  <div className="mt-5 flex items-center justify-center gap-6 border-t border-border-default pt-4 sm:gap-10">
                    <div className="text-center">
                      <p className="text-xs font-medium text-text-secondary">{tx('Montant de la commande')}</p>
                      <p className="mt-0.5 text-base font-semibold text-text-main">{fmtFcfa(order.montant_total)}</p>
                    </div>
                    <div className="h-8 w-px bg-border-default" />
                    <div className="text-center">
                      <p className="text-xs font-medium text-text-secondary" title={tx('Aucun champ pourboire côté backend')}>
                        {tx('Pourboire client')}
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-text-secondary">{'—'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 border-b border-border-default bg-bg-secondary p-5 sm:grid-cols-3">
                  {meta(tx('Commande'), tokRef(order.id))}
                  {meta(
                    tx('Heure de livraison'),
                    heure,
                    heure === '—'
                      ? tx("L'historique ne renvoie pas l'heure de livraison : elle est lue à la validation de la course.")
                      : tx('Heure du passage de la commande en « livré ».'),
                  )}
                  {meta(tx('Destination'), destination(order))}
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                  {stat(
                    'route',
                    '—',
                    tx('Distance'),
                    tx('Aucun historique de trace GPS n’est exposé au livreur par le backend.'),
                  )}
                  {stat(
                    'schedule',
                    fmtDuree(duree),
                    tx('Temps'),
                    duree == null
                      ? tx('Heure de livraison inconnue : durée non calculable.')
                      : tx('Durée entre la création de la commande et sa livraison.'),
                    'text-primary',
                  )}
                  {stat('star', '—', tx('Note client'), tx('Le backend n’enregistre pas encore de note client par course.'), 'text-amber-400')}
                </div>
              </section>

              {/* Détail de la commande : quantités et prix unitaires réellement renvoyés. */}
              <section
                className="tokpa-rise mb-8 rounded-lg border-[0.5px] border-border-default bg-bg-card p-6 shadow-sm"
                style={{ animationDelay: '160ms' }}
              >
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-text-main">
                  <FaIcon name="shopping_basket" className="text-[20px] text-text-secondary" />
                  <span>{tx('Détails de la commande')}</span>
                  <span className="ml-auto rounded-full bg-bg-app px-2.5 py-1 text-xs font-medium text-text-secondary">
                    {articlesCount(order)} {tx('articles')}
                  </span>
                </h3>
                <ul className="divide-y divide-border-default">
                  {(order.items ?? []).map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary-light/50 bg-primary-tint text-xs font-bold text-primary">
                          {it.quantite}x
                        </span>
                        <span className="truncate text-sm font-medium text-text-main">
                          {libelleArticle(it)}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-bg-app px-2.5 py-1 text-xs font-medium text-text-secondary">
                        {fmtFcfa(it.prix_unitaire)}
                      </span>
                    </li>
                  ))}
                  {(order.items ?? []).length === 0 && (
                    <li className="py-3 text-sm text-text-secondary">{tx('Aucun article transmis.')}</li>
                  )}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-text-secondary">
                  {tx('Pourboire, note client et distance de course non encore gérés par le backend.')}
                </p>
              </section>
            </>
          )}

          {/* Actions — identiques à la maquette (retour tableau de bord / historique). */}
          <div className="flex flex-col items-center justify-center gap-4 pb-4 sm:flex-row">
            <Link
              to="/livreur"
              className="flex min-w-[220px] items-center justify-center gap-2.5 rounded-[10px] bg-primary-container px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-95"
            >
              <FaIcon name="dashboard" className="text-[20px]" />
              <span>{tx('Retour au tableau de bord')}</span>
            </Link>
            <Link
              to="/livreur/historique"
              className="flex min-w-[220px] items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-primary-light bg-primary-tint px-6 py-3.5 text-sm font-semibold text-primary-dark transition-all duration-150 hover:bg-primary-light active:scale-95"
            >
              <FaIcon name="receipt_long" className="text-[20px]" />
              <span>{tx("Voir l'historique complet")}</span>
            </Link>
          </div>
        </div>
      </div>
    </LivreurLayout>
  );
}
