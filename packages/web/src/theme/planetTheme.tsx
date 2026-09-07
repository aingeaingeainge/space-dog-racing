import type { CSSProperties, ReactNode } from 'react';
import { planetOf, type Id } from '@sdr/engine';

/** The house colours: acid green and cyan, used before a season starts and if a planet is unknown. */
export const HOUSE_ACCENTS: [string, string] = ['#9BE84B', '#3FD6E0'];

/**
 * A planet's two accent hues (GDD §16: "each planet overrides two accent hues"). They are
 * already in the engine's planet data, so a planet tints the whole game without a line of
 * content being written twice — this is a data read, not new content.
 */
export function accentsFor(planetId: Id | null | undefined): [string, string] {
  if (!planetId) return HOUSE_ACCENTS;
  try {
    return planetOf(planetId).accents ?? HOUSE_ACCENTS;
  } catch {
    return HOUSE_ACCENTS;
  }
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** Perceived brightness, the same weighting the race view uses to ink a saddle cloth. */
function luma([r, g, b]: [number, number, number]): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Ink that stays readable on a solid fill of this colour. */
function inkOn(hex: string): string {
  return luma(rgb(hex)) > 140 ? '#0c0b11' : '#f2f0f6';
}

/**
 * A version of the accent that can be read as text on charcoal. Dark accents (Hushmarket's
 * maroon, Blackreach's near-black) are lifted towards white until they clear the bar; light
 * ones are left alone. Nothing here changes the accent itself — the chrome still uses the
 * real hue for fills, rules and glows.
 */
function textOn(hex: string): string {
  const c = rgb(hex);
  const target = 150;
  const l = luma(c);
  if (l >= target) return hex;
  const k = Math.min(0.82, (target - l) / (255 - l));
  return `#${c.map((v) => hex2(v + (246 - v) * k)).join('')}`;
}

/**
 * Wraps the app in the current planet's colours. Everything inside reads --accent-1 and
 * --accent-2, so no screen ever knows which rock it is standing on: put a new planet in the
 * data and its hub, buttons, panel headers and signpost tint themselves.
 */
export function PlanetTheme({
  planetId,
  children,
}: {
  planetId?: Id | null;
  children: ReactNode;
}) {
  const [a1, a2] = accentsFor(planetId);
  const style = {
    '--accent-1': a1,
    '--accent-2': a2,
    '--accent-1-text': textOn(a1),
    '--accent-2-text': textOn(a2),
    '--accent-1-ink': inkOn(a1),
    '--accent-2-ink': inkOn(a2),
  } as CSSProperties;
  return (
    <div className="planet-theme" style={style}>
      {children}
    </div>
  );
}
