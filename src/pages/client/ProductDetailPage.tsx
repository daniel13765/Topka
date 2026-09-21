import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { faArrowLeft, faCartShopping, faCheck, faChevronRight, faHeart, faLocationDot, faMinus, faPlus, faStar, faTag, faUserCheck } from '@fortawesome/free-solid-svg-icons';
import { MarketplaceHeader } from '../../components/layout/MarketplaceHeader';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { getProductById, mockProducts } from '../../data/mockProducts';
import { useAppDispatch } from '../../hooks/redux';
import { addItem } from '../../store/slices/cartSlice';
import { useCreateNegotiationMutation } from '../../services/api/negotiationsApi';
import { formatFCFA } from '../../utils/formatFCFA';

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const product = getProductById(Number(productId));
  const [quantity, setQuantity] = useState(1);
  const [offer, setOffer] = useState(product?.minOffer || product?.price || 0);
  const [offerSent, setOfferSent] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [activeTab, setActiveTab] = useState<'description' | 'seller' | 'reviews'>('description');
  const [createNegotiation, { isLoading: isSendingOffer }] = useCreateNegotiationMutation();

  const relatedProducts = useMemo(() => mockProducts.filter((item) => item.id !== product?.id && item.category === product?.category).slice(0, 3), [product?.category, product?.id]);

  if (!product) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 px-5"><Card className="max-w-md p-8 text-center"><h1 className="text-2xl font-black">Produit introuvable</h1><p className="mt-3 text-sm text-slate-500">Ce produit n’est plus disponible ou le lien est incorrect.</p><Link to="/catalogue" className="btn-primary mt-6">Retour au catalogue</Link></Card></main>;
  }

  const addToCart = () => {
    dispatch(addItem({ productId: product.id, name: product.name, unitPrice: product.price, quantity }));
  };

  const submitOffer = async () => {
    setOfferError('');
    setOfferSent(false);
    if (!product.negotiable && product.minOffer === undefined) {
      setOfferError('Ce produit n’est pas ouvert à la négociation pour le moment.');
      return;
    }
    if (offer < (product.minOffer || 0) || offer >= product.price) {
      setOfferError(`Votre offre doit être comprise entre ${formatFCFA(product.minOffer || 0)} et moins de ${formatFCFA(product.price)}.`);
      return;
    }
    try {
      await createNegotiation({ productId: product.id, productName: product.name, productImage: product.image, seller: product.seller || 'Vendeur partenaire', sellerPrice: product.price, minOffer: product.minOffer || 0, quantity, offer }).unwrap();
      setOfferSent(true);
    } catch {
      setOfferError('Impossible d’envoyer votre offre. Réessayez dans un instant.');
    }
  };

  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-900">
      <MarketplaceHeader active="market" />
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8"><div className="flex items-center gap-2 text-sm text-slate-400"><Link to="/catalogue" className="hover:text-brand-600">Accueil</Link><Icon icon={faChevronRight} className="text-xs" /><span>{product.category}</span><Icon icon={faChevronRight} className="text-xs" /><span className="font-semibold text-slate-700">{product.name}</span></div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section><div className="relative overflow-hidden rounded-3xl border border-orange-100 bg-orange-50"><div className="absolute left-5 top-5 z-10 rounded-full border border-emerald-300 bg-white/95 px-3 py-1 text-xs font-bold text-emerald-700">● {product.available === false ? 'Stock épuisé' : 'Disponible'}</div><img src={product.image} alt={product.name} className="aspect-square w-full object-cover" /></div><div className="mt-4 grid grid-cols-4 gap-3">{[product.image, ...Array(3).fill(product.image)].map((image, index) => <button type="button" key={`${image}-${index}`} className={`overflow-hidden rounded-xl border-2 bg-orange-50 ${index === 0 ? 'border-brand-500' : 'border-transparent'}`} aria-label={`Voir image ${index + 1}`}><img src={image} alt="" className="aspect-square w-full object-cover" /></button>)}</div></section>
          <section><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{product.category}</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{product.name}</h1><div className="mt-4 flex flex-wrap items-center gap-4"><span className="inline-flex items-center gap-1 font-black text-slate-900"><Icon icon={faStar} className="text-amber-400" /> {product.rating.toFixed(1)}/5</span><span className="text-sm text-slate-500">({product.reviews || 0} avis)</span><span className="inline-flex items-center gap-2 text-sm text-slate-500"><Icon icon={faLocationDot} className="text-brand-500" /> {product.market || 'Marché local'}</span></div><div className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-full bg-orange-50 font-black text-brand-600">{(product.seller || 'V').slice(0, 2).toUpperCase()}</span><div className="flex-1"><p className="font-bold">{product.seller || 'Vendeur partenaire'}</p><p className="text-sm text-emerald-600"><Icon icon={faUserCheck} className="mr-1" /> Vendeur vérifié</p></div><button type="button" className="text-sm font-bold text-brand-600">Voir profil</button></div><div className="mt-6 border-t border-orange-100 pt-5"><span className="text-3xl font-black text-brand-600">{formatFCFA(product.price)}</span><span className="ml-2 text-slate-500">/ {product.unit}</span></div><div className="mt-5 flex items-center justify-between gap-4"><span className="font-semibold text-slate-600">Quantité</span><div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white"><button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="grid h-11 w-11 place-items-center text-slate-600 hover:bg-slate-50"><Icon icon={faMinus} /></button><span className="grid h-11 w-12 place-items-center border-x border-slate-200 font-black">{quantity}</span><button type="button" onClick={() => setQuantity((current) => current + 1)} className="grid h-11 w-11 place-items-center text-slate-600 hover:bg-slate-50"><Icon icon={faPlus} /></button></div></div>
            <div className="mt-5 rounded-2xl border-l-4 border-amber-400 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-black text-amber-800"><Icon icon={faTag} /> Proposer votre budget</div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-100 p-3 text-center"><p className="text-xs text-slate-500">Prix vendeur</p><p className="mt-1 font-black">{formatFCFA(product.price)}</p></div><div className="rounded-xl border border-dashed border-amber-400 bg-white p-3 text-center"><p className="text-xs text-slate-500">Votre offre</p><input value={offer} onChange={(event) => setOffer(Number(event.target.value))} type="number" min={product.minOffer} max={product.price - 1} className="mt-1 w-full bg-transparent text-center font-black text-brand-700 outline-none" /></div></div><p className="mt-3 text-xs italic text-amber-800">Budget min. accepté par le vendeur : {formatFCFA(product.minOffer || 0)}</p><button type="button" onClick={() => void submitOffer()} disabled={isSendingOffer} className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60">{isSendingOffer ? 'Envoi…' : 'Envoyer l’offre'}</button>{offerError && <p className="mt-3 text-xs font-semibold text-rose-600">{offerError}</p>}{offerSent && <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700"><Icon icon={faCheck} /> Offre envoyée. <Link to="/client/negociations" className="underline">Voir mes négociations</Link></div>}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><button type="button" onClick={addToCart} disabled={product.available === false} className="btn-primary py-3.5"><Icon icon={faCartShopping} className="mr-2" /> Ajouter au panier</button><button type="button" className="grid h-12 w-12 place-items-center rounded-xl border border-orange-200 bg-white text-slate-500 hover:text-rose-500" aria-label="Ajouter aux favoris"><Icon icon={faHeart} /></button></div><button type="button" onClick={() => { addToCart(); navigate('/commande'); }} disabled={product.available === false} className="mt-3 w-full rounded-xl border border-brand-500 bg-white py-3 font-bold text-brand-600 hover:bg-orange-50">Acheter maintenant</button>
          </section>
        </div>
        <section className="mt-10 rounded-3xl border border-slate-200 bg-white"><div className="flex overflow-x-auto border-b border-slate-100">{([['description', 'Description'], ['seller', 'Vendeur'], ['reviews', `Avis (${product.reviews || 0})`]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`shrink-0 border-b-2 px-6 py-4 text-sm font-bold ${activeTab === id ? 'border-brand-500 text-slate-900' : 'border-transparent text-slate-500'}`}>{label}</button>)}</div><div className="p-6 leading-7 text-slate-600 sm:p-8">{activeTab === 'description' && <><h2 className="font-black text-slate-900">Détails du produit</h2><p className="mt-4">{product.description}</p><div className="mt-7 grid gap-5 text-sm sm:grid-cols-4"><div><p className="text-xs uppercase text-slate-400">Origine</p><p className="font-semibold text-slate-900">{product.origin}</p></div><div><p className="text-xs uppercase text-slate-400">Fraîcheur</p><p className="font-semibold text-slate-900">{product.freshness}</p></div><div><p className="text-xs uppercase text-slate-400">Vendeur</p><p className="font-semibold text-slate-900">Vérifié</p></div><div><p className="text-xs uppercase text-slate-400">Livraison</p><p className="font-semibold text-slate-900">Cotonou</p></div></div></>}{activeTab === 'seller' && <><h2 className="font-black text-slate-900">À propos du vendeur</h2><p className="mt-4">{product.seller} approvisionne quotidiennement les marchés partenaires de TOKPa. Les produits sont contrôlés avant leur mise en ligne.</p></>}{activeTab === 'reviews' && <><h2 className="font-black text-slate-900">Avis clients</h2><p className="mt-4">Les {product.reviews || 0} avis vérifiés seront chargés depuis l’API lorsque le backend sera connecté.</p></>}</div></section>
        <section className="py-12"><div className="flex items-center justify-between"><div><p className="eyebrow">À découvrir aussi</p><h2 className="mt-1 text-2xl font-black">Produits similaires</h2></div><Link to="/catalogue" className="text-sm font-bold text-brand-600">Voir le catalogue</Link></div><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{relatedProducts.map((item) => <div key={item.id} className="min-w-0"><a href={`/produit/${item.id}`}><div className="overflow-hidden rounded-2xl bg-orange-50"><img src={item.image} alt={item.name} className="aspect-[4/3] w-full object-cover transition hover:scale-105" /></div></a><h3 className="mt-3 font-black">{item.name}</h3><p className="mt-1 font-bold text-brand-600">{formatFCFA(item.price)}</p></div>)}</div></section>
      </div>
    </main>
  );
}
