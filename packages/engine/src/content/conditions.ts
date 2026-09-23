import { balance } from './balance';
import type { ConditionId, GameState, Id, RaceDayCondition } from '../types';

/**
 * Race-day conditions (Phase D1 item 6): **true information the book does not have.**
 *
 * Each weekend, at arrival, every stable dog on the planet has one draw against this table. A dog
 * that lands on a row carries it to race day, where it applies **whether or not anybody knows** — to
 * the runner, never to the stored dog, so every screen and the whole book go on reading the dog as it
 * was. Nobody knows, **its owner included**, until a Bar or Back Alley card tips one of them.
 *
 * ⚠️ **Why this exists** (Jesse, after `v3c`: betting "didn't feel worth it without insider
 * knowledge"). The book prices the rating and a public style on the trip (C6) and nothing else, and
 * the only standing edge left was D1's fed-dog-better-than-its-number at about +2%. A tip is the
 * insider knowledge: found through a door, true, and never priced.
 *
 * **A condition is a row.** Its odds and its size are spreadsheet cells; race day reads `fitness` and
 * `speed` and never asks which condition it is looking at.
 */
export interface ConditionRow {
  id: ConditionId;
  /** What a tip calls it. */
  name: string;
  /** Chance per stable dog per weekend. */
  chance: number;
  /** Added to the runner's fitness on race day (clamped 0–100). */
  fitness: number;
  /** Added to the runner's speed stat on race day, like the lucky bone. */
  speed: number;
  /** What the tip says, about a dog, in the voice of somebody who should not be telling you. */
  tip: string;
  /** Whether a tipped bettor wants to be on it (true) or off it (false). */
  good: boolean;
}

export const CONDITIONS: readonly ConditionRow[] = [
  {
    id: 'knock',
    name: 'a knock',
    chance: balance.conditionKnockChance,
    fitness: balance.conditionKnockFitness,
    speed: 0,
    tip: 'took a knock in the kennel this week. Stiff as a board. Nobody has told the owner',
    good: false,
  },
  {
    id: 'offFeed',
    name: 'off its feed',
    chance: balance.conditionOffFeedChance,
    fitness: balance.conditionOffFeedFitness,
    speed: 0,
    tip: 'has been off its feed since it landed. Left its bowl three nights running',
    good: false,
  },
  {
    id: 'buzzing',
    name: 'buzzing',
    chance: balance.conditionBuzzingChance,
    fitness: 0,
    speed: balance.conditionBuzzingSpeed,
    tip: 'is buzzing. Worked a blinder at dawn, and the clockers were not up yet',
    good: true,
  },
];

export const CONDITION_BY_ID = Object.fromEntries(CONDITIONS.map((c) => [c.id, c])) as Record<
  ConditionId,
  ConditionRow
>;

/** The condition a dog carries this weekend, if any. */
export function conditionOf(s: GameState, dogId: Id): RaceDayCondition | undefined {
  return s.conditions.find((c) => c.dogId === dogId);
}

/** What this stable has been told: dog id → condition. Only what a tip gave it. */
export function tipsFor(s: GameState, playerId: Id): Map<Id, ConditionRow> {
  const out = new Map<Id, ConditionRow>();
  for (const c of s.conditions)
    if (c.tipped.includes(playerId)) out.set(c.dogId, CONDITION_BY_ID[c.condition]);
  return out;
}
