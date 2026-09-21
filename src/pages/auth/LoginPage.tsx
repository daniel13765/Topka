import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../../constants/roles';
import { useAppDispatch } from '../../hooks/redux';
import { setSession } from '../../store/slices/authSlice';
import type { Role } from '../../types/domain';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';

const demoNames: Record<Role, string> = {
  client: 'Aïcha Adéoti',
  livreur: 'Koffi Hounkpatin',
  manager: 'Mariam Dossou',
  admin: 'Équipe TOKPa',
};

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string } } | null;
  const redirectPath = state?.from?.pathname;

  const enterAs = (role: Role) => {
    dispatch(setSession({
      id: ROLE_ORDER.indexOf(role) + 1,
      name: demoNames[role],
      email: `${role}@tokpa.demo`,
      role,
    }));
    navigate(redirectPath || ROLE_DEFINITIONS[role].path, { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center text-2xl font-black tracking-tight">TOK<span className="text-brand-500">Pa</span></Link>
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <Badge tone="orange">Mode démo local</Badge>
            <h1 className="mt-5 text-4xl font-black tracking-tight">Choisissez une interface</h1>
            <p className="mt-4 leading-7 text-slate-600">L’authentification backend n’est pas encore branchée. Ces accès créent une session Redux temporaire pour valider les routes et les guards.</p>
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">À remplacer par Sanctum + vérification 2FA lorsque l’API Laravel sera disponible.</div>
          </div>
          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-black">Accès de démonstration</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {ROLE_ORDER.map((role) => {
                const definition = ROLE_DEFINITIONS[role];
                return (
                  <button key={role} type="button" onClick={() => enterAs(role)} className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${definition.softTone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <Icon icon={definition.icon} className="text-2xl" />
                      <span className="inline-flex items-center text-sm font-bold text-slate-500 group-hover:text-slate-800">Entrer <Icon icon={faArrowRight} className="ml-2" /></span>
                    </div>
                    <h3 className={`mt-4 font-black ${definition.tone}`}>{definition.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{demoNames[role]}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
