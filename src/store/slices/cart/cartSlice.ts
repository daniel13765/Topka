import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { CartItem, Product } from '../../../types/models';

interface CartState {
  items: CartItem[];
}

const initialState: CartState = { items: [] };

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    add(state, action: PayloadAction<{ product: Product; quantity?: number }>) {
      const { product, quantity = 1 } = action.payload;
      const found = state.items.find((i) => i.product.id === product.id);
      if (found) found.quantite += quantity;
      else state.items.push({ product, quantite: quantity });
    },
    setQuantity(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const item = state.items.find((i) => i.product.id === action.payload.productId);
      if (item) item.quantite = Math.max(1, action.payload.quantity);
    },
    remove(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.product.id !== action.payload);
    },
    clear(state) {
      state.items = [];
    },
  },
});

export const { add, setQuantity, remove, clear } = cartSlice.actions;

/* ---------- Selectors ---------- */
export const selectCount = (items: CartItem[]) => items.reduce((s, i) => s + i.quantite, 0);
export const selectSubtotal = (items: CartItem[]) =>
  items.reduce((s, i) => s + i.product.prix * i.quantite, 0);
export const selectSavings = (items: CartItem[]) =>
  items.reduce(
    (s, i) => s + (i.product.negotiated ? (i.product.negotiated.oldPrice - i.product.prix) * i.quantite : 0),
    0,
  );

export default cartSlice.reducer;
