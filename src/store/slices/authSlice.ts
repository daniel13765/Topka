import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types/domain';

interface AuthState {
  user: User | null;
  status: 'idle' | 'authenticated' | 'signed-out';
}

const initialState: AuthState = {
  user: null,
  status: 'signed-out',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.status = 'authenticated';
    },
    clearSession: (state) => {
      state.user = null;
      state.status = 'signed-out';
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;
