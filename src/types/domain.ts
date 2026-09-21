import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type Role = 'client' | 'livreur' | 'manager' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface CartItem {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface RoleDefinition {
  role: Role;
  label: string;
  icon: IconDefinition;
  description: string;
  path: string;
  tone: string;
  softTone: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  image: string;
  rating: number;
  negotiable?: boolean;
  badge?: string;
}

export type NotificationType = 'order' | 'promotion' | 'security' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  relativeTime: string;
  read: boolean;
}
