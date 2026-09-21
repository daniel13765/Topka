import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5">
      <div className="text-center">
        <p className="text-7xl font-black text-brand-500">404</p>
        <h1 className="mt-4 text-2xl font-black">Page introuvable</h1>
        <p className="mt-3 text-slate-500">Cette route n’est pas encore présente dans le MVP.</p>
        <Link to="/" className="btn-primary mt-7">Retour à l’accueil</Link>
      </div>
    </main>
  );
}
