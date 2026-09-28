import { chatApi } from '../../../services/api';
import { fmtFcfa, heureCourte, listOf, metaOf, unwrap } from '../../../services/api/unwrap';
import { initialsOf } from '../../../routes/authGuard';
import { statutLabel, tokRef } from '../livreurData';

/**
 * Données de la messagerie livreur.
 *
 * Le backend n'expose que trois routes de discussion (`ChatController`) :
 *   GET  /conversations                        → conversations dont on est client OU livreur
 *   GET  /conversations/{id}/messages?page=n   → paginateur de 50 messages, `sender` chargé
 *   POST /conversations/{id}/messages           → { contenu: string, max 1000 }
 *
 * Tout ce que ces réponses ne contiennent pas reste absent de l'écran : pas de nom de client
 * (`Conversation` ne charge que `order`), pas de badge « non lus » (aucune route de marquage),
 * pas de présence en ligne, pas de pièce jointe (aucun téléversement). Le nom de l'interlocuteur
 * vient des `sender` portés par les messages, et l'aperçu du dernier message exige un appel par fil.
 */

/** `conversations` tel que renvoyé par le contrôleur (modèle Eloquent cru + relation `order`). */
interface ConversationBrute {
  id: number;
  order_id?: number | null;
  client_id?: number | null;
  livreur_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  order?: {
    id?: number;
    statut?: string;
    montant_total?: string | number;
    description_lieu?: string | null;
    created_at?: string | null;
  } | null;
}

/** Message, sous sa forme minimale : les bulles n'ont besoin d'aucun autre champ. */
export interface MessageLeger {
  id: string | number;
  sender_id: number;
  contenu: string;
  created_at?: string | null;
  sender?: { nom?: string | null; prenom?: string | null; nom_complet?: string | null } | null;
}

export interface Fil {
  id: number;
  orderId: number | null;
  /** Référence affichée, fabriquée côté front (`#TOK-{id}`), comme partout dans l'espace livreur. */
  ref: string;
  /** `commandes.statut` brut, seul exploitable pour la couleur de la pastille. */
  statutBrut: string;
  statutLabel: string;
  montant: string;
  /** `commandes.description_lieu` : seul indice de destination porté par la conversation. */
  indice: string | null;
  ouvertDepuis: string | null;
  nom: string;
  initiales: string;
  /** Dernier message du fil, rempli après lecture des messages — jamais inventé. */
  apercu: string | null;
  heure: string | null;
  /** true tant que les messages du fil n'ont pas été lus (aperçu et nom encore inconnus). */
  chargement: boolean;
}

/** `contenu` est validé `max:1000` par `StoreMessageRequest` : on reprend la même borne. */
export const LONGUEUR_MAX_MESSAGE = 1000;

/**
 * Date seule et lisible (jour, mois, année) : `dateCourte` du client HTTP ajoute l'heure, ce qui
 * n'a rien à faire dans un libellé « Conversation ouverte le … ».
 */
export function dateSeule(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function estDeMoi(message: Pick<MessageLeger, 'sender_id'>, monId: number | null): boolean {
  return monId != null && Number(message.sender_id) === Number(monId);
}

/**
 * Nom de l'interlocuteur : la conversation ne le porte pas, chaque message oui (`sender`).
 * On prend le premier message qui n'est pas du livreur.
 */
export function nomPartenaire(messages: readonly MessageLeger[], monId: number | null): string | null {
  for (const m of messages) {
    if (estDeMoi(m, monId)) continue;
    const s = m.sender;
    const complet = typeof s?.nom_complet === 'string' && s.nom_complet.trim() ? s.nom_complet.trim() : null;
    if (complet) return complet;
    const parti = [s?.prenom, s?.nom].map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean).join(' ');
    if (parti) return parti;
  }
  return null;
}

export function initialesOuVide(nom: string | null): string {
  return nom ? initialsOf(nom, '··') : '··';
}

export function tronquer(texte: string, taille = 60): string {
  const plat = texte.replace(/\s+/g, ' ').trim();
  if (plat.length <= taille) return plat;
  return `${plat.slice(0, taille - 1).trimEnd()}…`;
}

/** Aperçu = dernier message du fil, préfixé « Vous : » quand c'est le livreur qui a parlé. */
export function apercuDuFil(
  messages: readonly MessageLeger[],
  monId: number | null,
): { texte: string; heure: string | null } | null {
  const dernier = messages[messages.length - 1];
  if (!dernier) return null;
  const corps = tronquer(String(dernier.contenu ?? ''));
  return {
    texte: estDeMoi(dernier, monId) ? `Vous : ${corps}` : corps,
    heure: dernier.created_at ? heureCourte(dernier.created_at) : null,
  };
}

/**
 * Libellé du séparateur de jour, dans l'ordre de la maquette : « AUJOURD'HUI », « Hier »,
 * jour abrégé si la semaine est en cours, sinon date (sans heure : un séparateur de jour n'affiche
 * pas 08:00).
 */
export function libelleJour(iso: string | null | undefined, ref: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const minuit = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecartJours = Math.round((minuit(ref) - minuit(d)) / 86_400_000);
  if (ecartJours === 0) return "Aujourd'hui";
  if (ecartJours === 1) return 'Hier';
  if (ecartJours > 1 && ecartJours < 7) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).replace('.', '');
  }
  return dateSeule(iso) ?? '';
}

/** Regroupement chronologique des bulles (ordre backend : `created_at` ascendant). */
export function grouperParJour(
  messages: readonly MessageLeger[],
  ref: Date = new Date(),
): { jour: string; messages: MessageLeger[] }[] {
  const groupes: { jour: string; messages: MessageLeger[] }[] = [];
  for (const m of messages) {
    const jour = libelleJour(m.created_at, ref);
    const precedent = groupes[groupes.length - 1];
    if (precedent && precedent.jour === jour) precedent.messages.push(m);
    else groupes.push({ jour, messages: [m] });
  }
  return groupes;
}

/** Contrôle de saisie du composeur : ni vide, ni au-delà de la borne du backend. */
export function controleMessage(texte: string): {
  pret: boolean;
  raison: string | null;
  excedent: number;
  restant: number;
} {
  const valeur = texte.trim();
  const restant = LONGUEUR_MAX_MESSAGE - texte.length;
  if (valeur === '') return { pret: false, raison: null, excedent: 0, restant };
  // La raison reste une phrase stable (traduisable) ; le nombre est affiché à côté.
  if (restant < 0) return { pret: false, raison: 'Message trop long.', excedent: -restant, restant };
  return { pret: true, raison: null, excedent: 0, restant };
}

/** Tonalité de la pastille de course, alignée sur les statuts réellement utilisés par le backend. */
export function tonStatut(statut: string | null | undefined): 'course' | 'fini' | 'annule' | 'neutre' {
  if (!statut) return 'neutre';
  if (statut === 'livre') return 'fini';
  if (statut === 'annule' || statut === 'annulée') return 'annule';
  if (statut === 'en_attente' || statut === 'en_preparation' || statut === 'en_livraison') return 'course';
  return 'neutre';
}

/**
 * `routes/api.php` place les trois routes de chat dans le groupe `role:client` : un livreur obtient
 * donc un 403 (ou 401 sans session). L'écran doit le dire au lieu d'afficher une liste vide.
 */
export function etatAccesChat(err: unknown): { interdit: boolean; status: number | null } {
  // Lecture locale du statut : la couche données ne doit dépendre d'aucun composant d'UI.
  const status = (err as { response?: { status?: number } })?.response?.status ?? null;
  return { interdit: status === 403 || status === 401, status };
}

/** Messages d'une conversation, paginateur Laravel inclus (50 par page). */
export async function chargerMessages(
  conversationId: number,
  page = 1,
): Promise<{ messages: MessageLeger[]; page: number; dernierePage: number; total: number }> {
  const res = await chatApi.getMessages(conversationId, page);
  const corps = unwrap(res);
  const meta = metaOf(res);
  const bruts = listOf(corps) as MessageLeger[];
  return {
    messages: bruts.map((m) => ({
      id: m.id,
      sender_id: Number(m.sender_id) || 0,
      contenu: String(m.contenu ?? ''),
      created_at: m.created_at ?? null,
      sender: m.sender ?? null,
    })),
    page: Number(corps?.current_page ?? meta?.page ?? page) || page,
    dernierePage: Number(corps?.last_page ?? page) || page,
    total: Number(corps?.total ?? meta?.total ?? 0) || 0,
  };
}

function filDepuisConversation(c: ConversationBrute): Fil {
  const order = c.order ?? null;
  const orderId = order?.id ?? (c.order_id != null ? Number(c.order_id) : null);
  const brut = String(order?.statut ?? '');
  return {
    id: Number(c.id),
    orderId: Number.isFinite(Number(orderId)) && orderId != null ? Number(orderId) : null,
    ref: orderId != null ? tokRef(orderId) : '—',
    statutBrut: brut,
    statutLabel: brut ? statutLabel(brut) : '',
    montant: order?.montant_total != null ? fmtFcfa(order.montant_total) : '—',
    indice:
      typeof order?.description_lieu === 'string' && order.description_lieu.trim()
        ? order.description_lieu.trim()
        : null,
    ouvertDepuis: dateSeule(c.created_at),
    nom: '—',
    initiales: '··',
    apercu: null,
    heure: c.updated_at ? heureCourte(c.updated_at) : null,
    chargement: true,
  };
}

/**
 * Liste des fils du livreur. L'aperçu et le nom de l'interlocuteur exigent un appel messages par
 * conversation : on les limite aux `maxApercus` premiers fils (le reste affiche un état vide
 * honnête) et `sansApercu` dit combien.
 */
export async function chargerFils(
  monId: number | null,
  maxApercus = 8,
): Promise<{ fils: Fil[]; sansApercu: number }> {
  const res = await chatApi.getConversations();
  const liste = listOf(unwrap(res)) as ConversationBrute[];
  const fils = liste.map(filDepuisConversation);

  const enrichis = await Promise.all(
    fils.map(async (f, i) => {
      if (i >= maxApercus) return { ...f, chargement: false };
      try {
        const { messages } = await chargerMessages(f.id);
        const nom = nomPartenaire(messages, monId);
        const apercu = apercuDuFil(messages, monId);
        return {
          ...f,
          nom: nom ?? f.nom,
          initiales: initialesOuVide(nom),
          apercu: apercu?.texte ?? null,
          heure: apercu?.heure ?? f.heure,
          chargement: false,
        };
      } catch {
        // Un fil illisible ne doit pas casser la liste : l'aperçu reste vide, avec son motif.
        return { ...f, chargement: false };
      }
    }),
  );

  return { fils: enrichis, sansApercu: Math.max(0, enrichis.length - maxApercus) };
}
