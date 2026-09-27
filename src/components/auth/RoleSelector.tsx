import clsx from 'clsx';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';
import {
  IconUser,
  IconMotorbike,
  IconLayoutDashboard,
  IconShieldCheck,
  IconBuildingStore,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';

export type RoleId = 'client' | 'livreur' | 'manager' | 'admin' | 'super_admin';

interface Role {
  id: RoleId;
  title: string;
  description: string;
  icon: TablerIcon;
  disabled?: boolean;
}

const ROLES: Role[] = [
  { id: 'client', title: 'Client', description: "J'achète des produits frais du marché", icon: IconUser },
  { id: 'livreur', title: 'Livreur', description: 'Je livre des commandes à moto', icon: IconMotorbike },
  { id: 'manager', title: 'Manager', description: 'Je gère une zone ou des livraisons', icon: IconLayoutDashboard },
  { id: 'admin', title: 'Admin', description: "Gestion globale de la plateforme", icon: IconShieldCheck },
  { id: 'super_admin', title: 'Super Admin', description: 'Administration système & infrastructure', icon: IconBuildingStore },
];

interface RoleSelectorProps {
  value: RoleId;
  onChange: (role: RoleId) => void;
  error?: boolean;
}

/**
 * Panneau « Je suis… » de l'inscription :
 * Cartes rôles (Client, Livreur, Manager, Admin, Super Admin).
 */
export default function RoleSelector({ value, onChange, error }: RoleSelectorProps) {
  useLanguage();
  return (
    <fieldset className="rounded-[12px] bg-primary-lighter p-md">
      <legend className="mb-md px-xs text-[13px] font-medium text-primary-dark">{tx("Je suis…")}</legend>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        {ROLES.map(({ id, title, description, icon: Icon, disabled }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(id)}
              aria-pressed={selected}
              className={clsx(
                'rounded-[10px] border-[1.5px] p-md text-left transition-all duration-150 active:scale-[0.97]',
                selected
                  ? 'border-primary bg-primary-lighter'
                  : 'border-line bg-card hover:border-ink-3',
                disabled && 'cursor-not-allowed border-line bg-surface opacity-80 hover:border-line',
                error && !selected && !disabled && 'border-error/60',
              )}
            >
              <span className="flex items-center gap-sm">
                <span
                  className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]',
                    selected ? 'bg-card text-primary' : 'bg-surface text-ink-2',
                    disabled && 'text-ink-3',
                  )}
                >
                  <Icon size={20} />
                </span>
                <span className={clsx('text-[15px] font-semibold', disabled ? 'text-ink-3' : 'text-ink')}>
                  {tx(title)}
                </span>
              </span>
              <span className={clsx('mt-sm block text-[12px]', disabled ? 'text-ink-3' : 'text-ink-2')}>
                {tx(description)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
