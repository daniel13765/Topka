import { describe, expect, it } from 'vitest';
import reducer, { acceptCounterOffer, cancelNegotiation, setProposals, submitOffer } from '../src/store/slices/negotiation/negotiationSlice';

describe('negotiation reducer', () => {
  it('creates a pending proposal', () => {
    const state = reducer(undefined, submitOffer({ productId: 'p1', productName: 'Riz', originalPrice: 1200, proposedPrice: 1000, minPrice: 900 }));
    expect(state.history[0]).toMatchObject({ productId: 'p1', status: 'pending', proposedPrice: 1000 });
  });
  it('synchronizes API proposals into active negotiations', () => {
    const proposal = { id: '7', productId: 'p2', productName: 'Maïs', originalPrice: 800, proposedPrice: 700, minPrice: 600, status: 'accepted' as const, createdAt: 'today' };
    const state = reducer(undefined, setProposals([proposal]));
    expect(state.activeNegotiations.p2).toEqual(proposal);
  });
  it('accepts a counter offer', () => {
    const base = reducer(undefined, submitOffer({ productId: 'p1', productName: 'Riz', originalPrice: 1200, proposedPrice: 900, minPrice: 800 }));
    const state = reducer({ ...base, activeNegotiations: { ...base.activeNegotiations, p1: { ...base.activeNegotiations.p1, counterPrice: 1000 } } }, acceptCounterOffer({ productId: 'p1' }));
    expect(state.activeNegotiations.p1).toMatchObject({ status: 'accepted', proposedPrice: 1000 });
  });
  it('cancels a proposal', () => expect(reducer(reducer(undefined, submitOffer({ productId: 'p1', productName: 'Riz', originalPrice: 1, proposedPrice: 1, minPrice: 1 })), cancelNegotiation({ productId: 'p1' })).history).toHaveLength(0));
});
