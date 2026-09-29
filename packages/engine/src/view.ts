import { rumoursFor } from './rumours';
import { EVENT_BY_ID } from './content/events';
import { GOOD_IDS, type GameState, type Id, type PlayerSeasonStats } from './types';

/**
 * **What one seat may see** (ONLINE_PLAN §3, GDD_V3 V24): the room holds the game, and each browser is
 * sent `viewFor(state, seat)` — never the state. Pillar 4, "the scoreboard is public, the future is
 * not", holds by construction: a browser that was never sent a secret cannot show it, by a UI slip or
 * in devtools.
 *
 * A view is **the same type as the state**, a redacted deep copy, so every screen reads a view exactly
 * as it reads a state. What is redacted is a table, `SEAT_SECRETS`, one row per secret with the field,
 * what it gives away, who may see it and what the view does: **a new secret field is a row and a test,
 * not a hunt.** Anything not in the table is public — cash, cargo, every dog's stats, declarations, the
 * locked fields, races and results, the Stewards' findings, turn order, `done`, standings, staff.
 *
 * The view also carries what the room works out and the seat cannot: the Saloon's `rumours`, which
 * read the seed and the calendar two weeks out.
 *
 * **Once the game is over there are no secrets**: the view is the whole state (plus the rumours), and
 * the room sends the log and the seed with it (ONLINE_PLAN §2.6).
 *
 * Pure, and it never touches the state it is given. Nothing here is a rule; the room is the only
 * caller that matters, and hotseat never calls it.
 */
export function viewFor(s: GameState, seat: Id): GameState {
  const v = structuredClone(s);
  const rumours = rumoursFor(s);
  if (s.gameOver === null && s.phase !== 'seasonEnd')
    for (const row of SEAT_SECRETS) row.redact(v, seat, s);
  v.rumours = rumours;
  return v;
}

export interface SeatSecret {
  /** The field, as a path a reader can find in `types.ts`. */
  field: string;
  /** What it would give away. */
  secret: string;
  /** Who may see it. */
  who: string;
  /** Redact `v` (a deep copy of `full`) for `seat`, in place. */
  redact: (v: GameState, seat: Id, full: GameState) => void;
}

/** A stable's own-only stats, zeroed on every other stable: each moves at a private moment. */
const PRIVATE_STATS: readonly Exclude<keyof PlayerSeasonStats, 'worthByWeek'>[] = [
  'betIncome', // a stake leaves at the Bookie, before the book is public (§3)
  'dogOffers', // counted when a Pound card is drawn: it names the door (§9.1)
  'dogsTaken',
  'liesTold',
  'liesCaught',
  'tips', // a race-day tip is private (§9.4)
  'nobbles', // counted when a nobble is booked, before it lands (§9.3)
  'nobblesLanded',
  'nobbled',
  'boxes', // counted when a box is bought, before the lock
  'boxesUsed',
  'staffOffers', // a Bar card, behind a door
  'staffHired',
];

/** The keys of a pending card's `params` a screen reads: the rest is the card's own dice. */
const DISPLAY_PARAMS: readonly string[] = ['staffId', 'offerName'];

/** A pending Pound offer whose patter lies was counted in `liesTold` the moment it was rolled. */
function pendingLie(s: GameState, playerId: Id): boolean {
  const e = s.pendingEvent;
  return (
    !!e &&
    e.playerId === playerId &&
    e.params.offerName !== undefined &&
    Number(e.params.lie) === 1 &&
    EVENT_BY_ID[e.eventId]?.category === 'pound'
  );
}

/**
 * The secret list (ONLINE_PLAN §3.1), walked field by field from `GameState` at `v3j`. Order matters
 * only where a row reads what another has already redacted, and none does: each reads `full`.
 */
export const SEAT_SECRETS: readonly SeatSecret[] = [
  {
    field: 'seed, rng',
    secret: 'every future draw',
    who: 'nobody until the game is over',
    redact: (v) => {
      v.seed = 0;
      v.rng = 0;
    },
  },
  {
    field: 'calendar[w].planetId, w > week + 1',
    secret: 'the circuit past next week (§2.1’s fog)',
    who: 'nobody (the Grand Final is Collar Prime, and public)',
    redact: (v) => {
      for (const e of v.calendar) if (e.week > v.week + 1 && !e.grandFinal) e.planetId = '';
    },
  },
  {
    field: 'nextPlanet.goods',
    secret: 'next week’s market (§9.4)',
    who: 'a stable holding `intel` for next week, for those goods',
    redact: (v, seat, full) => {
      if (!v.nextPlanet) return;
      const me = full.players.find((p) => p.id === seat);
      const known = me && me.intel.week === full.week + 1 ? me.intel.goods : [];
      for (const g of GOOD_IDS)
        if (!known.includes(g)) v.nextPlanet.goods[g] = { buy: 0, sell: 0, stock: 0 };
    },
  },
  {
    field: 'explore.seeds',
    secret: 'every stable’s Explore stream: every card behind every door',
    who: 'nobody',
    redact: (v) => {
      if (v.explore) v.explore.seeds = {};
    },
  },
  {
    field: 'explore.picks, explore.cards',
    secret: 'which door a stable opened, and what was behind it',
    who: 'that stable',
    redact: (v, seat) => {
      if (!v.explore) return;
      v.explore.picks = seat in v.explore.picks ? { [seat]: v.explore.picks[seat]! } : {};
      v.explore.cards = seat in v.explore.cards ? { [seat]: v.explore.cards[seat]! } : {};
    },
  },
  {
    field: 'explore.taken',
    secret: 'which one-of-a-kind cards others drew (it gives away doors)',
    who: 'nobody',
    redact: (v) => {
      if (v.explore) v.explore.taken = [];
    },
  },
  {
    field: 'pendingEvent (another stable’s)',
    secret: 'their card',
    who: 'its owner',
    redact: (v, seat) => {
      if (v.pendingEvent && v.pendingEvent.playerId !== seat) v.pendingEvent = null;
    },
  },
  {
    field: 'pendingEvent.params, pendingEvent.rng',
    secret: 'an offered dog’s true stats and whether the patter lies; the dice behind a gamble',
    who: 'nobody, not even its owner (the card’s `detail` is what it shows)',
    redact: (v) => {
      const e = v.pendingEvent;
      if (!e) return;
      const kept: Record<string, number | string> = {};
      for (const k of DISPLAY_PARAMS) if (e.params[k] !== undefined) kept[k] = e.params[k]!;
      e.params = kept;
      e.rng = 0;
    },
  },
  {
    field: 'players[].stats.liesTold',
    secret: 'counted when an offer is rolled, so it says “he’s lying” before the choice',
    who: 'the stable, once it has chosen',
    redact: (v, _seat, full) => {
      for (const p of v.players) if (pendingLie(full, p.id)) p.stats.liesTold--;
    },
  },
  {
    field: 'players[].stats (the private counters)',
    secret: 'bets, offers, tips, nobbles and boxes, counted the moment they happen',
    who: 'that stable (the season’s archive is public once it ends)',
    redact: (v, seat) => {
      for (const p of v.players) if (p.id !== seat) for (const k of PRIVATE_STATS) p.stats[k] = 0;
    },
  },
  {
    field: 'dogs[d].style where !styleKnown',
    secret: 'a style that has not raced (§5.4)',
    who: 'nobody, the owner included',
    redact: (v) => {
      for (const d of Object.values(v.dogs)) if (!d.styleKnown) d.style = 'stalker';
    },
  },
  {
    field: 'dogs[d].raceBonus (another stable’s)',
    secret: 'a card’s edge for this weekend’s race (the lucky bone)',
    who: 'the dog’s owner',
    redact: (v, seat) => {
      for (const d of Object.values(v.dogs)) if (d.ownerId !== seat) d.raceBonus = 0;
    },
  },
  {
    field: 'conditions',
    secret: 'a hidden knock, off-feed or buzz (§9.4)',
    who: 'the stables it `tipped` (not the owner, unless tipped)',
    redact: (v, seat) => {
      v.conditions = v.conditions
        .filter((c) => c.tipped.includes(seat))
        .map((c) => ({ ...c, tipped: [seat] }));
    },
  },
  {
    field: 'jobs',
    secret: 'a nobble booked, a box bought, before they land',
    who: 'the stable that booked it',
    redact: (v, seat) => {
      v.jobs = v.jobs.filter((j) => j.by === seat);
    },
  },
  {
    field: 'bets (another stable’s)',
    secret: 'rivals’ slips (§3)',
    who: 'their owner; the season’s archived moments later',
    redact: (v, seat) => {
      v.bets = v.bets.filter((b) => b.playerId === seat);
    },
  },
  {
    field: 'players[].intel',
    secret: 'what a Bar card told a stable',
    who: 'that stable',
    redact: (v, seat) => {
      for (const p of v.players) if (p.id !== seat) p.intel = { week: 0, goods: [] };
    },
  },
  {
    field: 'players[].flags',
    secret: 'the result of a private card (a tip-off, arriving first or last next week)',
    who: 'that stable, until arrival makes it public',
    redact: (v, seat) => {
      for (const p of v.players)
        if (p.id !== seat)
          p.flags = { arriveFirstNextWeek: false, arriveLastNextWeek: false, tipOff: false };
    },
  },
  {
    field: 'players[].paid',
    secret: 'You Paid (§6.2)',
    who: 'that stable',
    redact: (v, seat) => {
      for (const p of v.players) if (p.id !== seat) for (const g of GOOD_IDS) p.paid[g] = 0;
    },
  },
  {
    field: 'offSeason.notices',
    secret: 'a retirement offer (true stats, the lie), the draft, a candidate',
    who: 'that stable, as §9.2 shows it',
    redact: (v, seat) => {
      if (!v.offSeason) return;
      const n = v.offSeason.notices[seat];
      v.offSeason.notices = {};
      if (!n) return;
      const shown = String(n.offer.shown);
      const offer: Record<string, number | string> = {};
      for (const k of ['offerName', 'age', 'shown', 'claimed', shown])
        if (n.offer[k] !== undefined) offer[k] = n.offer[k]!;
      n.offer = offer;
      delete n.logLines;
      v.offSeason.notices[seat] = n;
    },
  },
  {
    field: 'eventLog lines with a playerId',
    secret: 'private card text, tips, “your man got to…”',
    who: 'that stable (the hub already filters so)',
    redact: (v, seat) => {
      v.eventLog = v.eventLog.filter((l) => !l.playerId || l.playerId === seat);
    },
  },
];
