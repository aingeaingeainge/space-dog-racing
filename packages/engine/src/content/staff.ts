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
/**
 * What a Fixer's job costs, as a multiple of the fee on the row (GDD §13, E-D45).
 *
 * Declared above `STAFF_ROLES` because the Fixer's own row prints its price list and a `const`
 * read during module initialisation has to exist by then — the same reason `FIXER_CATCH_MULT`
 * further down is reached through `balance` rather than through itself. See `jobCost` for where
 * the numbers come from.
 */
export const FIXER_JOB_MULT: Record<GoodTier, number> = {
  rough: balance.fixJobMultRough,
  proper: balance.fixJobMultProper,
  prime: balance.fixJobMultPrime,
};

export interface StaffRoleRow {
  role: StaffRole;
  label: string;
  /** What the role is for, in the words the Saloon prints. */
  blurb: string;
  /**
   * Goes on the books for a weekly wage. **Five of the six do.**
   *
   * The Fixer was `false` for three phases because his abilities were not actions — charging a
   * wage for a service the game does not provide is a trap rather than a difficulty (GDD §19,
   * 2026-09-08). Phase D built §13 and set him `true`, and **that measured as the wrong shape
   * rather than the wrong price**: the road lost 3,498 Bones against the same agent with it
   * switched off, and every knob inside §13 was swept before it was clear that the *wage* was
   * what ate it (D42). So he is `false` again, for the opposite reason — not "there is nothing
   * for him to do" but "what he does is a job and a job is not a week" (E-D45). He is hired at
   * `PlanetState.fixer`, per job, priced by the same three-tier ladder.
   *
   * That is the test a seventh role has to pass before this flag is set on it: is the thing it
   * sells used *every week*? If it is used in bursts, it wants a price list and not a wage.
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
    blurb:
      'Standing information: what is coming up the circuit, without buying a dossier each week',
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
    blurb:
      'Knows a steward, and knows a man who can get at a dog. Paid by the job, never by the week (§13)',
    // ⚠️ Not on the books as of v2 Phase E, and the reason is the opposite of the one that kept
    // him off them until Phase D. There is plenty for him to do — §13's two jobs are real and the
    // edge is real — but a job is not a week, and a weekly wage for a man used twice a season is
    // what measured the whole road as a 3,498-Bone mistake (D42). He is at `PlanetState.fixer`
    // now: one man, this weekend, this price list (E-D45).
    hireable: false,
    effect: {
      rough: `A box ${jobCost('bribe', 'rough')} or a nobbling ${jobCost('sabotage', 'rough')} — but the stewards know his face: caught ${Math.round(balance.fixCatchBase * balance.fixCatchMultRough * 100)}% of the time`,
      proper: `A box ${jobCost('bribe', 'proper')} or a nobbling ${jobCost('sabotage', 'proper')}, and he is careful: caught ${Math.round(balance.fixCatchBase * balance.fixCatchMultProper * 100)}% of the time`,
      prime: `A box ${jobCost('bribe', 'prime')} or a nobbling ${jobCost('sabotage', 'prime')}, and nobody has ever proved a thing: caught ${Math.round(balance.fixCatchBase * balance.fixCatchMultPrime * 100)}% of the time`,
    },
  },
];

/**
 * What a job costs, by the grade of man taking it (GDD §13, §8.3, E-D45).
 *
 * ⚠️ **This is the price list that replaced the wage, and it is the named exception to D11.**
 * D11's second guard says *Prime staff are a weekly wage, not a purchase*, so the top tier is a
 * liability when the run ends rather than an "I have already won" button. The Fixer is off the
 * books, so that sentence cannot apply to him — and what replaces it is a stronger version of the
 * same guard rather than a hole in it: a Prime job is paid **every time**, so a leader who wants
 * the careful man buys him again on every race he fixes and can never bank him. A wage at least
 * gets cheaper the more you use it. This does not.
 *
 * The ladder itself is untouched: the job carries the tier, the tier sets the price *and* the
 * catch multiplier, and a planet-week offers one man at one grade — so you still cannot buy the
 * good one wherever you like, which is D41's rule and §8.3's "rarity is the point".
 *
 * ⚠️ **Where the multipliers come from, since they are new and nothing else in the sweep fixes
 * them.** The break-even is arithmetic: an edge `e` on a stake `S` against a catch chance `c`
 * clears `S·(e − c·fixFineStakeMult) − fee − c·fixFineBase`. At the measured 27% edge that is
 * roughly `0.21·S − fee − 300` for a Proper man, so the fee has to leave a fix worth placing at
 * the stake a *borrowed* bankroll reaches (8,000, the flat ceiling) and not at the three thousand
 * a racing stable carries spare. That is §2.1's crook column in one line — "in bursts, at the
 * biggest races" — and it is the shape the wage could not produce, because a wage is charged in
 * the quiet weeks too.
 */
export function jobCost(kind: 'bribe' | 'sabotage', tier: GoodTier): number {
  const base = kind === 'bribe' ? balance.bribeCost : balance.sabotageCost;
  return Math.round(base * FIXER_JOB_MULT[tier]);
}

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

/**
 * How likely the stewards are to notice, by the grade of man you employ (GDD §13, §8.3).
 *
 * ⚠️ **This started out as a ladder of *abilities* — a Rough fixer could buy a box and not get at
 * a dog — and that was wrong in a way only measurement showed.** It read well: the cheap half of
 * the road has no punishment tail, so why should the cheap man sell you the half that does? What
 * it actually did was starve the road. A Proper-or-better fixer turns up at 30% of the 45% of
 * planet-weeks that offer one at all, so a crook had a working fixer in **30% of its weeks, first
 * arriving in week 6.5** — half the season gone before the road opened, and the road's own
 * acceptance rows unreachable for want of a man rather than for want of a rule.
 *
 * So the Fixer's ladder is a ladder of a **number**, which is how every other role on it works
 * (D41). Any fixer will do either job; what you pay for is how well he covers his tracks. That
 * also gives the tiers something a player can feel: the same job, three prices, three risks.
 */
export const FIXER_CATCH_MULT: Record<GoodTier, number> = {
  rough: balance.fixCatchMultRough,
  proper: balance.fixCatchMultProper,
  prime: balance.fixCatchMultPrime,
};
