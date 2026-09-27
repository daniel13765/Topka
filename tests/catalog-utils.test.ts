import { describe, expect, it } from 'vitest';
import { categoryKind } from '../src/utils/categoryKind';
import { absImageUrl } from '../src/utils/imageUrl';

describe('catalog utilities', () => {
  it.each([
    [{ nom: 'Poissons frais' }, 'fish'],
    [{ nom: 'Riz local' }, 'grain'],
    [{ nom: 'Piment rouge' }, 'spice'],
    [{ nom: 'Pack familial' }, 'pack'],
    [{ nom: 'Légumes frais' }, 'vegetable'],
  ])('classifies %o as %s', (category, expected) => expect(categoryKind(category)).toBe(expected));
  it('keeps absolute image URLs', () => expect(absImageUrl('https://cdn.test/a.jpg')).toBe('https://cdn.test/a.jpg'));
  it('resolves relative image paths against the API origin', () => expect(absImageUrl('/storage/a.jpg')).toContain('/storage/a.jpg'));
  it('returns null for missing images', () => expect(absImageUrl(null)).toBeNull());
});
