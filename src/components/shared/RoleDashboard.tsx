import { faArrowRight, faBasketShopping, faBell, faBox, faChartSimple, faCircleCheck, faComments, faHandshake, faLocationDot, faMapLocationDot, faMotorcycle, faTags, faUsers } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Link } from 'react-router-dom';
import { ROLE_DEFINITIONS } from '../../constants/roles';
import type { Role } from '../../types/domain';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { AppLayout } from '../layout/AppLayout';

interface RoleDashboardProps {
  role: Role;
}

const dashboardData: Record<Role, {
  eyebrow: string;
  title: string;
  description: string;
  stats: Array<{ label: string; value: string; detail: string }>;
  actions: Array<{ title: string; description: string; path: string; icon: IconDefinition }>;
}> = {
  client: {
    eyebrow: 'Interface client',
    title: 'Bonjour, votre marché vous attend.',
    description: 'Le socle client est prêt pour brancher le catalogue, le panier et le suivi des commandes.',
    stats: [
      { label: 'Produits disponibles', value: '248', detail: '+12 cette semaine' },
      { label: 'Panier actuel', value: '3', detail: 'articles sélectionnés' },
      { label: 'Commande active', value: '1', detail: 'en préparation' },
    ],
    actions: [
      { title: 'Ouvrir le catalogue', description: 'Produits, filtres et recherche.', path: '/catalogue', icon: faBasketShopping },
      { title: 'Voir le suivi', description: 'Statut et position du livreur.', path: '/client', icon: faLocationDot },
      { title: 'Mes négociations', description: 'Propositions de budget.', path: '/client/negociations', icon: faHandshake },
      { title: 'Notifications', description: 'Commandes, promotions et sécurité.', path: '/client/notifications', icon: faBell },
    ],
  },
  livreur: {
    eyebrow: 'Interface livreur',
    title: 'Votre tournée du jour.',
    description: 'Le shell mobile est prêt pour connecter les courses, le GPS et la messagerie Reverb.',
    stats: [
      { label: 'Courses assignées', value: '6', detail: '2 prioritaires' },
      { label: 'Distance estimée', value: '18,4 km', detail: 'sur la zone active' },
      { label: 'Gains du jour', value: '8 500 FCFA', detail: '+1 200 FCFA hier' },
    ],
    actions: [
      { title: 'Courses assignées', description: 'Accepter ou refuser une course.', path: '/livreur', icon: faMotorcycle },
      { title: 'Course active', description: 'GPS et étapes de livraison.', path: '/livreur', icon: faMapLocationDot },
      { title: 'Messagerie', description: 'Échanger avec le client.', path: '/livreur', icon: faComments },
    ],
  },
  manager: {
    eyebrow: 'Interface manager',
    title: 'Pilotez votre zone.',
    description: 'Le tableau de zone centralise les commandes et l’assignation des livreurs.',
    stats: [
      { label: 'Commandes de la zone', value: '42', detail: '+8 aujourd’hui' },
      { label: 'Livreurs disponibles', value: '9', detail: 'sur 12 affectés' },
      { label: 'Délai moyen', value: '34 min', detail: '-6 min cette semaine' },
    ],
    actions: [
      { title: 'Commandes', description: 'Filtrer et assigner les courses.', path: '/manager', icon: faBox },
      { title: 'Statistiques de zone', description: 'Jour, semaine et mois.', path: '/manager', icon: faChartSimple },
      { title: 'Disponibilités', description: 'Suivre les livreurs actifs.', path: '/manager/equipe', icon: faCircleCheck },
      { title: 'Mon équipe', description: 'Ajouter et affecter les livreurs.', path: '/manager/equipe', icon: faUsers },
      { title: 'Gestion des zones', description: 'Zones, tarifs et points de repère.', path: '/manager/zones', icon: faMapLocationDot },
    ],
  },
  admin: {
    eyebrow: 'Interface admin',
    title: 'Vue globale de TOKPa.',
    description: 'Le cockpit admin accueillera le catalogue, les zones, les équipes, les budgets et l’audit.',
    stats: [
      { label: 'GMV du mois', value: '4,8 M FCFA', detail: '+14,2 % vs. mois dernier' },
      { label: 'Utilisateurs actifs', value: '1 284', detail: '+86 cette semaine' },
      { label: 'Propositions à valider', value: '17', detail: '5 urgentes' },
    ],
    actions: [
      { title: 'Catalogue & packs', description: 'Produits, références et packs autonomes.', path: '/admin/catalogue', icon: faTags },
      { title: 'Console système', description: 'Services, santé et journal admin.', path: '/admin/console', icon: faChartSimple },
      { title: 'Zones et équipes', description: 'Managers, livreurs et périmètres.', path: '/admin', icon: faUsers },
      { title: 'Audit', description: 'Actions critiques horodatées.', path: '/admin/console', icon: faCircleCheck },
    ],
  },
};

export function RoleDashboard({ role }: RoleDashboardProps) {
  const definition = ROLE_DEFINITIONS[role];
  const data = dashboardData[role];

  return (
    <AppLayout title={data.title} eyebrow={data.eyebrow}>
      <div className="space-y-6">
        <section className={`rounded-3xl border p-6 sm:p-8 ${definition.softTone}`}>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <Badge tone={role === 'client' ? 'orange' : role === 'livreur' ? 'green' : role === 'manager' ? 'blue' : 'indigo'}>
                <Icon icon={definition.icon} className="mr-2" /> {definition.label} · environnement de démonstration
              </Badge>
              <p className="mt-4 text-base leading-7 text-slate-600">{data.description}</p>
            </div>
            <Button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
              Voir les modules <Icon icon={faArrowRight} className="ml-2" />
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {data.stats.map((stat) => (
            <Card key={stat.label} className="p-5">
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{stat.value}</p>
              <p className="mt-2 text-xs font-semibold text-emerald-600">{stat.detail}</p>
            </Card>
          ))}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Modules de l’interface</p>
              <h2 className="mt-1 text-xl font-black">Prochaines briques à brancher</h2>
            </div>
            <span className="hidden text-sm text-slate-500 sm:block">Structure alignée sur le cahier des charges v2</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {data.actions.map((action) => (
              <Link key={action.title} to={action.path} className="surface group block p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-lg text-white transition group-hover:bg-brand-500">
                  <Icon icon={action.icon} />
                </span>
                <h3 className="mt-5 font-bold text-slate-900 group-hover:text-brand-600">{action.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{action.description}</p>
                <span className="mt-5 inline-flex items-center text-sm font-bold text-brand-600">Ouvrir le module <Icon icon={faArrowRight} className="ml-2" /></span>
              </Link>
            ))}
          </div>
        </section>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow">Socle technique</p>
              <h2 className="mt-1 text-lg font-black">L’environnement est prêt pour le backend Laravel</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">API relative via Vite proxy, store Redux Toolkit, contrat RTK Query, adaptateurs Reverb, GPS et FedaPay isolés.</p>
            </div>
            <Badge tone="green"><Icon icon={faCircleCheck} className="mr-2" /> Prêt à intégrer</Badge>
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {['Vite + React + TypeScript', 'Tailwind CSS v4', 'Redux Toolkit + RTK Query', 'Echo + Reverb préparé'].map((item) => (
              <div key={item} className="rounded-xl bg-slate-50 px-3 py-3 font-semibold text-slate-700"><Icon icon={faCircleCheck} className="mr-2 text-emerald-500" />{item}</div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
