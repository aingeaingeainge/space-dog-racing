import { AI_STABLE_NAMES, type Player } from '@sdr/engine';
import { portraitArt, type Art } from './assets';

/**
 * Which of the twelve painted owners is running this stable (GDD §14).
 *
 * The engine shuffles `AI_STABLE_NAMES` into the season, so the *name* is the stable's
 * identity, not its seat at the table — key the face off the name and Baroness Vex is the
 * baroness every season, in the same order the twelve briefs are written in
 * `scripts/assets.ts`. A stable with a name that is not on the list (a renamed AI) falls back
 * to its saddle-cloth colour, so it still gets a face rather than a hole.
 *
 * Display only. GDD §14 also says a personality "flavours its event choices" — that is an
 * engine change and it belongs to M4. What is shown here is `Player.personality`, which the
 * engine has already been assigning since M0; nothing about it is invented in packages/web.
 */
export function ownerIndexFor(player: Player): number | null {
  if (player.kind !== 'ai') return null;
  const named = AI_STABLE_NAMES.indexOf(player.name);
  return named >= 0 ? named : player.colour % AI_STABLE_NAMES.length;
}

/**
 * A human stable's face (Phase F1): one of eight, keyed by its saddle-cloth colour, so the face and
 * the swatch beside it always agree. Display only — nothing in the engine or the setup knows about it,
 * and a human still has no personality line.
 */
export function humanFaceFor(player: Player): string | null {
  if (player.kind !== 'human') return null;
  return humanFaceStem(player.colour);
}

/** The portrait stem for a human face, from a saddle-cloth colour: 0 → `human-01`. */
export function humanFaceStem(colour: number): string {
  return `human-${String((colour % 8) + 1).padStart(2, '0')}`;
}

/**
 * The eight human faces as the Title's picker names them (Phase I), in `STABLE_COLOURS` order, so
 * index = colour. The words are a short form of the `human-01`…`08` briefs in `scripts/assets.ts`,
 * and they are the picker's accessible names ("Red — goggled pilot").
 */
export const HUMAN_FACES: readonly { colour: string; who: string }[] = [
  { colour: 'Red', who: 'goggled pilot' },
  { colour: 'Blue', who: 'grinning antennaed alien' },
  { colour: 'White', who: 'old spaceport captain' },
  { colour: 'Black', who: 'studded punk' },
  { colour: 'Orange', who: 'cheerful lizard' },
  { colour: 'Green', who: 'young hotshot' },
  { colour: 'Yellow', who: 'one-eyed alien' },
  { colour: 'Pink', who: 'glamorous old hand' },
];

/**
 * Every row's saddle-cloth colour, as the Title passes it to `createSeason` (Phase I).
 *
 * A human who picked a face holds that colour first, whatever seat they are in. A human who never
 * opened the picker comes next, on their seat index, and then the AI rows take theirs; a clash is
 * bumped to the next free colour, the same walk `createSeason` makes. So a table nobody touches gets
 * colour = seat index, exactly as before; a human's face moves only when another human picks it; and
 * a human's pick beats an AI's seat colour instead of the other way round. `createSeason`'s own
 * de-dup is left as it is, and never fires on a list this returns, because it has no clash.
 *
 * A row's `colour` is its pick, or undefined. Only a human row's pick counts; an AI's is ignored.
 */
export function resolveColours(
  rows: readonly { kind: 'human' | 'ai'; colour?: number }[],
): number[] {
  const out: number[] = rows.map(() => -1);
  const used = new Set<number>();
  const take = (i: number) => {
    let c = i % 8;
    while (used.has(c)) c = (c + 1) % 8;
    used.add(c);
    out[i] = c;
  };
  rows.forEach((r, i) => {
    if (r.kind === 'human' && r.colour !== undefined && !used.has(r.colour)) {
      used.add(r.colour);
      out[i] = r.colour;
    }
  });
  rows.forEach((r, i) => {
    if (r.kind === 'human' && out[i] === -1) take(i);
  });
  rows.forEach((r, i) => {
    if (out[i] === -1) take(i);
  });
  return out;
}

export function ownerArtFor(player: Player): Art | null {
  const human = humanFaceFor(player);
  if (human) return portraitArt(human);
  const i = ownerIndexFor(player);
  if (i === null) return null;
  return portraitArt(`owner-${String(i + 1).padStart(2, '0')}`);
}

/** "Baroness Vex never borrows" — GDD §14's own example, straight out of the state. */
export function ownerLine(player: Player): string | null {
  if (player.kind !== 'ai' || !player.personality) return null;
  return `${player.name} ${player.personality}`;
}
