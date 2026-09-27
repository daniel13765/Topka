/**
 * Résout une image produit renvoyée par l'API :
 * - URL absolue (Cloudinary) → telle quelle ;
 * - chemin relatif `/storage/uploads/…` (fallback local du backend) → préfixé de l'origine API
 *   (ex. http://localhost:8000/storage/…), car le front n'est pas servi par le même hôte.
 * `null`/vide → null (l'appelant gère le placeholder).
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

export function absImageUrl(u?: string | null): string | null {
  if (!u) return null;
  if (/^https?:/i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}
