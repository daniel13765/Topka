import { useRef, useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useDesignScript } from '../../utils/designRuntime';
import { adminApi } from '../../services/api';
import { useLiveRows } from '../../services/api/useLiveRows';
import { unwrap, listOf, fmtFcfa } from '../../services/api/unwrap';
import { absImageUrl } from '../../utils/imageUrl';
import { extractApiError, formatApiError } from '../../utils/apiError';
import DESIGN_SCRIPT from './_scripts/AdminCatalogPage';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import FaIcon from '../../components/shared/FaIcon';
import type { BundleRow, CategoryRow, ProductRow } from '../../types/adminRows';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';

const DESIGN_CSS = `
        .sidebar-item-active { @apply bg-secondary-container text-on-secondary-container rounded-lg font-bold; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e0c0b1; border-radius: 10px; }
    `;

/**
 * AdminCatalogPage — copie conforme statique du design Stitch (code.html).
 * Interactions : script du design exécuté via useDesignScript (comportement copié).
 */
const PER_PAGE = 8;

export default function AdminCatalogPage() {
  useLanguage();
  useDesignScript(DESIGN_SCRIPT);
  // Tous les produits (100 par page, au plus 10 pages) : filtres et pagination portent sur le catalogue entier
  const { rows: produits, err, loading, reload } = useLiveRows<ProductRow>(async () => {
    const acc: ProductRow[] = [];
    for (let page = 1; page <= 10; page++) {
      const reponse = await adminApi.getProducts({ per_page: 100, page });
      acc.push(...(listOf(reponse) as ProductRow[]));
      const meta = (reponse as { meta?: { last_page?: unknown } }).meta;
      if (page >= Number(meta?.last_page ?? 1)) break;
    }
    return { data: acc };
  });
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [packs, setPacks] = useState<BundleRow[]>([]);
  const [tab, setTab] = useState<'produits' | 'categories' | 'packs'>('produits');
  const [q, setQ] = useState('');
  const [catF, setCatF] = useState('');
  const [dispoF, setDispoF] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [tab, q, catF, dispoF]); // nouveau filtre → première page
  const [edition, setEdition] = useState<ProductRow | BundleRow | null>(null);
  const [form, setForm] = useState({ nom: '', description: '', prix: '', prix_minimum: '', stock: '', categorie_id: '' });
  // Mode « pack » de la MÊME modale (POST/PUT /admin/bundles) : champs du modèle Pack + produits inclus.
  const [mode, setMode] = useState<'produit' | 'pack'>('produit');
  const [packForm, setPackForm] = useState<{
    nom: string;
    description: string;
    prix_total: string;
    prix_minimum: string;
    disponible: boolean;
    items: { id: string; qte: string }[];
  }>({ nom: '', description: '', prix_total: '', prix_minimum: '', disponible: true, items: [] });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const revokeObjectUrl = () => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
  };
  const pickImage = (f?: File | null) => {
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      window.alert('Format non pris en charge : PNG, JPG ou WEBP uniquement.');
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      window.alert('Image trop lourde : maximum 4 Mo.');
      return;
    }
    revokeObjectUrl();
    objectUrlRef.current = URL.createObjectURL(f);
    setImageFile(f);
    setImagePreview(objectUrlRef.current);
  };
  const clearImage = () => {
    revokeObjectUrl();
    setImageFile(null);
    setImagePreview(absImageUrl(edition?.image_url ?? edition?.img_url));
  };
  const loadCats = () => adminApi.getCategories().then((r) => setCats(listOf(unwrap(r)) as CategoryRow[])).catch(() => setCats([]));
  const loadPacks = () => adminApi.getBundles().then((r) => setPacks(listOf(unwrap(r)) as BundleRow[])).catch(() => setPacks([]));
  useState(() => {
    loadCats();
    loadPacks();
    return null;
  });
  const ouvrir = (pr: ProductRow | null | undefined) => {
    revokeObjectUrl();
    setMode('produit');
    setEdition(pr ?? null);
    setImageFile(null);
    setImagePreview(absImageUrl(pr?.image_url ?? pr?.img_url));
    setForm({ nom: pr?.nom ?? '', description: pr?.description ?? '', prix: String(pr?.prix ?? ''), prix_minimum: String(pr?.prix_minimum ?? ''), stock: String(pr?.stock ?? ''), categorie_id: String(pr?.categorie?.id ?? '') });
  };
  const fermer = () => { revokeObjectUrl(); setImageFile(null); setEdition(null); };
  const enregistrer = async () => {
    try {
      const champs = { nom: form.nom, description: form.description, prix: Number(form.prix), prix_minimum: Number(form.prix_minimum), stock: Number(form.stock), categorie_id: Number(form.categorie_id) };
      if (imageFile) {
        // Multipart uniquement si fichier : champs en string (validations Laravel OK) + image.
        const fd = new FormData();
        Object.entries(champs).forEach(([k, v]) => fd.append(k, String(v)));
        fd.append('image', imageFile);
        if (edition?.id) await adminApi.updateProduct(Number(edition.id), fd);
        else await adminApi.createProduct(fd);
      } else if (edition?.id) await adminApi.updateProduct(Number(edition.id), champs);
      else await adminApi.createProduct(champs);
      fermer(); reload();
    } catch (e) { window.alert(formatApiError(extractApiError(e))); }
  };
  /* ---- Packs (F-08) : même modale en mode « pack » ---- */
  const ouvrirPack = (b: BundleRow | null | undefined) => {
    revokeObjectUrl();
    setMode('pack');
    setEdition(b ?? null);
    const inclus = b?.produits ?? b?.products ?? [];
    setPackForm({
      nom: b?.nom ?? '',
      description: b?.description ?? '',
      prix_total: b?.prix_total != null ? String(Number(b.prix_total)) : '',
      prix_minimum: b?.prix_minimum != null ? String(Number(b.prix_minimum)) : '',
      disponible: b?.disponible !== false,
      items: inclus.map((p) => ({ id: String(p.id), qte: String(p.pivot?.qte ?? 1) })),
    });
  };
  const enregistrerPack = async () => {
    if (!packForm.nom.trim()) { window.alert('Le nom du pack est obligatoire.'); return; }
    if (packForm.prix_total.trim() === '' || !Number.isFinite(Number(packForm.prix_total))) { window.alert('Le prix total est obligatoire.'); return; }
    // Produits inclus : lignes complètes seulement ; doublons fusionnés (le backend synchronise par id)
    const qtes = new Map<number, number>();
    packForm.items.forEach((it) => {
      const id = Number(it.id);
      if (!id) return;
      qtes.set(id, (qtes.get(id) ?? 0) + Math.max(1, Math.floor(Number(it.qte) || 1)));
    });
    const payload = {
      nom: packForm.nom.trim(),
      description: packForm.description.trim() || null,
      prix_total: Number(packForm.prix_total),
      prix_minimum: packForm.prix_minimum.trim() === '' ? null : Number(packForm.prix_minimum),
      disponible: packForm.disponible,
      products: [...qtes].map(([id, qte]) => ({ id, qte })),
    };
    try {
      if (edition?.id) await adminApi.updateBundle(Number(edition.id), payload);
      else await adminApi.createBundle(payload);
      fermer(); loadPacks();
    } catch (e) { window.alert(formatApiError(extractApiError(e))); }
  };
  const supprimer = async (id: number | string) => {
    try { await adminApi.deleteProduct(Number(id)); reload(); } catch (e) { window.alert(formatApiError(extractApiError(e))); }
  };
  const supprimerCat = async (c: CategoryRow) => {
    if (!window.confirm(tr(`Supprimer la catégorie « ${c.nom} » ?`, `Delete category “${c.nom}”?`))) return;
    try { await adminApi.deleteCategory(Number(c.id)); loadCats(); reload(); } catch (e) { window.alert(formatApiError(extractApiError(e))); }
  };
  const supprimerPack = async (b: BundleRow) => {
    if (!window.confirm(tr(`Supprimer le pack « ${b.nom} » ?`, `Delete pack “${b.nom}”?`))) return;
    try { await adminApi.deleteBundle(Number(b.id)); loadPacks(); } catch (e) { window.alert(formatApiError(extractApiError(e))); }
  };
  const qMin = q.trim().toLowerCase();
  const produitsF = produits.filter((p) => {
    const hit = !qMin || String(p.nom ?? '').toLowerCase().includes(qMin) || String(p.id).includes(qMin);
    const cok = !catF || String(p.categorie?.id ?? p.categorie_id ?? '') === catF;
    const dispo = p.disponible !== false && Number(p.stock) > 0;
    const dok = !dispoF || (dispoF === 'stock' ? dispo : !dispo);
    return hit && cok && dok;
  });
  const catsF = cats.filter((c) => !qMin || String(c.nom ?? '').toLowerCase().includes(qMin) || String(c.id).includes(qMin));
  const packsF = packs.filter((b) => {
    const hit = !qMin || String(b.nom ?? '').toLowerCase().includes(qMin) || String(b.id).includes(qMin);
    const dok = !dispoF || (dispoF === 'stock' ? b.disponible !== false : b.disponible === false);
    return hit && dok;
  });
  // Pagination réelle (8 lignes, comme la maquette), sur l'onglet affiché
  const totalLignes = tab === 'produits' ? produitsF.length : tab === 'categories' ? catsF.length : packsF.length;
  const tabNoun = tab === 'produits' ? 'produits' : tab === 'categories' ? tx("catégories") : 'packs';
  const pages = Math.max(1, Math.ceil(totalLignes / PER_PAGE));
  const current = Math.min(page, pages);
  const slicePage = <Ligne,>(l: Ligne[]) => l.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <AdminLayout currentPath="/admin/catalogue">
      {err && (
        <div className="m-lg rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Erreur API")}</p>
          <p>{err}</p>
        </div>
      )}
      {loading && <p className="m-lg text-label text-text-secondary">{tx("Chargement des données réelles…")}</p>}
      <div className="m-lg">
        <button type="button" className="btn btn-primary" onClick={() => (tab === 'packs' ? ouvrirPack(null) : ouvrir(null))}>
          {tab === 'packs' ? tx("+ Nouveau pack (réel)") : '+ Nouveau produit (réel)'}
        </button>
      </div>
      <style>{DESIGN_CSS}</style>
  <header className="h-16 flex justify-between items-center px-lg bg-white sticky top-0 z-40 border-b border-border-default"> <div className="flex items-center gap-4"> <span className="font-h2 text-h2 font-bold text-primary">{tx("Gestion du catalogue")}</span> </div> <div className="flex items-center gap-6"> <div className="relative hidden lg:block"> <FaIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" /> <input className="pl-10 pr-4 py-2 bg-bg-secondary border border-border-default rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64" placeholder={tx("Rechercher un produit...")} type="text" value={q} onChange={(e) => setQ(e.target.value)} /> </div> <div className="flex items-center gap-4 border-l border-border-default pl-6">  </div> </div> </header>  <div className="p-lg space-y-lg">  <div className="flex flex-col md:flex-row md:items-center justify-between gap-md"> <div className="flex gap-lg border-b border-border-default w-full md:w-auto"> {([['produits', `Produits (${produitsF.length})`], ['categories', `Catégories (${catsF.length})`], ['packs', `Packs (${packsF.length})`]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`pb-3 px-2 font-h3 text-h3 transition-all ${tab === k ? 'text-primary border-b-2 border-primary' : 'text-text-tertiary hover:text-on-surface-variant'}`}>{label}</button>
              ))} </div> <button className="flex items-center gap-2 bg-primary-container hover:bg-primary-hover text-white px-md py-2.5 rounded-lg font-bold shadow-lg shadow-primary/10 transition-transform active:scale-95" type="button" onClick={() => (tab === 'packs' ? ouvrirPack(null) : ouvrir(null))}> <FaIcon name="add" />
                    {tx("Nouveau produit")}
                </button> </div>  <div className="bg-white p-md rounded-lg shadow-sm flex flex-wrap items-center gap-4 border border-border-default"> <div className="flex-1 min-w-[200px]"> <div className="relative"> <FaIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm" /> <input className="w-full pl-9 pr-4 py-2 text-label bg-white border border-border-default rounded-lg focus:ring-1 focus:ring-primary outline-none" placeholder="Nom, SKU ou ID..." type="text" value={q} onChange={(e) => setQ(e.target.value)} /> </div> </div> <select className="px-md py-2 text-label bg-white border border-border-default rounded-lg focus:ring-1 focus:ring-primary outline-none min-w-[140px]" value={catF} onChange={(e) => setCatF(e.target.value)}> <option value="">{tx("Catégorie: Tout")}</option>
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nom}</option>
                ))}
              </select> <select className="px-md py-2 text-label bg-white border border-border-default rounded-lg focus:ring-1 focus:ring-primary outline-none" value={dispoF} onChange={(e) => setDispoF(e.target.value)}> <option value="">{tx("Disponibilité")}</option> <option value="stock">{tx("En stock")}</option> <option value="rupture">{tx("Rupture")}</option> </select> <div className="flex border border-border-default rounded-lg overflow-hidden"> <button className="p-2 bg-bg-secondary text-primary"><FaIcon name="format_list_bulleted" /></button> <button className="p-2 hover:bg-bg-secondary text-text-tertiary"><FaIcon name="grid_view" /></button> </div> </div>  <div className="bg-white rounded-lg shadow-sm border border-border-default overflow-hidden"> <table className="w-full text-left border-collapse"> <thead> <tr className="bg-bg-secondary border-b border-border-default"> <th className="py-md px-lg w-10"> <input className="rounded border-border-default text-primary focus:ring-primary" type="checkbox" /> </th> <th className="py-md px-md font-label text-label text-text-tertiary uppercase tracking-wider">{tx("Produit")}</th> <th className="py-md px-md font-label text-label text-text-tertiary uppercase tracking-wider">{tx("Catégorie")}</th> <th className="py-md px-md font-label text-label text-text-tertiary uppercase tracking-wider">{tx("Prix")}</th> <th className="py-md px-md font-label text-label text-text-tertiary uppercase tracking-wider">{tx("Statut")}</th> <th className="py-md px-md font-label text-label text-text-tertiary uppercase tracking-wider text-right">Actions</th> </tr> </thead> <tbody>
                {tab === 'produits' && slicePage(produitsF).map((pr) => (
                  <tr key={pr.id} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="py-4 px-lg"><input className="rounded border-border-default text-primary focus:ring-primary" type="checkbox" /></td>
                    <td className="py-4 px-md"> <div className="flex items-center gap-3"> {pr.image_url ? (
                      <img src={absImageUrl(pr.image_url) ?? undefined} alt="" className="h-10 w-10 rounded-lg bg-bg-secondary object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-primary"><FaIcon name="inventory_2" className="text-[20px]" /></div>
                    )} <span className="font-body font-semibold">{pr.nom}</span> </div> </td>
                    <td className="py-4 px-md text-text-secondary">{pr.categorie?.nom ?? '—'}</td>
                    <td className="py-4 px-md font-price text-primary">{fmtFcfa(pr.prix)}</td>
                    <td className="py-4 px-md"> <span className={`px-2 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${pr.disponible !== false && Number(pr.stock) > 0 ? 'bg-success-light text-success-dark' : 'bg-bg-secondary text-text-secondary'}`}> <span className={`w-1.5 h-1.5 rounded-full ${pr.disponible !== false && Number(pr.stock) > 0 ? 'bg-success' : 'bg-text-tertiary'}`}></span> {pr.disponible !== false && Number(pr.stock) > 0 ? tx("Disponible") : 'Rupture'} </span> </td>
                    <td className="py-4 px-md text-right"> <div className="flex gap-2 justify-end"> <button type="button" className="font-semibold text-primary hover:underline" onClick={() => ouvrir(pr)}>{tx("Modifier")}</button> <button type="button" className="font-semibold text-error hover:underline" onClick={() => void supprimer(pr.id)}>{tx("Supprimer")}</button> </div> </td>
                  </tr>
                ))}
                {tab === 'categories' && slicePage(catsF).map((c) => (
                  <tr key={c.id} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="py-4 px-lg"><input className="rounded border-border-default text-primary focus:ring-primary" type="checkbox" /></td>
                    <td className="py-4 px-md"> <div className="flex items-center gap-3"> <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-text"><FaIcon name="category" className="text-[20px]" /></div> <span className="font-body font-semibold">{c.nom}</span> </div> </td>
                    <td className="py-4 px-md text-text-secondary">{c.description ?? '—'}</td>
                    <td className="py-4 px-md font-price text-primary">—</td>
                    <td className="py-4 px-md text-text-secondary">—</td>
                    <td className="py-4 px-md text-right"> <div className="flex gap-2 justify-end"> <Link to="/admin/categories" className="font-semibold text-primary hover:underline">{tx("Éditer")}</Link> <button type="button" className="font-semibold text-error hover:underline" onClick={() => void supprimerCat(c)}>{tx("Supprimer")}</button> </div> </td>
                  </tr>
                ))}
                {tab === 'packs' && slicePage(packsF).map((b) => (
                  <tr key={b.id} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="py-4 px-lg"><input className="rounded border-border-default text-primary focus:ring-primary" type="checkbox" /></td>
                    <td className="py-4 px-md"> <div className="flex items-center gap-3"> <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-primary"><FaIcon name="package_2" className="text-[20px]" /></div> <span className="font-body font-semibold">{b.nom}</span> </div> </td>
                    <td className="py-4 px-md text-text-secondary">{b.description ?? '—'}</td>
                    <td className="py-4 px-md font-price text-primary">{fmtFcfa(Number(b.prix_total ?? b.prix_minimum ?? 0))}</td>
                    <td className="py-4 px-md"> <span className={`px-2 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${b.disponible !== false ? 'bg-success-light text-success-dark' : 'bg-bg-secondary text-text-secondary'}`}> <span className={`w-1.5 h-1.5 rounded-full ${b.disponible !== false ? 'bg-success' : 'bg-text-tertiary'}`}></span> {b.disponible !== false ? tx("Disponible") : 'Rupture'} </span> </td>
                    <td className="py-4 px-md text-right"> <div className="flex gap-2 justify-end"> <button type="button" className="font-semibold text-primary hover:underline" onClick={() => ouvrirPack(b)}>{tx("Modifier")}</button> <button type="button" className="font-semibold text-error hover:underline" onClick={() => void supprimerPack(b)}>{tx("Supprimer")}</button> </div> </td>
                  </tr>
                ))}
                {((tab === 'produits' && produitsF.length === 0) || (tab === 'categories' && catsF.length === 0) || (tab === 'packs' && packsF.length === 0)) && (
                  <tr><td className="py-6 px-lg text-text-secondary" colSpan={6}>{tx("Aucun résultat pour ces filtres.")}</td></tr>
                )}
              </tbody> </table>  <div className="py-md px-lg flex items-center justify-between border-t border-border-default bg-bg-secondary/30"> <span className="text-label text-text-secondary">{totalLignes === 0 ? `Aucun résultat` : `Affichage de ${(current - 1) * PER_PAGE + 1} à ${Math.min(current * PER_PAGE, totalLignes)} sur ${totalLignes} ${tabNoun}`}</span> <div className="flex items-center gap-2"> <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)} className="w-8 h-8 flex items-center justify-center rounded border border-border-default bg-white text-text-tertiary hover:bg-bg-secondary disabled:opacity-40"><FaIcon name="chevron_left" className="text-[18px]" /></button> {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - current) <= 1).map((n) => (<button key={n} type="button" onClick={() => setPage(n)} className={n === current ? 'w-8 h-8 flex items-center justify-center rounded bg-primary-container text-white font-bold' : 'w-8 h-8 flex items-center justify-center rounded border border-border-default bg-white hover:bg-bg-secondary'}>{n}</button>))} <button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)} className="w-8 h-8 flex items-center justify-center rounded border border-border-default bg-white text-text-tertiary hover:bg-bg-secondary disabled:opacity-40"><FaIcon name="chevron_right" className="text-[18px]" /></button> </div> </div> </div> </div>
      {edition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={fermer}>
          <div className="w-full max-w-[600px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border-default p-4">
              <h3 className="text-h3 font-h3 font-bold">
                {mode === 'pack' ? (edition.id ? tx("Modifier le pack") : tx("Nouveau pack")) : edition.id ? tx("Modifier le produit") : tx("Nouveau produit")}
              </h3>
              <button type="button" onClick={fermer}>{tx("Fermer")}</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-label">
              {mode === 'pack' ? (
                <>
                  <div><p className="text-text-secondary">{tx("Nom du pack — obligatoire")}</p><input value={packForm.nom} onChange={(e) => setPackForm({ ...packForm, nom: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
                  <div><p className="text-text-secondary">Description</p><textarea rows={2} value={packForm.description} onChange={(e) => setPackForm({ ...packForm, description: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-text-secondary">Prix total (FCFA) — obligatoire</p><input type="number" min={0} value={packForm.prix_total} onChange={(e) => setPackForm({ ...packForm, prix_total: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
                    <div><p className="text-text-secondary">Prix minimum (FCFA)</p><input type="number" min={0} value={packForm.prix_minimum} onChange={(e) => setPackForm({ ...packForm, prix_minimum: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
                  </div>
                  <div>
                    <p className="text-text-secondary">Produits inclus</p>
                    <div className="mt-1 space-y-2">
                      {packForm.items.length === 0 && <p className="text-xs text-text-tertiary">{tx("Aucun produit pour l'instant.")}</p>}
                      {packForm.items.map((it, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select value={it.id} onChange={(e) => setPackForm({ ...packForm, items: packForm.items.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })} className="min-w-0 flex-1 rounded-lg border border-border-default bg-white px-3 py-2">
                            <option value="">{tx("— Choisir un produit —")}</option>
                            {produits.map((p) => <option key={p.id} value={String(p.id)}>{p.nom}</option>)}
                          </select>
                          <input type="number" min={1} aria-label={tx("Quantité")} value={it.qte} onChange={(e) => setPackForm({ ...packForm, items: packForm.items.map((x, j) => (j === i ? { ...x, qte: e.target.value } : x)) })} className="w-20 rounded-lg border border-border-default px-3 py-2" />
                          <button type="button" aria-label="Retirer ce produit" className="text-text-tertiary hover:text-error" onClick={() => setPackForm({ ...packForm, items: packForm.items.filter((_, j) => j !== i) })}><FaIcon name="close" /></button>
                        </div>
                      ))}
                      <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setPackForm({ ...packForm, items: [...packForm.items, { id: '', qte: '1' }] })}>{tx("+ Ajouter un produit")}</button>
                    </div>
                  </div>
                  {/* Interrupteur « Disponible à la vente » — repris de la modale du design (editModal) */}
                  <div className="flex items-center justify-between py-2 px-md bg-primary-tint/50 rounded-lg border border-primary/10">
                    <div className="flex items-center gap-3"> <FaIcon name="check_circle" className="text-primary" /> <div> <p className="text-body font-bold text-on-surface">{tx("Disponible à la vente")}</p> <p className="text-xs text-text-secondary">{tx("Afficher ce pack dans le catalogue public")}</p> </div> </div>
                    <label className="relative inline-flex items-center cursor-pointer"> <input checked={packForm.disponible} onChange={(e) => setPackForm({ ...packForm, disponible: e.target.checked })} className="sr-only peer" type="checkbox" /> <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div> </label>
                  </div>
                </>
              ) : (
                <>
              <div><p className="text-text-secondary">{tx("Nom")}</p><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
              <div><p className="text-text-secondary">Description</p><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
              <div><p className="text-text-secondary">{tx("Prix (FCFA)")}</p><input value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
              <div><p className="text-text-secondary">Prix minimum (FCFA) — obligatoire</p><input value={form.prix_minimum} onChange={(e) => setForm({ ...form, prix_minimum: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
              <div><p className="text-text-secondary">Stock</p><input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full rounded-lg border border-border-default px-3 py-2" /></div>
              <div><p className="text-text-secondary">{tx("Catégorie — obligatoire")}</p>
                <select value={form.categorie_id} onChange={(e) => setForm({ ...form, categorie_id: e.target.value })} className="w-full rounded-lg border border-border-default bg-white px-3 py-2">
                  <option value="">{tx("— Choisir —")}</option>
                  {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <p className="text-text-secondary">Image du produit</p>
                <div
                  className="mt-1 group cursor-pointer rounded-lg border-2 border-dashed border-outline-variant/50 bg-bg-secondary p-4 text-center transition-colors hover:bg-bg-secondary/80"
                  onClick={() => imageInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); pickImage(e.dataTransfer.files?.[0]); }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="mx-auto max-h-36 rounded-lg object-contain" />
                  ) : (
                    <FaIcon name="cloud_upload" className="mb-2 text-3xl text-primary transition-transform group-hover:scale-110" />
                  )}
                  <p className="font-medium">{imagePreview ? "Changer l'image" : 'Cliquez pour choisir une image'}</p>
                  <p className="mt-1 text-xs text-text-tertiary">PNG, JPG ou WEBP (Max. 4 Mo)</p>
                  {imageFile && <p className="mt-1 text-xs font-semibold text-primary">{imageFile.name}</p>}
                </div>
                {imagePreview && (
                  <button type="button" className="mt-1 text-xs text-text-secondary underline" onClick={clearImage}>
                    {imageFile ? "Retirer l'image choisie" : "Retirer l'image"}
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border-default p-4">
              <button type="button" className="btn btn-ghost" onClick={fermer}>{tx("Annuler")}</button>
              <button type="button" className="btn btn-primary" onClick={mode === 'pack' ? enregistrerPack : enregistrer}>{tx("Enregistrer")}</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
