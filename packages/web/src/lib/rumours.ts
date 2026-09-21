import { good, planetOf, type GameState } from '@sdr/engine';
import { mostNotable } from './market';

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
 *
 * ⚠️ A rumour names a planet the fog is hiding, and that is deliberate: §9.3 lists the Saloon as
 * the free carrier in the information economy, reaching 1–2 weeks and *able to be wrong*.
 *
 * ⚠️ **v3 Phase B: a rumour is about one food now, not "the" food.** `foodBand` became a per-good
 * map (GDD_V3 §12), so a planet is not simply cheap or dear — it is cheap for Scrapmeat, or dear
 * for Ambrosia. The rumour names the one good the planet is most notable for (`mostNotable`), which
 * is still a steer rather than a forecast: the week's draw can land anywhere in the band.
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
  (name: string, food: string) => `${food}'s scarce on ${name} this month.`,
  (name: string, food: string) => `They're paying through the nose for ${food} on ${name}.`,
  (name: string, food: string) =>
    `${name}'s out of ${food}. Bring your own, or bring some to sell.`,
];

const CHEAP = [
  (name: string, food: string) => `${food}'s cheap as dirt on ${name} just now.`,
  (name: string, food: string) => `${name} is swimming in ${food} — they can't shift it.`,
  (name: string, food: string) => `Somebody over-ordered on ${name}. ${food}'s going for a song.`,
];

/**
 * How far ahead the gossip reaches (GDD §9.3).
 *
 * ⚠️ **Re-tuned for the fog.** Four weeks was written when the Galaxy Map printed every planet's
 * band for the whole season, so a rumour was near-redundant — it hinted at something already in a
 * table. With the map dark, a rumour is the *only* free look past next week, and four weeks of
 * them would hand back most of what D5 just took away. Two weeks is §9.3's own "1–2 weeks", it
 * leaves the dossier something to sell, and it makes the Saloon worth the walk for the first time.
 */
const HORIZON = 2;
/**
 * Roughly how often a given planet is actually being talked about this week. Raised for the same
 * reason — a rumour you get one week in three is a curiosity; the fog needs it to be a habit.
 */
const CHATTER = 0.75;

export function rumours(s: GameState): Rumour[] {
  const out: Rumour[] = [];
  for (const entry of s.calendar) {
    if (entry.week <= s.week || entry.week > s.week + HORIZON) continue;
    const notable = mostNotable(planetOf(entry.planetId));
    if (!notable) continue;
    if (hash01(s.seed, s.week, entry.planetId, 'chatter') > CHATTER) continue;

    const lines = notable.cheap ? CHEAP : DEAR;
    const pick = Math.floor(hash01(s.seed, s.week, entry.planetId, 'line') * lines.length);
    const name = planetOf(entry.planetId).name;
    const food = good(notable.id).label;
    const away = entry.week - s.week;
    const when = away === 1 ? "and you're there next week" : `and you're there in ${away} weeks`;
    out.push({
      key: entry.planetId,
      text: `${lines[Math.min(pick, lines.length - 1)]!(name, food)} — ${when}.`,
    });
  }
  return out;
}
