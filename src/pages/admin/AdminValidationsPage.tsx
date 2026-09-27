import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import { fmtFcfa, dateCourte, listOf, unwrap } from '../../services/api/unwrap';
import { alertApiError } from '../../utils/apiError';
import { absImageUrl } from '../../utils/imageUrl';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import MIcon from '../../components/shared/MIcon';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

const DESIGN_CSS = `
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .sidebar-active {
            background-color: #1F2937;
            color: #FFFFFF;
            border-left: 3px solid #F97316;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #F3F4F6;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #D1D5DB;
            border-radius: 10px;
        }
    `;

type Filtre = 'all' | 'en_attente' | 'accepte' | 'refuse';
const PER_PAGE = 10;
const MAX_PAGES = 25;
const TAB_ACTIVE = 'px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-white shadow-sm shadow-primary/20';
const TAB_IDLE = 'px-4 py-1.5 rounded-full text-sm font-medium bg-white text-text-secondary border border-gray-200 hover:bg-gray-50 transition-colors';
const STATUT: Record<string, { label: string; cls: string }> = {
  en_attente: { label: 'En attente', cls: 'text-primary' },
  accepte: { label: 'Acceptée', cls: 'text-success' },
  refuse: { label: 'Refusée', cls: 'text-error' },
  expire: { label: 'Expirée', cls: 'text-text-secondary' },
};
const nomClient = (pr: any) => pr?.client?.nom_complet || [pr?.client?.prenom, pr?.client?.nom].filter(Boolean).join(' ') || `Client #${pr?.client_id ?? '?'}`;
const heure = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
const ecart = (pr: any) => {
  const prix = Number(pr?.product?.prix);
  const propose = Number(pr?.prix_propose);
  return prix > 0 && Number.isFinite(propose) ? Math.round(((propose - prix) / prix) * 100) : null;
};

/**
 * AdminValidationsPage — design Stitch (code.html) conservé, données RÉELLES :
 * GET /admin/budget-proposals (toutes les pages, au plus 500) → compteur, onglets, tableau, écart,
 * pagination, panneau (produit, catégorie, chronologie, historique du client calculé sur ses
 * propositions) ; PATCH /admin/budget-proposals/{id} → accepter / refuser (+ message au client).
 * « Contre-proposer » laissé tel quel (décision utilisateur P3 : aucune contre-offre côté backend).
 */
export default function AdminValidationsPage() {
  useLanguage();
  const [proposals, setProposals] = useState<any[]>([]);
  const [cats, setCats] = useState<Map<number, string>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    (async () => {
      const acc: any[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res: any = await adminApi.getProposals({ page });
        acc.push(...listOf(res));
        if (page >= Number(res?.last_page ?? res?.meta?.last_page ?? 1)) break;
      }
      return acc;
    })()
      .then((acc) => alive && setProposals(acc))
      .catch((e) => alive && setErr(alertApiError(e, 'admin-validations')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    adminApi
      .getCategories()
      .then((r: any) => {
        const m = new Map<number, string>();
        const walk = (c: any) => {
          m.set(Number(c.id), String(c.nom));
          (c.children ?? []).forEach(walk);
        };
        listOf(unwrap(r)).forEach(walk);
        setCats(m);
      })
      .catch(() => setCats(new Map()));
  }, []);

  const [filtre, setFiltre] = useState<Filtre>('all');
  const [page, setPage] = useState(1);
  const enAttente = proposals.filter((p) => p.statut === "en_attente");
  const filtered = filtre === 'all' ? proposals : proposals.filter((p) => p.statut === filtre);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = proposals.find((p) => p.id === selectedId) ?? enAttente[0] ?? proposals[0] ?? null;
  // Historique du client : calculé sur ses propositions (aucune fidélité ni statistique client dans l'API)
  const histo = useMemo(() => {
    if (!selected) return null;
    const siennes = proposals.filter((p) => p.client_id === selected.client_id);
    const decidees = siennes.filter((p) => p.statut === 'accepte' || p.statut === 'refuse');
    const acceptees = siennes.filter((p) => p.statut === 'accepte').length;
    return { total: siennes.length, taux: decidees.length ? Math.round((acceptees / decidees.length) * 100) : null };
  }, [proposals, selected]);

  const [busy, setBusy] = useState(false);
  const decider = async (pr: any, decision: 'accepte' | 'refuse', admin_response?: string) => {
    setBusy(true);
    try {
      await adminApi.respondProposal(pr.id, { decision, ...(admin_response ? { admin_response } : {}) });
      toast.success(decision === 'accepte' ? tx("Proposition acceptée.") : tx("Proposition refusée."));
      reload();
    } catch (e) {
      alertApiError(e, 'admin-validations-respond');
    } finally {
      setBusy(false);
    }
  };
  const refuserEtNotifier = (pr: any) => {
    const message = window.prompt(tx("Message envoyé au client (motif du refus) :"), tx("Votre proposition est trop éloignée du prix minimum."));
    if (message === null) return;
    void decider(pr, 'refuse', message.trim() || undefined);
  };

  const selEnAttente = selected?.statut === "en_attente";
  const selImage = absImageUrl(selected?.product?.image_url);
  const selCat = cats.get(Number(selected?.product?.categorie_id));

  return (
    <AdminLayout currentPath="/admin/validations">
      {err && (
        <div className="m-lg rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Erreur API")}</p>
          <p>{err}</p>
        </div>
      )}
      {loading && <p className="m-lg text-label text-text-secondary">{tx("Chargement des données réelles…")}</p>}
      <style>{DESIGN_CSS}</style>
      <header className="px-8 pt-8 pb-4 flex flex-col gap-4 bg-bg-app">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{tx("Validation des budgets")}</h1>
          <p className="text-text-secondary text-sm">
            {enAttente.length} proposition{enAttente.length > 1 ? 's' : ''} en attente de décision sur le marché TOKPa
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ['all', 'Toutes'],
              ["en_attente", 'En attente'],
              ['accepte', tx("Acceptées")],
              ['refuse', tx("Refusées")],
            ] as [Filtre, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filtre === id ? TAB_ACTIVE : TAB_IDLE}
              onClick={() => {
                setFiltre(id);
                setPage(1);
              }}
            >
              {tx(label)}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden px-8 pb-8 gap-6">
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{tx("Client")}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{tx("Produit")}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix vendeur</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{tx("Prix proposé")}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{tx("Écart")}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-lg py-6 text-center text-label text-text-secondary">
                      {tx("Aucune proposition dans cette catégorie.")}
                    </td>
                  </tr>
                )}
                {visible.map((pr: any) => {
                  const e = ecart(pr);
                  return (
                    <tr
                      key={pr.id}
                      className={`border-t border-border-default text-label cursor-pointer hover:bg-gray-50 ${selected?.id === pr.id ? 'bg-primary-tint' : ''}`}
                      onClick={() => setSelectedId(pr.id)}
                    >
                      <td className="px-lg py-3">{nomClient(pr)}</td>
                      <td className="px-lg py-3">
                        {pr.product?.nom ?? '—'}
                        {Number(pr.quantite) > 1 ? ` ×${pr.quantite}` : ''}
                      </td>
                      <td className="px-lg py-3">{fmtFcfa(pr.product?.prix)}</td>
                      <td className="px-lg py-3 font-semibold">{fmtFcfa(pr.prix_propose)}</td>
                      <td className={`px-lg py-3 ${e != null && e < 0 ? 'text-error' : ''}`}>{e != null ? `${e > 0 ? '+' : ''}${e} %` : '—'}</td>
                      <td className="px-lg py-3">{dateCourte(pr.created_at)}</td>
                      <td className="px-lg py-3" onClick={(ev) => ev.stopPropagation()}>
                        {pr.statut === "en_attente" ? (
                          <div className="flex gap-2">
                            <button type="button" disabled={busy} className="font-semibold text-success hover:underline disabled:opacity-50" onClick={() => decider(pr, 'accepte')}>
                              {tx("Accepter")}
                            </button>
                            <button type="button" disabled={busy} className="font-semibold text-error hover:underline disabled:opacity-50" onClick={() => decider(pr, 'refuse')}>
                              {tx("Refuser")}
                            </button>
                          </div>
                        ) : (
                          <span className={`font-semibold ${STATUT[pr.statut]?.cls ?? ''}`}>{tx(STATUT[pr.statut]?.label ?? pr.statut)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
            <span className="text-xs text-text-secondary">
              {filtered.length === 0
                ? tx("Aucune proposition")
                : `Affichage de ${(current - 1) * PER_PAGE + 1} à ${Math.min(current * PER_PAGE, filtered.length)} sur ${filtered.length} propositions`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                className="p-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <MIcon name="chevron_left" className="text-[18px]" />
              </button>
              <button
                type="button"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
                className="p-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <MIcon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          </div>
        </div>
        {selected && (
          <aside className="w-[320px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-text-main">{tx("Détail de la proposition")}</h2>
              <div className="rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 flex items-center justify-center">
                {selImage ? <img className="h-full w-full object-cover" src={selImage} alt={selected.product?.nom ?? 'Produit'} /> : <MIcon name="image" className="text-4xl text-gray-300" />}
              </div>
              <div>
                <h3 className="text-base font-bold">{selected.product?.nom ?? '—'}</h3>
                <p className="text-xs text-text-secondary uppercase font-medium tracking-wider mt-0.5">Catégorie : {selCat ?? '—'}</p>
              </div>
              <div className="h-px bg-gray-100 w-full"></div>
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase mb-3 tracking-widest">{tx("Négociation")}</h4>
                <div className="space-y-4">
                  <div className="flex gap-3 relative">
                    <div className="absolute left-1.5 top-5 bottom-0 w-0.5 bg-gray-100"></div>
                    <div className="h-3 w-3 rounded-full bg-success ring-4 ring-success-light z-10 mt-1"></div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">
                        {nomClient(selected)} a proposé {fmtFcfa(selected.prix_propose)}
                        {Number(selected.quantite) > 1 ? ` (×${selected.quantite})` : ''}
                      </span>
                      <span className="text-[10px] text-text-secondary">{dateCourte(selected.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 relative">
                    <div className="absolute left-1.5 top-5 bottom-0 w-0.5 bg-gray-100"></div>
                    <div className="h-3 w-3 rounded-full bg-gray-300 z-10 mt-1"></div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{tx("Prix vendeur :")} {fmtFcfa(selected.product?.prix)}</span>
                      <span className="text-[10px] text-text-secondary">{tx("Prix minimum :")} {fmtFcfa(selected.product?.prix_minimum)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary-tint z-10 mt-1"></div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${selEnAttente ? 'text-primary' : (STATUT[selected.statut]?.cls ?? '')}`}>
                        {selEnAttente ? tx("En attente de validation admin") : tx(STATUT[selected.statut]?.label ?? selected.statut)}
                      </span>
                      <span className="text-[10px] text-text-secondary">
                        {selEnAttente ? tx("maintenant") : [selected.admin_response, selected.responded_at ? heure(selected.responded_at) : null].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest">{tx("Historique client")}</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-2.5 flex flex-col">
                  <span className="text-xl font-bold">{histo?.total ?? '—'}</span>
                  <span className="text-[10px] text-text-secondary">propositions faites</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 flex flex-col">
                  <span className="text-xl font-bold text-success-dark">{histo?.taux != null ? `${histo.taux}%` : '—'}</span>
                  <span className="text-[10px] text-text-secondary">taux d'acceptation</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              <button
                type="button"
                disabled={!selEnAttente || busy}
                onClick={() => decider(selected, 'accepte')}
                className="w-full py-3 bg-success hover:bg-success-dark text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-success/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MIcon name="check_circle" className="text-[18px]" />
                Accepter ce prix
              </button>
              <button className="w-full py-3 bg-white border-2 border-primary text-primary hover:bg-primary-tint rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                <MIcon name="edit" className="text-[18px]" />
                Contre-proposer
              </button>
              <button
                type="button"
                disabled={!selEnAttente || busy}
                onClick={() => refuserEtNotifier(selected)}
                className="w-full py-3 bg-error-light text-error-dark border border-error-dark/20 hover:bg-error-dark hover:text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MIcon name="cancel" className="text-[18px]" />
                Refuser et notifier
              </button>
            </div>
          </aside>
        )}
      </div>
    </AdminLayout>
  );
}
