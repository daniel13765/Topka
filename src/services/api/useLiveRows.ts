import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { invokeDesign } from '../../utils/designRuntime';
import { unwrap, listOf } from './unwrap';
import { extractApiError, formatApiError } from '../../utils/apiError';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * useLiveRows — charge des données RÉELLES pour les pages design Stitch :
 * remplit les tableaux (copie conforme conservée) sans fausse donnée.
 * Erreurs API verbeuses (phase dev) + états chargement / vide.
 */
export function useLiveRows(fetcher: () => Promise<unknown>, deps: unknown[] = []) {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    setErr(null);
    fetcher()
      .then((r) => setRows(listOf(unwrap(r))))
      .catch((e) => setErr(formatApiError(extractApiError(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetcher()
      .then((r) => alive && setRows(listOf(unwrap(r))))
      .catch((e) => alive && setErr(formatApiError(extractApiError(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { rows, err, loading, reload };
}

/** Nom de zone depuis un objet ZoneResource ou une chaîne (évite le crash « object as React child »). */
export const zoneNom = (z: unknown): string =>
  z && typeof z === 'object' ? String((z as any).nom ?? '—') : String((z as any) ?? '—') || '—';

/** Échappe une valeur pour un handler `data-onclick="fn('…')"` du design. */
export const escArg = (s: unknown): string =>
  String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** Dispatche le `data-onclick` de l'élément courant dans le scope du design. */
export function fireDesign(e: MouseEvent<HTMLElement>): void {
  const el = e.currentTarget;
  const code = el.getAttribute('data-onclick') || '';
  if (!code) return;
  invokeDesign(code, el, e.nativeEvent ?? (e as unknown as Event));
}

/** Initiales (avatar rond du design). */
export const initials = (nom: unknown): string =>
  String(nom ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('') || '—';

/** Date courte honnête depuis un ISO. */
export const dateShort = (s: unknown): string => String(s ?? '').slice(0, 10) || '—';
