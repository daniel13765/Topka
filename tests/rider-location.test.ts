import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { distanceHaversineKm, minutesEstimees } from '../src/hooks/useRiderLocation';

/**
 * Le suivi de course n'a plus aucun mode démonstration : ces tests verrouillent à la fois le calcul
 * (seule source des chiffres affichés) et l'absence de toute position inventée dans le code livré.
 */
describe('calcul de position et d’ETA', () => {
  const dantokpa: [number, number] = [6.3725, 2.4332];
  const cadjehoun: [number, number] = [6.362, 2.41];

  it('mesure la distance entre deux points réels de Cotonou', () => {
    const km = distanceHaversineKm(dantokpa, cadjehoun);
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(4);
  });

  it('est nulle entre un point et lui-même', () => {
    expect(distanceHaversineKm(dantokpa, dantokpa)).toBeCloseTo(0, 6);
  });

  it('convertit la distance en minutes à ~25 km/h, sans jamais descendre sous 1', () => {
    expect(minutesEstimees(12.5)).toBe(30);
    expect(minutesEstimees(0.1)).toBe(1);
    expect(minutesEstimees(0)).toBe(1);
  });

  it('reste muet sans distance exploitable', () => {
    expect(minutesEstimees(null)).toBeNull();
    expect(minutesEstimees(Number.NaN)).toBeNull();
    expect(minutesEstimees(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('aucun mode démonstration dans le suivi', () => {
  const source = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

  it('le hook ne connaît plus ni tracé fictif ni cadence de simulation', () => {
    const code = source('../src/hooks/useRiderLocation.ts');
    expect(code).not.toMatch(/simulation|simu|COTONOU_PATH|simulatedSpeedMs|allowSimulation/i);
    expect(code).not.toMatch(/setInterval/);
    // une seule position de replier : celle du marché, et elle n'est jamais posée sur la carte sans course
    expect(code).not.toMatch(/RIDER_COORDS|CLIENT_COORDS/);
  });

  it('la page de suivi ne lit plus le paramètre d’URL `simu`', () => {
    const code = source('../src/pages/client/commandes/OrderTrackingPage.tsx');
    expect(code).not.toMatch(/allowSimulation|simulatedSpeedMs|search\.simu/);
    // `?simu=1` n'est plus reconnu : le validateSearch de la route n'expose que `order`
    expect(code).toMatch(/useSearch\(\{ from: '\/commandes\/suivi' \}\)/);
  });
});
