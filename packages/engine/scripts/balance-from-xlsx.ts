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
  'Food price: cheapest planet': 'foodPriceMin',
  'Food price: dearest planet': 'foodPriceMax',
  'Typical realised margin per unit': 'foodTypicalMargin',
  'Hold capacity (units, everyone, forever)': 'holdCap',
  'Starting cash': 'startCash',
  'Starting dogs': 'startDogs',
  'Average starting dog rating': 'startDogRatingAvg',
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
  'Fitness: gain from a training week': 'fitnessTrain',
  'Fitness: gain from a rest week': 'fitnessRest',
  'Training: plain kibble, minimum stat points': 'trainKibbleMin',
  'Training: plain kibble, maximum stat points': 'trainKibbleMax',
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
  'Starting dog stat budget (total across three stats)': 'startStatBudget',
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
