import { useState } from 'react';
import { useDesignScript } from '../../utils/designRuntime';
import { adminApi } from '../../services/api';
import { useLiveRows } from '../../services/api/useLiveRows';
import { listOf } from '../../services/api/unwrap';
import { formatApiError } from '../../utils/apiError';
import DESIGN_SCRIPT from './_scripts/AdminCategoriesPage';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import MIcon from '../../components/shared/MIcon';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';


const DESIGN_CSS = `
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        .active-nav-item {
            background-color: #f97316; /* Primary container simulation */
            color: white;
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border-left: 1px solid rgba(229, 231, 235, 0.5);
        }
    `;

/**
 * AdminCategoriesPage — copie conforme statique du design Stitch (code.html).
 * Interactions : script du design exécuté via useDesignScript (comportement copié).
 */
const CAT_ICON = (nom: string): string =>
  /épic|epic|sauce|assais/i.test(nom) ? 'liquor'
    : /bois|jus|eau|sod/i.test(nom) ? 'local_drink'
      : /pain|boul|pâtiss|patis/i.test(nom) ? 'bakery_dining'
        : /fruit|légum|legum|frais|marc/i.test(nom) ? 'nutrition'
          : 'restaurant';

const ICON_CHOICES = ['nutrition', 'set_meal', 'liquor', 'restaurant', 'bakery_dining', 'local_drink', 'egg', 'icecream'];
const COLOR_CHOICES = [
  { key: 'primary', cls: 'bg-primary' },
  { key: 'tertiary', cls: 'bg-tertiary' },
  { key: 'secondary-container', cls: 'bg-secondary-container' },
  { key: 'success', cls: 'bg-success' },
  { key: 'on-surface-variant', cls: 'bg-on-surface-variant' },
];

export default function AdminCategoriesPage() {
  useLanguage();
  useDesignScript(DESIGN_SCRIPT);
  const { rows: cats, err, loading, reload } = useLiveRows(() => adminApi.getCategories());
  // Nombre de produits réel par catégorie (l'API ne renvoie pas produits_count, B-17) : calculé sur GET /admin/products
  const { rows: produits } = useLiveRows(async () => {
    const acc: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const res: any = await adminApi.getProducts({ per_page: 100, page });
      acc.push(...listOf(res));
      if (page >= Number(res?.meta?.last_page ?? 1)) break;
    }
    return { data: acc };
  });
  const countByCat = new Map<number, number>();
  produits.forEach((pr: any) => {
    const id = Number(pr?.categorie?.id ?? pr?.categorie_id);
    if (id) countByCat.set(id, (countByCat.get(id) ?? 0) + 1);
  });
  const [sel, setSel] = useState<any>(null);
  const [fNom, setFNom] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fIcon, setFIcon] = useState('nutrition');
  const [fColor, setFColor] = useState('primary');
  const [fAccueil, setFAccueil] = useState(true);

  const showToast = () => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.classList.remove('translate-y-20', 'opacity-0');
    window.setTimeout(() => el.classList.add('translate-y-20', 'opacity-0'), 2200);
  };
  const selectCat = (c: any) => {
    setSel(c);
    setFNom(String(c.nom ?? ''));
    setFDesc(String(c.description ?? ''));
    setFIcon(String(c.icone ?? CAT_ICON(String(c.nom ?? ''))));
    setFColor(String(c.couleur ?? 'primary'));
    setFAccueil(c.en_accueil ?? true);
  };
  const newCat = () => {
    setSel({ id: null });
    setFNom('');
    setFDesc('');
    setFIcon('nutrition');
    setFColor('primary');
    setFAccueil(false);
  };
  const saveCat = async () => {
    if (!fNom.trim()) {
      window.alert(tx("Le nom de la catégorie est obligatoire."));
      return;
    }
    const payload = {
      nom: fNom.trim(),
      description: fDesc,
      parent_id: sel?.parent_id ?? undefined,
      icone: fIcon,
      couleur: fColor,
      en_accueil: fAccueil,
    };
    try {
      if (sel?.id) await adminApi.updateCategory(sel.id, payload);
      else await adminApi.createCategory(payload);
      showToast();
      reload();
    } catch (e) {
      window.alert(formatApiError(e as any));
    }
  };
  const delCat = async (c: any) => {
    if (!window.confirm(tr(`Supprimer la catégorie « ${c.nom} » ?`, `Delete category “${c.nom}”?`))) return;
    try {
      await adminApi.deleteCategory(c.id);
      reload();
    } catch (e) {
      window.alert(formatApiError(e as any));
    }
  };

  return (
    <AdminLayout currentPath="/admin/categories" mainClassName="ml-64 h-screen pt-[52px] flex overflow-hidden">
      {err && (
        <div className="m-lg rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Erreur API")}</p>
          <p>{err}</p>
        </div>
      )}
      {loading && <p className="m-lg text-label text-text-secondary">{tx("Chargement des données réelles…")}</p>}
      <style>{DESIGN_CSS}</style>
  <section className="flex-1 overflow-y-auto p-lg pb-xl"> <div className="max-w-[1152px] mx-auto space-y-lg">  <div className="flex justify-between items-end"> <div> <nav className="flex items-center gap-2 text-micro text-text-tertiary uppercase tracking-widest mb-2"> <span className="">{tx("Catalogue")}</span> <MIcon name="chevron_right" className="text-[14px]" /> <span className="text-primary font-bold">{tx("Catégories")}</span> </nav> <h1 className="font-h1 text-h1 text-on-surface">{tx("Gestion des Catégories")}</h1> </div> <button className="flex items-center gap-2 px-6 py-3 bg-primary-container text-white font-bold rounded-[10px] hover:bg-primary-hover active:scale-[0.97] transition-all shadow-lg shadow-primary-container/20" onClick={newCat}> <MIcon name="add_circle" /> <span className="">{tx("Ajouter une catégorie")}</span> </button> </div>  <div className="grid grid-cols-1 md:grid-cols-3 gap-md"> <div className="bg-bg-card p-md rounded-xl border border-border-default flex items-center gap-4"> <div className="w-12 h-12 bg-primary-tint rounded-lg flex items-center justify-center text-primary"> <MIcon name="category" className="text-[28px]" /> </div> <div> <p className="text-text-secondary text-micro uppercase font-bold tracking-tight">{tx("Total Catégories")}</p> <p className="text-h2 font-h2 text-on-surface">{cats.length}</p> </div> </div> <div className="bg-bg-card p-md rounded-xl border border-border-default flex items-center gap-4"> <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center text-success-dark"> <MIcon name="check_circle" className="text-[28px]" /> </div> <div> <p className="text-text-secondary text-micro uppercase font-bold tracking-tight">Actives</p> <p className="text-h2 font-h2 text-on-surface">{cats.filter((c: any) => c.en_accueil === true).length || (cats.length ? String(cats.filter((c: any) => c.actif !== false).length) : "0")}</p> </div> </div> <div className="bg-bg-card p-md rounded-xl border border-border-default flex items-center gap-4"> <div className="w-12 h-12 bg-amber-light rounded-lg flex items-center justify-center text-amber-text"> <MIcon name="inventory" className="text-[28px]" /> </div> <div> <p className="text-text-secondary text-micro uppercase font-bold tracking-tight">{tx("Total Produits")}</p> <p className="text-h2 font-h2 text-on-surface">{produits.length}</p> </div> </div> </div>  <div className="bg-bg-card rounded-xl border border-border-default overflow-hidden shadow-sm"> <table className="w-full text-left border-collapse"> <thead> <tr className="bg-bg-secondary border-b border-border-default"> <th className="px-lg py-4 font-label text-text-secondary uppercase tracking-wider text-micro">{tx("Catégorie")}</th> <th className="px-lg py-4 font-label text-text-secondary uppercase tracking-wider text-micro">Description</th> <th className="px-lg py-4 font-label text-text-secondary uppercase tracking-wider text-micro text-center">{tx("Produits")}</th> <th className="px-lg py-4 font-label text-text-secondary uppercase tracking-wider text-micro">{tx("Statut")}</th> <th className="px-lg py-4 font-label text-text-secondary uppercase tracking-wider text-micro text-right">Actions</th> </tr> </thead> <tbody>
                {cats.map((c: any) => {
                  const nom = String(c.nom ?? '—');
                  const actif = typeof c.actif === 'boolean' ? c.actif : c.statut != null ? !String(c.statut).toLowerCase().includes('inact') : null;
                  const count = countByCat.get(Number(c.id)) ?? 0;
                  const icon = String(c.icone ?? CAT_ICON(nom));
                  return (
                    <tr key={c.id} className={`hover:bg-primary-tint/30 transition-colors group cursor-pointer ${sel?.id === c.id ? 'bg-primary-tint/60' : ''}`} onClick={() => selectCat(c)}>
                      <td className="px-lg py-4">
                        <div className="flex items-center gap-4">
                          <div className={actif === false ? 'w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-text-tertiary' : 'w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-text'}>
                            <MIcon name={icon} className="text-[24px]" />
                          </div>
                          <div>
                            <p className="font-h3 text-h3 text-on-surface">{nom}</p>
                            <p className={`text-micro font-bold ${actif === false ? 'text-text-tertiary' : 'text-amber-text'}`}>ID: {c.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-lg py-4">
                        <p className="text-secondary text-text-secondary max-w-[320px] line-clamp-2">{c.description ?? '—'}</p>
                      </td>
                      <td className="px-lg py-4 text-center">
                        <span className="font-price text-on-surface">{count}</span>
                      </td>
                      <td className="px-lg py-4">
                        {actif === null ? (
                          <span className="text-text-tertiary">—</span>
                        ) : actif ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-light text-success-dark font-label text-micro border border-success/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                            Active
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-text-tertiary font-label text-micro border border-border-default">
                            <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary"></span>
                            Inactive
                          </div>
                        )}
                      </td>
                      <td className="px-lg py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 text-text-secondary hover:text-primary hover:bg-primary-tint rounded-lg transition-all" onClick={(e) => { e.stopPropagation(); selectCat(c); }}><MIcon name="edit" className="text-[20px]" /></button>
                          <button className="p-2 text-text-secondary hover:text-error hover:bg-error-light rounded-lg transition-all" onClick={(e) => { e.stopPropagation(); void delCat(c); }}><MIcon name="delete" className="text-[20px]" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody> </table>  <div className="px-lg py-4 bg-bg-secondary flex justify-between items-center"> <p className="text-secondary text-text-secondary">Affichage de {cats.length} sur {cats.length} catégories</p> </div> </div> </div> </section>  <aside className="w-96 glass-panel border-l border-border-default overflow-y-auto p-lg flex flex-col z-40"> <div className="flex items-center justify-between mb-lg"> <h3 className="font-h3 text-h3 text-on-surface">{sel?.id ? tx("Éditer Catégorie") : 'Nouvelle Catégorie'}</h3> <button className="p-2 text-text-tertiary hover:text-on-surface transition-colors" onClick={() => setSel(null)}> <MIcon name="close" /> </button> </div> <form className="space-y-md flex-1" onSubmit={(e) => e.preventDefault()}>  <div className="space-y-xs"> <label className="font-label text-label text-text-secondary">{tx("Nom de la catégorie")}</label> <input className="w-full px-4 py-2.5 bg-white border-1.5 border-border-default rounded-[10px] focus:ring-4 focus:ring-primary-container/10 focus:border-primary-container transition-all" type="text" value={fNom} onChange={(e) => setFNom(e.target.value)} /> </div>  <div className="space-y-xs"> <label className="font-label text-label text-text-secondary">Description</label> <textarea className="w-full px-4 py-2.5 bg-white border-1.5 border-border-default rounded-[10px] focus:ring-4 focus:ring-primary-container/10 focus:border-primary-container transition-all" rows={4} value={fDesc} onChange={(e) => setFDesc(e.target.value)}></textarea> </div>  <div className="space-y-xs"> <label className="font-label text-label text-text-secondary">{tx("Icône de catégorie")}</label> <div className="grid grid-cols-4 gap-2 p-2 bg-bg-app rounded-xl"> {ICON_CHOICES.map((name) => ( <button key={name} className={fIcon === name ? 'aspect-square flex items-center justify-center rounded-lg bg-primary-container text-white shadow-sm ring-2 ring-primary-container ring-offset-2' : 'aspect-square flex items-center justify-center rounded-lg bg-white border border-border-default text-text-tertiary hover:border-primary-container hover:text-primary transition-all'} type="button" onClick={() => setFIcon(name)}> <MIcon name={name} /> </button> ))} </div> </div>  <div className="space-y-xs"> <label className="font-label text-label text-text-secondary">{tx("Thème de couleur")}</label> <div className="flex gap-3"> {COLOR_CHOICES.map((c) => ( <button key={c.key} className={`${c.cls} w-8 h-8 rounded-full ${fColor === c.key ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-110 transition-transform'}`} type="button" onClick={() => setFColor(c.key)}></button> ))} </div> </div>  <div className="flex items-center justify-between p-3 bg-primary-tint/50 rounded-xl"> <div> <p className="font-label text-label text-on-surface">{tx("Afficher sur l'accueil")}</p> <p className="text-micro text-text-secondary">{tx("La catégorie sera mise en avant")}</p> </div> <label className="relative inline-flex items-center cursor-pointer"> <input checked={fAccueil} className="sr-only peer" type="checkbox" onChange={(e) => setFAccueil(e.target.checked)} /> <div className="w-11 h-6 bg-border-default peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div> </label> </div> </form> <div className="mt-lg pt-lg border-t border-border-default space-y-3"> <button className="w-full py-3 bg-primary-container text-white font-bold rounded-[10px] hover:bg-primary-hover active:scale-[0.97] transition-all shadow-md" onClick={() => void saveCat()}>
                    {tx("Enregistrer les modifications")}
                </button> <button className="w-full py-3 bg-transparent border border-primary text-primary font-bold rounded-[10px] hover:bg-primary-tint active:scale-[0.97] transition-all" onClick={() => setSel(null)}>
                    {tx("Annuler")}
                </button> </div> </aside>  <div className="fixed bottom-lg right-lg bg-on-surface text-white px-md py-3 rounded-lg shadow-xl translate-y-20 opacity-0 transition-all duration-300 flex items-center gap-3 z-[60]" id="toast"> <MIcon name="check_circle" className="text-success" /> <span className="font-label text-label">{tx("Modification enregistrée avec succès !")}</span> </div> 
    </AdminLayout>
  );
}
