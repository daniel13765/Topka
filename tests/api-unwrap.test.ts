import { describe, expect, it } from 'vitest';
import { fmtFcfa, listOf, metaOf, unwrap } from '../src/services/api/unwrap';

describe('API response helpers', () => {
  it('unwraps a standard envelope', () => expect(unwrap({ data: { success: true, data: { id: 4 } } })).toEqual({ id: 4 }));
  it('keeps a raw resource', () => expect(unwrap({ id: 4 })).toEqual({ id: 4 }));
  it('extracts lists from arrays and paginators', () => {
    expect(listOf([1, 2])).toEqual([1, 2]);
    expect(listOf({ data: [3] })).toEqual([3]);
  });
  it('extracts pagination metadata', () => expect(metaOf({ meta: { current_page: 2, total: 25 } })).toEqual({ page: 2, total: 25 }));
  it('formats XOF safely', () => expect(fmtFcfa(12500)).toContain('12 500'));
});
