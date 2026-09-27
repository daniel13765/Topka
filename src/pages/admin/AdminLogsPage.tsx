import { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import { listOf } from '../../services/api/unwrap';
import { initials } from '../../services/api/useLiveRows';
import { acteur, categorie, detail, quand, titre } from '../../utils/auditLog';
import { alertApiError } from '../../utils/apiError';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

const DESIGN_CSS = `
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .timeline-line { width: 2px; background-color: #E5E7EB; left: 16px; top: 0; bottom: 0; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
    `;

/** Couleurs des catégories — reprises des badges de la maquette. */
const COULEUR: Record<string, string> = {
  CATALOGUE: '#F97316',
  CONFIG: '#F97316',
  COMMANDE: '#10B981',
  VALIDATION: '#10B981',
  AUTH: '#3B82F6',
  PAYMENT: '#3B82F6',
  UTILISATEUR: '#EF4444',
  SYSTEM: '#EF4444',
};
const TYPES: [string, string][] = [
  ['', 'Tous les types'],
  ['CATALOGUE', 'Catalogue'],
  ['UTILISATEUR', 'Utilisateurs'],
  ['SYSTEM', 'Système'],
  ['PAYMENT', 'Paiements'],
  ['COMMANDE', 'Commandes'],
  ['VALIDATION', 'Propositions de budget'],
  ['CONFIG', 'Zones & configuration'],
  ['AUTH', 'Authentification'],
];
/**
 * AdminLogsPage — design Stitch (code.html) conservé, données RÉELLES : GET /admin/audit-logs
 * (30 par page, filtres serveur `action` et `from`). Catégorie, titre et détail sont déduits de
 * chaque entrée (middleware d'audit et événements critiques). Laissés tels quels (décision
 * utilisateur P3, aucune API) : filtre « Rôle », choix 10 / 25 / 50 par page, « Exporter PDF ».
 */
export default function AdminLogsPage() {
  useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, last: 1, total: 0 });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [applied, setApplied] = useState<{ action?: string; from?: string }>({});
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    adminApi
      .getAuditLogs({ page, ...applied })
      .then((res: any) => {
        if (!alive) return;
        setLogs(listOf(res));
        setMeta({ page: Number(res?.current_page ?? page), last: Number(res?.last_page ?? 1), total: Number(res?.total ?? 0) });
      })
      .catch((e) => alive && setErr(alertApiError(e, 'admin-logs')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, applied]);

  const appliquer = () => {
    setApplied({ ...(search.trim() ? { action: search.trim() } : {}), ...(from ? { from } : {}) });
    setPage(1);
  };
  const visibles = type ? logs.filter((l) => categorie(l) === type) : logs;

  const exporterCsv = async () => {
    try {
      const acc: any[] = [];
      for (let p = 1; p <= 20; p++) {
        const res: any = await adminApi.getAuditLogs({ page: p, ...applied });
        acc.push(...listOf(res));
        if (p >= Number(res?.last_page ?? 1)) break;
      }
      const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lignes = [
        ['Date', tx("Catégorie"), 'Titre', 'Action brute', 'Utilisateur', 'IP', tx("Détail")].map(cell).join(';'),
        ...acc
          .filter((l) => !type || categorie(l) === type)
          .map((l) => [l.created_at, categorie(l), titre(l), l.action, acteur(l).nom, l.ip_address, detail(l)].map(cell).join(';')),
      ];
      const blob = new Blob([`\uFEFF${lignes.join('\n')}`], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `journal-audit-tokpa-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alertApiError(e, 'admin-logs-export');
    }
  };

  const numeros = Array.from({ length: meta.last }, (_, i) => i + 1).filter((n) => n === 1 || n === meta.last || Math.abs(n - meta.page) <= 1);

  return (
    <AdminLayout currentPath="/admin/logs">
      <style>{DESIGN_CSS}</style>
      <header className="flex justify-between items-end mb-xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <i className="ti ti-clipboard-list text-primary text-3xl"></i>
            <h1 className="font-h1 text-h1 text-text-main">{tx("Logs &amp; Audit")}</h1>
          </div>
          <p className="font-body text-body text-text-secondary">
            {loading ? tx("Chargement…") : tr(`${meta.total.toLocaleString('fr-FR')} événement${meta.total > 1 ? 's' : ''} enregistré${meta.total > 1 ? 's' : ''}`, `${meta.total.toLocaleString('en-GB')} event${meta.total > 1 ? 's' : ''} recorded`)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-border-default px-md py-sm rounded-[10px] hover:bg-surface-container-low transition-all font-label text-label active:scale-97">
            <i className="ti ti-download"></i> {tx("Exporter PDF")}
          </button>
          <button
            type="button"
            onClick={exporterCsv}
            className="flex items-center gap-2 bg-white border border-border-default px-md py-sm rounded-[10px] hover:bg-surface-container-low transition-all font-label text-label active:scale-97"
          >
            <i className="ti ti-download"></i> {tx("Exporter CSV")}
          </button>
        </div>
      </header>
      {err && (
        <div className="mb-lg rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Erreur API")}</p>
          <p>{err}</p>
        </div>
      )}
      <section className="bg-white border border-border-default rounded-[14px] p-lg mb-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-md">
          <div className="relative">
            <label className="block text-secondary font-secondary text-text-secondary mb-1">{tx("Recherche")}</label>
            <div className="relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"></i>
              <input
                className="w-full pl-10 pr-4 py-2 border-border-default border-[1.5px] rounded-[10px] focus:ring-[3px] focus:ring-primary/15 focus:border-primary-container outline-none transition-all"
                placeholder="Action (ex : users, DELETE, OrderStatusChanged)"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && appliquer()}
              />
            </div>
          </div>
          <div>
            <label className="block text-secondary font-secondary text-text-secondary mb-1">{tx("Type d'action")}</label>
            <select
              className="w-full px-4 py-2 border-border-default border-[1.5px] rounded-[10px] focus:ring-[3px] focus:ring-primary/15 focus:border-primary-container outline-none appearance-none bg-white"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {tx(l)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-secondary font-secondary text-text-secondary mb-1">{tx("Rôle")}</label>
            <select className="w-full px-4 py-2 border-border-default border-[1.5px] rounded-[10px] focus:ring-[3px] focus:ring-primary/15 focus:border-primary-container outline-none appearance-none bg-white">
              <option>{tx("Tous les rôles")}</option>
              <option>{tx("Administrateur")}</option>
              <option>{tx("Vendeur")}</option>
              <option>{tx("Client")}</option>
              <option>{tx("Livreur")}</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex-1">
            <label className="block text-secondary font-secondary text-text-secondary mb-1">{tx("Période (à partir du)")}</label>
            <div className="flex items-center gap-2 px-4 py-2 border-border-default border-[1.5px] rounded-[10px] bg-white">
              <i className="ti ti-calendar text-text-secondary"></i>
              <input type="date" className="flex-1 text-body text-text-main outline-none bg-transparent" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={tx("Date de début")} />
              <span className="text-body text-text-secondary">→ Aujourd'hui</span>
            </div>
          </div>
          <button type="button" onClick={appliquer} className="self-end px-xl py-2 bg-primary-container text-white font-bold rounded-[10px] hover:bg-primary-hover transition-all active:scale-95">
            {tx("Appliquer")}
          </button>
        </div>
      </section>
      <section className="relative pl-md">
        <div className="absolute timeline-line"></div>
        <div className="space-y-md relative">
          {!loading && visibles.length === 0 && (
            <div className="bg-white border-[0.5px] border-border-default rounded-[10px] p-md text-center text-text-secondary">
              {type ? tx("Aucun événement de ce type sur cette page.") : tx("Aucun événement enregistré.")}
            </div>
          )}
          {visibles.map((log) => {
            const cat = categorie(log);
            const c = COULEUR[cat] ?? '#EF4444';
            const qui = acteur(log);
            return (
              <div key={log.id} className="flex gap-lg items-start group">
                <div className="mt-4 w-2.5 h-2.5 rounded-full relative z-10 shrink-0" style={{ backgroundColor: c, boxShadow: `0 0 0 4px ${c}33` }}></div>
                <div className="flex-1 bg-white border-[0.5px] border-border-default rounded-[10px] p-md shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-micro px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${c}1A`, color: c }}>
                        {cat}
                      </span>
                      <h3 className="font-h3 text-h3 text-text-main">{titre(log)}</h3>
                    </div>
                    <span className="text-[12px] font-secondary text-text-tertiary">{quand(log.created_at)}</span>
                  </div>
                  <div className="bg-surface-container-low p-sm rounded-lg mb-md text-secondary border-l-4" style={{ borderColor: c }}>
                    <p className="font-medium text-text-secondary">{detail(log)}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary-fixed text-primary-deep rounded-full flex items-center justify-center text-micro font-bold">{initials(qui.nom)}</div>
                      <div className="text-secondary">
                        <span className="font-bold text-text-main">{qui.nom}</span> • <span className="text-text-secondary">{qui.sous}</span>
                      </div>
                    </div>
                    <code className="font-mono text-[11px] text-text-tertiary">{log.ip_address ?? '—'}</code>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <footer className="mt-xl pt-lg border-t border-border-default flex flex-col md:flex-row justify-between items-center gap-md">
        <p className="text-secondary text-text-secondary">
          {tr(`Page ${meta.page} sur ${meta.last}`, `Page ${meta.page} of ${meta.last}`)}
          {type ? tx(" (type filtré sur la page affichée)") : ''} · {tx("Afficher")} <button className="font-bold text-primary hover:underline">10</button> /{' '}
          <button className="hover:text-primary">25</button> / <button className="hover:text-primary">50</button> {tx("par page")}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => setPage(meta.page - 1)}
            className="w-10 h-10 flex items-center justify-center border border-border-default rounded-lg bg-white text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ti ti-chevron-left"></i>
          </button>
          {numeros.map((n, i) => (
            <span key={n} className="flex gap-2">
              {i > 0 && n - numeros[i - 1] > 1 && <span className="px-2 self-center">...</span>}
              <button
                type="button"
                onClick={() => setPage(n)}
                className={
                  n === meta.page
                    ? 'w-10 h-10 flex items-center justify-center border border-primary-container rounded-lg bg-primary-container text-white font-bold'
                    : 'w-10 h-10 flex items-center justify-center border border-border-default rounded-lg bg-white text-text-main hover:bg-surface-container-low transition-colors'
                }
              >
                {n}
              </button>
            </span>
          ))}
          <button
            type="button"
            disabled={meta.page >= meta.last}
            onClick={() => setPage(meta.page + 1)}
            className="w-10 h-10 flex items-center justify-center border border-border-default rounded-lg bg-white text-text-main hover:bg-surface-container-low transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ti ti-chevron-right"></i>
          </button>
        </div>
      </footer>
    </AdminLayout>
  );
}
