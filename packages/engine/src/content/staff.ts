/**
 * Staff (GDD_V3 §8, as Phase T rewrote it): **three people, one for each side of the game** — a Dog
 * Trainer for the racing, a Trade Advisor for the market and a Gambling Advisor for the Bookie. Every
 * stable has one of each (Jesse's call, `v3t`). Until `v3t` a stable had two trainers and no roles.
 *
 * **Two kinds of row, and the engine only ever reads the first kind by what it does.**
 *
 * - A **bonus** (`STAFF_BONUSES`) is one line of §8.2's pool: which role carries it, what it does, what
 *   it is worth in commission, and how big it is. Its cut and its size are spreadsheet cells. Every
 *   system that a bonus touches reads `staffBonus(p, id)` and never asks who the person is.
 * - A **person** (`STAFF`) is a role, a name, a line of patter, a portrait, and one or two bonuses of
 *   that role. Their cut is **derived** from the bonuses — the sum, plus a premium for a pair, capped —
 *   so a person's price is §8.2's table, not a number somebody typed next to a name.
 *
 * ⚠️ **Commission, not a wage (§8.1), and each takes it from their own side** (Jesse's call, `v3t`):
 * the Trainer a share of race prize money, the Trade Advisor a share of the *profit* on what the stable
 * sells, the Gambling Advisor a share of the *profit* on a winning slip. Each is paid only when their
 * side makes money, which is what keeps staff safe to draft and to offer at random.
 */
import { balance } from './balance';
import type { Id } from '../types';

/** The three jobs (Phase T). The order is the order a stable's `staff` is kept in and shown. */
export type StaffRole = 'trainer' | 'trade' | 'gambling';
export const STAFF_ROLES: readonly StaffRole[] = ['trainer', 'trade', 'gambling'] as const;

/** What a role is called, and what its commission is a share of, as a player reads it. */
export const ROLE_INFO: Record<StaffRole, { name: string; short: string; cutOf: string }> = {
  trainer: { name: 'Dog Trainer', short: 'Trainer', cutOf: 'prize money' },
  trade: { name: 'Trade Advisor', short: 'Trade', cutOf: 'trading profit' },
  gambling: { name: 'Gambling Advisor', short: 'Gambling', cutOf: 'betting winnings' },
};

/** One of §8.2's bonuses. The id is what the engine asks for; the name is never read. */
export type StaffBonusId =
  // the Dog Trainer's
  | 'statWeek'
  | 'fitnessWeek'
  | 'injuryHalf'
  | 'injuryShort'
  | 'prizeUp'
  | 'saferExplore'
  // the Trade Advisor's (Phase T)
  | 'shelfIntel'
  | 'haggle'
  | 'sellUp'
  | 'deepShelf'
  // the Gambling Advisor's (Phase T)
  | 'whisper'
  | 'sharpOdds'
  | 'stakeUp';

export interface StaffBonus {
  id: StaffBonusId;
  /** The role that carries it: nobody has a bonus from another's side. */
  role: StaffRole;
  /** A few words for a badge. */
  short: string;
  /** One line a player reads on the Kennels and the offer. */
  text: string;
  /** Commission, a share of the role's own side (§8.1): purses, trading profit or winnings. A sheet cell. */
  cut: number;
  /** How big the bonus is, in its own units. A sheet cell (0 where the bonus has no size). */
  size: number;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const STAFF_BONUSES: readonly StaffBonus[] = [
  {
    id: 'statWeek',
    role: 'trainer',
    short: `+${balance.staffStatWeek} stat a week`,
    text: `Drills the dog that needs it most: +${balance.staffStatWeek} a week to the lowest-rated dog's weakest stat, on top of the food`,
    cut: balance.staffCutStatWeek,
    size: balance.staffStatWeek,
  },
  {
    id: 'fitnessWeek',
    role: 'trainer',
    short: `+${balance.staffFitnessWeek} recovery`,
    text: `+${balance.staffFitnessWeek} fitness a week to every dog that did not run`,
    cut: balance.staffCutFitnessWeek,
    size: balance.staffFitnessWeek,
  },
  {
    id: 'injuryHalf',
    role: 'trainer',
    short: 'injuries halved',
    text: 'Checks every leg every morning: the injury chance is halved',
    cut: balance.staffCutInjuryHalf,
    size: balance.staffInjuryMult,
  },
  {
    id: 'injuryShort',
    role: 'trainer',
    short: `layoffs −${balance.staffInjuryShorter}w`,
    text: `Patches them up fast: a layoff is ${balance.staffInjuryShorter} week shorter (never under one)`,
    cut: balance.staffCutInjuryShort,
    size: balance.staffInjuryShorter,
  },
  {
    id: 'prizeUp',
    role: 'trainer',
    short: `+${pct(balance.staffPrizeUp)} prize money`,
    text: `Knows every race secretary by name: +${pct(balance.staffPrizeUp)} on every purse, before the cut`,
    cut: balance.staffCutPrizeUp,
    size: balance.staffPrizeUp,
  },
  {
    id: 'saferExplore',
    role: 'trainer',
    short: 'keeps you out of trouble',
    text: `Knows which doors not to open: a card's bad outcomes are ×${balance.staffExploreRiskMult} as likely`,
    cut: balance.staffCutSaferExplore,
    size: balance.staffExploreRiskMult,
  },
  {
    id: 'shelfIntel',
    role: 'trade',
    short: "next week's prices",
    text: 'Still reads the freight manifests: where all six goods will sit next week, every week',
    cut: balance.staffCutShelfIntel,
    size: 0,
  },
  {
    id: 'haggle',
    role: 'trade',
    short: `buys ${pct(balance.staffHaggle)} cheaper`,
    text: `Never pays the sticker price: every crate you buy costs ${pct(balance.staffHaggle)} less`,
    cut: balance.staffCutHaggle,
    size: balance.staffHaggle,
  },
  {
    id: 'sellUp',
    role: 'trade',
    short: `sells ${pct(balance.staffSellUp)} dearer`,
    text: `Knows who is buying: every crate you sell fetches ${pct(balance.staffSellUp)} more`,
    cut: balance.staffCutSellUp,
    size: balance.staffSellUp,
  },
  {
    id: 'deepShelf',
    role: 'trade',
    short: `+${pct(balance.staffDeepShelf)} on the shelf`,
    text: `Knows the man with the other crates: your shelf is ${pct(balance.staffDeepShelf)} deeper on every planet`,
    cut: balance.staffCutDeepShelf,
    size: balance.staffDeepShelf,
  },
  {
    id: 'whisper',
    role: 'gambling',
    short: 'a tip a week',
    text: "Hears the kennel gossip: once a week, a race-day tip about a rival's dog that nobody else has been told",
    cut: balance.staffCutWhisper,
    size: 1,
  },
  {
    id: 'sharpOdds',
    role: 'gambling',
    short: `+${pct(balance.staffSharpOdds)} on the odds`,
    text: `Always gets a better price: every slip you strike pays ${pct(balance.staffSharpOdds)} more if it wins`,
    cut: balance.staffCutSharpOdds,
    size: balance.staffSharpOdds,
  },
  {
    id: 'stakeUp',
    role: 'gambling',
    short: `+${pct(balance.staffStakeUp)} stake limit`,
    text: `The bookies trust them: the flat limit on a race is ${pct(balance.staffStakeUp)} higher for you`,
    cut: balance.staffCutStakeUp,
    size: balance.staffStakeUp,
  },
];

export const STAFF_BONUS_BY_ID = Object.fromEntries(STAFF_BONUSES.map((b) => [b.id, b])) as Record<
  StaffBonusId,
  StaffBonus
>;

/** A member of staff: a role, a person, one or two bonuses of that role, and a cut derived from them. */
export interface StaffRow {
  id: Id;
  role: StaffRole;
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
 * The person's cut: the sum of their bonuses' cuts, plus the pair premium if they have two, capped —
 * at `staffCutMax` for a Trainer (§8.1's 1–10% of purses), at `staffAdvisorCutMax` for an advisor,
 * whose side (a profit, not a purse) is smaller. Rounded to a whole per cent, because a player reads
 * "7%".
 */
export function cutOf(row: Pick<StaffRow, 'bonuses' | 'role'>): number {
  const sum = row.bonuses.reduce((a, id) => a + STAFF_BONUS_BY_ID[id].cut, 0);
  const raw = sum + (row.bonuses.length > 1 ? balance.staffCutPairPremium : 0);
  const cap = row.role === 'trainer' ? balance.staffCutMax : balance.staffAdvisorCutMax;
  return Math.round(Math.min(cap, raw) * 100) / 100;
}

/**
 * Forty-one people: seventeen Trainers, twelve Trade Advisors and twelve Gambling Advisors, each role
 * part one-bonus and part two. With eight stables holding one of each, at least four of every role are
 * always out of work and can turn up in a Bar. **The order is part of the save**: the draft shuffles
 * this list.
 *
 * The first twenty-four are the trainers of `v3n`–`v3s`, kept with their faces: seventeen are still
 * Trainers, and seven whose bonuses were a tip or the prices went to the side those belong to
 * (Ledger Pim, Grub & Grub and Marta Six-Eyes to trade; Whisper Jhett, Lucky Oyelaran, Hex and Zeb
 * Fontaine to gambling). The other seventeen are new at `v3t`.
 */
export const STAFF: readonly StaffRow[] = [
  // ---- Dog Trainers (a cut of the purses) ----
  {
    id: 'gristle',
    role: 'trainer',
    name: 'Gristle McGraw',
    blurb: 'Forty years on the circuit and a whistle only dogs can hear.',
    bonuses: ['statWeek'],
    portrait: 'trainer-01',
    looks: 'Gristle McGraw: a wiry old trainer with a whistle and a wandering eye',
  },
  {
    id: 'tick',
    role: 'trainer',
    name: 'Tick Halloran',
    blurb: 'Times everything. Rests them to the second.',
    bonuses: ['fitnessWeek'],
    portrait: 'trainer-02',
    looks: 'a brisk younger trainer with a stopwatch and a clipboard',
  },
  {
    id: 'osk',
    role: 'trainer',
    name: 'Madame Osk',
    blurb: 'A four-handed physio who wraps every leg twice.',
    bonuses: ['injuryHalf'],
    portrait: 'staff-osk',
    looks: 'a stern four-armed alien physiotherapist with bandage rolls in every hand',
  },
  {
    id: 'rumbold',
    role: 'trainer',
    name: 'Doc Rumbold',
    blurb: 'Patches them up and packs them off. Do not ask what is in the needle.',
    bonuses: ['injuryShort'],
    portrait: 'staff-rumbold',
    looks: 'a jowly back-street dog doctor with a head lamp and a leather bag',
  },
  {
    id: 'vell',
    role: 'trainer',
    name: 'Duchess Vell',
    blurb: 'Knows every race secretary by first name, and their children’s.',
    bonuses: ['prizeUp'],
    portrait: 'staff-vell',
    looks: 'a haughty feathered alien aristocrat in a fraying ballgown and opera gloves',
  },
  {
    id: 'anselm',
    role: 'trainer',
    name: 'Brother Anselm',
    blurb: 'A lapsed monk who knows exactly which doors not to open.',
    bonuses: ['saferExplore'],
    portrait: 'staff-anselm',
    looks: 'a calm hooded monk-alien with a lantern and a knowing half-smile',
  },
  {
    id: 'grubb',
    role: 'trainer',
    name: 'Nan Grubb',
    blurb: 'Feeds them broth and has them in bed by eight.',
    bonuses: ['fitnessWeek'],
    portrait: 'staff-grubb',
    looks: 'a tiny ancient grandmother alien stirring a steaming pot of broth',
  },
  {
    id: 'sarge',
    role: 'trainer',
    name: 'Sarge K-9',
    blurb: 'Drills them at dawn, in the rain, and shouts.',
    bonuses: ['statWeek'],
    portrait: 'staff-sarge',
    looks: 'a barrel-chested cyborg drill sergeant with a megaphone and a buzz cut',
  },
  {
    id: 'glass',
    role: 'trainer',
    name: 'Mother Glass',
    blurb: 'Checks every paw every morning, through a jeweller’s lens.',
    bonuses: ['injuryHalf'],
    portrait: 'staff-glass',
    looks: 'a glassy translucent alien matron peering through a jeweller’s loupe',
  },
  {
    id: 'brack',
    role: 'trainer',
    name: 'The Brack Twins',
    blurb: 'One works them, one rests them. Nobody can tell which is which.',
    bonuses: ['statWeek', 'fitnessWeek'],
    portrait: 'staff-brack',
    looks: 'identical burly twin trainers in matching tracksuits, one with a whistle',
  },
  {
    id: 'mossgrave',
    role: 'trainer',
    name: 'Old Mossgrave',
    blurb: 'Has seen every injury there is, and how to stop the next one.',
    bonuses: ['injuryHalf', 'injuryShort'],
    portrait: 'staff-mossgrave',
    looks: 'an ancient mossy tree-bark alien vet with a pipe and splints',
  },
  {
    id: 'ruin',
    role: 'trainer',
    name: 'Contessa Ruin',
    blurb: 'Expensive, imperious, and her dogs get better every week.',
    bonuses: ['prizeUp', 'statWeek'],
    portrait: 'staff-ruin',
    looks: 'an imperious cybernetic countess with a riding crop and a monocle',
  },
  {
    id: 'umbo',
    role: 'trainer',
    name: 'Big Umbo',
    blurb: 'Carries the tired ones home. Literally.',
    bonuses: ['fitnessWeek', 'injuryHalf'],
    portrait: 'staff-umbo',
    looks: 'an enormous gentle blob-like alien carrying a sleepy greyhound',
  },
  {
    id: 'quillon',
    role: 'trainer',
    name: 'Dr Quillon',
    blurb: 'A proper vet, struck off for reasons she will not discuss.',
    bonuses: ['injuryShort', 'fitnessWeek'],
    portrait: 'staff-quillon',
    looks: 'a spiky porcupine-like alien vet in a stained white coat',
  },
  {
    id: 'rook',
    role: 'trainer',
    name: 'Rook',
    blurb: 'Ex-security. Walks the dogs through the rough end like a bodyguard.',
    bonuses: ['saferExplore', 'injuryHalf'],
    portrait: 'staff-rook',
    looks: 'a hulking armoured bird-headed bodyguard with a leash in each claw',
  },
  {
    id: 'varga',
    role: 'trainer',
    name: 'Pops Varga',
    blurb: 'Old-school. Rubs them down with something that smells of engines.',
    bonuses: ['statWeek', 'injuryShort'],
    portrait: 'staff-varga',
    looks: 'a grizzled old mechanic-turned-trainer with oily hands and a flat cap',
  },
  {
    id: 'ondine',
    role: 'trainer',
    name: 'Silk Ondine',
    blurb: 'Glamour, spa days and a very good agent.',
    bonuses: ['prizeUp', 'fitnessWeek'],
    portrait: 'staff-ondine',
    looks: 'a glamorous aquatic alien in sunglasses and a silk robe at a dog spa',
  },
  // ---- Trade Advisors (a cut of the profit on sales) ----
  {
    id: 'pim',
    role: 'trade',
    name: 'Ledger Pim',
    blurb: 'Ran freight for twenty years. Still reads every manifest going.',
    bonuses: ['shelfIntel'],
    portrait: 'staff-pim',
    looks: 'a small bespectacled mole-like clerk buried in shipping manifests',
  },
  {
    id: 'brine',
    role: 'trade',
    name: 'Hattie Brine',
    blurb: 'Has never once paid the sticker price, and never will.',
    bonuses: ['haggle'],
    portrait: 'staff-brine',
    looks: 'a squat barnacled alien fishwife with a ledger and a fierce squint',
  },
  {
    id: 'tallow',
    role: 'trade',
    name: 'Mister Tallow',
    blurb: 'Could sell sand to a dune-worm and be tipped for it.',
    bonuses: ['sellUp'],
    portrait: 'staff-tallow',
    looks: 'a waxy, smiling salesman alien in a loud checked suit with a carnation',
  },
  {
    id: 'vosk',
    role: 'trade',
    name: 'Quartermaster Vosk',
    blurb: 'Knows the man in the back room with the other crates.',
    bonuses: ['deepShelf'],
    portrait: 'staff-vosk',
    looks: 'a burly lizard quartermaster with a clipboard and a ring of keys',
  },
  {
    id: 'clem',
    role: 'trade',
    name: 'Cargo Clem',
    blurb: 'Lives in the hold. Talks to the crates. They talk back.',
    bonuses: ['haggle'],
    portrait: 'staff-clem',
    looks: 'a scruffy young dockhand alien with goggles and a crowbar over one shoulder',
  },
  {
    id: 'grubs',
    role: 'trade',
    name: 'Grub & Grub',
    blurb: 'Two brothers, one van, and the freight gossip of eight planets.',
    bonuses: ['shelfIntel', 'deepShelf'],
    portrait: 'staff-grubs',
    looks: 'two scruffy grub-like alien brothers leaning on a battered freight van',
  },
  {
    id: 'sixeyes',
    role: 'trade',
    name: 'Marta Six-Eyes',
    blurb: 'Watches the markets with three eyes and the buyers with the other three.',
    bonuses: ['shelfIntel', 'sellUp'],
    portrait: 'staff-sixeyes',
    looks: 'a six-eyed alien businesswoman with a ticker tape and an abacus',
  },
  {
    id: 'ninefingers',
    role: 'trade',
    name: 'Penny Ninefingers',
    blurb: 'Buys low, sells high, and will not say where the tenth finger went.',
    bonuses: ['haggle', 'sellUp'],
    portrait: 'staff-ninefingers',
    looks: 'a sharp little rodent-like trader in fingerless gloves, one finger missing',
  },
  {
    id: 'abacus',
    role: 'trade',
    name: 'The Abacus',
    blurb: 'A counting-house robot with a cracked screen and perfect recall of every price.',
    bonuses: ['shelfIntel', 'haggle'],
    portrait: 'staff-abacus',
    looks: 'a boxy brass robot with an abacus for a chest and a cracked screen face',
  },
  {
    id: 'morrow',
    role: 'trade',
    name: 'Dray Morrow',
    blurb: 'Hauls freight for half the circuit and knows what it fetches.',
    bonuses: ['deepShelf', 'sellUp'],
    portrait: 'staff-morrow',
    looks: 'a huge shaggy yak-like freight hauler with a cargo harness',
  },
  {
    id: 'kelp',
    role: 'trade',
    name: 'Auntie Kelp',
    blurb: 'Knows every stallholder’s grandmother, and gets the family rate.',
    bonuses: ['haggle', 'deepShelf'],
    portrait: 'staff-kelp',
    looks: 'a cheerful green seaweed-haired alien grandmother with a shopping trolley',
  },
  {
    id: 'stroud',
    role: 'trade',
    name: 'Fennick Stroud',
    blurb: 'Ex-customs. Reads a manifest the way a priest reads scripture.',
    bonuses: ['deepShelf', 'shelfIntel'],
    portrait: 'staff-stroud',
    looks: 'a gaunt grey ex-customs officer in a peaked cap with a magnifying monocle',
  },
  // ---- Gambling Advisors (a cut of the winnings) ----
  {
    id: 'jhett',
    role: 'gambling',
    name: 'Whisper Jhett',
    blurb: 'Drinks with the kennel-boys of every yard on the circuit.',
    bonuses: ['whisper'],
    portrait: 'staff-jhett',
    looks: 'a thin, grinning alien gossip with oversized ears and a cocktail',
  },
  {
    id: 'lucky',
    role: 'gambling',
    name: 'Lucky Oyelaran',
    blurb: 'Somehow always standing next to the bookie when he is in a generous mood.',
    bonuses: ['stakeUp'],
    portrait: 'staff-lucky',
    looks: 'a dapper smiling hustler in a gold waistcoat holding up a winner’s cheque',
  },
  {
    id: 'oduya',
    role: 'gambling',
    name: 'Odds-On Oduya',
    blurb: 'Has never taken a price he could not improve on with a smile.',
    bonuses: ['sharpOdds'],
    portrait: 'staff-oduya',
    looks:
      'a dapper alien bookmaker-turned-advisor with a pencil moustache and a betting slip in his hatband',
  },
  {
    id: 'marchetti',
    role: 'gambling',
    name: 'Velvet Marchetti',
    blurb: 'The bookies send a car for her, and let her name the limit.',
    bonuses: ['stakeUp'],
    portrait: 'staff-marchetti',
    looks: 'a glamorous purple-furred alien high-roller in velvet with a long cigarette holder',
  },
  {
    id: 'pargeter',
    role: 'gambling',
    name: 'Snitch Pargeter',
    blurb: 'Hears everything in every kennel, for a price paid in winnings.',
    bonuses: ['whisper'],
    portrait: 'staff-pargeter',
    looks: 'a weaselly little informant alien with big ears under a flat cap',
  },
  {
    id: 'tumbler',
    role: 'gambling',
    name: 'Tumbler',
    blurb: 'A card-sharp with four hands and a perfect poker face.',
    bonuses: ['sharpOdds'],
    portrait: 'staff-tumbler',
    looks: 'a four-armed alien card-sharp shuffling two decks at once, expressionless',
  },
  {
    id: 'hex',
    role: 'gambling',
    name: 'Hex',
    blurb: 'Nobody knows her real name. She knows yours.',
    bonuses: ['whisper', 'sharpOdds'],
    portrait: 'staff-hex',
    looks: 'a mysterious hooded fortune-teller alien with glowing eyes and tarot cards',
  },
  {
    id: 'fontaine',
    role: 'gambling',
    name: 'Zeb Fontaine',
    blurb: 'Knows everybody’s business, and sells none of it but to you.',
    bonuses: ['whisper', 'stakeUp'],
    portrait: 'staff-fontaine',
    looks: 'a slick informant in a trench coat with a notebook full of secrets',
  },
  {
    id: 'dice',
    role: 'gambling',
    name: 'Professor Dice',
    blurb: 'Has a theory of everything, and it is mostly probability.',
    bonuses: ['sharpOdds', 'stakeUp'],
    portrait: 'staff-dice',
    looks: 'an elderly owl-like alien academic with spectacles and dice for cufflinks',
  },
  {
    id: 'longshot',
    role: 'gambling',
    name: 'Lady Longshot',
    blurb: 'Backs the outsider, and somehow the outsider knows it.',
    bonuses: ['whisper', 'stakeUp'],
    portrait: 'staff-longshot',
    looks: 'an elegant gaunt alien lady in a huge feathered hat with binoculars',
  },
  {
    id: 'ferrety',
    role: 'gambling',
    name: 'Mags Ferrety',
    blurb: 'Gets into every kennel and out again with the gossip and a better price.',
    bonuses: ['whisper', 'sharpOdds'],
    portrait: 'staff-ferrety',
    looks: 'a wiry ferret-faced woman in a long coat full of pockets',
  },
  {
    id: 'evens',
    role: 'gambling',
    name: 'The Count of Evens',
    blurb: 'A ruined aristocrat who still bets like he owns the planet.',
    bonuses: ['stakeUp', 'sharpOdds'],
    portrait: 'staff-evens',
    looks: 'a threadbare vampire-like alien count with a monocle and a tarnished medal',
  },
];

export const STAFF_BY_ID: Record<Id, StaffRow> = Object.fromEntries(STAFF.map((r) => [r.id, r]));

export function staffRow(id: Id): StaffRow {
  const r = STAFF_BY_ID[id];
  if (!r) throw new Error('Unknown staff ' + id);
  return r;
}

/** The people of one role, in the rows' order. */
export function staffOfRole(role: StaffRole): StaffRow[] {
  return STAFF.filter((r) => r.role === role);
}
