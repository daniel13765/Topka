import { useState } from 'react';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


const ONGLETS = ['Zone & Tarification', 'Règles d’attribution', 'Alertes & Notifications', 'Compte & Sécurité'];

function Ligne({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  useLanguage();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default py-3 first:border-t-0">
      <div>
        <p className="text-label font-semibold">{label}</p>
        {aide && <p className="text-label text-text-secondary">{aide}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const inputCls = 'w-44 rounded-lg border border-border-default px-3 py-2 text-label';

export default function ManagerParametresPage() {
  useLanguage();
  const [onglet, setOnglet] = useState(ONGLETS[0]);
  const [enregistre, setEnregistre] = useState(false);

  const enregistrer = () => {
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 2500);
  };

  return (
    <ManagerLayout currentPath="/manager/parametres">
      <div className="space-y-6">
        <div className="rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Non branché — endpoint absent (B-16)")}</p>
          <p>
            {tx("Pas de endpoints paramètres de zone côté backend")} (<span className="font-mono">/manager/settings</span>).
            {tx("Aperçu")} <strong>{tx("maquette")}</strong> — {tx("« Enregistrer » n’écrit nulle part.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-h2 font-h2 font-bold">{tx("Paramètres de la Zone & Préférences")}</h1>
            <p className="text-label font-semibold text-success">{tx("Zone Ouverte & Opérationnelle")}</p>
          </div>
          <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-overline font-semibold">MAQUETTE</span>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border-default pb-2">
          {ONGLETS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOnglet(o)}
              className={`rounded-lg px-3 py-2 text-label font-semibold transition ${
                onglet === o ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'
              }`}
            >
{tx(o)}
            </button>
          ))}
        </div>

        <div className="opacity-70">
          {onglet === ONGLETS[0] && (
            <div className="space-y-6">
              <section className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
                <h2 className="text-h3 font-h3 font-bold">{tx("Périmètre Opérationnel — Zone Akpakpa")}</h2>
                <p className="text-label text-text-secondary">
                  {tx("Définition de la couverture géographique et des marchés couverts")}
                </p>
                <div className="mt-4">
                  <Ligne label={tx("Nom officiel de la zone")}>
                    <input type="text" defaultValue={tx("Zone Akpakpa")} className={inputCls} />
                  </Ligne>
                  <Ligne label="Rayon de couverture maximal">
                    <select className={inputCls} defaultValue="12 km (Akpakpa)">
                      <option>3 km (local)</option>
                      <option>12 km (Akpakpa)</option>
                      <option>{tx("25 km (Grand Cotonou)")}</option>
                    </select>
                  </Ligne>
                  <Ligne
                    label={tx("Ouverture de la zone aux commandes clients")}
                    aide={tx("Permet l’enregistrement de commandes et l’assignation de courses aux livreurs")}
                  >
                    <input type="checkbox" defaultChecked className="h-5 w-5 accent-primary" />
                  </Ligne>
                </div>
              </section>
              <section className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
                <h2 className="text-h3 font-h3 font-bold">{tx("Barème Tarifaire & Frais de Course")}</h2>
                <div className="mt-4">
                  <Ligne label={tx("Forfait de base (0 à 3 km)")}>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="0" className={inputCls} />
                      <span className="text-label text-text-secondary">FCFA</span>
                    </div>
                  </Ligne>
                  <Ligne label={tx("Prix au kilomètre au-delà de 3 km")} aide={tx("Par km supplémentaire")}>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="0" className={inputCls} />
                      <span className="text-label text-text-secondary">FCFA</span>
                    </div>
                  </Ligne>
                </div>
              </section>
            </div>
          )}

          {onglet === ONGLETS[1] && (
            <section className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
              <h2 className="text-h3 font-h3 font-bold">{tx("Attribution & Dispatch des Livreurs")}</h2>
              <div className="mt-4">
                <Ligne label={tx("Attribution automatique au plus proche (Recommandé)")} aide={tx("Actif")}>
                  <input type="radio" name="dispatch" defaultChecked className="h-4 w-4 accent-primary" />
                </Ligne>
                <Ligne label={tx("Diffusion ouverte (Premier arrivé, premier servi)")} aide="Secondaire">
                  <input type="radio" name="dispatch" className="h-4 w-4 accent-primary" />
                </Ligne>
                <Ligne label={tx("Délai d’acceptation par livreur")}>
                  <select className={inputCls} defaultValue={tx("45 secondes (conseillé)")}>
                    <option>30 secondes</option>
                    <option>{tx("45 secondes (conseillé)")}</option>
                    <option>60 secondes</option>
                    <option>90 secondes</option>
                  </select>
                </Ligne>
              </div>
            </section>
          )}

          {onglet === ONGLETS[2] && (
            <section className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
              <h2 className="text-h3 font-h3 font-bold">{tx("Alertes Manager & Seuils")}</h2>
              <div className="mt-4">
                <Ligne label={tx("Alerte livreurs insuffisants")} aide="Si moins de 5 livreurs sont actifs">
                  <input type="checkbox" defaultChecked className="h-5 w-5 accent-primary" />
                </Ligne>
                <Ligne label="Retard critique de course">
                  <input type="text" defaultValue="40 min" className={inputCls} />
                </Ligne>
              </div>
            </section>
          )}

          {onglet === ONGLETS[3] && (
            <section className="rounded-lg border border-border-default bg-white p-lg shadow-sm">
              <h2 className="text-h3 font-h3 font-bold">{tx("Manager certifié TOKPa")}</h2>
              <div className="mt-4">
                <Ligne label={tx("Téléphone direct (Bénin)")}>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-bg-secondary px-3 py-2 text-label">+229</span>
                    <input type="text" className={inputCls} />
                  </div>
                </Ligne>
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          {enregistre && (
            <p className="text-label font-semibold text-error">{tx("Enregistrement impossible — endpoint absent (B-16).")}</p>
          )}
          <button type="button" className="btn btn-primary" onClick={enregistrer}>
            {tx("Enregistrer les modifications")}
          </button>
        </div>
      </div>
    </ManagerLayout>
  );
}
