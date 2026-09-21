import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { faArrowLeft, faCheck, faClock, faEnvelope, faRotateRight, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { useResendVerificationCodeMutation, useVerifyRegistrationEmailMutation } from '../../services/api/authApi';
import { useAppDispatch } from '../../hooks/redux';
import { setSession } from '../../store/slices/authSlice';

interface VerificationLocationState {
  email?: string;
  registrationId?: string;
  demoCode?: string;
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 1)}***@${domain}`;
}

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const state = (location.state as VerificationLocationState | null) || {};
  const saved = sessionStorage.getItem('tokpa-registration');
  const savedRegistration = saved ? JSON.parse(saved) as VerificationLocationState : null;
  const email = state.email || savedRegistration?.email || '';
  const registrationId = state.registrationId || savedRegistration?.registrationId || '';
  const demoCode = state.demoCode || savedRegistration?.demoCode;
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [seconds, setSeconds] = useState(300);
  const [attempts, setAttempts] = useState(3);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [verifyEmail, { isLoading: isVerifying }] = useVerifyRegistrationEmailMutation();
  const [resendCode, { isLoading: isResending }] = useResendVerificationCodeMutation();

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const updateCode = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setCode((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const submittedCode = code.join('');
    if (!email || !registrationId) {
      setError('Cette session d’inscription a expiré. Recommencez l’inscription.');
      return;
    }
    if (submittedCode.length !== 6) {
      setError('Saisissez les 6 chiffres reçus par e-mail.');
      return;
    }
    if (attempts <= 0 || seconds === 0) {
      setError('Le code a expiré. Demandez un nouveau code.');
      return;
    }
    try {
      const result = await verifyEmail({ registrationId, email, code: submittedCode }).unwrap();
      dispatch(setSession(result.user));
      sessionStorage.removeItem('tokpa-registration');
      navigate('/client', { replace: true });
    } catch {
      setAttempts((current) => Math.max(0, current - 1));
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setError(`Code incorrect. Il vous reste ${Math.max(0, attempts - 1)} tentative${attempts - 1 > 1 ? 's' : ''}.`);
    }
  };

  const handleResend = async () => {
    if (!email || !registrationId || seconds > 0) return;
    setError('');
    try {
      const result = await resendCode({ registrationId, email }).unwrap();
      sessionStorage.setItem('tokpa-registration', JSON.stringify({ ...savedRegistration, ...result }));
      setSeconds(300);
      setAttempts(3);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setNotice('Un nouveau code vient d’être envoyé.');
    } catch {
      setError('Impossible de renvoyer le code pour le moment.');
    }
  };

  if (!email || !registrationId) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 px-5"><section className="surface w-full max-w-md p-8 text-center"><h1 className="text-2xl font-black">Session introuvable</h1><p className="mt-3 text-sm leading-6 text-slate-500">Recommencez l’inscription pour recevoir un nouveau code de vérification.</p><Link to="/inscription" className="btn-primary mt-6">Créer un compte</Link></section></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-4"><Link to="/" className="text-2xl font-black tracking-tight text-slate-950">TOK<span className="text-brand-500">Pa</span></Link><Badge tone="green"><Icon icon={faShieldHalved} className="mr-2" />Compte sécurisé</Badge></div>
        <section className="motion-enter mt-8 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-9">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-2xl text-brand-500"><Icon icon={faEnvelope} /></span>
          <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-950">Vérifiez votre e-mail</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-600">Nous avons envoyé un code à 6 chiffres à <strong className="text-slate-900">{maskEmail(email)}</strong></p>
          <form onSubmit={(event) => void handleVerify(event)} className="mt-8">
            <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-label="Code de vérification">
              {code.map((digit, index) => <input key={index} ref={(element) => { inputRefs.current[index] = element; }} value={digit} onChange={(event) => updateCode(index, event.target.value)} onKeyDown={(event) => handleKeyDown(index, event)} inputMode="numeric" maxLength={1} className={`h-14 min-w-0 rounded-xl border text-center text-2xl font-black outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100 ${error ? 'border-rose-300 bg-rose-50' : 'border-slate-300 bg-white'}`} aria-label={`Chiffre ${index + 1}`} />)}
            </div>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"><Icon icon={faClock} /> Le code expire dans {formattedTime}</div>
            {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700">{error}</div>}
            {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-semibold text-emerald-700">{notice}</div>}
            {demoCode && <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left text-xs leading-5 text-orange-800"><strong>Mode démo :</strong> utilisez le code <b>{demoCode}</b>. En production, ce code sera envoyé uniquement par e-mail.</div>}
            <button type="submit" disabled={isVerifying || seconds === 0 || attempts === 0} className="btn-primary mt-6 w-full py-3.5">{isVerifying ? 'Vérification…' : 'Vérifier mon e-mail'} <Icon icon={faCheck} className="ml-2" /></button>
          </form>
          <button type="button" disabled={seconds > 0 || isResending} onClick={() => void handleResend()} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-slate-400"><Icon icon={faRotateRight} />{isResending ? 'Envoi…' : seconds > 0 ? 'Renvoyer le code disponible à 00:00' : 'Renvoyer le code'}</button>
          <div className="mt-8 border-t border-slate-100 pt-6"><Link to="/inscription" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-brand-600"><Icon icon={faArrowLeft} className="mr-2" /> Modifier mes informations</Link></div>
        </section>
      </div>
    </main>
  );
}
