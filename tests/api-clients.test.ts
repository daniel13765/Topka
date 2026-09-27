import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../src/services/realtime/echo', () => ({
  initEcho: vi.fn(),
  shutdownEcho: vi.fn(),
}));

import { apiClient } from '../src/services/api/client';
import { authApi } from '../src/services/api/auth';
import { cartApi } from '../src/services/api/cart';
import { catalogApi } from '../src/services/api/catalog';
import { livreurApi } from '../src/services/api/livreur';
import { notificationsApi } from '../src/services/api/notifications';
import { ordersApi } from '../src/services/api/orders';
import { paymentsApi } from '../src/services/api/payments';
import { negotiationApi } from '../src/services/api/negotiation';
import { adminApi } from '../src/services/api/admin';
import { initEcho, shutdownEcho } from '../src/services/realtime/echo';

describe('auth API session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  it('stores the unwrapped user after 2FA and starts realtime', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { token: 'sanctum-1', user: { data: { id: 4, role: { nom: 'client' } } } },
    });
    await authApi.verify2fa({ email: 'client@tokpa.bj', code: '123456' });
    expect(localStorage.getItem('tokpa_token')).toBe('sanctum-1');
    expect(JSON.parse(localStorage.getItem('tokpa_user') ?? '{}')).toEqual({ id: 4, role: { nom: 'client' } });
    expect(initEcho).toHaveBeenCalled();
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it('does not open a session when 2FA returns no token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: false } });
    await authApi.verify2fa({ email: 'a@b.c', code: '000000' });
    expect(localStorage.getItem('tokpa_token')).toBeNull();
  });

  it('clears the session even if logout fails', async () => {
    localStorage.setItem('tokpa_token', 'tok');
    localStorage.setItem('tokpa_user', '{}');
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network'));
    await expect(authApi.logout()).rejects.toThrow('network');
    expect(localStorage.getItem('tokpa_token')).toBeNull();
    expect(shutdownEcho).toHaveBeenCalled();
  });
});

describe('order, cart and catalog adapters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('omits an empty order status filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await ordersApi.getOrders(2);
    expect(apiClient.get).toHaveBeenCalledWith('/orders', { params: { page: 2 } });
    await ordersApi.getOrders(1, 'livre');
    expect(apiClient.get).toHaveBeenCalledWith('/orders', { params: { page: 1, statut: 'livre' } });
  });

  it('calls tracking and cancel with the order id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await ordersApi.getTracking(7);
    await ordersApi.cancelOrder(7);
    expect(apiClient.get).toHaveBeenCalledWith('/orders/7/tracking');
    expect(apiClient.delete).toHaveBeenCalledWith('/orders/7');
  });

  it('sends cart quantity and catalog filters', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: [] } });
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await cartApi.addToCart(5, 3);
    await catalogApi.getProducts({ q: 'riz', page: 1 });
    expect(apiClient.post).toHaveBeenCalledWith('/cart/add', { product_id: 5, quantite: 3 });
    expect(apiClient.get).toHaveBeenCalledWith('/products', { params: { q: 'riz', page: 1 } });
  });
});

describe('livreur, payment and notification adapters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('patches delivery status and posts a position', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await livreurApi.updateStatus(4, 'livre');
    await livreurApi.updatePosition({ latitude: 6.37, longitude: 2.43, order_id: 4 });
    expect(apiClient.patch).toHaveBeenCalledWith('/livreur/deliveries/4/status', { statut: 'livre' });
    expect(apiClient.post).toHaveBeenCalledWith('/livreur/position', { latitude: 6.37, longitude: 2.43, order_id: 4 });
  });

  it('loads a payment and marks a notification read', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { statut: 'reussi' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await paymentsApi.getPayment(9);
    await notificationsApi.markRead(9);
    expect(apiClient.get).toHaveBeenCalledWith('/payments/9');
    expect(apiClient.patch).toHaveBeenCalledWith('/notifications/9/read');
  });

  it('creates a budget proposal', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } });
    await negotiationApi.createProposal({ product_id: 2, prix_propose: 900, quantite: 1 });
    expect(apiClient.post).toHaveBeenCalledWith('/budget-proposals', { product_id: 2, prix_propose: 900, quantite: 1 });
  });

  it('accepts a page number for admin products', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await adminApi.getProducts(3);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/products', { params: { page: 3 } });
  });
});
