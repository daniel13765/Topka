import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import MIcon from '../../components/shared/MIcon';
import LangToggle from '../../components/shared/LangToggle';
import { authApi } from '../../services/api';
import { extractApiError, formatApiError } from '../../utils/apiError';
import { passwordScore } from '../../utils/passwordScore';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


const profilSchema = () => z.object({
  prenom: z.string().min(2, tx('Prénom requis')),
  nom: z.string().min(2, tx('Nom requis')),
  email: z.string().email(tx('Email invalide')),
  telephone: z.string().regex(/^\d{8,10}$/, tx('8 à 10 chiffres attendus')),
  ville: z.string().min(1, tx('Sélectionnez votre ville')),
});

const securitySchema = () => z.object({
  password: z
    .string()
    .min(8, tx('Au moins 8 caractères'))
    .regex(/\d/, tx('Au moins 1 chiffre'))
    .regex(/[A-Z]/, tx('Au moins 1 lettre majuscule')),
  confirm: z.string(),
  cgu: z.boolean().refine((v) => v, tx('Vous devez accepter les CGU')),
}).refine((d) => d.password === d.confirm, {
  message: tx('Les mots de passe ne correspondent pas'),
  path: ['confirm'],
});

const VILLES = ['Cotonou', 'Abomey-Calavi', 'Porto-Novo', 'Parakou', 'Bohicon', 'Natitingou'];

const STRENGTH = [
  { label: 'À définir', color: 'bg-border-default', text: 'text-text-tertiary' },
  { label: 'Faible', color: 'bg-error', text: 'text-error-dark' },
  { label: 'Moyen', color: 'bg-[#F59E0B]', text: 'text-amber-text' },
  { label: 'Bon', color: 'bg-success', text: 'text-success-dark' },
  { label: 'Fort', color: 'bg-success-dark', text: 'text-success-dark' },
];

type ProfilErrors = Partial<Record<'prenom' | 'nom' | 'email' | 'telephone' | 'ville', string>>;
type SecurityErrors = Partial<Record<'password' | 'confirm' | 'cgu', string>>;

/**
 * Page Inscription (Profil + Sécurité) — Intégration API Backend Laravel + UI Stitch
 */
export default function InscriptionPage() {
  useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  const [profil, setProfil] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    ville: 'Cotonou',
  });
  const [profilErrors, setProfilErrors] = useState<ProfilErrors>({});

  const [security, setSecurity] = useState({
    password: '',
    confirm: '',
    cgu: false,
    sms: true,
  });
  const [securityErrors, setSecurityErrors] = useState<SecurityErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const setProfilField = <K extends keyof typeof profil>(key: K, value: string) =>
    setProfil((f) => ({ ...f, [key]: value }));

  const handleProfilSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = profilSchema().safeParse(profil);
    if (!result.success) {
      const next: ProfilErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ProfilErrors;
        if (!next[key]) next[key] = issue.message;
      }
      setProfilErrors(next);
      return;
    }
    setProfilErrors({});
    setStep(2);
    window.scrollTo({ top: 0 });
  };

  const handleSecuritySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const result = securitySchema().safeParse(security);
    if (!result.success) {
      const next: SecurityErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof SecurityErrors;
        if (!next[key]) next[key] = issue.message;
      }
      setSecurityErrors(next);
      return;
    }
    setSecurityErrors({});
    setLoading(true);

    try {
      // API call POST /api/auth/register
      const res = await authApi.register({
        nom: profil.nom,
        prenom: profil.prenom,
        email: profil.email,
        telephone: `229${profil.telephone}`,
        password: security.password,
        role: 'client',
        quartier: profil.ville,
      });

      toast.success(res.message || tx("Compte créé ! Code 2FA envoyé."));
      localStorage.setItem('tokpa_pending_email', profil.email);
      navigate({ to: '/verification-2fa' });
    } catch (err: unknown) {
      console.warn('API Register error:', err);
      const info = extractApiError(err);
      const text = formatApiError(info);
      setApiError(text);
      toast.error(text);

      // Erreurs de champs (422) → sous les inputs correspondants
      const profilNext: ProfilErrors = {};
      const securityNext: SecurityErrors = {};
      for (const [field, msgs] of Object.entries(info.fieldErrors)) {
        const msg = Array.isArray(msgs) ? msgs[0] : String(msgs);
        if (field === 'prenom' || field === 'nom' || field === 'email' || field === 'telephone' || field === 'ville') {
          profilNext[field] = msg;
        } else if (field === 'password') {
          securityNext[field] = msg;
        }
      }
      if (Object.keys(profilNext).length > 0) setProfilErrors((prev) => ({ ...prev, ...profilNext }));
      if (Object.keys(securityNext).length > 0) setSecurityErrors((prev) => ({ ...prev, ...securityNext }));
    } finally {
      setLoading(false);
    }
  };

  const score = passwordScore(security.password);
  const strength = STRENGTH[score];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-app p-4 md:p-6 font-body text-text-main">
      <div className="fixed right-4 top-4 z-50"><LangToggle /></div>
      <div className="w-full max-w-[700px] overflow-hidden rounded-2xl bg-white shadow-sm border border-border-default">
        {/* Header Banner */}
        <header className="relative h-28 overflow-hidden bg-primary-tint border-b border-primary-light flex items-center justify-center">
          <div className="flex flex-col items-center">
            <Link to="/" className="text-2xl font-bold tracking-tight text-primary-container">
              TOKPa
            </Link>
            <span className="mt-1 text-xs font-semibold tracking-widest text-primary-dark uppercase">
              {tx("Ton marché, ta façon")}
            </span>
          </div>
          {step === 2 && (
            <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-text-secondary border border-border-default shadow-xs">
              <span className="h-2 w-2 rounded-full bg-success" />
              {tx("Bénin (+229)")}
            </span>
          )}
        </header>

        {/* Body */}
        <div className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-h2 font-bold text-text-main">{tx("Créer votre compte")}</h1>
            <p className="mt-1 text-sm text-text-secondary">{tx("Rejoignez le marché digital béninois")}</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs',
                  step === 1 ? 'bg-primary-container text-white' : 'bg-success text-white',
                )}
              >
                {step === 1 ? '1' : <MIcon name="check" className="text-sm" />}
              </div>
              <span className={clsx('text-xs font-bold', step === 1 ? 'text-primary-container' : 'text-success')}>
                {tx("Profil")}
              </span>
            </div>

            <div className={clsx('h-0.5 w-12', step === 2 ? 'bg-primary-container' : 'bg-border-default')} />

            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs',
                  step === 2 ? 'bg-primary-container text-white' : 'bg-bg-app text-text-tertiary border border-border-default',
                )}
              >
                2
              </div>
              <span className={clsx('text-xs font-bold', step === 2 ? 'text-primary-container' : 'text-text-tertiary')}>
                {tx("Sécurité")}
              </span>
            </div>
          </div>

          {/* STEP 1: PROFIL */}
          {step === 1 && (
            <form className="space-y-4" onSubmit={handleProfilSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{tx("Prénom")}</label>
                  <div className="relative">
                    <MIcon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Ex: Jean"
                      value={profil.prenom}
                      onChange={(e) => setProfilField('prenom', e.target.value)}
                      className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm outline-none ${
                        profilErrors.prenom ? 'border-error' : 'border-border-default focus:border-primary-container'
                      }`}
                    />
                  </div>
                  {profilErrors.prenom && <p className="mt-1 text-xs text-error">{profilErrors.prenom}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{tx("Nom de famille")}</label>
                  <div className="relative">
                    <MIcon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Ex: Dossou"
                      value={profil.nom}
                      onChange={(e) => setProfilField('nom', e.target.value)}
                      className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm outline-none ${
                        profilErrors.nom ? 'border-error' : 'border-border-default focus:border-primary-container'
                      }`}
                    />
                  </div>
                  {profilErrors.nom && <p className="mt-1 text-xs text-error">{profilErrors.nom}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{tx("Adresse email")}</label>
                <div className="relative">
                  <MIcon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="email"
                    placeholder="jean.dossou@email.com"
                    value={profil.email}
                    onChange={(e) => setProfilField('email', e.target.value)}
                    className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm outline-none ${
                      profilErrors.email ? 'border-error' : 'border-border-default focus:border-primary-container'
                    }`}
                  />
                </div>
                {profilErrors.email && <p className="mt-1 text-xs text-error">{profilErrors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{tx("Numéro de téléphone (+229)")}</label>
                <div className="relative">
                  <MIcon name="call" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="tel"
                    placeholder="90000000"
                    value={profil.telephone}
                    onChange={(e) => setProfilField('telephone', e.target.value.replace(/\s/g, ''))}
                    className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm outline-none ${
                      profilErrors.telephone ? 'border-error' : 'border-border-default focus:border-primary-container'
                    }`}
                  />
                </div>
                {profilErrors.telephone && <p className="mt-1 text-xs text-error">{profilErrors.telephone}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{tx("Ville / Zone")}</label>
                <div className="relative">
                  <MIcon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <select
                    value={profil.ville}
                    onChange={(e) => setProfilField('ville', e.target.value)}
                    className={`w-full pl-10 pr-8 py-2.5 rounded-lg border text-sm outline-none appearance-none bg-white ${
                      profilErrors.ville ? 'border-error' : 'border-border-default focus:border-primary-container'
                    }`}
                  >
                    {VILLES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <MIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
                </div>
                {profilErrors.ville && <p className="mt-1 text-xs text-error">{profilErrors.ville}</p>}
              </div>

              <button
                type="submit"
                className="w-full bg-primary-container hover:bg-primary-hover text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer mt-6"
              >
                <span>{tx("Continuer")}</span>
                <MIcon name="arrow_forward" />
              </button>

              <p className="text-center text-xs text-text-secondary mt-4">
                Déjà un compte ?{' '}
                <Link to="/connexion" className="font-bold text-primary-container hover:underline">
                  {tx("Se connecter")}
                </Link>
              </p>
            </form>
          )}

          {/* STEP 2: SÉCURITÉ */}
          {step === 2 && (
            <form className="space-y-4" onSubmit={handleSecuritySubmit}>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{tx("Mot de passe")}</label>
                <div className="relative">
                  <MIcon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={security.password}
                    onChange={(e) => setSecurity((s) => ({ ...s, password: e.target.value }))}
                    className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm outline-none ${
                      securityErrors.password ? 'border-error' : 'border-border-default focus:border-primary-container'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-main cursor-pointer"
                  >
                    <MIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-sm" />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-text-secondary">Force :</span>
                  <span className={clsx('text-xs font-bold', strength.text)}>{tx(strength.label)}</span>
                </div>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={clsx('h-1.5 flex-1 rounded-full transition-colors', i <= score ? strength.color : 'bg-border-default')}
                    />
                  ))}
                </div>
                <p className="mt-1 text-micro text-text-tertiary">
                  {tx("Au moins 8 caractères, dont 1 chiffre & 1 lettre majuscule.")}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{tx("Confirmer le mot de passe")}</label>
                <div className="relative">
                  <MIcon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={security.confirm}
                    onChange={(e) => setSecurity((s) => ({ ...s, confirm: e.target.value }))}
                    className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm outline-none ${
                      securityErrors.confirm ? 'border-error' : 'border-border-default focus:border-primary-container'
                    }`}
                  />
                </div>
                {securityErrors.confirm && <p className="mt-1 text-xs text-error">{securityErrors.confirm}</p>}
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={security.cgu}
                    onChange={(e) => setSecurity((s) => ({ ...s, cgu: e.target.checked }))}
                    className="mt-0.5 rounded text-primary-container focus:ring-primary-container border-border-default"
                  />
                  <span className="text-xs text-text-secondary leading-normal">
                    J'accepte les{' '}
                    <button
                      type="button"
                      onClick={() => toast('CGU TOKPa v2')}
                      className="font-bold text-primary-container underline"
                    >
                      {tx("Conditions Générales d'Utilisation")}
                    </button>{' '}
                    et la{' '}
                    <button
                      type="button"
                      onClick={() => toast(tx("Politique de confidentialité TOKPa"))}
                      className="font-bold text-primary-container underline"
                    >
                      {tx("Politique de confidentialité")}
                    </button>{' '}
                    de TOKPa.
                  </span>
                </label>
                {securityErrors.cgu && <p className="text-xs text-error pl-6">{securityErrors.cgu}</p>}

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={security.sms}
                    onChange={(e) => setSecurity((s) => ({ ...s, sms: e.target.checked }))}
                    className="mt-0.5 rounded text-primary-container focus:ring-primary-container border-border-default"
                  />
                  <span className="text-xs text-text-secondary leading-normal">
                    {tx("Recevoir les alertes d'accès sécurisé et codes OTP par SMS (+229).")}
                  </span>
                </label>
              </div>

              {apiError && (
                <div className="p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark leading-relaxed">
                  {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-container hover:bg-primary-hover text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer mt-6 disabled:opacity-50"
              >
                <span>{loading ? tx("Création...") : 'Créer mon compte'}</span>
                <MIcon name="arrow_forward" />
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="mx-auto flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-main transition-colors mt-3 cursor-pointer"
              >
                <MIcon name="arrow_back" className="text-sm" />
                {tx("Retour à l'étape 1 (Profil)")}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Trust Footer */}
      {step === 2 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-text-tertiary">
          <MIcon name="verified_user" className="text-success text-sm" />
          {tx("Données chiffrées SSL")}
          <span>•</span>
          <MIcon name="lock" className="text-primary-container text-sm" />
          {tx("Conforme APDP Bénin")}
        </p>
      )}
    </div>
  );
}
