import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import MIcon from '../../components/shared/MIcon';
import LangToggle from '../../components/shared/LangToggle';
import PasswordInput from '../../components/auth/PasswordInput';
import { authApi } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * Page Réinitialisation du mot de passe — appelée depuis le lien email envoyé
 * par POST /api/auth/forgot-password :
 *   {FRONTEND_URL}/reset-password?token=...&email=...
 * Envoi : POST /api/auth/reset-password {email, token, password, password_confirmation}
 */
export default function ResetPasswordPage() {
  useLanguage();
  const navigate = useNavigate();
  const { token, email } = useSearch({ from: '/reset-password' });

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = !token || !email;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(tx("Le mot de passe doit contenir au moins 8 caractères."));
      return;
    }
    if (password !== confirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        email: email as string,
        token: token as string,
        password,
        password_confirmation: confirmation,
      });
      toast.success(res.message || tx("Mot de passe réinitialisé avec succès."));
      navigate({ to: '/connexion' });
    } catch (err: unknown) {
      console.warn('Reset password error:', err);
      const detail = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(detail?.message || tx("Lien de réinitialisation invalide ou expiré."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app p-4 font-body text-text-main">
      <div className="fixed right-4 top-4 z-50"><LangToggle /></div>
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-6 md:p-8 shadow-sm border border-border-default">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-tint border border-primary-light">
            <MIcon name="lock_reset" className="text-primary-container text-[36px]" />
          </div>
          <h1 className="mb-1 text-h2 font-bold text-text-main">{tx("Réinitialiser le mot de passe")}</h1>
          <p className="max-w-[320px] text-xs text-text-secondary leading-relaxed">
            {missing
              ? tx("Ce lien de réinitialisation est incomplet (token ou email manquant).")
              : `Choisissez un nouveau mot de passe pour ${email}.`}
          </p>
        </div>

        {missing ? (
          <div className="mt-8">
            <Link
              to="/connexion"
              className="block w-full bg-primary-container hover:bg-primary-hover text-white font-bold py-3 rounded-lg shadow-md transition-all text-center cursor-pointer"
            >
              {tx("Retour à la connexion")}
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <PasswordInput
              label={tx("Nouveau mot de passe")}
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tx("8 caractères minimum")}
            />
            <PasswordInput
              label={tx("Confirmer le mot de passe")}
              id="confirm-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={tx("Répétez le mot de passe")}
            />

            {error && (
              <div className="p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password.length === 0}
              className="w-full bg-primary-container hover:bg-primary-hover text-white font-bold py-3 rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? tx("Réinitialisation…") : 'Réinitialiser le mot de passe'}
            </button>
          </form>
        )}

        <div className="mt-6 flex justify-center">
          <Link to="/connexion" className="text-xs font-medium text-text-secondary hover:text-text-main transition-colors">
            {tx("Retour à la connexion")}
          </Link>
        </div>
      </div>
    </div>
  );
}
