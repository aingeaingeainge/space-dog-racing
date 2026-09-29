import { create, type StoreApi, type UseBoundStore } from 'zustand';
import {
  createSeason,
  drive,
  PROTOCOL_VERSION,
  replay,
  waitingOn,
  type Action,
  type AiAgent,
  type GameLength,
  type GameState,
  type Id,
  type SeasonSetup,
} from '@sdr/engine';
import { clearSave, readSave, writeSave, SAVE_VERSION, type SaveUi } from './persist';
import { applyActions, onClock, weekKey } from './loop';
import {
  browserStore,
  cleanCode,
  createRoomCode,
  EMPTY_ONLINE_UI,
  readRoom,
  RoomLink,
  roomsUrl,
  socketUrl,
  writeRoom,
  type ClientMsg,
  type KeyStore,
  type LinkState,
  type LobbyStateMsg,
  type OnlineUi,
  type RoomMeta,
  type RoomMsg,
  type StaleRoom,
} from './online';
import { addPace, EMPTY_PACE, type Pace, type PaceBucket } from '../lib/pace';

/** Where the human is looking during their own phase. Never part of game state. */
export type View = 'hub' | 'stable' | 'market' | 'office' | 'map';

/** How fast the race view replays a tick log. Remembered for the rest of the session. */
export type RaceSpeed = 1 | 2;

export interface GameStore {
  setup: SeasonSetup | null;
  state: GameState | null;
  log: Action[];
  error: string | null;
  view: View;
  leaderboard: boolean;
  /** Week whose races the table has already watched run. UI only. */
  racesWatchedWeek: number;
  /** Week whose race results the table has already read. UI only. */
  resultsSeenWeek: number;
  /** Week whose locked card has been read, on a weekend with no bookie. UI only. */
  fieldsSeenWeek: number;
  /** Humans who have been shown the bad news. UI only. */
  bustAck: Id[];
  /** The last season whose end the table has read (GDD_V3 §2.2). UI only. */
  seasonSeen: number;
  /** Phase E2, a hotseat table: the weekend whose arrival and whose locked board the table has read. */
  arrivalSeenWeek: number;
  boardSeenWeek: number;
  /** Phase E2: the human who took the laptop back to the planet after the races, to trade. */
  postTrade: Id | null;
  /** Phase E2: the pace timer — wall-clock seconds a weekend, by kind of screen. UI only, saved. */
  pace: Pace;
  /** When the screen now showing started being timed, and where its seconds go. Never saved. */
  paceMark: { at: number; key: number; bucket: PaceBucket | 'between' } | null;
  /** 1× or 2×. UI only. */
  raceSpeed: RaceSpeed;
  /** The human whose "pass the laptop" screen has been acknowledged. */
  passAck: Id | null;
  hasSave: boolean;

  // ── Online (ONLINE_PLAN §6 item 2). Absent or 'local' is hotseat, exactly as before. ─────────────
  /** Where the game lives: this browser (hotseat, the save) or a room (online, the room is the save). */
  source: 'local' | 'online';
  /** The Title's "Play online" has opened the way in (create or join). UI only. */
  lobbyOpen: boolean;
  /** This browser's seat in the room, once welcomed. */
  seat: Id | null;
  /** The room's code: set as soon as this browser starts connecting to it. */
  code: string | null;
  /** Is this seat the room's host? From `welcome`, then `lobby` and `meta`. */
  host: boolean;
  /** What the room says about the table that the view does not (§2.4). */
  meta: RoomMeta | null;
  /** The lobby as the room last sent it: the seats, the length, the host (§5.5). */
  lobby: LobbyStateMsg | null;
  /** The socket: connecting, open, or down and retrying. Null when there is no room. */
  conn: LinkState | null;
  /** The log's length at the last view (`rev`). */
  rev: number;
  /** `seq`s sent and not yet answered. */
  inFlight: number[];
  /** Somebody nudged this seat (§5.1): the sound and the tab title play until the window has focus. */
  nudged: { by: string; at: number } | null;
  /** A room this engine cannot replay (§7): its last standings, and no more play. */
  stale: StaleRoom | null;
  /** The room speaks a newer protocol than this build (§7): "a new version is out — reload". */
  reloadNeed: number | null;

  openLobby: (open: boolean) => void;
  /** "Create a room": `POST /room`, then sit down in it as its host. */
  createRoom: (name: string, colour: number) => Promise<void>;
  /**
   * Connect to a room. A browser holding the room's token goes straight back into its seat; with a
   * name and a face it sits down; with neither it only looks (the lobby, the faces taken).
   */
  joinRoom: (code: string, who?: { name: string; colour: number }) => void;
  /** On a room already connected: sit down with a name and a face. */
  sitDown: (name: string, colour: number) => void;
  /** The host, before Start: the length and the AI rows. */
  setTable: (change: { length?: GameLength; ai?: { difficulty: AiAgent }[] }) => void;
  startRoom: () => void;
  nudge: (seat: Id) => void;
  standIn: (seat: Id, on: boolean) => void;
  ackNudge: () => void;
  /** Close the socket and go back to the Title. The token stays, so the link still rejoins. */
  leaveRoom: () => void;

  newSeason: (setup: SeasonSetup) => void;
  /** The same table and the same seed, from week 1 (GDD §15.11). */
  playAgain: () => void;
  resume: () => void;
  abandon: () => void;
  dispatch: (...actions: Action[]) => void;
  setView: (view: View) => void;
  setLeaderboard: (open: boolean) => void;
  setRaceSpeed: (speed: RaceSpeed) => void;
  ackRaces: () => void;
  ackResults: () => void;
  ackFields: () => void;
  ackPass: (playerId: Id) => void;
  /** The table has read the season's end: on to the off-season. */
  ackSeason: () => void;
  /** Phase E2: the table has read the arrival, or the locked board. A pass too, when `passTo` is set. */
  ackArrival: (passTo?: Id) => void;
  ackBoard: (passTo?: Id) => void;
  /** Phase E2: after the races, this human takes the laptop to trade before flying on. */
  tradeAfterRaces: (playerId: Id) => void;
  /**
   * Phase E2's pace timer: the screen has changed (or the window was hidden, `bucket` null). The time
   * since the last mark goes to the last mark's weekend and bucket, and a new stretch starts.
   */
  markPace: (bucket: PaceBucket | 'between' | null, key: number) => void;
  ackBust: (playerId: Id) => void;
  clearError: () => void;
}

/**
 * What a store needs from the world, for a headless walk to stand in: where it keeps a room's token,
 * the WebSocket class, `fetch` and the rooms URL. The app's own store takes the browser's.
 */
export interface StoreWorld {
  storage?: KeyStore;
  WebSocket?: typeof WebSocket;
  fetch?: typeof fetch;
  roomsUrl?: string | null;
}

export type GameStoreHook = UseBoundStore<StoreApi<GameStore>>;

/** A game store. The app has one (`useGame`); `online-table-walk` makes one per headless browser. */
export function makeGameStore(world: StoreWorld = {}): GameStoreHook {
  return create<GameStore>((set, get) => {
    /** The UI-only half of the save file, gathered in one place so no writer drops a field. */
    function ui(over?: Partial<SaveUi>): SaveUi {
      const g = get();
      return {
        resultsSeenWeek: g.resultsSeenWeek,
        racesWatchedWeek: g.racesWatchedWeek,
        fieldsSeenWeek: g.fieldsSeenWeek,
        bustAck: g.bustAck,
        raceSpeed: g.raceSpeed,
        seasonSeen: g.seasonSeen,
        arrivalSeenWeek: g.arrivalSeenWeek,
        boardSeenWeek: g.boardSeenWeek,
        pace: g.pace,
        ...over,
      };
    }

    function save(over?: Partial<SaveUi>, log?: Action[]): void {
      const g = get();
      // Online the room is the save (§6 item 2): a hotseat save must survive an online game untouched,
      // so nothing here ever reaches it. This browser's own marks go under the room's key instead.
      if (g.source === 'online') return keepMarks();
      if (!g.setup) return;
      writeSave({ v: SAVE_VERSION, setup: g.setup, log: log ?? g.log, ui: ui(over) });
    }

    // ── Online: the room's end of the store (ONLINE_PLAN §2.4–§2.6, §6) ────────────────────────────
    const storage = world.storage ?? browserStore;
    let link: RoomLink | null = null;
    let seqNo = 0;
    /** A name and a face to sit down with, until the room welcomes or refuses them. */
    let sitting: { name: string; colour: number } | null = null;
    /** The last `hello` sent: its `seq`, and what it asked for. */
    let lastHello: { seq: number; kind: 'token' | 'name' | 'look' } | null = null;

    function marksOf(g: GameStore): OnlineUi {
      return {
        racesWatchedWeek: g.racesWatchedWeek,
        resultsSeenWeek: g.resultsSeenWeek,
        fieldsSeenWeek: g.fieldsSeenWeek,
        seasonSeen: g.seasonSeen,
        arrivalSeenWeek: g.arrivalSeenWeek,
        boardSeenWeek: g.boardSeenWeek,
      };
    }

    /** This browser's marks for the room, beside its token, so a refresh comes back to the same screen. */
    function keepMarks(): void {
      const g = get();
      if (!g.code) return;
      const rec = readRoom(storage, g.code);
      if (rec) writeRoom(storage, g.code, { ...rec, ui: marksOf(g) });
    }

    function base(): string | null {
      return world.roomsUrl !== undefined ? world.roomsUrl : roomsUrl();
    }

    /** Send a message with the next `seq`. False (and a line in `error`) while the socket is down. */
    function send(msg: ClientMsg): number | null {
      const seq = ++seqNo;
      if (!link || !link.send({ ...msg, seq })) {
        set({ error: 'Not connected to the room — reconnecting…' });
        return null;
      }
      set({ inFlight: [...get().inFlight, seq] });
      return seq;
    }

    /** On every (re)connect (§2.5): the token if this browser has one, else a name, else just look. */
    function hello(): void {
      const { code } = get();
      if (!code) return;
      const rec = readRoom(storage, code);
      const kind = rec ? 'token' : sitting ? 'name' : 'look';
      const seq = send({
        t: 'hello',
        v: PROTOCOL_VERSION,
        ...(rec
          ? { token: rec.token }
          : sitting
            ? { name: sitting.name, colour: sitting.colour }
            : {}),
      });
      lastHello = seq === null ? null : { seq, kind };
    }

    const NO_GAME = {
      state: null,
      setup: null,
      log: [] as Action[],
      view: 'hub' as View,
      leaderboard: false,
      postTrade: null,
      passAck: null,
      bustAck: [] as Id[],
      pace: EMPTY_PACE,
      paceMark: null,
    };

    /** Open the room's socket, from nothing: the store holds nothing the room does not. */
    function connect(code: string): void {
      link?.close();
      link = null;
      lastHello = null;
      const url = base();
      if (!url) {
        set({ error: 'This build has no rooms server.' });
        return;
      }
      const rec = readRoom(storage, code);
      set({
        ...NO_GAME,
        ...EMPTY_ONLINE_UI,
        ...rec?.ui,
        source: 'online',
        code,
        seat: null,
        host: false,
        meta: null,
        lobby: null,
        rev: 0,
        inFlight: [],
        nudged: null,
        stale: null,
        reloadNeed: null,
        error: null,
      });
      link = new RoomLink(
        socketUrl(url, code),
        { onOpen: hello, onMessage: receive, onState: (conn) => set({ conn }) },
        world.WebSocket ? { WebSocket: world.WebSocket } : {},
      );
    }

    function receive(msg: RoomMsg): void {
      const seq = 'seq' in msg ? msg.seq : undefined;
      if (seq !== undefined) set({ inFlight: get().inFlight.filter((x) => x !== seq) });
      const g = get();
      switch (msg.t) {
        case 'welcome': {
          const rec = readRoom(storage, msg.code);
          writeRoom(storage, msg.code, { ...rec, token: msg.token });
          sitting = null;
          set({
            seat: msg.seat,
            host: msg.host,
            // Online nobody passes a laptop: the "holder" is always this seat, so a public screen's
            // button never says "I am …" (screens/Table.tsx).
            passAck: msg.seat,
            stale: msg.stale ?? null,
            error: null,
          });
          return;
        }
        case 'lobby':
          set({ lobby: msg, ...(g.seat ? { host: msg.host === g.seat } : {}) });
          return;
        case 'view': {
          // A patch is only the top-level fields that changed; with nothing to lay it over, the
          // browser reconnects for a whole view rather than guess (§2.5).
          if (!msg.full && !g.state) {
            link?.reconnect();
            return;
          }
          const next = (msg.full ? msg.patch : { ...g.state, ...msg.patch }) as GameState;
          const seat = g.seat;
          const before = g.state;
          const moved =
            !before ||
            !seat ||
            before.week !== next.week ||
            before.phase !== next.phase ||
            onClock(before, { seat, meta: g.meta }) !== onClock(next, { seat, meta: msg.meta });
          set({
            state: next,
            meta: msg.meta,
            rev: msg.rev,
            ...(seat ? { host: msg.meta.host === seat } : {}),
            ...(moved ? { view: 'hub' as View } : {}),
          });
          return;
        }
        case 'rejected': {
          if (lastHello && seq === lastHello.seq) {
            if (lastHello.kind === 'name') sitting = null;
            if (lastHello.kind === 'token' && g.code) {
              // A token the room does not know: forget it, and just look.
              storage.remove(`sdr.room.${g.code}`);
              set({ error: msg.error });
              hello();
              return;
            }
          }
          set({ error: msg.error });
          return;
        }
        case 'nudged':
          set({ nudged: { by: msg.by, at: Date.now() } });
          return;
        case 'ended':
          // Game over (§2.6): the secrets are not secret any more, and the report runs on the log.
          set({ setup: msg.setup, log: msg.log });
          return;
        case 'reload':
          set({ reloadNeed: msg.need });
          return;
        case 'moved': {
          // Play again (§2.6): the old room has made a successor with the same seats. This browser's
          // token is its token there too.
          const rec = g.code ? readRoom(storage, g.code) : null;
          const code = cleanCode(msg.code);
          if (!code) return;
          if (rec) writeRoom(storage, code, { token: rec.token });
          connect(code);
          return;
        }
        default:
          return;
      }
    }

    const online = {
      source: 'local' as const,
      lobbyOpen: false,
      seat: null,
      code: null,
      host: false,
      meta: null,
      lobby: null,
      conn: null,
      rev: 0,
      inFlight: [] as number[],
      nudged: null,
      stale: null,
      reloadNeed: null,

      openLobby: (open: boolean) => set({ lobbyOpen: open, error: null }),

      createRoom: async (name: string, colour: number) => {
        const url = base();
        if (!url) return set({ error: 'This build has no rooms server.' });
        set({ error: null });
        let code: string;
        try {
          code = await createRoomCode(url, world.fetch ?? fetch);
        } catch (e) {
          set({ error: `Could not make a room: ${(e as Error).message}` });
          return;
        }
        sitting = { name, colour };
        connect(code);
      },

      joinRoom: (raw: string, who?: { name: string; colour: number }) => {
        const code = cleanCode(raw);
        if (!code) return set({ error: 'A room code is six letters.' });
        sitting = who ?? null;
        connect(code);
      },

      sitDown: (name: string, colour: number) => {
        sitting = { name, colour };
        set({ error: null });
        hello();
      },

      setTable: (change: { length?: GameLength; ai?: { difficulty: AiAgent }[] }) =>
        void send({ t: 'lobby', ...change }),
      startRoom: () => void send({ t: 'start' }),
      nudge: (seat: Id) => void send({ t: 'nudge', seat }),
      standIn: (seat: Id, on: boolean) => void send({ t: 'standIn', seat, on }),
      ackNudge: () => set({ nudged: null }),

      leaveRoom: () => {
        link?.close();
        link = null;
        sitting = null;
        lastHello = null;
        set({
          ...NO_GAME,
          ...EMPTY_ONLINE_UI,
          source: 'local',
          lobbyOpen: false,
          seat: null,
          code: null,
          host: false,
          meta: null,
          lobby: null,
          conn: null,
          rev: 0,
          inFlight: [],
          nudged: null,
          stale: null,
          reloadNeed: null,
          error: null,
        });
      },
    };

    return {
      setup: null,
      state: null,
      log: [],
      error: null,
      view: 'hub',
      leaderboard: false,
      racesWatchedWeek: 0,
      resultsSeenWeek: 0,
      fieldsSeenWeek: 0,
      bustAck: [],
      seasonSeen: 0,
      arrivalSeenWeek: 0,
      boardSeenWeek: 0,
      postTrade: null,
      pace: EMPTY_PACE,
      paceMark: null,
      raceSpeed: 2,
      passAck: null,
      hasSave: readSave() !== null,

      newSeason: (setup) => {
        const state = createSeason(setup);
        const log: Action[] = [];
        // Run AI stables and system phases until a human is on the clock.
        drive(state, log);
        const speed = get().raceSpeed;
        writeSave({
          v: SAVE_VERSION,
          setup,
          log,
          ui: {
            resultsSeenWeek: 0,
            racesWatchedWeek: 0,
            fieldsSeenWeek: 0,
            bustAck: [],
            raceSpeed: speed,
            seasonSeen: 0,
            arrivalSeenWeek: 0,
            boardSeenWeek: 0,
            pace: EMPTY_PACE,
          },
        });
        set({
          setup,
          state,
          log,
          error: null,
          view: 'hub',
          leaderboard: false,
          racesWatchedWeek: 0,
          resultsSeenWeek: 0,
          fieldsSeenWeek: 0,
          bustAck: [],
          seasonSeen: 0,
          arrivalSeenWeek: 0,
          boardSeenWeek: 0,
          postTrade: null,
          pace: EMPTY_PACE,
          paceMark: null,
          passAck: null,
          hasSave: true,
        });
      },

      /**
       * Play the season again. A season *is* (setup + log), so the same setup replayed from an empty
       * log is the same season — there is no new mechanism here and nothing to seed twice. The
       * finished log goes, which is what makes this different from `resume`.
       */
      playAgain: () => {
        // Online, Play again is the host's, and the room makes the successor (§2.6).
        if (get().source === 'online') {
          if (get().host) send({ t: 'playAgain' });
          return;
        }
        const { setup, newSeason } = get();
        if (!setup) return;
        newSeason(setup);
      },

      resume: () => {
        const blob = readSave();
        if (!blob) {
          set({ error: 'No saved season found.', hasSave: false });
          return;
        }
        try {
          const state = replay(createSeason(blob.setup), blob.log);
          // A reload never costs the player a re-watch: if the week's races are still live but the
          // save does not say they were watched, fail soft to the results rather than replaying
          // three races the table may already have seen.
          const watched = state.races
            ? Math.max(blob.ui?.racesWatchedWeek ?? 0, weekKey(state))
            : (blob.ui?.racesWatchedWeek ?? 0);
          const speed: RaceSpeed = blob.ui?.raceSpeed === 1 ? 1 : 2;
          set({
            setup: blob.setup,
            state,
            log: blob.log,
            error: null,
            view: 'hub',
            leaderboard: false,
            racesWatchedWeek: watched,
            resultsSeenWeek: blob.ui?.resultsSeenWeek ?? 0,
            fieldsSeenWeek: blob.ui?.fieldsSeenWeek ?? 0,
            bustAck: blob.ui?.bustAck ?? [],
            seasonSeen: blob.ui?.seasonSeen ?? 0,
            arrivalSeenWeek: blob.ui?.arrivalSeenWeek ?? 0,
            boardSeenWeek: blob.ui?.boardSeenWeek ?? 0,
            postTrade: null,
            pace: blob.ui?.pace ?? EMPTY_PACE,
            paceMark: null,
            raceSpeed: speed,
            passAck: null,
            hasSave: true,
          });
        } catch (e) {
          set({ error: `That save could not be replayed: ${(e as Error).message}` });
        }
      },

      abandon: () => {
        // Online, Quit leaves the room: the hotseat save is not this game's, and is never touched.
        if (get().source === 'online') return get().leaveRoom();
        clearSave();
        set({
          setup: null,
          state: null,
          log: [],
          error: null,
          hasSave: false,
          passAck: null,
          bustAck: [],
          fieldsSeenWeek: 0,
          seasonSeen: 0,
          arrivalSeenWeek: 0,
          boardSeenWeek: 0,
          postTrade: null,
          pace: EMPTY_PACE,
          paceMark: null,
        });
      },

      /**
       * Send actions to the engine and store what comes back. The log — ours, the AI's and the
       * system's AdvancePhase — is the save file. On an ActionError nothing is kept, because the
       * live state was never the copy that was edited.
       */
      dispatch: (...actions) => {
        // Online (§6 item 2): the room reduces, and the next `view` replaces the state.
        if (get().source === 'online') {
          if (!actions.length) return;
          set({ error: null });
          send({ t: 'act', actions });
          return;
        }
        const { state, log, setup } = get();
        if (!state || !setup) return;
        const beforeWeek = state.week;
        const beforePhase = state.phase;
        const beforeWho = waitingOn(state);
        try {
          const { state: next, added } = applyActions(state, actions);
          const nextLog = [...log, ...added];
          save(undefined, nextLog);
          const moved =
            next.week !== beforeWeek || next.phase !== beforePhase || waitingOn(next) !== beforeWho;
          set({
            state: next,
            log: nextLog,
            error: null,
            hasSave: true,
            ...(moved ? { view: 'hub' as View } : {}),
            // A trip back to the planet after the races lasts until the stable flies on (Phase E2).
            ...(next.phase !== 'planetPost' || waitingOn(next) !== beforeWho
              ? { postTrade: null }
              : {}),
          });
        } catch (e) {
          set({ error: (e as Error).message });
        }
      },

      setView: (view) => set({ view }),
      setLeaderboard: (leaderboard) => set({ leaderboard }),

      setRaceSpeed: (raceSpeed) => {
        set({ raceSpeed });
        save({ raceSpeed });
      },

      ackRaces: () => {
        const st = get().state;
        const week = st ? weekKey(st) : 0;
        set({ racesWatchedWeek: week });
        save({ racesWatchedWeek: week });
      },

      ackResults: () => {
        const st = get().state;
        const week = st ? weekKey(st) : 0;
        set({ resultsSeenWeek: week });
        save({ resultsSeenWeek: week });
      },

      ackFields: () => {
        const st = get().state;
        const week = st ? weekKey(st) : 0;
        set({ fieldsSeenWeek: week });
        save({ fieldsSeenWeek: week });
      },

      ackPass: (playerId) => set({ passAck: playerId }),

      ackSeason: () => {
        const seasonSeen = get().state?.season ?? 0;
        set({ seasonSeen, passAck: null });
        save({ seasonSeen });
      },

      ackArrival: (passTo) => {
        const st = get().state;
        const week = st ? weekKey(st) : 0;
        set({ arrivalSeenWeek: week, ...(passTo ? { passAck: passTo } : {}) });
        save({ arrivalSeenWeek: week });
      },

      ackBoard: (passTo) => {
        const st = get().state;
        const week = st ? weekKey(st) : 0;
        set({ boardSeenWeek: week, ...(passTo ? { passAck: passTo } : {}) });
        save({ boardSeenWeek: week });
      },

      tradeAfterRaces: (playerId) => set({ postTrade: playerId, view: 'market' }),

      markPace: (bucket, key) => {
        const { paceMark, pace } = get();
        const now = Date.now();
        const next = paceMark
          ? addPace(pace, paceMark.key, paceMark.bucket, Math.round((now - paceMark.at) / 100) / 10)
          : pace;
        set({ pace: next, paceMark: bucket ? { at: now, key, bucket } : null });
        if (next !== pace) save({ pace: next });
      },

      ackBust: (playerId) => {
        const bustAck = [...get().bustAck, playerId];
        set({ bustAck });
        save({ bustAck });
      },
      clearError: () => set({ error: null }),

      ...online,
    };
  });
}

export const useGame = makeGameStore();
