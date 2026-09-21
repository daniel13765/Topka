import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { faArrowLeft, faArrowRight, faCheck, faEye, faEyeSlash, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { useCompleteRegistrationMutation, useStartRegistrationMutation, type RegistrationProfilePayload } from '../../services/api/authApi';

const initialProfile: RegistrationProfilePayload = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  city: '',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState<RegistrationProfilePayload>(initialProfile);
  const [registrationId, setRegistrationId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [startRegistration, { isLoading: isStarting }] = useStartRegistrationMutation();
  const [completeRegistration, { isLoading: isCompleting }] = useCompleteRegistrationMutation();

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
  }), [password]);
  const strength = Object.values(passwordChecks).filter(Boolean).length;
  const strengthLabel = strength === 0 ? 'À définir' : strength < 3 ? 'À renforcer' : 'Bonne sécurité';

  const updateProfile = (field: keyof RegistrationProfilePayload, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.phone || !profile.city) {
      setError('Complétez tous les champs obligatoires avant de continuer.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(profile.email)) {
      setError('Saisissez une adresse e-mail valide.');
      return;
    }
    try {
      const result = await startRegistration(profile).unwrap();
      setRegistrationId(result.registrationId);
      sessionStorage.setItem('tokpa-registration', JSON.stringify({ ...result, profile }));
      setStep(2);
    } catch {
      setError('Impossible de démarrer l’inscription pour le moment.');
    }
  };

  const handleSecuritySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (strength < 3) {
      setError('Votre mot de passe doit contenir au moins 8 caractères, un chiffre et une majuscule.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!acceptTerms) {
      setError('Vous devez accepter les conditions d’utilisation pour créer votre compte.');
      return;
    }
    try {
      const result = await completeRegistration({ registrationId, password, passwordConfirmation, acceptTerms, smsAlerts }).unwrap();
      sessionStorage.setItem('tokpa-registration', JSON.stringify({ ...result, profile }));
      navigate('/verification-email', { state: { email: result.email, registrationId: result.registrationId, demoCode: result.demoCode } });
    } catch {
      setError('Impossible de finaliser l’inscription pour le moment.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="text-2xl font-black tracking-tight text-slate-950">TOK<span className="text-brand-500">Pa</span></Link>
          <Badge tone="green"><Icon icon={faShieldHalved} className="mr-2" />Bénin · sécurisé</Badge>
        </div>

        <section className="motion-enter mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-orange-50 px-6 py-7 text-center sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Ton marché, ta façon</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Créer votre compte</h1>
            <p className="mt-2 text-sm text-slate-500">Rejoignez le marché digital béninois</p>
          </div>

          <div className="px-6 pt-7 sm:px-10">
            <div className="flex items-start">
              <div className={`flex flex-1 items-center gap-3 text-sm font-bold ${step >= 1 ? 'text-brand-600' : 'text-slate-400'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white">{step > 1 ? <Icon icon={faCheck} /> : '1'}</span><span className="hidden sm:block">Profil</span></div>
              <span className={`mt-4 h-0.5 flex-1 ${step > 1 ? 'bg-brand-500' : 'bg-slate-200'}`} />
              <div className={`flex flex-1 items-center justify-end gap-3 text-sm font-bold ${step === 2 ? 'text-brand-600' : 'text-slate-400'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${step === 2 ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>2</span><span className="hidden sm:block">Sécurité</span></div>
            </div>
          </div>

          {error && <div role="alert" className="mx-6 mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:mx-10">{error}</div>}

          {step === 1 ? (
            <form onSubmit={(event) => void handleProfileSubmit(event)} className="space-y-5 px-6 py-8 sm:px-10">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="field-label">Prénom<input value={profile.firstName} onChange={(event) => updateProfile('firstName', event.target.value)} placeholder="Ex: Jean" className="field-input" autoComplete="given-name" /></label>
                <label className="field-label">Nom de famille<input value={profile.lastName} onChange={(event) => updateProfile('lastName', event.target.value)} placeholder="Ex: Dossou" className="field-input" autoComplete="family-name" /></label>
              </div>
              <label className="field-label">Adresse e-mail<input value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} type="email" placeholder="jean.dossou@email.com" className="field-input" autoComplete="email" /></label>
              <label className="field-label">Numéro de téléphone<div className="flex overflow-hidden rounded-xl border border-slate-300 transition focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-100"><span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600">BJ +229</span><input value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} placeholder="01 00 00 00" className="min-w-0 flex-1 border-0 px-3 py-3 text-sm outline-none" autoComplete="tel" /></div></label>
              <label className="field-label">Ville / Zone<select value={profile.city} onChange={(event) => updateProfile('city', event.target.value)} className="field-input"><option value="">Sélectionner votre ville</option><option>Cotonou</option><option>Abomey-Calavi</option><option>Porto-Novo</option><option>Ouidah</option></select></label>
              <button type="submit" disabled={isStarting} className="btn-primary w-full py-3.5">{isStarting ? 'Vérification…' : 'Continuer'} <Icon icon={faArrowRight} className="ml-2" /></button>
            </form>
          ) : (
            <form onSubmit={(event) => void handleSecuritySubmit(event)} className="space-y-5 px-6 py-8 sm:px-10">
              <div><p className="text-sm font-bold text-slate-700">Sécurisez votre compte</p><p className="mt-1 text-sm leading-6 text-slate-500">Choisissez un mot de passe fort. Nous enverrons ensuite un code à votre adresse e-mail.</p></div>
              <label className="field-label">Mot de passe<div className="relative"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="field-input pr-11" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Afficher le mot de passe"><Icon icon={showPassword ? faEyeSlash : faEye} /></button></div></label>
              <div><div className="flex items-center justify-between text-xs text-slate-500"><span>Force du mot de passe</span><strong className={strength === 3 ? 'text-emerald-600' : 'text-slate-400'}>{strengthLabel}</strong></div><div className="mt-2 grid grid-cols-3 gap-1"><span className={`h-1.5 rounded-full ${strength >= 1 ? 'bg-orange-400' : 'bg-slate-200'}`} /><span className={`h-1.5 rounded-full ${strength >= 2 ? 'bg-orange-400' : 'bg-slate-200'}`} /><span className={`h-1.5 rounded-full ${strength >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} /></div><p className="mt-2 text-xs text-slate-400">Au moins 8 caractères, dont 1 chiffre et 1 lettre majuscule.</p></div>
              <label className="field-label">Confirmer le mot de passe<div className="relative"><input value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} type={showConfirmation ? 'text' : 'password'} placeholder="••••••••" className="field-input pr-11" autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmation((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Afficher la confirmation"><Icon icon={showConfirmation ? faEyeSlash : faEye} /></button></div></label>
              <label className="flex items-start gap-3 text-sm leading-5 text-slate-600"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-1 accent-orange-500" /> <span>J’accepte les <a href="#conditions" className="font-semibold text-brand-600 underline">Conditions Générales d’Utilisation</a> et la <a href="#confidentialite" className="font-semibold text-brand-600 underline">Politique de confidentialité</a> de TOKPa.</span></label>
              <label className="flex items-start gap-3 text-sm leading-5 text-slate-600"><input type="checkbox" checked={smsAlerts} onChange={(event) => setSmsAlerts(event.target.checked)} className="mt-1 accent-orange-500" /> <span>Recevoir les alertes de sécurité et codes OTP par SMS (+229).</span></label>
              <button type="submit" disabled={isCompleting} className="btn-primary w-full py-3.5">{isCompleting ? 'Création…' : 'Créer mon compte'} <Icon icon={faArrowRight} className="ml-2" /></button>
              <button type="button" onClick={() => { setError(''); setStep(1); }} className="mx-auto flex items-center text-sm font-semibold text-slate-500 hover:text-brand-600"><Icon icon={faArrowLeft} className="mr-2" /> Retour à l’étape précédente</button>
            </form>
          )}

          <div className="border-t border-slate-100 px-6 py-6 text-center text-sm text-slate-500 sm:px-10">Vous avez déjà un compte ? <Link to="/connexion" className="font-bold text-brand-600 hover:text-brand-700">Se connecter</Link></div>
        </section>
      </div>
    </main>
  );
}
