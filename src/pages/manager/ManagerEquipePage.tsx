import { useEffect, useMemo, useState } from 'react';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import MIcon from '../../components/shared/MIcon';
import { managerApi } from '../../services/api';
import { unwrap, listOf } from '../../services/api/unwrap';
import { extractApiError, formatApiError } from '../../utils/apiError';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUSES = ['Tous les statuts', 'en ligne', 'en course', 'hors ligne'];

export default function ManagerEquipePage() {
  useLanguage();
  const [livreurs, setLivreurs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statut, setStatut] = useState(STATUSES[0]);
  const [ajout, setAjout] = useState(false);

  useEffect(() => {
    let alive = true;
    managerApi
      .getLivreurs()
      .then((r) => alive && setLivreurs(listOf(unwrap(r))))
      .catch((e) => alive && setErr(formatApiError(extractApiError(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const livs = useMemo(
    () => livreurs.filter((l) => statut === STATUSES[0] || String(l.statut ?? '').toLowerCase() === statut),
    [livreurs, statut],
  );

  const actifs = livreurs.filter((l) => String(l.statut ?? '').toLowerCase() !== "hors ligne").length;

  return (
    <ManagerLayout currentPath="/manager/equipe">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-h2 font-h2 font-bold">{tx("Mon équipe — Zone Akpakpa")}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-label">
              <span className="rounded-full bg-bg-secondary px-2.5 py-1 font-semibold">{livreurs.length} {tx("livreurs")}</span>
              <span className="rounded-full bg-success-container px-2.5 py-1 font-semibold">{actifs} {tx("actifs")}</span>
              <span className="rounded-full bg-bg-secondary px-2.5 py-1 font-semibold">
                {livreurs.length - actifs} {tx("hors ligne")}
              </span>
            </div>
          </div>
          <button type="button" className="btn btn-primary gap-2" onClick={() => setAjout(true)}>
            <MIcon name="person_add" className="text-[18px]" />
            {tx("Ajouter un livreur")}
          </button>
        </div>

        {err && (
          <div className="rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
            <p className="font-bold">{tx("Erreur API")}</p>
            <p>{err}</p>
          </div>
        )}
        {loading && <p className="text-label text-text-secondary">{tx("Chargement…")}</p>}

        <div className="flex flex-wrap gap-2">
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            className="rounded-lg border border-border-default bg-white px-3 py-2 text-label"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{tx(s)}</option>
            ))}
          </select>
        </div>

        {!loading && livs.length === 0 && (
          <p className="text-label text-text-secondary">{tx("Aucun livreur dans la zone.")}</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {livs.map((l: any) => {
            const nom = l.nom_complet ?? `${l.prenom ?? ''} ${l.nom ?? ''}`.trim() ?? `Livreur #${l.id}`;
            const init = nom
              .split(' ')
              .map((p: string) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const st = String(l.statut ?? "hors ligne").toLowerCase();
            return (
              <div key={l.id} className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-h3 font-bold text-primary">
                    {init}
                  </span>
                  <div className="flex-1">
                    <p className="text-h3 font-h3 font-bold">{nom}</p>
                    <p className="text-label text-text-secondary">{l.email ?? l.telephone ?? ''}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-overline font-semibold ${
                      st === "en ligne"
                        ? 'bg-success-container text-on-surface'
                        : st === "en course"
                          ? 'bg-tertiary-container/20 text-tertiary'
                          : 'bg-bg-secondary text-text-secondary'
                    }`}
                  >
                    {tx(st)}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-label">
                  <div>
                    <p className="text-text-secondary">{tx("Statut compte")}</p>
                    <p className="font-semibold">{l.statut ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-text-secondary">{tx("Téléphone")}</p>
                    <p className="font-semibold">{l.telephone ?? '—'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border-default pt-3">
                  {l.telephone && (
                    <a
                      href={`tel:${String(l.telephone).replace(/\s/g, '')}`}
                      className="flex-1 rounded-lg bg-primary-tint px-3 py-2 text-center text-label font-semibold text-primary"
                    >
                      {tx("Appeler")}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ajout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAjout(false)}>
          <div
            className="w-full max-w-[600px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-default p-4">
              <h3 className="text-h3 font-h3 font-bold">{tx("Nouveau Livreur")}</h3>
              <button type="button" onClick={() => setAjout(false)} className="p-1 text-text-secondary hover:text-on-surface">
                <MIcon name="close" className="text-[20px]" />
              </button>
            </div>
            <div className="flex-1 p-4 text-label">
              <p className="text-text-secondary">
                {tx("L’ajout de livreurs par le manager nécessite l’endpoint")}{' '}
                <span className="font-mono">POST /manager/livreurs</span> {tx("— absent du backend actuel (B-16).")}
                {tx("En attendant, un admin peut créer le compte via")} <span className="font-mono">POST /admin/users</span>.
              </p>
            </div>
            <div className="flex justify-end border-t border-border-default p-4">
              <button type="button" className="btn btn-ghost" onClick={() => setAjout(false)}>
                {tx("Fermer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
