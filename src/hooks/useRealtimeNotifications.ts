import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import { windowEcho } from '../services/realtime/echo';
import { currentRole } from '../routes/authGuard';
import { idCommandeDunEvenement } from '../utils/realtimeEvents';

export interface RealtimeRefreshEvent {
  scope: 'orders' | 'proposals' | 'notifications' | 'all';
  payload?: Record<string, unknown>;
}

/** Déclenche un rafraîchissement pour les pages abonnées (via `subscribeRealtimeRefresh`). */
export function emitRealtimeRefresh(event: RealtimeRefreshEvent): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<RealtimeRefreshEvent>('tokpa:realtime-refresh', { detail: event }));
  }
}

/** Abonnement typé à `tokpa:realtime-refresh` (scopes multiples). */
export function subscribeRealtimeRefresh(scopes: RealtimeRefreshEvent['scope'][], callback: (e: RealtimeRefreshEvent) => void): () => void {
  const handler = (ev: Event) => {
    const detail = (ev as CustomEvent<RealtimeRefreshEvent>).detail;
    if (detail && (scopes.includes('all') || scopes.includes(detail.scope))) {
      callback(detail);
    }
  };
  window.addEventListener('tokpa:realtime-refresh', handler as EventListener);
  return () => window.removeEventListener('tokpa:realtime-refresh', handler as EventListener);
}

const STATUT_LABELS: Record<string, { fr: string; en: string }> = {
  en_attente: { fr: 'en attente', en: 'pending' },
  en_preparation: { fr: 'en préparation', en: 'preparing' },
  en_livraison: { fr: 'en livraison', en: 'out for delivery' },
  livre: { fr: 'livrée', en: 'delivered' },
  annule: { fr: 'annulée', en: 'cancelled' },
};

/**
 * Hook global temps réel — canal privé `notifications.{userId}` du backend.
 * Événements écoutés (voir app/Events/*.php du backend) :
 *   - order.status.changed   {order_id, statut, previous}
 *   - budget.responded       (modèle BudgetPropose : id, statut, admin_response, commande?)
 *   - payment.confirmed      (modèle Payment : id, order_id, montant)
 *   - delivery.assigned      (modèle Commande : id, livreur_id)
 *
 * Toasts bilingues (tournés selon le rôle de la session : `currentRole()`) + émission d'événements
 * de rafraîchissement pour les pages (orders, négociations, notifications) via
 * `subscribeRealtimeRefresh`. C'est ce bus qui alimente le tableau de bord, la course active,
 * l'historique et la messagerie du livreur : une affectation arrive sur `notifications.{id}`,
 * `delivery.assigned` y est diffusé par le backend.
 */
export function useRealtimeNotifications(sessionKey: number): void {
  const { isFr } = useLanguage();
  const isFrRef = useRef(isFr);
  isFrRef.current = isFr;

  useEffect(() => {
    const token = localStorage.getItem('tokpa_token');
    if (!token) return;

    const echo = windowEcho();
    if (!echo) return;

    const user = JSON.parse(localStorage.getItem('tokpa_user') || '{}') as { id?: number };
    if (!user.id) return;

    const channel = echo.private(`notifications.${user.id}`);

    // Un même événement part vers le canal du client et vers celui du livreur : le vocabulaire
    // doit suivre le rôle, sinon un livreur lit « un livreur a été assigné à votre commande ».
    const pourLivreur = currentRole() === 'livreur';

    const onStatusChanged = (data: { order_id: number; statut: string; previous: string }) => {
      const label = STATUT_LABELS[data.statut];
      const numero = idCommandeDunEvenement(data) ?? data.order_id;
      const suffixe = numero ? (pourLivreur ? ` #TOK-${numero}` : ` #${numero}`) : '';
      const sujet = pourLivreur
        ? isFrRef.current
          ? `Course${suffixe}`
          : `Run${suffixe}`
        : isFrRef.current
          ? `Commande${suffixe}`
          : `Order${suffixe}`;
      toast(`${sujet} : ${label ? (isFrRef.current ? label.fr : label.en) : data.statut}`);
      emitRealtimeRefresh({
        scope: 'orders',
        payload: { ...data, order_id: numero ?? undefined },
      });
      emitRealtimeRefresh({ scope: 'notifications' });
    };

    const onBudgetResponded = (data: { id?: number; statut?: string; admin_response?: string }) => {
      const accepted = data.statut === 'accepte';
      toast(
        (isFrRef.current
          ? accepted
            ? 'Votre proposition de prix a été acceptée !'
            : `Votre proposition a été refusée${data.admin_response ? ` : ${data.admin_response}` : ''}`
          : accepted
            ? 'Your price proposal was accepted!'
            : `Your proposal was rejected${data.admin_response ? `: ${data.admin_response}` : ''}`),
        { icon: accepted ? '🤝' : '📩' },
      );
      emitRealtimeRefresh({ scope: 'proposals', payload: data });
      emitRealtimeRefresh({ scope: 'notifications' });
      if (accepted) emitRealtimeRefresh({ scope: 'orders' });
    };

    const onPaymentConfirmed = (data: { order_id?: number }) => {
      toast(
        isFrRef.current
          ? `Paiement confirmé${data.order_id ? ` — commande #${data.order_id}` : ''}`
          : `Payment confirmed${data.order_id ? ` — order #${data.order_id}` : ''}`,
        { icon: '💳' },
      );
      emitRealtimeRefresh({ scope: 'orders', payload: data });
      emitRealtimeRefresh({ scope: 'notifications' });
    };

    const onDeliveryAssigned = (data: { id?: number }) => {
      // DeliveryAssigned::broadcastOn() vise notifications.{livreur_id} ET notifications.{user_id} ;
      // l'événement n'a pas de broadcastWith(), le payload est donc le modèle Commande cru.
      const numero = idCommandeDunEvenement(data);
      const texte = pourLivreur
        ? isFrRef.current
          ? numero
            ? `Nouvelle course attribuée : #TOK-${numero}`
            : 'Nouvelle course attribuée'
          : numero
            ? `New run assigned: #TOK-${numero}`
            : 'New run assigned'
        : isFrRef.current
          ? numero
            ? `Un livreur a été assigné à votre commande #${numero}`
            : 'Un livreur a été assigné à votre commande'
          : numero
            ? `A rider was assigned to order #${numero}`
            : 'A rider was assigned to your order';
      toast(texte, { icon: '🛵', id: pourLivreur ? 'tokpa-assignation' : undefined });
      emitRealtimeRefresh({
        scope: 'orders',
        payload: { ...data, order_id: numero ?? undefined },
      });
      emitRealtimeRefresh({ scope: 'notifications' });
    };

    channel.listen('order.status.changed', onStatusChanged);
    channel.listen('budget.responded', onBudgetResponded);
    channel.listen('payment.confirmed', onPaymentConfirmed);
    channel.listen('delivery.assigned', onDeliveryAssigned);

    return () => {
      channel.stopListening('order.status.changed', onStatusChanged);
      channel.stopListening('budget.responded', onBudgetResponded);
      channel.stopListening('payment.confirmed', onPaymentConfirmed);
      channel.stopListening('delivery.assigned', onDeliveryAssigned);
    };
  }, [sessionKey]);
}
