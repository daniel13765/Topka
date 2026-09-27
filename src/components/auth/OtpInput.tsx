import { useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import clsx from 'clsx';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  /** État erreur : bordures rouges (maquette 2FA « Code incorrect ») */
  error?: boolean;
  disabled?: boolean;
}

/**
 * Saisie de code à 6 chiffres — maquette Stitch 2FA :
 * cases 48×56px, bordure 1.5px, chiffre 24px bold,
 * focus bleu (info), état erreur rouge, auto-avance + retour arrière + collage.
 */
export default function OtpInput({ value, onChange, length = 6, error, disabled }: OtpInputProps) {
  useLanguage();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setDigit(index, digit);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      setDigit(index - 1, '');
      e.preventDefault();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-xs sm:gap-sm" role="group" aria-label={tx("Code de vérification")}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          aria-label={`Chiffre ${i + 1}`}
          className={clsx(
            'h-14 w-12 rounded-lg border-[1.5px] bg-card text-center text-[24px] font-bold text-ink',
            'outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-error' : 'border-line',
            'focus:border-info focus:border-[2px]',
          )}
        />
      ))}
    </div>
  );
}
