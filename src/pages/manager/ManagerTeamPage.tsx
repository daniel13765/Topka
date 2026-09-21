import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  faArrowRight,
  faBars,
  faBell,
  faBriefcase,
  faCalendarDays,
  faCheck,
  faChevronDown,
  faCircle,
  faClock,
  faGear,
  faLocationDot,
  faMagnifyingGlass,
  faMotorcycle,
  faPen,
  faPhone,
  faPlus,
  faRightFromBracket,
  faRoute,
  faStar,
  faUserGroup,
  faUserPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Icon } from '../../components/ui/Icon';

interface Driver {
  id: number;
  name: string;
  initials: string;
  phone: string;
  email: string;
  vehicle: string;
  status: 'available' | 'route' | 'offline';
  deliveries: number;
  rating: number;
  zone: string;
  joinedAt: string;
}

const initialDrivers: Driver[] = [
  { id: 1, name: 'Koffi Ahouansou', initials: 'KA', phone: '+229 97 12 45 68', email: 'koffi@tokpa.bj', vehicle: 'Moto · AB 4521 RB', status: 'available', deliveries: 18, rating: 4.9, zone: 'Akpakpa', joinedAt: 'Depuis mars 2025' },
  { id: 2, name: 'Mariam Soglo', initials: 'MS', phone: '+229 96 43 21 08', email: 'mariam@tokpa.bj', vehicle: 'Moto · BJ 1108 AB', status: 'route', deliveries: 14, rating: 4.8, zone: 'Akpakpa', joinedAt: 'Depuis juin 2025' },
  { id: 3, name: 'Yves Dossou', initials: 'YD', phone: '+229 95 88 04 17', email: 'yves@tokpa.bj', vehicle: 'Moto · AB 9310 RB', status: 'available', deliveries: 11, rating: 4.7, zone: 'Akpakpa', joinedAt: 'Depuis août 2025' },
  { id: 4, name: 'Aïcha Hounkpatin', initials: 'AH', phone: '+229 98 20 15 42', email: 'aicha@tokpa.bj', vehicle: 'Moto · BJ 6274 AC', status: 'offline', deliveries: 8, rating: 4.6, zone: 'Akpakpa', joinedAt: 'Depuis janvier 2026' },
];

const statusLabels: Record<Driver['status'], string> = {
  available: 'Disponible',
  route: 'En course',
  offline: 'Hors ligne',
};

function SideBar({ onMobileClose }: { onMobileClose?: () => void }) {
  return (
    <aside className="flex h-full w-[294px] flex-col bg-[#111727] p-5 text-white">
      <div className="flex items-center justify-between px-4 pt-3"><Link to="/" className="text-2xl font-black tracking-tight">TOK<span className="text-orange-500">Pa</span></Link><button type="button" onClick={onMobileClose} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Fermer le menu"><Icon icon={faXmark} /></button></div>
      <div className="mt-8 rounded-2xl bg-white/5 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Espace manager</p><div className="mt-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-orange-600 font-black">MK</span><div><p className="font-bold">Marc Koffi</p><p className="text-xs text-slate-400">Manager · Akpakpa</p></div></div></div>
      <nav className="mt-8 space-y-1" aria-label="Navigation manager"><p className="mb-3 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Pilotage</p><Link to="/manager" onClick={onMobileClose} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white"><Icon icon={faBriefcase} className="w-4" /> Tableau de bord</Link><Link to="/manager/equipe" onClick={onMobileClose} className="flex items-center gap-3 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/30"><Icon icon={faUserGroup} className="w-4" /> Mon équipe <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px]">12</span></Link><Link to="/manager/zones" onClick={onMobileClose} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white"><Icon icon={faLocationDot} className="w-4" /> Gestion des zones</Link><button type="button" className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white"><Icon icon={faRoute} className="w-4" /> Courses du jour <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">42</span></button></nav>
      <div className="mt-auto border-t border-white/10 pt-5"><Link to="/manager" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white"><Icon icon={faGear} /> Paramètres</Link><Link to="/" className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white"><Icon icon={faRightFromBracket} /> Quitter l’espace</Link></div>
    </aside>
  );
}

function DriverCard({ driver, onEdit, onAssign }: { driver: Driver; onEdit: () => void; onAssign: () => void }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className={`grid h-12 w-12 place-items-center rounded-2xl text-sm font-black ${driver.status === 'available' ? 'bg-orange-100 text-orange-700' : driver.status === 'route' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>{driver.initials}</span><div><h2 className="font-black text-slate-900">{driver.name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Icon icon={faCircle} className={`text-[7px] ${driver.status === 'available' ? 'text-emerald-500' : driver.status === 'route' ? 'text-orange-500' : 'text-slate-400'}`} />{statusLabels[driver.status]}</p></div></div><button type="button" onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-orange-50 hover:text-brand-600" aria-label={`Modifier ${driver.name}`}><Icon icon={faPen} size="sm" /></button></div><div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-sm"><div><p className="text-xs text-slate-400">Courses ce mois</p><p className="mt-1 font-black">{driver.deliveries}</p></div><div><p className="text-xs text-slate-400">Note moyenne</p><p className="mt-1 font-black"><Icon icon={faStar} className="mr-1 text-amber-400" />{driver.rating}</p></div></div><div className="mt-4 space-y-2 text-xs text-slate-500"><p><Icon icon={faMotorcycle} className="mr-2 w-4 text-slate-400" />{driver.vehicle}</p><p><Icon icon={faPhone} className="mr-2 w-4 text-slate-400" />{driver.phone}</p><p><Icon icon={faCalendarDays} className="mr-2 w-4 text-slate-400" />{driver.joinedAt}</p></div><div className="mt-5 flex gap-2"><button type="button" onClick={onAssign} disabled={driver.status === 'offline'} className="btn-primary flex-1 !rounded-xl !px-3 !py-2.5 text-xs disabled:bg-slate-200 disabled:text-slate-500">Attribuer une course</button><a href={`tel:${driver.phone.replaceAll(' ', '')}`} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:border-orange-200 hover:text-brand-600" aria-label={`Appeler ${driver.name}`}><Icon icon={faPhone} /></a></div></article>
  );
}

export function ManagerTeamPage() {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [filter, setFilter] = useState<'all' | Driver['status']>('all');
  const [search, setSearch] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [assignDriver, setAssignDriver] = useState<Driver | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicle: '', zone: 'Akpakpa' });
  const [assignment, setAssignment] = useState('CMD-1048 · Cadjèhoun → Akpakpa');

  const visibleDrivers = useMemo(() => drivers.filter((driver) => (filter === 'all' || driver.status === filter) && `${driver.name} ${driver.phone}`.toLowerCase().includes(search.toLowerCase())), [drivers, filter, search]);
  const available = drivers.filter((driver) => driver.status === 'available').length;
  const onRoute = drivers.filter((driver) => driver.status === 'route').length;

  const announce = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 3200); };

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    const names = form.name.trim().split(' ');
    const newDriver: Driver = { id: Date.now(), name: form.name.trim(), initials: names.map((part) => part[0]).join('').slice(0, 2).toUpperCase(), phone: form.phone, email: form.email || '—', vehicle: form.vehicle || 'Véhicule à renseigner', status: 'available', deliveries: 0, rating: 0, zone: form.zone, joinedAt: 'À l’instant' };
    setDrivers((current) => [newDriver, ...current]);
    setForm({ name: '', phone: '', email: '', vehicle: '', zone: 'Akpakpa' });
    setIsInviteOpen(false);
    announce('Le livreur a été ajouté à votre équipe.');
  };

  const saveEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDriver) return;
    setDrivers((current) => current.map((driver) => driver.id === editDriver.id ? editDriver : driver));
    setEditDriver(null);
    announce('Les informations du livreur ont été mises à jour.');
  };

  const assign = () => {
    if (!assignDriver) return;
    setDrivers((current) => current.map((driver) => driver.id === assignDriver.id ? { ...driver, status: 'route' } : driver));
    announce(`La course a été attribuée à ${assignDriver.name}.`);
    setAssignDriver(null);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <div className="fixed inset-0 z-50 flex lg:hidden" aria-label="Menu manager" hidden={!mobileMenu}><button type="button" onClick={() => setMobileMenu(false)} className="absolute inset-0 bg-slate-950/60" aria-label="Fermer" /><div className="relative h-full"><SideBar onMobileClose={() => setMobileMenu(false)} /></div></div>
      <div className="flex min-h-screen"><div className="hidden shrink-0 lg:block"><SideBar /></div><div className="min-w-0 flex-1"><header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4"><div className="flex items-center gap-3"><button type="button" onClick={() => setMobileMenu(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 lg:hidden" aria-label="Ouvrir le menu"><Icon icon={faBars} /></button><div><p className="eyebrow">Zone Manager</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Mon équipe</h1></div></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 sm:flex"><Icon icon={faLocationDot} className="text-orange-600" /> Zone Akpakpa <Icon icon={faChevronDown} className="ml-2 text-xs text-slate-400" /></div><button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-orange-50 hover:text-brand-600" aria-label="Notifications"><Icon icon={faBell} /></button><span className="grid h-10 w-10 place-items-center rounded-full bg-slate-800 text-xs font-black text-white">MK</span></div></div></header><main className="mx-auto max-w-[1280px] px-5 py-7 sm:px-8"><section className="flex flex-col justify-between gap-5 rounded-3xl bg-[#111727] p-6 text-white shadow-xl shadow-slate-200 sm:flex-row sm:items-end sm:p-8"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">Pilotage de proximité</p><h2 className="mt-3 text-2xl font-black sm:text-3xl">Les bonnes personnes au bon endroit.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Suivez la disponibilité des livreurs de votre zone, invitez de nouveaux profils et répartissez les courses en quelques secondes.</p></div><button type="button" onClick={() => setIsInviteOpen(true)} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400"><Icon icon={faUserPlus} className="mr-2" /> Ajouter un livreur</button></section><section className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Livreurs de la zone</p><p className="mt-2 text-3xl font-black">{drivers.length + 8}</p><p className="mt-2 text-xs font-bold text-slate-400">12 affectés au total</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">Disponibles maintenant</p><p className="mt-2 text-3xl font-black text-emerald-900">{available}</p><p className="mt-2 text-xs font-bold text-emerald-700"><Icon icon={faCheck} className="mr-1" /> Prêts à partir</p></div><div className="rounded-2xl border border-orange-100 bg-orange-50 p-5"><p className="text-sm text-orange-700">En course</p><p className="mt-2 text-3xl font-black text-orange-900">{onRoute}</p><p className="mt-2 text-xs font-bold text-orange-700"><Icon icon={faClock} className="mr-1" /> Suivi en direct</p></div></section><section className="mt-9"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="eyebrow">Équipe active</p><h2 className="mt-1 text-2xl font-black">Livreurs et disponibilités</h2></div><button type="button" onClick={() => setIsInviteOpen(true)} className="btn-secondary self-start md:self-auto"><Icon icon={faPlus} className="mr-2" /> Nouveau profil</button></div><div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"><label className="relative min-w-0 flex-1"><span className="sr-only">Rechercher un livreur</span><Icon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par nom ou téléphone…" className="w-full rounded-xl bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none focus:ring-4 focus:ring-orange-100" /></label><div className="flex gap-1 overflow-x-auto">{([['all', 'Tous'], ['available', 'Disponibles'], ['route', 'En course'], ['offline', 'Hors ligne']] as const).map(([id, label]) => <button type="button" key={id} onClick={() => setFilter(id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition ${filter === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{label}</button>)}</div></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleDrivers.map((driver) => <DriverCard key={driver.id} driver={driver} onEdit={() => setEditDriver(driver)} onAssign={() => setAssignDriver(driver)} />)}{visibleDrivers.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Aucun livreur ne correspond à cette recherche.</div>}</div></section><section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="eyebrow">Activité de la zone</p><h2 className="mt-1 text-xl font-black">Courses à attribuer</h2><p className="mt-2 text-sm text-slate-500">3 commandes attendent une affectation sur Akpakpa.</p></div><Link to="/manager" className="inline-flex items-center font-bold text-brand-600">Voir toutes les commandes <Icon icon={faArrowRight} className="ml-2" /></Link></div><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-orange-50 p-4"><p className="text-xs font-black text-orange-700">CMD-1048</p><p className="mt-2 text-sm font-bold">Cadjèhoun → Akpakpa</p><p className="mt-2 text-xs text-slate-500">Panier du marché · 7 950 FCFA</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">CMD-1049</p><p className="mt-2 text-sm font-bold">Dantokpa → Gbégamey</p><p className="mt-2 text-xs text-slate-500">4 produits · 4 280 FCFA</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">CMD-1050</p><p className="mt-2 text-sm font-bold">Missebo → Zogbo</p><p className="mt-2 text-xs text-slate-500">2 produits · 2 600 FCFA</p></div></div></section></main></div></div>
      {isInviteOpen && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/65 px-5 py-8"><form onSubmit={submitInvite} className="motion-enter max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Gestion de l’équipe</p><h2 className="mt-2 text-2xl font-black">Ajouter un livreur</h2><p className="mt-2 text-sm leading-6 text-slate-500">Créez son profil pour pouvoir lui attribuer des courses.</p></div><button type="button" onClick={() => setIsInviteOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Fermer"><Icon icon={faXmark} /></button></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="field-label sm:col-span-2">Nom complet<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="field-input" placeholder="Ex. Jean Hounkpatin" autoFocus /></label><label className="field-label">Téléphone<input required value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="field-input" placeholder="+229 97 00 00 00" /></label><label className="field-label">E-mail<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="field-input" placeholder="livreur@tokpa.bj" /></label><label className="field-label">Zone principale<select value={form.zone} onChange={(event) => setForm((current) => ({ ...current, zone: event.target.value }))} className="field-input"><option>Akpakpa</option><option>Cadjèhoun</option><option>Fidjrossè</option></select></label><label className="field-label">Véhicule<input value={form.vehicle} onChange={(event) => setForm((current) => ({ ...current, vehicle: event.target.value }))} className="field-input" placeholder="Moto · AB 1234 RB" /></label></div><div className="mt-7 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" onClick={() => setIsInviteOpen(false)} className="btn-secondary !bg-white">Annuler</button><button type="submit" className="btn-primary"><Icon icon={faUserPlus} className="mr-2" /> Ajouter le profil</button></div></form></div>}
      {assignDriver && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/65 px-5 py-8"><div className="motion-enter w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Nouvelle affectation</p><h2 className="mt-2 text-2xl font-black">Attribuer une course</h2><p className="mt-2 text-sm text-slate-500">Sélectionnez la commande à confier à {assignDriver.name}.</p></div><button type="button" onClick={() => setAssignDriver(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500" aria-label="Fermer"><Icon icon={faXmark} /></button></div><div className="mt-6 rounded-2xl bg-orange-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Livreur sélectionné</p><p className="mt-2 font-black">{assignDriver.name}</p><p className="mt-1 text-sm text-slate-500">{assignDriver.phone}</p></div><label className="field-label mt-5 block">Commande à attribuer<div className="relative"><select value={assignment} onChange={(event) => setAssignment(event.target.value)} className="field-input appearance-none pr-10"><option>CMD-1048 · Cadjèhoun → Akpakpa</option><option>CMD-1049 · Dantokpa → Gbégamey</option><option>CMD-1050 · Missebo → Zogbo</option></select><Icon icon={faChevronDown} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" /></div></label><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setAssignDriver(null)} className="btn-secondary !bg-white">Annuler</button><button type="button" onClick={assign} className="btn-primary"><Icon icon={faCheck} className="mr-2" /> Confirmer l’affectation</button></div></div></div>}
      {editDriver && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/65 px-5 py-8"><form onSubmit={saveEdit} className="motion-enter w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Profil livreur</p><h2 className="mt-2 text-2xl font-black">Modifier {editDriver.name}</h2></div><button type="button" onClick={() => setEditDriver(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500" aria-label="Fermer"><Icon icon={faXmark} /></button></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="field-label sm:col-span-2">Nom complet<input required value={editDriver.name} onChange={(event) => setEditDriver({ ...editDriver, name: event.target.value })} className="field-input" /></label><label className="field-label">Téléphone<input required value={editDriver.phone} onChange={(event) => setEditDriver({ ...editDriver, phone: event.target.value })} className="field-input" /></label><label className="field-label">Statut<select value={editDriver.status} onChange={(event) => setEditDriver({ ...editDriver, status: event.target.value as Driver['status'] })} className="field-input"><option value="available">Disponible</option><option value="route">En course</option><option value="offline">Hors ligne</option></select></label></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setEditDriver(null)} className="btn-secondary !bg-white">Annuler</button><button type="submit" className="btn-primary">Enregistrer</button></div></form></div>}
      {message && <div role="status" className="motion-enter fixed bottom-5 right-5 z-[70] rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl">{message}</div>}
    </div>
  );
}
