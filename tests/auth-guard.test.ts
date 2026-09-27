import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@tanstack/react-router', () => ({ redirect: (args: unknown) => args }));

import { canAccess, currentUserZone, homeForRole, postLoginTarget, staffSpace } from '../src/routes/authGuard';

describe('role and session helpers', () => {
  beforeEach(() => localStorage.clear());
  it('chooses the correct workspace', () => {
    expect(homeForRole('manager')).toBe('/manager');
    expect(staffSpace('admin')?.to).toBe('/admin');
  });
  it('restricts admin pages to admin roles', () => {
    expect(canAccess('/admin/commandes', 'admin')).toBe(true);
    expect(canAccess('/admin/commandes', 'manager')).toBe(false);
  });
  it('sends a direct /connexion login to the role workspace', () => {
    sessionStorage.setItem('tokpa_redirect', '/connexion');
    expect(postLoginTarget('client')).toBe('/');
    sessionStorage.setItem('tokpa_redirect', '/connexion');
    expect(postLoginTarget('manager')).toBe('/manager');
  });
  it('reads the manager zone from the stored API user', () => {
    localStorage.setItem('tokpa_user', JSON.stringify({ profil: { zone: { nom: 'Akpakpa' } } }));
    expect(currentUserZone()).toBe('Akpakpa');
  });
});
