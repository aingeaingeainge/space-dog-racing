/**
 * **The browser's end of a room** (ONLINE_PLAN §2.4–§2.6, §6 items 2 and 7). Everything here is for
 * online play only: a hotseat game never opens a socket, and a build without `VITE_ROOMS_URL` never
 * shows the way in.
 *
 * - The rooms URL is a build variable; the socket's URL is derived from it (`http` → `ws`).
 * - One connection per room, through `partysocket`'s reconnecting WebSocket. Every (re)connect sends
 *   `hello` (the store does, from `onOpen`), with the seat token when this browser has one.
 * - The token, and this browser's own "already watched / already read" marks for the room, live in
 *   `localStorage` under the room's code — **never the hotseat save's key** — wrapped in try/catch: a
 *   browser without storage can still play; it just cannot rejoin after a refresh.
 *
 * The wire's types are the server's own file, imported **type-only** by relative path: nothing from
 * `packages/server` reaches the bundle, and `packages/server` stays out of the root's workspaces.
 */
import ReconnectingWebSocket from 'partysocket/ws';
import type { ClientMsg, RoomMsg } from '../../../server/src/protocol';

export type { ClientMsg, RoomMsg };
export type {
  LobbySeat,
  LobbyStateMsg,
  RoomMeta,
  StaleRoom,
  ViewMsg,
} from '../../../server/src/protocol';

// ── Config (§6 item 7) ───────────────────────────────────────────────────────────────────────────

/** `VITE_ROOMS_URL`, without a trailing slash, or null: then the Title has no "Play online". */
export function roomsUrl(): string | null {
  let raw: string | undefined;
  try {
    raw = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ROOMS_URL;
  } catch {
    raw = undefined;
  }
  const url = (raw ?? '').trim().replace(/\/+$/, '');
  return url || null;
}

/** The room's WebSocket: `http://host` → `ws://host/room/CODE`, `https` → `wss`. */
export function socketUrl(base: string, code: string): string {
  return `${base.replace(/^http/, 'ws')}/room/${code}`;
}

/** A code as typed or linked: six letters, upper case, or null. */
export function cleanCode(raw: string | null | undefined): string | null {
  const c = (raw ?? '').trim().toUpperCase();
  return /^[A-Z]{6}$/.test(c) ? c : null;
}

/** `?room=KFZQPX` in the page's URL (§5.5), or null. */
export function roomFromUrl(search: string): string | null {
  try {
    return cleanCode(new URLSearchParams(search).get('room'));
  } catch {
    return null;
  }
}

/** The link to read aloud and paste: this page with `?room=CODE` and nothing else. */
export function roomLink(href: string, code: string): string {
  try {
    const u = new URL(href);
    u.search = `?room=${code}`;
    u.hash = '';
    return u.toString();
  } catch {
    return `?room=${code}`;
  }
}

/** `POST /room`: the Worker draws a code and has a room claim it. */
export async function createRoomCode(
  base: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const r = await fetchImpl(`${base}/room`, { method: 'POST' });
  let body: { code?: string; error?: string } = {};
  try {
    body = (await r.json()) as typeof body;
  } catch {
    // An empty or broken body: the status says enough.
  }
  const code = cleanCode(body.code);
  if (r.status !== 201 || !code) throw new Error(body.error ?? `The rooms server said ${r.status}`);
  return code;
}

// ── What this browser keeps for a room ───────────────────────────────────────────────────────────

/** A string store: the browser's `localStorage` in the app, a Map in a headless walk. */
export interface KeyStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** `localStorage`, every call wrapped: a blocked or full storage must never break a game. */
export const browserStore: KeyStore = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // No storage: this browser simply cannot rejoin after a refresh.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export function memoryStore(): KeyStore {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
  };
}

/** This browser's own marks for a room's public moments (§6 item 3): per browser, never the room's. */
export interface OnlineUi {
  racesWatchedWeek: number;
  resultsSeenWeek: number;
  fieldsSeenWeek: number;
  seasonSeen: number;
  arrivalSeenWeek: number;
  boardSeenWeek: number;
}

export const EMPTY_ONLINE_UI: OnlineUi = {
  racesWatchedWeek: 0,
  resultsSeenWeek: 0,
  fieldsSeenWeek: 0,
  seasonSeen: 0,
  arrivalSeenWeek: 0,
  boardSeenWeek: 0,
};

export interface RoomRecord {
  token: string;
  ui?: Partial<OnlineUi>;
}

/** The key a room's token lives under. Not `sdr.save.v1`: a hotseat save is never read or written. */
export function roomKey(code: string): string {
  return `sdr.room.${code}`;
}

export function readRoom(store: KeyStore, code: string): RoomRecord | null {
  try {
    const raw = store.get(roomKey(code));
    if (!raw) return null;
    const rec = JSON.parse(raw) as RoomRecord;
    return typeof rec.token === 'string' && rec.token ? rec : null;
  } catch {
    return null;
  }
}

export function writeRoom(store: KeyStore, code: string, rec: RoomRecord): void {
  try {
    store.set(roomKey(code), JSON.stringify(rec));
  } catch {
    // ignore
  }
}

// ── The socket (§2.5) ────────────────────────────────────────────────────────────────────────────

export type LinkState = 'connecting' | 'open' | 'down';

export interface LinkHandlers {
  /** Every (re)connect: the store sends `hello`. */
  onOpen: () => void;
  onMessage: (msg: RoomMsg) => void;
  onState: (state: LinkState) => void;
}

export interface LinkOptions {
  /** The WebSocket class: the browser's own by default; Node's global in a headless walk. */
  WebSocket?: typeof WebSocket;
}

/**
 * One reconnecting socket to one room. Sends only while open: a press made while the socket is down
 * is refused at once rather than queued, because the room would see it before the `hello` that says
 * whose it is.
 */
export class RoomLink {
  private ws: ReconnectingWebSocket;
  private closed = false;

  constructor(
    readonly url: string,
    private handlers: LinkHandlers,
    opts: LinkOptions = {},
  ) {
    this.ws = new ReconnectingWebSocket(url, [], {
      ...(opts.WebSocket ? { WebSocket: opts.WebSocket } : {}),
      maxEnqueuedMessages: 0,
      minReconnectionDelay: 500,
      maxReconnectionDelay: 5000,
      connectionTimeout: 6000,
    });
    handlers.onState('connecting');
    this.ws.addEventListener('open', () => {
      if (this.closed) return;
      handlers.onState('open');
      handlers.onOpen();
    });
    this.ws.addEventListener('close', () => {
      if (!this.closed) handlers.onState('down');
    });
    this.ws.addEventListener('message', (e: MessageEvent) => {
      if (this.closed) return;
      let msg: RoomMsg;
      try {
        msg = JSON.parse(String(e.data)) as RoomMsg;
      } catch {
        return;
      }
      handlers.onMessage(msg);
    });
  }

  get open(): boolean {
    return !this.closed && this.ws.readyState === 1;
  }

  send(msg: ClientMsg): boolean {
    if (!this.open) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Drop the connection and reconnect straight away (a patch before any whole view, §2.5). */
  reconnect(): void {
    if (!this.closed) this.ws.reconnect();
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }
}
