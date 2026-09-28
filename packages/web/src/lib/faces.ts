/**
 * The faces' pure half (Phase J): which colour and which face a row wears, with no art imported, so
 * `seedLink.ts`, a script or a probe can load it under plain Node. `owners.ts` re-exports it and
 * turns a face into a portrait.
 */

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
