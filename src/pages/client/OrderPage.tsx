import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faChevronDown,
  faCircleInfo,
  faCreditCard,
  faLocationDot,
  faMinus,
  faMotorcycle,
  faPlus,
  faShieldHalved,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { MarketplaceHeader } from '../../components/layout/MarketplaceHeader';
import { Icon } from '../../components/ui/Icon';
import { useAppSelector } from '../../hooks/redux';
import type { CartItem } from '../../types/domain';
import { formatFCFA } from '../../utils/formatFCFA';

const demoItems: CartItem[] = [
  { productId: 1, name: 'Bananes plantain mûres', unitPrice: 1800, quantity: 1 },
  { productId: 5, name: 'Tomates fraîches locales', unitPrice: 450, quantity: 2 },
  { productId: 4, name: 'Panier tropical du marché', unitPrice: 6500, quantity: 1 },
];

const imageByProduct: Record<number, string> = {
  1: '/images/placeholders/bananes-plantain.jpg',
  4: '/images/brand/tropical-still-life.jpg',
  5: '/images/products/tomate.jpg',
};

const zones = [
  { value: 'cadjehoun', label: 'Cadjèhoun — Cotonou', detail: 'Livraison estimée : 30 à 45 min', fee: 700 },
  { value: 'akpakpa', label: 'Akpakpa — Cotonou', detail: 'Livraison estimée : 35 à 50 min', fee: 800 },
  { value: 'fidjrosse', label: 'Fidjrossè — Cotonou', detail: 'Livraison estimée : 40 à 55 min', fee: 900 },
];

function Stepper() {
  const steps = ['Panier', 'Livraison', 'Paiement', 'Confirmation'];
  return (
    <div className="mb-8 overflow-x-auto rounded-2xl border border-orange-100 bg-white px-5 py-4 shadow-sm">
      <div className="mx-auto flex min-w-[540px] max-w-3xl items-center justify-between">
        {steps.map((step, index) => {
          const current = index === 1;
          const done = index === 0;
          return (
            <div key={step} className="flex items-center gap-3">
              <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black ${done ? 'bg-emerald-500 text-white' : current ? 'bg-brand-500 text-white shadow-lg shadow-orange-200' : 'border border-slate-200 bg-slate-50 text-slate-400'}`}>
                {done ? <Icon icon={faCheck} /> : index + 1}
              </span>
              <span className={`text-sm font-bold ${current ? 'text-slate-900' : done ? 'text-emerald-700' : 'text-slate-400'}`}>{step}</span>
              {index < steps.length - 1 && <span className={`mx-2 h-px w-10 sm:w-16 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrderPage() {
  const navigate = useNavigate();
  const cartItems = useAppSelector((state) => state.cart.items);
  const [items, setItems] = useState<CartItem[]>(cartItems.length > 0 ? cartItems : demoItems);
  const [zone, setZone] = useState('cadjehoun');
  const [address, setAddress] = useState('Rue 125, Cadjèhoun, près de la pharmacie');
  const [phone, setPhone] = useState('+229 97 00 00 00');
  const [notice, setNotice] = useState('');

  const subtotal = useMemo(() => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0), [items]);
  const selectedZone = zones.find((item) => item.value === zone) || zones[0];
  const deliveryFee = items.length > 0 ? selectedZone.fee : 0;
  const serviceFee = items.length > 0 ? 150 : 0;
  const total = subtotal + deliveryFee + serviceFee;

  const updateQuantity = (productId: number, delta: number) => {
    setItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeItem = (productId: number) => {
    setItems((current) => current.filter((item) => item.productId !== productId));
  };

  const pay = () => {
    if (!items.length) {
      setNotice('Votre panier est vide. Ajoutez un produit avant de continuer.');
      return;
    }
    if (!address.trim() || !phone.trim()) {
      setNotice('Renseignez votre adresse et votre numéro de téléphone.');
      return;
    }
    navigate(`/commande/succes?total=${total}`);
  };

  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-900">
      <MarketplaceHeader active="orders" />
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/catalogue" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-600"><Icon icon={faArrowLeft} /> Continuer mes achats</Link>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Finaliser ma commande</h1>
            <p className="mt-2 text-sm text-slate-500">Choisissez votre point de livraison et confirmez le paiement.</p>
          </div>
          <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 sm:inline-flex"><Icon icon={faShieldHalved} /> Paiement sécurisé</span>
        </div>

        <div className="mt-8"><Stepper /></div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Étape 1</p><h2 className="mt-1 text-xl font-black">Votre panier <span className="ml-1 text-sm font-semibold text-slate-400">({items.reduce((sum, item) => sum + item.quantity, 0)} articles)</span></h2></div><Link to="/catalogue" className="text-sm font-bold text-brand-600 hover:text-brand-700">Ajouter un produit</Link></div>
              <div className="mt-6 divide-y divide-slate-100">
                {items.length === 0 && <div className="rounded-2xl bg-orange-50 p-7 text-center"><p className="font-bold text-slate-800">Votre panier est vide</p><Link to="/catalogue" className="btn-primary mt-4">Découvrir le catalogue</Link></div>}
                {items.map((item) => (
                  <div key={item.productId} className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center">
                    <img src={imageByProduct[item.productId] || '/images/brand/market-fruits.jpg'} alt="" className="h-20 w-24 rounded-2xl bg-orange-50 object-cover" />
                    <div className="min-w-0 flex-1"><p className="font-black text-slate-900">{item.name}</p><p className="mt-1 text-sm text-slate-500">Vendeur partenaire · produit local</p><p className="mt-2 font-bold text-brand-600">{formatFCFA(item.unitPrice)}</p></div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end"><div className="flex items-center overflow-hidden rounded-xl border border-slate-200"><button type="button" onClick={() => updateQuantity(item.productId, -1)} className="grid h-9 w-9 place-items-center text-slate-600 hover:bg-slate-50" aria-label="Diminuer la quantité"><Icon icon={faMinus} size="xs" /></button><span className="grid h-9 w-9 place-items-center border-x border-slate-200 text-sm font-black">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.productId, 1)} className="grid h-9 w-9 place-items-center text-slate-600 hover:bg-slate-50" aria-label="Augmenter la quantité"><Icon icon={faPlus} size="xs" /></button></div><div className="flex items-center gap-3"><strong className="text-sm">{formatFCFA(item.unitPrice * item.quantity)}</strong><button type="button" onClick={() => removeItem(item.productId)} className="text-slate-300 transition hover:text-rose-500" aria-label={`Supprimer ${item.name}`}><Icon icon={faTrash} /></button></div></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div><p className="eyebrow">Étape 2</p><h2 className="mt-1 text-xl font-black">Adresse de livraison</h2></div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="field-label sm:col-span-2">Zone de livraison<div className="relative"><select value={zone} onChange={(event) => setZone(event.target.value)} className="field-input appearance-none pr-10">{zones.map((item) => <option key={item.value} value={item.value}>{item.label} · {formatFCFA(item.fee)}</option>)}</select><Icon icon={faChevronDown} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" /></div></label>
                <label className="field-label sm:col-span-2">Adresse ou point de repère<input value={address} onChange={(event) => setAddress(event.target.value)} className="field-input" placeholder="Ex. près du marché…" /></label>
                <label className="field-label">Nom du destinataire<input defaultValue="Daniel" className="field-input" /></label>
                <label className="field-label">Téléphone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="field-input" /></label>
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900"><Icon icon={faLocationDot} className="mt-0.5 text-brand-600" /><div><p className="font-bold">{selectedZone.label}</p><p className="mt-1 text-xs leading-5 text-orange-800">{selectedZone.detail}. Le livreur vous appellera à son arrivée.</p></div></div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div><p className="eyebrow">Étape 3</p><h2 className="mt-1 text-xl font-black">Mode de paiement</h2></div><div className="mt-6 rounded-2xl border-2 border-brand-500 bg-orange-50 p-4"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1e293b] text-white"><Icon icon={faCreditCard} /></span><div className="flex-1"><p className="font-black">FedaPay</p><p className="mt-1 text-xs text-slate-500">Carte, Mobile Money ou portefeuille électronique</p></div><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-xs text-white"><Icon icon={faCheck} /></span></div><p className="mt-4 border-t border-orange-200 pt-4 text-xs text-orange-900"><Icon icon={faCircleInfo} className="mr-1" /> Vous serez redirigé vers la page sécurisée FedaPay pour confirmer le paiement.</p></div></section>
          </div>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24 sm:p-7"><p className="eyebrow">Récapitulatif</p><h2 className="mt-1 text-xl font-black">Résumé de la commande</h2><div className="mt-6 space-y-4 border-b border-slate-100 pb-5 text-sm"><div className="flex justify-between gap-4 text-slate-500"><span>Sous-total</span><strong className="text-slate-900">{formatFCFA(subtotal)}</strong></div><div className="flex justify-between gap-4 text-slate-500"><span>Livraison</span><strong className="text-slate-900">{formatFCFA(deliveryFee)}</strong></div><div className="flex justify-between gap-4 text-slate-500"><span>Frais de service</span><strong className="text-slate-900">{formatFCFA(serviceFee)}</strong></div></div><div className="flex items-end justify-between gap-4 py-5"><span className="font-bold">Total à payer</span><strong className="text-2xl font-black text-brand-600">{formatFCFA(total)}</strong></div><button type="button" onClick={pay} className="btn-primary w-full py-3.5">Payer avec FedaPay <Icon icon={faArrowRight} className="ml-2" /></button><p className="mt-4 text-center text-xs leading-5 text-slate-400"><Icon icon={faShieldHalved} className="mr-1 text-emerald-500" /> Vos informations de paiement sont chiffrées et protégées.</p><div className="mt-6 rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-brand-600"><Icon icon={faMotorcycle} /></span><div><p className="text-xs font-bold text-slate-800">Livraison TOKPa</p><p className="mt-1 text-xs text-slate-500">{selectedZone.detail}</p></div></div></div>{notice && <p role="status" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{notice}</p>}</aside>
        </div>
      </div>
    </main>
  );
}

export function OrderSuccessPage() {
  const search = new URLSearchParams(window.location.search);
  const total = Number(search.get('total')) || 7_950;
  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-900">
      <MarketplaceHeader active="orders" />
      <div className="mx-auto grid min-h-[calc(100vh-68px)] max-w-3xl place-items-center px-5 py-12"><section className="motion-enter w-full rounded-[2rem] border border-orange-100 bg-white p-7 text-center shadow-xl shadow-orange-100/50 sm:p-12"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-100 text-4xl text-emerald-600"><Icon icon={faCheck} /></div><p className="eyebrow mt-7">Commande confirmée</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Merci pour votre commande !</h1><p className="mx-auto mt-4 max-w-lg leading-7 text-slate-500">Votre commande a bien été enregistrée. Un message de confirmation vous sera envoyé avec les prochaines étapes de livraison.</p><div className="mx-auto mt-8 max-w-md rounded-2xl bg-orange-50 p-5 text-left"><div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">Référence</span><strong>#TOK-2847</strong></div><div className="mt-3 flex justify-between gap-4 text-sm"><span className="text-slate-500">Montant payé</span><strong className="text-brand-600">{formatFCFA(total)}</strong></div><div className="mt-3 flex justify-between gap-4 text-sm"><span className="text-slate-500">Statut</span><span className="font-bold text-emerald-600">Paiement confirmé</span></div></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/client" className="btn-primary">Suivre ma commande <Icon icon={faArrowRight} className="ml-2" /></Link><Link to="/catalogue" className="btn-secondary">Retour au marché</Link></div><p className="mt-7 text-xs text-slate-400">Besoin d’aide ? <Link to="/client/notifications" className="font-bold text-brand-600">Contacter TOKPa</Link></p></section></div>
    </main>
  );
}
