import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../../constants/roles';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { clearSession } from '../../store/slices/authSlice';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  eyebrow?: string;
}

export function AppLayout({ children, title, eyebrow = 'Espace de travail' }: AppLayoutProps) {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const signOut = () => {
    dispatch(clearSession());
    navigate('/connexion');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-6 lg:block">
          <Link to="/" className="flex items-center gap-2 text-2xl font-black tracking-tight">
            TOK<span className="text-brand-500">Pa</span>
          </Link>
          <p className="mt-1 text-xs text-slate-500">Ton marché, ta façon</p>

          <div className="mt-10 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Session de démo</p>
            <p className="mt-2 font-semibold text-slate-900">{user?.name || 'Visiteur'}</p>
            <p className="text-sm text-slate-600">{user?.email || 'Aucune session active'}</p>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Navigation des espaces">
            <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Interfaces</p>
            {ROLE_ORDER.map((role) => {
              const definition = ROLE_DEFINITIONS[role];
              return (
                <NavLink
                  key={role}
                  to={definition.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive ? `${definition.softTone} ${definition.tone}` : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon icon={definition.icon} className="w-4" />
                  {definition.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <Link to="/" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              ← Vue d’ensemble
            </Link>
            <button type="button" onClick={signOut} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-500 hover:bg-slate-100">
              Se déconnecter
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white/90 px-5 py-5 backdrop-blur sm:px-8">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div>
                <p className="eyebrow">{eyebrow}</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:inline-flex">● Environnement prêt</span>
                <Button variant="ghost" onClick={signOut}>Quitter</Button>
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</div>
        </main>
      </div>

      <div className="border-t border-slate-200 bg-white px-5 py-4 text-center text-xs text-slate-400 lg:hidden">
        <span className="font-bold text-slate-600">TOK<span className="text-brand-500">Pa</span></span> · Navigation disponible sur chaque interface
        <span className="mx-2">·</span>
        <span>{location.pathname}</span>
      </div>
    </div>
  );
}
