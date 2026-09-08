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

export function ownerArtFor(player: Player): Art | null {
  const i = ownerIndexFor(player);
  if (i === null) return null;
  return portraitArt(`owner-${String(i + 1).padStart(2, '0')}`);
}

/** "Baroness Vex never borrows" — GDD §14's own example, straight out of the state. */
export function ownerLine(player: Player): string | null {
  if (player.kind !== 'ai' || !player.personality) return null;
  return `${player.name} ${player.personality}`;
}
