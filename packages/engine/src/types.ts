/**
 * Core data model for Space Dog Racing. Everything here is plain JSON-serialisable data:
 * the whole GameState is the save file, and (seed + action log) reproduces it exactly.
 */

export type Id = string;

/**
 * A race is a **row**, not a member of a closed union (GDD §6.3, D2). The id is all that lives in
 * state — on a declaration, on a bet, on an archived result — and everything else hangs off
 * `content/raceTypes.ts`.
 *
 * ⚠️ **Three purse tiers, open entry (GDD_V3 §7.1, V15).** v2's seven fact-gated types are cut: they
 * rewarded a broad stable you *built*, and v3 deals you three dogs and has no market, so eligibility
 * would have been luck rather than planning. The depth moves into running styles and the shape of
 * the field (§5).
 */
export type RaceTypeId = 'bronzeDash' | 'silverPlate' | 'goldCup';

export const RACE_TYPE_IDS: readonly RaceTypeId[] = ['bronzeDash', 'silverPlate', 'goldCup'] as const;

/**
 * Three stats, not four (GDD_V3 §4.1).
 *
 * ⚠️ **Trap is folded into Acceleration, not deleted, and the difference matters.** v2 spent a phase
 * making Trap worth 15.3% of marginal win rate and then built the whole trap-draw mechanic on it
 * (D37: the rail is the short way round and also where the traffic is, worth +3.5 points on tight
 * bends). Deleting the stat would have made the box worthless again — exactly the hole the steward's
 * bribe fell into. Folding keeps the simulation's bend logic intact: `bendCraft` and the break from
 * the boxes read **Acceleration** instead, and the old 0.15 trap weight is absorbed into accel's
 * 0.20 to give 0.35 (GDD_V3 V9).
 */
export type StatKey = 'speed' | 'accel' | 'stamina';
export const STAT_KEYS: readonly StatKey[] = ['speed', 'accel', 'stamina'] as const;

/**
 * A thing a hold can carry (GDD §8.2, D4). One id per row in `content/goods.ts`.
 *
 * ⚠️ **v3 Phase A cut this to one row.** The four stat feeds × three tiers and the Rough/Proper/
 * Prime ladder they hung off are gone (BUILD_PLAN_V3 §2.1), and `kibble` is left standing as the
 * **placeholder single good** Phase A item 8 asks for, so the trade loop and the eating machinery
 * still run and the harness still has something to measure. **Phase B replaces this whole type
 * with GDD_V3 §6.1's six foods on 8× bands** — Grey Mash, Scrapmeat, Glow Tripe, Vat Steak, Pulsar
 * Marrow, Ambrosia — with shelf depth per planet. Do not add them here.
 */
export type GoodId = 'kibble';

/**
 * Every good, in the order a hold serialises and a market table prints.
 */
export const GOOD_IDS: readonly GoodId[] = ['kibble'] as const;

/**
 * What is in a stable's hold: crates per good.
 *
 * A dense record — every good is a key, most of them zero — rather than the sparse alternative.
 * `GameState` is the save file and the golden digest hashes `JSON.stringify(state)`, so a sparse
 * record would make the hash depend on the order a stable bought things in. See `economy/goods.ts`.
 */
export type Cargo = Record<GoodId, number>;

/**
 * What a dog does with its week (GDD_V3 §4.2). **Race −20 fitness, or Rest +30.** Set in the Kennels.
 *
 * ⚠️ **Train is cut, and it is a load-bearing simplification (GDD_V3 V8).** v2 had three states
 * because training was how food reached a dog. In v3 a dog **eats every week and gains its food's
 * bonus every week, whatever it is doing** (§6.3), so Train had nothing left to do except be a third
 * option that mostly resolved itself. Three dogs × a binary is three decisions a week; three dogs ×
 * a ternary is what pushed v2's click budget over, and §10.1 has cut that budget from 14.5 to 10.
 *
 * A dog that is injured is in a fourth state, **Layoff**, which is imposed rather than chosen and
 * recovers like Rest — so it is derived by `weekStatusOf()` and never stored, or the state on the Dog
 * would stop being the player's answer to the question.
 */
export type WeekState = 'race' | 'rest';
export const WEEK_STATES: readonly WeekState[] = ['race', 'rest'] as const;
/** What the Kennels shows: the two a player can pick, plus the one the stewards pick for them. */
export type WeekStatus = WeekState | 'layoff';

/** The three a player can pick. GDD §14: difficulty is decision quality, never a stat bonus. */
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'] as const;

/**
 * ⚠️ **The measurement agents are gone (BUILD_PLAN_V3 §2.1).**
 *
 * `careless` existed to measure `bankruptRate`, and there is no bankruptcy in v3 to measure
 * (GDD_V3 V10: no fuel, no upkeep, no wages, no debt — pillar 5 says nobody is out before the end).
 * `trainer` / `trader` / `crook` / `mixed` were v2 §20 Q2's three roads, and v3 has one road with a
 * trading sideline and a betting sideline; GDD_V3 §11 names the income split on the season-end
 * screen as the honest replacement.
 *
 * `AiAgent` is kept as a distinct name from `Difficulty` because every harness flag, save file and
 * seed link in the project reads it, and because Phase D or E may well want a measurement agent
 * again — for pace rather than for wealth.
 */
export type AiAgent = Difficulty;

export type Phase =
  | 'arrival' // system: roll turn order, planet stock and food prices
  | 'events' // each player draws one event; choice events pause for that player
  | 'planetPre' // in turn order: market, kennels, race office (declarations)
  | 'betting' // declarations are locked and public; in turn order players may bet
  | 'race' // system: simulate the card in order; pay purses; settle bets
  | 'planetPost' // in turn order: buy food
  | 'endTurn' // system: weekly costs, training, recovery, jump to the next planet
  | 'seasonEnd';

/** Phases where the engine waits for the active player to act and then send EndPhase. */
export const PLAYER_PHASES: readonly Phase[] = ['planetPre', 'betting', 'planetPost'] as const;

export type TrackLength = 'sprint' | 'standard' | 'staying';
export type BendKind = 'none' | 'wide' | 'medium' | 'tight';

export interface Track {
  distance: number; // metres: 350 / 480 / 600
  length: TrackLength;
  bends: BendKind;
  hazard: number; // injury multiplier, 1 = normal
  slippery?: boolean; // Glassfall: acceleration matters more
  mud?: boolean; // Mudlark bonus applies
}

export interface PlanetSpecial {
  noBetting?: boolean;
  bettingMargin?: number; // overrides balance.bettingMargin
  maxStakeFraction?: number; // overrides balance.maxStakeFraction
  everythingMarkup?: number; // Neon Snout: all market prices +x
  purseMult?: number; // Old Wembley: purse +20%
  winningsTax?: number; // Port Slobber: tax on prize money
  fitnessOnArrival?: number; // Sunbleach −5, Holy Bark +5
  turnOrderReversed?: boolean; // Blackreach
  localsNervy?: boolean; // Lagrange Lows
  piratesLikely?: boolean; // The Drift
}

export interface Planet {
  id: Id;
  name: string;
  event?: string; // Major event name e.g. "The Cosmodrome Classic"
  vibe: string;
  major: boolean;
  track: Track;
  foodBand: [number, number]; // buy price band
  special: PlanetSpecial;
  accents: [string, string];
}

export type TraitId =
  | 'railer'
  | 'wideRunner'
  | 'slowStarter'
  | 'mudlark'
  | 'fragile'
  | 'iron'
  | 'showboat'
  | 'glutton'
  | 'nervy'
  | 'sprinter'
  | 'stayer'
  | 'cheapDate'
  | 'primaDonna'
  | 'bouncesBack'
  | 'oldSoul'
  | 'badBlood';

export interface Trait {
  id: TraitId;
  name: string;
  blurb: string;
}

export interface Dog {
  id: Id;
  name: string;
  ownerId: Id | 'local';
  speed: number; // 1..99
  /** Also how well it breaks from the boxes and holds a line through a bend (GDD_V3 §4.1). */
  accel: number;
  stamina: number;
  rating: number; // 0..99, Elo-style
  fitness: number; // 0..100
  form: number; // −10..10
  age: number; // 1..7 seasons
  traits: TraitId[];
  injuryWeeks: number; // 0 = fit to race
  wins: number;
  runs: number;
  /** Gold Cup wins — the season's first tie-break (GDD_V3 §2.4). */
  goldCupWins: number;
  raceBonus: number; // temporary speed-stat bonus for this weekend's race (lucky bone)
  weekState: WeekState; // GDD_V3 §4.2 — Race or Rest
  /**
   * Which stat this dog's food is pointed at.
   *
   * ⚠️ **Nothing reads this in Phase A and it is kept on purpose.** Train is gone, so there is no
   * per-week stat choice left; but GDD_V3 §6.3's **sticky per-dog diet** — a named food, or best
   * available, or worst available — is the same field doing the same job for the six goods, and
   * Phase B replaces the type rather than adding a field. Deleting it would move the state shape
   * twice for one idea.
   */
  trainStat: StatKey;
  look: { body: number; palette: number; accessory: number };
}

export interface Player {
  id: Id;
  name: string;
  colour: number; // saddle-cloth colour index 0..7
  kind: 'human' | 'ai';
  difficulty?: AiAgent;
  personality?: string;
  cash: number;
  dogIds: Id[];
  /** Crates aboard, per good (GDD §8.2). */
  cargo: Cargo;
  flags: {
    arriveFirstNextWeek: boolean;
    tipOff: boolean; // a local runner is not trying this week
  };
  sponsorWeeks: number; // Glorbo's Meat Paste: dogs eat double
  fanClubDogId?: Id;
  stats: PlayerSeasonStats;
}

/** Running totals the harness reports on. */
export interface PlayerSeasonStats {
  prizeIncome: number;
  tradeIncome: number; // food sold − food bought
  betIncome: number; // returns − stakes
  costs: number; // food bought for eating
  worthByWeek: number[];
}

/**
 * What one good costs on this planet this week, and how much of it there is (GDD §9.1, §8.1).
 *
 * Price and stock are separate questions. Every planet posts a buy and a sell price for every
 * good — you can always sell into a market — but what is *on the shelf* is rolled per planet and
 * per week. `stock` is crates available to buy here and is decremented as they are bought, so the
 * shelf is shared with the whole table and turn order is first look.
 */
export interface GoodMarket {
  buy: number; // what you pay per crate
  sell: number; // what you get per crate
  stock: number; // crates on the shelf this week
}

export interface PlanetState {
  planetId: Id;
  /** This week's market, per good. */
  goods: Record<GoodId, GoodMarket>;
}

export interface CalendarEntry {
  week: number;
  planetId: Id;
  major: boolean;
  grandFinal: boolean;
}

export interface Bet {
  playerId: Id;
  week: number;
  race: RaceTypeId;
  dogId: Id;
  kind: 'win' | 'place';
  stake: number;
  odds: number; // decimal odds at the time of the bet
  settled?: { won: boolean; payout: number };
}

export interface RaceEntry {
  trap: number; // 1..8
  dogId: Id;
  ownerId: Id | 'local';
  name: string;
  rating: number;
  odds: number; // decimal win odds shown by the bookie
  winProb: number;
  placeProb: number;
  local: boolean;
}

export interface RaceEvent {
  tick: number;
  kind: 'bump' | 'leadChange' | 'finish';
  dogId: Id;
  otherId?: Id;
}

/** One race on the card once declarations lock: which race it is, and who is in it. */
export interface RaceField {
  race: RaceTypeId;
  entries: RaceEntry[];
}

export interface RaceResult {
  week: number;
  planetId: Id;
  race: RaceTypeId;
  purse: [number, number, number];
  entries: RaceEntry[];
  order: Id[]; // finishing order, dog ids
  finishTicks: Record<Id, number>;
  margin: number; // metres between 1st and 2nd at the winner's finish
  photoFinish: boolean;
  /** ticks[t][i] = distance (m) of entries[i] at tick t. Rounded to cm. Pruned at endTurn. */
  ticks: number[][];
  events: RaceEvent[];
  ratingDeltas: Record<Id, number>;
  injuries: Record<Id, number>; // dogId → weeks out
  payouts: { playerId: Id; dogId: Id; place: number; amount: number }[];
}

export interface PendingEvent {
  playerId: Id;
  eventId: Id;
  /** Data rolled when the card was drawn (which dog, how much) so the choice is well defined. */
  params: Record<string, number | string>;
  choices: string[];
}

export interface LogLine {
  week: number;
  phase: Phase;
  playerId?: Id;
  text: string;
}

export interface Toggles {
  betting: boolean;
  trading: boolean;
  casualEvents: boolean;
}

export interface GameState {
  version: number;
  seed: number;
  /** Serialised PRNG state; advanced by every random draw the reducer makes. */
  rng: number;
  week: number; // 1..13
  phase: Phase;
  calendar: CalendarEntry[];
  planet: PlanetState; // the planet we are on this week
  players: Player[];
  turnOrder: Id[];
  turnOrderReason: Record<Id, string>;
  activePlayer: Id | null;
  /** Players who have sent EndPhase in the current player phase. */
  done: Id[];
  dogs: Record<Id, Dog>;
  /**
   * race type → playerId → dogId. A record rather than a list because a declaration is
   * *addressed* to a race ("put this dog in the Maiden"), and every id is a key whether or not
   * this weekend's card happens to include it — an off-card race simply never gets an entry,
   * and `declare` refuses one.
   */
  declarations: Record<RaceTypeId, Record<Id, Id>>;
  locked: boolean; // declarations locked (betting open)
  /**
   * This week's fields and results, in run order — a list rather than a record because these are
   * iterated far more often than they are looked up, and because a `RaceResult` goes into the
   * archive, where a position would mean nothing and the `race` it carries means everything.
   */
  fields: RaceField[] | null;
  races: RaceResult[] | null;
  pendingEvent: PendingEvent | null;
  eventQueue: Id[]; // players still to draw an event this week
  bets: Bet[];
  results: RaceResult[]; // all past races (tick logs pruned)
  eventLog: LogLine[];
  toggles: Toggles;
  nextId: number;
  finalStandings: { playerId: Id; netWorth: number }[] | null;
}

export interface PlayerSetup {
  name: string;
  kind: 'human' | 'ai';
  difficulty?: AiAgent;
  colour?: number;
}

export interface SeasonSetup {
  seed: number;
  players: PlayerSetup[];
  toggles?: Partial<Toggles>;
}

export type Action =
  | { t: 'Declare'; playerId: Id; race: RaceTypeId; dogId: Id | null }
  | {
      t: 'PlaceBet';
      playerId: Id;
      race: RaceTypeId;
      dogId: Id;
      kind: 'win' | 'place';
      stake: number;
    }
  /** +buy / −sell, of one good. The `good` is what makes the hold a set of decisions. */
  | { t: 'TradeFood'; playerId: Id; good: GoodId; units: number }
  | { t: 'SetDogState'; playerId: Id; dogId: Id; state: WeekState; stat?: StatKey }
  | { t: 'ResolveEvent'; playerId: Id; choice: number }
  | { t: 'EndPhase'; playerId: Id }
  | { t: 'AdvancePhase' }; // system

export type ActionType = Action['t'];

export class ActionError extends Error {
  constructor(
    message: string,
    public readonly action: Action,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}
