import { describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

import { extractApiError, formatApiError } from '../src/utils/apiError';

describe('API error handling', () => {
  it('extracts Laravel validation errors', () => {
    const info = extractApiError({ response: { status: 422, data: { message: 'Validation failed', errors: { email: ['Email invalide'] } } } });
    expect(info.status).toBe(422);
    expect(formatApiError(info)).toContain('email : Email invalide');
  });
  it('adds CSRF context to 419 errors', () => expect(extractApiError({ response: { status: 419, data: {} } }).message).toContain('CSRF'));
  it('recognizes network failures', () => expect(formatApiError(extractApiError({ message: 'Network Error' }))).toContain('[Réseau]'));
});
