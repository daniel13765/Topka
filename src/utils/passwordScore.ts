/** Score 0–4 du mot de passe d'inscription (longueur, chiffre, majuscule, symbole ou 12 caractères). */
export function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score += 1;
  return score;
}
