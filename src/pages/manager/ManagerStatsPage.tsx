import { useEffect, useState } from 'react';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import MIcon from '../../components/shared/MIcon';
import { managerApi } from '../../services/api';
import { unwrap, fmtFcfa } from '../../services/api/unwrap';
import { extractApiError, formatApiError } from '../../utils/apiError';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

const PERIODES = [
  { label: 'Aujourd’hui', param: 'jour' as const },
  { label: 'Cette semaine', param: 'semaine' as const },
  { label: 'Ce Mois', param: 'mois' as const },
];

export default function ManagerStatsPage() {
  useLanguage();
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    managerApi
      .getStats(periode)
      .then((r) => alive && setStats(unwrap(r)))
      .catch((e) => alive && setErr(formatApiError(extractApiError(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [periode]);

  const kpis = [
    { icon: 'trending_up', label: "Volume d'Affaires", value: stats?.ca ?? '—' },
    { icon: 'shopping_basket', label: tx("Commandes Total"), value: stats?.commandes ?? '—' },
    { icon: 'task_alt', label: 'Taux de Livraison', value: stats && Number(stats.commandes) > 0 ? `${((Number(stats.livrees ?? 0) / Number(stats.commandes)) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : '—' },
    { icon: 'delivery_dining', label: tx("Commandes livrées"), value: stats?.livrees ?? '—' },
  ];

  return (
    <ManagerLayout currentPath="/manager/statistiques">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-h2 font-h2 font-bold">{tx("Statistiques de la Zone - Akpakpa")}</h1>
            <p className="text-text-secondary">{tx("Données réelles — GET /manager/stats")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODES.map((p) => (
              <button
                key={p.param}
                type="button"
                onClick={() => setPeriode(p.param)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-label font-semibold transition ${
                  periode === p.param
                    ? 'border-primary bg-primary text-white'
                    : 'border-border-default bg-white text-text-secondary hover:border-primary hover:text-primary'
                }`}
              >
                {p.param === 'jour' && <MIcon name="calendar_today" className="text-[16px]" />}
                {tx(p.label)}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div className="rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
            <p className="font-bold">{tx("Erreur API")}</p>
            <p>{err}</p>
          </div>
        )}
        {loading && <p className="text-label text-text-secondary">{tx("Chargement…")}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
              <div className="flex items-center gap-2">
                <MIcon name={k.icon} className="text-primary text-[20px]" />
                <p className="text-label text-text-secondary">{tx(k.label)}</p>
              </div>
              <p className="mt-2 text-h1 font-h1 font-bold">
                {typeof k.value === 'number' ? fmtFcfa(k.value) : k.value}
              </p>
            </div>
          ))}
        </div>

        {/* Phase dev : forme brute de la réponse pour caler le mapping */}
        {stats != null && (
          <div className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
            <h2 className="text-h3 font-h3 font-bold">{tx("Réponse brute (phase dev)")}</h2>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-bg-app p-3 text-micro">{JSON.stringify(stats, null, 2)}</pre>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
