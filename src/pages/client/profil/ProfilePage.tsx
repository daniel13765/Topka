import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import { alertApiError } from '../../../utils/apiError';
import { parseLandmarks } from '../../../utils/landmarks';
import { useLanguage } from '../../../context/LanguageContext';
import { currentRole, hasSession } from '../../../routes/authGuard';
import { authApi, ordersApi, type UserProfile } from '../../../services/api';
import { tx } from '../../../i18n/tx';


/** Point de repère stocké dans `profil.point_repere` (JSON du backend). */
interface Landmark {
  key: string;
  nom: string;
  description: string;
}

interface OrderItem {
  id: number;
  date: string;
  totalLabel: string;
  statut: string;
  statusFr: string;
  statusEn: string;
  active: boolean;
}

/** Mapping statut backend → affichage (machine à états TOKPa). */
const STATUT_LABELS: Record<string, { fr: string; en: string; active: boolean }> = {
  en_attente: { fr: 'En attente', en: 'Pending', active: true },
  en_preparation: { fr: 'En préparation', en: 'Preparing', active: true },
  en_livraison: { fr: 'En livraison', en: 'In delivery', active: true },
  livre: { fr: 'Livrée', en: 'Delivered', active: false },
  annule: { fr: 'Annulée', en: 'Cancelled', active: false },
};

/**
 * ProfilePage — données 100 % backend :
 *   - GET /api/profile            → infos utilisateur + profil.point_repere[]
 *   - PUT /api/profile            → modification identité + point_repere[]
 *   - POST /api/auth/change-password
 *   - GET /api/orders             → commandes récentes (statuts réels)
 * Les endpoints /landmarks du backend étant cassés (bug signalé au team backend),
 * les repères sont gérés via le profil (colonnes JSON).
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { language, toggleLanguage, isFr } = useLanguage();
  const isAuthenticated = hasSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  // Nombre total de commandes — GET /dashboard (GET /orders est paginé par 15)
  const [dashCount, setDashCount] = useState<number | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [landmarkModalOpen, setLandmarkModalOpen] = useState(false);
  const [editingLandmark, setEditingLandmark] = useState<Landmark | null>(null);
  const [formNom, setFormNom] = useState('');
  const [formDesc, setFormDescription] = useState('');

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [formPrenom, setFormPrenom] = useState('');
  const [formNomUser, setFormNomUser] = useState('');
  const [formTelephone, setFormTelephone] = useState('');

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      const res = await authApi.getProfile();
      const p: UserProfile | undefined = res?.data ?? res;
      if (p) {
        setProfile(p);
        setLandmarks(parseLandmarks(p.profil));
      }
    } catch (err) {
      alertApiError(err, 'profile-load');
    }
  };

  // Chargement initial : profil + commandes
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsDataLoading(true);

    const p1 = loadProfile();

    const p2 = ordersApi
      .getOrders()
      .then((res) => {
        const list: Record<string, unknown>[] = res?.data ?? (Array.isArray(res) ? res : []);
        const mapped: OrderItem[] = list
          .map((o) => {
            const order = (o.data ?? o) as Record<string, unknown>;
            const statut = String(order.statut ?? "en_attente");
            const label = STATUT_LABELS[statut] ?? { fr: statut, en: statut, active: false };
            return {
              id: Number(order.id),
              date: order.created_at
                ? new Date(String(order.created_at)).toLocaleDateString('fr-FR')
                : order.date_commande
                  ? new Date(String(order.date_commande)).toLocaleDateString('fr-FR')
                  : tx("Récemment"),
              totalLabel: `${Number(order.montant_total ?? 0).toLocaleString('fr-FR')} FCFA`,
              statut,
              statusFr: label.fr,
              statusEn: label.en,
              active: label.active,
            };
          })
          .filter((o) => o.id > 0);
        setRecentOrders(mapped);
      })
      .catch((err) => alertApiError(err, 'profile-orders'));

    const p3 = authApi
      .getDashboard()
      .then((d) => {
        const n = Number(d?.commandes);
        setDashCount(Number.isFinite(n) ? n : null);
      })
      .catch((err) => alertApiError(err, 'profile-dashboard'));

    Promise.allSettled([p1, p2, p3]).then(() => setIsDataLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="bg-bg-app min-h-screen pb-24 font-body text-text-main">
        <ClientNavbar />
        <main className="mx-auto mt-[76px] flex max-w-[720px] flex-col items-center px-md text-center">
          <Link
            to="/connexion"
            search={{ redirect: '/profil' }}
            className="mt-10 flex flex-col items-center gap-md rounded-[14px] border border-border-default bg-bg-card px-lg py-xl shadow-xs"
            aria-label={tx("Se connecter")}
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-tint text-primary-shade">
              <MIcon name="login" className="text-[48px]" />
            </span>
            <h1 className="font-h2 text-h2 font-bold">{tx("Connectez-vous pour voir votre profil")}</h1>
            <p className="max-w-sm text-sm text-text-secondary">
              {tx("Vos commandes et vos points de repère s’affichent ici.")}
            </p>
            <span className="rounded-lg bg-primary-container px-lg py-3 font-bold text-white">{tx("Se connecter")}</span>
          </Link>
        </main>
        <ClientBottomNav />
      </div>
    );
  }

  const userFullName =
    profile?.nom_complet || (profile?.prenom ? `${profile.prenom} ${profile.nom}` : 'Utilisateur TOKPa');
  const userRole = typeof profile?.role === 'object' ? profile.role.nom : profile?.role || 'Client';
  const role = currentRole();
  const orderCount = !role || role === 'client' ? (dashCount ?? recentOrders.length) : recentOrders.length;
  const landmarkCount = landmarks.length;

  // ---- Points de repère (via PUT /profile, car GET /landmarks est cassé côté backend) ----
  const persistLandmarks = async (next: Landmark[]) => {
    setSaving(true);
    try {
      await authApi.updateProfile({
        point_repere: next.map((l) => (l.description ? { nom: l.nom, landmark: l.description } : { nom: l.nom })),
      } as Record<string, unknown>);
      setLandmarks(next);
      toast.success(isFr ? tx("Points de repère enregistrés") : 'Landmarks saved');
      return true;
    } catch (err) {
      alertApiError(err, 'profile-landmarks');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingLandmark(null);
    setFormNom('');
    setFormDescription('');
    setLandmarkModalOpen(true);
  };

  const handleOpenEdit = (lm: Landmark) => {
    setEditingLandmark(lm);
    setFormNom(lm.nom);
    setFormDescription(lm.description);
    setLandmarkModalOpen(true);
  };

  const handleDeleteLandmark = async (lm: Landmark) => {
    if (!confirm(isFr ? `Supprimer « ${lm.nom} » ?` : `Delete « ${lm.nom} »?`)) return;
    await persistLandmarks(landmarks.filter((l) => l.key !== lm.key));
  };

  const handleSaveLandmark = async (e: FormEvent) => {
    e.preventDefault();
    if (!formNom.trim()) return;
    const next = editingLandmark
      ? landmarks.map((l) => (l.key === editingLandmark.key ? { ...l, nom: formNom.trim(), description: formDesc.trim() } : l))
      : [...landmarks, { key: `lm-${Date.now()}`, nom: formNom.trim(), description: formDesc.trim() }];
    const ok = await persistLandmarks(next);
    if (ok) setLandmarkModalOpen(false);
  };

  // ---- Modification du profil (PUT /profile) ----
  const handleOpenEditProfile = () => {
    setFormPrenom(profile?.prenom ?? '');
    setFormNomUser(profile?.nom ?? '');
    setFormTelephone(profile?.telephone ?? '');
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({
        prenom: formPrenom.trim(),
        nom: formNomUser.trim(),
        telephone: formTelephone.trim() || undefined,
      });
      toast.success(isFr ? tx("Profil mis à jour") : 'Profile updated');
      setEditProfileOpen(false);
      await loadProfile();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { message?: string } } })?.response?.data;
      toast.error(detail?.message || (isFr ? tx("Erreur lors de la mise à jour") : 'Update error'));
    } finally {
      setSaving(false);
    }
  };

  // ---- Changement de mot de passe (POST /auth/change-password) ----
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pwNew.length < 8) {
      setPwError(isFr ? tx("Le nouveau mot de passe doit contenir au moins 8 caractères.") : 'New password must be at least 8 characters.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError(isFr ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.changePassword({
        current_password: pwCurrent,
        new_password: pwNew,
        new_password_confirmation: pwConfirm,
      });
      toast.success(res?.message || (isFr ? tx("Mot de passe modifié") : 'Password changed'));
      setPwModalOpen(false);
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setPwError(detail?.message || (isFr ? tx("Mot de passe actuel incorrect.") : 'Current password incorrect.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    toast.success(isFr ? tx("Déconnexion effectuée") : 'Logged out');
    navigate({ to: '/connexion' });
  };

  return (
    <div className="bg-bg-app min-h-screen pb-24 font-body text-text-main">
      <ClientNavbar />

      <main className="max-w-[720px] mx-auto mt-[76px] px-md">
        {isDataLoading ? (
          <div className="py-2xl flex justify-center">
            <MIcon name="sync" className="text-primary text-4xl animate-spin" />
          </div>
        ) : (
          <>
            {/* PROFILE HEADER */}
            <section className="bg-bg-card rounded-[14px] p-lg border border-border-default flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md mb-md shadow-xs">
              <div className="flex items-center gap-md">
                <div className="w-16 h-16 rounded-full bg-primary-tint flex items-center justify-center text-[22px] font-bold text-primary-dark shrink-0 border border-primary-light">
                  {userFullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-sm">
                    <h2 className="font-h2 text-h2 text-text-main font-bold">{userFullName}</h2>
                    <span className="inline-flex items-center gap-xs px-sm py-1 bg-success-light text-success text-micro rounded-full font-bold uppercase tracking-wider">
                      <MIcon name="verified_user" className="!text-xs" style={{ fontVariationSettings: "'FILL' 1" }} />
                      {userRole}
                    </span>
                  </div>
                  <div className="flex items-center text-text-secondary mt-1">
                    <MIcon name="mail" className="text-sm mr-1" />
                    <span className="text-secondary">{profile?.email || tx("Non renseigné")}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenEditProfile}
                className="px-md py-sm bg-white border border-border-default text-text-secondary rounded-lg font-label text-label flex items-center gap-sm transition-all hover:bg-bg-secondary cursor-pointer"
              >
                <MIcon name="edit" className="text-sm" />
                {isFr ? tx("Modifier") : 'Edit'}
              </button>
            </section>

            {/* STATS (calculées sur les données API réelles) */}
            <section className="grid grid-cols-2 gap-md mb-md">
              <div className="bg-bg-card p-md rounded-[10px] border border-border-default flex flex-col items-center justify-center text-center shadow-xs">
                <span className="font-h2 text-h2 text-text-main font-bold">{orderCount}</span>
                <span className="text-micro text-text-tertiary uppercase mt-1">
                  {isFr ? tx("Commandes") : 'Orders'}
                </span>
              </div>
              <div className="bg-bg-card p-md rounded-[10px] border border-border-default flex flex-col items-center justify-center text-center shadow-xs">
                <span className="font-h2 text-h2 text-primary-container font-bold">{landmarkCount}</span>
                <span className="text-micro text-text-tertiary uppercase mt-1">
                  {isFr ? tx("Points de repère") : 'Landmarks'}
                </span>
              </div>
            </section>

            {/* LANDMARKS SECTION */}
            <section className="mb-md">
              <div className="flex items-center justify-between mb-sm">
                <h3 className="font-h3 text-h3 text-text-main font-bold">
                  {isFr ? tx("Mes points de repère") : 'My landmarks'}
                </h3>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="flex items-center gap-xs text-primary-container font-bold text-label cursor-pointer hover:underline"
                >
                  <MIcon name="add" className="text-lg" />
                  {isFr ? tx("Ajouter") : 'Add'}
                </button>
              </div>

              {landmarks.length === 0 ? (
                <div className="bg-bg-card p-lg rounded-[10px] border border-border-default text-center text-text-secondary">
                  <MIcon name="location_on" className="text-3xl text-text-tertiary mb-2" />
                  <p className="text-sm font-semibold">
                    {isFr ? tx("Aucun point de repère enregistré") : 'No landmarks saved'}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    {isFr
                      ? tx("Ajoutez un repère (maison, bureau…) pour faciliter la livraison.")
                      : 'Add a landmark (home, office…) to ease delivery.'}
                  </p>
                </div>
              ) : (
                <div className="bg-bg-card border border-border-default rounded-[14px] overflow-hidden">
                  <div className="divide-y divide-border-default">
                    {landmarks.map((lm) => (
                      <div key={lm.key} className="p-md flex items-center gap-md">
                        <div className="w-10 h-10 rounded-full bg-primary-tint flex items-center justify-center text-primary-dark flex-shrink-0">
                          <MIcon name="location_on" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="font-bold text-text-main truncate">{lm.nom}</p>
                          <p className="text-secondary text-text-tertiary truncate">
                            {lm.description || (isFr ? '—' : '—')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(lm)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-bg-secondary transition-colors cursor-pointer"
                          title={isFr ? tx("Modifier") : 'Edit'}
                        >
                          <MIcon name="edit" className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLandmark(lm)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg border border-error/30 text-error hover:bg-error-light transition-colors cursor-pointer"
                          title={isFr ? tx("Supprimer") : 'Delete'}
                        >
                          <MIcon name="delete" className="text-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ORDERS SECTION */}
            <section className="mb-md">
              <div className="flex items-center justify-between mb-sm">
                <h3 className="font-h3 text-h3 text-text-main font-bold">
                  {isFr ? tx("Mes commandes récentes") : 'Recent orders'}
                </h3>
                <Link
                  to="/commandes"
                  className="text-primary-container font-label text-label hover:underline font-bold"
                >
                  {isFr ? tx("Voir tout") : 'See all'}
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <div className="bg-bg-card p-lg rounded-[10px] border border-border-default text-center text-text-secondary">
                  <MIcon name="shopping_bag" className="text-3xl text-text-tertiary mb-2" />
                  <p className="text-sm font-semibold">{tx("Aucune commande enregistrée")}</p>
                  <p className="text-xs text-text-tertiary mt-1">
                    {tx("Vos commandes apparaîtront ici une fois validées.")}
                  </p>
                </div>
              ) : (
                <div className="bg-bg-card border border-border-default rounded-[14px] overflow-hidden">
                  <div className="divide-y divide-border-default">
                    {recentOrders.map((o) => (
                      <div key={o.id} className="p-md flex items-center justify-between hover:bg-bg-secondary transition-colors">
                        <div className="flex flex-col">
                          <span className="font-bold text-text-main">Commande #{o.id}</span>
                          <span className="text-secondary text-text-tertiary">{o.date}</span>
                        </div>
                        <div className="font-bold text-primary-container">{o.totalLabel}</div>
                        <div className="flex items-center gap-md">
                          <span
                            className={
                              o.active
                                ? 'px-sm py-1 bg-primary-tint border border-primary-light text-primary-dark text-micro rounded-full font-bold uppercase'
                                : 'px-sm py-1 bg-success-light text-success text-micro rounded-full font-bold uppercase'
                            }
                          >
                            {isFr ? o.statusFr : o.statusEn}
                          </span>
                          <Link
                            to={o.active ? '/commandes/suivi' : '/commandes'}
                            search={o.active ? { order: String(o.id) } : { detail: String(o.id) }}
                            className="text-primary-container font-label text-label flex items-center gap-xs font-bold"
                          >
                            {o.active ? (isFr ? tx("Suivre") : 'Track') : (isFr ? tx("Détails") : 'Details')}
                            <MIcon name="chevron_right" className="text-sm" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* SECURITY & SETTINGS */}
            <section className="mb-xl">
              <h3 className="font-h3 text-h3 text-text-main mb-sm font-bold">
                {isFr ? tx("Paramètres & Sécurité") : 'Settings & Security'}
              </h3>
              <div className="bg-bg-card border border-border-default rounded-[14px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(true)}
                  className="w-full p-md flex items-center justify-between hover:bg-bg-secondary transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-md">
                    <MIcon name="lock" className="text-text-secondary" />
                    <span className="text-body text-text-main">
                      {isFr ? tx("Changer mot de passe") : 'Change password'}
                    </span>
                  </div>
                  <MIcon name="chevron_right" className="text-text-tertiary" />
                </button>

                <Link
                  to="/notifications"
                  className="w-full p-md flex items-center justify-between border-t border-border-default hover:bg-bg-secondary transition-colors text-left"
                >
                  <div className="flex items-center gap-md">
                    <MIcon name="notifications_active" className="text-text-secondary" />
                    <span className="text-body text-text-main">Notifications</span>
                  </div>
                  <MIcon name="chevron_right" className="text-text-tertiary" />
                </Link>

                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="w-full p-md flex items-center justify-between border-t border-border-default hover:bg-bg-secondary transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-md">
                    <MIcon name="language" className="text-text-secondary" />
                    <span className="text-body text-text-main">{isFr ? tx("Langue") : 'Language'}</span>
                  </div>
                  <div className="flex items-center gap-sm">
                    <span className="text-secondary text-text-tertiary font-bold uppercase">{language}</span>
                    <MIcon name="chevron_right" className="text-text-tertiary" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full p-md flex items-center gap-md border-t border-border-default hover:bg-error-light transition-colors text-error font-medium cursor-pointer"
                >
                  <MIcon name="logout" />
                  {isFr ? tx("Déconnexion") : 'Logout'}
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Modal Landmark Add/Edit */}
      {landmarkModalOpen && (
        <div className="fixed inset-0 bg-on-surface/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4 animate-fade-in">
          <div className="bg-white w-full max-w-[500px] rounded-xl shadow-2xl overflow-hidden p-lg">
            <div className="flex justify-between items-center mb-md border-b border-border-default pb-3">
              <h3 className="font-h2 text-h2 font-bold">
                {editingLandmark
                  ? isFr
                    ? tx("Modifier le repère")
                    : 'Edit landmark'
                  : isFr
                    ? tx("Nouveau point de repère")
                    : 'New landmark'}
              </h3>
              <button
                type="button"
                onClick={() => setLandmarkModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <MIcon name="close" />
              </button>
            </div>

            <form onSubmit={handleSaveLandmark} className="space-y-md">
              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">
                  {tx("Nom du point de repère")}
                </label>
                <input
                  type="text"
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  placeholder="Ex : Maison Maman, Carrefour…"
                  required
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">
                  {tx("Description précise")}
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={tx("Ex : Face à la pharmacie, portail bleu…")}
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none resize-none"
                />
              </div>

              <div className="pt-md border-t border-border-default flex justify-end gap-md">
                <button
                  type="button"
                  onClick={() => setLandmarkModalOpen(false)}
                  className="px-md py-2 rounded-lg border border-border-default font-medium hover:bg-gray-50 transition-all cursor-pointer"
                >
                  {isFr ? tx("Annuler") : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-lg py-2 rounded-lg bg-primary-container hover:bg-primary-hover text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isFr ? tx("Enregistrer") : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Profile (PUT /api/profile) */}
      {editProfileOpen && (
        <div className="fixed inset-0 bg-on-surface/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4 animate-fade-in">
          <div className="bg-white w-full max-w-[500px] rounded-xl shadow-2xl overflow-hidden p-lg">
            <div className="flex justify-between items-center mb-md border-b border-border-default pb-3">
              <h3 className="font-h2 text-h2 font-bold">{isFr ? tx("Modifier mon profil") : 'Edit my profile'}</h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <MIcon name="close" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-md">
              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">{tx("Prénom")}</label>
                <input
                  type="text"
                  value={formPrenom}
                  onChange={(e) => setFormPrenom(e.target.value)}
                  required
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">{tx("Nom")}</label>
                <input
                  type="text"
                  value={formNomUser}
                  onChange={(e) => setFormNomUser(e.target.value)}
                  required
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">{tx("Téléphone")}</label>
                <input
                  type="tel"
                  value={formTelephone}
                  onChange={(e) => setFormTelephone(e.target.value)}
                  placeholder="+229 90 00 00 00"
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none"
                />
              </div>

              <div className="pt-md border-t border-border-default flex justify-end gap-md">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-md py-2 rounded-lg border border-border-default font-medium hover:bg-gray-50 transition-all cursor-pointer"
                >
                  {isFr ? tx("Annuler") : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-lg py-2 rounded-lg bg-primary-container hover:bg-primary-hover text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isFr ? tx("Enregistrer") : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Change Password (POST /api/auth/change-password) */}
      {pwModalOpen && (
        <div className="fixed inset-0 bg-on-surface/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4 animate-fade-in">
          <div className="bg-white w-full max-w-[500px] rounded-xl shadow-2xl overflow-hidden p-lg">
            <div className="flex justify-between items-center mb-md border-b border-border-default pb-3">
              <h3 className="font-h2 text-h2 font-bold">{isFr ? tx("Changer le mot de passe") : 'Change password'}</h3>
              <button
                type="button"
                onClick={() => setPwModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <MIcon name="close" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-md">
              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">
                  {tx("Mot de passe actuel")}
                </label>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  required
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">
                  {tx("Nouveau mot de passe")}
                </label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  required
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">
                  {tx("Confirmer le nouveau mot de passe")}
                </label>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  required
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none"
                />
              </div>

              {pwError && (
                <div className="p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark">
                  {pwError}
                </div>
              )}

              <div className="pt-md border-t border-border-default flex justify-end gap-md">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="px-md py-2 rounded-lg border border-border-default font-medium hover:bg-gray-50 transition-all cursor-pointer"
                >
                  {isFr ? tx("Annuler") : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-lg py-2 rounded-lg bg-primary-container hover:bg-primary-hover text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isFr ? tx("Changer") : 'Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}
