import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  createSeason,
  decide,
  EVENTS,
  PLANETS,
  isSeasonOver,
  needsAdvance,
  player,
  PROTOCOL_VERSION,
  reduceMut,
  replay,
  rumoursFor,
  SEAT_SECRETS,
  viewFor,
  waitingOn,
  type Action,
  type GameState,
  type Id,
  type SeasonSetup,
} from '../src/index';

/*
 * v3 Phase L1 — the engine's half of online play (ONLINE_PLAN §4, §8 item 2).
 *
 * `viewFor`: every `SEAT_SECRETS` row is hidden from every seat not allowed it and shown to the one
 * that is, and a stable's secret changed leaves every other seat's view byte-identical. The draft in
 * turn order, and public (Phase N; it replaced the off-season in any order). `decide` playing a human seat (the stand-in, §5.3). `rumoursFor` unchanged.
 */

const humans = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Human ${i + 1}`, kind: 'human' as const }));
const ais = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `AI ${i + 1}`,
    kind: 'ai' as const,
    difficulty: 'normal' as const,
  }));

/**
 * Drive every seat, humans included, as a Normal AI — which is exactly what a room's stand-in does
 * (ONLINE_PLAN §4: the room calls `decide(state, seat, 'normal')` for a human seat) — until `stop`.
 */
function play(setup: SeasonSetup, stop: (s: GameState) => boolean = () => false) {
  const s = createSeason(setup);
  const log: Action[] = [];
  while (!isSeasonOver(s) && !stop(s)) {
    if (needsAdvance(s)) {
      const a: Action = { t: 'AdvancePhase' };
      reduceMut(s, a);
      log.push(a);
      continue;
    }
    const who = waitingOn(s)!;
    const p = player(s, who);
    for (const a of decide(s, who, p.kind === 'human' ? 'normal' : p.difficulty)) {
      reduceMut(s, a);
      log.push(a);
    }
  }
  return { s, log };
}

const json = (x: unknown) => JSON.stringify(x);

describe('PROTOCOL_VERSION', () => {
  it('starts at 1', () => expect(PROTOCOL_VERSION).toBe(1));
});

describe('the stand-in: decide plays a human seat (ONLINE_PLAN §5.3)', () => {
  it('plays four human seats through a whole season, and the log replays', () => {
    const setup: SeasonSetup = { seed: 42, players: [...humans(4), ...ais(2)] };
    const { s, log } = play(setup);
    expect(s.phase).toBe('seasonEnd');
    expect(s.finalStandings).toHaveLength(6);
    expect(json(replay(createSeason(setup), log))).toBe(json(s));
  });
});

/*
 * ⚠️ Phase N (V32): **the off-season is no longer answered in any order.** It is one pick of a draft
 * off a shared board, so it is in turn order — last on the standings first — like the Market. L1's
 * "every order gives the same state" test went with the any-order rule; what replaces it is that a
 * pick out of turn is refused, in the opening draft and the off-season's, and that **nothing about
 * the draft is secret** (V30): every seat sees the board, the order and every pick.
 */
describe('the draft is in turn order, and public (V29, V30, V32)', () => {
  const setup: SeasonSetup = {
    seed: 42,
    length: { kind: 'seasons', seasons: 2 },
    players: [...humans(4), ...ais(2)],
  };
  const opening = createSeason(setup);
  const off = play(setup, (s) => s.phase === 'offSeason').s;

  for (const [label, s] of [
    ['the opening draft', opening],
    ['the off-season draft', off],
  ] as const) {
    it(`${label}: a pick out of turn is refused`, () => {
      const x = structuredClone(s);
      const d = x.drafts.at(-1)!;
      const onClock = d.order[d.at]!;
      const other = x.players.find((p) => p.id !== onClock)!.id;
      const dog = d.dogs[0]!.id;
      expect(() => reduceMut(x, { t: 'DraftPick', playerId: other, pick: { dog } })).toThrow(
        /pick/,
      );
      expect(() => reduceMut(x, { t: 'EndPhase', playerId: onClock })).toThrow(/pick/);
    });

    it(`${label}: every seat sees the whole board, the order and the picks`, () => {
      const want = json({ drafts: s.drafts, offSeason: s.offSeason, turnOrder: s.turnOrder });
      for (const p of s.players) {
        const v = viewFor(s, p.id);
        expect(json({ drafts: v.drafts, offSeason: v.offSeason, turnOrder: v.turnOrder })).toBe(
          want,
        );
        // Every dog on the board shows its true style (V30).
        for (const [i, d] of v.drafts.at(-1)!.dogs.entries())
          expect(d.style).toBe(s.drafts.at(-1)!.dogs[i]!.style);
      }
    });
  }

  it('no SEAT_SECRETS row names the draft or the off-season', () => {
    for (const r of SEAT_SECRETS) expect(r.field).not.toMatch(/draft|offSeason/);
  });
});

describe('rumoursFor (moved from the web, output unchanged)', () => {
  it('matches what web/src/lib/rumours.ts said at v3j over seeds 1–5', () => {
    // Pinned from `shots/rumours-dump.mts web` run at v3j (seeds 1–5: 50 rumours); the same probe
    // over seeds 1–50 gave 417 rumours, ae11f511…, from the web at v3j and from the engine here.
    const h = createHash('sha256');
    let n = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const s = createSeason({ seed, players: ais(6) });
      let last = -1;
      while (!isSeasonOver(s)) {
        if (s.week !== last) {
          const r = rumoursFor(s);
          h.update(JSON.stringify([seed, s.week, r]));
          n += r.length;
          last = s.week;
        }
        if (needsAdvance(s)) {
          reduceMut(s, { t: 'AdvancePhase' });
          continue;
        }
        const who = waitingOn(s)!;
        for (const a of decide(s, who, player(s, who).difficulty)) reduceMut(s, a);
      }
    }
    expect(n).toBe(50);
    expect(h.digest('hex')).toBe(
      'c4dd5b8d0a8b6f0da4e86d70b8a17bc06f01a210451694cdd1d16a8b6cf78950',
    );
  });
});

/**
 * A plant gives stable `a` one secret by editing the state directly (so nothing else moves — not its
 * cash, not the rng), and says whether a view shows it. `who` is who should see it: `'owner'` (a),
 * `'tipped'` (a, but not the dog's owner b), or `'nobody'`.
 */
interface Plant {
  row: string;
  who: 'owner' | 'nobody';
  plant: (s: GameState, a: Id, b: Id) => void;
  shows: (v: GameState, a: Id, b: Id) => boolean;
  /**
   * The same plant with a different secret. Needed where planting makes something public too — a card
   * its owner can see, a dog whose style has gone back to unknown, an off-season — so that seats are
   * compared across the twins rather than against the unplanted state.
   */
  twin?: (s: GameState, a: Id, b: Id) => void;
}

const poundCard = EVENTS.find((e) => e.category === 'pound')!.id;
const dogOf = (s: GameState, id: Id, k = 0) => player(s, id).dogIds[k]!;

const PLANTS: Plant[] = [
  {
    row: 'seed, rng',
    who: 'nobody',
    plant: (s) => {
      s.seed = 123457;
      s.rng = 98765;
    },
    shows: (v) => v.seed === 123457 || v.rng === 98765,
  },
  {
    row: 'calendar[w].planetId, w > week + 1',
    who: 'nobody',
    plant: (s) => {
      // Three weeks out: past the rumours too, which reach two (and name a dark planet on purpose).
      const e = s.calendar[s.week + 2]!;
      e.planetId = PLANETS.find((p) => p.id !== e.planetId && !p.major)!.id;
    },
    shows: (v) => v.calendar[v.week + 2]!.planetId !== '',
  },
  {
    row: 'nextPlanet.goods',
    who: 'owner',
    plant: (s, a) => {
      s.nextPlanet!.goods.ambrosia.sell = 7777;
      player(s, a).intel = { week: s.week + 1, goods: ['ambrosia'] };
    },
    shows: (v) => v.nextPlanet!.goods.ambrosia.sell === 7777,
  },
  {
    row: 'explore.seeds',
    who: 'nobody',
    plant: (s, a) => {
      s.explore!.seeds[a] = 424242;
    },
    shows: (v, a) => v.explore!.seeds[a] === 424242,
  },
  {
    row: 'explore.picks, explore.cards',
    who: 'owner',
    plant: (s, a) => {
      s.explore!.picks[a] = 2;
      s.explore!.cards[a] = 'plantedCard';
    },
    shows: (v, a) => v.explore!.picks[a] === 2 && v.explore!.cards[a] === 'plantedCard',
  },
  {
    row: 'explore.taken',
    who: 'nobody',
    plant: (s) => {
      s.explore!.taken.push('plantedCard');
    },
    shows: (v) => v.explore!.taken.includes('plantedCard'),
  },
  {
    row: 'pendingEvent (another stable’s)',
    who: 'owner',
    plant: (s, a) => plantOffer(s, a),
    shows: (v, a) => v.pendingEvent?.playerId === a,
  },
  {
    row: 'pendingEvent.params, pendingEvent.rng',
    who: 'nobody',
    plant: (s, a) => plantOffer(s, a),
    twin: (s, a) => plantOffer(s, a, { speed: 49, stamina: 77, rng: 5 }),
    shows: (v) =>
      !!v.pendingEvent &&
      (v.pendingEvent.rng !== 0 ||
        Object.keys(v.pendingEvent.params).some((k) => !['offerName', 'staffId'].includes(k))),
  },
  {
    row: 'players[].stats.liesTold',
    who: 'nobody',
    // The offer is planted as the engine rolls it: liesTold counted the moment it is drawn.
    plant: (s, a) => plantOffer(s, a),
    twin: (s, a) => plantOffer(s, a, { lie: 0 }),
    shows: (v, a) => player(v, a).stats.liesTold === BASE_LIES.get(v.players.length)! + 1,
  },
  {
    row: 'players[].stats (the private counters)',
    who: 'owner',
    plant: (s, a) => {
      player(s, a).stats.nobbles += 1;
      player(s, a).stats.betIncome -= 300;
    },
    shows: (v, a) => player(v, a).stats.nobbles > 0,
  },
  {
    row: 'dogs[d].style where !styleKnown',
    who: 'nobody',
    plant: (s, a) => {
      const d = s.dogs[dogOf(s, a)]!;
      d.styleKnown = false;
      d.style = 'closer';
    },
    twin: (s, a) => {
      const d = s.dogs[dogOf(s, a)]!;
      d.styleKnown = false;
      d.style = 'frontRunner';
    },
    shows: (v, a) => v.dogs[dogOf(v, a)]!.style === 'closer',
  },
  {
    row: 'dogs[d].raceBonus (another stable’s)',
    who: 'owner',
    plant: (s, a) => {
      s.dogs[dogOf(s, a)]!.raceBonus = 5;
    },
    shows: (v, a) => v.dogs[dogOf(v, a)]!.raceBonus === 5,
  },
  {
    row: 'conditions',
    who: 'owner', // the tipped stable a, and not b, whose dog it is
    plant: (s, a, b) => {
      s.conditions.push({ dogId: dogOf(s, b, 1), condition: 'knock', tipped: [a] });
    },
    shows: (v, _a, b) => v.conditions.some((c) => c.dogId === dogOf(v, b, 1)),
  },
  {
    row: 'jobs',
    who: 'owner',
    plant: (s, a, b) => {
      s.jobs.push({ by: a, kind: 'nobble', dogId: dogOf(s, b) });
    },
    shows: (v, a) => v.jobs.some((j) => j.by === a),
  },
  {
    row: 'bets (another stable’s)',
    who: 'owner',
    plant: (s, a) => {
      s.bets.push({
        playerId: a,
        week: s.week,
        race: 'goldCup',
        dogId: dogOf(s, a),
        kind: 'win',
        stake: 250,
        odds: 4.5,
      });
    },
    shows: (v, a) => v.bets.some((b) => b.playerId === a && b.stake === 250 && b.odds === 4.5),
  },
  {
    row: 'players[].intel',
    who: 'owner',
    plant: (s, a) => {
      player(s, a).intel = { week: s.week + 1, goods: ['greyMash', 'vatSteak'] };
    },
    shows: (v, a) => player(v, a).intel.goods.includes('vatSteak'),
  },
  {
    row: 'players[].flags',
    who: 'owner',
    plant: (s, a) => {
      player(s, a).flags.tipOff = true;
      player(s, a).flags.arriveFirstNextWeek = true;
    },
    shows: (v, a) => player(v, a).flags.tipOff,
  },
  {
    row: 'players[].paid',
    who: 'owner',
    plant: (s, a) => {
      player(s, a).paid.pulsarMarrow = 321;
    },
    shows: (v, a) => player(v, a).paid.pulsarMarrow === 321,
  },
  {
    row: 'eventLog lines with a playerId',
    who: 'owner',
    plant: (s, a) => {
      s.eventLog.push({ week: s.week, phase: s.phase, playerId: a, text: 'a planted secret' });
    },
    shows: (v) => v.eventLog.some((l) => l.text === 'a planted secret'),
  },
];

/**
 * `liesTold` before the planted offer, per base state — keyed by the table's size since Phase N (it was
 * keyed by week, and after the draft both bases stop at week 4).
 */
const BASE_LIES = new Map<number, number>();

function plantOffer(
  s: GameState,
  a: Id,
  alt: { speed?: number; stamina?: number; rng?: number; lie?: number } = {},
): void {
  const lie = alt.lie ?? 1;
  s.pendingEvent = {
    playerId: a,
    eventId: poundCard,
    params: {
      offerName: 'Planted Pup',
      age: 3,
      speed: 70,
      accel: 41,
      stamina: alt.stamina ?? 55,
      shown: 'accel',
      claimed: 'speed',
      lie,
      style: 'closer',
    },
    choices: ['Walk away', 'Take it'],
    door: 0,
    detail: 'Planted Pup, age 3.',
    rng: alt.rng ?? 31337,
  };
  if (alt.speed !== undefined) s.pendingEvent.params.speed = alt.speed;
  if (lie) player(s, a).stats.liesTold += 1;
}

/** A table mid-season: week 4, at the Bookie with the fields locked. */
function midSeason(players: SeasonSetup['players']): GameState {
  const s = play({ seed: 42, players }, (x) => x.week === 4 && x.phase === 'betting' && x.locked).s;
  // A clean slate for the plants: no stable holds a tip or intel that a plant could be confused with.
  s.conditions = [];
  for (const p of s.players) p.intel = { week: 0, goods: [] };
  return s;
}

describe('viewFor (ONLINE_PLAN §3)', () => {
  it('has a plant, and so a test, for every SEAT_SECRETS row', () => {
    expect(PLANTS.map((p) => p.row).sort()).toEqual(SEAT_SECRETS.map((r) => r.field).sort());
  });

  for (const [label, table] of [
    ['4 humans + 2 AIs', [...humans(4), ...ais(2)]],
    ['8 humans', humans(8)],
  ] as const) {
    describe(label, () => {
      const base = midSeason([...table]);
      const ids = base.players.map((p) => p.id);
      const [a, b] = [ids[0]!, ids[1]!];
      BASE_LIES.set(base.players.length, player(base, a).stats.liesTold);

      it('never touches the state it is given', () => {
        const before = json(base);
        for (const id of ids) viewFor(base, id);
        expect(json(base)).toBe(before);
      });

      for (const pl of PLANTS) {
        describe(pl.row, () => {
          const planted = structuredClone(base);
          pl.plant(planted, a, b);

          it('the plant is there in the state', () => expect(pl.shows(planted, a, b)).toBe(true));

          it(`shown to ${pl.who === 'owner' ? 'its stable only' : 'nobody'}`, () => {
            for (const id of ids) {
              const allowed = pl.who === 'owner' && id === a;
              expect(pl.shows(viewFor(planted, id), a, b), `seat ${id}`).toBe(allowed);
            }
          });

          it('every seat not allowed it cannot tell the secret apart (indistinguishable)', () => {
            // Against the unplanted state, or against the twin where planting shows something too.
            const other = structuredClone(base);
            if (pl.twin) pl.twin(other, a, b);
            for (const id of ids) {
              if (pl.who === 'owner' && id === a) continue;
              expect(json(viewFor(planted, id)), `seat ${id}`).toBe(json(viewFor(other, id)));
            }
          });
        });
      }

      it('carries the rumours the whole state gives, and every seat hears the same', () => {
        const want = json(rumoursFor(base));
        for (const id of ids) expect(json(viewFor(base, id).rumours)).toBe(want);
      });
    });
  }

  it('hides nothing once the game is over', () => {
    const { s } = play({ seed: 42, players: [...humans(2), ...ais(2)] });
    const v = viewFor(s, s.players[0]!.id);
    const { rumours, ...rest } = v;
    expect(rumours).toBeDefined();
    expect(json(rest)).toBe(json(s));
  });
});
