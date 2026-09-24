/**
 * Reads design/space_dog_racing_economy.xlsx (sheet "Assumptions", column A labels →
 * column B values), merges in scripts/balance.extras.json for the numbers the sheet
 * does not carry, and writes src/content/balance.json.
 *
 * Run with `npm run balance` from the repo root. The sheet wins on any key clash.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const xlsxPath = resolve(here, '../../../design/space_dog_racing_economy.xlsx');
const extrasPath = resolve(here, 'balance.extras.json');
const outPath = resolve(here, '../src/content/balance.json');

/** Exact column-A label in the Assumptions sheet → balance.json key. */
/**
 * Exact column-A label in the Assumptions sheet → balance.json key.
 *
 * ⚠️ **107 rows were pruned from the sheet in v3 Phase A** (BUILD_PLAN_V3 §2.1) and this map shrank
 * with them: the tier ladder, the twelve feeds, the six staff roles, the ship, the fuel, the crook's
 * road, the flat stake ceiling, the championship purse, the dossier and v2's two purse tiers are all
 * gone. Pruning rows rather than marking them superseded was safe because **this workbook contains
 * no formulas at all** — verified, no `<f>` element in any sheet's XML — so nothing could be
 * referencing the cells that moved. A future phase should not assume that still holds.
 */
const LABELS: Record<string, string> = {
  'Currency name': 'currencyName',
  'Race weekends per season': 'weeks',
  'Traps (runners) per race': 'traps',
  'Major purse multiplier (week 5)': 'majorMult',
  'Grand Final purse multiplier (week 10)': 'finalMult',
  // GDD_V3 §7.1: three purse tiers, open entry. Each race carries its own three numbers now —
  // with three rows that *are* the ladder, a shared tier table is what would hide it.
  'Gold Cup 1st': 'purseGold1',
  'Gold Cup 2nd': 'purseGold2',
  'Gold Cup 3rd': 'purseGold3',
  'Silver Plate 1st': 'purseSilver1',
  'Silver Plate 2nd': 'purseSilver2',
  'Silver Plate 3rd': 'purseSilver3',
  'Bronze Dash 1st': 'purseBronze1',
  'Bronze Dash 2nd': 'purseBronze2',
  'Bronze Dash 3rd': 'purseBronze3',
  'Food units eaten per dog per week': 'foodPerDog',
  'Hold capacity (units, everyone, forever)': 'holdCap',
  'Starting cash': 'startCash',
  'Starting dogs': 'startDogs',
  'a (floor)': 'valueFloor',
  'b (curve)': 'valueCurve',
  // GDD_V3 §4.3's value column. Ages 1 and 2 are the growth years, 3–4 the peak, 5+ the decline.
  'Age factor: 1 (pup, high upside)': 'ageFactor1',
  'Age factor: 2': 'ageFactor2',
  'Age factor: 3 (peak)': 'ageFactor3',
  'Age factor: 4': 'ageFactor4',
  'Age factor: 5 (declining)': 'ageFactor5',
  'Age factor: 6+ (retire soon)': 'ageFactor6',
  'House margin (overround)': 'bettingMargin',
  'Max stake per race (% of cash)': 'maxStakeFraction',
  // The race simulation (GDD §6.2). Unchanged in v3 (BUILD_PLAN_V3 §2.3) except that the break
  // from the boxes reads Acceleration rather than Trap.
  'Race: base speed (m/s)': 'raceBaseSpeed',
  'Race: speed coefficient (m/s per 100 Speed)': 'raceSpeedCoef',
  'Race: fade penalty past the stamina point': 'raceFadePenalty',
  'Race: acceleration base (m/s²)': 'raceAccelBase',
  'Race: acceleration coefficient (m/s² per 100 Accel)': 'raceAccelCoef',
  'Race: break from the boxes (metres at 100 Accel)': 'raceBreakMetres',
  'Race: bump chance on a bend': 'raceBumpChance',
  'Race: bump speed penalty': 'raceBumpPenalty',
  'Race: bump distance (metres)': 'raceBumpDistance',
  // Condition (GDD §5.2 / GDD_V3 §4.2). The fitness curve is kept whole (§2.3).
  'Fitness multiplier: floor': 'fitScaleBase',
  'Fitness multiplier: range': 'fitScaleCoef',
  // Race or Rest (GDD_V3 §4.2). Train is gone; these two are the whole of the fitness budget, and
  // the Race cost is the ONE number Phase A is allowed to tune (the races-entered band).
  'Fitness: cost of a race': 'fitnessPerRace',
  'Fitness: gain from a rest week': 'fitnessRest',
  'Growth: stat points a week at age 1': 'growthAge1',
  'Growth: stat points a week at age 2': 'growthAge2',
  'Decline: stat points a week at age 5+': 'declinePerWeek',
  'Local dog fitness': 'localFitness',
  // Locals are priced by the race they fill (GDD_V3 §7.1).
  'Local dog rating: Gold Cup': 'localRatingGold',
  'Local dog rating: Silver Plate': 'localRatingSilver',
  'Local dog rating: Bronze Dash': 'localRatingBronze',
  // The draw (GDD §6.2, D37). Kept whole: folding Trap into Accel was done precisely so that
  // these two keep pulling against each other (GDD_V3 V9).
  'Trap draw: top-speed edge across the width of the boxes': 'trapDrawEdge',
  'Trap draw: trap craft the rail costs, across the width of the boxes': 'trapTraffic',
  // ---- v3 Phase A ----
  // GDD_V3 §4.3's age bands. Growth, rest recovery and the injury multiplier all band by age, and
  // growth is on top of whatever the food gives — which is the shape that makes the retirement
  // window of §2.2 a real decision rather than a formality.
  'Age 1: growth, stat points a week': 'growthAge1Band',
  'Age 2: growth, stat points a week': 'growthAge2Band',
  'Age 5: decline, stat points a week': 'declineAge5',
  'Age 6: decline, stat points a week': 'declineAge6',
  'Age 7: decline, stat points a week': 'declineAge7',
  'Age 5: rest recovery': 'restAge5',
  'Age 6: rest recovery': 'restAge6',
  'Age 7: rest recovery': 'restAge7',
  'Age 5: injury multiplier': 'injuryMultAge5',
  'Age 6: injury multiplier': 'injuryMultAge6',
  'Age 7: injury multiplier': 'injuryMultAge7',
  // The circuit (GDD_V3 §2.1).
  'Major weekend': 'majorWeek',
  'Grand Final weekend': 'grandFinalWeek',
  'Regular planets drawn from the pool of 14': 'regularPlanets',
  'Dogs dealt at the start': 'startDogsDealt',
  // §5.5 / V2: every dealt dog rates exactly this, with its shape drawn (decision C1).
  'Starting dog rating (every dealt dog, exactly)': 'startDogRating',
  'Starting dog shape: widest deviation on speed or accel': 'startDogShapeSpread',
  // ---- v3 Phase B ----
  // GDD_V3 §6.1's six goods. Four rows each: the 8× band, and the shelf depth that is the scarcity
  // rule. `content/goods.ts` is a row per good reading these; nothing branches on which good it is.
  'Grey Mash: price floor': 'greyMashFloor',
  'Grey Mash: price ceiling': 'greyMashCeiling',
  'Grey Mash: shelf depth, minimum': 'greyMashShelfMin',
  'Grey Mash: shelf depth, maximum': 'greyMashShelfMax',
  'Scrapmeat: price floor': 'scrapmeatFloor',
  'Scrapmeat: price ceiling': 'scrapmeatCeiling',
  'Scrapmeat: shelf depth, minimum': 'scrapmeatShelfMin',
  'Scrapmeat: shelf depth, maximum': 'scrapmeatShelfMax',
  'Glow Tripe: price floor': 'glowTripeFloor',
  'Glow Tripe: price ceiling': 'glowTripeCeiling',
  'Glow Tripe: shelf depth, minimum': 'glowTripeShelfMin',
  'Glow Tripe: shelf depth, maximum': 'glowTripeShelfMax',
  'Vat Steak: price floor': 'vatSteakFloor',
  'Vat Steak: price ceiling': 'vatSteakCeiling',
  'Vat Steak: shelf depth, minimum': 'vatSteakShelfMin',
  'Vat Steak: shelf depth, maximum': 'vatSteakShelfMax',
  'Pulsar Marrow: price floor': 'pulsarMarrowFloor',
  'Pulsar Marrow: price ceiling': 'pulsarMarrowCeiling',
  'Pulsar Marrow: shelf depth, minimum': 'pulsarMarrowShelfMin',
  'Pulsar Marrow: shelf depth, maximum': 'pulsarMarrowShelfMax',
  'Ambrosia: price floor': 'ambrosiaFloor',
  'Ambrosia: price ceiling': 'ambrosiaCeiling',
  'Ambrosia: shelf depth, minimum': 'ambrosiaShelfMin',
  'Ambrosia: shelf depth, maximum': 'ambrosiaShelfMax',
  // §6.3's feeding table. Three cheap foods each aimed at one stat, three exotics that are broader
  // and touch condition (V6) — the randomness sits inside each row rather than between them.
  'Grey Mash: stat points a week, minimum': 'greyMashGainMin',
  'Grey Mash: stat points a week, maximum': 'greyMashGainMax',
  'Scrapmeat: stat points a week, minimum': 'scrapmeatGainMin',
  'Scrapmeat: stat points a week, maximum': 'scrapmeatGainMax',
  'Glow Tripe: stat points a week, minimum': 'glowTripeGainMin',
  'Glow Tripe: stat points a week, maximum': 'glowTripeGainMax',
  'Vat Steak: stat points a week, minimum': 'vatSteakGainMin',
  'Vat Steak: stat points a week, maximum': 'vatSteakGainMax',
  'Pulsar Marrow: stat points a week, minimum': 'pulsarMarrowGainMin',
  'Pulsar Marrow: stat points a week, maximum': 'pulsarMarrowGainMax',
  'Pulsar Marrow: fitness a week': 'pulsarMarrowFitness',
  'Ambrosia: stat points a week, minimum': 'ambrosiaGainMin',
  'Ambrosia: stat points a week, maximum': 'ambrosiaGainMax',
  'Ambrosia: fitness a week': 'ambrosiaFitness',
  'Ambrosia: injury chance multiplier for the week': 'ambrosiaInjuryMult',
  // §6.3's running cost — the only one there is (V10).
  'Empty hold: fitness a dog loses when it does not eat': 'emptyHoldFitness',
  // §6.4's shape. The distribution is the guard on the p99 trading leg; the bands are not.
  'Price draw: standard deviation as a fraction of the band': 'priceDrawSd',
  'Price draw: clamp, closest a draw may come to either end of the band': 'priceDrawClamp',
  'Planet band bias: floor': 'planetBiasMin',
  'Planet band bias: ceiling': 'planetBiasMax',
  // ---- v3 Phase C ----
  // GDD_V3 §5.1's three styles, one row each: the pace-curve modifiers. A style
  // is data, so `content/styles.ts` reads these and the simulation never branches on a style's name.
  'Front-runner: early top-speed multiplier': 'styleFrontRunnerSpeed',
  'Front-runner: fade start shift': 'styleFrontRunnerFade',
  'Front-runner: fade penalty multiplier': 'styleFrontRunnerFadeMult',
  'Stalker: early top-speed multiplier': 'styleStalkerSpeed',
  'Stalker: fade start shift': 'styleStalkerFade',
  'Stalker: fade penalty multiplier': 'styleStalkerFadeMult',
  'Closer: early top-speed multiplier': 'styleCloserSpeed',
  'Closer: fade start shift': 'styleCloserFade',
  'Closer: fade penalty multiplier': 'styleCloserFadeMult',
  'Style: the early part of the race (fraction of the trip)': 'styleEarlyFraction',
  // §5.2 / V13: the day's expression scales the style's *shape*, never the dog's speed.
  'Style expression: minimum': 'styleExpressionMin',
  'Style expression: maximum': 'styleExpressionMax',
  // A7 (GDD_V3 B9): the fade point is metres from the boxes now, not a fraction of the trip.
  'Race: reference trip for the fade point (metres)': 'raceFadeRefMetres',
  'Race: metres from the fade point to a full fade': 'raceFadeLengthMetres',
  // §5.6: what the book adds for a public style, by trip. It never sees the field (decision C6).
  'Book: Front-runner on a sprint (rating points)': 'bookEdgeFrontRunnerSprint',
  'Book: Front-runner on a standard trip (rating points)': 'bookEdgeFrontRunnerStandard',
  'Book: Front-runner on a staying trip (rating points)': 'bookEdgeFrontRunnerStaying',
  'Book: Stalker on a sprint (rating points)': 'bookEdgeStalkerSprint',
  'Book: Stalker on a standard trip (rating points)': 'bookEdgeStalkerStandard',
  'Book: Stalker on a staying trip (rating points)': 'bookEdgeStalkerStaying',
  'Book: Closer on a sprint (rating points)': 'bookEdgeCloserSprint',
  'Book: Closer on a standard trip (rating points)': 'bookEdgeCloserStandard',
  'Book: Closer on a staying trip (rating points)': 'bookEdgeCloserStaying',
  // Phase C2, GDD_V3 §5.3: the hot pace. Two front-runners at the head light it; the lead group pays.
  'Hot pace: window (fraction of the trip)': 'hotPaceWindow',
  'Hot pace: front-runners within this of each other at the head (metres)': 'hotPaceContestMetres',
  'Hot pace: the lead group, within this of the leader (metres)': 'hotPaceGroupMetres',
  'Hot pace: fade point cost for a whole window in a hot lead group (metres)': 'hotPaceFadeCost',
  'Front-runner: lights the pace (1 = yes)': 'styleFrontRunnerLightsPace',
  'Stalker: lights the pace (1 = yes)': 'styleStalkerLightsPace',
  'Closer: lights the pace (1 = yes)': 'styleCloserLightsPace',
  // Phase C2, §14 Q11: the run-in. The whole field tires into the line, by position, alike.
  'Race: the run-in, the last metres of every trip (metres)': 'raceRunInMetres',
  'Race: speed lost at the line in the run-in': 'raceRunInPenalty',
  // Phase D1, GDD_V3 §9.2: a dog offered in the Pound — age, one stat, and patter that can lie.
  'Dog offer: the seller lies, chance': 'dogOfferLieRate',
  'Dog offer: rating, mean': 'dogOfferRatingMean',
  'Dog offer: rating, sd': 'dogOfferRatingSd',
  'Dog offer: youngest age': 'dogOfferAgeMin',
  'Dog offer: oldest age': 'dogOfferAgeMax',
  'Dog offer: the claimed stat, when honest (points above the level)': 'dogOfferClaimHonest',
  'Dog offer: the claimed stat, when lying (points below the level)': 'dogOfferClaimLie',
  // Phase D1 item 6: race-day conditions, drawn at arrival and never priced by the book.
  'Condition: a knock, chance per stable dog per weekend': 'conditionKnockChance',
  'Condition: a knock, fitness on race day': 'conditionKnockFitness',
  'Condition: off its feed, chance per stable dog per weekend': 'conditionOffFeedChance',
  'Condition: off its feed, fitness on race day': 'conditionOffFeedFitness',
  'Condition: buzzing, chance per stable dog per weekend': 'conditionBuzzingChance',
  'Condition: buzzing, speed on race day (stat points)': 'conditionBuzzingSpeed',
  // Phase D2, GDD_V3 §8: staff on commission.
  'Staff: trainers dealt to each stable at the start of a game': 'staffSlots',
  'Staff cut: +1 stat a week': 'staffCutStatWeek',
  'Staff cut: +5 fitness recovery a week': 'staffCutFitnessWeek',
  'Staff cut: injury chance halved': 'staffCutInjuryHalf',
  'Staff cut: injury duration −1 week': 'staffCutInjuryShort',
  "Staff cut: reveals a rival dog's style a week": 'staffCutStyleReveal',
  "Staff cut: next planet's band position for all six goods": 'staffCutShelfIntel',
  'Staff cut: +10% prize money': 'staffCutPrizeUp',
  'Staff cut: Explore less likely to go badly': 'staffCutSaferExplore',
  'Staff cut: premium for a trainer with two bonuses': 'staffCutPairPremium',
  'Staff cut: the most a trainer takes': 'staffCutMax',
  'Staff bonus: stat points a week, to one dog': 'staffStatWeek',
  'Staff bonus: fitness a week, to a dog that did not run': 'staffFitnessWeek',
  'Staff bonus: injury chance ×': 'staffInjuryMult',
  'Staff bonus: weeks off a layoff, at the roll': 'staffInjuryShorter',
  'Staff bonus: extra prize money, share of the purse': 'staffPrizeUp',
  "Staff bonus: an Explore card's bad-outcome chance ×": 'staffExploreRiskMult',
  // Phase D2, GDD_V3 §9.3: sabotage and the stewards.
  "Sabotage: a nobbled runner's fitness on race day": 'nobbleFitness',
  'Sabotage: stewards catch a nobbler, chance (any planet without its own)': 'catchChance',
  'Sabotage: catch chance at Lagrange Lows': 'catchChanceLagrangeLows',
  'Sabotage: catch chance at Holy Bark': 'catchChanceHolyBark',
  'Sabotage: caught, a flat fine': 'caughtFine',
  'Sabotage: caught, share of what the nobbler had on the race': 'caughtStakeShare',
  // Phase E1, GDD_V3 §2.1: how long a game is.
  'Game: fewest seasons a table may choose': 'gameSeasonsMin',
  'Game: most seasons a table may choose': 'gameSeasonsMax',
  'Target: suggested net worth, a short game': 'targetShort',
  'Target: suggested net worth, a long game': 'targetLong',
  'Target: the most seasons a Target game runs': 'targetSeasonCap',
  // Phase E1, GDD_V3 §2.2: the off-season.
  'Off-season: a trainer leaves, chance each': 'staffNoticeChance',
  "Off-season: the replacement's seller lies, × the dog-offer rate": 'retireOfferLieMult',
  'Off-season: AI retires when the offer beats its cheapest dog by (Bones)': 'aiRetireMargin',
  'Off-season: AI retires a dog this old, whatever the offer': 'aiRetireAge',
};

const wb = XLSX.read(readFileSync(xlsxPath));
const sheet = wb.Sheets['Assumptions'];
if (!sheet) throw new Error('No "Assumptions" sheet in ' + xlsxPath);
const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });

const fromSheet: Record<string, string | number> = {};
const seen = new Set<string>();
for (const row of rows) {
  const label = row[0];
  if (typeof label !== 'string') continue;
  const key = LABELS[label.trim()];
  if (!key) continue;
  const value = row[1];
  if (value === null || value === undefined || value === '') continue;
  fromSheet[key] = typeof value === 'number' ? value : String(value);
  seen.add(label.trim());
}
const missing = Object.keys(LABELS).filter((l) => !seen.has(l));
if (missing.length)
  throw new Error('Assumptions sheet is missing labels:\n  ' + missing.join('\n  '));

const extras = JSON.parse(readFileSync(extrasPath, 'utf8')) as Record<string, unknown>;
delete extras['_comment'];

const merged: Record<string, unknown> = { ...extras, ...fromSheet };
const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
const out = {
  _generated: 'by packages/engine/scripts/balance-from-xlsx.ts — do not hand-edit',
  ...sorted,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(
  `balance.json: ${Object.keys(fromSheet).length} values from the sheet, ${Object.keys(extras).length} from extras → ${outPath}`,
);
