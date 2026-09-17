import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations, TranslationKeys } from './i18n';

// ============ LANGUAGE CONTEXT ============
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('ttml-language');
    const validLangs: Language[] = ['ru', 'en', 'es', 'de', 'fr', 'ja', 'zh'];
    if (saved && validLangs.includes(saved as Language)) return saved as Language;
    
    // Auto-detect from browser
    const browserLang = navigator.language.slice(0, 2);
    if (validLangs.includes(browserLang as Language)) return browserLang as Language;
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('ttml-language', language);
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
