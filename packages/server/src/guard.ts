/**
 * **What the room lets in from the public internet** (`v3l4`, ONLINE_PLAN §2.1): which pages may open
 * a room, and how big a message may be. Kept apart from `room.ts` and the engine, so the routing
 * Worker stays thin and `server:test` can run it under Node.
 *
 * An `Origin` check stops another website from using its visitors' browsers to make rooms or sit in
 * them; it does not stop a script that sets its own `Origin`, and nothing here pretends to. The room's
 * own checks (`refuseAct`, the engine) are what keep a game honest.
 */

/** A frame bigger than this is refused unread. The largest real `act` is far under it (L4 notes). */
export const MAX_FRAME_BYTES = 16 * 1024;
/** An `act` with more actions than this is refused (`refuseAct`). */
export const MAX_ACTIONS = 64;

/** `ALLOWED_ORIGINS`, comma-separated, as a list. Blank entries are dropped. */
export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** One pattern: exact, or `https://*.example.com` for exactly one label in front of the rest. */
function matches(origin: string, pattern: string): boolean {
  if (!pattern.includes('*')) return origin === pattern;
  const m = /^(https?:\/\/)\*\.(.+)$/.exec(pattern);
  if (!m) return false;
  const [, scheme, rest] = m;
  if (!origin.startsWith(scheme!) || !origin.endsWith(`.${rest!}`)) return false;
  const label = origin.slice(scheme!.length, origin.length - rest!.length - 1);
  return /^[a-z0-9-]+$/.test(label);
}

/**
 * May a request with this `Origin` make a room or open a socket?
 *
 * - Served on a local host (`wrangler dev`), any `localhost` / `127.0.0.1` page may, and so may a
 *   client that sends no `Origin` at all (the headless walks). Only a Worker running on a developer's
 *   own machine is ever reached at a local host, so this can never open the live room.
 * - Anywhere else, the `Origin` must be on the list. A request with no `Origin` is refused: every
 *   browser sends one on a WebSocket and on a cross-origin `POST`.
 */
export function originAllowed(
  origin: string | null,
  requestUrl: string,
  allowed: readonly string[],
): boolean {
  let local = false;
  try {
    local = LOCAL_HOST.test(new URL(requestUrl).hostname);
  } catch {
    local = false;
  }
  const o = (origin ?? '').trim().toLowerCase();
  if (local && (o === '' || LOCAL_ORIGIN.test(o))) return true;
  if (!o || o === 'null') return false;
  return allowed.some((p) => matches(o, p));
}

/** Is this frame over `MAX_FRAME_BYTES` of UTF-8? A short frame is not encoded to find out. */
export function frameTooBig(data: string | ArrayBuffer): boolean {
  if (typeof data !== 'string') return data.byteLength > MAX_FRAME_BYTES;
  // A UTF-16 unit is at least 1 byte of UTF-8 and at most 3.
  if (data.length > MAX_FRAME_BYTES) return true;
  if (data.length * 3 <= MAX_FRAME_BYTES) return false;
  return new TextEncoder().encode(data).byteLength > MAX_FRAME_BYTES;
}

/**
 * The `seq` of a frame too big to read, found without parsing it, so the client's request is still
 * answered: a `"seq":` in the frame's first 64 characters (the walks put it first) or closing it (the
 * web's store puts it last).
 */
export function seqOf(data: string | ArrayBuffer): number | undefined {
  if (typeof data !== 'string') return undefined;
  const m =
    /"seq"\s*:\s*(\d{1,9})/.exec(data.slice(0, 64)) ??
    /"seq"\s*:\s*(\d{1,9})\s*\}\s*$/.exec(data.slice(-40));
  return m ? Number(m[1]) : undefined;
}
