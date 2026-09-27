import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import MIcon from '../../../components/shared/MIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import { authApi } from '../../../services/api';
import { unwrap } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { initialsOf } from '../../../routes/authGuard';
import { fetchLivreurProfile, forgetLivreurProfile, type LivreurProfile } from '../livreurData';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


/**
 * Paramètres livreur — design Stitch « param_tres_livreur_tokpa », données réelles : GET /profile
 * (identité, disponibilité, zone), PUT /profile (prénom, nom, téléphone). L'email et la zone ne sont
 * pas modifiables par l'API (zone attribuée par l'administration). Retirés (aucune route) : photo,
 * véhicule & documents, reversement des gains, interrupteur de service (B-26).
 */
export default function LivreurSettingsPage() {
  useLanguage();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<LivreurProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setErr(null);
    fetchLivreurProfile(true)
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setPrenom(p.prenom ?? '');
        setNom(p.nom ?? '');
        setTelephone(p.telephone ?? '');
      })
      .catch((e) => alive && setErr(alertApiError(e, 'livreur-load')));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nomComplet = [prenom.trim(), nom.trim()].filter(Boolean).join(' ');
      const res = await authApi.updateProfile({ prenom: prenom.trim(), nom: nom.trim(), nom_complet: nomComplet, telephone: telephone.trim() });
      // Session à jour → le nom affiché dans les barres suit immédiatement
      const updated = unwrap(res);
      try {
        const stored = JSON.parse(localStorage.getItem('tokpa_user') ?? '{}');
        localStorage.setItem('tokpa_user', JSON.stringify({ ...stored, ...(updated && typeof updated === 'object' ? updated : {}) }));
      } catch {
        /* session illisible : ignorée */
      }
      forgetLivreurProfile();
      toast.success(res?.message ?? tx("Profil mis à jour avec succès."));
      setReloadKey((k) => k + 1);
    } catch (error) {
      alertApiError(error, 'livreur-profile');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await authApi.logout();
    toast.success(tx("Déconnexion effectuée"));
    navigate({ to: '/connexion' });
  };

  const nomAffiche = profile?.nom_complet || [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || tx("Livreur");
  const inputCls =
    'w-full rounded-[10px] border border-border-default bg-bg-card px-md py-sm font-body text-body text-text-main transition-all focus:bg-primary-tint/30 focus:outline-none';

  return (
    <LivreurLayout>
      <div className="w-full bg-bg-app p-lg">
        <div className="flex w-full flex-col">
          {/* Page Header & statut opérationnel (lecture seule) */}
          <div className="flex flex-col justify-between gap-md pb-lg md:flex-row md:items-center">
            <div>
              <div className="mb-xs flex items-center gap-xs text-micro uppercase tracking-wider text-text-secondary">
                <MIcon name="tune" className="text-[16px] text-primary-container" />
                <span>{tx("Espace Livreur • Préférences opérationnelles")}</span>
              </div>
              <h1 className="font-h1 text-h1 font-bold text-text-main">{tx("Paramètres du compte")}</h1>
              <p className="mt-xs font-body text-secondary text-text-secondary">{tx("Gérez vos informations personnelles.")}</p>
            </div>
            {profile && (
              <div className="flex items-center gap-md self-start rounded-[14px] bg-bg-card px-md py-sm shadow-sm md:self-auto">
                <div className="flex flex-col">
                  <span className="text-micro font-semibold uppercase text-text-secondary">{tx("Statut opérationnel")}</span>
                  <div className="mt-xs flex items-center gap-xs">
                    <span className={profile.disponible ? 'h-2.5 w-2.5 animate-pulse rounded-full bg-success' : 'h-2.5 w-2.5 rounded-full bg-text-tertiary'} />
                    <span className="text-label font-bold text-text-main">
                      {profile.disponible == null ? 'Statut inconnu' : profile.disponible ? 'En service' : 'Hors service'}
                      {profile.zone ? ` - ${profile.zone}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {err ? (
            <ApiErrorState
              title={tx("Impossible de charger votre profil")}
              message={err}
              onRetry={() => setReloadKey((k) => k + 1)}
              className="rounded-[14px] bg-bg-card px-md shadow-sm"
            />
          ) : !profile ? (
            <LoadingState label={tx("Chargement de votre profil…")} className="rounded-[14px] bg-bg-card shadow-sm" />
          ) : (
            <div className="grid grid-cols-1 gap-lg lg:grid-cols-12">
              {/* Profil & Identité */}
              <form onSubmit={save} className="flex flex-col gap-md rounded-[14px] bg-bg-card p-lg shadow-sm lg:col-span-7">
                <div className="flex items-center justify-between pb-sm">
                  <div className="flex items-center gap-sm">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary-container">
                      <MIcon name="badge" className="text-[20px]" />
                    </div>
                    <div>
                      <h2 className="font-h2 text-h2 font-semibold text-text-main">{tx("Profil &amp; Identité")}</h2>
                      <p className="font-secondary text-micro text-text-secondary">{tx("Identifiants et zone géographique assignée")}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-md rounded-xl bg-bg-secondary p-md">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-xl font-bold text-primary-dark">
                    {initialsOf(nomAffiche, 'LV')}
                  </div>
                  <div className="flex flex-1 flex-col gap-xs">
                    <div className="flex items-center gap-xs">
                      <span className="font-h3 text-h3 font-bold text-text-main">{nomAffiche}</span>
                      {profile.id != null && <span className="text-micro text-text-tertiary">#LIV-{profile.id}</span>}
                    </div>
                    <p className="font-secondary text-micro text-text-secondary">{profile.zone ? `Zone ${profile.zone}` : tx("Zone non attribuée")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                  <label className="flex flex-col gap-xs">
                    <span className="font-secondary text-secondary text-text-secondary">{tx("Prénom")}</span>
                    <input className={inputCls} type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} maxLength={80} />
                  </label>
                  <label className="flex flex-col gap-xs">
                    <span className="font-secondary text-secondary text-text-secondary">{tx("Nom")}</span>
                    <input className={inputCls} type="text" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} />
                  </label>
                  <label className="flex flex-col gap-xs">
                    <span className="font-secondary text-secondary text-text-secondary">{tx("Téléphone direct")}</span>
                    <input className={inputCls} type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} maxLength={20} />
                  </label>
                  <label className="flex flex-col gap-xs">
                    <span className="font-secondary text-secondary text-text-secondary">{tx("Adresse e-mail")}</span>
                    <input className={`${inputCls} opacity-70`} type="email" value={profile.email ?? ''} readOnly title="Non modifiable depuis l'application" />
                  </label>
                  <label className="flex flex-col gap-xs sm:col-span-2">
                    <span className="font-secondary text-secondary text-text-secondary">{tx("Zone principale assignée")}</span>
                    <input
                      className={`${inputCls} opacity-70`}
                      type="text"
                      value={profile.zone ?? tx("Non attribuée")}
                      readOnly
                      title={tx("Attribuée par l'administration")}
                    />
                  </label>
                </div>
                <div className="flex justify-end pt-xs">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-xs rounded-[10px] bg-primary-container px-md py-sm font-label text-label font-medium text-on-primary shadow-sm transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-60"
                  >
                    <MIcon name="save" className="text-[18px]" />
                    {saving ? 'Enregistrement…' : tx("Mettre à jour le profil")}
                  </button>
                </div>
              </form>

              {/* Mobile : bascule et déconnexion (la barre latérale est masquée) */}
              <div className="flex flex-col gap-sm lg:hidden">
                <Link to="/" className="flex items-center justify-center gap-sm rounded-[10px] border border-border-default bg-bg-card py-sm font-label text-label font-semibold text-primary">
                  <MIcon name="storefront" className="text-[18px]" />
                  {tx("Espace client")}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center justify-center gap-sm rounded-[10px] border border-border-default bg-bg-card py-sm font-label text-label font-semibold text-error"
                >
                  <MIcon name="logout" className="text-[18px]" />
                  {tx("Déconnexion")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </LivreurLayout>
  );
}
