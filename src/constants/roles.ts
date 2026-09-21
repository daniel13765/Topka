import {
  faBasketShopping,
  faCrown,
  faMapLocationDot,
  faMotorcycle,
} from '@fortawesome/free-solid-svg-icons';
import type { Role, RoleDefinition } from '../types/domain';

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  client: {
    role: 'client',
    label: 'Client',
    icon: faBasketShopping,
    description: 'Catalogue, panier, négociation et suivi des commandes.',
    path: '/client',
    tone: 'text-orange-700',
    softTone: 'bg-orange-50 border-orange-200',
  },
  livreur: {
    role: 'livreur',
    label: 'Livreur',
    icon: faMotorcycle,
    description: 'Courses assignées, GPS temps réel et communication terrain.',
    path: '/livreur',
    tone: 'text-emerald-700',
    softTone: 'bg-emerald-50 border-emerald-200',
  },
  manager: {
    role: 'manager',
    label: 'Manager',
    icon: faMapLocationDot,
    description: 'Commandes de zone, assignation et indicateurs opérationnels.',
    path: '/manager',
    tone: 'text-sky-700',
    softTone: 'bg-sky-50 border-sky-200',
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    icon: faCrown,
    description: 'Pilotage global, catalogue, équipes, zones et audit.',
    path: '/admin',
    tone: 'text-indigo-700',
    softTone: 'bg-indigo-50 border-indigo-200',
  },
};

export const ROLE_ORDER: Role[] = ['client', 'livreur', 'manager', 'admin'];
