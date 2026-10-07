/**
 * `npm run harness -- --decisions` — are the five decisions decisions? (GDD_V3 §1.1, v3 Phase Q.)
 *
 *   npm run harness -- --decisions [--games 1200] [--seed 1] [--set key=value …]
 *
 * §0.1 says that if any of §1.1's five decisions is shallow, "v3 has a problem that no amount of event
 * content will paper over". This asks it of each one the only way a harness can: **one seat plays a
 * naive rule for one decision and Normal for everything else, against five Normal stables**, in
 * one-season games, and the naive seat moves round the table so no seat or draft position is favoured.
 * The same seeds are played for every rule, so each row is paired with the control.
 *
 * A rule that does **as well as Normal** means Normal's choice there is not worth making — at least
 * at an AI's level of play — and that decision is shallow. A rule that does **much worse** means the
 * decision matters. The number read is the naive seat's end worth less the mean of the five Normal
 * seats in the same game (Bones, ± one standard error), and its win rate against a fair 16.7%.
 *
 * The forced-door rows (`door: pound` …) answer a sixth question, whether the five categories pay
 * differently enough that the pick is a choice: the seat opens that category whenever the planet has
 * it and Normal's door otherwise.
 *
 * Then, over the control games, **what the book does not price** (§5.6, §14 Q9): a one-Bone win bet on
 * every runner at the posted price, by its fitness when the field was posted. A row that pays above
 * −margin is an edge for whoever reads the card.
 */
import { overridesLine } from './balance-set';
import { balance } from '../src/content/balance';
import { decide } from '../src/ai';
import { exploreStep, pickDoor } from '../src/ai/explore';
import {
  bestAssignment,
  betFavourites,
  buyFeedPlan,
  declareBest,
  emitDeclarations,
  racingDogs,
  setStates,
  spendBox,
  startPlan,
  stateHold,
  tippedToRest,
  tradeFoodPlan,
  type Plan,
} from '../src/ai/shared';
import { isSeasonOver, needsAdvance, reduceMut } from '../src/reduce';
import { createSeason, currentPlanet, player, purseFor, thisWeeksCard } from '../src/state';
import type { Action, Diet, DoorCategory, GameState, Id, RaceTypeId } from '../src/types';

const fmt = (n: number) => Math.round(n).toLocaleString('en-NZ');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sem = (xs: readonly number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1) / xs.length);
};

type Decide = (s: GameState, playerId: Id) => Action[];

interface Variant {
  id: string;
  decision: string;
  rule: string;
  decide: Decide;
}

/** The races of the card, dearest first. */
function byPurse(s: GameState): RaceTypeId[] {
  return [...thisWeeksCard()].sort((a, b) => purseFor(s, b)[0] - purseFor(s, a)[0]);
}

/** Normal's week, with hooks: how the card is filled, the yard's diet, and whether it trades or bets. */
function normalWith(opts: {
  card?: (plan: Plan) => Partial<Record<RaceTypeId, Id>>;
  diet?: Diet;
  trade?: boolean;
  bet?: boolean;
  door?: (s: GameState, playerId: Id) => number;
}): Decide {
  return (s, playerId) => {
    if (opts.door && s.phase === 'explore' && s.activePlayer === playerId && !s.pendingEvent)
      return [{ t: 'ChooseDoor', playerId, door: opts.door(s, playerId) }];
    const explore = exploreStep(s, playerId);
    if (explore) return explore;
    if (s.activePlayer !== playerId) return [];
    const plan = startPlan(s, playerId);
    if (s.phase === 'planetPre' || s.phase === 'planetPost') {
      if (s.phase === 'planetPre') {
        let entries: Partial<Record<RaceTypeId, Id>>;
        if (opts.card) {
          entries = opts.card(plan);
          emitDeclarations(plan, { plan: entries, value: 0 });
        } else {
          entries = declareBest(plan, {
            reserve: stateHold(plan, { raceAbove: 65 }),
            hold: tippedToRest(s, playerId),
          }).plan;
        }
        const racing = racingDogs({ plan: entries, value: 0 });
        setStates(plan, racing, { diets: !opts.diet });
        if (opts.diet) {
          for (const d of plan.kennel) {
            if (JSON.stringify(d.diet) === JSON.stringify(opts.diet)) continue;
            const runs = racing.has(d.id) ? 'race' : d.injuryWeeks > 0 ? d.weekState : 'rest';
            plan.out.push({
              t: 'SetDogState',
              playerId,
              dogId: d.id,
              state: runs,
              diet: opts.diet,
            });
            d.diet = opts.diet;
          }
        }
        spendBox(plan, entries);
        buyFeedPlan(plan);
      }
      if (opts.trade !== false) tradeFoodPlan(plan);
    }
    if (s.phase === 'betting' && s.fields && opts.bet !== false) betFavourites(plan);
    plan.out.push({ t: 'EndPhase', playerId });
    return plan.out;
  };
}

/** Normal's runners, put in the races by rating: the best of them in the dearest race. */
function rankedCard(plan: Plan): Partial<Record<RaceTypeId, Id>> {
  const chosen = bestAssignment(plan.s, plan.p, plan.kennel, {
    reserve: stateHold(plan, { raceAbove: 65 }),
    hold: tippedToRest(plan.s, plan.playerId),
  });
  const dogs = Object.values(chosen.plan)
    .filter((id): id is Id => !!id)
    .map((id) => plan.s.dogs[id]!)
    .sort((a, b) => b.rating - a.rating);
  const out: Partial<Record<RaceTypeId, Id>> = {};
  byPurse(plan.s).forEach((race, i) => {
    if (dogs[i]) out[race] = dogs[i]!.id;
  });
  return out;
}

/** No fitness rule and no prices: the three best-rated sound dogs race every week, best in the Gold. */
function topThreeCard(plan: Plan): Partial<Record<RaceTypeId, Id>> {
  const dogs = plan.kennel
    .filter((d) => d.injuryWeeks === 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
  const out: Partial<Record<RaceTypeId, Id>> = {};
  byPurse(plan.s).forEach((race, i) => {
    if (dogs[i]) out[race] = dogs[i]!.id;
  });
  return out;
}

function forcedDoor(cat: DoorCategory) {
  return (s: GameState, playerId: Id): number => {
    const i = currentPlanet(s).exploreDoors.findIndex((d) => d.category === cat);
    return i >= 0 ? i : pickDoor(s, playerId);
  };
}

export const VARIANTS: readonly Variant[] = [
  { id: 'normal', decision: '—', rule: 'Normal throughout (the control)', decide: normalWith({}) },
  {
    id: 'doorHash',
    decision: '1 door',
    rule: 'a door at random (no reading of the stable)',
    decide: normalWith({ door: (s, pid) => pickDoor(s, pid, false) }),
  },
  ...(['pound', 'bar', 'alley', 'strip', 'track'] as const).map((cat) => ({
    id: `door-${cat}`,
    decision: '1 door',
    rule: `always the ${cat} when the planet has one`,
    decide: normalWith({ door: forcedDoor(cat) }),
  })),
  {
    id: 'noTrade',
    decision: '2 market',
    rule: 'buys dinner, never trades',
    decide: normalWith({ trade: false }),
  },
  {
    id: 'dietWorst',
    decision: '2 market',
    rule: 'never touches the diet (worst available)',
    decide: normalWith({ diet: { kind: 'worst' } }),
  },
  {
    id: 'dietBest',
    decision: '2 market',
    rule: 'always the dearest food aboard (best available)',
    decide: normalWith({ diet: { kind: 'best' } }),
  },
  {
    id: 'topThree',
    decision: '3 run/rest',
    rule: 'the three best-rated sound dogs race every week, best in the Gold',
    decide: normalWith({ card: topThreeCard }),
  },
  {
    id: 'ranked',
    decision: '4 which race',
    rule: "Normal's runners, best-rated in the Gold, next in the Silver",
    decide: normalWith({ card: rankedCard }),
  },
  { id: 'noBet', decision: '5 bookie', rule: 'never bets', decide: normalWith({ bet: false }) },
];

interface FitnessBet {
  fitness: number;
  staked: number;
  returned: number;
}

function playOne(
  seed: number,
  seat: number,
  variant: Variant,
  bets: FitnessBet[] | null,
): { diff: number; won: boolean; end: number } {
  const n = 6;
  const s = createSeason({
    seed,
    players: Array.from({ length: n }, () => ({
      name: '',
      kind: 'ai' as const,
      difficulty: 'normal' as const,
    })),
  });
  const naive = s.players[seat]!.id;
  let guard = 0;
  let posted: { race: RaceTypeId; dogId: Id; odds: number; fitness: number }[] = [];
  let lastWeek = -1;
  while (!isSeasonOver(s) && guard++ < 200_000) {
    if (bets && s.phase === 'betting' && s.fields && s.week !== lastWeek) {
      lastWeek = s.week;
      posted = [];
      for (const f of s.fields)
        for (const e of f.entries)
          if (!e.local)
            posted.push({
              race: f.race,
              dogId: e.dogId,
              odds: e.odds,
              fitness: s.dogs[e.dogId]?.fitness ?? 0,
            });
    }
    if (bets && s.races && posted.length) {
      for (const p of posted) {
        const r = s.races.find((x) => x.race === p.race);
        if (!r) continue;
        bets.push({
          fitness: p.fitness,
          staked: 1,
          returned: r.order[0] === p.dogId ? p.odds : 0,
        });
      }
      posted = [];
    }
    if (needsAdvance(s)) {
      reduceMut(s, { t: 'AdvancePhase' });
      continue;
    }
    const who = s.pendingEvent?.playerId ?? s.activePlayer!;
    const acts =
      who === naive && s.phase !== 'draft' && s.phase !== 'offSeason'
        ? variant.decide(s, who)
        : decide(s, who, player(s, who).difficulty);
    for (const a of acts) reduceMut(s, a);
  }
  const worth = (id: Id) => s.finalStandings!.find((x) => x.playerId === id)!.netWorth;
  const others = s.players.filter((p) => p.id !== naive).map((p) => worth(p.id));
  return {
    diff: worth(naive) - mean(others),
    won: s.finalStandings![0]!.playerId === naive,
    end: worth(naive),
  };
}

export function runDecisions(games = 1200, seed = 1, only?: string): string {
  const out: string[] = [];
  const t0 = Date.now();
  out.push(
    `Space Dog Racing harness — the five decisions (GDD_V3 §1.1): ${games} one-season games a rule, one naive seat against five Normal, the seat moving round the table, seeds ${seed}…${seed + games - 1}`,
  );
  if (overridesLine()) out.push(overridesLine());
  out.push('');
  out.push(
    '  decision       rule                                                        win rate   end worth vs the five Normal (± se)   vs control',
  );
  let control: number[] | null = null;
  const bets: FitnessBet[] = [];
  for (const v of VARIANTS) {
    if (only && v.id !== 'normal' && !only.split(',').includes(v.id)) continue;
    const diffs: number[] = [];
    let wins = 0;
    for (let g = 0; g < games; g++) {
      const r = playOne(seed + g, g % 6, v, v.id === 'normal' ? bets : null);
      diffs.push(r.diff);
      if (r.won) wins++;
    }
    if (v.id === 'normal') control = diffs;
    const paired = control!.map((c, i) => diffs[i]! - c);
    out.push(
      `  ${v.decision.padEnd(13)}  ${v.rule.padEnd(60)}  ${pct(wins / games).padStart(7)}   ${((mean(diffs) >= 0 ? '+' : '') + fmt(mean(diffs))).padStart(8)} (± ${fmt(sem(diffs))})`.padEnd(
        135,
      ) +
        (v.id === 'normal'
          ? ''
          : `${(mean(paired) >= 0 ? '+' : '') + fmt(mean(paired))} (± ${fmt(sem(paired))})`),
    );
  }
  out.push(
    `  (fair win rate 16.7%; one standard error at ${games} games is ${(Math.sqrt(((1 / 6) * (5 / 6)) / games) * 100).toFixed(1)} points)`,
  );
  out.push('');
  out.push(
    `What the book does not price (§5.6, §14 Q9): a 1-Bone win bet on every stable runner at the posted price, by fitness when the field was posted (control games; margin ${pct(balance.bettingMargin)})`,
  );
  const bands: [string, (f: number) => boolean][] = [
    ['under 60', (f) => f < 60],
    ['60–69', (f) => f >= 60 && f < 70],
    ['70–79', (f) => f >= 70 && f < 80],
    ['80–89', (f) => f >= 80 && f < 90],
    ['90–99', (f) => f >= 90 && f < 100],
    ['100', (f) => f >= 100],
  ];
  for (const [label, test] of bands) {
    const xs = bets.filter((b) => test(b.fitness));
    if (!xs.length) continue;
    const ret = xs.map((b) => b.returned - b.staked);
    out.push(
      `  fitness ${label.padEnd(9)} ${String(xs.length).padStart(7)} runners   return a Bone ${(mean(ret) >= 0 ? '+' : '') + pct(mean(ret))} (± ${pct(sem(ret))})`,
    );
  }
  out.push('', `Elapsed ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return out.join('\n');
}
