/**
 * Play a whole season the way a person does — through store/loop.ts and screenFor, the same two
 * functions App.tsx walks — issuing exactly the actions the screens can issue, with exactly the
 * guards the screens put on their buttons. Any ActionError means a screen could offer a player
 * a button the engine would refuse.
 *
 *   npx tsx packages/web/scripts/season-check.ts [seed ...]
 *
 * Not part of `npm test` (which is the engine's own suite); this is the UI's end-to-end check.
 */
import {
  balance,
  cargoTotal,
  GOODS,
  HOLD_CAP,
  STAPLE_ID,
  bettingMargin,
  createSeason,
  dogValue,
  planetOf,
  drive,
  maxStakeFor,
  replay,
  raceType,
  thisWeeksCard,
  RACE_TYPE_IDS,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type RaceTypeId,
  type SeasonSetup,
  type Diet,
  type GameLength,
  type GoodId,
} from '@sdr/engine';
import { applyActions, screenFor, weekKey, type ScreenUi } from '../src/store/loop';

const HUMAN = 'p1';

/** The Back Alley cards that sell a nobble (GDD_V3 §9.3). */
const NOBBLE_CARDS = new Set(['syringeMan', 'kennelBoyBribe']);

/**
 * Every good the walk-through bought or sold, across every season it plays. With six goods a walk
 * can pass while touching one of them, which is the "a check that passes because it stopped
 * checking" failure Phase A warned about — so the run fails unless most of the ladder was used.
 */
const goodsTraded = new Set<string>();

/** The week the walk sells its whole hold after the races, to make a dog go hungry at the jump. */
const HUNGRY_WEEK = 3;

/** The food aimed at a dog's weakest stat — what the walk names as its diet in week 1. */
function dietFood(d: Dog): GoodId {
  const weakest = (['speed', 'accel', 'stamina'] as const).reduce((a, b) => (d[b] < d[a] ? b : a));
  return GOODS.find((g) => g.stat === weakest)!.id;
}

/**
 * Action counters. `Record<string, number>` plus `noUncheckedIndexedAccess` means every read is
 * `number | undefined`, so counting goes through here rather than through twenty non-null
 * assertions. (This file was never typechecked before v2 Phase A — `packages/web/tsconfig.json`
 * only covered `src` — which is how a `SetTraining` survived in it after the action was deleted.)
 */
type Tally = Record<string, number>;
function bump(tally: Tally, key: string, by = 1): void {
  tally[key] = (tally[key] ?? 0) + by;
}

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligibleFor(d: Dog, race: RaceTypeId): boolean {
  return d.injuryWeeks === 0 && raceType(race).eligible(d);
}

/**
 * Best dog to each race, richest race first — what a person does at the Race Office. The card is
 * ordered with the headline race last (GDD §6.3), so walking it backwards is walking down the
 * money, and a stable that cannot fill all three leaves the traps to the locals.
 */
function declarations(s: GameState, kennel: Dog[], p: Player): Action[] {
  const out: Action[] = [];
  const taken = new Set<Id>();
  for (const race of [...thisWeeksCard()].reverse()) {
    const pick = kennel
      .filter((d) => !taken.has(d.id) && eligibleFor(d, race) && d.fitness > 40)
      .sort((a, b) => b.rating - a.rating)[0];
    if (pick) {
      taken.add(pick.id);
      out.push({ t: 'Declare', playerId: p.id, race, dogId: pick.id });
    }
  }
  return out;
}

/** Everything a human can do at the planet's venues, with the screens' own guards. */
function planetTurn(s: GameState, p: Player, tally: Tally): Action[] {
  const out: Action[] = [];
  const pre = s.phase === 'planetPre';
  let cash = p.cash;
  let cargo = cargoTotal(p.cargo);
  const dogs = ownDogs(s, p);
  const kennel = [...dogs];

  // ⚠️ **No Race/Rest walk since Phase D2** (item 5): the Race Office sets the week, so the only
  // Kennels action left is GDD_V3 §6.3's sticky diet, set once in week 1 the way a player would —
  // each dog on the food aimed at its weakest stat. Three clicks a season, not a week.
  if (pre && s.week === 1) {
    for (const d of kennel) {
      const diet: Diet = { kind: 'named', good: dietFood(d) };
      out.push({ t: 'SetDogState', playerId: p.id, dogId: d.id, state: d.weekState, diet });
      bump(tally, 'SetDogState');
      walked.diets++;
    }
  }

  // --- Market: the food trade, which is the only market left (GDD_V3 §6) ---
  //
  // ⚠️ **Six venues' worth of walk-through went with the systems behind them (BUILD_PLAN_V3 §2.1)**:
  // the Saloon's hires and the week-9 clear-out, the bank and Fat Tony, the dog market's sell-the-
  // worst-buy-the-best, the gear, the dossier, and the ship. What is left is the three decisions
  // GDD_V3 §1.1 says v3 has at this point in the weekend, and the check is thinner for it.
  //
  // **This is the row to watch when Phase B lands**: §6.2's six goods with shelf depth and a sticky
  // per-dog diet are exactly the kind of thing a walk-through can *survive* without exercising, and
  // a check that passes because it stopped checking is worse than a red one.
  if (s.toggles.trading && s.week === HUNGRY_WEEK && s.phase === 'planetPost') {
    // ⚠️ **Run out of food on purpose, once a season** (BUILD_PLAN_V3 Phase B item 5): sell the
    // whole hold after the races so the yard sails empty and §6.3's penalty has to fire. A walk
    // that never went hungry would pass without ever touching the one rule carrying the economy.
    for (const g of GOODS) {
      if (p.cargo[g.id] <= 0) continue;
      out.push({ t: 'TradeFood', playerId: p.id, good: g.id, units: -p.cargo[g.id] });
      bump(tally, 'TradeFood');
    }
  } else if (s.toggles.trading) {
    // Read the six rows the way §6.2 asks a player to: by where each price sits in its own range.
    // Sell anything in the top quarter, keep two weeks of the staple for dinner, and buy whatever
    // is in the bottom quarter with the money left over — which exercises the finite shelf, the
    // hold and more than one good, where Phase A's walk bought one good or nothing.
    const dinner = kennel.length;
    const pos = (id: (typeof GOODS)[number]['id']) => {
      const g = GOODS.find((x) => x.id === id)!;
      return (s.planet.goods[id].buy - g.floor) / (g.ceiling - g.floor);
    };
    const held = { ...p.cargo };
    for (const g of GOODS) {
      const keep = g.id === STAPLE_ID ? dinner : 0;
      const spare = held[g.id] - keep;
      if (spare > 0 && pos(g.id) >= 0.75) {
        out.push({ t: 'TradeFood', playerId: p.id, good: g.id, units: -spare });
        cash += spare * s.planet.goods[g.id].sell;
        cargo -= spare;
        held[g.id] -= spare;
        bump(tally, 'TradeFood');
        goodsTraded.add(g.id);
      }
    }
    const staple = s.planet.goods[STAPLE_ID];
    const short = dinner * 2 - held[STAPLE_ID];
    if (short > 0) {
      const units = Math.min(short, staple.stock, HOLD_CAP - cargo, Math.floor(cash / staple.buy));
      if (units > 0) {
        out.push({ t: 'TradeFood', playerId: p.id, good: STAPLE_ID, units });
        cash -= units * staple.buy;
        cargo += units;
        bump(tally, 'TradeFood');
      }
    }
    const bargain = GOODS.filter((g) => g.id !== STAPLE_ID && pos(g.id) <= 0.25).sort(
      (a, b) => pos(a.id) - pos(b.id),
    )[0];
    if (bargain) {
      const m = s.planet.goods[bargain.id];
      const units = Math.min(
        m.stock,
        HOLD_CAP - cargo,
        Math.floor(Math.max(0, cash - 2500) / m.buy),
      );
      if (units > 0) {
        out.push({ t: 'TradeFood', playerId: p.id, good: bargain.id, units });
        cash -= units * m.buy;
        cargo += units;
        bump(tally, 'TradeFood');
        goodsTraded.add(bargain.id);
      }
    }
  }

  if (pre) {
    const declares = declarations(s, kennel, p);
    out.push(...declares);
    bump(tally, 'Declare', declares.length);
    // GDD_V3 §9.3: a bought box is named in the Race Office — the rail, for the richest runner.
    const top = declares[0];
    if (top?.t === 'Declare' && s.jobs.some((j) => j.by === p.id && j.kind === 'box')) {
      out.push({ t: 'ChooseBox', playerId: p.id, race: top.race, box: 1 });
      bump(tally, 'ChooseBox');
    }
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

/** The Bookie screen: a stake inside the planet's cap, on the favourite and one outsider. */
function bettingTurn(s: GameState, p: Player, tally: Tally): Action[] {
  const out: Action[] = [];
  if (!s.fields) return [{ t: 'EndPhase', playerId: p.id }];
  let cash = p.cash;
  // ⚠️ **The nobbling half of this walk-through is gone (BUILD_PLAN_V3 §2.1).** It used to walk the
  // stewards' enquiry, the fine sized against the stake, and the ban that stopped the next hire —
  // the best-covered path in the check. GDD_V3 §9.3 rebuilds all of it as a Back Alley event in
  // Phase D, and §9.3's acceptance row (`season-check` fails on zero sabotages) is where it comes
  // back. Until then this screen only bets.
  for (const { race, entries } of s.fields) {
    const already = s.bets
      .filter((b) => b.playerId === p.id && b.week === s.week && b.race === race)
      .reduce((sum, b) => sum + b.stake, 0);
    const cap = maxStakeFor(s, { ...p, cash });
    const room = Math.max(0, Math.min(cap - already, Math.floor(cash)));
    if (room < 50) continue;
    const runners = [...entries].sort((a, b) => b.winProb - a.winProb);
    const fav = runners[0];
    const outsider = runners[Math.min(3, runners.length - 1)];
    const stake = Math.min(100, room);
    if (fav) {
      out.push({ t: 'PlaceBet', playerId: p.id, race, dogId: fav.dogId, kind: 'win', stake });
      cash -= stake;
      bump(tally, 'PlaceBet');
    }
    const room2 = Math.max(
      0,
      Math.min(maxStakeFor(s, { ...p, cash }) - already - stake, Math.floor(cash)),
    );
    if (outsider && outsider !== fav && room2 >= 50) {
      const stake2 = Math.min(50, room2);
      out.push({
        t: 'PlaceBet',
        playerId: p.id,
        race,
        dogId: outsider.dogId,
        kind: 'place',
        stake: stake2,
      });
      cash -= stake2;
      bump(tally, 'PlaceBet');
    }
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

/**
 * Phase E1: what the human does at an off-season (GDD_V3 §2.2) — retire its lowest-valued dog, or
 * keep them all — and what the walk saw of every off-season it passed through.
 */
type OffPlan = 'retire' | 'keep';
const offWalk = {
  /** Off-season screens the human answered, and the most presses any one of them took. */
  screens: 0,
  maxPresses: 0,
  retired: 0,
  keptAll: 0,
  /** Retirements on offer (one a stable an off-season) and staff candidates, table-wide. */
  offers: 0,
  candidates: 0,
  hires: 0,
  /** Target games walked to their end. */
  targets: 0,
};

/** The human's presses at one off-season screen: the retirement, the staff notice, "On to season N". */
function offSeasonPress(s: GameState, me: Player, plan: OffPlan): Action {
  const n = s.offSeason!.notices[me.id]!;
  if (n.retired === undefined) {
    if (plan === 'keep') return { t: 'Retire', playerId: me.id, dogId: null };
    const cheapest = [...ownDogs(s, me)].sort((a, b) => dogValue(a) - dogValue(b))[0]!;
    return { t: 'Retire', playerId: me.id, dogId: cheapest.id };
  }
  if (n.candidate && n.hired === undefined)
    return { t: 'ResolveStaffNotice', playerId: me.id, hire: true };
  return { t: 'EndPhase', playerId: me.id };
}

function playSeason(
  seed: number,
  toggles?: SeasonSetup['toggles'],
  length?: GameLength,
  offPlan: OffPlan = 'keep',
) {
  const setup: SeasonSetup = {
    seed,
    ...(toggles ? { toggles } : {}),
    ...(length ? { length } : {}),
    // A mixed field, so the check exercises all three difficulties' action streams (M4).
    players: [
      { name: 'Jesse', kind: 'human' },
      { name: '', kind: 'ai', difficulty: 'easy' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'hard' },
      { name: '', kind: 'ai', difficulty: 'hard' },
    ],
  };
  // One key per action the engine still has, so "never used" means an action exists that the
  // screens cannot issue — which is the thing this check is for. Nine keys went with the nine
  // action types BUILD_PLAN_V3 §2.1 deletes.
  const tally: Tally = {
    Declare: 0,
    PlaceBet: 0,
    TradeFood: 0,
    SetDogState: 0,
    ResolveEvent: 0,
    ChooseDoor: 0,
    ChooseBox: 0,
  };
  const screens: Record<string, number> = {};

  let state = createSeason(setup);
  const log: Action[] = [];
  drive(state, log);
  const ui: ScreenUi = {
    racesWatchedWeek: 0,
    resultsSeenWeek: 0,
    fieldsSeenWeek: 0,
    passAck: null,
    bustAck: [],
    seasonSeen: 0,
  };
  let presses = 0;

  for (let step = 0; step < 100000; step++) {
    const screen = screenFor(state, ui);
    screens[screen.kind] = (screens[screen.kind] ?? 0) + 1;
    if (screen.kind === 'seasonEnd' && state.phase === 'offSeason') {
      // A season is over and the game goes on (GDD_V3 §2.2): the table reads it, then the
      // off-season. What every stable was rolled is counted here, once an off-season.
      for (const n of Object.values(state.offSeason!.notices)) {
        offWalk.offers++;
        if (n.candidate) offWalk.candidates++;
      }
      ui.seasonSeen = state.season;
      presses = 0;
      continue;
    }
    if (screen.kind === 'seasonEnd') {
      const human = state.players.find((p) => p.id === HUMAN)!;
      const rehearsed = replay(createSeason(setup), log);
      if (JSON.stringify(rehearsed) !== JSON.stringify(state))
        throw new Error(`seed ${seed}: replaying the log did not reproduce the season`);
      return { state, log, tally, screens, human };
    }
    if (screen.kind === 'noHuman') throw new Error(`seed ${seed}: lost the human stable`);
    const me = screen.me!;
    if (screen.kind === 'race') {
      // The race view: the table watches the three logs replay. Watching changes nothing, so
      // the headless walk acknowledges it exactly as pressing skip three times would.
      ui.racesWatchedWeek = weekKey(state);
      continue;
    }
    if (screen.kind === 'results') {
      ui.resultsSeenWeek = weekKey(state);
      continue;
    }
    if (screen.kind === 'fields') {
      // A weekend with no bookie: the locked card is read, then the races run.
      ui.fieldsSeenWeek = weekKey(state);
      continue;
    }
    if (screen.kind === 'bust') {
      ui.bustAck = [...ui.bustAck, me.id];
      continue;
    }
    if (screen.kind === 'pass') {
      ui.passAck = me.id;
      continue;
    }
    let actions: Action[];
    if (screen.kind === 'offSeason') {
      // One press at a time, as the screen dispatches them, so the count is the presses.
      const press = offSeasonPress(state, me, offPlan);
      if (press.t === 'Retire') {
        if (press.dogId) offWalk.retired++;
        else offWalk.keptAll++;
      }
      if (press.t === 'ResolveStaffNotice' && press.hire) offWalk.hires++;
      presses++;
      if (press.t === 'EndPhase') {
        offWalk.screens++;
        offWalk.maxPresses = Math.max(offWalk.maxPresses, presses);
        if (presses > 3) throw new Error(`the off-season took ${presses} presses (at most 3)`);
        presses = 0;
      }
      const applied = applyActions(state, [press]);
      state = applied.state;
      log.push(...applied.added);
      continue;
    }
    if (state.phase === 'explore' && !state.pendingEvent && state.activePlayer === me.id) {
      // GDD_V3 §9.1: a door a week, walked round all three so every category gets opened — except
      // that the walk goes down the Back Alley whenever there is one until it has both nobbled a
      // rival and bought a box (§9.3), so the Race Office's box buttons get pressed too.
      const alley = planetOf(state.planet.planetId).exploreDoors.findIndex(
        (d) => d.category === 'alley',
      );
      const door = alley >= 0 && (!me.stats.nobbles || !me.stats.boxes) ? alley : state.week % 3;
      actions = [{ t: 'ChooseDoor', playerId: me.id, door }];
      bump(tally, 'ChooseDoor');
    } else if (state.pendingEvent && state.pendingEvent.playerId === me.id) {
      const pe = state.pendingEvent;
      // A nobble: the first rival the card names. The steward's box: buy it. Anything else: rotate.
      const choice = NOBBLE_CARDS.has(pe.eventId)
        ? Math.max(
            0,
            pe.choices.findIndex((l, i) => i > 0 && l !== '—'),
          )
        : pe.eventId === 'stewardBox'
          ? 0
          : state.week % pe.choices.length;
      actions = [{ t: 'ResolveEvent', playerId: me.id, choice }];
      bump(tally, 'ResolveEvent');
    } else if (screen.kind === 'betting') {
      // Phase D2 item 5, checked rather than assumed: once the card locks, every dog of ours that
      // is declared is racing and every other one is resting — the week followed the Race Office.
      const declared = new Set(RACE_TYPE_IDS.map((r) => state.declarations[r][me.id]));
      for (const d of ownDogs(state, me)) {
        if (d.weekState !== (declared.has(d.id) ? 'race' : 'rest'))
          throw new Error(`${d.name} is set to ${d.weekState} against the Race Office`);
        walked.states++;
      }
      actions = bettingTurn(state, me, tally);
    } else {
      actions = planetTurn(state, me, tally);
    }
    const applied = applyActions(state, actions);
    state = applied.state;
    log.push(...applied.added);
  }
  throw new Error(`seed ${seed}: the game never ended`);
}

const seeds = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => !Number.isNaN(n));
const toRun = seeds.length ? seeds : [42, 7, 1234, 90210];
let failures = 0;
/** Phase A's replacement for the §13 coverage row — see the note at the end of the run. */
/**
 * `states` was "Race/Rest changes" until Phase D2, which retired the weekly Race/Rest press (item 5):
 * it now counts dog-weeks checked at the lock to be in the state the Race Office left them in, so a
 * zero still means the check stopped checking.
 */
const walked = {
  declare: 0,
  states: 0,
  trades: 0,
  bets: 0,
  diets: 0,
  hungry: 0,
  /** Phase D2 (GDD_V3 §9.3): nobbles booked by anybody, and boxes named by the walk. */
  sabotages: 0,
  boxes: 0,
};
/**
 * Phase E1: whole games as well as seasons. The first two seeds are also walked as **two-season
 * games** — the human retires a dog at one off-season and keeps them all at the other — and the
 * third as a **race to the short target**, to its end.
 */
type Variant = [string, SeasonSetup['toggles'] | undefined, GameLength | undefined, OffPlan];
for (const seed of toRun) {
  const variants: Variant[] = [['default toggles', undefined, undefined, 'keep']];
  if (seed === toRun[0])
    variants.push(
      [
        'no betting, no trading, casual events',
        { betting: false, trading: false, casualEvents: true },
        undefined,
        'keep',
      ],
      ['two seasons, retiring a dog', undefined, { kind: 'seasons', seasons: 2 }, 'retire'],
    );
  if (seed === toRun[1])
    variants.push([
      'two seasons, keeping them all',
      undefined,
      { kind: 'seasons', seasons: 2 },
      'keep',
    ]);
  if (seed === toRun[2])
    variants.push([
      'race to the short target',
      undefined,
      { kind: 'target', worth: balance.targetShort },
      'retire',
    ]);
  for (const [label, toggles, length, offPlan] of variants) {
    try {
      const { state, log, tally, screens, human } = playSeason(seed, toggles, length, offPlan);
      if (length && state.gameOver?.reason !== (length.kind === 'target' ? 'target' : 'seasons'))
        throw new Error(`the game ended by ${state.gameOver?.reason}, not as its length says`);
      if (length?.kind === 'target') offWalk.targets++;
      // Per-season counts, summed over the game's archive: the live stats are the last season's.
      const games = state.seasons.map((r) => Object.values(r.stats));
      const total = (pick: (st: Player['stats']) => number) =>
        games.flat().reduce((n, st) => n + pick(st), 0);
      const weeksPlayed = state.seasons.reduce((n, r) => n + r.weeks, 0);
      const worth = state.finalStandings?.find((f) => f.playerId === HUMAN)?.netWorth ?? 0;
      const rank = (state.finalStandings ?? []).findIndex((f) => f.playerId === HUMAN) + 1;
      const missing = Object.entries(tally)
        .filter(([, n]) => n === 0)
        .map(([k]) => k);
      console.log(
        `seed ${seed} (${label}): finished season ${state.season} week ${state.week}, ${log.length} actions, ` +
          `${human.name} ${rank}/${state.players.length} on ${worth.toLocaleString('en-NZ')} Bones`,
      );
      console.log(
        `  actions: ${Object.entries(tally)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}`,
      );
      console.log(
        `  screens: ${Object.entries(screens)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}${missing.length ? `\n  never used: ${missing.join(', ')}` : ''}`,
      );
      if (bettingMargin(state) <= 0) throw new Error('betting margin went to zero');
      // ⚠️ **The acceptance row this check used to carry is gone with §13 (BUILD_PLAN_V3 §2.1)** —
      // it counted jobs placed, stewards' enquiries and bans served, and refused to pass on a zero.
      // What replaces it is the same idea pointed at what v3 actually has: a season is not *walked*
      // unless the three decisions of GDD_V3 §1.1 that exist in Phase A were all exercised. Phase B
      // adds the diet and the empty hold to this list; Phase D puts the sabotage row back (§9.3).
      walked.declare += tally.Declare ?? 0;
      walked.states += tally.SetDogState ?? 0;
      walked.trades += tally.TradeFood ?? 0;
      walked.bets += tally.PlaceBet ?? 0;
      walked.boxes += tally.ChooseBox ?? 0;
      // GDD_V3 §6.3's penalty, read off the season's own log rather than inferred: the walk sold its
      // hold in week HUNGRY_WEEK, so in a trading season at least one of its dogs must have gone
      // hungry at that jump — and a trading season in which none did means the rule did not fire.
      const hungry = state.eventLog.filter(
        (l) => l.playerId === HUMAN && l.text.includes('went hungry'),
      ).length;
      // The log is the last season's; a Target game can end before HUNGRY_WEEK of it.
      if (state.toggles.trading && hungry === 0 && state.week > HUNGRY_WEEK)
        throw new Error(`sold the hold in week ${HUNGRY_WEEK} and no dog went hungry`);
      walked.hungry += hungry;
      if (human.dogIds.length === 0) throw new Error('the human stable lost every dog');
      // ⚠️ Phase D1's acceptance rows (BUILD_PLAN_V3 Phase D): a season is not walked unless Explore
      // was — every stable opened a door, the Pound offered a dog, and somebody was tipped. Staff
      // and sabotage get their rows in D2.
      const picks = log.filter((a) => a.t === 'ChooseDoor').length;
      const offers = total((st) => st.dogOffers);
      const tips = total((st) => st.tips);
      // Phase D2's rows (BUILD_PLAN_V3 Phase D): trainers offered in the Bar, and sabotage booked in
      // the Back Alley. A season with none of either has not walked the people.
      const staffOffers = total((st) => st.staffOffers);
      const sabotages = total((st) => st.nobbles);
      const commission = total((st) => st.commission);
      console.log(
        `  explore: ${picks} doors opened, ${offers} dog offers, ${tips} tips, ${staffOffers} trainer offers, ${sabotages} sabotages; trainers took ${commission.toLocaleString('en-NZ')}`,
      );
      if (picks === 0) throw new Error('nobody opened a door');
      if (picks !== state.players.length * weeksPlayed)
        throw new Error(
          `${picks} doors opened in ${weeksPlayed} weeks of ${state.players.length} stables`,
        );
      if (offers === 0) throw new Error('the season produced no dog offers');
      if (tips === 0) throw new Error('the season produced no tips');
      if (staffOffers === 0) throw new Error('the season produced no staff offers');
      // ⚠️ Sabotage is checked across the run, not per season (see the end of the file): at its own
      // target — 40–70% of seasons see one — a third of honest seasons have none.
      walked.sabotages += sabotages;
      if (state.players.some((p) => p.staff.length > 2))
        throw new Error('a stable holds more than two trainers');
    } catch (e) {
      failures++;
      console.error(`seed ${seed} (${label}) FAILED: ${(e as Error).message}`);
    }
  }
}
// ⚠️ An acceptance row rather than a statistic (BUILD_PLAN_V3 Phase A): a check that passes because
// it stopped checking is worse than a red one, and this phase deleted most of what this file used to
// walk. So the run fails unless every decision v3 has at this point was actually made.
console.log(
  `\nThe week walked: ${walked.declare} declarations, ${walked.states} dog-weeks whose state followed the Race Office, ` +
    `${walked.trades} trades, ${walked.bets} bets, ${walked.diets} diets set, ` +
    `${walked.hungry} hungry dog-weeks, ${walked.sabotages} sabotages, ${walked.boxes} boxes named.`,
);
console.log(
  `Goods traded: ${goodsTraded.size} of ${GOODS.length} (${[...goodsTraded].join(', ')}).`,
);
if (!failures && goodsTraded.size < 4) {
  console.error(
    'Fewer than four of the six goods were ever traded — the check did not walk the market.',
  );
  failures++;
}
// ⚠️ Phase D2: `sabotages` and `boxes` are in `walked`, so a run in which nobody booked a nobble, or
// the walk never named a box, fails here. They are run-wide rather than per season on purpose: the
// acceptance row puts one sabotage in 40–70% of seasons, so a per-season check would fail about a
// third of honest seasons. Dog offers and staff offers are frequent enough to fail per season.
if (!failures && Object.values(walked).some((n) => n === 0)) {
  const dead = Object.entries(walked)
    .filter(([, n]) => n === 0)
    .map(([k]) => k);
  console.error(`Never exercised: ${dead.join(', ')} — the check did not walk the week.`);
  failures++;
}
// ⚠️ Phase E1's rows: the off-season walked, both ways, in at most three presses; a staff candidate
// offered somewhere at the table; and a Target game played to its end. Run-wide, like sabotage — a
// candidate needs a trainer to have left (15% each), which one off-season can easily not produce.
console.log(
  `The off-season walked: ${offWalk.screens} screens (at most ${offWalk.maxPresses} presses), ${offWalk.retired} retired, ${offWalk.keptAll} kept them all, ` +
    `${offWalk.offers} retirements on offer, ${offWalk.candidates} staff candidates (${offWalk.hires} hired by the walk), ${offWalk.targets} Target game(s) to the end.`,
);
if (
  !failures &&
  (!offWalk.offers ||
    !offWalk.candidates ||
    !offWalk.retired ||
    !offWalk.keptAll ||
    !offWalk.targets)
) {
  console.error('The off-season or the Target game was never walked both ways.');
  failures++;
}
console.log(failures ? `${failures} season(s) failed` : 'All seasons played out clean.');
process.exit(failures ? 1 : 0);
