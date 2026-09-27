import { useEffect, useMemo, useState } from 'react';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import MIcon from '../../components/shared/MIcon';
import { managerApi } from '../../services/api';
import { unwrap, listOf, fmtFcfa, heureCourte } from '../../services/api/unwrap';
import { extractApiError, formatApiError } from '../../utils/apiError';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

const ONGLETS = [
  { label: 'Toutes', statut: null },
  { label: 'En attente', statut: 'en_attente' },
  { label: 'En préparation', statut: 'en_préparation' },
  { label: 'En livraison', statut: 'en_livraison' },
  { label: 'Livrées', statut: 'livrée' },
  { label: 'Annulées', statut: 'annulée' },
];

const STATUT_CLASS: Record<string, string> = {
  'en attente': 'bg-bg-secondary text-text-secondary',
  'en_attente': 'bg-bg-secondary text-text-secondary',
  'en préparation': 'bg-primary-tint text-primary',
  'en_préparation': 'bg-primary-tint text-primary',
  'en livraison': 'bg-tertiary-container/20 text-tertiary',
  'en_livraison': 'bg-tertiary-container/20 text-tertiary',
  'livrée': 'bg-success-container text-on-surface',
  'livree': 'bg-success-container text-on-surface',
  'annulée': 'bg-error-container text-on-error-container',
  'annulee': 'bg-error-container text-on-error-container',
};

export default function ManagerOrdersPage() {
  useLanguage();
  const [onglet, setOnglet] = useState<string | null>(null);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [livreurs, setLivreurs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<any | null>(null);
  const [assignation, setAssignation] = useState<any | null>(null);
  const [livreurChoisi, setLivreurChoisi] = useState<string>('');

  const charger = (statut: string | null) => {
    setLoading(true);
    setErr(null);
    managerApi
      .getOrders(statut ? { statut } : { page: 1 })
      .then((r) => setCommandes(listOf(unwrap(r))))
      .catch((e) => setErr(formatApiError(extractApiError(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    charger(onglet);
    managerApi
      .getLivreurs()
      .then((r) => setLivreurs(listOf(unwrap(r))))
      .catch(() => setLivreurs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet]);

  const confirmerAssignation = async () => {
    if (!assignation || !livreurChoisi) return;
    setErr(null);
    setInfo(null);
    try {
      await managerApi.assignLivreur(assignation.id, Number(livreurChoisi));
      setInfo(`Commande #${assignation.id} assignée avec succès.`);
      setAssignation(null);
      setLivreurChoisi('');
      charger(onglet);
    } catch (e) {
      setErr(formatApiError(extractApiError(e)));
    }
  };

  const lignes = useMemo(() => commandes, [commandes]);

  return (
    <ManagerLayout currentPath="/manager/commandes">
      <div className="space-y-6">
        <div>
          <p className="text-overline uppercase text-primary">{tx("Supervision Opérationnelle")}</p>
          <p className="text-text-secondary">{tx("Données réelles — GET /manager/orders")}</p>
          <h1 className="mt-2 text-h2 font-h2 font-bold">{tx("Supervision & Gestion des Commandes")}</h1>
        </div>

        {err && (
          <div className="rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
            <p className="font-bold">{tx("Erreur API")}</p>
            <p>{err}</p>
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-success bg-success-container p-4 text-label">
            {info}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {ONGLETS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setOnglet(o.statut)}
              className={`rounded-full border px-3 py-1.5 text-label font-semibold transition ${
                onglet === o.statut
                  ? 'border-primary bg-primary text-white'
                  : 'border-border-default bg-white text-text-secondary hover:border-primary hover:text-primary'
              }`}
            >
{tx(o.label)}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-border-default bg-white shadow-sm">
          <div className="border-b border-border-default px-lg py-4">
            <h2 className="text-h3 font-h3 font-bold">{tx("Liste des Commandes de la Zone")}</h2>
            <p className="text-label text-text-secondary">{tx("Cliquez sur une ligne pour afficher les détails complets")}</p>
          </div>
          {loading && <p className="p-lg text-label text-text-secondary">{tx("Chargement…")}</p>}
          {!loading && lignes.length === 0 && (
            <p className="p-lg text-label text-text-secondary">{tx("Aucune commande pour ce filtre.")}</p>
          )}
          {!loading && lignes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-label">
                <thead>
                  <tr className="bg-bg-secondary text-left text-text-secondary">
                    <th className="px-4 py-3 font-semibold">{tx("Commande")}</th>
                    <th className="px-4 py-3 font-semibold">{tx("Client & Téléphone")}</th>
                    <th className="px-4 py-3 font-semibold">{tx("Articles")}</th>
                    <th className="px-4 py-3 font-semibold">{tx("Livreur Assigné")}</th>
                    <th className="px-4 py-3 font-semibold">{tx("Point de Repère")}</th>
                    <th className="px-4 py-3 font-semibold">{tx("Montant")}</th>
                    <th className="px-4 py-3 font-semibold">{tx("Statut")}</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((o: any) => {
                    const livreur = o.livreur ?? null;
                    const client = o.user ?? o.client ?? null;
                    const statut = String(o.statut ?? '');
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelection(o)}
                        className="cursor-pointer border-t border-border-default hover:bg-primary-tint/50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold">#{o.id}</p>
                          <p className="text-text-secondary">{heureCourte(o.created_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{client?.nom_complet ?? '—'}</p>
                          <p className="text-text-secondary">{client?.telephone ?? ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          {Array.isArray(o.items) ? `${o.items.length} article(s)` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {livreur ? (
                            <p className="font-semibold">{livreur.nom_complet ?? `Livreur #${livreur.id}`}</p>
                          ) : (
                            <span className="text-text-tertiary">{tx("— Non affecté —")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{o.description_lieu ?? o.landmark?.nom ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold">{fmtFcfa(o.montant_total)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-overline font-semibold ${
                              STATUT_CLASS[statut.toLowerCase()] ?? 'bg-bg-secondary text-text-secondary'
                            }`}
                          >
                            {statut}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!livreur && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignation(o);
                                setLivreurChoisi('');
                              }}
                              className="btn btn-primary px-3 py-1.5 text-label"
                            >
                              {tx("Assigner")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modale détails */}
      {selection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelection(null)}>
          <div
            className="w-full max-w-[600px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-default p-4">
              <h3 className="text-h3 font-h3 font-bold">Commande #{selection.id}</h3>
              <button type="button" onClick={() => setSelection(null)} className="p-1 text-text-secondary hover:text-on-surface">
                <MIcon name="close" className="text-[20px]" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-label">
              <p className="text-text-secondary">{dateHeure(selection.created_at)} · {selection.statut}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-text-secondary">{tx("Client")}</p>
                  <p className="font-semibold">
                    {(selection.user ?? selection.client)?.nom_complet ?? '—'} — {(selection.user ?? selection.client)?.telephone ?? ''}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary">{tx("Livreur assigné")}</p>
                  <p className="font-semibold">{selection.livreur?.nom_complet ?? tx("— Non affecté —")}</p>
                </div>
                <div>
                  <p className="text-text-secondary">{tx("Point de repère")}</p>
                  <p className="font-semibold">{selection.description_lieu ?? selection.landmark?.nom ?? '—'}</p>
                </div>
                <div>
                  <p className="text-text-secondary">{tx("Montant")}</p>
                  <p className="font-semibold">{fmtFcfa(selection.montant_total)}</p>
                </div>
              </div>
              {Array.isArray(selection.items) && selection.items.length > 0 && (
                <div>
                  <p className="text-text-secondary">{tx("Articles")}</p>
                  <ul className="mt-1 space-y-1">
                    {selection.items.map((it: any) => (
                      <li key={it.id} className="flex justify-between rounded-lg bg-bg-app px-3 py-2">
                        <span>
                          {it.nom ?? `Produit #${it.product_id}`} × {it.quantite}
                        </span>
                        <span className="font-semibold">{fmtFcfa(it.prix_unitaire)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border-default p-4">
              <button type="button" className="btn btn-ghost" onClick={() => setSelection(null)}>
                {tx("Fermer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale assignation */}
      {assignation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAssignation(null)}>
          <div
            className="w-full max-w-[600px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-default p-4">
              <h3 className="text-h3 font-h3 font-bold">Assigner un livreur — #{assignation.id}</h3>
              <button type="button" onClick={() => setAssignation(null)} className="p-1 text-text-secondary hover:text-on-surface">
                <MIcon name="close" className="text-[20px]" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-label">
              {livreurs.length === 0 && <p className="text-text-secondary">{tx("Aucun livreur disponible dans la zone.")}</p>}
              {livreurs.map((l: any) => (
                <label
                  key={l.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                    String(l.id) === livreurChoisi ? 'border-primary bg-primary-tint/50' : 'border-border-default'
                  }`}
                >
                  <input
                    type="radio"
                    name="livreur"
                    value={String(l.id)}
                    checked={String(l.id) === livreurChoisi}
                    onChange={() => setLivreurChoisi(String(l.id))}
                    className="accent-primary"
                  />
                  <span className="flex-1 font-semibold">{l.nom_complet ?? `${l.prenom ?? ''} ${l.nom ?? ''}`}</span>
                  <span className="text-text-secondary">{l.statut ?? ''} {l.telephone ?? ''}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-border-default p-4">
              <button type="button" className="btn btn-ghost" onClick={() => setAssignation(null)}>
                {tx("Annuler")}
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmerAssignation} disabled={!livreurChoisi}>
                {tx("Assigner")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

function dateHeure(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
