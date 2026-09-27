import React, { createContext, useContext, useEffect, useState } from 'react';
import { TRANSLATIONS } from '../constants/translations';

export type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
  isFr: boolean;
  isEn: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'tokpa_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved === 'fr' || saved === 'en') return saved;
    } catch {
      // Fallback si localStorage non disponible
    }
    return 'fr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  // Synchronisation avec l'attribut lang de l'élément html
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  /**
   * Fonction de traduction par clé imbriquée (ex: "nav.market" ou "home.heroTitle")
   */
  const t = (key: string): string => {
    const keys = key.split('.');
    let current: unknown = TRANSLATIONS[language];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        // Fallback en français si la clé anglaise manque
        let fallback: unknown = TRANSLATIONS['fr'];
        for (const fbKey of keys) {
          if (fallback && typeof fallback === 'object' && fbKey in fallback) {
            fallback = (fallback as Record<string, unknown>)[fbKey];
          } else {
            return key; // Si clé introuvable, retourne la clé
          }
        }
        return typeof fallback === 'string' ? fallback : key;
      }
    }

    return typeof current === 'string' ? current : key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        isFr: language === 'fr',
        isEn: language === 'en',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage doit être utilisé à l’intérieur d’un LanguageProvider');
  }
  return context;
};
