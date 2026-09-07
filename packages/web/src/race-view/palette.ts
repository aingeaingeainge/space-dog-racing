import type { Id } from '@sdr/engine';
import { accentsFor } from '../theme/planetTheme';

/**
 * The colours the race view paints a track in. GDD §16 gives every planet two accent hues and
 * M3 repaints the track with them — the geometry in tracks.ts does not move, only the paint.
 * Session 2 drops the ground scenery and the surface tile on top of these; until then this is
 * what makes Glassfall's ice read differently from Rustgut's orange dust.
 */
export interface RacePalette {
  /** Behind everything. */
  ground: string;
  /** The running surface. */
  surface: string;
  /** The rail the dogs hug. */
  rail: string;
  /** Start line and distance boards. */
  line: string;
  /** The hare. */
  lure: string;
}

export const DEFAULT_RACE_PALETTE: RacePalette = {
  ground: '#16151d',
  surface: '#3a2b21',
  rail: 'rgba(244, 197, 66, 0.16)',
  line: 'rgba(155, 232, 75, 0.5)',
  lure: '#3fd6e0',
};

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** `k` of `a` over `b`. Exact arithmetic only — this is presentation, but cheap is cheap. */
function mix(a: string, b: string, k: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => hex2(y[i]! + (v - y[i]!) * k)).join('')}`;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A planet's track colours, from its accents alone. The surface stays mostly soot-brown with
 * a wash of the first accent, because eight saddle cloths have to read against it; the ground
 * takes the second accent, which is where the planet's mood actually lands.
 */
export function paletteFor(planetId: Id): RacePalette {
  const [a1, a2] = accentsFor(planetId);
  return {
    ground: mix(a2, '#111019', 0.16),
    surface: mix(a1, '#2b2019', 0.2),
    rail: rgba(a1, 0.2),
    line: rgba(a1, 0.55),
    lure: a2,
  };
}
