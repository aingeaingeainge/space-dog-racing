/**
 * Core data model for Space Dog Racing. Everything here is plain JSON-serialisable data:
 * the whole GameState is the save file, and (seed + action log) reproduces it exactly.
 */

export type Id = string;

export type RaceClass = 'bronze' | 'silver' | 'gold';
export const RACE_CLASSES: readonly RaceClass[] = ['bronze', 'silver', 'gold'] as const;

export type StatKey = 'speed' | 'accel' | 'stamina' | 'trap';
export const STAT_KEYS: readonly StatKey[] = ['speed', 'accel', 'stamina', 'trap'] as const;

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Phase =
  | 'arrival' // system: roll turn order, planet stock and food prices
  | 'events' // each player draws one event; choice events pause for that player
  | 'planetPre' // in turn order: market, kennels, docks, saloon, race office (declarations)
  | 'betting' // declarations are locked and public; in turn order players may bet
  | 'race' // system: simulate Bronze, Silver, Gold; pay purses; settle bets
  | 'planetPost' // in turn order: sell dogs, buy food, borrow …
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

export type StaffRole = 'trainer' | 'vet' | 'fixer';

export interface PlanetSpecial {
  bank?: boolean;
  shark?: boolean;
  fixer?: boolean;
  vet?: boolean;
  trainer?: boolean;
  noBetting?: boolean;
  bettingMargin?: number; // overrides balance.bettingMargin
  maxStakeFraction?: number; // overrides balance.maxStakeFraction
  dopingCatch?: number; // overrides balance.supplementCatchBase
  buyerBonus?: number; // buyers pay +x of value when you sell a dog here
  dogValueMod?: number; // multiplier on market asking prices (and sale prices) here
  shipDiscount?: number; // fraction off ship upgrades
  engineDiscount?: number; // fraction off engine tier only
  kennelDiscount?: number; // fraction off the kennel module
  everythingMarkup?: number; // Neon Snout: all market prices +x
  purseMult?: number; // Old Wembley: purse +20%
  winningsTax?: number; // Port Slobber: tax on prize money
  fitnessOnArrival?: number; // Sunbleach −5, Holy Bark +5
  noUpkeep?: boolean; // Holy Bark
  turnOrderReversed?: boolean; // Blackreach
  foodSpoils?: number; // Glassfall: fraction of cargo lost without a cold store
  localsNervy?: boolean; // Lagrange Lows
  marketAgeBias?: 'old' | 'pups'; // Rustgut / Vatgrown
  marketQualityBonus?: number; // Majors sell Gold-class dogs
  fellOffAShip?: boolean; // Hushmarket
  muzzles?: boolean; // Tinkertown
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
  marketBias: string;
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
  ownerId: Id | 'market' | 'local';
  speed: number; // 1..99
  accel: number;
  stamina: number;
  trap: number;
  rating: number; // 0..99, Elo-style
  fitness: number; // 0..100
  form: number; // −10..10
  age: number; // 1..7 seasons
  traits: TraitId[];
  injuryWeeks: number; // 0 = fit to race
  banWeeks: number; // stewards' ban after a doping catch
  wins: number;
  runs: number;
  goldWins: number;
  supplemented: boolean; // supplement fed this weekend (cleared after the race)
  raceBonus: number; // temporary speed-stat bonus for this weekend's race (supplement, lucky bone)
  askingPrice?: number; // while ownerId === 'market'
  fellOffAShip?: number; // week the real owner may turn up (Hushmarket)
  look: { body: number; palette: number; accessory: number };
}

export type StaffId = string;

export interface Ship {
  speed: number; // engine tier 1..5
  cargoCap: number;
  coldStore: boolean;
  upgradesPaid: number; // total Bones spent on upgrades (resale = ×shipResaleFactor)
}

export interface Loan {
  lender: 'bank' | 'shark';
  principal: number;
}

export interface Player {
  id: Id;
  name: string;
  colour: number; // saddle-cloth colour index 0..7
  kind: 'human' | 'ai';
  difficulty?: Difficulty;
  personality?: string;
  cash: number;
  dogIds: Id[];
  kennelSlots: number;
  ship: Ship;
  cargo: number; // food units aboard
  staff: Partial<Record<StaffRole, StaffOffer>>;
  training?: { dogId: Id; stat: StatKey };
  loans: Loan[];
  flags: {
    caughtDoping: boolean;
    bankrupt: boolean;
    arriveFirstNextWeek: boolean;
    rivalTrap8: boolean; // dodgy steward: rival's best Gold dog drawn trap 8 this week
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
  costs: number; // upkeep, wages, fuel, food bought for eating
  dogsBought: number;
  dogsSold: number;
  supplementsUsed: number;
  supplementsCaught: number;
  worthByWeek: number[];
}

export interface StaffOffer {
  id: StaffId;
  role: StaffRole;
  name: string;
  wage: number;
  quirk?: string;
}

export interface PlanetState {
  planetId: Id;
  foodBuy: number; // what you pay per unit
  foodSell: number; // what you get per unit
  foodMod: number; // event-driven multiplier (glut/shortage) until you leave
  marketDogIds: Id[];
  staff: StaffOffer[];
  muzzlesInStock: boolean;
  trackDayPasses: boolean;
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
  cls: RaceClass;
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

export interface RaceResult {
  week: number;
  planetId: Id;
  cls: RaceClass;
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
  dopingCaught: Id[]; // dog ids
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
  cleanSport: boolean;
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
  declarations: Record<RaceClass, Record<Id, Id>>; // cls → playerId → dogId
  locked: boolean; // declarations locked (betting open)
  fields: Record<RaceClass, RaceEntry[]> | null; // this week's fields once declarations lock
  races: Record<RaceClass, RaceResult> | null; // this week's races once run
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
  difficulty?: Difficulty;
  colour?: number;
}

export interface SeasonSetup {
  seed: number;
  players: PlayerSetup[];
  toggles?: Partial<Toggles>;
}

export type UpgradeId =
  'engine' | 'cargo' | 'kennel' | 'coldStore' | 'trackDay' | 'muzzle' | 'supplement';

export type Action =
  | { t: 'BuyDog'; playerId: Id; dogId: Id }
  | { t: 'SellDog'; playerId: Id; dogId: Id }
  | { t: 'Declare'; playerId: Id; cls: RaceClass; dogId: Id | null }
  | { t: 'PlaceBet'; playerId: Id; cls: RaceClass; dogId: Id; kind: 'win' | 'place'; stake: number }
  | { t: 'TradeFood'; playerId: Id; units: number } // +buy / −sell
  | { t: 'HireStaff'; playerId: Id; role: StaffRole; staffId: StaffId }
  | { t: 'FireStaff'; playerId: Id; role: StaffRole }
  | { t: 'SetTraining'; playerId: Id; dogId: Id | null; stat: StatKey }
  | { t: 'BuyUpgrade'; playerId: Id; upgrade: UpgradeId; dogId?: Id }
  | { t: 'Borrow'; playerId: Id; lender: 'bank' | 'shark'; amount: number }
  | { t: 'Repay'; playerId: Id; lender: 'bank' | 'shark'; amount: number }
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
