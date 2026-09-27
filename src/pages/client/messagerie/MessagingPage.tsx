import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import { alertApiError } from '../../../utils/apiError';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import { windowEcho } from '../../../services/realtime/echo';
import { chatApi, ordersApi, type ConversationItem, type MessageItem } from '../../../services/api';
import { tx } from '../../../i18n/tx';


interface UIConversation {
  id: number;
  orderId: number | null;
  riderName: string;
  riderInitials: string;
  orderCode: string;
  lastMessage: string;
  time: string;
}

interface UIMessage {
  id: string | number;
  text: string;
  sender: 'client' | 'rider';
  time: string;
}

interface ActiveOrderInfo {
  orderId: number;
  riderName: string;
  riderInitials: string;
  phone: string;
  total: number;
  statut: string;
  nbItems: number;
}

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livre: 'Livrée',
  annule: 'Annulée',
};

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtFCFA = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} FCFA`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'LK';

/**
 * MessagingPage — Tchat Client ↔ Livreur (CDC F-17)
 * Branché 100 % sur le backend :
 *   - GET /api/conversations
 *   - GET /api/conversations/{id}/messages
 *   - POST /api/conversations/{id}/messages
 *   - GET /api/orders/{id} (contexte commande + livreur de la conversation)
 *   - Temps réel Reverb : canal privé `chat.{conversationId}`, événement `message.sent`
 *
 * Le chat n'existe qu'une fois un livreur assigné à une commande (CDC §4.4).
 */
export default function MessagingPage() {
  const { isFr } = useLanguage();
  const { isAuthenticated, isLoading } = useAuthGuard('/connexion');

  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrderInfo | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [inputText, setInputText] = useState('');

  const currentUserId = (() => {
    const raw = localStorage.getItem('tokpa_user');
    try {
      return raw ? (JSON.parse(raw) as { id?: number }).id : null;
    } catch {
      return null;
    }
  })();

  // 1) Conversations — GET /api/conversations
  useEffect(() => {
    if (!isAuthenticated) return;

    const load = () => {
      chatApi
        .getConversations()
        .then((res) => {
          const list = (res?.data || (Array.isArray(res) ? res : [])) as ConversationItem[];
          if (Array.isArray(list) && list.length > 0) {
            const mapped: UIConversation[] = list.map((c) => ({
              id: c.id,
              orderId: c.order_id ?? null,
              riderName: isFr ? 'Livreur TOKPa' : 'TOKPa Rider',
              riderInitials: 'LK',
              orderCode: c.order_id ? `#TOK-${c.order_id}` : '—',
              lastMessage: isFr ? 'Discussion en cours…' : 'Ongoing discussion…',
              time: fmtTime(c.updated_at),
            }));
            setConversations((prev) => {
              // Conserver les noms de livreurs déjà chargés
              return mapped.map((m) => {
                const known = prev.find((p) => p.id === m.id);
                return known ? { ...m, riderName: known.riderName, riderInitials: known.riderInitials } : m;
              });
            });
            setActiveConvId((prev) => {
              if (prev && mapped.some((m) => m.id === prev)) return prev;
              return mapped[0]?.id ?? null;
            });
          } else {
            setConversations([]);
            setActiveConvId(null);
          }
        })
        .catch((err) => alertApiError(err, 'chat-conversations'));
    };

    load();
    // Rafraîchir quand une assignation livreur arrive en temps réel
    return subscribeRealtimeRefresh(['orders'], load);
  }, [isAuthenticated, isFr]);

  // 2) Contexte commande active — GET /api/orders/{orderId} (livreur + total + statut)
  useEffect(() => {
    if (!isAuthenticated || !activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv?.orderId) return;

    ordersApi
      .getOrder(conv.orderId)
      .then((res) => {
        const o = res?.data ?? res;
        if (!o) return;
        const livreur = (o.livreur ?? {}) as { nom_complet?: string; telephone?: string };
        const riderName = livreur.nom_complet || (isFr ? 'Livreur TOKPa' : 'TOKPa Rider');
        const items = Array.isArray(o.items) ? o.items : [];
        const info: ActiveOrderInfo = {
          orderId: o.id ?? conv.orderId,
          riderName,
          riderInitials: initials(riderName),
          phone: livreur.telephone || '',
          total: Number(o.montant_total ?? 0),
          statut: o.statut ?? '',
          nbItems: items.length,
        };
        setActiveOrder(info);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvId
              ? { ...c, riderName, riderInitials: initials(riderName) }
              : c,
          ),
        );
      })
      .catch((err) => alertApiError(err, 'chat-order'));
  }, [isAuthenticated, activeConvId, conversations]);

  // 3) Messages — GET /api/conversations/{id}/messages
  useEffect(() => {
    if (!isAuthenticated || !activeConvId) {
      setMessages([]);
      return;
    }

    chatApi
      .getMessages(activeConvId)
      .then((res) => {
        const msgs = (res?.data?.data || res?.data || (Array.isArray(res) ? res : [])) as MessageItem[];
        if (Array.isArray(msgs)) {
          setMessages(
            msgs.map((m) => ({
              id: m.id,
              text: m.contenu,
              sender: m.sender_id === currentUserId ? 'client' : 'rider',
              time: fmtTime(m.created_at),
            })),
          );
        }
      })
      .catch((err) => alertApiError(err, 'chat-messages'));
  }, [isAuthenticated, activeConvId, currentUserId]);

  // 4) Temps réel — canal privé `chat.{conversationId}`, événement `message.sent`
  useEffect(() => {
    if (!isAuthenticated || !activeConvId || !currentUserId) return;
    const echo = windowEcho();
    if (!echo) return;

    const channel = echo.private(`chat.${activeConvId}`);
    const handler = (data: { sender_id: number; contenu: string; created_at?: string; id?: number }) => {
      if (data.sender_id === currentUserId) return; // déjà ajouté en local (optimiste)
      setMessages((prev) => [
        ...prev,
        {
          id: data.id ?? `rt_${Date.now()}`,
          text: data.contenu,
          sender: 'rider',
          time: fmtTime(data.created_at),
        },
      ]);
    };
    channel.listen('message.sent', handler);
    return () => {
      channel.stopListening('message.sent', handler);
    };
  }, [isAuthenticated, activeConvId, currentUserId]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="bg-bg-app min-h-screen flex items-center justify-center font-body text-text-main">
        <MIcon name="sync" className="text-primary text-4xl animate-spin" />
      </div>
    );
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const currentText = inputText.trim();
    if (!currentText) return;

    setInputText('');
    const optimisticMsg: UIMessage = {
      id: `msg_${Date.now()}`,
      text: currentText,
      sender: 'client',
      time: fmtTime(new Date().toISOString()),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    if (activeConvId) {
      try {
        await chatApi.sendMessage(activeConvId, currentText);
      } catch (err) {
        alertApiError(err, 'chat-send'); // message non envoyé : le client doit le savoir
      }
    }
  };

  const riderName = activeOrder?.riderName ?? (isFr ? 'Livreur TOKPa' : 'TOKPa Rider');
  const riderInitials = activeOrder?.riderInitials ?? 'LK';

  return (
    <div className="bg-bg-app font-body text-text-main h-screen overflow-hidden flex flex-col">
      {/* TopNavBar */}
      <ClientNavbar />

      {/* Main Layout */}
      <main className="mt-[52px] flex flex-1 h-[calc(100vh-52px)]">
        {/* Sidebar - Conversations List */}
        <aside className="hidden lg:flex flex-col w-[320px] bg-bg-card border-r border-border-default h-full">
          {/* Header */}
          <div className="p-md flex justify-between items-center">
            <h2 className="font-h2 text-h2 text-text-main font-bold">{isFr ? 'Messages' : 'Messages'}</h2>
            <button
              type="button"
              className="text-primary-container hover:bg-primary-tint p-sm rounded-lg transition-all active:scale-[0.97] cursor-pointer"
            >
              <MIcon name="edit_square" />
            </button>
          </div>

          {/* Conversation Items */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-md">
                <div className="bg-bg-app border border-border-default rounded-lg p-md text-center">
                  <MIcon name="chat_bubble_outline" className="text-3xl text-text-tertiary mb-2" />
                  <p className="font-label text-label text-text-secondary font-bold">
                    {isFr ? tx("Aucune conversation") : 'No conversation'}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    {isFr
                      ? 'Le chat s\u2019ouvre dès qu\u2019un livreur est assigné à l\u2019une de vos commandes.'
                      : 'Chat opens once a rider is assigned to one of your orders.'}
                  </p>
                </div>
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={clsx('p-md flex gap-md cursor-pointer transition-all border-b border-border-default/50', {
                    'bg-primary-tint border-l-[3px] border-primary-container': activeConvId === c.id,
                    'hover:bg-bg-secondary': activeConvId !== c.id,
                  })}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-success-dark flex items-center justify-center text-white font-bold text-h3">
                      {c.riderInitials}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-white rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-xs">
                      <h3 className="font-h3 text-h3 text-text-main truncate font-bold">{c.riderName}</h3>
                      <span className="font-micro text-micro text-text-tertiary">{c.time}</span>
                    </div>
                    <p className="font-secondary text-secondary text-primary-dark truncate mb-sm font-medium">
                      {c.lastMessage}
                    </p>
                    <span className="px-sm py-[2px] bg-primary-container text-white text-micro font-bold rounded-full inline-block">
                      {c.orderCode}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <section className="flex-1 flex flex-col h-full relative bg-bg-app">
          {/* Chat Header */}
          <header className="bg-bg-card h-[64px] px-lg flex items-center justify-between border-b border-border-default z-10">
            <div className="flex items-center gap-md">
              <div className="w-10 h-10 rounded-full bg-success-dark flex items-center justify-center text-white font-bold">
                {riderInitials}
              </div>
              <div>
                <h2 className="font-h3 text-h3 text-text-main leading-none font-bold">{riderName}</h2>
                <div className="flex items-center gap-xs mt-1">
                  <span className="w-2 h-2 bg-success rounded-full inline-block" />
                  <span className="text-secondary text-success font-label text-xs font-semibold">
                    {isFr ? 'Livreur TOKPa' : 'TOKPa Rider'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-sm">
              {activeOrder?.phone && (
                <a
                  href={`tel:${activeOrder.phone.replace(/\s/g, '')}`}
                  className="p-sm text-text-secondary hover:bg-primary-tint hover:text-primary-container rounded-lg transition-all"
                >
                  <MIcon name="call" />
                </a>
              )}
              {activeConvId && (
                <Link
                  to="/commandes/suivi"
                  search={{ order: String(activeConvId) }}
                  className="p-sm text-text-secondary hover:bg-primary-tint hover:text-primary-container rounded-lg transition-all"
                >
                  <MIcon name="map" />
                </Link>
              )}
            </div>
          </header>

          {/* Order Context Banner */}
          {activeOrder && (
            <div className="m-md px-md py-sm bg-primary-tint border border-primary-light rounded-lg flex justify-between items-center">
              <div className="flex items-center gap-sm">
                <MIcon name="shopping_bag" className="text-primary-container" />
                <span className="font-label text-label text-text-main">
                  {isFr ? tx("Commande") : 'Order'}{' '}
                  <strong className="text-primary-container">#TOK-{activeOrder.orderId}</strong> ·{' '}
                  {fmtFCFA(activeOrder.total)} · {STATUT_LABELS[activeOrder.statut] ?? activeOrder.statut}
                </span>
              </div>
              <Link
                to="/commandes/suivi"
                search={{ order: String(activeOrder.orderId) }}
                className="text-primary-container font-bold text-label hover:underline"
              >
                {isFr ? tx("Suivre") : 'Track'}
              </Link>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-lg pb-xl flex flex-col gap-md">
            {messages.length === 0 ? (
              <div className="m-auto text-center">
                <MIcon name="chat" className="text-5xl text-text-tertiary mb-3" />
                <p className="font-label text-label text-text-secondary font-bold">
                  {isFr ? tx("Début de la conversation") : 'Start of the conversation'}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {isFr
                    ? tx("Écrivez au livreur pour préciser le lieu de livraison.")
                    : 'Message the rider to clarify the delivery spot.'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-center my-md">
                  <span className="px-md py-1 bg-border-default rounded-full text-text-secondary text-micro font-bold">
                    {isFr ? "AUJOURD'HUI" : 'TODAY'}
                  </span>
                </div>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={clsx('flex flex-col gap-xs max-w-[70%]', {
                      'items-start self-start': msg.sender === 'rider',
                      'items-end self-end': msg.sender === 'client',
                    })}
                  >
                    <div
                      className={clsx('p-md shadow-sm text-body rounded-xl', {
                        'bg-white bubble-received text-text-main border border-border-default/50':
                          msg.sender === 'rider',
                        'bg-primary-container bubble-sent text-white shadow-md': msg.sender === 'client',
                      })}
                    >
                      {msg.text}
                    </div>
                    <span className="text-micro text-text-tertiary px-1">{msg.time}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Input Area */}
          <footer className="bg-bg-card border-t border-border-default p-md md:px-lg flex items-center gap-md">
            <button type="button" className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer">
              <MIcon name="attach_file" />
            </button>
            <form onSubmit={handleSendMessage} className="flex-1 bg-bg-app rounded-full px-md flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isFr ? tx("Écrire un message...") : 'Type a message...'}
                className="bg-transparent border-none focus:ring-0 text-body py-[10px] w-full text-sm outline-none"
              />
              <button
                type="button"
                className="text-text-tertiary hover:text-primary-container transition-colors ml-sm cursor-pointer"
              >
                <MIcon name="mood" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!activeConvId}
              className="w-10 h-10 bg-primary-container text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-hover active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              <MIcon name="send" style={{ fontVariationSettings: "'FILL' 1" }} />
            </button>
          </footer>
        </section>
      </main>

      {/* BottomNavBar */}
      <ClientBottomNav />
    </div>
  );
}
