import { useLanguage } from '../../context/LanguageContext';
import MIcon from './MIcon';

/** Bascule FR / EN, même comportement que la barre cliente. */
export default function LangToggle({ className = '' }: { className?: string }) {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={language === 'fr' ? 'Switch to English' : 'Passer en Français'}
      className={`flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary transition-transform active:scale-95 ${className}`}
    >
      <MIcon name="language" className="text-[16px]" />
      <span>{language}</span>
    </button>
  );
}
