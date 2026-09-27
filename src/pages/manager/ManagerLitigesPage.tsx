import { useMemo, useState } from 'react';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import MIcon from '../../components/shared/MIcon';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/* eslint-disable @typescript-eslint/no-explicit-any */

type Litige = {
  id: string; cde: string; motif: string; icon: string; categorie: string;
  urgent: boolean; temps: string; trajet?: string;
  partieA: string; partieB: string; montantLabel: string; montant: string;
  resolu?: boolean;
};

const MAQUETTE: Litige[] = [
  { id: '#LIT-1042', cde: '#TOK-2847', motif: 'Produit non conforme / abîmé', icon: 'broken_image', categorie: 'Qualité Produit', urgent: true, temps: 'Il y a 25 min', trajet: 'Marché Dantokpa Box #B-14 → Akpakpa Centre', partieA: 'Client Kossi Ouédraogo', partieB: 'Vendeuse Afi Mensah', montantLabel: 'Montant en jeu', montant: '3 500' },
  { id: '#LIT-1039', cde: '#TOK-2841', motif: 'Désaccord sur le prix négocié', icon: 'price_change', categorie: 'Tarif & Négociation', urgent: false, temps: 'Il y a 1h 10min', partieA: 'Livreur Boris Agossou', partieB: 'Client Marceline Dossou', montantLabel: 'Montant en jeu', montant: '800' },
  { id: '#LIT-1035', cde: '#TOK-2819', motif: 'Retard de livraison', icon: 'alarm_off', categorie: 'Retard / Livraison', urgent: false, temps: "Aujourd'hui 11:20", partieA: 'Client Patrice Hounnou', partieB: 'Livreur Salifou D.', montantLabel: 'Montant initial', montant: '4 200', resolu: true },
  { id: '#LIT-1031', cde: '#TOK-2804', motif: 'Produit manquant / incomplet', icon: 'inventory_2', categorie: 'Qualité Produit', urgent: false, temps: 'Hier 18:40', partieA: 'Cliente Viviane A.', partieB: 'Vendeuse Blandine G.', montantLabel: 'Montant remboursé', montant: '1 200', resolu: true },
];

const ONGLETS = [
  { label: 'Tous', n: 6, f: null },
  { label: 'Urgents / Haute priorité', n: 2, f: 'urgents' },
  { label: 'Qualité Produit', n: 2, f: 'Qualité Produit' },
  { label: 'Retard / Livraison', n: 1, f: 'Retard / Livraison' },
  { label: 'Tarif & Négociation', n: 1, f: 'Tarif & Négociation' },
  { label: 'Résolus', n: 2, f: 'resolus' },
] as const;

export default function ManagerLitigesPage() {
  useLanguage();
  const [filtre, setFiltre] = useState<string | null>(null);

  const cartes = useMemo(
    () =>
      MAQUETTE.filter((l) => {
        if (!filtre) return true;
        if (filtre === 'urgents') return l.urgent && !l.resolu;
        if (filtre === 'resolus') return !!l.resolu;
        return l.categorie === filtre;
      }),
    [filtre],
  );

  return (
    <ManagerLayout currentPath="/manager/litiges">
      <div className="space-y-6">
        <div className="rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Non branché — endpoint absent (B-16)")}</p>
          <p>
            {tx("Le backend n’expose pas encore de endpoints litiges")} (<span className="font-mono">/manager/disputes</span>).
            {tx("L’écran ci-dessous est un")} <strong>{tx("aperçu maquette")}</strong> — {tx("aucune donnée réelle.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h2 font-h2 font-bold">{tx("Gestion des Litiges & Réclamations")}</h1>
          <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-overline font-semibold">MAQUETTE</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {ONGLETS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setFiltre(o.f)}
              className={`rounded-full border px-3 py-1.5 text-label font-semibold transition ${
                filtre === o.f
                  ? 'border-primary bg-primary text-white'
                  : 'border-border-default bg-white text-text-secondary hover:border-primary hover:text-primary'
              }`}
            >
              {tx(o.label)} ({o.n})
            </button>
          ))}
        </div>

        <div className="space-y-4 opacity-70">
          {cartes.map((l) => (
            <div key={l.id} className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-label font-bold">
                  {l.id} <span className="text-text-secondary">· Cde {l.cde}</span>
                </p>
                <div className="flex items-center gap-2 text-label">
                  {l.resolu ? (
                    <span className="rounded-full bg-success-container px-2.5 py-1 font-semibold">{tx("Résolu")}</span>
                  ) : l.urgent ? (
                    <span className="rounded-full bg-error-container px-2.5 py-1 font-semibold text-on-error-container">
                      {tx("Haute Priorité")}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1 text-text-secondary">
                    <MIcon name="schedule" className="text-[16px]" />
                    {tx(l.temps)}
                  </span>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-2 text-label font-semibold">
                <MIcon name={l.icon} className="text-[18px] text-primary" />
                {tx(l.motif)}
              </p>
              {l.trajet && <p className="mt-1 text-label text-text-secondary">{l.trajet}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-3 text-label">
                <p className="text-text-secondary">
                  {tx("Parties :")} <span className="font-semibold text-on-surface">{l.partieA}</span> vs{' '}
                  <span className="font-semibold text-on-surface">{l.partieB}</span>
                </p>
                <p className="text-text-secondary">
                  {tx(l.montantLabel)} : <span className="font-bold text-on-surface">{l.montant} FCFA</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ManagerLayout>
  );
}
