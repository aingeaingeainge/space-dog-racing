/**
 * Staff (GDD_V3 §8): **two trainers on commission.** Everyone is a trainer; there are no roles, no
 * ladder and no market. A stable is dealt two at the start of a game, and the only way to change one
 * is a Bar card (§9.1) — or, from Phase E, the off-season notice (§2.2).
 *
 * **Two kinds of row, and the engine only ever reads the first kind by what it does.**
 *
 * - A **bonus** (`STAFF_BONUSES`) is one line of §8.2's pool: what it does, what it is worth in
 *   commission, and how big it is. Its cut and its size are spreadsheet cells. Every system that a
 *   bonus touches reads `staffBonus(s, p, id)` and never asks who the trainer is.
 * - A **trainer** (`STAFF`) is a person: a name, a line of patter, a portrait, and one or two bonuses.
 *   Their cut is **derived** from the bonuses — the sum, plus a premium for a pair, capped — so a
 *   trainer's price is §8.2's table, not a number somebody typed next to a name.
 *
 * ⚠️ **Commission, not a wage (§8.1).** A trainer takes a share of *race prize money only* — never a
 * bet, a trade or anything else — and only when a dog places. That is what makes staff safe to deal
 * at random: you only pay when you win, and the same 10% trainer is cheap for a stable that makes
 * its money trading and dear for one that races hard.
 */
import { balance } from './balance';
import type { Id } from '../types';

/** One of §8.2's bonuses. The id is what the engine asks for; the name is never read. */
export type StaffBonusId =
  | 'statWeek'
  | 'fitnessWeek'
  | 'injuryHalf'
  | 'injuryShort'
  | 'styleReveal'
  | 'shelfIntel'
  | 'prizeUp'
  | 'saferExplore';

export interface StaffBonus {
  id: StaffBonusId;
  /** A few words for a badge. */
  short: string;
  /** One line a player reads on the Kennels and the offer. */
  text: string;
  /** Commission, a share of race prize money (§8.2). A sheet cell. */
  cut: number;
  /** How big the bonus is, in its own units. A sheet cell (0 where the bonus has no size). */
  size: number;
}

export const STAFF_BONUSES: readonly StaffBonus[] = [
  {
    id: 'statWeek',
    short: `+${balance.staffStatWeek} stat a week`,
    text: `Works every dog on its weakest stat: +${balance.staffStatWeek} a week, on top of the food`,
    cut: balance.staffCutStatWeek,
    size: balance.staffStatWeek,
  },
  {
    id: 'fitnessWeek',
    short: `+${balance.staffFitnessWeek} recovery`,
    text: `+${balance.staffFitnessWeek} fitness a week to every dog that did not run`,
    cut: balance.staffCutFitnessWeek,
    size: balance.staffFitnessWeek,
  },
  {
    id: 'injuryHalf',
    short: 'injuries halved',
    text: 'Checks every leg every morning: the injury chance is halved',
    cut: balance.staffCutInjuryHalf,
    size: balance.staffInjuryMult,
  },
  {
    id: 'injuryShort',
    short: `layoffs −${balance.staffInjuryShorter}w`,
    text: `Patches them up fast: a layoff is ${balance.staffInjuryShorter} week shorter (never under one)`,
    cut: balance.staffCutInjuryShort,
    size: balance.staffInjuryShorter,
  },
  {
    id: 'styleReveal',
    short: 'reads a rival',
    text: "Has a word around the kennels: once a week, one rival dog's style is made public",
    cut: balance.staffCutStyleReveal,
    size: 1,
  },
  {
    id: 'shelfIntel',
    short: "next week's prices",
    text: 'Still reads the freight manifests: where all six goods will sit next week, every week',
    cut: balance.staffCutShelfIntel,
    size: 0,
  },
  {
    id: 'prizeUp',
    short: `+${Math.round(balance.staffPrizeUp * 100)}% prize money`,
    text: `Knows every race secretary by name: +${Math.round(balance.staffPrizeUp * 100)}% on every purse, before the cut`,
    cut: balance.staffCutPrizeUp,
    size: balance.staffPrizeUp,
  },
  {
    id: 'saferExplore',
    short: 'keeps you out of trouble',
    text: `Knows which doors not to open: a card's bad outcomes are ×${balance.staffExploreRiskMult} as likely`,
    cut: balance.staffCutSaferExplore,
    size: balance.staffExploreRiskMult,
  },
];

export const STAFF_BONUS_BY_ID = Object.fromEntries(STAFF_BONUSES.map((b) => [b.id, b])) as Record<
  StaffBonusId,
  StaffBonus
>;

/** A trainer: a person, one or two bonuses, and a cut derived from them. */
export interface StaffRow {
  id: Id;
  name: string;
  /** One line of who they are, in the house voice. */
  blurb: string;
  bonuses: readonly StaffBonusId[];
  /** Portrait file stem under `portraits/`, resolved by the web's `lib/assets.ts`. */
  portrait: string;
  /** What the art brief says they look like (`packages/web/scripts/assets.ts`). */
  looks: string;
}

/**
 * The trainer's cut: the sum of their bonuses' cuts, plus the pair premium if they have two, capped
 * at `staffCutMax` (§8.1's 1–10%). Rounded to a whole per cent, because a player reads "7%".
 */
export function cutOf(row: Pick<StaffRow, 'bonuses'>): number {
  const sum = row.bonuses.reduce((a, id) => a + STAFF_BONUS_BY_ID[id].cut, 0);
  const raw = sum + (row.bonuses.length > 1 ? balance.staffCutPairPremium : 0);
  return Math.round(Math.min(balance.staffCutMax, raw) * 100) / 100;
}

/**
 * Twenty-four trainers: twelve with one bonus and twelve with two. With eight stables dealt two each,
 * eight are always out of work and can turn up in a Bar. **The order is part of the save**: the deal
 * shuffles this list.
 */
export const STAFF: readonly StaffRow[] = [
  // ---- One bonus ----
  {
    id: 'gristle',
    name: 'Gristle McGraw',
    blurb: 'Forty years on the circuit and a whistle only dogs can hear.',
    bonuses: ['statWeek'],
    portrait: 'trainer-01',
    looks: 'Gristle McGraw: a wiry old trainer with a whistle and a wandering eye',
  },
  {
    id: 'tick',
    name: 'Tick Halloran',
    blurb: 'Times everything. Rests them to the second.',
    bonuses: ['fitnessWeek'],
    portrait: 'trainer-02',
    looks: 'a brisk younger trainer with a stopwatch and a clipboard',
  },
  {
    id: 'osk',
    name: 'Madame Osk',
    blurb: 'A four-handed physio who wraps every leg twice.',
    bonuses: ['injuryHalf'],
    portrait: 'staff-osk',
    looks: 'a stern four-armed alien physiotherapist with bandage rolls in every hand',
  },
  {
    id: 'rumbold',
    name: 'Doc Rumbold',
    blurb: 'Patches them up and packs them off. Do not ask what is in the needle.',
    bonuses: ['injuryShort'],
    portrait: 'staff-rumbold',
    looks: 'a jowly back-street dog doctor with a head lamp and a leather bag',
  },
  {
    id: 'jhett',
    name: 'Whisper Jhett',
    blurb: 'Drinks with the kennel-boys of every yard on the circuit.',
    bonuses: ['styleReveal'],
    portrait: 'staff-jhett',
    looks: 'a thin, grinning alien gossip with oversized ears and a cocktail',
  },
  {
    id: 'pim',
    name: 'Ledger Pim',
    blurb: 'Ran freight for twenty years. Still reads every manifest going.',
    bonuses: ['shelfIntel'],
    portrait: 'staff-pim',
    looks: 'a small bespectacled mole-like clerk buried in shipping manifests',
  },
  {
    id: 'vell',
    name: 'Duchess Vell',
    blurb: 'Knows every race secretary by first name, and their children’s.',
    bonuses: ['prizeUp'],
    portrait: 'staff-vell',
    looks: 'a haughty feathered alien aristocrat in a fraying ballgown and opera gloves',
  },
  {
    id: 'anselm',
    name: 'Brother Anselm',
    blurb: 'A lapsed monk who knows exactly which doors not to open.',
    bonuses: ['saferExplore'],
    portrait: 'staff-anselm',
    looks: 'a calm hooded monk-alien with a lantern and a knowing half-smile',
  },
  {
    id: 'grubb',
    name: 'Nan Grubb',
    blurb: 'Feeds them broth and has them in bed by eight.',
    bonuses: ['fitnessWeek'],
    portrait: 'staff-grubb',
    looks: 'a tiny ancient grandmother alien stirring a steaming pot of broth',
  },
  {
    id: 'sarge',
    name: 'Sarge K-9',
    blurb: 'Drills them at dawn, in the rain, and shouts.',
    bonuses: ['statWeek'],
    portrait: 'staff-sarge',
    looks: 'a barrel-chested cyborg drill sergeant with a megaphone and a buzz cut',
  },
  {
    id: 'lucky',
    name: 'Lucky Oyelaran',
    blurb: 'Somehow always standing next to the man with the cheque.',
    bonuses: ['prizeUp'],
    portrait: 'staff-lucky',
    looks: 'a dapper smiling hustler in a gold waistcoat holding up a winner’s cheque',
  },
  {
    id: 'glass',
    name: 'Mother Glass',
    blurb: 'Checks every paw every morning, through a jeweller’s lens.',
    bonuses: ['injuryHalf'],
    portrait: 'staff-glass',
    looks: 'a glassy translucent alien matron peering through a jeweller’s loupe',
  },
  // ---- Two bonuses ----
  {
    id: 'brack',
    name: 'The Brack Twins',
    blurb: 'One works them, one rests them. Nobody can tell which is which.',
    bonuses: ['statWeek', 'fitnessWeek'],
    portrait: 'staff-brack',
    looks: 'identical burly twin trainers in matching tracksuits, one with a whistle',
  },
  {
    id: 'mossgrave',
    name: 'Old Mossgrave',
    blurb: 'Has seen every injury there is, and how to stop the next one.',
    bonuses: ['injuryHalf', 'injuryShort'],
    portrait: 'staff-mossgrave',
    looks: 'an ancient mossy tree-bark alien vet with a pipe and splints',
  },
  {
    id: 'fontaine',
    name: 'Zeb Fontaine',
    blurb: 'Knows everybody’s business, and sells none of it but to you.',
    bonuses: ['styleReveal', 'shelfIntel'],
    portrait: 'staff-fontaine',
    looks: 'a slick informant in a trench coat with a notebook full of secrets',
  },
  {
    id: 'ruin',
    name: 'Contessa Ruin',
    blurb: 'Expensive, imperious, and her dogs get better every week.',
    bonuses: ['prizeUp', 'statWeek'],
    portrait: 'staff-ruin',
    looks: 'an imperious cybernetic countess with a riding crop and a monocle',
  },
  {
    id: 'hex',
    name: 'Hex',
    blurb: 'Nobody knows her real name. She knows yours.',
    bonuses: ['saferExplore', 'styleReveal'],
    portrait: 'staff-hex',
    looks: 'a mysterious hooded fortune-teller alien with glowing eyes and tarot cards',
  },
  {
    id: 'umbo',
    name: 'Big Umbo',
    blurb: 'Carries the tired ones home. Literally.',
    bonuses: ['fitnessWeek', 'injuryHalf'],
    portrait: 'staff-umbo',
    looks: 'an enormous gentle blob-like alien carrying a sleepy greyhound',
  },
  {
    id: 'quillon',
    name: 'Dr Quillon',
    blurb: 'A proper vet, struck off for reasons she will not discuss.',
    bonuses: ['injuryShort', 'fitnessWeek'],
    portrait: 'staff-quillon',
    looks: 'a spiky porcupine-like alien vet in a stained white coat',
  },
  {
    id: 'sixeyes',
    name: 'Marta Six-Eyes',
    blurb: 'Watches the markets with three eyes and the purses with the other three.',
    bonuses: ['shelfIntel', 'prizeUp'],
    portrait: 'staff-sixeyes',
    looks: 'a six-eyed alien businesswoman with a ticker tape and an abacus',
  },
  {
    id: 'rook',
    name: 'Rook',
    blurb: 'Ex-security. Walks the dogs through the rough end like a bodyguard.',
    bonuses: ['saferExplore', 'injuryHalf'],
    portrait: 'staff-rook',
    looks: 'a hulking armoured bird-headed bodyguard with a leash in each claw',
  },
  {
    id: 'varga',
    name: 'Pops Varga',
    blurb: 'Old-school. Rubs them down with something that smells of engines.',
    bonuses: ['statWeek', 'injuryShort'],
    portrait: 'staff-varga',
    looks: 'a grizzled old mechanic-turned-trainer with oily hands and a flat cap',
  },
  {
    id: 'ondine',
    name: 'Silk Ondine',
    blurb: 'Glamour, spa days and a very good agent.',
    bonuses: ['prizeUp', 'fitnessWeek'],
    portrait: 'staff-ondine',
    looks: 'a glamorous aquatic alien in sunglasses and a silk robe at a dog spa',
  },
  {
    id: 'grubs',
    name: 'Grub & Grub',
    blurb: 'Two brothers, one van, and the freight gossip of eight planets.',
    bonuses: ['shelfIntel', 'saferExplore'],
    portrait: 'staff-grubs',
    looks: 'two scruffy grub-like alien brothers leaning on a battered freight van',
  },
];

export const STAFF_BY_ID: Record<Id, StaffRow> = Object.fromEntries(STAFF.map((r) => [r.id, r]));

export function staffRow(id: Id): StaffRow {
  const r = STAFF_BY_ID[id];
  if (!r) throw new Error('Unknown staff ' + id);
  return r;
}
