import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100',
  };

  return <button className={`${variants[variant]} ${className}`} {...props} />;
}
