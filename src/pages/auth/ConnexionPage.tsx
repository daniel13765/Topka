import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import MIcon from '../../components/shared/MIcon';
import LangToggle from '../../components/shared/LangToggle';
import { authApi } from '../../services/api';
import { extractApiError, formatApiError } from '../../utils/apiError';
import { rememberRedirect } from '../../routes/authGuard';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * Page Connexion — Intégration API Backend Laravel + UI Stitch 100% fidèle
 */
export default function ConnexionPage() {
  useLanguage();
  const navigate = useNavigate();
  // Page demandée avant la connexion (?redirect=) : mémorisée pour y revenir après la 2FA ;
  // arrivée sans ?redirect= → on oublie toute ancienne demande.
  const { redirect: redirectTo } = useSearch({ from: '/connexion' });
  useEffect(() => {
    rememberRedirect(redirectTo);
  }, [redirectTo]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      // API call to Laravel backend POST /api/auth/login
      const res = await authApi.login({ email, password });
      toast.success(res.message || tx("Code 2FA envoyé par email."));
      localStorage.setItem('tokpa_pending_email', email);
      navigate({ to: '/verification-2fa' });
    } catch (err: unknown) {
      console.warn('API login error:', err);
      const info = extractApiError(err);
      setAuthError(
        info.status === 401
          ? info.message || tx("Email ou mot de passe incorrect.")
          : formatApiError(info),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen font-body text-text-main">
      <div className="fixed right-4 top-4 z-50"><LangToggle /></div>
      <main className="flex flex-col md:flex-row min-h-screen">
        {/* Left Column: Branding (Desktop) */}
        <section className="hidden md:flex md:w-[40%] bg-[#F97316] flex-col justify-between p-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <div className="relative z-10">
            <Link to="/" className="text-[36px] font-h1 font-bold text-white tracking-tight">
              TOKPa
            </Link>
          </div>
          <div className="relative z-10 flex flex-col items-center my-auto">
            <div className="w-full max-w-[280px] p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl mb-6 flex justify-center">
              <MIcon name="storefront" className="text-white text-[96px]" />
            </div>
            <div className="space-y-md w-full max-w-[280px]">
              <div className="flex items-center gap-sm text-white">
                <MIcon name="local_shipping" className="text-[20px]" />
                <span className="font-body text-body font-medium">{tx("Livraison rapide")}</span>
              </div>
              <div className="flex items-center gap-sm text-white">
                <MIcon name="handshake" className="text-[20px]" />
                <span className="font-body text-body font-medium">{tx("Prix négociables")}</span>
              </div>
              <div className="flex items-center gap-sm text-white">
                <MIcon name="location_on" className="text-[20px]" />
                <span className="font-body text-body font-medium">{tx("Suivi en temps réel")}</span>
              </div>
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-[18px] font-h3 text-white font-medium opacity-90">{tx("Ton marché, ta façon")}</p>
          </div>
        </section>

        {/* Right Column: Login Form */}
        <section className="flex-1 flex flex-col justify-center items-center bg-white p-lg md:p-[48px]">
          <div className="w-full max-w-[440px]">
            {/* Header */}
            <header className="mb-xl">
              <div className="md:hidden mb-lg">
                <Link to="/" className="text-[28px] font-bold text-[#F97316]">
                  TOKPa
                </Link>
              </div>
              <h2 className="text-[28px] font-h1 text-text-main font-bold mb-xs flex items-center gap-2">
                Bon retour 👋
              </h2>
              <p className="text-[14px] font-secondary text-text-secondary">
                {tx("Connectez-vous à votre compte TOKPa")}
              </p>
            </header>

            {/* Form */}
            <form className="space-y-lg" onSubmit={handleSubmit}>
              {/* Email Field */}
              <div className="space-y-xs">
                <label className="block text-[13px] font-label text-text-secondary" htmlFor="email">
                  {tx("Adresse email")}
                </label>
                <div className="relative">
                  <MIcon name="mail" className="absolute left-md top-1/2 -translate-y-1/2 text-text-secondary text-[20px]" />
                  <input
                    className={`w-full pl-[44px] pr-md py-sm border-[1.5px] rounded-[10px] bg-white text-text-main font-body text-body outline-none transition-all ${
                      authError ? 'border-error' : 'border-border-default focus:border-[#F97316]'
                    }`}
                    id="email"
                    name="email"
                    placeholder="nom@exemple.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-xs">
                <div className="flex justify-between items-center">
                  <label className="block text-[13px] font-label text-text-secondary" htmlFor="password">
                    {tx("Mot de passe")}
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email.trim()) {
                        toast.error('Renseignez d\'abord votre adresse email.');
                        return;
                      }
                      try {
                        const res = await authApi.forgotPassword(email.trim());
                        toast.success(res?.message || tx("Si un compte existe, un lien de réinitialisation a été envoyé."));
                      } catch (err) {
                        console.warn('Forgot password error:', err);
                        toast.error(formatApiError(extractApiError(err)));
                      }
                    }}
                    className="text-[13px] font-label text-[#F97316] hover:underline cursor-pointer"
                  >
                    {tx("Mot de passe oublié ?")}
                  </button>
                </div>
                <div className="relative">
                  <MIcon name="lock" className="absolute left-md top-1/2 -translate-y-1/2 text-text-secondary text-[20px]" />
                  <input
                    className={`w-full pl-[44px] pr-[44px] py-sm border-[1.5px] rounded-[10px] bg-white text-text-main font-body text-body outline-none transition-all ${
                      authError ? 'border-error' : 'border-border-default focus:border-[#F97316]'
                    }`}
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-md top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-main cursor-pointer"
                  >
                    <MIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  className="w-4 h-4 text-[#F97316] border-border-default rounded focus:ring-[#F97316] cursor-pointer"
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <label className="ml-sm text-[13px] font-secondary text-text-secondary cursor-pointer select-none" htmlFor="remember">
                  {tx("Se souvenir de moi")}
                </label>
              </div>

              {/* Submit Button */}
              <div className="space-y-md">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F97316] hover:bg-primary-hover text-white font-bold py-sm rounded-[10px] transition-all active:scale-[97%] duration-200 cursor-pointer disabled:opacity-50"
                >
                  {loading ? tx("Connexion en cours...") : 'Se connecter'}
                </button>

                {/* Error Message */}
                {authError && (
                  <div className="flex items-center gap-sm bg-[#FEF2F2] p-sm rounded-[10px] border border-error/20">
                    <MIcon name="error" className="text-[#991B1B] text-[20px]" />
                    <span className="text-[#991B1B] font-secondary text-[13px]">
                      {authError}
                    </span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative py-md">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-default" />
                </div>
                <div className="relative flex justify-center text-[12px] uppercase">
                  <span className="bg-white px-md text-text-tertiary">{tx("ou continuer avec")}</span>
                </div>
              </div>

              {/* 2FA Direct Button */}
              <button
                type="button"
                onClick={() => navigate({ to: '/verification-2fa' })}
                className="w-full flex items-center justify-center gap-sm bg-[#FFF7ED] hover:bg-primary-tint border border-primary-light text-[#C2410C] font-medium py-sm rounded-[10px] transition-all active:scale-[97%] cursor-pointer"
              >
                <MIcon name="verified_user" className="text-[20px]" />
                {tx("Vérification en 2 étapes (2FA)")}
              </button>
            </form>

            <p className="mt-lg flex items-center justify-center gap-xs text-[13px] text-text-secondary text-center">
              Vous n'avez pas encore de compte ?{' '}
              <Link to="/inscription" className="font-semibold text-[#F97316] hover:underline">
                {tx("S'inscrire")}
              </Link>
            </p>

            {/* Footer Info */}
            <footer className="mt-xl flex items-center justify-center gap-xs text-[#9CA3AF] text-[12px] font-secondary">
              <MIcon name="lock" className="text-[16px]" />
              {tx("Paiement sécurisé via FedaPay")}
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
