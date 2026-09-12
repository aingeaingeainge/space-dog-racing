import { balance } from './balance';
import { TIER_LABEL } from './goods';
import type { GoodTier, StaffRole } from '../types';

/**
 * The people you can put on the books, as data (GDD §8.3, D7).
 *
 * **Three slots, filled with any combination — three trainers if you like. No stacking penalty:
 * the cost of better staff is the gate.** That moves the whole balance burden onto making the roles
 * *differently shaped*, which is the right place for it, because it is also what makes pillar 1
 * real. GDD §21 keeps a stacking penalty out of the design unless measurement demands one, so D7's
 * acceptance row — does stacking three of one role beat a mixed three by more than 5 points of
 * head-to-head — is the thing that would put one in, and not a hunch.
 *
 * **Content is data: a role is a row here and an id in `StaffRole`.** What each tier *does* is a
 * number on the row, so the ladder is one table a designer can read rather than six branches
 * spread across the phases.
 */
export interface StaffRoleRow {
  role: StaffRole;
  label: string;
  /** What the role is for, in the words the Saloon prints. */
  blurb: string;
  /**
   * Hireable at all. The **Fixer is false** until GDD §13 exists: his abilities are sabotage and
   * steward bribes, neither of which is an action yet, so hiring him would be a wage bill for
   * nothing. Charging for a service the game does not provide is a trap rather than a difficulty
   * (GDD §19, 2026-09-08), and that decision stands through Phase C.
   */
  hireable: boolean;
  /** One line per tier, in the dog's or the stable's own numbers, for the Saloon to print. */
  effect: Record<GoodTier, string>;
}

export const STAFF_ROLES: readonly StaffRoleRow[] = [
  {
    role: 'trainer',
    label: 'Trainer',
    blurb: 'Adds stat points to every dog you put on a Train week, on the stat that dog is on',
    hireable: true,
    effect: {
      rough: `+${balance.trainerPointsRough} to the chosen stat, per dog, per Train week`,
      proper: `+${balance.trainerPointsProper} to the chosen stat, per dog, per Train week`,
      prime: `+${balance.trainerPointsPrime} to the chosen stat, per dog, per Train week`,
    },
  },
  {
    role: 'vet',
    label: 'Vet',
    blurb: 'Protects the asset: shorter layoffs, better rest weeks, fewer injuries',
    hireable: true,
    effect: {
      rough: `An injury is ${balance.vetInjuryWeeksOff} week shorter. No rest bonus`,
      proper: `Injuries halved, and a rest week returns ${balance.fitnessRest + balance.vetRestProper} fitness instead of ${balance.fitnessRest}`,
      prime: `Injuries halved, a rest week returns ${balance.fitnessRest + balance.vetRestPrime}, and ${Math.round(balance.vetInjuryCutPrime * 100)}% fewer injuries happen at all`,
    },
  },
  {
    role: 'scout',
    label: 'Scout',
    blurb: 'Turns up dogs in every market that nobody else at the table can see',
    hireable: true,
    effect: {
      rough: `${balance.scoutDogsRough} extra dog in every market, yours alone`,
      proper: `${balance.scoutDogsProper} extra dogs, and one of them priced at ${Math.round(balance.scoutUnderBook * 100)}% of book`,
      prime: `${balance.scoutDogsPrime} extra dogs, one under book — and you see a pup's stats before you buy`,
    },
  },
  {
    role: 'trader',
    label: 'Trader',
    blurb: 'More hold, and stock put aside for you on every planet',
    hireable: true,
    effect: {
      rough: `+${balance.traderHoldRough} crates of hold`,
      proper: `+${balance.traderHoldProper} crates, and ${balance.traderConsignProper} crates of a Proper good consigned to you on every planet`,
      prime: `+${balance.traderHoldPrime} crates, ${balance.traderConsignPrime} crates of a Prime good consigned to you, and ${Math.round(balance.traderDiscountPrime * 100)}% off every buy price`,
    },
  },
  {
    role: 'tipster',
    label: 'Tipster',
    blurb: 'Standing information: what is coming up the circuit, without buying a dossier each week',
    hireable: true,
    effect: {
      rough: "Next week's race card — you already know where you are going, not what runs there",
      proper: "Next week's card, and the kibble band two weeks out",
      prime: 'The next two weeks in full: cards and bands',
    },
  },
  {
    role: 'fixer',
    label: 'Fixer',
    blurb: 'Steward bribes and sabotage (GDD §13)',
    // Not hireable. See `hireable` above: §13 does not exist yet and a wage for nothing is a trap.
    hireable: false,
    effect: {
      rough: 'Steward bribes only',
      proper: 'Bribes and sabotage',
      prime: 'Bribes, sabotage, and half the chance of being caught',
    },
  },
];

export const STAFF_ROLE_BY_ID: Record<StaffRole, StaffRoleRow> = Object.fromEntries(
  STAFF_ROLES.map((r) => [r.role, r]),
) as Record<StaffRole, StaffRoleRow>;

export function staffRole(role: StaffRole): StaffRoleRow {
  const r = STAFF_ROLE_BY_ID[role];
  if (!r) throw new Error('Unknown staff role ' + role);
  return r;
}

/** The roles a planet can actually offer. */
export const HIREABLE_ROLES: readonly StaffRole[] = STAFF_ROLES.filter((r) => r.hireable).map(
  (r) => r.role,
);

/** "Prime trainer" — what a shop row and a log line call one of these. */
export function staffTitle(role: StaffRole, tier: GoodTier): string {
  return `${TIER_LABEL[tier]} ${staffRole(role).label.toLowerCase()}`;
}

/** Trainer points a Train week, by tier (GDD §8.3). */
export const TRAINER_POINTS: Record<GoodTier, number> = {
  rough: balance.trainerPointsRough,
  proper: balance.trainerPointsProper,
  prime: balance.trainerPointsPrime,
};

/** Fitness a rest week gains on top of the base, by vet tier. A Rough vet adds nothing here. */
export const VET_REST_BONUS: Record<GoodTier, number> = {
  rough: 0,
  proper: balance.vetRestProper,
  prime: balance.vetRestPrime,
};

/** Extra crates of hold, by trader tier. */
export const TRADER_HOLD: Record<GoodTier, number> = {
  rough: balance.traderHoldRough,
  proper: balance.traderHoldProper,
  prime: balance.traderHoldPrime,
};

/** Extra market dogs, by scout tier. */
export const SCOUT_DOGS: Record<GoodTier, number> = {
  rough: balance.scoutDogsRough,
  proper: balance.scoutDogsProper,
  prime: balance.scoutDogsPrime,
};

/**
 * How far ahead a Tipster sees, by tier (GDD §9.3's fourth carrier, deferred from Phase B).
 *
 * Two numbers rather than one, because the two things information can be are worth different
 * money: a kibble **band** is the trader's road and a **card** is the trainer's.
 *
 * ⚠️ **The ladder starts one rung higher than §9.3's table implies, and deliberately.** As built,
 * next week's planet comes with its kibble band — the Docks has always printed "next stop, band
 * 40–70" and `tradeFoodPlan` has always read it, which is what makes the one-week trade a judgement
 * rather than a coin toss. So "next week's band" is already free, and a Rough tipster who sold it
 * would be the Fixer all over again: a wage for a service the game already gives away. Rough sells
 * next week's **card** instead, Proper adds the band a week further out, and Prime sells both.
 *
 * Nothing here reaches past `card` / `band` weeks, and the AI's `planetAhead` guard is raised by
 * exactly this much, so a Tipster cannot let an agent see further than a player with the same hire.
 */
export const TIPSTER_REACH: Record<GoodTier, { band: number; card: number }> = {
  rough: { band: 1, card: 1 },
  proper: { band: 2, card: 1 },
  prime: { band: 2, card: 2 },
};
