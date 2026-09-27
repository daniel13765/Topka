import { useLanguage } from '../context/LanguageContext';
import { EN } from './phrases';

/** Langue active, lue au moment de l'affichage (le stockage est mis à jour avant le rendu). */
export function uiLang(): 'fr' | 'en' {
  try {
    const saved = localStorage.getItem('tokpa_lang');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    // localStorage indisponible (tests, SSR)
  }
  return 'fr';
}

/** Traduit une phrase française connue. Inconnue : laissée telle quelle (noms, données API). */
export function tx(fr: string): string {
  if (!fr || uiLang() !== 'en') return fr;
  return EN[fr] ?? fr;
}

/** Paire explicite, pour les phrases construites (prix, numéros). */
export function tr(fr: string, en: string): string {
  return uiLang() === 'en' ? en : fr;
}

/** Abonne le composant au changement de langue, puis traduit. */
export function useTx(): (fr: string) => string {
  const { language } = useLanguage();
  return (fr: string) => (language === 'en' ? EN[fr] ?? fr : fr);
}
