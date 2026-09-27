import { describe, expect, it } from 'vitest';
import reducer, { add, clear, remove, selectCount, selectSavings, selectSubtotal, setQuantity } from '../src/store/slices/cart/cartSlice';
import type { Product } from '../src/types/models';

const product = (overrides: Partial<Product> = {}): Product => ({ id: 'p1', nom: 'Riz', prix: 1000, image: '', description: '', categorie: '', stock: 'available', badges: [], ...overrides } as Product);

describe('cart selectors and reducer', () => {
  it('adds and merges quantities', () => {
    let state = reducer(undefined, add({ product: product(), quantity: 2 }));
    state = reducer(state, add({ product: product(), quantity: 3 }));
    expect(selectCount(state.items)).toBe(5);
    expect(selectSubtotal(state.items)).toBe(5000);
  });
  it('never allows quantity below one', () => {
    const state = reducer({ items: [{ product: product(), quantite: 2 }] }, setQuantity({ productId: 'p1', quantity: 0 }));
    expect(state.items[0].quantite).toBe(1);
  });
  it('calculates negotiated savings', () => expect(selectSavings([{ product: product({ prix: 800, negotiated: { oldPrice: 1000 } }), quantite: 2 }])).toBe(400));
  it('removes and clears items', () => {
    let state = reducer(undefined, add({ product: product() }));
    state = reducer(state, remove('p1'));
    expect(state.items).toHaveLength(0);
    state = reducer(state, add({ product: product() }));
    expect(reducer(state, clear()).items).toHaveLength(0);
  });
});
