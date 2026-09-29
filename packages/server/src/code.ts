/**
 * Room codes (ONLINE_PLAN §2.1), kept apart from `game.ts` so the routing Worker imports no engine.
 */

/** Six letters, no look-alikes (§2.1): no I, L or O. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/** A room code from six random bytes. The bias of `% 23` over a byte is harmless for a room code. */
export function codeFrom(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}
