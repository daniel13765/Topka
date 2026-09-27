import { describe, expect, it, vi, beforeEach } from 'vitest';
import { managerApi } from '../src/services/api/manager';
import { apiClient } from '../src/services/api/client';

vi.mock('../src/services/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

describe('manager API adapter', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requests weekly statistics using the backend period name', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { commandes: 4, ca: 1000, livrees: 2 } });
    await managerApi.getStats('semaine');
    expect(apiClient.get).toHaveBeenCalledWith('/manager/stats', { params: { period: 'semaine' } });
  });
  it('passes status filters to manager orders', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await managerApi.getOrders({ statut: 'en_attente', page: 2 });
    expect(apiClient.get).toHaveBeenCalledWith('/manager/orders', { params: { statut: 'en_attente', page: 2 } });
  });
});
