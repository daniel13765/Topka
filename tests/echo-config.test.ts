import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('laravel-echo', () => ({ default: class Echo {} }));
vi.mock('pusher-js', () => ({ default: class Pusher {} }));

import { getApiOrigin, getReverbConfig, initEcho, shutdownEcho } from '../src/services/realtime/echo';

describe('realtime configuration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('window', {});
    shutdownEcho();
  });

  it('strips the /api suffix from the API origin', () => {
    expect(getApiOrigin().endsWith('/api')).toBe(false);
    expect(getApiOrigin()).toContain('localhost:8000');
  });

  it('uses the local Reverb defaults', () => {
    expect(getReverbConfig()).toMatchObject({
      host: 'localhost',
      port: 8080,
      scheme: 'ws',
      key: 'tokpa-key',
      appId: 'tokpa',
    });
  });

  it('purges the legacy demo token and does not connect without a session', () => {
    localStorage.setItem('tokpa_token', 'demo_token_sanctum_123');
    localStorage.setItem('tokpa_user', '{}');
    expect(initEcho()).toBeNull();
    expect(localStorage.getItem('tokpa_token')).toBeNull();
    expect(localStorage.getItem('tokpa_user')).toBeNull();
  });
});
