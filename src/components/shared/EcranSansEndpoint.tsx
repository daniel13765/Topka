import FaIcon from './FaIcon';
import { tx } from '../../i18n/tx';

/**
 * EcranSansEndpoint — gabarit des écrans que le backend ne sait pas encore nourrir.
 *
 * Certains écrans de l'administration et de l'espace manager n'ont aucune route correspondante côté
 * Laravel (`routes/api.php`, groupes `role:admin` et `role:manager`). La règle du projet est qu'un
 * écran non branché doit le dire et doit rester vide : pas de ligne d'exemple, pas de pourcentage,
 * pas de nom de personne, pas de faux secret, pas de bouton qui écrit dans le vide. Ce composant
 * pose ce cadre une seule fois — l'en-tête, la liste des routes attendues, les rubriques qui se
 * rempliront, et l'avertissement sur ce qui n'est volontairement pas proposé.
 *
 * Les valeurs viennent du serveur ou n'apparaissent pas : le composant n'accepte aucune donnée.
 */
export interface RouteAttendue {
  /** Route telle qu'elle devra s'appeler, en SNAPI Laravel, ex. `GET /admin/parametres`. */
  chemin: string;
  /** Ce qu'elle apporterais à l'écran. */
  apporte: string;
}

export interface RubriqueAttendue {
  titre: string;
  contenu: string;
}

interface Props {
  /** Titre de l'écran. */
  titre: string;
  /** Chemin de la page côté front, ex. `/admin/systeme`. */
  chemin: string;
  /** Une phrase sur le rôle de l'écran. */
  role: string;
  /** Groupe de middleware du backend où la route devra être déclarée. */
  middleware: string;
  routes: RouteAttendue[];
  rubriques: RubriqueAttendue[];
  /** Ce que l'écran ne propose délibérément pas, et pourquoi. */
  avertissement?: string;
}

export default function EcranSansEndpoint({
  titre,
  chemin,
  role,
  middleware,
  routes,
  rubriques,
  avertissement,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
        <p className="font-bold">{tx("Non branché — aucune route backend (B-16)")}</p>
        <p>{tx("Le backend n’expose pas encore les routes de cet écran. Il reste donc vide : aucun exemple, aucun chiffre inventé, aucun nom fabriqué.")}</p>
      </div>

      <header>
        <p className="flex flex-wrap items-center gap-2 text-overline uppercase tracking-wider text-text-secondary">
          <span className="font-semibold text-primary-container">TOKPa</span>
          <FaIcon name="chevron_right" className="text-[14px]" />
          <span className="font-mono normal-case tracking-normal">{chemin}</span>
        </p>
        <h1 className="mt-1 text-h2 font-h2 font-bold text-text-main">{titre}</h1>
        <p className="mt-1 max-w-[70ch] text-label text-text-secondary">{role}</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {routes.map((r, i) => (
          <div
            key={r.chemin}
            className="tokpa-rise rounded-xl border border-border-default bg-bg-card p-4 shadow-sm"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error-light text-error">
                <FaIcon name="link_off" className="text-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-label font-bold break-words">{r.chemin}</p>
                <p className="mt-0.5 text-label text-text-secondary">{r.apporte}</p>
                <p className="mt-2 text-micro text-text-tertiary">
                  {tx("À déclarer dans")} <span className="font-mono">routes/api.php</span> {tx("sous")}{' '}
                  <span className="font-mono">{middleware}</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-label font-bold uppercase tracking-wider text-text-secondary">
          {tx("Rubriques de l’écran, vides en attendant")}
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rubriques.map((b, i) => (
            <article
              key={b.titre}
              className="tokpa-rise flex flex-col justify-between gap-3 rounded-xl border border-border-default bg-bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              style={{ animationDelay: `${(i + 1) * 60}ms` }}
            >
              <div>
                <h3 className="text-label font-bold text-text-main">{b.titre}</h3>
                <p className="mt-1 text-label text-text-secondary">{b.contenu}</p>
              </div>
              <p className="flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2 text-label text-text-tertiary">
                <FaIcon name="hourglass_empty" className="text-[16px]" />
                {tx("0 ligne — aucune source de données")}
              </p>
            </article>
          ))}
        </div>
      </section>

      {avertissement ? (
        <section className="rounded-xl border border-border-default bg-surface p-4">
          <p className="flex items-start gap-2 text-label text-text-secondary">
            <FaIcon name="info" className="mt-0.5 shrink-0 text-[16px] text-primary-container" />
            <span>{avertissement}</span>
          </p>
        </section>
      ) : null}
    </div>
  );
}
