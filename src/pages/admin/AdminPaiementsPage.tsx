import { useMemo, useState } from 'react';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import FaIcon from '../../components/shared/FaIcon';
import { adminApi } from '../../services/api';
import { fmtFcfa } from '../../services/api/unwrap';
import { dateShort, useLiveRows } from '../../services/api/useLiveRows';
import type { PaymentRow } from '../../types/adminRows';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';
import {
  STATUTS,
  STATUT_UI,
  VIDE,
  estPurge,
  filtrerParStatut,
  sansJeton,
  statutDe,
  totauxDe,
  type StatutPaiement,
} from '../../utils/adminPaiements';

/**
 * AdminPaiementsPage — écran branché sur `GET /admin/payments` (et son jumeau
 * `GET /admin/clients/payments`), ajouté au backend du 2 octobre 2026.
 *
 * Contrats réellement vérifiés dans `etokpa_back` :
 * - `PaymentController::listAllPayments` renvoie `response()->json(['success' => true, 'data' => $payments])` :
 *   modèle Eloquent BRUT, `with('order')`, **sans ressource, sans pagination et sans filtre** — `per_page`,
 *   `statut` ou `search` ne sont pas lus. Le filtrage et les totaux d'en bas portent donc sur ce qui a été
 *   reçu, et la page le dit au lieu de faire semblant d'interroger le serveur.
 * - colonnes de `payments` : `order_id`, `client_id`, `montant` (`decimal:2` → chaîne), `methode`
 *   (défaut `fedapay`), `statut` (enum `en_attente|reussi|echoue|rembourse`), `fedapay_ref` (unique),
 *   `fedapay_token`, `recu_url`, `paid_at`, `created_at`.
 * - `client_id` est un identifiant nu : la relation `client` n'est pas chargée par le contrôleur, donc
 *   aucun nom de client n'est affiché — le backend devrait faire un `with(['order','client'])`.
 * - ⚠ le modèle brut expose `fedapay_token`. Il n'est jamais lu, ni affiché, ni copiable depuis cet
 *   écran : la fiche détail le remplace par un marqueur.
 */

export default function AdminPaiementsPage() {
  useLanguage();
  const { rows, err, loading, reload } = useLiveRows<PaymentRow>(() => adminApi.getPayments());
  const [filtre, setFiltre] = useState<'' | StatutPaiement>('');
  const [selected, setSelected] = useState<PaymentRow | null>(null);

  const lignes = useMemo(
    () => filtrerParStatut(rows, filtre),
    [rows, filtre],
  );

  const totaux = useMemo(() => totauxDe(rows), [rows]);

  const compteDe = (s: string) => rows.filter((p) => statutDe(p) === s).length;

  return (
    <AdminLayout currentPath="/admin/paiements">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-h2 font-bold">{tx('Paiements')}</h1>
            <p className="text-text-secondary">
              {tx('Liste réelle — GET /admin/payments (modèle brut, sans pagination)')}
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="btn-press flex items-center gap-2 rounded-lg border border-border-default bg-white px-3 py-2 text-label font-semibold text-on-surface-variant transition-colors hover:bg-surface"
          >
            <FaIcon name="refresh" className="text-sm" />
            {tx('Recharger')}
          </button>
        </div>

        {/* Totaux calculés sur ce qui a été reçu — aucun chiffre n'est demandé au serveur */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            // Aucun chiffre avant la réponse : un 0 affiché pendant le chargement se lit comme un résultat.
            { cle: 'encaisse', icone: 'payments', titre: tx('Encaissé (réussi)'), valeur: loading ? VIDE : fmtFcfa(totaux.encaisse), note: loading ? VIDE : `${compteDe('reussi')} · ${tx('statut reussi')}` },
            { cle: 'attente', icone: 'hourglass_top', titre: tx('En attente'), valeur: loading ? VIDE : fmtFcfa(totaux.enAttenteMontant), note: loading ? VIDE : `${compteDe('en_attente')} · ${tx('statut en_attente')}` },
            { cle: 'volume', icone: 'receipt_long', titre: tx('Paiements reçus'), valeur: loading ? VIDE : String(rows.length), note: tx('aucun filtre envoyé au serveur') },
          ].map((c, i) => (
            <div
              key={c.cle}
              className="tokpa-rise rounded-xl border border-border-default bg-bg-card p-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-2 text-label font-semibold uppercase tracking-wider text-text-secondary">
                <FaIcon name={c.icone} className="text-primary" />
                {c.titre}
              </div>
              <p className="mt-2 text-h3 font-bold text-on-surface">{c.valeur}</p>
              <p className="mt-1 text-xs text-text-secondary">{c.note}</p>
            </div>
          ))}
        </div>

        {err && (
          <div className="tokpa-rise flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <FaIcon name="cloud_off" className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltre('')}
            className={
              filtre === ''
                ? 'rounded-lg border border-primary/30 bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-xs'
                : 'rounded-lg border border-transparent px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-white/80 hover:text-gray-900'
            }
          >
            {tx('Tous')} · {rows.length}
          </button>
          {STATUTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltre(filtre === s ? '' : s)}
              className={
                filtre === s
                  ? 'rounded-lg border border-primary/30 bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-xs'
                  : 'rounded-lg border border-transparent px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-white/80 hover:text-gray-900'
              }
            >
              {tx(STATUT_UI[s].libelle)} · {compteDe(s)}
            </button>
          ))}
          <span className="ml-auto text-xs text-text-secondary">{tx('Filtrage local : la route ignore tout paramètre')}</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border-default bg-white">
          <table className="w-full text-left text-label">
            <thead>
              <tr className="bg-bg-secondary text-text-secondary">
                <th className="p-3">{tx('Référence')}</th>
                <th className="p-3">{tx('Commande')}</th>
                <th className="p-3">client_id</th>
                <th className="p-3">{tx('Montant')}</th>
                <th className="p-3">{tx('Méthode')}</th>
                <th className="p-3">{tx('Statut')}</th>
                <th className="p-3">{tx('Payé le')}</th>
                <th className="p-3">FedaPay</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((p, i) => {
                const s = statutDe(p);
                const habillage = STATUT_UI[s] ?? { badge: 'bg-gray-100 text-gray-700 border border-gray-200', icon: 'help', libelle: s || '—' };
                return (
                  <tr key={String(p.id)} className="tokpa-rise border-t border-border-default" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                    <td className="p-3 font-bold">#{p.id}</td>
                    <td className="p-3">
                      {p.order_id != null ? (
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">#{p.order_id}</span>
                          {p.order?.statut && <span className="text-xs text-text-secondary">{p.order.statut}</span>}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-text-secondary">{p.client_id != null ? `#${p.client_id}` : '—'}</td>
                    <td className="p-3 font-bold">{fmtFcfa(p.montant)}</td>
                    <td className="p-3">{p.methode || '—'}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${habillage.badge}`}>
                        <FaIcon name={habillage.icon} className="text-[12px]" />
                        {tx(habillage.libelle)}
                      </span>
                    </td>
                    <td className="p-3">
                      {p.paid_at ? dateShort(p.paid_at) : <span className="text-text-secondary">{tx('jamais payé')}</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {p.fedapay_ref ? (
                        <span className="font-mono text-[11px] text-on-surface-variant">{p.fedapay_ref}</span>
                      ) : (
                        <span className="text-text-secondary">{estPurge(null)}</span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {p.recu_url && (
                        <a
                          href={p.recu_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mr-3 inline-flex items-center gap-1 text-primary font-bold hover:underline"
                        >
                          <FaIcon name="open_in_new" className="text-[13px]" />
                          {tx('Reçu')}
                        </a>
                      )}
                      <button type="button" className="text-primary font-bold hover:underline" onClick={() => setSelected(p)}>
                        {tx('Détail')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-sm text-text-secondary">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <FaIcon name="sync" className="animate-spin text-primary" />
                        {tx('Chargement des paiements réels…')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <FaIcon name="receipt_long" />
                        {rows.length === 0
                          ? tx('Aucun paiement reçu de GET /admin/payments.')
                          : tx('Aucun paiement avec ce statut dans la liste reçue.')}
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-text-secondary">
          {tx(
            'client_id reste un identifiant nu : listAllPayments ne charge que la commande, jamais le client. Le champ fedapay_token, renvoyé lui aussi, est écarté de tout affichage.',
          )}
        </p>

        {selected && (
          <div className="tokpa-rise rounded-lg border border-border-default bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">
                  {tr(`Paiement #${selected.id}`, `Payment #${selected.id}`)}
                  {selected.order_id != null && (
                    <span className="ml-2 text-sm font-normal text-text-secondary">
                      {tr(`commande #${selected.order_id}`, `order #${selected.order_id}`)}
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-xs text-text-secondary">{tx('Réponse du serveur, jeton FedaPay retiré par le front')}</p>
              </div>
              <button type="button" className="text-sm text-text-secondary hover:text-on-surface" onClick={() => setSelected(null)}>
                <FaIcon name="close" className="mr-1 text-sm" />
                {tx('Fermer')}
              </button>
            </div>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-bg-secondary p-3 text-xs">
              {JSON.stringify(sansJeton(selected), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
