import { AI_STABLE_NAMES, type Player } from '@sdr/engine';
import { portraitArt, type Art } from './assets';
import { aiOwnerIndices, humanFaceStem } from './faces';

// The pure half (no art imports), so a script or a probe can load it under plain Node (Phase J).
export { HUMAN_FACES, humanFaceStem, resolveColours } from './faces';

/**
 * Which of the twelve painted owners is running this stable (GDD §14).
 *
 * The engine shuffles `AI_STABLE_NAMES` into the season, so the *name* is the stable's
 * identity, not its seat at the table — key the face off the name and Baroness Vex is the
 * baroness every season, in the same order the twelve briefs are written in
 * `scripts/assets.ts`. A stable with a name that is not on the list (a renamed AI) is keyed by a
 * hash of its name, and walks on past any owner already worn at the table (Phase J,
 * `aiOwnerIndices`). Pass the table: without it a renamed AI still gets its hashed face, but cannot
 * see who else is wearing it.
 *
 * Display only. GDD §14 also says a personality "flavours its event choices" — that is an
 * engine change and it belongs to M4. What is shown here is `Player.personality`, which the
 * engine has already been assigning since M0; nothing about it is invented in packages/web.
 */
export function ownerIndexFor(player: Player, table: readonly Player[] = [player]): number | null {
  if (player.kind !== 'ai') return null;
  let seat = table.findIndex((p) => p.id === player.id);
  const seats = seat >= 0 ? table : [...table, player];
  if (seat < 0) seat = seats.length - 1;
  return aiOwnerIndices(seats, AI_STABLE_NAMES)[seat] ?? null;
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

export function ownerArtFor(player: Player, table?: readonly Player[]): Art | null {
  const human = humanFaceFor(player);
  if (human) return portraitArt(human);
  const i = ownerIndexFor(player, table);
  if (i === null) return null;
  return portraitArt(`owner-${String(i + 1).padStart(2, '0')}`);
}

/** "Baroness Vex never borrows" — GDD §14's own example, straight out of the state. */
export function ownerLine(player: Player): string | null {
  if (player.kind !== 'ai' || !player.personality) return null;
  return `${player.name} ${player.personality}`;
}
