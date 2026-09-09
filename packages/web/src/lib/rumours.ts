import { planetOf, type GameState } from '@sdr/engine';

/**
 * What they are saying in the Saloon (GDD §9).
 *
 * §9 promises exactly this and the Saloon has never had it: "The whole 13-week price forecast is
 * *not* shown — only the current planet and rumours from the Saloon (\"Kibble's scarce on Rustgut
 * this month\")." That sentence also sets the constraint. A rumour names *one* planet a few weeks
 * out, so the kibble trade has a hint to work from without the trade becoming a spreadsheet.
 *
 * This is content, not a rule, and nothing was added to the engine to support it. A rumour is read
 * off two things the client can already see: `s.calendar`, which is public, and each planet's
 * `foodBand`, which is static data. The band is not the price — arrival rolls inside it, prices
 * drift ±15% a week and an event can double or halve them — so a rumour is a genuine steer and
 * still capable of being wrong, which is what makes it a rumour rather than a forecast.
 *
 * Which rumours are going round is a pure function of (seed, week, planet): the same hash the AI
 * uses for its own coin flips in spirit, written out here because `hash01` is internal to the
 * engine and the engine is closed for v1. No rng is touched — the reducer owns the only one there
 * is, and the Saloon must not move it.
 */

export interface Rumour {
  key: string;
  text: string;
}

/** 0..1 from a handful of values. `^`, `>>>` and `Math.imul` only, so it is exact everywhere. */
function hash01(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x5f356495;
  }
  return ((h >>> 0) % 100000) / 100000;
}

const DEAR = [
  (name: string) => `Kibble's scarce on ${name} this month.`,
  (name: string) => `They're paying through the nose for kibble on ${name}.`,
  (name: string) => `${name}'s stores are down to the sweepings. Bring your own.`,
];

const CHEAP = [
  (name: string) => `Kibble's cheap as dirt on ${name} just now.`,
  (name: string) => `${name} is swimming in the stuff — they can't shift it.`,
  (name: string) => `Somebody over-ordered on ${name}. Kibble's going for a song.`,
];

/** How far ahead the gossip reaches. Four weeks is a hint; thirteen would be the forecast §9 forbids. */
const HORIZON = 4;
/** Bones away from the circuit's average band before it is worth talking about. */
const NOTABLE = 14;
/** Roughly how often a given planet is actually being talked about this week. */
const CHATTER = 0.55;

function bandMid(planetId: string): number {
  const [lo, hi] = planetOf(planetId).foodBand;
  return (lo + hi) / 2;
}

export function rumours(s: GameState): Rumour[] {
  const circuit = s.calendar.map((c) => bandMid(c.planetId));
  if (!circuit.length) return [];
  const average = circuit.reduce((a, b) => a + b, 0) / circuit.length;

  const out: Rumour[] = [];
  for (const entry of s.calendar) {
    if (entry.week <= s.week || entry.week > s.week + HORIZON) continue;
    const delta = bandMid(entry.planetId) - average;
    if (Math.abs(delta) < NOTABLE) continue;
    if (hash01(s.seed, s.week, entry.planetId, 'chatter') > CHATTER) continue;

    const lines = delta > 0 ? DEAR : CHEAP;
    const pick = Math.floor(hash01(s.seed, s.week, entry.planetId, 'line') * lines.length);
    const name = planetOf(entry.planetId).name;
    const away = entry.week - s.week;
    const when =
      away === 1 ? "and you're there next week" : `and you're there in ${away} weeks`;
    out.push({
      key: entry.planetId,
      text: `${lines[Math.min(pick, lines.length - 1)]!(name)} — ${when}.`,
    });
  }
  return out;
}
