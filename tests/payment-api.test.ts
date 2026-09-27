import { describe, expect, it, vi, beforeEach } from 'vitest';
import { paymentsApi } from '../src/services/api/payments';
import { apiClient } from '../src/services/api/client';

vi.mock('../src/services/api/client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));

describe('payment API adapter', () => {
  beforeEach(() => vi.clearAllMocks());
  it('initializes payment for an existing order', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { redirect_url: '/payments/sandbox/tok' } });
    await expect(paymentsApi.initPayment({ order_id: 42 })).resolves.toEqual({ redirect_url: '/payments/sandbox/tok' });
    expect(apiClient.post).toHaveBeenCalledWith('/payments/init', { order_id: 42 });
  });
  it('loads payment details', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 3, statut: 'en_attente' } });
    await paymentsApi.getPayment(3);
    expect(apiClient.get).toHaveBeenCalledWith('/payments/3');
  });
});
