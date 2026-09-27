import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import MIcon from '../../components/shared/MIcon';
import { managerApi } from '../../services/api';
import { unwrap, listOf, fmtFcfa, heureCourte } from '../../services/api/unwrap';
import { extractApiError, formatApiError } from '../../utils/apiError';
import { currentUserZone } from '../../routes/authGuard';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUT_CLASS: Record<string, string> = {
  'en préparation': 'bg-primary-tint text-primary',
  'en preparation': 'bg-primary-tint text-primary',
  'en livraison': 'bg-tertiary-container/20 text-tertiary',
  'en attente': 'bg-bg-secondary text-text-secondary',
  'en_cours': 'bg-tertiary-container/20 text-tertiary',
  'livrée': 'bg-success-container text-on-surface',
  'livree': 'bg-success-container text-on-surface',
};

function statutClass(s: string) {
  return STATUT_CLASS[(s ?? '').toLowerCase()] ?? 'bg-bg-secondary text-text-secondary';
}

export default function ManagerDashboardPage() {
  useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([managerApi.getStats('jour'), managerApi.getOrders({ page: 1 })])
      .then(([s, o]) => {
        if (!alive) return;
        setStats(unwrap(s));
        setCommandes(listOf(unwrap(o)));
      })
      .catch((e) => {
        if (!alive) return;
        setErr(formatApiError(extractApiError(e)));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const kpis = [
    {
      icon: 'shopping_cart',
      label: "Commandes aujourd'hui",
      value: stats?.commandes ?? '—',
      sub: stats?.variation_commandes ?? '',
    },
    {
      icon: 'payments',
      label: "Chiffre d'affaires",
      value: stats?.ca ?? '—',
      unit: 'FCFA',
      sub: '',
    },
    {
      icon: 'two_wheeler',
      label: tx("Livreurs actifs"),
      value: stats?.livreurs_actifs ?? '—',
      sub: stats?.livreurs_total != null ? `sur ${stats.livreurs_total} livreurs` : '',
    },
    {
      icon: 'task_alt',
      label: tx("Taux de succès livraison"),
      value: stats && Number(stats.commandes) > 0 ? `${((Number(stats.livrees ?? 0) / Number(stats.commandes)) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : '—',
      sub: '',
    },
  ];

  return (
    <ManagerLayout currentPath="/manager">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-h2 font-h2 font-bold">Tableau de bord — Zone {currentUserZone() ?? '—'}</h1>
            <p className="text-text-secondary">{tx("Données réelles — GET /manager/stats + /manager/orders")}</p>
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
                <p className="text-label text-text-secondary">{k.label}</p>
              </div>
              <p className="mt-2 text-h1 font-h1 font-bold">
                {typeof k.value === 'number' ? k.value.toLocaleString('fr-FR') : k.value}{' '}
                {k.unit && <span className="text-label text-text-secondary">{k.unit}</span>}
              </p>
              {k.sub && <p className="mt-1 text-label text-text-secondary">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-border-default bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border-default px-lg py-4">
            <h2 className="text-h3 font-h3 font-bold">{tx("Commandes Actives")}</h2>
            <Link to="/manager/commandes" className="text-label font-semibold text-primary hover:underline">
              {tx("Voir tout")}
            </Link>
          </div>
          {commandes.length === 0 && !loading && (
            <p className="p-lg text-label text-text-secondary">{tx("Aucune commande.")}</p>
          )}
          {commandes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-label">
                <thead>
                  <tr className="bg-bg-secondary text-left text-text-secondary">
                    <th className="px-lg py-3 font-semibold">{tx("# Commande")}</th>
                    <th className="px-lg py-3 font-semibold">{tx("Client")}</th>
                    <th className="px-lg py-3 font-semibold">{tx("Statut")}</th>
                    <th className="px-lg py-3 font-semibold">{tx("Montant")}</th>
                  </tr>
                </thead>
                <tbody>
                  {commandes.slice(0, 6).map((o: any) => (
                    <tr key={o.id} className="border-t border-border-default">
                      <td className="px-lg py-3 font-semibold">
                        #{o.id}{' '}
                        <span className="text-text-secondary">
                          {heureCourte(o.created_at)} · {Array.isArray(o.items) ? `${o.items.length} article(s)` : ''}
                        </span>
                      </td>
                      <td className="px-lg py-3">{o.user?.nom_complet ?? o.client?.nom_complet ?? '—'}</td>
                      <td className="px-lg py-3">
                        <span className={`rounded-full px-2.5 py-1 text-overline font-semibold ${statutClass(o.statut)}`}>
                          {o.statut}
                        </span>
                      </td>
                      <td className="px-lg py-3 font-semibold">{fmtFcfa(o.montant_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}
