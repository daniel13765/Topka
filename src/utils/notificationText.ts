import type { ApiNotification } from '../services/api';
import type { NotificationType } from '../types/models';

/**
 * Texte d'une notification de l'API (type, titre, message, commande liée) et heure relative.
 * Partagé par la page Notifications (client) et la cloche de l'espace admin.
 */
const STATUT_TEXT: Record<string, { fr: string; en: string }> = {
  en_attente: { fr: 'en attente de confirmation', en: 'pending confirmation' },
  en_preparation: { fr: 'en cours de préparation', en: 'being prepared' },
  en_livraison: { fr: 'en cours de livraison', en: 'out for delivery' },
  livre: { fr: 'a été livrée', en: 'has been delivered' },
  annule: { fr: 'a été annulée', en: 'was cancelled' },
  accepte: { fr: 'acceptée', en: 'accepted' },
  refuse: { fr: 'refusée', en: 'rejected' },
  expire: { fr: 'expirée', en: 'expired' },
};

/**
 * Traduction type backend → (catégorie, titre, message).
 * Le backend ne fournit PAS title/message dans `data` — c'est ici qu'on les construit.
 */
export function describeNotification(n: ApiNotification, isFr: boolean): { type: NotificationType; title: string; message: string; orderId?: number } {
  const d = n.data ?? {};
  const orderId = d.order_id !== undefined ? Number(d.order_id) : undefined;

  switch (n.type) {
    case 'order.status': {
      const statut = String(d.statut ?? '');
      const t = STATUT_TEXT[statut] ?? { fr: statut, en: statut };
      return {
        type: 'order',
        title: isFr ? `Commande #${orderId ?? ''} — statut` : `Order #${orderId ?? ''} — status`,
        message: isFr ? `Votre commande est ${t.fr}.` : `Your order is ${t.en}.`,
        orderId,
      };
    }
    case 'order.confirmed':
      return {
        type: 'order',
        title: isFr ? `Commande #${orderId ?? ''} confirmée` : `Order #${orderId ?? ''} confirmed`,
        message: isFr
          ? 'Votre commande a bien été enregistrée. Suivez son avancement en direct.'
          : 'Your order has been registered. Track its progress live.',
        orderId,
      };
    case 'budget.response': {
      const statut = String(d.statut ?? '');
      const t = STATUT_TEXT[statut] ?? { fr: statut, en: statut };
      return {
        type: 'promo',
        title: isFr
          ? `Négociation ${t.fr}`
          : `Negotiation ${t.en}`,
        message: isFr
          ? `Votre offre sur le budget a été ${t.fr}${statut === 'accepte' ? ' — votre commande a été créée automatiquement.' : '.'}`
          : `Your budget offer was ${t.en}${statut === 'accepte' ? ' — your order was created automatically.' : '.'}`,
        orderId: statut === 'accepte' ? orderId : undefined,
      };
    }
    case 'delivery.assigned':
      return {
        type: 'order',
        title: isFr ? 'Livreur assigné' : 'Rider assigned',
        message: isFr
          ? `Un livreur a été assigné à votre commande #${orderId ?? ''}.`
          : `A rider was assigned to your order #${orderId ?? ''}.`,
        orderId,
      };
    case 'payment.confirmed':
      return {
        type: 'order',
        title: isFr ? 'Paiement confirmé' : 'Payment confirmed',
        message: isFr
          ? `Le paiement de votre commande #${orderId ?? ''} a été confirmé par FedaPay.`
          : `The payment for your order #${orderId ?? ''} was confirmed by FedaPay.`,
        orderId,
      };
    default:
      return {
        type: 'order',
        title: isFr ? 'Notification TOKPa' : 'TOKPa notification',
        message: isFr ? 'Mise à jour concernant votre compte' : 'An update about your account',
        orderId,
      };
  }
}

export function formatTime(iso: string, isFr: boolean): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return time;
  return `${date.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })} ${time}`;
}

/**
 * Page Historique des Notifications — Protected Route + UI Stitch 100% fidèle + Backend Laravel.
 * GET /api/notifications (paginé) — `lu === false` = non lue ; PATCH /notifications/{id}/read.
 * Rafraîchissement temps réel via le bus SystemBridge (canal notifications.{userId}).
 */
