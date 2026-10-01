/**
 * The Worker "sdr-rooms" (ONLINE_PLAN §2.1). **It only routes**: `POST /room` draws a code and has
 * that room claim it; `GET /room/:code` hands a WebSocket upgrade to the room. The engine runs only
 * inside `Room`: a free-plan Worker has 10 ms of CPU a request, a Durable Object 30 s.
 *
 * ⚠️ A Durable Object class is exported by the Worker script that hosts it, so `Room` (and through it
 * the engine) is in this bundle. The routing below never calls into it: it never replays, reduces or
 * builds a view.
 *
 * *`v3l4`, live:* only the pages in `ALLOWED_ORIGINS` (`wrangler.jsonc`'s `vars`) may make a room or
 * open a socket (`guard.ts`), and CORS names the page that asked, never `*`.
 */
import { CODE_RE, codeFrom } from './code';
import { originAllowed, parseOrigins } from './guard';
import type { Env } from './room';

export { Room } from './room';

/** CORS for an allowed page: its own origin, echoed. */
function corsFor(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (!originAllowed(origin, request.url, parseOrigins(env.ALLOWED_ORIGINS)))
      return json({ error: 'This page may not open a room' }, 403, { Vary: 'Origin' });
    const CORS = corsFor(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (request.method === 'POST' && url.pathname === '/room') {
      // Draw a code; a room that already has state says 409 and another is drawn.
      for (let tries = 0; tries < 8; tries++) {
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        const code = codeFrom(bytes);
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const r = await stub.fetch('https://room/create', {
          method: 'POST',
          headers: { 'x-room-code': code },
        });
        if (r.status === 201) return json({ code }, 201, CORS);
      }
      return json({ error: 'No free room code: try again' }, 503, CORS);
    }

    const m = /^\/room\/([A-Za-z]{6})$/.exec(url.pathname);
    if (request.method === 'GET' && m) {
      const code = m[1]!.toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: 'No such room' }, 404, CORS);
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
        return json({ error: 'Expected a WebSocket' }, 426, CORS);
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
    }

    return json({ error: 'Not found' }, 404, CORS);
  },
} satisfies ExportedHandler<Env>;
