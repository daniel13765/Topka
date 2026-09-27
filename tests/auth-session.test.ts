import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canAccess,
  currentRole,
  currentUserName,
  guardRoute,
  hasSession,
  initialsOf,
  isPublicPath,
  pageRoles,
  postLoginTarget,
  rememberRedirect,
  safeRedirect,
} from '../src/routes/authGuard';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@tanstack/react-router', () => ({ redirect: (args: unknown) => ({ redirected: args }) }));

describe('session and public paths', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('treats auth screens as public, including a trailing slash', () => {
    expect(isPublicPath('/connexion/')).toBe(true);
    expect(isPublicPath('/catalogue')).toBe(false);
    expect(hasSession()).toBe(false);
    localStorage.setItem('tokpa_token', 'tok');
    expect(hasSession()).toBe(true);
  });

  it('reads a role stored as a string or as an object', () => {
    localStorage.setItem('tokpa_user', JSON.stringify({ role: 'livreur', prenom: 'Jean', nom: 'Kouassi' }));
    expect(currentRole()).toBe('livreur');
    expect(currentUserName()).toBe('Jean Kouassi');
    localStorage.setItem('tokpa_user', '{');
    expect(currentRole()).toBeNull();
    localStorage.setItem('tokpa_user', JSON.stringify({ role: { nom: 'manager' }, nom_complet: 'Awa Dossou' }));
    expect(currentRole()).toBe('manager');
    expect(currentUserName()).toBe('Awa Dossou');
  });

  it('builds initials', () => {
    expect(initialsOf('awa dossou')).toBe('AD');
    expect(initialsOf('   ')).toBe('?');
    expect(initialsOf(null, 'TK')).toBe('TK');
  });
});

describe('redirect safety', () => {
  beforeEach(() => sessionStorage.clear());

  it('rejects external and auth-screen targets', () => {
    expect(safeRedirect('https://evil.test')).toBeNull();
    expect(safeRedirect('//evil.test')).toBeNull();
    expect(safeRedirect('/\\\\evil')).toBeNull();
    expect(safeRedirect('/connexion?next=1')).toBeNull();
    expect(safeRedirect('/panier?id=4')).toBe('/panier?id=4');
    expect(safeRedirect('/')).toBe('/');
  });

  it('remembers only a safe internal page', () => {
    rememberRedirect('/commandes/4');
    expect(sessionStorage.getItem('tokpa_redirect')).toBe('/commandes/4');
    rememberRedirect('https://evil.test');
    expect(sessionStorage.getItem('tokpa_redirect')).toBeNull();
  });

  it('returns to the saved page only when the role may open it', () => {
    sessionStorage.setItem('tokpa_redirect', '/admin/users');
    expect(postLoginTarget('admin')).toBe('/admin/users');
    sessionStorage.setItem('tokpa_redirect', '/admin/users');
    expect(postLoginTarget('client')).toBe('/');
    sessionStorage.setItem('tokpa_redirect', '/livreur/course');
    expect(postLoginTarget('livreur')).toBe('/livreur/course');
  });
});

describe('page roles and route guard', () => {
  beforeEach(() => localStorage.clear());

  it('assigns each space to the expected roles', () => {
    expect(pageRoles('/admin/logs')?.roles).toEqual(['admin', 'super_admin']);
    expect(pageRoles('/manager/stats')?.roles).toEqual(['manager']);
    expect(pageRoles('/livreur')?.roles).toEqual(['livreur']);
    expect(pageRoles('/panier')).toBeNull();
    expect(canAccess('/panier', 'admin')).toBe(true);
    expect(canAccess('/panier', 'manager')).toBe(true);
    expect(canAccess('/profil', null)).toBe(true);
    expect(pageRoles('/inconnue')).toBeNull();
    expect(canAccess('/', null)).toBe(true);
    expect(canAccess('/catalogue', 'livreur')).toBe(true);
    expect(canAccess('/manager', 'admin')).toBe(false);
  });

  it('does nothing on a public page', () => {
    expect(() => guardRoute({ location: { pathname: '/', href: 'http://localhost/' }, preload: false })).not.toThrow();
  });

  it('sends a visitor to login and keeps the requested url', () => {
    expect(() => guardRoute({
      location: { pathname: '/panier', href: 'http://localhost:5173/panier?q=riz' },
      preload: true,
    })).toThrow(expect.objectContaining({
      redirected: expect.objectContaining({ to: '/connexion', search: { redirect: '/panier?q=riz' } }),
    }));
  });

  it('sends a wrong role back to its workspace', () => {
    localStorage.setItem('tokpa_token', 'tok');
    localStorage.setItem('tokpa_user', JSON.stringify({ role: 'client' }));
    expect(() => guardRoute({
      location: { pathname: '/admin', href: 'http://localhost:5173/admin' },
      preload: true,
    })).toThrow(expect.objectContaining({
      redirected: expect.objectContaining({ to: '/' }),
    }));
  });
});
