import type { LivreurOrder } from '../livreurData';
import { articlesCount, dateHeure, destination, tokRef } from '../livreurData';
import { fmtFcfa } from '../../../services/api/unwrap';

export interface RecuLigne {
  label: string;
  value: string;
}

export interface RecuOptions {
  /** Nom de la zone du repère (résolu via GET /zones), null si inconnue. */
  zone?: string | null;
  /** Nom du livreur qui génère le reçu (GET /profile côté page). */
  livreur?: string | null;
}

/**
 * Contenu texte du reçu de course — construit uniquement avec les champs réellement renvoyés par
 * GET /livreur/history (OrderResource) : référence, date, destination, zone, articles, montants.
 * Séparé du PDF pour que l'assemblage soit testable sans renderer.
 */
export function lignesRecu(order: LivreurOrder, opts: RecuOptions = {}): RecuLigne[] {
  const items = (order.items ?? [])
    .map((it) => `${it.quantite}x ${it.nom ?? `Produit #${it.product_id}`} — ${fmtFcfa(it.prix_unitaire)}`)
    .join(' / ');
  return [
    { label: 'Commande', value: tokRef(order.id) },
    { label: 'Date de la commande', value: dateHeure(order.created_at) },
    { label: 'Statut', value: order.statut },
    { label: 'Destination', value: destination(order) },
    { label: 'Zone', value: opts.zone?.trim() || '—' },
    { label: 'Articles livrés', value: items || '—' },
    { label: 'Nombre d’articles', value: String(articlesCount(order)) },
    { label: 'Montant de la commande', value: fmtFcfa(order.montant_total) },
    { label: 'Frais de livraison', value: fmtFcfa(order.frais_livraison) },
  ];
}

/**
 * Reçu PDF de la course, généré côté client avec jsPDF (import dynamique : la page n'embarque le
 * renderer que si l'utilisateur clique). Aucune donnée inventée : les lignes viennent de lignesRecu().
 */
export async function telechargerRecu(order: LivreurOrder, opts: RecuOptions = {}): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const left = 48;
  let y = 64;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(249, 115, 22);
  doc.text('TOKPa', left, y);
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  y += 18;
  doc.text(`Reçu de course${opts.livreur ? ` — ${opts.livreur}` : ''}`, left, y);

  y += 26;
  doc.setDrawColor(229, 231, 235);
  doc.line(left, y, 547, y);

  y += 26;
  for (const ligne of lignesRecu(order, opts)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(ligne.label, left, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    const value = doc.splitTextToSize(ligne.value, 300) as string[];
    doc.text(value, 240, y);
    y += 16 + (value.length - 1) * 12;
    if (y > 760) break; // garde-page : un reçu de course tient sur une page
  }

  y += 18;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Généré le ' + new Date().toLocaleString('fr-FR') + ' — donnees issues de l’historique livreur TOKPa.',
    left,
    y,
  );

  const filename = `recu-tokpa-${order.id}.pdf`;
  doc.save(filename);
  return filename;
}
