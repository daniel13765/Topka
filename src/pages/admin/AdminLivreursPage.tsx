import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import { fmtFcfa, listOf, unwrap } from '../../services/api/unwrap';
import { zoneNom, initials } from '../../services/api/useLiveRows';
import { alertApiError } from '../../utils/apiError';
import { statutLivreur } from '../../utils/riderStatus';
import {
  FILTRE_NEUTRE,
  commandesAssignables,
  decrirePosition,
  disponibleDe,
  estUrl,
  filtrerLivreurs,
  kpiLivreurs,
  lienCarte,
  piecesDe,
  positionDe,
  vehiculeDe,
  zoneIdDe,
} from '../../utils/adminLivreurs';
// Les pieces justificatives ont une seule forme en base (`livreurs.documents`) : la lire avec les
// regles du livreur evite que l'administration et l'agent ne voient pas la meme chose.
import { pieceValidee } from '../../pages/livreur/parametres/profilUtils';
import { absImageUrl } from '../../utils/imageUrl';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import FaIcon from '../../components/shared/FaIcon';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DESIGN_CSS = `
        .sidebar-item-active { background-color: #fea619 !important; color: #684000 !important; font-weight: 700; border-radius: 0.5rem; }
    `;

const PER_PAGE = 10;
const MAX_PAGES = 25;

const ilYa = (iso?: string | null) => {
  if (!iso) return '—';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return tr(`Il y a ${Math.max(1, min)}m`, `${Math.max(1, min)}m ago`);
  const h = Math.round(min / 60);
  return h < 48 ? tr(`Il y a ${h}h`, `${h}h ago`) : tr(`Il y a ${Math.round(h / 24)} j`, `${Math.round(h / 24)}d ago`);
};

const ACTIVITE: Record<string, string> = {
  livre: 'Livraison',
  en_livraison: 'En livraison',
  en_preparation: 'Prise en charge',
  en_attente: 'Assignée',
  annule: 'Annulée',
};

/**
 * AdminLivreursPage — design Stitch (code.html) conservé, données et actions RÉELLES :
 * GET /admin/users?role=livreur (toutes les pages), GET /admin/orders (au plus 500 commandes :
 * activité, taux de succès = livrées / (livrées + annulées), course en cours), GET /admin/zones,
 * PUT /admin/users/{id} (zone, disponibilité, statut), DELETE /admin/users/{id} (désactivation).
 * - POST /admin/assign (assigner une commande `en_attente` a ce livreur ; 422 du backend affiche tel quel).
 *
 * Ce que le backend ne permet pas, et que l'ecran dit au lieu de le simuler : le NOM du vehicule
 * (`livreurs.id_vehicule` est un numero nu, aucune route ne sert la table `vehicules`), l'heure de la
 * derniere position (aucune colonne `position_*_at`), la validation des pieces (`documents` n'est
 * ecritable que par le livreur via `PUT /profile`), et les horaires du livreur (cols absentes de
 * `livreurs`, `heure_debut`/`heure_fin` appliques au seul manager par AdminUserController::update).
 */
export default function AdminLivreursPage() {
  useLanguage();
  const [livreurs, setLivreurs] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [zones, setZones] = useState<{ id: number; nom: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    const allPages = async (fetch: (page: number) => Promise<any>) => {
      const acc: any[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await fetch(page);
        acc.push(...listOf(res));
        if (page >= Number(res?.meta?.last_page ?? 1)) break;
      }
      return acc;
    };
    Promise.all([
      allPages((page) => adminApi.getUsers({ role: 'livreur', page })),
      allPages((page) => adminApi.getOrders({ page })).catch((e) => {
        alertApiError(e, 'admin-livreurs-orders');
        return [];
      }),
    ])
      .then(([ls, os]) => {
        if (!alive) return;
        setLivreurs(ls);
        setOrders(os.map((r: any) => r?.data ?? r)); // OrderResource enveloppe chaque commande
      })
      .catch((e) => alive && setErr(alertApiError(e, 'admin-livreurs')))
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

  // Commandes par livreur (activité, taux de succès, course en cours)
  const parLivreur = useMemo(() => {
    const m = new Map<number, any[]>();
    orders.forEach((o) => {
      const id = Number(o?.livreur?.id);
      if (!id) return;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(o);
    });
    return m;
  }, [orders]);
  const perf = (id: number) => {
    const os = parLivreur.get(id) ?? [];
    const livrees = os.filter((o) => o.statut === 'livre').length;
    const annulees = os.filter((o) => o.statut === 'annule').length;
    const termines = livrees + annulees;
    return termines > 0 ? Math.round((livrees / termines) * 100) : null;
  };
  const enCourse = (id: number) => (parLivreur.get(id) ?? []).some((o) => o.statut === 'en_livraison');

  // Filtre LOCAL : `GET /admin/users` ne lit que `role` et `page`, rien n'est renvoye au serveur.
  const [filtre, setFiltre] = useState({ ...FILTRE_NEUTRE });
  const [assignOuvert, setAssignOuvert] = useState(false);
  const [choixCommande, setChoixCommande] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const filtres = filtrerLivreurs(livreurs, filtre, enCourse);
  const kpi = kpiLivreurs(livreurs, enCourse);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(filtres.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = filtres.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const filtreActif = filtre.recherche !== '' || filtre.zone !== '' || filtre.etat !== 'tous' || filtre.pieces !== 'tous';

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const selected = livreurs.find((l) => Number(l.id) === selectedId) ?? (panelOpen ? livreurs[0] : undefined) ?? null;
  const [editing, setEditing] = useState(false);
  const [editZone, setEditZone] = useState('');
  const [editDispo, setEditDispo] = useState(false);
  const [editStatut, setEditStatut] = useState('actif');
  const [saving, setSaving] = useState(false);

  const openDetails = (l: any, edit = false) => {
    setSelectedId(Number(l.id));
    setPanelOpen(true);
    setEditing(edit);
    setEditZone(String(l?.profil?.zone_id ?? l?.profil?.zone?.id ?? ''));
    setEditDispo(Boolean(l?.profil?.disponibilite));
    setEditStatut(String(l?.statut ?? 'actif').toLowerCase());
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.updateUser(Number(selected.id), {
        statut: editStatut,
        disponibilite: editDispo,
        ...(editZone ? { zone_id: Number(editZone) } : {}),
      });
      toast.success(tx("Livreur mis à jour."));
      setEditing(false);
      reload();
    } catch (e) {
      alertApiError(e, 'admin-livreurs-save');
    } finally {
      setSaving(false);
    }
  };

  const desactiver = async (l: any) => {
    const nom = l.nom_complet ?? '—';
    if (!confirm(tr(`Désactiver le compte du livreur ${nom} ? Il ne pourra plus se connecter.`, `Deactivate rider ${nom}? They will no longer be able to log in.`))) return;
    try {
      const r = await adminApi.deleteUser(Number(l.id));
      toast.success(r?.message ?? tx("Utilisateur désactivé."));
      reload();
    } catch (e) {
      alertApiError(e, 'admin-livreurs-delete');
    }
  };

  const assigner = async () => {
    if (!selected || !choixCommande) return;
    setAssignSaving(true);
    try {
      await adminApi.assignLivreur(Number(choixCommande), Number(selected.id));
      toast.success(
        tr(
          `Commande #${choixCommande} assignée à ${selNom}.`,
          `Order #${choixCommande} assigned to ${selNom}.`,
        ),
        { id: 'admin-livreurs-assign' },
      );
      setAssignOuvert(false);
      setChoixCommande('');
      reload();
    } catch (e) {
      // 422 du backend (livreur non disponible, hors zone, commande déjà prise) : message affiche tel quel.
      alertApiError(e, 'admin-livreurs-assign');
    } finally {
      setAssignSaving(false);
    }
  };

  const selNom = selected?.nom_complet ?? '—';
  const selPerf = selected ? perf(Number(selected.id)) : null;
  const selStatut = selected ? statutLivreur(selected, enCourse(Number(selected.id))) : null;
  const selActivites = selected ? (parLivreur.get(Number(selected.id)) ?? []).slice(0, 3) : [];
  const selPhoto = absImageUrl(selected?.image_profil);
  const selPosition = selected ? positionDe(selected) : null;
  const selPieces = selected ? piecesDe(selected) : { connues: false, pieces: [] };
  const selVehicule = selected ? vehiculeDe(selected) : { id: null };
  const selDispo = selected ? disponibleDe(selected) : null;
  const selZone = selected ? zoneIdDe(selected) : null;
  // Meme filtre que le backend : seule une commande `en_attente` sans livreur se laisse affecter, et
  // `ManagerAssignmentController` compare la zone du repere de la commande a celle du livreur.
  const assignablesBruts = commandesAssignables(orders);
  const assignables = assignablesBruts.filter((o) => {
    const z = o?.landmark?.zone_id;
    return selZone == null ? z == null : Number(z) === selZone;
  });

  return (
    <AdminLayout currentPath="/admin/livreurs" mainClassName="ml-64 h-screen pt-[52px] p-lg flex gap-lg overflow-hidden">
      {err && (
        <div className="m-lg rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Erreur API")}</p>
          <p>{err}</p>
        </div>
      )}
      {loading && <p className="m-lg text-label text-text-secondary">{tx("Chargement des données réelles…")}</p>}
      <style>{DESIGN_CSS}</style>
      <div className="m-lg mb-0 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { cle: 'total', titre: tx("Livreurs reçus"), valeur: String(kpi.total), note: tx("sur GET /admin/users?role=livreur") },
          { cle: 'ligne', titre: tx("Disponibles"), valeur: kpi.enLigne == null ? '—' : `${kpi.enLigne}`, note: tx("livreurs.disponibilite = true") },
          { cle: 'course', titre: tx("En course"), valeur: `${kpi.enCourseNombre}`, note: tr(`sur ${orders.length} commande(s) lues`, `from ${orders.length} orders read`) },
          { cle: 'pieces', titre: tx("Avec pièces au dossier"), valeur: `${kpi.avecPieces}`, note: tx("livreurs.documents, non validables ici") },
        ].map((k) => (
          <div key={k.cle} className="rounded-lg border border-border-default bg-white p-md">
            <p className="font-label text-label uppercase tracking-wider text-text-secondary">{k.titre}</p>
            <p className="font-h2 text-h2">{k.valeur}</p>
            <p className="text-micro text-text-secondary">{k.note}</p>
          </div>
        ))}
      </div>
      <div className="mx-lg mt-md flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-border-default bg-white px-3 py-1.5">
          <FaIcon name="search" className="text-[18px] text-text-secondary" />
          <input
            className="w-44 bg-transparent text-label outline-none"
            placeholder={tx("Nom, téléphone ou e-mail")}
            value={filtre.recherche}
            onChange={(e) => { setPage(1); setFiltre({ ...filtre, recherche: e.target.value }); }}
          />
        </label>
        <select
          className="rounded-lg border border-border-default bg-white px-2 py-1.5 text-label"
          value={filtre.etat}
          onChange={(e) => { setPage(1); setFiltre({ ...filtre, etat: e.target.value as typeof filtre.etat }); }}
        >
          <option value="tous">{tx("État : tous")}</option>
          <option value="en_ligne">{tx("En ligne")}</option>
          <option value="hors_ligne">{tx("Hors ligne")}</option>
          <option value="en_course">{tx("En course")}</option>
        </select>
        <select
          className="rounded-lg border border-border-default bg-white px-2 py-1.5 text-label"
          value={filtre.zone}
          onChange={(e) => { setPage(1); setFiltre({ ...filtre, zone: e.target.value }); }}
        >
          <option value="">{tx("Zone : toutes")}</option>
          {zones.map((z) => (
            <option key={z.id} value={String(z.id)}>{z.nom}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-border-default bg-white px-2 py-1.5 text-label"
          value={filtre.pieces}
          onChange={(e) => { setPage(1); setFiltre({ ...filtre, pieces: e.target.value as typeof filtre.pieces }); }}
        >
          <option value="tous">{tx("Pièces : toutes")}</option>
          <option value="avec">{tx("Avec pièces")}</option>
          <option value="sans">{tx("Sans pièce")}</option>
        </select>
        {filtreActif && (
          <button
            type="button"
            className="rounded-lg border border-border-default bg-white px-3 py-1.5 text-label hover:bg-surface transition-colors"
            onClick={() => { setPage(1); setFiltre({ ...FILTRE_NEUTRE }); }}
          >
            {tx("Réinitialiser le filtre")}
          </button>
        )}
        <span className="text-micro text-text-secondary">
          {tr(`Filtrage local : la route ne lit que role et page — ${filtres.length} ligne(s) affichée(s) sur ${livreurs.length} reçue(s)`, `Local filtering: the route reads only role and page — ${filtres.length} of ${livreurs.length} received rows shown`)}
        </span>
      </div>
      <div className="flex-1 m-lg mt-md bg-white rounded-lg border border-border-default overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-bg-secondary border-b border-border-default">
              <tr>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider">{tx("Nom")}</th>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider">ID</th>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider">Zone</th>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider">{tx("Statut")}</th>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider">{tx("Pièces")}</th>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider">{tx("Dernière position")}</th>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider">{tx("Succès (%)")}</th>
                <th className="px-md py-4 font-label text-text-secondary uppercase text-xs tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {!loading && livreurs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-md py-6 text-center text-text-secondary">
                    {tx("Aucun livreur enregistré.")}
                  </td>
                </tr>
              )}
              {visible.map((l: any) => {
                const nom = l.nom_complet ?? '—';
                const st = statutLivreur(l, enCourse(Number(l.id)));
                const pct = perf(Number(l.id));
                return (
                  <tr key={l.id} className="hover:bg-primary-tint transition-colors cursor-pointer group" onClick={() => openDetails(l)}>
                    <td className="px-md py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-border-default bg-surface-variant flex items-center justify-center font-label text-label text-text-secondary">
                          {initials(nom)}
                        </div>
                        <span className="font-h3 text-h3">{nom}</span>
                      </div>
                    </td>
                    <td className="px-md py-4 font-body text-text-secondary">#{l.id}</td>
                    <td className="px-md py-4 font-body text-text-secondary">{zoneNom(l.profil?.zone ?? l.zone)}</td>
                    <td className="px-md py-4 font-body text-text-secondary">{(() => {
                      const dossier = piecesDe(l);
                      if (!dossier.connues) return <span title={tx("livreurs.documents n’a pas été renvoyé par l’API")}>{'—'}</span>;
                      return dossier.pieces.length > 0
                        ? <span className="inline-flex items-center gap-1 font-bold text-success">{dossier.pieces.length}</span>
                        : <span className="text-text-tertiary">{tx("aucune")}</span>;
                    })()}</td>
                    <td className="px-md py-4 font-mono text-micro">{(() => {
                      const pos = positionDe(l);
                      if (!pos) return <span className="text-text-tertiary" title={tx("Aucune position transmise par POST /livreur/position")}>{'—'}</span>;
                      return (
                        <a
                          className="text-primary hover:underline"
                          href={lienCarte(pos)}
                          target="_blank"
                          rel="noreferrer noopener"
                          title={tx("Ouverture dans OpenStreetMap — la base ne stocke aucune heure de position")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {decrirePosition(pos)}
                        </a>
                      );
                    })()}</td>
                    <td className="px-md py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${st.badge}`}>
                        <span className={`w-2 h-2 rounded-full ${st.dot}`}></span>
                        {tx(st.label)}
                      </span>
                    </td>
                    <td className="px-md py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-border-default rounded-full overflow-hidden">
                          <div className="h-full bg-success" style={{ width: pct != null ? `${pct}%` : '0%' }}></div>
                        </div>
                        <span className="font-body text-success font-bold">{pct != null ? `${pct}%` : '—'}</span>
                      </div>
                    </td>
                    <td className="px-md py-4 text-right space-x-2">
                      <button
                        type="button"
                        className="p-2 hover:text-primary transition-colors"
                        title={tx("Modifier")}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(l, true);
                        }}
                      >
                        <FaIcon name="edit" className="text-[20px]" />
                      </button>
                      <button
                        type="button"
                        className="p-2 hover:text-error transition-colors"
                        title={tx("Désactiver")}
                        onClick={(e) => {
                          e.stopPropagation();
                          void desactiver(l);
                        }}
                      >
                        <FaIcon name="delete" className="text-[20px]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-auto p-md border-t border-border-default flex justify-between items-center bg-bg-secondary">
          <span className="text-secondary text-micro">
            {livreurs.length === 0
              ? tx("Aucun livreur")
              : tr(`Affichage de ${(current - 1) * PER_PAGE + 1} à ${Math.min(current * PER_PAGE, livreurs.length)} sur ${livreurs.length} livreurs`, `Showing ${(current - 1) * PER_PAGE + 1}–${Math.min(current * PER_PAGE, livreurs.length)} of ${livreurs.length} riders`)}
          </span>
          <div className="flex gap-2">
            <button type="button" className="px-3 py-1 border border-border-default rounded hover:bg-white transition-colors disabled:opacity-40" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              <FaIcon name="chevron_left" className="text-[18px] align-middle" />
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - current) <= 1 || n === 1 || n === pages)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  className={
                    n === current
                      ? 'px-3 py-1 border border-primary-container bg-primary-container text-white rounded text-label'
                      : 'px-3 py-1 border border-border-default rounded hover:bg-white transition-colors'
                  }
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
            <button type="button" className="px-3 py-1 border border-border-default rounded hover:bg-white transition-colors disabled:opacity-40" disabled={current >= pages} onClick={() => setPage(current + 1)}>
              <FaIcon name="chevron_right" className="text-[18px] align-middle" />
            </button>
          </div>
        </div>
      </div>
      {selected && (
        <aside className="w-80 bg-white rounded-lg border border-border-default flex flex-col p-lg transition-all transform translate-x-0 overflow-y-auto" id="detailPanel">
          <div className="flex justify-between items-start mb-lg">
            <h3 className="font-h2 text-h2 text-primary">{tx("Détails du Livreur")}</h3>
            <button
              type="button"
              className="text-text-secondary hover:text-text-main"
              onClick={() => {
                setPanelOpen(false);
                setSelectedId(null);
                setEditing(false);
              }}
            >
              <FaIcon name="close" />
            </button>
          </div>
          <div className="flex flex-col items-center mb-xl">
            <div className="relative mb-md">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-light bg-primary-tint flex items-center justify-center font-h2 text-h2 text-primary">
                {selPhoto ? <img className="w-full h-full object-cover" id="detailImg" src={selPhoto} alt={selNom} /> : initials(selNom)}
              </div>
              <div className={`absolute bottom-1 right-1 w-6 h-6 border-4 border-white rounded-full ${selStatut?.dot ?? 'bg-text-tertiary'}`} id="detailStatusDot"></div>
            </div>
            <h4 className="font-h2 text-h2 text-center" id="detailName">
              {selNom}
            </h4>
            <p className="text-text-secondary font-label" id="detailId">
              ID: #{selected.id} · {selStatut ? tx(selStatut.label) : ""}
            </p>
          </div>
          <div className="space-y-lg flex-1">
            <div className="p-md bg-bg-secondary rounded-lg border border-border-default">
              <p className="text-text-secondary text-micro uppercase mb-2">Performance Globale</p>
              <div className="flex justify-between items-end">
                <span className="font-h1 text-h1 text-success" id="detailSuccess">
                  {selPerf != null ? `${selPerf}%` : '—'}
                </span>
                <span className="text-text-secondary text-label">{tx("livrées / courses terminées")}</span>
              </div>
            </div>
            <div className="space-y-md">
              <div className="flex items-start gap-3">
                <FaIcon name="call" className="text-primary p-2 bg-primary-tint rounded-lg" />
                <div>
                  <p className="text-text-secondary text-micro">{tx("Téléphone")}</p>
                  <p className="font-body font-medium">{selected.telephone ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaIcon name="motorcycle" className="text-primary p-2 bg-primary-tint rounded-lg" />
                <div>
                  <p className="text-text-secondary text-micro">{tx("Véhicule")}</p>
                  <p className="font-body font-medium" id="detailVehicule">
                    {selVehicule.id ? tr(`Véhicule #${selVehicule.id}`, `Vehicle #${selVehicule.id}`) : tx("Aucun véhicule enregistré")}
                  </p>
                  <p className="text-micro text-text-tertiary">
                    {tx("La table `vehicules` (nom, type, immatriculation) n’est servie par aucune route : seul l’identifiant circule.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaIcon name="bolt" className="text-primary p-2 bg-primary-tint rounded-lg" />
                <div>
                  <p className="text-text-secondary text-micro">{tx("Disponibilité")}</p>
                  <p className="font-body font-medium" id="detailDispo">
                    {selDispo == null ? tx("Inconnue") : selDispo ? tx("Disponible") : tx("Indisponible")}
                  </p>
                  <p className="text-micro text-text-tertiary">
                    {tx("Modifiable ici et par le manager ; le livreur ne peut pas l’écrire via PUT /profile.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaIcon name="my_location" className="text-primary p-2 bg-primary-tint rounded-lg" />
                <div>
                  <p className="text-text-secondary text-micro">{tx("Dernière position reçue")}</p>
                  {selPosition ? (
                    <a
                      className="font-mono text-label text-primary hover:underline"
                      href={lienCarte(selPosition)}
                      target="_blank"
                      rel="noreferrer noopener"
                      id="detailPosition"
                    >
                      {decrirePosition(selPosition)}
                    </a>
                  ) : (
                    <p className="font-body font-medium text-text-tertiary" id="detailPosition">{tx("Aucune position transmise")}</p>
                  )}
                  <p className="text-micro text-text-tertiary">
                    {tx("`livreurs` n’a pas de colonne d’horodatage de position : l’heure affichée serait fausse.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaIcon name="policy" className="text-primary p-2 bg-primary-tint rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-text-secondary text-micro">{tx("Pièces au dossier")}</p>
                  {!selPieces.connues ? (
                    <p className="font-body font-medium text-text-tertiary">{tx("Le champ documents n’a pas été renvoyé.")}</p>
                  ) : selPieces.pieces.length === 0 ? (
                    <p className="font-body font-medium text-text-tertiary">{tx("Dossier vide")}</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {selPieces.pieces.map((p, i) => (
                        <li key={`${p.libelle}-${i}`} className="flex items-start justify-between gap-2 text-label">
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{p.libelle}</span>
                            {p.valeur &&
                              (estUrl(p.valeur) ? (
                                <a className="block truncate text-primary hover:underline" href={p.valeur} target="_blank" rel="noreferrer noopener">
                                  {p.valeur}
                                </a>
                              ) : (
                                <span className="block truncate font-mono text-micro text-text-secondary">{p.valeur}</span>
                              ))}
                          </span>
                          {p.statut && (
                            <span className={`shrink-0 rounded px-2 py-0.5 text-micro ${pieceValidee(p.statut) ? 'bg-success-light text-success-dark' : 'bg-surface-container text-text-tertiary'}`}>
                              {p.statut}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-micro text-text-tertiary">
                    {tx("Les pièces sont déclarées par le livreur via PUT /profile : aucune route ne permet à l’administration de les valider.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaIcon name="location_on" className="text-primary p-2 bg-primary-tint rounded-lg" />
                <div>
                  <p className="text-text-secondary text-micro">{tx("Zone Actuelle")}</p>
                  <p className="font-body font-medium" id="detailZone">
                    {zoneNom(selected.profil?.zone ?? selected.zone)}
                  </p>
                </div>
              </div>
            </div>
            {editing && (
              <div className="p-md bg-bg-secondary rounded-lg border border-border-default space-y-sm">
                <p className="text-text-secondary text-micro uppercase">{tx("Modifier le livreur")}</p>
                <label className="block text-label">
                  Zone
                  <select className="mt-1 w-full rounded border border-border-default bg-white px-2 py-1 text-label" value={editZone} onChange={(e) => setEditZone(e.target.value)}>
                    <option value="">{tx("— Aucune —")}</option>
                    {zones.map((z) => (
                      <option key={z.id} value={String(z.id)}>
                        {z.nom}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-label">
                  {tx("Statut du compte")}
                  <select className="mt-1 w-full rounded border border-border-default bg-white px-2 py-1 text-label" value={editStatut} onChange={(e) => setEditStatut(e.target.value)}>
                    <option value="actif">{tx("Actif")}</option>
                    <option value="inactif">{tx("Inactif")}</option>
                    <option value="suspendu">{tx("Suspendu")}</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-label">
                  {tx("Disponible pour les livraisons")}
                  <input type="checkbox" className="accent-primary" checked={editDispo} onChange={(e) => setEditDispo(e.target.checked)} />
                </label>
                <div className="flex gap-2 pt-1">
                  <button type="button" className="flex-1 border border-border-default py-1.5 rounded-lg text-label" onClick={() => setEditing(false)}>
                    {tx("Annuler")}
                  </button>
                  <button type="button" disabled={saving} className="flex-1 bg-primary-container text-white py-1.5 rounded-lg font-bold text-label disabled:opacity-60" onClick={save}>
                    {saving ? 'Enregistrement…' : tx("Enregistrer")}
                  </button>
                </div>
              </div>
            )}
            <div className="pt-lg border-t border-border-default">
              <p className="font-label text-label mb-md">{tx("Activités récentes")}</p>
              <ul className="space-y-sm">
                {selActivites.length === 0 && <li className="text-secondary font-body">{tx("Aucune commande assignée.")}</li>}
                {selActivites.map((o) => (
                  <li key={o.id} className="flex justify-between text-secondary">
                    <span className="font-body">
                      {tx(ACTIVITE[o.statut] ?? o.statut)} #{o.id}
                    </span>
                    <span className="font-micro">{ilYa(o.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {assignOuvert && (
            <div className="p-md bg-bg-secondary rounded-lg border border-border-default space-y-sm" id="assignPanel">
              <p className="text-text-secondary text-micro uppercase">{tx("Assigner une commande")}</p>
              {assignables.length === 0 ? (
                <p className="text-label">
                  {orders.length === 0
                    ? tx("Aucune commande n'a été lue : GET /admin/orders a échoué ou n'a rien renvoyé — l'assignation est donc indisponible.")
                    : assignablesBruts.length === 0
                    ? tx("Aucune commande en attente sans livreur dans la fenêtre de commandes lue.")
                    : tr(
                        `${assignablesBruts.length} commande(s) en attente, aucune dans la zone de ce livreur : le backend répondrait « Commande et livreur ne sont pas dans la même zone. »`,
                        `${assignablesBruts.length} pending order(s), none in this rider’s zone: the backend would refuse.`,
                      )}
                </p>
              ) : (
                <label className="block text-label">
                  {tx("Commande")}
                  <select
                    className="mt-1 w-full rounded border border-border-default bg-white px-2 py-1 text-label"
                    value={choixCommande}
                    onChange={(e) => setChoixCommande(e.target.value)}
                  >
                    <option value="">{tx("choisir…")}</option>
                    {assignables.slice(0, 40).map((o) => (
                      <option key={String(o.id)} value={String(o.id)}>
                        {`#${String(o.id)} · ${o.client?.nom_complet ?? tx("client sans nom")} · ${fmtFcfa(o.montant_total)}`}
                      </option>
                    ))}
                  </select>
                  {assignables.length > 40 && (
                    <p className="text-micro text-text-tertiary">
                      {tr(`40 commandes proposées sur ${assignables.length} — la liste n’est pas filtrée côté serveur.`, `40 of ${assignables.length} orders offered — the list is not filtered server-side.`)}
                    </p>
                  )}
                </label>
              )}
              {selDispo === false && (
                <p className="text-label text-error">
                  {tx("Le middleware `available` refusera l’assignation : ce livreur est marqué indisponible.")}
                </p>
              )}
              <p className="text-micro text-text-tertiary">
                {tx("POST /admin/assign — la commande passe à ce livreur, la conversation client-livreur est créée et l’événement DeliveryAssigned part en temps réel.")}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 border border-border-default py-1.5 rounded-lg text-label"
                  onClick={() => {
                    setAssignOuvert(false);
                    setChoixCommande('');
                  }}
                >
                  {tx("Annuler")}
                </button>
                <button
                  type="button"
                  className="flex-1 bg-primary-container text-white py-1.5 rounded-lg font-bold text-label disabled:opacity-60"
                  disabled={!choixCommande || assignSaving}
                  onClick={assigner}
                >
                  {assignSaving ? tx("Envoi…") : tx("Confirmer l’assignation")}
                </button>
              </div>
            </div>
          )}
          <div className="mt-xl flex gap-3">
            {selected.telephone ? (
              <a
                href={`tel:+${String(selected.telephone).replace(/\D/g, '')}`}
                className="flex-1 bg-white border border-primary-container text-primary-container py-2 rounded-lg font-bold hover:bg-primary-tint active:scale-97 transition-all text-center"
              >
                {tx("Contacter")}
              </a>
            ) : (
              <button type="button" disabled className="flex-1 bg-white border border-primary-container text-primary-container py-2 rounded-lg font-bold opacity-50">
                {tx("Contacter")}
              </button>
            )}
            <button
              type="button"
              className="flex-1 bg-primary-container text-white py-2 rounded-lg font-bold hover:bg-primary-hover active:scale-97 transition-all disabled:opacity-50"
              aria-expanded={assignOuvert}
              disabled={loading}
              onClick={() => {
                setAssignOuvert((v) => !v);
                setChoixCommande('');
              }}
            >
              {assignOuvert ? tx("Fermer l’assignation") : tx("Assigner")}
            </button>
          </div>
        </aside>
      )}
    </AdminLayout>
  );
}
