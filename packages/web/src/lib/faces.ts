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

/**
 * A stable-name hash for a renamed AI's face (Phase J): FNV-1a over the name's UTF-16 code units, in
 * 32-bit integer arithmetic (`Math.imul`), so it is the same number in every browser. No
 * `Math.random`, no `Date`: a face must be the same on every screen and after a reload.
 */
export function nameHash(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Which of the twelve painted owners each AI stable at the table wears (GDD §14; Phase J), by seat,
 * null for a human. A pure function of the table, so every screen and every reload agree.
 *
 * 1. An AI on the list (`AI_STABLE_NAMES`, which is every AI row the table left blank) wears its own
 *    owner, keyed by name, exactly as before: Baroness Vex is the baroness every season.
 * 2. Then each AI the table renamed, in seat order, starts at `nameHash(name) % 12` and walks to the
 *    next owner nobody at the table wears yet — never the face of an AI on the list, never the face of
 *    an earlier renamed AI. Before Phase J a renamed AI fell back to `colour % 12`, so a human's face
 *    pick that moved its colour also changed its face (the I notes, Read this first 5).
 *
 * A listed name worn twice (two rows typed the same list name) is walked the same way from its own
 * owner. A table has at most eight stables and there are twelve owners, so the walk always ends.
 */
export function aiOwnerIndices(
  table: readonly { kind: 'human' | 'ai'; name: string }[],
  list: readonly string[],
): (number | null)[] {
  const n = list.length;
  const out: (number | null)[] = table.map(() => null);
  const worn = new Set<number>();
  const later: number[] = [];
  table.forEach((p, i) => {
    if (p.kind !== 'ai') return;
    const named = list.indexOf(p.name);
    if (named >= 0 && !worn.has(named)) {
      worn.add(named);
      out[i] = named;
    } else later.push(i);
  });
  for (const i of later) {
    const name = table[i]!.name;
    const named = list.indexOf(name);
    let k = named >= 0 ? named : nameHash(name) % n;
    for (let step = 0; step < n && worn.has(k); step++) k = (k + 1) % n;
    worn.add(k);
    out[i] = k;
  }
  return out;
}
