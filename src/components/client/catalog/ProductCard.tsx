import { useState } from 'react';
import { Link } from 'react-router-dom';
import { faCartPlus, faCheck, faHeart, faStar } from '@fortawesome/free-solid-svg-icons';
import type { Product } from '../../../types/domain';
import { useAppDispatch } from '../../../hooks/redux';
import { addItem } from '../../../store/slices/cartSlice';
import { formatFCFA } from '../../../utils/formatFCFA';
import { Icon } from '../../ui/Icon';

export function ProductCard({ product }: { product: Product }) {
  const dispatch = useAppDispatch();
  const [added, setAdded] = useState(false);

  const addToCart = () => {
    dispatch(addItem({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity: 1,
    }));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-orange-50">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        {product.badge && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-orange-700 shadow-sm">{product.badge}</span>}
        <button type="button" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-400 shadow-sm transition hover:bg-white hover:text-rose-500" aria-label={`Ajouter ${product.name} aux favoris`}>
          <Icon icon={faHeart} />
        </button>
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{product.category}</p>
        <Link to={`/produit/${product.id}`} className="mt-2 block min-h-12 font-bold leading-6 text-slate-900 hover:text-brand-600">{product.name}</Link>
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
          <Icon icon={faStar} />
          <span className="font-bold">{product.rating.toFixed(1)}</span>
          <span className="text-slate-400">· Producteur local</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-black text-slate-900">{formatFCFA(product.price)}</p>
            <p className="text-xs text-slate-400">{product.unit}</p>
          </div>
          <button type="button" onClick={addToCart} className={`grid h-10 w-10 place-items-center rounded-xl transition ${added ? 'bg-emerald-500 text-white' : 'bg-orange-50 text-orange-700 hover:bg-brand-500 hover:text-white'}`} aria-label={`Ajouter ${product.name} au panier`}>
            <Icon icon={added ? faCheck : faCartPlus} />
          </button>
        </div>
      </div>
    </article>
  );
}
