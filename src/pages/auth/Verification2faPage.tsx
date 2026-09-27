import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import OtpInput from '../../components/auth/OtpInput';
import MIcon from '../../components/shared/MIcon';
import LangToggle from '../../components/shared/LangToggle';
import { authApi } from '../../services/api';
import { extractApiError, formatApiError } from '../../utils/apiError';
import { currentRole, postLoginTarget } from '../../routes/authGuard';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';


const INITIAL_SECONDS = 10 * 60; // TTL réel du backend (TwoFAService::TTL_MINUTES = 10)
const MAX_ATTEMPTS = 3;

const formatTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Page Vérification 2FA — Intégration API Backend Laravel + Mode Test / Démo
 */
export default function Verification2faPage() {
  useLanguage();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Email de la connexion (ou de l'inscription) en cours. Aucun email de repli : avant, sans connexion
  // en cours, la page utilisait « client@tokpa.bj », à qui « Renvoyer le code » envoyait un vrai code.
  const pendingEmail = localStorage.getItem('tokpa_pending_email');

  const expired = secondsLeft <= 0;
  const blocked = attemptsLeft <= 0;

  useEffect(() => {
    if (expired) return;
    const timer = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, [expired]);

  // Pas de connexion en cours (accès direct à /verification-2fa, email déjà utilisé) → retour à la connexion.
  useEffect(() => {
    if (pendingEmail) return;
    toast.error(tx("Aucune connexion en cours : saisissez d’abord votre email et votre mot de passe."), { id: '2fa-no-email' });
    navigate({ to: '/connexion', replace: true });
  }, [pendingEmail, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingEmail || code.length < 6 || expired || blocked) return;

    setLoading(true);
    setError(null);

    try {
      // Tentative d'appel API Backend POST /api/auth/verify-2fa
      const res = await authApi.verify2fa({ email: pendingEmail, code });
      localStorage.removeItem('tokpa_pending_email'); // connexion terminée : l'email en attente ne sert plus
      toast.success(res.message || tx("Authentification réussie !"));
      // Retour à la page demandée avant la connexion si ce rôle y a droit ; sinon l'espace du rôle
      // (admin → /admin, manager → /manager, client/livreur → accueil).
      navigate({ href: postLoginTarget(currentRole()) });
    } catch (err: unknown) {
      console.warn('API 2FA verification error:', err);
      // Pas de fallback factice : sans token réel du backend, on ne « connecte » personne.
      setError(formatApiError(extractApiError(err)));
      setAttemptsLeft((a) => a - 1);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    try {
      await authApi.resend2fa(pendingEmail);
      toast.success(tx("Un nouveau code OTP a été envoyé par email."));
      // Nouveau délai et nouvelles tentatives SEULEMENT si un code est vraiment parti
      // (avant : remis à zéro même en cas d'échec — limite atteinte, serveur arrêté…).
      setSecondsLeft(INITIAL_SECONDS);
      setAttemptsLeft(MAX_ATTEMPTS);
      setError(null);
      setCode('');
    } catch (err) {
      toast.error(formatApiError(extractApiError(err)));
    }
  };

  if (!pendingEmail) return null; // redirection vers /connexion en cours (effet ci-dessus)

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app p-4 font-body text-text-main">
      <div className="fixed right-4 top-4 z-50"><LangToggle /></div>
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-6 md:p-8 shadow-sm border border-border-default">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-tint border border-primary-light">
            <MIcon name="mark_email_read" className="text-primary-container text-[36px]" />
          </div>
          <h1 className="mb-1 text-h2 font-bold text-text-main">{tx("Vérifiez votre email")}</h1>
          <p className="max-w-[300px] text-xs text-text-secondary leading-relaxed">
            Nous avons envoyé un code de sécurité à 6 chiffres à{' '}
            <strong className="text-text-main">{pendingEmail}</strong>
          </p>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <OtpInput value={code} onChange={setCode} error={!!error} disabled={expired || blocked || loading} />

          <div className="flex flex-col items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2 text-xs font-semibold text-amber-text">
              <MIcon name="schedule" className="text-sm" />
              {expired ? tx("Code expiré") : tr(`Le code expire dans ${formatTime(secondsLeft)}`, `The code expires in ${formatTime(secondsLeft)}`)}
            </span>
          </div>

          {error && !blocked && (
            <div className="p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark text-center">
              {error}{' '}{tr(`Il vous reste ${attemptsLeft} tentative${attemptsLeft > 1 ? 's' : ''}.`, `You have ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} left.`)}
            </div>
          )}
          {blocked && (
            <div className="p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark text-center">
              {tx("Trop de tentatives erronées. Veuillez cliquer sur « Renvoyer le code ».")}
            </div>
          )}

          <button
            type="submit"
            disabled={code.length < 6 || expired || blocked || loading}
            className="w-full bg-primary-container hover:bg-primary-hover text-white font-bold py-3 rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? tx("Vérification...") : tx("Vérifier le code")}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            className="text-xs font-bold text-primary-container hover:underline cursor-pointer"
          >
            {tx("Renvoyer le code")}
          </button>
          <Link
            to="/connexion"
            className="text-xs font-medium text-text-secondary hover:text-text-main transition-colors"
          >
            {tx("Changer d'adresse email")}
          </Link>
        </div>
      </div>
    </div>
  );
}
