import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { adminApi, authApi } from '../../services/api';
import { listOf, unwrap } from '../../services/api/unwrap';
import { zoneNom, initials } from '../../services/api/useLiveRows';
import { alertApiError, extractApiError, formatApiError } from '../../utils/apiError';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import AdminNotificationBell from '../../components/layout/admin/AdminNotificationBell';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

const DESIGN_CSS = `
    .btn-press:active {
      transform: scale(0.97);
    }
    /* Modal transitions */
    #userModal.active, #addUserModal.active {
      display: flex !important;
    }
  `;

/**
 * AdminUsersPage — design Stitch (code.html) conservé à l'identique, données et actions RÉELLES :
 *  - GET /admin/users (toutes les pages, au plus 25) → tableau, compteurs, onglets, recherche,
 *    filtres (statut, zone) et pagination cohérents ;
 *  - GET /admin/zones → filtre et listes de zones ;
 *  - PUT /admin/users/{id} → statut / zone / disponibilité (fiche, « Suspendre », « Réactiver ») ;
 *  - POST /admin/users → création (mot de passe provisoire aléatoire + lien de définition envoyé
 *    par POST /auth/forgot-password) ; « Réinitialiser mot de passe » = même lien.
 * L'ancien script de la maquette simulait tout (alert « Statut mis à jour », « créé avec succès »…).
 * Étape 2 « Dossier & Conformité » (CIP, permis, véhicule, pièces) : aucun champ backend — laissée
 * telle quelle (décision utilisateur P3), non transmise.
 */
const ROLE_UI: Record<string, { av: string; badge: string; icon: string; label: string }> = {
  client: { av: 'bg-orange-100 text-orange-800', badge: 'bg-orange-50 text-orange-800 border border-orange-200', icon: 'ti ti-user text-xs', label: 'Client' },
  livreur: { av: 'bg-emerald-100 text-emerald-800', badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200', icon: 'ti ti-motorbike text-xs', label: 'Livreur' },
  manager: { av: 'bg-blue-100 text-blue-800', badge: 'bg-blue-50 text-blue-800 border border-blue-200', icon: 'ti ti-shield-check text-xs', label: 'Manager de zone' },
  admin: { av: 'bg-gray-100 text-gray-800', badge: 'bg-gray-50 text-gray-800 border border-gray-200', icon: 'ti ti-crown text-xs', label: 'Administrateur' },
  super_admin: { av: 'bg-gray-100 text-gray-800', badge: 'bg-gray-50 text-gray-800 border border-gray-200', icon: 'ti ti-crown text-xs', label: 'Super administrateur' },
};
const STATUT_UI: Record<string, { label: string; badge: string; dot: string }> = {
  actif: { label: 'Actif', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  inactif: { label: 'Inactif', badge: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400' },
  suspendu: { label: 'Suspendu', badge: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' },
};
const TAB_IDLE = 'role-btn px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white/80 transition-all';
const TAB_ACTIVE = 'role-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-primary shadow-xs border border-primary/30 transition-all';
const PER_PAGE = 10;
const MAX_PAGES = 25;

type RoleTab = 'all' | 'client' | 'livreur' | 'manager' | 'admin';
const roleOf = (u: any): string => (typeof u?.role === 'string' ? u.role : u?.role?.nom) || 'client';
const tabOf = (role: string): RoleTab => (role === 'super_admin' || role === 'admin' ? 'admin' : (role as RoleTab));
const statutOf = (u: any): string => String(u?.statut ?? '').toLowerCase();
const zoneIdOf = (u: any): number | null => {
  const id = u?.profil?.zone_id ?? u?.profil?.zone?.id ?? u?.zone?.id;
  return id != null ? Number(id) : null;
};
const nomOf = (u: any): string => u?.nom_complet || [u?.prenom, u?.nom].filter(Boolean).join(' ') || '—';
const commandesOf = (u: any): number | null => {
  const n = u?.stats?.['commandes_effectuees"'] ?? u?.stats?.commandes_effectuees; // clé renvoyée avec un guillemet (UserResource)
  return n != null ? Number(n) : null;
};
const fmt = (n: number) => n.toLocaleString('fr-FR');
const randomPassword = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `Tk-${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)}!9`;
};

export default function AdminUsersPage() {
  useLanguage();
  /* ---------- données réelles ---------- */
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capped, setCapped] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [zones, setZones] = useState<{ id: number; nom: string }[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    (async () => {
      const acc: any[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res: any = await adminApi.getUsers({ page });
        acc.push(...listOf(res));
        if (page >= Number(res?.meta?.last_page ?? 1)) return { acc, capped: false };
      }
      return { acc, capped: true };
    })()
      .then((r) => {
        if (!alive) return;
        setUsers(r.acc);
        setCapped(r.capped);
      })
      .catch((e) => alive && setErr(alertApiError(e, 'admin-users')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    adminApi
      .getZones()
      .then((r: any) => setZones(listOf(unwrap(r)).map((z: any) => ({ id: Number(z.id), nom: String(z.nom ?? '—') }))))
      .catch(() => setZones([]));
  }, []);

  /* ---------- compteurs réels ---------- */
  const stats = useMemo(() => {
    const c = { total: users.length, actifs: 0, client: 0, livreur: 0, livreursDispo: 0, manager: 0, admin: 0 };
    users.forEach((u) => {
      const t = tabOf(roleOf(u));
      if (statutOf(u) === 'actif') c.actifs++;
      if (t === 'client') c.client++;
      if (t === 'livreur') {
        c.livreur++;
        if (u?.profil?.disponibilite) c.livreursDispo++;
      }
      if (t === 'manager') c.manager++;
      if (t === 'admin') c.admin++;
    });
    return c;
  }, [users]);

  /* ---------- filtres + pagination (côté écran, sur tous les comptes chargés) ---------- */
  const [search, setSearch] = useState('');
  const [roleTab, setRoleTab] = useState<RoleTab>('all');
  const [statusF, setStatusF] = useState('all');
  const [zoneF, setZoneF] = useState('all');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleTab !== 'all' && tabOf(roleOf(u)) !== roleTab) return false;
      if (statusF !== 'all' && statutOf(u) !== statusF) return false;
      if (zoneF !== 'all' && String(zoneIdOf(u) ?? '') !== zoneF) return false;
      if (q && ![nomOf(u), u?.email, u?.telephone].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [users, search, roleTab, statusF, zoneF]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const choose = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const resetAndReload = () => {
    setSearch('');
    setRoleTab('all');
    setStatusF('all');
    setZoneF('all');
    setPage(1);
    setReloadKey((k) => k + 1);
  };

  /* ---------- export CSV (comptes filtrés) ---------- */
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Nom', 'Email', tx("Téléphone"), 'Rôle', 'Zone', 'Statut'].map(cell).join(';'),
      ...filtered.map((u) =>
        [nomOf(u), u?.email, u?.telephone, ROLE_UI[roleOf(u)]?.label ?? roleOf(u), zoneNom(u?.profil?.zone), STATUT_UI[statutOf(u)]?.label ?? u?.statut]
          .map(cell)
          .join(';'),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `utilisateurs-tokpa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ---------- fiche utilisateur (statut / zone / disponibilité réels) ---------- */
  const [selected, setSelected] = useState<any | null>(null);
  const [editStatut, setEditStatut] = useState('actif');
  const [editZone, setEditZone] = useState('');
  const [editDispo, setEditDispo] = useState(false);
  const [saving, setSaving] = useState(false);
  const openUser = (u: any) => {
    setSelected(u);
    setEditStatut(statutOf(u) || 'actif');
    setEditZone(String(zoneIdOf(u) ?? ''));
    setEditDispo(Boolean(u?.profil?.disponibilite));
  };
  const selRole = selected ? roleOf(selected) : '';
  const hasZone = selRole === 'manager' || selRole === 'livreur';

  const saveUser = async () => {
    if (!selected) return;
    const data: Record<string, unknown> = { statut: editStatut };
    if (hasZone && editZone) data.zone_id = Number(editZone);
    if (selRole === 'livreur') data.disponibilite = editDispo;
    setSaving(true);
    try {
      await adminApi.updateUser(Number(selected.id), data);
      toast.success(tx("Modifications enregistrées."));
      setSelected(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alertApiError(e, 'admin-users-save');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: any) => {
    const suspendu = statutOf(u) === 'suspendu';
    if (!confirm(`${suspendu ? tx("Réactiver") : 'Suspendre'} le compte de ${nomOf(u)} ?`)) return;
    try {
      await adminApi.updateUser(Number(u.id), { statut: suspendu ? 'actif' : 'suspendu' });
      toast.success(suspendu ? tx("Compte réactivé.") : 'Compte suspendu.');
      if (selected?.id === u.id) setSelected(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alertApiError(e, 'admin-users-status');
    }
  };

  const resetPassword = async (u: any) => {
    if (!u?.email) {
      toast.error(tx("Ce compte n'a pas d'adresse email."));
      return;
    }
    try {
      const r = await authApi.forgotPassword(u.email);
      toast.success(r?.message ?? tr(`Lien de réinitialisation envoyé à ${u.email}.`, `Reset link sent to ${u.email}.`));
    } catch (e) {
      alertApiError(e, 'admin-users-reset');
    }
  };

  /* ---------- création d'un utilisateur (POST /admin/users) ---------- */
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'client' | 'livreur' | 'manager'>('client');
  const [newZone, setNewZone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [uploadLabel, setUploadLabel] = useState('Cliquez pour importer les documents ou glissez-les ici');
  const [creating, setCreating] = useState(false);
  const openAdd = () => {
    setStep(1);
    setNewName('');
    setNewRole('client');
    setNewZone('');
    setNewEmail('');
    setNewPhone('');
    setUploadLabel('Cliquez pour importer les documents ou glissez-les ici');
    setAddOpen(true);
  };
  const needsZone = newRole === 'livreur' || newRole === 'manager';

  const validateStep1 = (): string | null => {
    const parts = newName.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return tx("Indiquez le prénom et le nom (ex : Sègla Hounkpati).");
    if (!/^\S+@\S+\.\S+$/.test(newEmail.trim())) return tx("L'adresse email est obligatoire (connexion et définition du mot de passe).");
    if (!/^\d{8,10}$/.test(newPhone.replace(/\D/g, ''))) return tx('Le téléphone doit comporter 8 à 10 chiffres.');
    if (needsZone && !newZone) return tx('Choisissez la zone du livreur ou du manager.');
    return null;
  };

  const createUser = async (e?: FormEvent) => {
    e?.preventDefault();
    const problem = validateStep1();
    if (problem) {
      toast.error(problem);
      setStep(1);
      return;
    }
    const [prenom, ...rest] = newName.trim().split(/\s+/);
    const email = newEmail.trim();
    setCreating(true);
    try {
      await adminApi.createUser({
        prenom,
        nom: rest.join(' '),
        email,
        telephone: `229${newPhone.replace(/\D/g, '')}`, // même format que l'inscription
        password: randomPassword(), // provisoire : l'utilisateur définit le sien via le lien envoyé
        role: newRole,
        ...(needsZone && newZone ? { zone_id: Number(newZone) } : {}),
      });
      let lien = '';
      try {
        await authApi.forgotPassword(email);
        lien = tr(
        ` Un lien pour définir le mot de passe a été envoyé à ${email}.`,
        ` A link to set the password was sent to ${email}.`,
      );
      } catch (err2) {
        const detail = formatApiError(extractApiError(err2));
        lien = tr(` Envoi du lien impossible : ${detail}`, ` Could not send the link: ${detail}`);
      }
      const roleLabel = ROLE_UI[newRole].label;
      toast.success(tr(`Compte ${roleLabel.toLowerCase()} créé.${lien}`, `${tx(roleLabel)} account created.${lien}`), { duration: 7000 });
      setAddOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e2) {
      alertApiError(e2, 'admin-users-create');
    } finally {
      setCreating(false);
    }
  };

  const onStep1Submit = () => {
    const problem = validateStep1();
    if (problem) {
      toast.error(problem);
      return;
    }
    if (newRole === 'livreur') setStep(2);
    else void createUser();
  };

  const selStatut = STATUT_UI[statutOf(selected)] ?? { label: String(selected?.statut ?? '—'), badge: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400' };
  const selUi = ROLE_UI[selRole] ?? ROLE_UI.client;
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - current) <= 1);

  return (
    <AdminLayout currentPath="/admin/utilisateurs">
      {err && (
        <div className="m-lg rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Erreur API")}</p>
          <p>{err}</p>
        </div>
      )}
      {loading && <p className="m-lg text-label text-text-secondary">{tx("Chargement des données réelles…")}</p>}
      <style>{DESIGN_CSS}</style>
      <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">{tx("Administration Centrale")}</span>
          <span className="text-gray-300">/</span>
          <span className="text-xs text-primary font-semibold">{tx("Gestion des Utilisateurs")}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              id="searchInput"
              placeholder={tx("Rechercher nom, email, tél...")}
              type="text"
              value={search}
              onChange={(e) => choose(() => setSearch(e.target.value))}
            />
          </div>
          <div className="h-4 w-px bg-gray-200"></div>
          <AdminNotificationBell
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            icon={<i className="ti ti-bell text-lg"></i>}
          />
          <button
            className="btn-press bg-primary hover:bg-primary-hover text-white text-xs font-medium px-3.5 py-2 rounded-[10px] flex items-center gap-1.5 shadow-sm transition-all"
            type="button"
            onClick={openAdd}
          >
            <i className="ti ti-user-plus text-sm"></i>
            <span>{tx("Ajouter un utilisateur")}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{tx("Gestion des Utilisateurs")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tx("Supervisez, modifiez les rôles et gérez les comptes des clients, coursiers, managers et administrateurs.")}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button className="btn-press px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-[10px] flex items-center gap-1.5 transition-all" type="button" onClick={exportCsv}>
              <i className="ti ti-download text-sm"></i>
              <span>{tx("Exporter CSV")}</span>
            </button>
            <button className="btn-press px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-[10px] flex items-center gap-1.5 transition-all" type="button" onClick={resetAndReload}>
              <i className="ti ti-refresh text-sm"></i>
              <span>{tx("Actualiser")}</span>
            </button>
          </div>
        </div>

        {/* Statistiques réelles (comptes chargés) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-[14px] border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-primary flex items-center justify-center text-xl shrink-0">
              <i className="ti ti-users"></i>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{tx("Total Utilisateurs")}</p>
              <h3 className="text-xl font-bold text-gray-900 mt-0.5">{fmt(stats.total)}</h3>
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                <i className="ti ti-circle-check"></i> {fmt(stats.actifs)} comptes actifs
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-[14px] border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
              <i className="ti ti-shopping-cart"></i>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{tx("Clients")}</p>
              <h3 className="text-xl font-bold text-gray-900 mt-0.5">{fmt(stats.client)}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {stats.total ? `${Math.round((stats.client / stats.total) * 100)}% des comptes` : '—'}
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-[14px] border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
              <i className="ti ti-motorbike"></i>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{tx("Livreurs")}</p>
              <h3 className="text-xl font-bold text-gray-900 mt-0.5">{fmt(stats.livreur)}</h3>
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> {fmt(stats.livreursDispo)} disponibles
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-[14px] border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
              <i className="ti ti-shield-check"></i>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{tx("Managers &amp; Admins")}</p>
              <h3 className="text-xl font-bold text-gray-900 mt-0.5">{fmt(stats.manager + stats.admin)}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {fmt(stats.manager)} managers · {fmt(stats.admin)} admins
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" id="roleFilters">
              {(
                [
                  ['all', `Tous (${fmt(stats.total)})`],
                  ['client', `Clients (${fmt(stats.client)})`],
                  ['livreur', `Livreurs (${fmt(stats.livreur)})`],
                  ['manager', `Managers (${fmt(stats.manager)})`],
                  ['admin', `Admins (${fmt(stats.admin)})`],
                ] as [RoleTab, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" className={roleTab === id ? TAB_ACTIVE : TAB_IDLE} onClick={() => choose(() => setRoleTab(id))}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">{tx("Statut :")}</span>
                <select
                  className="text-xs bg-white border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary"
                  id="statusFilter"
                  value={statusF}
                  onChange={(e) => choose(() => setStatusF(e.target.value))}
                >
                  <option value="all">{tx("Tous les statuts")}</option>
                  <option value="actif">{tx("Actifs")}</option>
                  <option value="inactif">Inactifs</option>
                  <option value="suspendu">Suspendus</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">{tx("Zone :")}</span>
                <select
                  className="text-xs bg-white border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary"
                  id="zoneFilter"
                  value={zoneF}
                  onChange={(e) => choose(() => setZoneF(e.target.value))}
                >
                  <option value="all">{tx("Toutes les zones")}</option>
                  {zones.map((z) => (
                    <option key={z.id} value={String(z.id)}>
                      {z.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="usersTable">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{tx("Utilisateur")}</th>
                  <th className="py-3 px-4">{tx("Rôle")}</th>
                  <th className="py-3 px-4">{tx("Téléphone &amp; WhatsApp")}</th>
                  <th className="py-3 px-4">{tx("Zone Principale")}</th>
                  <th className="py-3 px-4">{tx("Statut")}</th>
                  <th className="py-3 px-4">{tx("Activité")}</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs" id="tableBody">
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-gray-500">
                      {tx("Aucun utilisateur ne correspond à ces filtres.")}
                    </td>
                  </tr>
                )}
                {visible.map((u: any) => {
                  const nom = nomOf(u);
                  const role = roleOf(u);
                  const rui = ROLE_UI[role] ?? ROLE_UI.client;
                  const sui = STATUT_UI[statutOf(u)] ?? { label: String(u.statut ?? '—'), badge: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400' };
                  const cmds = commandesOf(u);
                  const suspendu = statutOf(u) === 'suspendu';
                  return (
                    <tr key={u.id} className="user-row hover:bg-orange-50/30 transition-colors cursor-pointer" onClick={() => openUser(u)}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${rui.av}`}>{initials(nom)}</div>
                          <div>
                            <Link to="/admin/utilisateurs/detail" search={{ id: u.id }} onClick={(e) => e.stopPropagation()} className="font-semibold text-gray-900 hover:text-primary">
                              {nom}
                            </Link>
                            <p className="text-gray-500">{u.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${rui.badge}`}>
                          <i className={rui.icon}></i> {tx(rui.label)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700">{u.telephone ?? '—'}</td>
                      <td className="py-3 px-4 text-gray-700">{zoneNom(u.profil?.zone ?? u.zone)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${sui.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sui.dot}`}></span> {tx(sui.label)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{cmds != null ? `${fmt(cmds)} commande${cmds > 1 ? 's' : ''}` : '—'}</td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-orange-50 transition-colors" onClick={() => openUser(u)} title={tx("Modifier")}>
                            <i className="ti ti-edit text-sm"></i>
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            onClick={() => toggleStatus(u)}
                            title={suspendu ? tx("Réactiver") : 'Suspendre'}
                          >
                            <i className={suspendu ? 'ti ti-lock-open text-sm' : 'ti ti-lock text-sm'}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 bg-gray-50/50">
            <p>
              {filtered.length === 0 ? (
                tx("Aucun utilisateur")
              ) : (
                <>
                  {tx("Affichage de")} <span className="font-semibold text-gray-800">{fmt((current - 1) * PER_PAGE + 1)}</span> à{' '}
                  <span className="font-semibold text-gray-800">{fmt(Math.min(current * PER_PAGE, filtered.length))}</span> sur{' '}
                  <span className="font-semibold text-gray-800">{fmt(filtered.length)}</span> utilisateurs
                  {capped ? ' (500 premiers comptes)' : ''}
                </>
              )}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              >
                <i className="ti ti-chevron-left text-xs"></i>
              </button>
              {pageNumbers.map((n, i) => (
                <span key={n} className="flex items-center gap-1">
                  {i > 0 && n - pageNumbers[i - 1] > 1 && <span className="px-1 text-gray-400">...</span>}
                  <button
                    type="button"
                    className={n === current ? 'px-3 py-1.5 rounded-lg bg-primary text-white font-semibold' : 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
              >
                <i className="ti ti-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fiche utilisateur — valeurs réelles ; statut / zone / disponibilité modifiables (PUT /admin/users/{id}) */}
      <div
        className={`fixed inset-0 bg-black/50 z-50 ${selected ? 'active' : 'hidden'} items-center justify-center p-4 backdrop-blur-xs`}
        id="userModal"
        onClick={() => setSelected(null)}
      >
        {selected && (
          <div className="bg-white rounded-[16px] shadow-2xl max-w-[512px] w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-primary font-bold flex items-center justify-center text-sm" id="modalAvatar">
                  {initials(nomOf(selected))}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900" id="modalName">
                    {nomOf(selected)}
                  </h3>
                  <p className="text-xs font-medium text-amber-700" id="modalRoleBadge">
                    {tx(selUi.label)} · {tx("Plateforme TOKPa")}
                  </p>
                </div>
              </div>
              <button type="button" className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors" onClick={() => setSelected(null)}>
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-medium">{tx("Adresse Email")}</span>
                  <span className="font-semibold text-gray-800 text-sm mt-0.5 block truncate" id="modalEmail">
                    {selected.email ?? '—'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-medium">{tx("Numéro de téléphone")}</span>
                  <span className="font-semibold text-gray-800 text-sm mt-0.5 block font-mono" id="modalPhone">
                    {selected.telephone ?? '—'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-medium">{tx("Zone d'assignation")}</span>
                  {hasZone ? (
                    <select
                      className="mt-1 w-full text-xs bg-white border border-gray-200 text-gray-800 font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
                      value={editZone}
                      onChange={(e) => setEditZone(e.target.value)}
                    >
                      <option value="">{tx("— Aucune —")}</option>
                      {zones.map((z) => (
                        <option key={z.id} value={String(z.id)}>
                          {z.nom}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-semibold text-gray-800 mt-0.5 block" id="modalZone">
                      {zoneNom(selected.profil?.zone ?? selected.zone)}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-medium">{tx("Statut du compte")}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${selStatut.badge}`} id="modalStatus">
                      <span className={`w-1.5 h-1.5 rounded-full ${selStatut.dot}`}></span> {tx(selStatut.label)}
                    </span>
                    <select
                      className="flex-1 text-xs bg-white border border-gray-200 text-gray-800 rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
                      value={editStatut}
                      onChange={(e) => setEditStatut(e.target.value)}
                      aria-label={tx("Nouveau statut")}
                    >
                      <option value="actif">{tx("Actif")}</option>
                      <option value="inactif">{tx("Inactif")}</option>
                      <option value="suspendu">{tx("Suspendu")}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-3.5 bg-orange-50/50 rounded-xl border border-orange-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Statistiques &amp; Performance</span>
                  <span className="font-bold text-primary" id="modalStats">
                    {commandesOf(selected) != null ? `${fmt(commandesOf(selected)!)} commande(s)` : '—'}
                  </span>
                </div>
                {selRole === 'livreur' && (
                  <label className="flex items-center justify-between text-[11px] text-gray-600 pt-1">
                    <span>{tx("Disponible pour les livraisons")}</span>
                    <input type="checkbox" checked={editDispo} onChange={(e) => setEditDispo(e.target.checked)} className="accent-primary" />
                  </label>
                )}
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <label className="font-medium text-gray-700 block">Actions administratives :</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-press flex-1 py-2 px-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-[10px] flex items-center justify-center gap-1.5 transition-all"
                    onClick={() => resetPassword(selected)}
                  >
                    <i className="ti ti-key text-sm"></i>
                    <span>{tx("Réinitialiser mot de passe")}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-press flex-1 py-2 px-3 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 font-medium rounded-[10px] flex items-center justify-center gap-1.5 transition-all"
                    onClick={() => toggleStatus(selected)}
                  >
                    <i className={statutOf(selected) === 'suspendu' ? 'ti ti-lock-open text-sm' : 'ti ti-lock text-sm'}></i>
                    <span>{statutOf(selected) === 'suspendu' ? tx("Réactiver l'accès") : "Suspendre l'accès"}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2.5">
              <button type="button" className="btn-press px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-[10px] hover:bg-gray-100 transition-all" onClick={() => setSelected(null)}>
                {tx("Fermer")}
              </button>
              <button
                type="button"
                disabled={saving}
                className="btn-press px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-[10px] shadow-sm transition-all disabled:opacity-60"
                onClick={saveUser}
              >
                {saving ? 'Enregistrement…' : tx("Enregistrer les modifications")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ajout d'un utilisateur — POST /admin/users */}
      <div
        className={`fixed inset-0 bg-black/50 z-50 ${addOpen ? 'active' : 'hidden'} items-center justify-center p-4 backdrop-blur-xs overflow-y-auto`}
        id="addUserModal"
        onClick={() => setAddOpen(false)}
      >
        <div className="bg-white rounded-[16px] shadow-2xl max-w-[576px] w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150 my-8" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-primary flex items-center justify-center text-lg border border-orange-200">
                <i className="ti ti-user-plus"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{tx("Ajouter un nouvel utilisateur")}</h3>
                <p className="text-xs text-gray-500">{tx("Créez un compte pour un client, un manager ou un livreur")}</p>
              </div>
            </div>
            <button type="button" className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors" onClick={() => setAddOpen(false)}>
              <i className="ti ti-x text-lg"></i>
            </button>
          </div>
          <div className="px-6 pt-4 pb-3 border-b border-gray-100 bg-white">
            <div className="flex items-center">
              <div className="flex items-center gap-2 cursor-pointer" id="stepperStep1" onClick={() => setStep(1)}>
                <div
                  className={
                    step === 2
                      ? 'w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-xs'
                      : 'w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-xs'
                  }
                  id="stepperBadge1"
                >
                  {step === 2 ? <i className="ti ti-check"></i> : '1'}
                </div>
                <div className="text-left">
                  <span className={step === 2 ? 'text-xs font-semibold text-emerald-700 block leading-tight' : 'text-xs font-semibold text-primary block leading-tight'} id="stepperText1">
                    {tx("Informations générales")}
                  </span>
                  <span className="text-[10px] text-gray-400 block leading-tight">{tx("Identité &amp; profil")}</span>
                </div>
              </div>
              <div className={`${newRole === 'livreur' ? '' : 'hidden'} flex-1 mx-4 h-0.5 bg-gray-200 transition-all`} id="stepperDivider"></div>
              <div className={`${newRole === 'livreur' ? 'flex' : 'hidden'} items-center gap-2 transition-all`} id="stepperStep2">
                <div
                  className={
                    step === 2
                      ? 'w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-xs'
                      : 'w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold border border-gray-200'
                  }
                  id="stepperBadge2"
                >
                  2
                </div>
                <div className="text-left">
                  <span className={step === 2 ? 'text-xs font-semibold text-primary block leading-tight' : 'text-xs font-medium text-gray-500 block leading-tight'} id="stepperText2">
                    {tx("Dossier &amp; Conformité")}
                  </span>
                  <span className="text-[10px] text-gray-400 block leading-tight">{tx("Permis, CIP &amp; Véhicule")}</span>
                </div>
              </div>
            </div>
          </div>
          <form id="addUserForm" onSubmit={createUser}>
            <div className={`${step === 1 ? '' : 'hidden'} p-6 space-y-4 text-xs`} id="step1Container">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {tx("Nom complet")} <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-900 transition-all placeholder:text-gray-400"
                  id="newUserName"
                  placeholder={tx("Ex: Sègla Hounkpati")}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {tx("Rôle plateforme")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-900 transition-all"
                    id="newUserRole"
                    value={newRole}
                    onChange={(e) => {
                      setNewRole(e.target.value as 'client' | 'livreur' | 'manager');
                      setStep(1);
                    }}
                  >
                    <option value="client">{tx("Client")}</option>
                    <option value="livreur">{tx("Livreur")}</option>
                    <option value="manager">{tx("Manager de Zone")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {tx("Zone géographique")} {needsZone && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-900 transition-all"
                    id="newUserZone"
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value)}
                  >
                    <option value="">{needsZone ? tx("— Choisir une zone —") : tx("— Aucune —")}</option>
                    {zones.map((z) => (
                      <option key={z.id} value={String(z.id)}>
                        {z.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {tx("Adresse Email")} <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-900 transition-all placeholder:text-gray-400"
                  id="newUserEmail"
                  placeholder="utilisateur@tokpa.bj ou perso@gmail.com"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {tx("Numéro de Téléphone / WhatsApp béninois")} <span className="text-red-500">*</span>
                </label>
                <div className="flex shadow-xs rounded-[10px]">
                  <span className="inline-flex items-center px-3 rounded-l-[10px] border border-r-0 border-gray-200 bg-gray-50 text-gray-700 font-mono font-medium text-xs">🇧🇯 +229</span>
                  <input
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-r-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono text-gray-900 transition-all placeholder:text-gray-400"
                    id="newUserPhone"
                    placeholder="97 12 34 56"
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{tx("Un lien pour définir son mot de passe sera envoyé à l'adresse email.")}</p>
              </div>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <button type="button" className="btn-press px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-[10px] hover:bg-gray-100 transition-all" onClick={() => setAddOpen(false)}>
                  {tx("Annuler")}
                </button>
                <button
                  type="button"
                  disabled={creating}
                  className="btn-press px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-[10px] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60"
                  id="step1SubmitBtn"
                  onClick={onStep1Submit}
                >
                  <span>{newRole === 'livreur' ? tx("Continuer vers Documents (Étape 2) →") : creating ? 'Création…' : "Créer l'utilisateur"}</span>
                </button>
              </div>
            </div>

            {/* Étape 2 « Dossier & Conformité » — aucun champ côté backend : laissée telle quelle (P3), non transmise. */}
            <div className={`${step === 2 ? '' : 'hidden'} p-6 space-y-4 text-xs`} id="step2Container">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-800 flex items-center justify-center shrink-0 text-base mt-0.5">
                  <i className="ti ti-shield-alert"></i>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900">{tx("Documents &amp; Conformité du Livreur")}</h4>
                  <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">{tx("Vérification obligatoire selon les normes ANIP &amp; ANATT Bénin pour l'autorisation de livraison marché.")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {tx("Numéro CIP / NPI ANIP Bénin (10 chiffres)")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono text-gray-900 placeholder:text-gray-400"
                    id="livreurCip"
                    maxLength={10}
                    placeholder="Ex: 1048291048"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {tx("Numéro de Permis de conduire")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono text-gray-900 placeholder:text-gray-400"
                    id="livreurPermis"
                    placeholder="Ex: BJ-2023-A1-4921"
                    type="text"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {tx("Catégorie de véhicule")} <span className="text-red-500">*</span>
                  </label>
                  <select className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-900" id="livreurVehiculeType">
                    <option value="moto">{tx("Moto 2 roues (Zémidjan / Express)")}</option>
                    <option value="tricycle">Tricycle fret Dantokpa</option>
                    <option value="utilitaire">{tx("Utilitaire léger / Fourgonnette")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {tx("Plaque d'immatriculation béninoise")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono text-gray-900 placeholder:text-gray-400"
                    id="livreurPlaque"
                    placeholder="Ex: 2A 9402 RB"
                    type="text"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5">{tx("Pièces justificatives requises (CIP/CNI, Permis, Résidence)")}</label>
                <div className="border-2 border-dashed border-gray-200 hover:border-primary/50 rounded-xl p-4 bg-gray-50/60 hover:bg-orange-50/20 transition-all text-center cursor-pointer">
                  <input
                    className="hidden"
                    id="livreurDocsInput"
                    multiple={true}
                    type="file"
                    onChange={(e) =>
                      setUploadLabel(
                        e.target.files && e.target.files.length > 0
                          ? tr(`${e.target.files.length} document(s) sélectionné(s)`, `${e.target.files.length} document(s) selected`)
                          : tx('Cliquez pour importer les documents ou glissez-les ici'),
                      )
                    }
                  />
                  <label className="cursor-pointer block" htmlFor="livreurDocsInput">
                    <div className="w-10 h-10 rounded-full bg-orange-100/70 text-primary mx-auto flex items-center justify-center text-lg mb-2">
                      <i className="ti ti-cloud-upload"></i>
                    </div>
                    <p className="text-xs font-semibold text-gray-700" id="uploadLabelText">
                      {uploadLabel}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{tx("Formats acceptés : PDF, PNG, JPG (Max 5 Mo / fichier)")}</p>
                    <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <i className="ti ti-file-check text-emerald-600"></i> Carte CIP / NPI
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <i className="ti ti-id text-emerald-600"></i> Permis A1/B
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <i className="ti ti-home-check text-emerald-600"></i> {tx("Certificat résidence")}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <button type="button" className="btn-press px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-[10px] hover:bg-gray-100 transition-all flex items-center gap-1.5" onClick={() => setStep(1)}>
                  <i className="ti ti-arrow-left text-xs"></i>
                  <span>{tx("Retour aux informations")}</span>
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-press px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-[10px] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60"
                >
                  <i className="ti ti-check text-sm"></i>
                  <span>{creating ? tx("Création…") : 'Valider & Enregistrer le livreur'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
