import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  faArrowUpRightFromSquare,
  faBell,
  faBolt,
  faBoxOpen,
  faChartLine,
  faCheck,
  faChevronDown,
  faCircle,
  faClock,
  faDatabase,
  faGear,
  faGlobe,
  faHeartPulse,
  faHouse,
  faMagnifyingGlass,
  faNetworkWired,
  faRotate,
  faServer,
  faShieldHalved,
  faSliders,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Icon } from '../../components/ui/Icon';
import { formatFCFA } from '../../utils/formatFCFA';

interface Service {
  id: string;
  name: string;
  description: string;
  icon: typeof faServer;
  color: string;
  uptime: string;
  latency: string;
  state: 'operational' | 'attention';
}

const baseServices: Service[] = [
  { id: 'api', name: 'API Laravel', description: 'Requêtes et authentification', icon: faServer, color: 'text-sky-600 bg-sky-50', uptime: '99,98 %', latency: '124 ms', state: 'operational' },
  { id: 'database', name: 'Base de données', description: 'MySQL · lecture / écriture', icon: faDatabase, color: 'text-violet-600 bg-violet-50', uptime: '99,99 %', latency: '18 ms', state: 'operational' },
  { id: 'queue', name: 'Files de traitement', description: 'Jobs et notifications', icon: faBolt, color: 'text-amber-600 bg-amber-50', uptime: '99,92 %', latency: '240 ms', state: 'attention' },
  { id: 'realtime', name: 'Temps réel', description: 'Echo · WebSockets · présence', icon: faNetworkWired, color: 'text-emerald-600 bg-emerald-50', uptime: '99,97 %', latency: '82 ms', state: 'operational' },
];

const logs = [
  { time: '14:32:08', action: 'Zone Akpakpa mise à jour', user: 'Marc Koffi', type: 'Configuration', tone: 'bg-orange-100 text-orange-700' },
  { time: '14:28:43', action: 'Livreur ajouté à l’équipe', user: 'Aminata H.', type: 'Utilisateurs', tone: 'bg-sky-100 text-sky-700' },
  { time: '14:17:12', action: 'Prix produit modifié', user: 'Admin catalogue', type: 'Catalogue', tone: 'bg-violet-100 text-violet-700' },
  { time: '13:54:36', action: 'Commande CMD-1048 assignée', user: 'Marc Koffi', type: 'Opérations', tone: 'bg-emerald-100 text-emerald-700' },
];

function AdminSideBar({ active }: { active: string }) {
  const items = [
    { id: 'dashboard', label: 'Vue globale', to: '/admin', icon: faHouse },
    { id: 'console', label: 'Console système', to: '/admin/console', icon: faHeartPulse },
    { id: 'users', label: 'Utilisateurs', to: '/admin', icon: faUsers },
    { id: 'orders', label: 'Commandes', to: '/admin', icon: faBoxOpen },
    { id: 'catalog', label: 'Catalogue', to: '/admin', icon: faSliders },
    { id: 'zones', label: 'Zones & équipes', to: '/manager/zones', icon: faGlobe },
  ];
  return <aside className="flex h-full w-[270px] flex-col bg-[#111727] p-5 text-white"><Link to="/" className="px-4 pt-3 text-2xl font-black tracking-tight">TOK<span className="text-orange-500">Pa</span></Link><div className="mt-2 px-4 text-xs text-slate-500">Administration centrale</div><nav className="mt-10 space-y-1" aria-label="Navigation administrateur"><p className="mb-3 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Pilotage</p>{items.map((item) => <Link key={item.id} to={item.to} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${active === item.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/30' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}><Icon icon={item.icon} className="w-4" />{item.label}</Link>)}</nav><div className="mt-auto border-t border-white/10 pt-5"><Link to="/admin" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white"><Icon icon={faGear} /> Paramètres</Link><div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-violet-500 font-black">AD</span><div className="min-w-0"><p className="truncate text-sm font-bold">Admin TOKPa</p><p className="text-xs text-slate-400">Administrateur</p></div></div></div></aside>;
}

function ServiceCard({ service, enabled, onToggle }: { service: Service; enabled: boolean; onToggle: () => void }) {
  const state = enabled ? service.state : 'attention';
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className={`grid h-11 w-11 place-items-center rounded-xl ${service.color}`}><Icon icon={service.icon} /></div><button type="button" onClick={onToggle} className={`relative h-6 w-11 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-label={`Activer ou désactiver ${service.name}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} /></button></div><h2 className="mt-5 font-black">{service.name}</h2><p className="mt-1 text-xs text-slate-500">{service.description}</p><div className="mt-5 flex items-center gap-2 text-xs font-bold"><Icon icon={faCircle} className={`text-[8px] ${state === 'operational' ? 'text-emerald-500' : 'text-amber-500'}`} />{state === 'operational' ? 'Opérationnel' : 'Attention requise'}</div><div className="mt-4 grid grid-cols-2 border-t border-slate-100 pt-4 text-xs"><div><p className="text-slate-400">Disponibilité</p><p className="mt-1 font-black text-slate-800">{enabled ? service.uptime : '—'}</p></div><div><p className="text-slate-400">Latence</p><p className="mt-1 font-black text-slate-800">{enabled ? service.latency : 'Arrêté'}</p></div></div></article>;
}

function UsageChart() {
  const values = [34, 40, 36, 52, 46, 62, 59, 70, 64, 78, 74, 87, 80, 91, 86, 95, 90];
  const points = values.map((value, index) => `${index * 6.25},${110 - value}`).join(' ');
  return <div className="relative mt-6 h-56 overflow-hidden rounded-2xl bg-slate-950 p-4"><div className="absolute inset-x-4 top-5 space-y-9 border-t border-dashed border-white/10"><span /><span className="block border-t border-dashed border-white/10" /><span className="block border-t border-dashed border-white/10" /><span className="block border-t border-dashed border-white/10" /></div><svg viewBox="0 0 100 110" preserveAspectRatio="none" className="relative h-full w-full"><defs><linearGradient id="usage-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f97316" stopOpacity=".42" /><stop offset="1" stopColor="#f97316" stopOpacity="0" /></linearGradient></defs><polyline points={`0,110 ${points} 100,110`} fill="url(#usage-fill)" stroke="none" /><polyline points={points} fill="none" stroke="#fb923c" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div className="absolute inset-x-5 bottom-3 flex justify-between text-[10px] text-slate-500"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span></div></div>;
}

export function AdminConsolePage() {
  const [services] = useState(baseServices);
  const [enabledServices, setEnabledServices] = useState<Record<string, boolean>>({ api: true, database: true, queue: true, realtime: true });
  const [range, setRange] = useState('Dernières 24 heures');
  const [message, setMessage] = useState('');
  const totalRevenue = useMemo(() => 4_812_450, []);
  const toggleService = (id: string) => { setEnabledServices((current) => ({ ...current, [id]: !current[id] })); setMessage('Les changements sont enregistrés en mode démonstration.'); window.setTimeout(() => setMessage(''), 2800); };

  return <div className="min-h-screen bg-[#f7f8fb] text-slate-900"><div className="fixed inset-y-0 left-0 z-40 hidden lg:block"><AdminSideBar active="console" /></div><div className="min-h-screen lg:pl-[270px]"><header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4"><div><p className="eyebrow">Administration centrale</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Console système</h1></div><div className="flex items-center gap-2 sm:gap-3"><span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:inline-flex"><Icon icon={faCircle} className="text-[7px]" /> Tous les services sont en ligne</span><button type="button" onClick={() => setMessage('Dernière vérification effectuée à l’instant.')} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-orange-50 hover:text-brand-600" aria-label="Actualiser"><Icon icon={faRotate} /></button><button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-orange-50 hover:text-brand-600" aria-label="Notifications"><Icon icon={faBell} /></button><span className="grid h-10 w-10 place-items-center rounded-full bg-violet-500 text-xs font-black text-white">AD</span></div></div></header><main className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Chiffre d’affaires</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-600"><Icon icon={faChartLine} /></span></div><p className="mt-4 text-2xl font-black">{formatFCFA(totalRevenue)}</p><p className="mt-2 text-xs font-bold text-emerald-600">+14,2 % ce mois</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Utilisateurs actifs</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><Icon icon={faUsers} /></span></div><p className="mt-4 text-2xl font-black">1 284</p><p className="mt-2 text-xs font-bold text-emerald-600">+86 depuis lundi</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Commandes aujourd’hui</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon icon={faBoxOpen} /></span></div><p className="mt-4 text-2xl font-black">126</p><p className="mt-2 text-xs font-bold text-emerald-600">+8,4 % vs. hier</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Incidents ouverts</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><Icon icon={faTriangleExclamation} /></span></div><p className="mt-4 text-2xl font-black">3</p><p className="mt-2 text-xs font-bold text-amber-600">2 à traiter aujourd’hui</p></div></section><section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.8fr)]"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="eyebrow">Santé de la plateforme</p><h2 className="mt-1 text-xl font-black">Services opérationnels</h2><p className="mt-2 text-sm text-slate-500">État des briques connectées au backend TOKPa.</p></div><span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><Icon icon={faShieldHalved} /> Surveillance active</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{services.map((service) => <ServiceCard key={service.id} service={service} enabled={enabledServices[service.id] ?? true} onToggle={() => toggleService(service.id)} />)}</div></div><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Trafic API</p><h2 className="mt-1 text-xl font-black">Requêtes traitées</h2></div><div className="relative"><select value={range} onChange={(event) => setRange(event.target.value)} className="appearance-none rounded-xl bg-slate-50 py-2 pl-3 pr-8 text-xs font-bold text-slate-600 outline-none"><option>Dernières 24 heures</option><option>7 derniers jours</option><option>30 derniers jours</option></select><Icon icon={faChevronDown} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" /></div></div><p className="mt-5 text-3xl font-black">48 920 <span className="text-sm font-bold text-emerald-600">+12 %</span></p><UsageChart /><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span><Icon icon={faCircle} className="mr-1 text-[7px] text-orange-500" /> Requêtes entrantes</span><span>{range}</span></div></div></section><section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Journal de sécurité</p><h2 className="mt-1 text-xl font-black">Dernières activités admin</h2></div><div className="flex items-center gap-2"><label className="relative hidden sm:block"><span className="sr-only">Rechercher dans les activités</span><Icon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input placeholder="Filtrer…" className="w-36 rounded-xl bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:ring-4 focus:ring-orange-100" /></label><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-orange-200 hover:text-brand-600"><Icon icon={faArrowUpRightFromSquare} /> Voir l’audit</button></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400"><tr><th className="pb-3 font-bold">Heure</th><th className="pb-3 font-bold">Action</th><th className="pb-3 font-bold">Auteur</th><th className="pb-3 font-bold">Module</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.map((log) => <tr key={`${log.time}-${log.action}`}><td className="py-4 font-mono text-xs text-slate-400">{log.time}</td><td className="py-4 font-bold text-slate-800">{log.action}</td><td className="py-4 text-slate-500">{log.user}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${log.tone}`}>{log.type}</span></td></tr>)}</tbody></table></div></section></main></div>{message && <div role="status" className="motion-enter fixed bottom-5 right-5 z-[70] rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl">{message}</div>}</div>;
}
