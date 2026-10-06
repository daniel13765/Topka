import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/services/api/client';

type Rejected = (error: unknown) => Promise<unknown>;

function responseRejected(): Rejected {
  const handlers = (apiClient.interceptors.response as unknown as { handlers: Array<{ rejected: Rejected }> }).handlers;
  return handlers[0].rejected;
}

describe('API client session interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  it('adds the bearer token when a session exists', async () => {
    localStorage.setItem('tokpa_token', 'abc');
    const handlers = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: { headers: Record<string, string> }) => unknown }>;
    }).handlers;
    const config = await handlers[0].fulfilled({ headers: {} });
    expect(config).toMatchObject({ headers: { Authorization: 'Bearer abc' } });
  });

  it('clears a dead session and announces it on 401', async () => {
    localStorage.setItem('tokpa_token', 'abc');
    localStorage.setItem('tokpa_user', '{}');
    await expect(responseRejected()({ response: { status: 401 } })).rejects.toBeTruthy();
    expect(localStorage.getItem('tokpa_token')).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it('does not announce a 401 for a visitor', async () => {
    await expect(responseRejected()({ response: { status: 401 } })).rejects.toBeTruthy();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('leaves other errors untouched', async () => {
    localStorage.setItem('tokpa_token', 'abc');
    await expect(responseRejected()({ response: { status: 500 } })).rejects.toBeTruthy();
    expect(localStorage.getItem('tokpa_token')).toBe('abc');
  });
});

describe('API client 423 two_fa_required (middleware EnsureTwoFA)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  it('garde le token, annonce le second facteur et rend l’email à /verification-2fa', async () => {
    localStorage.setItem('tokpa_token', 'abc');
    localStorage.setItem('tokpa_user', JSON.stringify({ email: 'livreur@tokpa.bj' }));
    const err = { response: { status: 423, data: { message: 'Vérification 2FA requise.', code: 'two_fa_required' } } };
    await expect(responseRejected()(err)).rejects.toBe(err);
    expect(localStorage.getItem('tokpa_token')).toBe('abc');
    expect(localStorage.getItem('tokpa_pending_email')).toBe('livreur@tokpa.bj');
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('ne remplace pas une adresse déjà en attente et ignore un 423 sans code', async () => {
    localStorage.setItem('tokpa_pending_email', 'client@tokpa.bj');
    const sansCode = { response: { status: 423, data: {} } };
    await expect(responseRejected()(sansCode)).rejects.toBeTruthy();
    expect(window.dispatchEvent).not.toHaveBeenCalled();

    localStorage.setItem('tokpa_user', JSON.stringify({ email: 'livreur2@tokpa.bj' }));
    const requis = { response: { status: 423, data: { code: 'two_fa_required' } } };
    await expect(responseRejected()(requis)).rejects.toBeTruthy();
    expect(localStorage.getItem('tokpa_pending_email')).toBe('client@tokpa.bj');
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('survit à un tokpa_user illisible', async () => {
    localStorage.setItem('tokpa_user', '{ pas du json');
    const err = { response: { status: 423, data: { code: 'two_fa_required' } } };
    await expect(responseRejected()(err)).rejects.toBe(err);
    expect(localStorage.getItem('tokpa_pending_email')).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
