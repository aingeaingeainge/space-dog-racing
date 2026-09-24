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

export const RACE_TYPE_IDS: readonly RaceTypeId[] = [
  'bronzeDash',
  'silverPlate',
  'goldCup',
] as const;

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
 * A thing a hold can carry: one of GDD_V3 §6.1's six foods, which are simultaneously the game's
 * trade goods and its training programme (§6.3, V5). One id per row in `content/goods.ts`.
 *
 * Phase A left `kibble` here as a placeholder single good; Phase B replaces it outright.
 */
export type GoodId =
  'greyMash' | 'scrapmeat' | 'glowTripe' | 'vatSteak' | 'pulsarMarrow' | 'ambrosia';

/**
 * Every good, cheapest first — the order a hold serialises, a market table prints and a tie breaks.
 *
 * ⚠️ **This order is canonical and must never be changed.** `emptyCargo()` builds the dense
 * `Cargo` record in this order, and the golden digest hashes `JSON.stringify(state)`, so the order
 * of these six strings is part of every save file's hash. Cheapest-first was chosen once, because it
 * is also the order §6.1 prints them in and the order a player reads the market in; re-ordering it
 * for any reason — alphabetical, "most interesting first" — would move every snapshot in the project
 * without changing a single rule.
 */
export const GOOD_IDS: readonly GoodId[] = [
  'greyMash',
  'scrapmeat',
  'glowTripe',
  'vatSteak',
  'pulsarMarrow',
  'ambrosia',
] as const;

/**
 * What a dog is fed, set once in the Kennel and sticky (GDD_V3 §6.3). Not a weekly click.
 *
 * - `named` — this food whenever there is some aboard;
 * - `best` — the dearest food aboard, by its place on the §6.1 ladder;
 * - `worst` — the cheapest food aboard, by the same ladder.
 *
 * Whatever the setting, a dog whose choice is not aboard **falls back to the cheapest thing
 * aboard** (§6.3), and a dog the hold cannot feed at all loses `emptyHoldFitness`.
 *
 * "Best" and "worst" are the good's place on the ladder, never this week's price: a diet is a
 * standing order, and a standing order cannot depend on a draw the owner has not seen.
 *
 * ⚠️ **This replaced `Dog.trainStat`, a `StatKey`**, which Phase A kept as a placeholder diet
 * pointer that nothing read. It is a stored-state change — see `STATE_VERSION`.
 */
export type Diet = { kind: 'named'; good: GoodId } | { kind: 'best' } | { kind: 'worst' };

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
  | 'explore' // in turn order, each stable picks one of the planet's three doors (GDD_V3 §9.1)
  | 'planetPre' // in turn order: market, kennels, race office (declarations)
  | 'betting' // declarations are locked and public; in turn order players may bet
  | 'race' // system: simulate the card in order; pay purses; settle bets
  | 'planetPost' // in turn order: buy food
  | 'endTurn' // system: weekly costs, training, recovery, jump to the next planet
  | 'newSeason' // system: re-draw the circuit, reset prices and the season's stats (GDD_V3 §2.2 step 4)
  /**
   * ⚠️ **The game is over** — the last season has ended, or a Target was crossed (GDD_V3 §2.1). The
   * name is v1's and is kept because every screen, script and test that asks "is it over?" asks it
   * of this phase; in a multi-season game a season that is *not* the last one ends into the
   * off-season instead, and never reaches here.
   */
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
  purseMult?: number; // Old Wembley: purse +20%
  winningsTax?: number; // Port Slobber: tax on prize money
  fitnessOnArrival?: number; // Sunbleach −5, Holy Bark +5
  turnOrderReversed?: boolean; // Blackreach
  piratesLikely?: boolean; // The Drift
  /** The stewards' catch chance for a nobble here (GDD_V3 §9.3); `catchChance` if absent. */
  catchChance?: number;
}

/**
 * GDD_V3 §9.1's five places a stable can poke around: where everything unpredictable comes from.
 *
 * - **pound** — dogs: offers, strays, a vet who shortens a layoff;
 * - **bar** — people and talk: price tips, race-day whispers, rumours;
 * - **alley** — trouble: stolen food, shakedowns, whispers bought rather than overheard;
 * - **strip** — money and food: sponsors, card games, fines, free crates;
 * - **track** — racing: trials, gallops, a private match.
 *
 * Canonical order: the order a harness table prints and a screen legends them.
 */
export type DoorCategory = 'pound' | 'bar' | 'alley' | 'strip' | 'track';
export const DOOR_CATEGORIES: readonly DoorCategory[] = [
  'pound',
  'bar',
  'alley',
  'strip',
  'track',
] as const;

/**
 * One of a planet's three Explore doors (GDD_V3 §9.1, §12): a name in the planet's own voice, the
 * category behind it, and one line under the name. Holy Bark's Back Alley is not "the Back Alley",
 * it is the Confessional. **A door is a row**, and what it opens onto is its category's deck.
 */
export interface ExploreDoor {
  name: string;
  category: DoorCategory;
  blurb: string;
}

export interface Planet {
  id: Id;
  name: string;
  event?: string; // Major event name e.g. "The Cosmodrome Classic"
  vibe: string;
  major: boolean;
  track: Track;
  /**
   * Where each good's price tends to sit on this planet — the trader's whole map (GDD_V3 §12).
   *
   * ⚠️ **This field changed meaning in v3 Phase B, and the name was kept on purpose because §12 uses
   * it.** It was an absolute price band for the one staple — `[80, 110]` — and it is now a
   * **multiplier per good over the mid-band centre**: 1.0 is a planet where that food typically
   * prices in the middle of its §6.1 band, 0.6 one where it sits in the cheap part, 1.4 one where it
   * sits in the dear part. It moves where the week's price *clusters*, never the band itself, which
   * is §6.1's hard 8× from floor to ceiling for every planet — see `rollGoodPrices` and decision B2.
   */
  foodBand: Record<GoodId, number>;
  special: PlanetSpecial;
  accents: [string, string];
  /**
   * The three places a stable can poke around here (GDD_V3 §9.1, §12) — **where planet character
   * lives in v3**, now the market variation, the ship shop and the staff hall are gone. Three
   * different categories, never two of one.
   */
  exploreDoors: [ExploreDoor, ExploreDoor, ExploreDoor];
}

export type TraitId =
  'railer' | 'wideRunner' | 'mudlark' | 'fragile' | 'iron' | 'showboat' | 'glutton' | 'badBlood';

/**
 * How a dog runs its race (GDD_V3 §5.1): **front-runner, stalker or closer**. One id per row in
 * `content/styles.ts`, and the simulation reads the row — it never branches on which style it is.
 *
 * ⚠️ **A style is a redistribution of the same energy, not a bonus.** A front-runner is quicker
 * early and fades sooner; a closer is slower early and fades later and softer. Across a field of
 * one of each, none of the three should win systematically — `--styles` prints that check, and
 * every measurement after it assumes it holds.
 */
export type StyleId = 'frontRunner' | 'stalker' | 'closer';
/** Canonical order — the order a stable is dealt them, a screen lists them, and a save hashes them. */
export const STYLE_IDS: readonly StyleId[] = ['frontRunner', 'stalker', 'closer'] as const;

export interface RunningStyle {
  id: StyleId;
  name: string;
  /** Top speed × this over the early part of the race, scaled by the day's expression (§5.2). */
  earlySpeed: number;
  /** Moves the fade point, in the fade point's own units; negative is earlier. Scaled likewise. */
  fadeShift: number;
  /** × the fade penalty once the dog is fading. Scaled likewise. */
  fadeMult: number;
  /**
   * Whether two of these at the head of the field make the pace hot (GDD_V3 §5.3, decision C12).
   * A row, not a branch: the rule counts runners whose style says so and never asks for a name.
   */
  lightsPace: boolean;
  /**
   * What the bookie adds to a dog's rating for this style, by trip, **once the style is public**
   * (GDD_V3 §5.6). Rating points. The book sees the style and the track; it does not see the
   * field — which other styles are in the race with it — and that is deliberate.
   */
  bookEdge: Record<TrackLength, number>;
  /** One line a player reads on the dog card. */
  blurb: string;
}

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
  /**
   * How it runs (GDD_V3 §5.1). Dealt one of each to a stable (§5.5); drawn at random for a local.
   * Always stored — what is hidden is whether the *table* knows it, which is `styleKnown`.
   */
  style: StyleId;
  /**
   * Whether the style is public (GDD_V3 §5.4): false until the dog races, then true for everyone.
   *
   * ⚠️ **A boolean, not a set of player ids, and the choice was made on purpose.** BUILD_PLAN_V3
   * Phase C offered both. A set would be right if stables learned a style at different times, but the
   * only way a style becomes known is racing, and a race is watched by the whole table at once — so
   * the set would always be either empty or everybody. Nobody gets to know it privately, *including
   * its owner*: §5.5's "a player who has identified two knows the third" only makes sense if the
   * owner is finding out by racing too. And since the deal is public, that elimination is open to
   * everyone, so the engine does it for them (`revealStyles`) — §5.4's reason: a game that rewards
   * note-taking rewards whoever brought a pen. Locals are known from the start (the form guide).
   */
  styleKnown: boolean;
  /**
   * One of the three this stable was dealt (GDD_V3 §5.5). The table knows a dealt three is one of each
   * style, so `revealStyles` can eliminate among them; a dog acquired by event (§9.2) is not part of
   * that deal and is never inferred — it shows itself by racing, or at a trial.
   */
  dealt: boolean;
  injuryWeeks: number; // 0 = fit to race
  wins: number;
  runs: number;
  /** Gold Cup wins — the season's first tie-break (GDD_V3 §2.4). */
  goldCupWins: number;
  raceBonus: number; // temporary speed-stat bonus for this weekend's race (lucky bone)
  weekState: WeekState; // GDD_V3 §4.2 — Race or Rest
  /** GDD_V3 §6.3's sticky diet: what this dog reaches for at the jump. */
  diet: Diet;
  /**
   * What it ate at the last jump, or null if it went hungry (or has not eaten yet).
   *
   * Stored because a food's effect can outlast the jump it was eaten at: §6.3's Ambrosia halves
   * the injury chance "this week", and a dog eats at the *end* of its week, after its races — so
   * the week the halving protects is the next one, and race day reads it from here. It is a fact
   * about the dog, not a rule about Ambrosia; any row with an `injuryMult` below 1 does the same.
   */
  lastMeal: GoodId | null;
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
  /**
   * What this stable paid per crate for what is in its hold, per good — §6.2's **You Paid**.
   *
   * ⚠️ **A running average, not FIFO**, and that is a decision (B4): a purchase moves the average
   * toward its own price in proportion to the crates it adds; a sale, a dinner, a spoiled crate or
   * a pirate's cut takes crates out *at* the average and leaves it where it was; a crate that
   * arrives free (an event) comes in at zero and pulls the average down, because you did not pay
   * for it. FIFO would need a list of lots per good in the save file and a column a player cannot
   * check in their head; one number per good is what Gazillionaire printed and what "did I pay
   * more than this?" actually asks.
   *
   * Zero whenever that good's hold is zero — kept true by `settleHold` at the end of every action,
   * so the save never carries an average for crates that are not there.
   */
  paid: Cargo;
  flags: {
    arriveFirstNextWeek: boolean;
    /** A fried navicomp (the Solar flare card): lands last next week, whatever the score. */
    arriveLastNextWeek: boolean;
    tipOff: boolean; // a local runner is not trying this week
  };
  sponsorWeeks: number; // Glorbo's Meat Paste: dogs eat double
  /**
   * The styles of dealt dogs this stable has let go (GDD_V3 §9.2), as the table knew them when they
   * left: the style if it was public, null if it was not. What `revealStyles` needs to keep the §5.5
   * elimination sound once a stable no longer holds the three it was dealt (decision C4's caveat).
   */
  dealtGone: (StyleId | null)[];
  /**
   * What a Bar card told this stable about next week's shelf (GDD_V3 §9.4): the goods whose price at
   * `week` it knows. Stale once `week` has passed.
   */
  intel: { week: number; goods: GoodId[] };
  /**
   * Its trainers (GDD_V3 §8): at most `staffSlots` ids of `content/staff.ts` rows. Dealt at the start
   * of a game; changed only by a Bar card in Phase D.
   */
  staff: Id[];
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
  /** Dogs offered to this stable in the Pound (GDD_V3 §9.2), and how many it took. */
  dogOffers: number;
  dogsTaken: number;
  /** Offers where the seller lied, and how many of those this stable took — and so found out. */
  liesTold: number;
  liesCaught: number;
  /** Race-day tips this stable was given (Phase D1 item 6). */
  tips: number;
  /**
   * What its trainers took from its purses (GDD_V3 §8.1). `prizeIncome` is what it banked, after
   * the cut, so the purse a dog won is `prizeIncome + commission`.
   */
  commission: number;
  /**
   * Sabotage (GDD_V3 §9.3): nobbles booked, and how many bit (the dog ran); times the stewards caught
   * this stable, and what they fined it; times one of its own dogs was nobbled and ran on it.
   */
  nobbles: number;
  nobblesLanded: number;
  caught: number;
  fines: number;
  nobbled: number;
  /** Trap draws bought from a steward, and how many were spent on a box that was honoured. */
  boxes: number;
  boxesUsed: number;
  /** Trainers offered to this stable in the Bar (§8.2's "two or three swings"), and how many it hired. */
  staffOffers: number;
  staffHired: number;
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
  /** Its style, if the table knows it when the field is posted (GDD_V3 §5.4); null if not yet. */
  style: StyleId | null;
  /**
   * The rating the bookie priced: `rating` plus the style's `bookEdge` on this trip if the style is
   * public (GDD_V3 §5.6). What the odds were struck on, so an agent re-pricing a field uses the
   * book's own ruler.
   */
  bookRating: number;
  odds: number; // decimal win odds shown by the bookie
  winProb: number;
  placeProb: number;
  local: boolean;
}

export interface RaceEvent {
  tick: number;
  /**
   * `hotPace` is GDD_V3 §5.3's hot pace lighting: the first tick two front-runners are taking each
   * other on at the head of the field (`dogId` and `otherId`). Once a race at most.
   */
  kind: 'bump' | 'leadChange' | 'finish' | 'hotPace';
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
  /**
   * How each runner ran, index-aligned with `entries` (GDD_V3 §5.2, §7.5): its style and the day's
   * expression, rounded to 2 dp. The race view's commentary reads this to say "went off like a
   * rocket" rather than guessing it from the tick log, and it is safe to show: once a dog has raced,
   * its style is public anyway.
   */
  runs: RunNote[];
  injuries: Record<Id, number>; // dogId → weeks out
  /** Nobblers the stewards caught in this race (GDD_V3 §9.3). The whole table is told. */
  stewards: StewardsFinding[];
  /**
   * What each placed stable dog banked (`amount`, after the trainers' cut) and what its trainers took
   * (`commission`, GDD_V3 §8.1).
   */
  payouts: { playerId: Id; dogId: Id; place: number; amount: number; commission: number }[];
}

/** How one runner ran one race (see `RaceResult.runs`). */
export interface RunNote {
  style: StyleId;
  /** The day's style expression, U(0.30, 1.30) (§5.2), 2 dp. */
  expression: number;
  /**
   * How much of the hot-pace window (§5.3) it ran in a hot lead group: 0 never, 1 the whole window,
   * 2 dp. Its fade point moved `hotPaceFadeCost ×` this many metres earlier.
   */
  hot: number;
}

export interface PendingEvent {
  playerId: Id;
  eventId: Id;
  /** Data rolled when the card was drawn (which dog, how much) so the choice is well defined. */
  params: Record<string, number | string>;
  choices: string[];
  /** Which of the planet's three doors it came from (GDD_V3 §9.1). */
  door: number;
  /** What this stable is shown beyond the card's text — a dog offer's age, stat and patter. */
  detail?: string;
  /**
   * The stable's own Explore stream, as it stood after the card was rolled. The choice's effect
   * continues it, so what a stable picks never touches the draws anybody else gets (decision D1).
   */
  rng: number;
}

/**
 * This weekend's Explore (GDD_V3 §9.1).
 *
 * ⚠️ **Every stable explores on its own stream, seeded at arrival** (decision D1). One draw from the
 * game's stream per stable, made at arrival in seating order before anybody has picked, so the
 * main stream never depends on which door anybody opens, what the card behind it was, or what they
 * chose — and a stable's own draws never depend on anybody else's door.
 */
export interface ExploreState {
  /** Each stable's Explore stream seed for the week. */
  seeds: Record<Id, number>;
  /** The door each stable opened (0–2), once it has. */
  picks: Record<Id, number>;
  /** What was behind it, once drawn: the card id, or '' if the door was empty. */
  cards: Record<Id, Id>;
  /**
   * Cards that are one of a kind on a planet-week (a particular dog in the Pound) and have been
   * drawn. Contention is resolved in turn order: the first stable through the door gets it and the
   * next draws something else (§2.3 step 2).
   */
  taken: Id[];
}

/** A race-day condition's row id (`content/conditions.ts`). */
export type ConditionId = 'knock' | 'offFeed' | 'buzzing';

/**
 * A hidden condition on a stable dog this weekend (Phase D1 item 6): drawn at arrival, applied to
 * the runner on race day, never priced by the book, and known only to the stables a tip has told —
 * **not to the owner**, unless the owner was tipped too.
 */
export interface RaceDayCondition {
  dogId: Id;
  condition: ConditionId;
  /** The stables that have been told. */
  tipped: Id[];
}

/**
 * A job booked in the Back Alley this weekend (GDD_V3 §9.3). Cleared at the jump.
 *
 * - `nobble`: booked against a rival's **dog**, because Explore comes before the Race Office — it
 *   bites if that dog runs this weekend, whatever race it runs in.
 * - `box`: the right to choose a box, bought at Explore and spent with `ChooseBox` once the race is
 *   known; `race` and `box` are set when it is spent.
 */
export interface Job {
  by: Id;
  kind: 'nobble' | 'box';
  dogId?: Id;
  race?: RaceTypeId;
  box?: number;
}

/** A nobbler the stewards caught (GDD_V3 §9.3): public, on the log and on Results. */
export interface StewardsFinding {
  playerId: Id;
  dogId: Id;
  fine: number;
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

/**
 * How long a game is (GDD_V3 §2.1), chosen at setup: **1 to 5 seasons**, or **Race to a Target** —
 * play until a stable's net worth passes `worth` at the end of a weekend. A setup that names no
 * length is one season, which is what every game before Phase E was.
 */
export type GameLength = { kind: 'seasons'; seasons: number } | { kind: 'target'; worth: number };

/**
 * One finished season, archived when it ends (GDD_V3 §2.2): what the table would want to look back
 * on, and what a game's tie-break needs once the season's races are cleared. `stats` is each
 * stable's `PlayerSeasonStats` as the season left them — the live copy is reset at the next season,
 * and a game total is summed from these rather than stored twice.
 */
export interface SeasonRecord {
  season: number;
  /** Weekends it ran: ten, or fewer if a Target was crossed part-way through. */
  weeks: number;
  /** The circuit it ran, week by week. */
  calendar: Id[];
  /** Net worth at the season's last weekend, highest first, broken as §2.4. */
  standings: { playerId: Id; netWorth: number }[];
  stats: Record<Id, PlayerSeasonStats>;
  /** Gold Cups and races won this season, per stable — §2.4's two tie-breaks. */
  goldCups: Record<Id, number>;
  raceWins: Record<Id, number>;
}

/** Why and when the game ended (GDD_V3 §2.1). */
export interface GameOver {
  /** The seasons ran out; a Target was crossed; or a Target game hit its season cap. */
  reason: 'seasons' | 'target' | 'cap';
  season: number;
  week: number;
  /** The stables at or past the Target when it was crossed — not necessarily the winner. */
  crossers: Id[];
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
  /** This week's Explore; null before the first arrival. */
  explore: ExploreState | null;
  /**
   * Next week's market, rolled a week early (GDD_V3 §9.4, Phase D1 item 5) so that a Bar card has
   * something true to sell. **It is the fog**: nothing reads it but a stable holding `intel` for it,
   * and next week's arrival posts exactly this. Null past the Grand Final.
   */
  nextPlanet: PlanetState | null;
  /** This weekend's race-day conditions (Phase D1 item 6). Drawn at arrival; cleared at the jump. */
  conditions: RaceDayCondition[];
  /** This weekend's Back Alley jobs (GDD_V3 §9.3), in the order they were booked. */
  jobs: Job[];
  bets: Bet[];
  results: RaceResult[]; // all past races (tick logs pruned)
  eventLog: LogLine[];
  toggles: Toggles;
  nextId: number;
  /**
   * The game's standings, once it is over (GDD_V3 §2.4): final net worth, highest first, broken on
   * Gold Cups and then races won across the whole game. Null until then — a season that ends into
   * the off-season is archived in `seasons`, not here.
   */
  finalStandings: { playerId: Id; netWorth: number }[] | null;
  /** Which season this is, from 1 (GDD_V3 §2.1). */
  season: number;
  /** How long this game is — fixed at setup. */
  length: GameLength;
  /** Every season that has finished, in order. */
  seasons: SeasonRecord[];
  /** Why the game ended, once it has; null while it is running. */
  gameOver: GameOver | null;
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
  /**
   * How long the game is (GDD_V3 §2.1). ⚠️ Optional, and absent means **one season** — so a setup
   * written before Phase E, a v3d2 seed link or a harness call, still means exactly what it meant.
   */
  length?: GameLength;
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
  /**
   * Race or Rest, and optionally the dog's sticky diet (GDD_V3 §6.3). ⚠️ `diet` replaced
   * `stat?: StatKey` in v3 Phase B — the same version bump as `Dog.diet`, because `Action` is the
   * save file and the replay protocol.
   */
  | { t: 'SetDogState'; playerId: Id; dogId: Id; state: WeekState; diet?: Diet }
  /** Open one of the planet's three doors (GDD_V3 §9.1). Once a weekend, in turn order. */
  | { t: 'ChooseDoor'; playerId: Id; door: number }
  | { t: 'ResolveEvent'; playerId: Id; choice: number }
  /**
   * Spend a bought trap draw (GDD_V3 §9.3): the box, 1–8, for this stable's runner in this race.
   * Race Office only, once the race is known; honoured at the lock.
   */
  | { t: 'ChooseBox'; playerId: Id; race: RaceTypeId; box: number }
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
