import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dateShort, escArg, initials, zoneNom } from '../src/services/api/useLiveRows';
import { dateCourte, fmtFcfa, heureCourte, listOf, metaOf } from '../src/services/api/unwrap';
import { alertApiError, apiErrorStatus } from '../src/utils/apiError';
import { describeNotification, formatTime } from '../src/utils/notificationText';
import { categoryKind } from '../src/utils/categoryKind';
import { absImageUrl } from '../src/utils/imageUrl';
import { emitRealtimeRefresh, subscribeRealtimeRefresh } from '../src/hooks/useRealtimeNotifications';
import { searchPlaces } from '../src/services/api/geocode';
import { isOwnOrder } from '../src/utils/ownOrder';
import { ordersApi } from '../src/services/api/orders';
import { TRANSLATIONS } from '../src/constants/translations';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
vi.mock('../src/services/api/orders', () => ({ ordersApi: { getOrders: vi.fn() } }));

describe('table helpers', () => {
  it('reads a zone name from an object or a string', () => {
    expect(zoneNom({ nom: 'Akpakpa' })).toBe('Akpakpa');
    expect(zoneNom('Fidjrossè')).toBe('Fidjrossè');
    expect(zoneNom(null)).toBe('—');
  });

  it('escapes quotes for design handlers', () => {
    expect(escArg("d'Akpakpa")).toBe("d\\'Akpakpa");
    expect(escArg(null)).toBe('');
  });

  it('builds initials and a short date', () => {
    expect(initials('jean kouassi')).toBe('JK');
    expect(initials('')).toBe('—');
    expect(dateShort('2026-09-26T10:00:00Z')).toBe('2026-09-26');
    expect(dateShort(null)).toBe('—');
  });
});

describe('money and dates', () => {
  it('rejects a missing amount', () => {
    expect(fmtFcfa(null)).toBe('—');
    expect(fmtFcfa('nope')).toBe('—');
  });

  it('returns an empty string for a missing date and the raw text if it is not a date', () => {
    expect(heureCourte(null)).toBe('');
    expect(dateCourte('')).toBe('');
    expect(heureCourte('pas-une-date')).toBe('pas-une-date');
  });

  it('reads pagination from the body itself', () => {
    expect(metaOf({ current_page: 3, total: 40 })).toEqual({ page: 3, total: 40 });
    expect(metaOf({ data: [] })).toBeNull();
    expect(listOf(null)).toEqual([]);
  });
});

describe('alerts and notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not toast a 401, but returns the text', async () => {
    const toast = (await import('react-hot-toast')).default;
    const text = alertApiError({ response: { status: 401, data: { message: 'Unauthenticated.' } } }, 'session');
    expect(text).toContain('[HTTP 401]');
    expect(toast.error).not.toHaveBeenCalled();
    expect(apiErrorStatus({ message: 'timeout' })).toBeNull();
  });

  it('toasts other failures once', async () => {
    const toast = (await import('react-hot-toast')).default;
    alertApiError({ response: { status: 500, data: { message: 'SQL' } } }, 'load');
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('[HTTP 500]'), { id: 'load' });
  });

  it('describes payment, delivery and English status', () => {
    const paid = describeNotification({ type: 'payment.confirmed', data: { order_id: 5 } } as never, false);
    expect(paid.title).toContain('Payment');
    expect(paid.orderId).toBe(5);
    const assigned = describeNotification({ type: 'delivery.assigned', data: { order_id: 6 } } as never, true);
    expect(assigned.message).toContain('#6');
    const refused = describeNotification({ type: 'budget.response', data: { order_id: 1, statut: 'refuse' } } as never, true);
    expect(refused.orderId).toBeUndefined();
    const waiting = describeNotification({ type: 'order.status', data: { order_id: 2, statut: 'en_attente' } } as never, false);
    expect(waiting.message).toContain('pending confirmation');
  });

  it('returns a dash for a bad notification time', () => {
    expect(formatTime('pas-une-date', true)).toBe('—');
  });
});

describe('catalog edges', () => {
  it('classifies an unknown category as other and prefixes a relative image', () => {
    expect(categoryKind({ slug: 'divers' })).toBe('other');
    expect(categoryKind(null)).toBe('other');
    expect(absImageUrl('storage/a.jpg')).toMatch(/\/storage\/a\.jpg$/);
    expect(absImageUrl('')).toBeNull();
  });
});

describe('realtime refresh bus', () => {
  it('delivers only the subscribed scopes', () => {
    vi.stubGlobal('window', new EventTarget());
    const seen: string[] = [];
    const stop = subscribeRealtimeRefresh(['orders'], (event) => seen.push(event.scope));
    emitRealtimeRefresh({ scope: 'notifications' });
    emitRealtimeRefresh({ scope: 'orders' });
    stop();
    emitRealtimeRefresh({ scope: 'orders' });
    expect(seen).toEqual(['orders']);
  });
});

describe('place search', () => {
  it('maps Nominatim rows and drops invalid coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: 'Dantokpa, Cotonou', lat: '6.37', lon: '2.43' },
        { display_name: 'Inconnu', lat: 'x', lon: '2' },
      ],
    }));
    await expect(searchPlaces('dantokpa')).resolves.toEqual([
      { nom: 'Dantokpa', detail: 'Dantokpa, Cotonou', lat: 6.37, lng: 2.43 },
    ]);
  });

  it('throws when the geocoder is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(searchPlaces('cotonou')).rejects.toThrow('HTTP 503');
  });
});

describe('own-order check', () => {
  beforeEach(() => vi.clearAllMocks());

  it('finds the order on a later page and stops at the last page', async () => {
    vi.mocked(ordersApi.getOrders)
      .mockResolvedValueOnce({ data: [{ id: 1 }], meta: { last_page: 2 } })
      .mockResolvedValueOnce({ data: [{ data: { id: 8 } }], meta: { last_page: 2 } });
    await expect(isOwnOrder(8)).resolves.toBe(true);
    expect(ordersApi.getOrders).toHaveBeenCalledTimes(2);
  });

  it('refuses an id that never appears', async () => {
    vi.mocked(ordersApi.getOrders).mockResolvedValue({ data: [{ id: 1 }], meta: { last_page: 1 } });
    await expect(isOwnOrder(99)).resolves.toBe(false);
  });
});

describe('translation catalogues', () => {
  function keys(value: unknown, prefix = ''): string[] {
    if (!value || typeof value !== 'object') return [prefix];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      keys(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  it('keeps French and English keys aligned', () => {
    expect(keys(TRANSLATIONS.en).sort()).toEqual(keys(TRANSLATIONS.fr).sort());
  });
});
