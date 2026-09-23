import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  faArchive,
  faArrowRight,
  faBoxOpen,
  faBoxesStacked,
  faCheck,
  faChevronDown,
  faCircle,
  faCloudArrowUp,
  faDollarSign,
  faEdit,
  faFileCirclePlus,
  faFilter,
  faGear,
  faGlobe,
  faHeartPulse,
  faHouse,
  faImage,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faRotateLeft,
  faSliders,
  faTags,
  faTrashCan,
  faTriangleExclamation,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Icon } from '../../components/ui/Icon';
import { formatFCFA } from '../../utils/formatFCFA';
import {
  useArchiveCatalogPackMutation,
  useArchiveCatalogProductMutation,
  useCreateCatalogPackMutation,
  useCreateCatalogProductMutation,
  useListCatalogAdminQuery,
  useUpdateCatalogPackMutation,
  useUpdateCatalogProductMutation,
} from '../../services/api/catalogAdminApi';
import type { AdminCatalogProduct, AdminItemStatus, StandalonePack } from '../../types/catalogAdmin';
import type { PackFormPayload, ProductFormPayload } from '../../services/api/catalogAdminApi';

const categories = ['Fruits & légumes', 'Légumes', 'Céréales & graines', 'Épices & condiments', 'Packs repas', 'Packs cuisine', 'Sélection TOKPa'];
const markets = ['Marché Dantokpa', 'Marché Ganhì', 'Marché Missebo', 'Marché Gbégamey', 'TOKPa Sélection'];

type CatalogTab = 'products' | 'packs';
type StatusFilter = 'all' | AdminItemStatus;

const blankProduct: ProductFormPayload = {
  name: '',
  category: 'Légumes',
  price: 0,
  unit: 'les 500 g',
  image: '/images/brand/market-fruits.jpg',
  rating: 4.5,
  negotiable: true,
  badge: '',
  market: 'Marché Dantokpa',
  seller: 'TOKPa Sélection',
  description: '',
  minOffer: 0,
  available: true,
  origin: 'Bénin',
  freshness: 'Récolte du jour',
  reviews: 0,
  sku: '',
  stock: 0,
  status: 'draft',
};

const blankPack: PackFormPayload = {
  name: '',
  sku: '',
  category: 'Packs repas',
  price: 0,
  compareAtPrice: 0,
  stock: 0,
  status: 'draft',
  image: '/images/brand/tropical-still-life.jpg',
  description: '',
  unit: 'le pack',
};

const statusLabel: Record<AdminItemStatus, string> = {
  active: 'Actif',
  draft: 'Brouillon',
  archived: 'Archivé',
};

const statusClass: Record<AdminItemStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-amber-50 text-amber-700',
  archived: 'bg-slate-100 text-slate-500',
};

function AdminSideBar() {
  const items = [
    { id: 'dashboard', label: 'Vue globale', to: '/admin', icon: faHouse },
    { id: 'console', label: 'Console système', to: '/admin/console', icon: faHeartPulse },
    { id: 'catalog', label: 'Catalogue & packs', to: '/admin/catalogue', icon: faTags },
    { id: 'users', label: 'Utilisateurs', to: '/admin', icon: faUsers },
    { id: 'orders', label: 'Commandes', to: '/admin', icon: faBoxOpen },
    { id: 'zones', label: 'Zones & équipes', to: '/manager/zones', icon: faGlobe },
  ];
  return <aside className="flex h-full w-[270px] flex-col bg-[#111727] p-5 text-white"><Link to="/" className="px-4 pt-3 text-2xl font-black tracking-tight">TOK<span className="text-orange-500">Pa</span></Link><div className="mt-2 px-4 text-xs text-slate-500">Administration centrale</div><nav className="mt-10 space-y-1" aria-label="Navigation administrateur"><p className="mb-3 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Pilotage</p>{items.map((item) => <Link key={item.id} to={item.to} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${item.id === 'catalog' ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/30' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}><Icon icon={item.icon} className="w-4" />{item.label}</Link>)}</nav><div className="mt-auto border-t border-white/10 pt-5"><Link to="/admin/console" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white"><Icon icon={faGear} /> Paramètres</Link><div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-violet-500 font-black">AD</span><div className="min-w-0"><p className="truncate text-sm font-bold">Admin TOKPa</p><p className="text-xs text-slate-400">Administrateur</p></div></div></div></aside>;
}

function StatusBadge({ status }: { status: AdminItemStatus }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass[status]}`}><Icon icon={faCircle} className="text-[6px]" /> {statusLabel[status]}</span>;
}

function SelectChevron() {
  return <Icon icon={faChevronDown} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />;
}

function ProductModal({ product, form, setForm, onClose, onSubmit, isSaving }: { product: AdminCatalogProduct | null; form: ProductFormPayload; setForm: (value: ProductFormPayload) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; isSaving: boolean }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 px-5 py-8"><form onSubmit={onSubmit} className="motion-enter max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Administration du catalogue</p><h2 className="mt-2 text-2xl font-black">{product ? 'Modifier le produit' : 'Nouveau produit'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">Gérez les informations affichées sur le marché TOKPa.</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Fermer"><Icon icon={faXmark} /></button></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="field-label sm:col-span-2">Nom du produit<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="field-input" placeholder="Ex. Tomates fraîches locales" autoFocus /></label><label className="field-label">Référence SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })} className="field-input" placeholder="TOK-0014" /></label><label className="field-label">Catégorie<div className="relative"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="field-input appearance-none pr-9">{categories.map((category) => <option key={category}>{category}</option>)}</select><SelectChevron /></div></label><label className="field-label">Prix de vente (FCFA)<input required min="0" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} className="field-input" /></label><label className="field-label">Stock disponible<input required min="0" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} className="field-input" /></label><label className="field-label">Unité de vente<input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="field-input" placeholder="les 500 g" /></label><label className="field-label">Statut<div className="relative"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AdminItemStatus })} className="field-input appearance-none pr-9"><option value="active">Actif</option><option value="draft">Brouillon</option><option value="archived">Archivé</option></select><SelectChevron /></div></label><label className="field-label">Marché d’origine<div className="relative"><select value={form.market} onChange={(event) => setForm({ ...form, market: event.target.value })} className="field-input appearance-none pr-9">{markets.map((market) => <option key={market}>{market}</option>)}</select><SelectChevron /></div></label><label className="field-label">Vendeur / fournisseur<input value={form.seller} onChange={(event) => setForm({ ...form, seller: event.target.value })} className="field-input" /></label><label className="field-label sm:col-span-2">URL ou chemin de l’image<div className="relative"><Icon icon={faImage} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} className="field-input pl-10" placeholder="/images/products/produit.jpg" /></div></label><label className="field-label sm:col-span-2">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="field-input min-h-28 resize-y" placeholder="Décrivez le produit, son origine et sa fraîcheur…" /></label><div className="flex flex-wrap gap-5 sm:col-span-2"><label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.negotiable} onChange={(event) => setForm({ ...form, negotiable: event.target.checked })} className="h-5 w-5 accent-orange-500" /> Prix négociable</label><label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} className="h-5 w-5 accent-orange-500" /> Visible sur le marché</label></div></div><div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" onClick={onClose} className="btn-secondary !bg-white">Annuler</button><button type="submit" disabled={isSaving} className="btn-primary"><Icon icon={faCloudArrowUp} className="mr-2" />{isSaving ? 'Enregistrement…' : product ? 'Enregistrer les modifications' : 'Créer le produit'}</button></div></form></div>;
}

function PackModal({ pack, form, setForm, onClose, onSubmit, isSaving }: { pack: StandalonePack | null; form: PackFormPayload; setForm: (value: PackFormPayload) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; isSaving: boolean }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 px-5 py-8"><form onSubmit={onSubmit} className="motion-enter max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Packs autonomes</p><h2 className="mt-2 text-2xl font-black">{pack ? 'Modifier le pack' : 'Nouveau pack'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">Un pack est vendu comme une référence autonome du catalogue, avec son propre stock et son propre prix.</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Fermer"><Icon icon={faXmark} /></button></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="field-label sm:col-span-2">Nom du pack<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="field-input" placeholder="Ex. Pack rentrée du marché" autoFocus /></label><label className="field-label">Référence SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })} className="field-input" placeholder="PACK-0104" /></label><label className="field-label">Catégorie<div className="relative"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="field-input appearance-none pr-9">{categories.filter((category) => category.startsWith('Pack') || category === 'Sélection TOKPa').map((category) => <option key={category}>{category}</option>)}</select><SelectChevron /></div></label><label className="field-label">Prix du pack (FCFA)<input required min="0" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} className="field-input" /></label><label className="field-label">Prix de référence<input min="0" type="number" value={form.compareAtPrice} onChange={(event) => setForm({ ...form, compareAtPrice: Number(event.target.value) })} className="field-input" /></label><label className="field-label">Stock disponible<input required min="0" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} className="field-input" /></label><label className="field-label">Statut<div className="relative"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AdminItemStatus })} className="field-input appearance-none pr-9"><option value="active">Actif</option><option value="draft">Brouillon</option><option value="archived">Archivé</option></select><SelectChevron /></div></label><label className="field-label">Unité de vente<input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="field-input" /></label><label className="field-label sm:col-span-2">URL ou chemin de l’image<div className="relative"><Icon icon={faImage} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} className="field-input pl-10" placeholder="/images/packs/pack.jpg" /></div></label><label className="field-label sm:col-span-2">Description du pack<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="field-input min-h-32 resize-y" placeholder="Présentez l’offre, le public cible et les conditions de vente…" /></label></div><div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" onClick={onClose} className="btn-secondary !bg-white">Annuler</button><button type="submit" disabled={isSaving} className="btn-primary"><Icon icon={faCloudArrowUp} className="mr-2" />{isSaving ? 'Enregistrement…' : pack ? 'Enregistrer les modifications' : 'Créer le pack'}</button></div></form></div>;
}

export function AdminCatalogPage() {
  const { data, isLoading } = useListCatalogAdminQuery();
  const [tab, setTab] = useState<CatalogTab>('products');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('Toutes les catégories');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminCatalogProduct | null>(null);
  const [editingPack, setEditingPack] = useState<StandalonePack | null>(null);
  const [productForm, setProductForm] = useState<ProductFormPayload>(blankProduct);
  const [packForm, setPackForm] = useState<PackFormPayload>(blankPack);
  const [message, setMessage] = useState('');
  const [createProduct, createProductState] = useCreateCatalogProductMutation();
  const [updateProduct, updateProductState] = useUpdateCatalogProductMutation();
  const [archiveProduct] = useArchiveCatalogProductMutation();
  const [createPack, createPackState] = useCreateCatalogPackMutation();
  const [updatePack, updatePackState] = useUpdateCatalogPackMutation();
  const [archivePack] = useArchiveCatalogPackMutation();

  const products = data?.products ?? [];
  const packs = data?.packs ?? [];
  const filteredProducts = useMemo(() => products.filter((product) => (status === 'all' || product.status === status) && (category === 'Toutes les catégories' || product.category === category) && `${product.name} ${product.sku} ${product.seller || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [category, products, search, status]);
  const filteredPacks = useMemo(() => packs.filter((pack) => (status === 'all' || pack.status === status) && (category === 'Toutes les catégories' || pack.category === category) && `${pack.name} ${pack.sku}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [category, packs, search, status]);
  const activeProducts = products.filter((product) => product.status === 'active').length;
  const activePacks = packs.filter((pack) => pack.status === 'active').length;
  const lowStock = [...products, ...packs].filter((item) => item.status !== 'archived' && item.stock <= 10).length;
  const catalogValue = [...products, ...packs].filter((item) => item.status === 'active').reduce((sum, item) => sum + item.price * item.stock, 0);
  const isSaving = createProductState.isLoading || updateProductState.isLoading || createPackState.isLoading || updatePackState.isLoading;

  const announce = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 3200); };
  const closeModal = () => { setIsModalOpen(false); setEditingProduct(null); setEditingPack(null); };
  const openNew = () => { setEditingProduct(null); setEditingPack(null); setProductForm({ ...blankProduct, sku: `TOK-${String(Date.now()).slice(-4)}` }); setPackForm({ ...blankPack, sku: `PACK-${String(Date.now()).slice(-4)}` }); setIsModalOpen(true); };
  const openProduct = (product: AdminCatalogProduct) => { const { id: _id, updatedAt: _updatedAt, ...form } = product; setEditingProduct(product); setEditingPack(null); setProductForm(form); setIsModalOpen(true); };
  const openPack = (pack: StandalonePack) => { const { id: _id, updatedAt: _updatedAt, ...form } = pack; setEditingPack(pack); setEditingProduct(null); setPackForm(form); setIsModalOpen(true); };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...productForm, name: productForm.name.trim(), sku: productForm.sku.trim() || `TOK-${Date.now()}`, price: Number(productForm.price), stock: Number(productForm.stock), available: productForm.status === 'active' && productForm.available };
    try {
      if (editingProduct) await updateProduct({ id: editingProduct.id, changes: payload }).unwrap();
      else await createProduct(payload).unwrap();
      closeModal();
      announce(editingProduct ? 'Le produit a été mis à jour.' : 'Le produit a été créé.');
    } catch { announce('Impossible d’enregistrer ce produit.'); }
  };

  const submitPack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...packForm, name: packForm.name.trim(), sku: packForm.sku.trim() || `PACK-${Date.now()}`, price: Number(packForm.price), compareAtPrice: Number(packForm.compareAtPrice), stock: Number(packForm.stock) };
    try {
      if (editingPack) await updatePack({ id: editingPack.id, changes: payload }).unwrap();
      else await createPack(payload).unwrap();
      closeModal();
      announce(editingPack ? 'Le pack a été mis à jour.' : 'Le pack autonome a été créé.');
    } catch { announce('Impossible d’enregistrer ce pack.'); }
  };

  const toggleProduct = async (product: AdminCatalogProduct) => { try { await archiveProduct({ id: product.id, status: product.status === 'archived' ? 'active' : 'archived' }).unwrap(); announce(product.status === 'archived' ? 'Le produit est de nouveau actif.' : 'Le produit a été archivé.'); } catch { announce('Impossible de modifier le statut du produit.'); } };
  const togglePack = async (pack: StandalonePack) => { try { await archivePack({ id: pack.id, status: pack.status === 'archived' ? 'active' : 'archived' }).unwrap(); announce(pack.status === 'archived' ? 'Le pack est de nouveau actif.' : 'Le pack a été archivé.'); } catch { announce('Impossible de modifier le statut du pack.'); } };
  const resetFilters = () => { setSearch(''); setStatus('all'); setCategory('Toutes les catégories'); };

  return <div className="min-h-screen bg-[#f7f8fb] text-slate-900"><div className="fixed inset-y-0 left-0 z-40 hidden lg:block"><AdminSideBar /></div><div className="min-h-screen lg:pl-[270px]"><header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4"><div><p className="eyebrow">Administration centrale</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Catalogue & packs</h1></div><div className="flex items-center gap-2 sm:gap-3"><span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:inline-flex"><Icon icon={faCircle} className="text-[7px]" /> Données synchronisées</span><Link to="/admin/console" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-orange-50 hover:text-brand-600" aria-label="Ouvrir la console"><Icon icon={faHeartPulse} /></Link><span className="grid h-10 w-10 place-items-center rounded-full bg-violet-500 text-xs font-black text-white">AD</span></div></div></header><main className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8"><section className="flex flex-col justify-between gap-5 rounded-3xl bg-[#111727] p-6 text-white shadow-xl shadow-slate-200 sm:flex-row sm:items-end sm:p-8"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">Gestion marchande</p><h2 className="mt-3 text-2xl font-black sm:text-3xl">Gardez le marché frais et lisible.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Pilotez les produits visibles par les clients et créez des packs autonomes avec leur propre prix, image et stock.</p></div><button type="button" onClick={openNew} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400"><Icon icon={faPlus} className="mr-2" />{tab === 'products' ? 'Nouveau produit' : 'Nouveau pack'}</button></section><section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Produits actifs</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-600"><Icon icon={faTags} /></span></div><p className="mt-4 text-2xl font-black">{activeProducts}</p><p className="mt-2 text-xs font-bold text-emerald-600">Sur {products.length} références</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Packs autonomes</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon icon={faBoxesStacked} /></span></div><p className="mt-4 text-2xl font-black">{activePacks}</p><p className="mt-2 text-xs font-bold text-violet-600">{packs.length} packs configurés</p></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><div className="flex items-center justify-between"><p className="text-sm text-amber-700">Stocks à surveiller</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-amber-600"><Icon icon={faTriangleExclamation} /></span></div><p className="mt-4 text-2xl font-black text-amber-950">{lowStock}</p><p className="mt-2 text-xs font-bold text-amber-700">10 unités ou moins</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><div className="flex items-center justify-between"><p className="text-sm text-emerald-700">Valeur du stock actif</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-emerald-600"><Icon icon={faDollarSign} /></span></div><p className="mt-4 text-2xl font-black text-emerald-950">{formatFCFA(catalogValue)}</p><p className="mt-2 text-xs font-bold text-emerald-700">Prix catalogue × stock</p></div></section><section className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 pt-5 sm:flex-row sm:items-end sm:px-7"><div className="flex gap-6"><button type="button" onClick={() => { setTab('products'); resetFilters(); }} className={`border-b-2 pb-4 text-sm font-black ${tab === 'products' ? 'border-orange-500 text-slate-900' : 'border-transparent text-slate-400'}`}><Icon icon={faTags} className="mr-2" />Produits <span className="ml-1 text-xs text-slate-400">{products.length}</span></button><button type="button" onClick={() => { setTab('packs'); resetFilters(); }} className={`border-b-2 pb-4 text-sm font-black ${tab === 'packs' ? 'border-orange-500 text-slate-900' : 'border-transparent text-slate-400'}`}><Icon icon={faBoxesStacked} className="mr-2" />Packs autonomes <span className="ml-1 text-xs text-slate-400">{packs.length}</span></button></div><button type="button" onClick={openNew} className="mb-3 inline-flex items-center gap-2 self-start rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 sm:self-auto"><Icon icon={faFileCirclePlus} /> Ajouter une référence</button></div><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-7"><label className="relative min-w-0 flex-1"><span className="sr-only">Rechercher dans le catalogue</span><Icon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'products' ? 'Rechercher un produit, SKU ou vendeur…' : 'Rechercher un pack ou son SKU…'} className="w-full rounded-xl bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none focus:ring-4 focus:ring-orange-100" /></label><div className="relative"><select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-9 text-sm font-semibold text-slate-600 outline-none sm:w-56"><option>Toutes les catégories</option>{[...new Set((tab === 'products' ? products : packs).map((item) => item.category))].map((item) => <option key={item}>{item}</option>)}</select><SelectChevron /></div><div className="relative"><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-9 text-sm font-semibold text-slate-600 outline-none sm:w-40"><option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="draft">Brouillons</option><option value="archived">Archivés</option></select><SelectChevron /></div><button type="button" onClick={resetFilters} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:bg-orange-50 hover:text-brand-600" aria-label="Réinitialiser les filtres"><Icon icon={faRotateLeft} /></button></div>{isLoading ? <div className="grid gap-3 p-7">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div> : tab === 'products' ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-7 py-4 font-bold">Référence</th><th className="py-4 font-bold">Catégorie</th><th className="py-4 font-bold">Prix</th><th className="py-4 font-bold">Stock</th><th className="py-4 font-bold">Statut</th><th className="py-4 font-bold">Mise à jour</th><th className="px-7 py-4 text-right font-bold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredProducts.map((product) => <tr key={product.id} className="transition hover:bg-orange-50/40"><td className="px-7 py-4"><div className="flex items-center gap-3"><img src={product.image} alt="" className="h-12 w-14 rounded-xl bg-orange-50 object-cover" /><div><p className="font-black text-slate-800">{product.name}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{product.sku} · {product.seller}</p></div></div></td><td className="py-4 text-slate-500">{product.category}</td><td className="py-4 font-black text-slate-800">{formatFCFA(product.price)}<span className="block text-[11px] font-normal text-slate-400">{product.unit}</span></td><td className="py-4"><span className={`font-black ${product.stock <= 10 ? 'text-amber-600' : 'text-slate-800'}`}>{product.stock}</span><span className="ml-1 text-xs text-slate-400">unités</span></td><td className="py-4"><StatusBadge status={product.status} /></td><td className="py-4 text-xs text-slate-400">{product.updatedAt}</td><td className="px-7 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openProduct(product)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-orange-50 hover:text-brand-600" aria-label={`Modifier ${product.name}`}><Icon icon={faPen} size="sm" /></button><button type="button" onClick={() => void toggleProduct(product)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`${product.status === 'archived' ? 'Réactiver' : 'Archiver'} ${product.name}`}><Icon icon={product.status === 'archived' ? faRotateLeft : faArchive} size="sm" /></button></div></td></tr>)}{filteredProducts.length === 0 && <tr><td colSpan={7} className="px-7 py-14 text-center text-slate-500">Aucun produit ne correspond aux filtres.</td></tr>}</tbody></table></div> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-7 py-4 font-bold">Pack</th><th className="py-4 font-bold">Catégorie</th><th className="py-4 font-bold">Prix</th><th className="py-4 font-bold">Stock</th><th className="py-4 font-bold">Statut</th><th className="py-4 font-bold">Mise à jour</th><th className="px-7 py-4 text-right font-bold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredPacks.map((pack) => <tr key={pack.id} className="transition hover:bg-orange-50/40"><td className="px-7 py-4"><div className="flex items-center gap-3"><img src={pack.image} alt="" className="h-12 w-14 rounded-xl bg-orange-50 object-cover" /><div><p className="font-black text-slate-800">{pack.name}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{pack.sku} · {pack.unit}</p></div></div></td><td className="py-4 text-slate-500">{pack.category}</td><td className="py-4 font-black text-slate-800">{formatFCFA(pack.price)}<span className="block text-[11px] font-normal text-slate-400">réf. {formatFCFA(pack.compareAtPrice)}</span></td><td className="py-4"><span className={`font-black ${pack.stock <= 10 ? 'text-amber-600' : 'text-slate-800'}`}>{pack.stock}</span><span className="ml-1 text-xs text-slate-400">packs</span></td><td className="py-4"><StatusBadge status={pack.status} /></td><td className="py-4 text-xs text-slate-400">{pack.updatedAt}</td><td className="px-7 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openPack(pack)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-orange-50 hover:text-brand-600" aria-label={`Modifier ${pack.name}`}><Icon icon={faPen} size="sm" /></button><button type="button" onClick={() => void togglePack(pack)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`${pack.status === 'archived' ? 'Réactiver' : 'Archiver'} ${pack.name}`}><Icon icon={pack.status === 'archived' ? faRotateLeft : faArchive} size="sm" /></button></div></td></tr>)}{filteredPacks.length === 0 && <tr><td colSpan={7} className="px-7 py-14 text-center text-slate-500">Aucun pack ne correspond aux filtres.</td></tr>}</tbody></table></div>}</section><section className="mt-7 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><Icon icon={faFileCirclePlus} className="text-xl text-orange-600" /><h2 className="mt-4 font-black">Créer rapidement</h2><p className="mt-2 text-sm leading-6 text-slate-500">Ajoutez une nouvelle référence en quelques champs, puis complétez-la plus tard.</p><button type="button" onClick={openNew} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600">Ouvrir le formulaire <Icon icon={faArrowRight} /></button></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><Icon icon={faSliders} className="text-xl text-sky-600" /><h2 className="mt-4 font-black">Filtres et statuts</h2><p className="mt-2 text-sm leading-6 text-slate-500">Les brouillons restent invisibles du marché jusqu’à leur activation.</p><button type="button" onClick={resetFilters} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600">Réinitialiser la vue <Icon icon={faRotateLeft} /></button></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><Icon icon={faHeartPulse} className="text-xl text-emerald-600" /><h2 className="mt-4 font-black">Synchronisation API</h2><p className="mt-2 text-sm leading-6 text-slate-500">Le mock RTK Query est prêt à être remplacé par les endpoints Laravel.</p><Link to="/admin/console" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600">Voir la console <Icon icon={faArrowRight} /></Link></div></section></main></div>{isModalOpen && tab === 'products' && <ProductModal product={editingProduct} form={productForm} setForm={setProductForm} onClose={closeModal} onSubmit={(event) => void submitProduct(event)} isSaving={isSaving} />}{isModalOpen && tab === 'packs' && <PackModal pack={editingPack} form={packForm} setForm={setPackForm} onClose={closeModal} onSubmit={(event) => void submitPack(event)} isSaving={isSaving} />}{message && <div role="status" className="motion-enter fixed bottom-5 right-5 z-[80] rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl">{message}</div>}</div>;
}
