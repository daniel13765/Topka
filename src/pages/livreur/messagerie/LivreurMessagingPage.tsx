import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import FaIcon from '../../../components/shared/FaIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import EmptyState from '../../../components/shared/EmptyState';
import { chatApi } from '../../../services/api';
import { listenPrivate } from '../../../services/realtime/echo';
import { alertApiError } from '../../../utils/apiError';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import { heureCourte } from '../../../services/api/unwrap';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';
import {
  apercuDuFil,
  controleMessage,
  chargerFils,
  chargerMessages,
  estDeMoi,
  etatAccesChat,
  grouperParJour,
  initialesOuVide,
  nomPartenaire,
  tonStatut,
  tronquer,
  LONGUEUR_MAX_MESSAGE,
  type Fil,
  type MessageLeger,
} from './messagerieData';

/**
 * Espace Livreur — Messagerie (maquette `messagerie_tokpa`, rôles inversés : l'interlocuteur est
 * le client).
 *
 * Structure fidèle à la maquette : liste de fils de 320 px (titre + recherche + lignes avatar /
 * nom / heure / aperçu / pastille de course), entête de conversation avec ses trois actions,
 * bandeau « Commande #… · montant · statut » suivi de « Suivre », séparateurs de jour, bulles
 * `.bubble-sent` / `.bubble-received`, composeur attach_file · champ · mood · bouton d'envoi rond.
 *
 * Branché sur les trois seules routes réelles (`GET /conversations`, `GET|POST
 * /conversations/{id}/messages`) et sur le canal Reverb `chat.{id}` / `message.sent`. Rien n'est
 * simulé : pas de pastille de présence verte (aucune donnée de présence), aucun badge « non lus »
 * (aucune route de marquage), aucune pièce jointe (aucun téléversement), aucun numéro de client
 * (le contrôleur ne charge pas la relation). Le nom de l'interlocuteur est déduit des `sender` des
 * messages, et l'aperçu du dernier message coûte un appel par fil — limité, et le reliquat annoncé.
 */

const TON_PASTILLE: Record<string, string> = {
  course: 'bg-primary-container text-white',
  fini: 'bg-success-light text-success-dark',
  annule: 'bg-error-light text-error',
  neutre: 'bg-bg-secondary text-text-secondary',
};

/** Émojis utiles en cours de livraison : insertion locale dans le champ, aucun envoi automatique. */
const EMOJIS = ['🛵', '✅', '🙏', '📦', '', '👍', '🕐', '😊'];

function monIdentifiant(): number | null {
  try {
    const raw = localStorage.getItem('tokpa_user');
    const id = raw ? (JSON.parse(raw) as { id?: unknown }).id : null;
    return typeof id === 'number' && Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export default function LivreurMessagingPage() {
  useLanguage();
  const navigate = useNavigate();

  const [fils, setFils] = useState<Fil[]>([]);
  const [sansApercu, setSansApercu] = useState(0);
  const [chargementListe, setChargementListe] = useState(true);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const [accesRefuse, setAccesRefuse] = useState(false);
  const [actifId, setActifId] = useState<number | null>(null);

  const [messages, setMessages] = useState<MessageLeger[]>([]);
  const [chargementFil, setChargementFil] = useState(false);
  const [erreurFil, setErreurFil] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dernierePage, setDernierePage] = useState(1);

  const [recherche, setRecherche] = useState('');
  const [brouillon, setBrouillon] = useState('');
  const [palette, setPalette] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [details, setDetails] = useState(false);

  const moi = useMemo(() => monIdentifiant(), []);
  const filActif = fils.find((f) => f.id === actifId) ?? null;
  const zone = useRef<HTMLDivElement | null>(null);

  /* ------------------------------- liste des fils ------------------------------- */
  const chargerListe = useCallback(async () => {
    setChargementListe(true);
    setErreurListe(null);
    try {
      const { fils: next, sansApercu: reste } = await chargerFils(moi);
      setFils(next);
      setSansApercu(reste);
      setAccesRefuse(false);
      setActifId((courant) => (courant && next.some((f) => f.id === courant) ? courant : (next[0]?.id ?? null)));
    } catch (e) {
      const { interdit } = etatAccesChat(e);
      setAccesRefuse(interdit);
      setErreurListe(interdit ? null : alertApiError(e, 'livreur-chat-list'));
    } finally {
      setChargementListe(false);
    }
  }, [moi]);

  useEffect(() => {
    void chargerListe();
  }, [chargerListe]);

  // La conversation naît de l'affectation d'une course (ManagerAssignmentController::firstOrCreate) :
  // `delivery.assigned` doit donc faire réapparaître la liste, sinon le livreur attend un F5.
  useEffect(() => subscribeRealtimeRefresh(['orders'], () => void chargerListe()), [chargerListe]);

  /* ---------------------------- messages du fil actif ---------------------------- */
  const chargerFil = useCallback(
    async (conversationId: number) => {
      setChargementFil(true);
      setErreurFil(null);
      try {
        const res = await chargerMessages(conversationId);
        setMessages(res.messages);
        setPage(res.page);
        setDernierePage(res.dernierePage);
        // Le fil vient d'être lu : la ligne de liste peut afficher un vrai aperçu et un vrai nom.
        const nom = nomPartenaire(res.messages, moi);
        const apercu = apercuDuFil(res.messages, moi);
        setFils((prev) =>
          prev.map((f) =>
            f.id === conversationId
              ? {
                  ...f,
                  nom: nom ?? f.nom,
                  initiales: nom ? initialesOuVide(nom) : f.initiales,
                  apercu: apercu?.texte ?? f.apercu,
                  heure: apercu?.heure ?? f.heure,
                  chargement: false,
                }
              : f,
          ),
        );
      } catch (e) {
        setErreurFil(alertApiError(e, 'livreur-chat-messages'));
      } finally {
        setChargementFil(false);
      }
    },
    [moi],
  );

  useEffect(() => {
    if (!actifId) {
      setMessages([]);
      return;
    }
    void chargerFil(actifId);
  }, [actifId, chargerFil]);

  /* -------------------- temps réel : canal privé `chat.{id}` -------------------- */
  useEffect(() => {
    if (!actifId) return;
    const { stop } = listenPrivate(`chat.${actifId}`, 'message.sent', (payload) => {
      const data = payload as { id?: number | string; sender_id?: number; contenu?: string; created_at?: string };
      if (typeof data.contenu !== 'string' || data.contenu.trim() === '') return;
      const messageId = data.id ?? `rt_${Date.now()}`;
      if (data.sender_id != null && Number(data.sender_id) === Number(moi)) return; // posé en optimiste
      setMessages((prev) =>
        prev.some((m) => m.id === messageId)
          ? prev
          : [
              ...prev,
              {
                id: messageId,
                sender_id: Number(data.sender_id) || 0,
                contenu: data.contenu as string,
                created_at: data.created_at ?? new Date().toISOString(),
              },
            ],
      );
      setFils((prev) =>
        prev.map((f) =>
          f.id === actifId
            ? {
                ...f,
                apercu: tronquer(data.contenu as string),
                heure: heureCourte(data.created_at ?? new Date().toISOString()),
              }
            : f,
        ),
      );
    });
    return stop;
  }, [actifId, moi]);

  /* -------------------- défilement : rester collé au dernier message -------------------- */
  useEffect(() => {
    const el = zone.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, actifId, chargementFil]);

  /* --------------------------------- envoi --------------------------------- */
  const controle = controleMessage(brouillon);

  const envoyer = async () => {
    if (!actifId || !controle.pret || envoi) return;
    const texte = brouillon.trim();
    const tamponId = `tmp_${Date.now()}`;
    setPalette(false);
    setEnvoi(true);
    setBrouillon('');
    setMessages((prev) => [
      ...prev,
      { id: tamponId, sender_id: moi ?? 0, contenu: texte, created_at: new Date().toISOString() },
    ]);
    try {
      await chatApi.sendMessage(actifId, texte);
      setFils((prev) =>
        prev.map((f) =>
          f.id === actifId ? { ...f, apercu: `Vous : ${tronquer(texte)}`, heure: heureCourte(new Date().toISOString()) } : f,
        ),
      );
    } catch (e) {
      // Le message n'est pas passé : on retire le tampon pour n'afficher aucun envoi fictif.
      setMessages((prev) => prev.filter((m) => m.id !== tamponId));
      setBrouillon(texte);
      alertApiError(e, 'livreur-chat-send');
    } finally {
      setEnvoi(false);
    }
  };

  /* -------------------------------- recherche -------------------------------- */
  const filsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return fils;
    return fils.filter((f) => `${f.nom} ${f.ref} ${f.apercu ?? ''}`.toLowerCase().includes(q));
  }, [fils, recherche]);

  const groupes = useMemo(() => grouperParJour(messages), [messages]);

  /* ======================================================================= */
  return (
    <LivreurLayout>
      <div className="flex min-h-[560px] w-full flex-col overflow-hidden rounded-[14px] bg-bg-card shadow-sm lg:h-[calc(100vh-8rem)] lg:flex-row">
        {/* ---------------- Liste des fils (maquette : aside 320 px) ---------------- */}
        <aside
          className={clsx(
            'flex w-full shrink-0 flex-col border-b border-border-default bg-bg-card lg:h-full lg:w-[320px] lg:border-b-0 lg:border-r',
            actifId && 'hidden lg:flex',
          )}
        >
          <div className="flex items-center justify-between p-md">
            <h2 className="font-h2 text-h2 font-bold text-text-main">{tx('Messagerie')}</h2>
            <button
              type="button"
              disabled
              title={tx('Aucune route de création de conversation : le fil s’ouvre quand un manager vous affecte une course.')}
              className="cursor-not-allowed rounded-lg p-sm text-primary-container opacity-50 transition-all hover:bg-primary-tint"
            >
              <FaIcon name="edit_square" className="text-[20px]" />
              <span className="sr-only">{tx('Nouvelle conversation')}</span>
            </button>
          </div>

          <div className="px-md pb-md">
            <div className="flex items-center gap-sm rounded-lg bg-bg-app px-sm">
              <FaIcon name="search" className="shrink-0 text-[18px] text-text-tertiary" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={tx('Rechercher…')}
                aria-label={tx('Rechercher une conversation')}
                className="w-full bg-transparent py-sm font-body text-body text-text-main focus:outline-none"
              />
            </div>
          </div>

          {accesRefuse ? (
            <div className="mx-md mb-md rounded-lg border border-amber-text/30 bg-amber-light/60 p-md">
              <p className="flex items-center gap-sm font-label text-label font-bold text-amber-text">
                <FaIcon name="lock" className="text-[16px]" />
                {tx('Accès refusé par le backend')}
              </p>
              <p className="mt-xs font-body text-body text-text-secondary">
                {tx(
                  'Les routes /conversations sont placées sous le middleware role:client (routes/api.php) : un livreur reçoit un 403. Le contrôleur, lui, sait déjà traiter les livreurs (client_id OR livreur_id) — sortir ces trois routes du groupe client suffit à activer cet écran.',
                )}
              </p>
              <button
                type="button"
                onClick={() => void chargerListe()}
                className="mt-sm rounded-lg bg-bg-card px-md py-xs font-label text-label font-bold text-primary-container shadow-sm transition-all hover:bg-primary-tint"
              >
                {tx('Réessayer')}
              </button>
            </div>
          ) : null}

          {erreurListe ? (
            <ApiErrorState
              title={tx('Conversations indisponibles')}
              message={erreurListe}
              onRetry={() => void chargerListe()}
              className="px-sm py-md"
            />
          ) : null}

          <div className="flex-1 overflow-y-auto">
            {chargementListe && fils.length === 0 ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-md border-b border-border-default/50 p-md">
                  <span className="h-12 w-12 shrink-0 rounded-full bg-bg-secondary" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-1/2 rounded bg-bg-secondary" />
                    <span className="block h-3 w-3/4 rounded bg-bg-secondary" />
                  </span>
                </div>
              ))
            ) : filsFiltres.length === 0 ? (
              <div className="p-md">
                <EmptyState
                  icon={<FaIcon name="chat_bubble" className="text-[28px] text-primary" />}
                  title={fils.length === 0 ? tx('Aucune conversation') : tx('Aucun résultat')}
                  description={
                    fils.length === 0
                      ? tx('Le fil se crée automatiquement quand un manager vous affecte une course.')
                      : tx('Aucun fil ne correspond à cette recherche.')
                  }
                />
              </div>
            ) : (
              filsFiltres.map((f) => {
                const actif = f.id === actifId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActifId(f.id);
                      setDetails(false);
                    }}
                    className={clsx(
                      'flex w-full gap-md border-b border-border-default/50 p-md text-left transition-all',
                      actif ? 'border-l-[3px] border-l-primary-container bg-primary-tint' : 'hover:bg-bg-secondary',
                    )}
                  >
                    <span className="relative shrink-0">
                      <span
                        className={clsx(
                          'flex h-12 w-12 items-center justify-center rounded-full font-h3 text-h3 font-bold text-white',
                          actif ? 'bg-success-dark' : 'bg-secondary-container',
                        )}
                      >
                        {f.initiales}
                      </span>
                      {/* La maquette dessine une pastille de présence verte : le backend n'expose
                          aucune présence, elle reste donc grise et n'affirme rien. */}
                      <span
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-border-default"
                        title={tx('Présence non exposée par le backend')}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mb-xs flex items-center justify-between gap-sm">
                        <span className="truncate font-h3 text-h3 font-bold text-text-main">
                          {f.nom === '—' ? tx('Client TOKPa') : f.nom}
                        </span>
                        <span className="shrink-0 font-micro text-micro text-text-tertiary">{f.heure ?? '—'}</span>
                      </span>
                      <span
                        className={clsx(
                          'mb-sm block truncate font-secondary text-secondary',
                          actif ? 'font-medium text-primary-dark' : 'text-text-tertiary',
                        )}
                      >
                        {f.apercu ?? (f.chargement ? tx('Chargement…') : tx('Aucun message pour le moment'))}
                      </span>
                      <span
                        className={clsx(
                          'inline-block rounded-full px-sm py-[2px] font-micro text-micro font-bold',
                          TON_PASTILLE[tonStatut(f.statutBrut)],
                        )}
                      >
                        {f.ref}
                        {f.statutLabel ? ` · ${f.statutLabel}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {sansApercu > 0 ? (
            <p className="border-t border-border-default/60 px-md py-sm font-micro text-micro text-text-tertiary">
              {tr(
                `${sansApercu} fil(s) sans aperçu (limite de lecture).`,
                `${sansApercu} thread(s) without a preview (read limit).`,
              )}
            </p>
          ) : null}
        </aside>

        {/* ---------------- Conversation active ---------------- */}
        <section className={clsx('relative flex flex-1 flex-col bg-bg-app', actifId ? 'flex' : 'hidden lg:flex')}>
          {filActif ? (
            <>
              <header className="z-10 flex h-[64px] shrink-0 items-center justify-between gap-md border-b border-border-default bg-bg-card px-md md:px-lg">
                <div className="flex min-w-0 items-center gap-md">
                  <button
                    type="button"
                    onClick={() => setActifId(null)}
                    className="rounded-lg p-sm text-text-secondary transition-colors hover:bg-bg-secondary lg:hidden"
                    aria-label={tx('Retour à la liste')}
                  >
                    <FaIcon name="arrow_back" className="text-[20px]" />
                  </button>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-dark font-label font-bold text-white">
                    {filActif.initiales}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-h3 text-h3 leading-none text-text-main">
                      {filActif.nom === '—' ? tx('Client TOKPa') : filActif.nom}
                    </h2>
                    <div className="mt-1 flex items-center gap-xs">
                      <span className="h-2 w-2 rounded-full bg-border-default" />
                      <span className="truncate font-label text-label text-text-secondary">
                        {filActif.ouvertDepuis
                          ? tr(
                              `Conversation ouverte le ${filActif.ouvertDepuis}`,
                              `Thread opened ${filActif.ouvertDepuis}`,
                            )
                          : tx('Conversation')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-sm">
                  <button
                    type="button"
                    disabled
                    title={tx('Le backend ne transmet pas le numéro du client au livreur.')}
                    className="cursor-not-allowed rounded-lg p-sm text-text-secondary opacity-50 transition-all hover:bg-primary-tint hover:text-primary-container"
                    aria-label={tx('Appeler le client')}
                  >
                    <FaIcon name="call" className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    disabled={!filActif.orderId}
                    title={
                      filActif.orderId
                        ? tx('Ouvrir la course : carte, itinéraire et destination')
                        : tx('Aucune course liée à ce fil.')
                    }
                    onClick={() =>
                      filActif.orderId
                        ? navigate({ to: '/livreur/course', search: { commande: filActif.orderId } })
                        : undefined
                    }
                    className="rounded-lg p-sm text-text-secondary transition-all hover:bg-primary-tint hover:text-primary-container disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={tx('Voir la destination')}
                  >
                    <FaIcon name="map" className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetails((v) => !v)}
                    aria-pressed={details}
                    className={clsx(
                      'rounded-lg p-sm transition-all hover:bg-primary-tint hover:text-primary-container',
                      details ? 'bg-primary-tint text-primary-container' : 'text-text-secondary',
                    )}
                    aria-label={tx('Détails de la commande')}
                  >
                    <FaIcon name="info" className="text-[20px]" />
                  </button>
                </div>
              </header>

              {/* Bandeau de contexte (maquette) */}
              <div className="mx-md mt-md flex flex-wrap items-center justify-between gap-sm rounded-lg border border-primary-light bg-primary-tint px-md py-sm">
                <span className="flex flex-wrap items-center gap-sm font-label text-label text-text-main">
                  <FaIcon name="shopping_bag" className="text-[18px] text-primary-container" />
                  {tx('Commande')} <strong className="text-primary-container">{filActif.ref}</strong>
                  <span className="text-text-tertiary">·</span>
                  {filActif.montant}
                  {filActif.statutLabel ? (
                    <>
                      <span className="text-text-tertiary">·</span>
                      {filActif.statutLabel}
                    </>
                  ) : null}
                </span>
                {filActif.orderId ? (
                  <button
                    type="button"
                    onClick={() => navigate({ to: '/livreur/course', search: { commande: filActif.orderId as number } })}
                    className="font-label text-label font-bold text-primary-container hover:underline"
                  >
                    {tx('Suivre')}
                  </button>
                ) : (
                  <span className="font-micro text-micro text-text-tertiary">{tx('Aucune course liée')}</span>
                )}
              </div>

              {details ? (
                <div className="tokpa-pop mx-md mt-sm grid gap-sm rounded-lg border border-border-default bg-bg-card p-md sm:grid-cols-2">
                  {(
                    [
                      [tx('Conversation'), `#${filActif.id}`],
                      [tx('Course'), filActif.orderId ? String(filActif.orderId) : '—'],
                      [tx('Montant total'), filActif.montant],
                      [tx('Statut de la course'), filActif.statutLabel || '—'],
                      [tx('Indice de livraison'), filActif.indice ?? '—'],
                      [tx('Ouverte le'), filActif.ouvertDepuis ?? '—'],
                    ] as [string, string][]
                  ).map(([cle, valeur]) => (
                    <div key={cle} className="flex items-baseline justify-between gap-sm">
                      <span className="font-micro text-micro uppercase tracking-wider text-text-secondary">{cle}</span>
                      <span className="truncate font-label text-label font-bold text-text-main">{valeur}</span>
                    </div>
                  ))}
                  <p className="font-micro text-micro text-text-tertiary sm:col-span-2">
                    {tx('Lecture seule : la conversation ne porte que la commande, jamais le profil du client.')}
                  </p>
                </div>
              ) : null}

              {/* Fil de messages */}
              <div ref={zone} className="flex-1 overflow-y-auto px-md pb-lg pt-md md:px-lg">
                {chargementFil ? (
                  <div className="flex items-center justify-center gap-sm py-xl text-text-secondary">
                    <FaIcon name="sync" className="animate-spin text-[18px]" />
                    <span className="font-label text-label">{tx('Chargement des messages…')}</span>
                  </div>
                ) : erreurFil ? (
                  <ApiErrorState
                    title={tx('Messages indisponibles')}
                    message={erreurFil}
                    onRetry={() => void chargerFil(filActif.id)}
                    className="rounded-lg bg-bg-card"
                  />
                ) : messages.length === 0 ? (
                  <EmptyState
                    icon={<FaIcon name="chat_bubble" className="text-[28px] text-primary" />}
                    title={tx('Aucun message')}
                    description={tx('Écrivez le premier : le client lit cette conversation sur son écran de suivi.')}
                  />
                ) : (
                  <div className="flex flex-col gap-md">
                    {groupes.map((g) => (
                      <div key={`${g.jour}-${String(g.messages[0]?.id ?? 0)}`} className="flex flex-col gap-md">
                        {g.jour ? (
                          <div className="my-md flex justify-center">
                            <span className="rounded-full bg-border-default px-md py-1 font-micro text-micro font-bold uppercase text-text-secondary">
                              {g.jour === "Aujourd'hui" ? tx("Aujourd'hui") : g.jour}
                            </span>
                          </div>
                        ) : null}
                        {g.messages.map((m, i) => {
                          const parMoi = estDeMoi(m, moi);
                          return (
                            <div
                              key={m.id}
                              className={clsx(
                                'tokpa-pop flex max-w-[78%] flex-col gap-xs',
                                parMoi ? 'items-end self-end' : 'items-start self-start',
                              )}
                              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                            >
                              <div
                                className={clsx(
                                  'bubble p-md text-body',
                                  parMoi
                                    ? 'bubble-sent shadow-md text-white'
                                    : 'bubble-received border border-border-default/50 bg-white text-text-main shadow-sm',
                                )}
                              >
                                {m.contenu}
                              </div>
                              <span className="px-1 font-micro text-micro text-text-tertiary">
                                {heureCourte(m.created_at) || '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {dernierePage > page ? (
                      <p className="pt-sm text-center font-micro text-micro text-text-tertiary">
                        {tr(
                          `Page ${page} sur ${dernierePage} — les messages plus anciens ne sont pas chargés.`,
                          `Page ${page} of ${dernierePage} — older messages are not loaded.`,
                        )}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Composeur (maquette : attach_file · champ · mood · send) */}
              <footer className="relative shrink-0 border-t border-border-default bg-bg-card p-md md:px-lg">
                {palette ? (
                  <div className="tokpa-pop absolute bottom-full left-md mb-sm flex gap-1 rounded-lg border border-border-default bg-bg-card p-sm shadow-lg">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setBrouillon((v) => v + e);
                          setPalette(false);
                        }}
                        className="rounded p-1 text-[18px] transition-transform hover:scale-110"
                        aria-label={tr(`Insérer ${e}`, `Insert ${e}`)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                ) : null}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void envoyer();
                  }}
                  className="flex items-center gap-md"
                >
                  <button
                    type="button"
                    disabled
                    title={tx('Aucune route de téléversement dans le backend : la discussion reste textuelle.')}
                    className="cursor-not-allowed text-text-tertiary opacity-50 transition-colors"
                    aria-label={tx('Joindre un fichier')}
                  >
                    <FaIcon name="attach_file" className="text-[20px]" />
                  </button>

                  <div className="flex flex-1 items-center rounded-full bg-bg-app px-md">
                    <input
                      value={brouillon}
                      onChange={(e) => setBrouillon(e.target.value)}
                      placeholder={tx('Écrire un message…')}
                      aria-label={tx('Écrire un message')}
                      className="w-full bg-transparent py-[10px] font-body text-body text-text-main focus:outline-none"
                    />
                    <span
                      className={clsx(
                        'ml-sm shrink-0 font-micro text-micro',
                        controle.restant < 0 ? 'font-bold text-error' : 'text-text-tertiary',
                      )}
                    >
                      {brouillon.length}/{LONGUEUR_MAX_MESSAGE}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPalette((v) => !v)}
                      aria-pressed={palette}
                      className="ml-sm shrink-0 text-text-tertiary transition-colors hover:text-primary-container"
                      aria-label={tx('Insérer un émoji')}
                    >
                      <FaIcon name="mood" className="text-[20px]" />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!controle.pret || envoi}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-white shadow-lg transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={tx('Envoyer')}
                  >
                    <FaIcon name={envoi ? 'sync' : 'send'} className={clsx('text-[18px]', envoi && 'animate-spin')} />
                  </button>
                </form>

                {controle.raison ? (
                  <p className="mt-sm text-right font-micro text-micro font-bold text-error">
                    {tx(controle.raison)}{' '}
                    {tr(
                      `${controle.excedent} caractère(s) à retirer.`,
                      `${controle.excedent} character(s) to remove.`,
                    )}
                  </p>
                ) : null}
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-lg">
              <EmptyState
                icon={<FaIcon name="chat_bubble" className="text-[28px] text-primary" />}
                title={tx('Aucune conversation sélectionnée')}
                description={tx('Choisissez un fil dans la liste pour écrire au client.')}
              />
            </div>
          )}
        </section>
      </div>
    </LivreurLayout>
  );
}
