import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import FaIcon from '../../../components/shared/FaIcon';
import { CarteZoneGoogle } from './CarteZoneGoogle';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import LangToggle from '../../../components/shared/LangToggle';
import { authApi } from '../../../services/api';
import { unwrap } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { initialsOf } from '../../../routes/authGuard';
import { fetchLivreurProfile, forgetLivreurProfile, type LivreurProfile } from '../livreurData';
import {
  construireCorpsProfil,
  erreurMotDePasse,
  forceDuMotDePasse,
  iconePiece,
  libelleDisponibilite,
  pieceValidee,
  puceConformite,
  telephoneValide,
  urlPhotoValide,
} from './profilUtils';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';

const CARD = 'rounded-[14px] bg-bg-card p-lg shadow-sm flex flex-col gap-md';
const INPUT =
  'w-full px-md py-sm bg-bg-card rounded-[10px] font-body text-body text-text-main transition-all focus:bg-primary-tint/30 focus:outline-none';
const LABEL = 'font-secondary text-secondary text-text-secondary';
const CHIP = 'inline-flex items-center gap-xs rounded-full px-sm py-xs font-micro text-micro font-semibold';
const CHIP_TONE = {
  ok: 'bg-success-light text-success',
  warn: 'bg-amber-light text-amber-text',
  mute: 'bg-bg-secondary text-text-secondary',
} as const;
const CTA_SOFT =
  'rounded-[10px] bg-primary-tint px-md py-xs font-label text-label font-medium text-primary-dark shadow-sm transition-all hover:bg-primary-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-60';
const CTA_MAIN =
  'flex items-center gap-xs rounded-[10px] bg-primary-container px-md py-sm font-label text-label font-medium text-white shadow-sm transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Espace Livreur — Paramètres du compte (maquette `param_tres_livreur_tokpa`).
 *
 * Reprise fidèle de la maquette : en-tête « Espace Livreur • Préférences opérationnelles » + carte
 * « Statut opérationnel » avec son interrupteur, grille 6/6, carte « Profil & Identité » (avatar,
 * référence, champ photo), carte « Véhicule & Conformité » (bandeau véhicule + liste de pièces à
 * pastille), carte « Reversement des gains » (bandeau dégradé + canaux + fréquence) et barre basse
 * « Annuler / Enregistrer toutes les modifications ». Les deux emplacements laissés vides par la
 * maquette (`Carte 5: Sécurité & Connexion`, `Carte 4: Préférences de Livraison & Notifications`)
 * sont comblés par les seules fonctions réellement disponibles : changement de mot de passe et
 * langue/notifications.
 *
 * Règle de données : aucun champ de la maquette n’est rendu éditable s’il n’est pas persisté, et
 * aucun chiffre n’est simulé.
 * - `PUT /profile` (ProfileController) n’écrit côté livreur que `prenom`, `nom`, `nom_complet`,
 *   `telephone`, `image_profil` (+ `documents`) → seuls ces champs sont des contrôles actifs ;
 * - `disponibilite` et `zone_id` ne sont modifiables que par un administrateur
 *   (`PATCH /admin/users/{id}`) → interrupteur et sélecteur de zone rendus désactivés, avec le motif ;
 * - aucune route de dépôt de fichier : la photo reste une URL (max. 500 caractères côté back) ;
 * - `vehicules` n’est exposé par aucune route : le bandeau affiche la référence brute `id_vehicule`
 *   ou `—`, jamais une plaque inventée ;
 * - aucune route de versement : solde, canaux et fréquence restent à `—` et les boutons désactivés ;
 * - `UserResource` renvoie `is_verified` en dur → la puce « Vérifié » de la maquette est remplacée
 *   par l’état réel du formulaire (enregistre ou non) et par `users.statut`.
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

  const [photoOuverte, setPhotoOuverte] = useState(false);
  const [imageProfil, setImageProfil] = useState('');

  const [securiteOuverte, setSecuriteOuverte] = useState(false);
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [savingMdp, setSavingMdp] = useState(false);

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
        setImageProfil(p.image_profil ?? '');
      })
      .catch((e) => {
        if (alive) setErr(alertApiError(e, 'livreur-settings-load'));
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const modifie = useMemo(
    () =>
      !!profile &&
      (prenom !== (profile.prenom ?? '') ||
        nom !== (profile.nom ?? '') ||
        telephone !== (profile.telephone ?? '') ||
        imageProfil !== (profile.image_profil ?? '')),
    [profile, prenom, nom, telephone, imageProfil],
  );

  const disponibilite = libelleDisponibilite(profile?.disponible ?? null);
  const enService = disponibilite.enService;
  const libelleStatut = tx(disponibilite.cle);

  const nomAffiche =
    profile?.nom_complet || [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || tx('Livreur');
  const initiales = initialsOf(profile?.nom_complet ?? null, '··');

  const zone = profile?.zone ?? null;

  const annuler = () => {
    if (!profile) return;
    setPrenom(profile.prenom ?? '');
    setNom(profile.nom ?? '');
    setTelephone(profile.telephone ?? '');
    setImageProfil(profile.image_profil ?? '');
  };

  const enregistrer = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!modifie || saving) return;
    if (telephone.trim() !== '' && !telephoneValide(telephone)) {
      toast.error(tx('Numéro de téléphone trop court.'), { id: 'livreur-settings-tel' });
      return;
    }
    if (!urlPhotoValide(imageProfil)) {
      toast.error(tx('La photo doit être une URL http(s).'), { id: 'livreur-settings-photo' });
      return;
    }
    setSaving(true);
    try {
      // `users.image_profil` est une chaîne nullable : la vider passe par ''.
      const body = construireCorpsProfil({
        prenom,
        nom,
        telephone,
        imageProfil,
        imageProfilServeur: profile?.image_profil ?? null,
      });
      const res = await authApi.updateProfile(body);
      // La session locale porte le nom affiché dans les barres : on la rafraîchit tout de suite.
      const updated = unwrap(res);
      try {
        const stored = JSON.parse(localStorage.getItem('tokpa_user') ?? '{}');
        localStorage.setItem(
          'tokpa_user',
          JSON.stringify({ ...stored, ...(updated && typeof updated === 'object' ? updated : {}) }),
        );
      } catch {
        /* session illisible : le rechargement du profil suffira */
      }
      window.dispatchEvent(new Event('tokpa:auth-changed'));
      forgetLivreurProfile();
      setPhotoOuverte(false);
      setSecuriteOuverte(false);
      toast.success(res?.message ?? tx('Profil mis à jour avec succès.'));
      setReloadKey((k) => k + 1);
    } catch (error) {
      alertApiError(error, 'livreur-settings-save');
    } finally {
      setSaving(false);
    }
  };

  const changerMotDePasse = async (e: FormEvent) => {
    e.preventDefault();
    if (savingMdp) return;
    const erreur = erreurMotDePasse({
      actuel: motDePasseActuel,
      nouveau: nouveauMotDePasse,
      confirmation,
    });
    if (erreur) {
      toast.error(tx(erreur), { id: 'livreur-settings-mdp' });
      return;
    }
    setSavingMdp(true);
    try {
      const res = await authApi.changePassword({
        current_password: motDePasseActuel,
        new_password: nouveauMotDePasse,
        new_password_confirmation: confirmation,
      });
      setMotDePasseActuel('');
      setNouveauMotDePasse('');
      setConfirmation('');
      setSecuriteOuverte(false);
      toast.success(res?.message ?? tx('Mot de passe mis à jour.'));
    } catch (error) {
      alertApiError(error, 'livreur-settings-mdp');
    } finally {
      setSavingMdp(false);
    }
  };

  // Indicateur de force calculé localement : aucune route d'audit de mot de passe n'existe.
  const forceMdp = forceDuMotDePasse(nouveauMotDePasse);

  const deconnexion = async () => {
    await authApi.logout();
    toast.success(tx('Déconnexion effectuée'));
    navigate({ to: '/connexion' });
  };

  return (
    <LivreurLayout>
      <div className="flex w-full flex-col">
        {/* ---------------- En-tête + statut opérationnel (maquette) ---------------- */}
        <div className="flex flex-col justify-between gap-md pb-lg md:flex-row md:items-center">
          <div>
            <div className="mb-xs flex items-center gap-xs font-micro text-micro uppercase tracking-wider text-text-secondary">
              <FaIcon name="tune" className="text-[16px] text-primary-container" />
              <span>{tx('Espace Livreur • Préférences opérationnelles')}</span>
            </div>
            <h1 className="font-h1 text-h1 font-bold text-text-main">{tx('Paramètres du compte')}</h1>
            <p className="mt-xs font-body text-body text-text-secondary">
              {tx('Gérez vos informations personnelles, votre véhicule, vos préférences de paiement et vos notifications de course.')}
            </p>
          </div>

          <div className="flex items-center gap-md self-start rounded-[14px] bg-bg-card px-md py-sm shadow-sm md:self-auto">
            <div className="flex flex-col">
              <span className="font-label text-micro font-semibold uppercase text-text-secondary">
                {tx('Statut opérationnel')}
              </span>
              <div className="mt-xs flex items-center gap-xs">
                <span
                  className={clsx(
                    'h-2.5 w-2.5 rounded-full',
                    enService ? 'animate-pulse bg-success' : 'bg-border-default',
                  )}
                />
                <span className="font-label text-label font-bold text-text-main">
                  {zone ? `${libelleStatut} - ${zone}` : libelleStatut}
                </span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enService}
              aria-label={tx('Basculer la disponibilité')}
              title={tx('Seul un administrateur peut activer ou désactiver un livreur.')}
              onClick={() =>
                toast(tx('Disponibilité gérée par un administrateur (PATCH /admin/users/{id}).'), {
                  id: 'livreur-settings-duty',
                })
              }
              className={clsx(
                'relative ml-sm inline-flex h-6 w-12 shrink-0 cursor-not-allowed items-center rounded-full transition-colors',
                enService ? 'bg-success' : 'bg-border-default',
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
                  enService ? 'left-[26px]' : 'left-0.5',
                )}
              />
            </button>
          </div>
        </div>

        {err ? (
          <ApiErrorState
            title={tx('Impossible de charger votre profil')}
            message={err}
            onRetry={() => setReloadKey((k) => k + 1)}
            className="mb-lg rounded-[14px] bg-bg-card px-md shadow-sm"
          />
        ) : null}

        {!profile && !err ? <LoadingState label={tx('Chargement de votre profil…')} /> : null}

        {profile ? (
          <>
            <div className="grid grid-cols-1 gap-lg lg:grid-cols-12">
              {/* ================= Colonne 1 : identité + véhicule ================= */}
              <div className="flex flex-col gap-lg lg:col-span-6">
                {/* Carte 1 : Profil & Identité */}
                <section className={clsx(CARD, 'tokpa-rise')} style={{ animationDelay: '40ms' }}>
                  <div className="flex items-center justify-between gap-sm pb-sm">
                    <div className="flex items-center gap-sm">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary-container">
                        <FaIcon name="badge" className="text-[20px]" />
                      </span>
                      <div>
                        <h2 className="font-h2 text-h2 font-semibold text-text-main">
                          {tx('Profil & Identité')}
                        </h2>
                        <p className="font-secondary text-micro text-text-secondary">
                          {tx('Identifiants et zone géographique assignée')}
                        </p>
                      </div>
                    </div>
                    {modifie ? (
                      <span className={clsx(CHIP, CHIP_TONE.warn)} title={tx('Le serveur n’a pas encore reçu ces changements.')}>
                        <FaIcon name="pending_actions" className="text-[14px]" />
                        {tx('Non enregistré')}
                      </span>
                    ) : (
                      <span className={clsx(CHIP, CHIP_TONE.ok)}>
                        <FaIcon name="check_circle" className="text-[14px]" />
                        {profile.statut === 'suspendu'
                          ? tx('Compte suspendu')
                          : profile.statut === 'inactif'
                            ? tx('Compte inactif')
                            : tx('Profil à jour')}
                      </span>
                    )}
                  </div>

                  {/* Avatar + référence + CTA photo */}
                  <div className="flex flex-col gap-md rounded-xl bg-bg-secondary p-md sm:flex-row sm:items-center">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary-light">
                      {profile.image_profil ? (
                        <img src={profile.image_profil} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-h3 text-h3 font-bold text-primary-dark">
                          {initiales}
                        </span>
                      )}
                      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-deep/40 to-transparent" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-xs">
                      <div className="flex flex-wrap items-center gap-xs">
                        <span className="font-h3 text-h3 font-bold text-text-main">{nomAffiche}</span>
                        <span className="font-micro text-micro text-text-tertiary">
                          {profile.id ? `ID #${profile.id}` : tx('Référence inconnue')}
                        </span>
                      </div>
                      <p className="font-secondary text-micro text-text-secondary">
                        {zone ? tx('Zone assignée') + ` : ${zone}` : tx('Aucune zone assignée au compte')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPhotoOuverte((v) => !v)}
                        className={clsx(CTA_SOFT, 'self-start')}
                      >
                        {photoOuverte ? tx('Fermer') : tx('Changer la photo')}
                      </button>
                    </div>
                  </div>

                  {photoOuverte ? (
                    <div className="tokpa-pop flex flex-col gap-xs rounded-xl border border-border-default bg-bg-secondary p-md">
                      <label className={LABEL} htmlFor="livreur-photo">
                        {tx('URL de la photo de profil')}
                      </label>
                      <input
                        id="livreur-photo"
                        value={imageProfil}
                        onChange={(e) => setImageProfil(e.target.value)}
                        placeholder="https://…"
                        inputMode="url"
                        className={INPUT}
                      />
                      <p className="font-micro text-micro text-text-secondary">
                        {tx('Aucune route de téléversement : le champ `image_profil` stocke une URL (500 caractères maximum). Videz-le pour retirer la photo.')}
                      </p>
                      <div className="flex items-center justify-end gap-sm pt-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setImageProfil(profile.image_profil ?? '');
                            setPhotoOuverte(false);
                          }}
                          className="font-label text-label font-medium text-text-secondary transition-colors hover:text-text-main"
                        >
                          {tx('Annuler')}
                        </button>
                        <button type="button" onClick={() => void enregistrer()} className={CTA_MAIN} disabled={!modifie || saving}>
                          <FaIcon name="save" className="text-[16px]" />
                          {saving ? tx('Enregistrement…') : tx('Enregistrer la photo')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Formulaire identité */}
                  <form onSubmit={enregistrer} className="grid grid-cols-1 gap-md sm:grid-cols-2">
                    <div className="flex flex-col gap-xs">
                      <label className={LABEL} htmlFor="livreur-prenom">
                        {tx('Prénom')}
                      </label>
                      <input
                        id="livreur-prenom"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        autoComplete="given-name"
                        className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-xs">
                      <label className={LABEL} htmlFor="livreur-nom">
                        {tx('Nom')}
                      </label>
                      <input
                        id="livreur-nom"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        autoComplete="family-name"
                        className={INPUT}
                      />
                    </div>

                    <div className="flex flex-col gap-xs">
                      <div className="flex items-center justify-between gap-sm">
                        <label className={LABEL} htmlFor="livreur-tel">
                          {tx('Téléphone direct')}
                        </label>
                        <span className="font-micro text-micro text-text-tertiary">
                          {tx('Numéro de travail du livreur')}
                        </span>
                      </div>
                      <input
                        id="livreur-tel"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+229 …"
                        className={INPUT}
                      />
                    </div>

                    <ChampLibre
                      label={tx('Adresse e-mail')}
                      valeur={profile.email ?? null}
                      motif={tx('Non modifiable depuis cet écran : passez par « Mot de passe oublié ».')}
                      icone="mail"
                    />

                    <div className="flex flex-col gap-xs sm:col-span-2">
                      <label className={LABEL} htmlFor="livreur-zone">
                        {tx('Ville & Zone principale assignée')}
                      </label>
                      <div className="relative">
                        <select
                          id="livreur-zone"
                          disabled
                          className={clsx(INPUT, 'cursor-not-allowed appearance-none pr-10 opacity-80')}
                          title={tx('Seul un administrateur affecte un livreur à une zone.')}
                        >
                          <option>{zone ?? tx('Aucune zone assignée')}</option>
                        </select>
                        <FaIcon
                          name="expand_more"
                          className="pointer-events-none absolute right-md top-1/2 -translate-y-1/2 text-[20px] text-text-secondary"
                        />
                      </div>
                      <p className="font-micro text-micro text-text-secondary">
                        {tx('Champ en lecture seule : `zone_id` se change par l’administration.')}
                      </p>
                    </div>

                    <div className="flex justify-end pt-xs sm:col-span-2">
                      <button type="submit" className={CTA_MAIN} disabled={!modifie || saving}>
                        <FaIcon name="save" className="text-[18px]" />
                        {saving ? tx('Enregistrement…') : tx('Mettre à jour le profil')}
                      </button>
                    </div>
                  </form>

                  {/* Zone & position d'intervention — Google Maps (repli OSM sans clé) */}
                  <CarteZoneGoogle zoneId={profile.zoneId} zoneNom={profile.zone} />
                </section>

                {/* Carte 2 : Véhicule & Conformité */}
                <section className={clsx(CARD, 'tokpa-rise')} style={{ animationDelay: '90ms' }}>
                  <div className="flex items-center justify-between gap-sm">
                    <div className="flex items-center gap-sm">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary-container">
                        <FaIcon name="two_wheeler" className="text-[20px]" />
                      </span>
                      <div>
                        <h2 className="font-h2 text-h2 font-semibold text-text-main">
                          {tx('Véhicule & Conformité')}
                        </h2>
                        <p className="font-secondary text-micro text-text-secondary">
                          {tx('Informations d’immatriculation et documents agréés')}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const puce = puceConformite(profile.documents.length);
                      return (
                        <span className={clsx(CHIP, puce.ton === 'ok' ? CHIP_TONE.ok : CHIP_TONE.warn)}>
                          {puce.cle === 'Dossier vide'
                            ? tx('Dossier vide')
                            : tr(puce.cle, profile.documents.length + ' document(s) on file')}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Bandeau véhicule (surface-container-low dans la maquette) */}
                  <div className="flex items-center justify-between gap-md rounded-xl bg-surface-container-low p-md">
                    <div className="flex min-w-0 items-center gap-md">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bg-card text-primary-dark shadow-sm">
                        <FaIcon name="two_wheeler" className="text-[26px]" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-label text-label font-bold text-on-surface">
                          {profile.vehiculeId
                            ? tr(`Véhicule #${profile.vehiculeId} au dossier`, `Vehicle #${profile.vehiculeId} on file`)
                            : tx('Aucun véhicule enregistré')}
                        </div>
                        <div className="mt-0.5 flex items-center gap-sm font-secondary text-secondary text-text-secondary">
                          <span>
                            {tx('Type :')} <strong>{'—'}</strong>
                          </span>
                          <span className="text-text-tertiary">•</span>
                          <span>
                            {tx('Plaque :')}{' '}
                            <span className="rounded bg-bg-card px-xs py-0.5 font-mono text-micro font-bold text-primary-deep">
                              {'—'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <FaIcon
                      name="info"
                      className="shrink-0 text-[22px] text-primary-hover"
                      title={tx('La table `vehicules` (nom, type, immatriculation) n’est exposée par aucune route : seul l’identifiant du livreur est connu.')}
                    />
                  </div>

                  {/* Pièces justificatives (livreurs.documents) */}
                  {profile.documents.length > 0 ? (
                    <div className="flex flex-col gap-sm">
                      {profile.documents.map((d, i) => (
                        <div
                          key={`${d.libelle}-${i}`}
                          className="tokpa-fade flex items-center justify-between gap-md rounded-xl bg-bg-secondary p-sm px-md"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <div className="flex min-w-0 items-center gap-sm">
                            <FaIcon
                              name={iconePiece(d.libelle)}
                              className="shrink-0 text-[20px] text-text-secondary"
                            />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-label text-label font-medium text-text-main">
                                {d.libelle}
                              </span>
                              <span className="font-micro text-micro text-text-secondary">
                                {d.valeur ?? tx('Référence non renseignée')}
                              </span>
                            </div>
                          </div>
                          <span className={clsx(CHIP, pieceValidee(d.statut) ? CHIP_TONE.ok : CHIP_TONE.warn)}>
                            {pieceValidee(d.statut) ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-success" />
                            ) : null}
                            {d.statut
                              ? d.statut.replace(/_/g, ' ')
                              : tx('Non vérifié')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-sm rounded-xl border border-dashed border-border-default bg-bg-secondary px-md py-lg text-center">
                      <FaIcon name="info" className="text-[24px] text-text-tertiary" />
                      <p className="font-label text-label font-medium text-text-main">
                        {tx('Aucune pièce au dossier')}
                      </p>
                      <p className="max-w-[420px] font-body text-body text-text-secondary">
                        {tx('La maquette affiche permis, assurance et CNI : le champ `documents` du livreur est vide, rien n’est inventé.')}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col items-start justify-between gap-sm pt-xs sm:flex-row sm:items-center">
                    <span className="font-micro text-micro text-text-secondary">
                      {tx('Dernière vérification : —')}
                    </span>
                    <button
                      type="button"
                      disabled
                      className={CTA_SOFT}
                      title={tx('Aucune route de dépôt de fichiers : le dossier est complété par l’administration.')}
                      onClick={() => toast(tx('Dépôt de pièces indisponible côté livreur.'), { id: 'livreur-settings-doc' })}
                    >
                      {tx('Mettre à jour les pièces')}
                    </button>
                  </div>
                </section>

                {/* Carte 5 : Sécurité & Connexion (emplacement laissé vide par la maquette) */}
                <section className={clsx(CARD, 'tokpa-rise')} style={{ animationDelay: '140ms' }}>
                  <div className="flex items-center justify-between gap-sm">
                    <div className="flex items-center gap-sm">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary-container">
                        <FaIcon name="lock" className="text-[18px]" />
                      </span>
                      <div>
                        <h2 className="font-h2 text-h2 font-semibold text-text-main">
                          {tx('Sécurité & Connexion')}
                        </h2>
                        <p className="font-secondary text-micro text-text-secondary">
                          {tx('Mot de passe du compte et fermeture de session')}
                        </p>
                      </div>
                    </div>
                    <span className={clsx(CHIP, CHIP_TONE.mute)}>
                      <FaIcon name="vpn_key" className="text-[14px]" />
                      {tx('POST /auth/change-password')}
                    </span>
                  </div>

                  {!securiteOuverte ? (
                    <button
                      type="button"
                      onClick={() => setSecuriteOuverte(true)}
                      className="flex items-center justify-between gap-md rounded-xl bg-bg-secondary p-md text-left transition-all hover:bg-bg-app"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="font-label text-label font-bold text-text-main">
                          {tx('Changer le mot de passe')}
                        </span>
                        <span className="font-micro text-micro text-text-secondary">
                          {tx('Minimum 8 caractères, confirmation obligatoire (règle du backend).')}
                        </span>
                      </span>
                      <FaIcon name="chevron_right" className="shrink-0 text-[20px] text-text-secondary" />
                    </button>
                  ) : (
                    <form onSubmit={changerMotDePasse} className="tokpa-pop flex flex-col gap-sm rounded-xl bg-bg-secondary p-md">
                      {[
                        { id: 'actuel', label: tx('Mot de passe actuel'), valeur: motDePasseActuel, set: setMotDePasseActuel, auto: 'current-password' },
                        { id: 'nouveau', label: tx('Nouveau mot de passe'), valeur: nouveauMotDePasse, set: setNouveauMotDePasse, auto: 'new-password' },
                        { id: 'confirmation', label: tx('Confirmer le nouveau mot de passe'), valeur: confirmation, set: setConfirmation, auto: 'new-password' },
                      ].map((c) => (
                        <div key={c.id} className="flex flex-col gap-xs">
                          <label className={LABEL} htmlFor={`mdp-${c.id}`}>
                            {c.label}
                          </label>
                          <input
                            id={`mdp-${c.id}`}
                            type={afficherMdp ? 'text' : 'password'}
                            value={c.valeur}
                            onChange={(e) => c.set(e.target.value)}
                            autoComplete={c.auto}
                            className={INPUT}
                          />
                        </div>
                      ))}

                      <div className="flex items-center gap-md">
                        <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              className={clsx(
                                'h-full flex-1 rounded-full transition-colors',
                                i <= forceMdp ? 'bg-success' : 'bg-border-default',
                              )}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAfficherMdp((v) => !v)}
                          className="font-label text-label font-medium text-text-secondary transition-colors hover:text-text-main"
                        >
                          {afficherMdp ? tx('Masquer') : tx('Afficher')}
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-sm pt-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSecuriteOuverte(false);
                            setMotDePasseActuel('');
                            setNouveauMotDePasse('');
                            setConfirmation('');
                          }}
                          className="font-label text-label font-medium text-text-secondary transition-colors hover:text-text-main"
                        >
                          {tx('Annuler')}
                        </button>
                        <button type="submit" className={CTA_MAIN} disabled={savingMdp}>
                          <FaIcon name="save" className="text-[16px]" />
                          {savingMdp ? tx('Mise à jour…') : tx('Mettre à jour le mot de passe')}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="flex flex-col items-start justify-between gap-sm border-t border-border-default pt-md sm:flex-row sm:items-center">
                    <p className="font-micro text-micro text-text-secondary">
                      {tx('La déconnexion appelle POST /auth/logout puis efface la session locale.')}
                    </p>
                    <button
                      type="button"
                      onClick={() => void deconnexion()}
                      className="flex items-center gap-xs rounded-[10px] border border-border-default px-md py-xs font-label text-label font-medium text-error transition-all hover:bg-bg-app active:scale-95"
                    >
                      <FaIcon name="logout" className="text-[16px]" />
                      {tx('Déconnexion')}
                    </button>
                  </div>
                </section>
              </div>

              {/* ================= Colonne 2 : gains + préférences ================= */}
              <div className="flex flex-col gap-lg lg:col-span-6">
                {/* Carte 3 : Reversement des gains */}
                <section className={clsx(CARD, 'tokpa-rise')} style={{ animationDelay: '60ms' }}>
                  <div className="flex items-center justify-between gap-sm">
                    <div className="flex items-center gap-sm">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary-container">
                        <FaIcon name="account_balance_wallet" className="text-[20px]" />
                      </span>
                      <div>
                        <h2 className="font-h2 text-h2 font-semibold text-text-main">
                          {tx('Reversement des gains')}
                        </h2>
                        <p className="font-secondary text-micro text-text-secondary">
                          {tx('Soldes et modes de versement automatique')}
                        </p>
                      </div>
                    </div>
                    <FaIcon name="payments" className="text-[20px] text-text-tertiary" />
                  </div>

                  {/* Bandeau solde : structure de la maquette, montant non servi par l'API */}
                  <div className="relative flex items-center justify-between gap-md overflow-hidden rounded-xl bg-gradient-to-r from-primary-deep via-primary-container to-primary p-lg text-white shadow-md">
                    <div className="relative z-10 flex flex-col">
                      <span className="font-micro text-micro uppercase tracking-wider text-primary-tint">
                        {tx('Solde disponible pour retrait')}
                      </span>
                      <div className="mt-xs flex items-baseline gap-xs">
                        <span className="font-h1 text-[32px] font-bold tracking-tight">—</span>
                        <span className="font-label text-h3 font-semibold text-primary-light">FCFA</span>
                      </div>
                      <span className="mt-xs font-secondary text-micro text-primary-tint">
                        {tx('Prochain virement : —')}
                      </span>
                    </div>
                    <div className="relative z-10">
                      <button
                        type="button"
                        disabled
                        title={tx('Aucune route de versement n’est exposée par le backend.')}
                        className="rounded-[10px] bg-white px-md py-sm font-label text-label font-bold text-primary-container shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {tx('Demander un retrait')}
                      </button>
                    </div>
                    <svg
                      className="pointer-events-none absolute -bottom-6 -right-6 h-36 w-36 text-white opacity-10"
                      fill="currentColor"
                      viewBox="0 0 100 100"
                      aria-hidden="true"
                    >
                      <circle cx="50" cy="50" r="45" />
                    </svg>
                  </div>

                  <div className="flex flex-col gap-xs">
                    <label className={clsx(LABEL, 'font-medium')}>{tx('Mode de versement principal')}</label>
                    {(
                      [
                        ['MTN', tx('MTN Mobile Money Bénin'), 'bg-amber-hover'],
                        ['MOOV', tx('Moov Africa Money'), 'bg-info'],
                      ] as [string, string, string][]
                    ).map(([, nom], i) => (
                      <div
                        key={nom}
                        className="flex items-center justify-between gap-md rounded-xl bg-bg-secondary p-md opacity-70"
                      >
                        <div className="flex items-center gap-md">
                          <span
                            className={clsx(
                              'flex h-10 w-10 items-center justify-center rounded-full font-micro font-bold text-white shadow-sm',
                              i === 0 ? 'bg-amber-hover' : 'bg-info',
                            )}
                          >
                            {i === 0 ? 'MTN' : 'MOOV'}
                          </span>
                          <span className="flex flex-col">
                            <span className="font-label text-label font-medium text-text-main">{nom}</span>
                            <span className="font-secondary text-micro text-text-secondary">
                              {tx('Aucun numéro de versement au dossier')}
                            </span>
                          </span>
                        </div>
                        <span className={clsx(CHIP, CHIP_TONE.mute)}>{tx('Non configuré')}</span>
                      </div>
                    ))}
                    <p className="font-micro text-micro text-text-secondary">
                      {tx('Les canaux de la maquette (MTN, Moov, RIB bancaire) n’ont pas d’équivalent en base : aucune ligne sélectionnable.')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-xs pt-xs">
                    <label className={clsx(LABEL, 'font-medium')}>
                      {tx('Fréquence des virements automatiques')}
                    </label>
                    <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                      {[tx('Quotidienne (Chaque soir)'), tx('Hebdomadaire (Tous les lundis)')].map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled
                          title={tx('Réglage réservé à l’administration.')}
                          className="cursor-not-allowed rounded-[10px] bg-bg-secondary px-md py-sm font-label text-label font-medium text-text-secondary"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-xs">
                    <button type="button" disabled className={CTA_SOFT} title={tx('Aucune route d’enregistrement des préférences de versement.')}>
                      {tx('Enregistrer les préférences bancaires')}
                    </button>
                  </div>
                </section>

                {/* Carte 4 : Préférences de livraison & notifications (emplacement maquette) */}
                <section className={clsx(CARD, 'tokpa-rise')} style={{ animationDelay: '110ms' }}>
                  <div className="flex items-center gap-sm">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary-container">
                      <FaIcon name="notifications" className="text-[18px]" />
                    </span>
                    <div>
                      <h2 className="font-h2 text-h2 font-semibold text-text-main">
                        {tx('Préférences de course & Notifications')}
                      </h2>
                      <p className="font-secondary text-micro text-text-secondary">
                        {tx('Langue de l’interface et historique des alertes')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-sm">
                    <div className="flex items-center justify-between gap-md rounded-xl bg-bg-secondary p-md">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-label text-label font-bold text-text-main">{tx('Langue')}</span>
                        <span className="font-micro text-micro text-text-secondary">
                          {tx('Le choix est partagé avec les autres écrans de l’application.')}
                        </span>
                      </div>
                      <LangToggle />
                    </div>

                    <div className="flex items-center justify-between gap-md rounded-xl bg-bg-secondary p-md">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-label text-label font-bold text-text-main">
                          {tx('Notifications de course')}
                        </span>
                        <span className="font-micro text-micro text-text-secondary">
                          {tx('Attributions, annulations et messages clients.')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate({ to: '/notifications' })}
                        className={CTA_SOFT}
                      >
                        <FaIcon name="history" className="text-[16px]" />
                        {tx('Historique des notifications')}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* ---------------- Barre d'actions basse ---------------- */}
            {/* La maquette la colle en `sticky bottom-0` ; dans l'espace livreur, la barre de nav
                mobile est déjà fixe en bas : la laisser dans le flux évite le chevauchement. */}
            <div
              className={clsx(
                CARD,
                'mt-xl flex-col sm:flex-row sm:items-center sm:justify-between',
              )}
            >
              <div className="flex items-start gap-sm font-secondary text-secondary text-text-secondary">
                <FaIcon
                  name={modifie ? 'pending_actions' : 'check_circle'}
                  className={clsx('mt-0.5 shrink-0 text-[20px]', modifie ? 'text-amber-text' : 'text-success')}
                />
                <span>
                  {modifie
                    ? tx('Ces modifications ne sont pas encore enregistrées sur votre compte.')
                    : tx('Votre profil correspond à ce que le serveur a enregistré.')}
                </span>
              </div>
              <div className="flex w-full items-center gap-md sm:w-auto">
                <button
                  type="button"
                  onClick={annuler}
                  disabled={!modifie}
                  className="w-1/2 rounded-[10px] px-lg py-sm font-label text-label font-medium text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-main disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  {tx('Annuler')}
                </button>
                <button
                  type="button"
                  onClick={() => void enregistrer()}
                  disabled={!modifie || saving}
                  className="flex w-1/2 items-center justify-center gap-xs rounded-[10px] bg-primary-container px-lg py-sm font-label text-label font-bold text-white shadow-md transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <FaIcon name="done_all" className="text-[18px]" />
                  {tx('Enregistrer toutes les modifications')}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </LivreurLayout>
  );
}

/** Champ affiché mais non modifiable : le motif est lu à l'écran, pas seulement en infobulle. */
function ChampLibre({
  label,
  valeur,
  motif,
  icone,
}: {
  label: string;
  valeur: string | null;
  motif: string;
  icone: string;
}) {
  const contenu: ReactNode = (
    <div className="flex items-center gap-sm rounded-[10px] bg-bg-card px-md py-sm shadow-sm">
      <FaIcon name={icone} className="shrink-0 text-[16px] text-text-tertiary" title={motif} />
      <span className="min-w-0 flex-1 truncate font-body text-body text-text-main">
        {valeur ?? tx('Non renseigné')}
      </span>
    </div>
  );
  return (
    <div className="flex flex-col gap-xs">
      <span className={LABEL}>{label}</span>
      {contenu}
      <p className="font-micro text-micro text-text-secondary">{motif}</p>
    </div>
  );
}
