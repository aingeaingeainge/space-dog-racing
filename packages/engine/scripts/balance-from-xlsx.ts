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
const LABELS: Record<string, string> = {
  'Currency name': 'currencyName',
  'Race weekends per season': 'weeks',
  'Traps (runners) per race': 'traps',
  'Major purse multiplier (weeks 4, 7, 10)': 'majorMult',
  'Grand Final purse multiplier (week 13)': 'finalMult',
  // GDD §6.4: two purse tiers, not three classes. The Open pays the headline money every
  // weekend; both drawn types pay the same, because what they ask of a dog differs and what
  // they pay does not.
  'The Open 1st': 'purseOpen1',
  'The Open 2nd': 'purseOpen2',
  'The Open 3rd': 'purseOpen3',
  'Drawn race 1st': 'purseDrawn1',
  'Drawn race 2nd': 'purseDrawn2',
  'Drawn race 3rd': 'purseDrawn3',
  // The two race types that post a number rather than a fact (GDD §6.3).
  'Handicap: max rating': 'capHandicap',
  'Invitational: min rating': 'floorInvitational',
  'Kennel upkeep per dog': 'upkeepPerDog',
  'Food units eaten per dog per week': 'foodPerDog',
  'Ship fuel per jump (base)': 'fuelBase',
  'Trainer wage per week': 'trainerWage',
  'Vet wage per week': 'vetWage',
  'Food price: cheapest planet': 'foodPriceMin',
  'Food price: dearest planet': 'foodPriceMax',
  'Typical realised margin per unit': 'foodTypicalMargin',
  'Starting cargo capacity (units)': 'cargoCapStart',
  'Cargo hold upgrade (+units)': 'cargoUpgradeUnits',
  'Starting cash': 'startCash',
  'Starting dogs': 'startDogs',
  'Average starting dog rating': 'startDogRatingAvg',
  'Starting ship value': 'shipStartValue',
  'a (floor)': 'valueFloor',
  'b (curve)': 'valueCurve',
  'Age factor: 1 (pup, high upside)': 'ageFactor1',
  'Age factor: 2': 'ageFactor2',
  'Age factor: 3 (peak)': 'ageFactor3',
  'Age factor: 4': 'ageFactor4',
  'Age factor: 5 (declining)': 'ageFactor5',
  'Age factor: 6+ (retire soon)': 'ageFactor6',
  'House margin (overround)': 'bettingMargin',
  'Max stake per race (% of cash)': 'maxStakeFraction',
  // The race simulation (GDD §6.2). These nine decide which stats matter, so they belong in the
  // design instrument rather than in extras — D12 was found by sweeping exactly these.
  'Race: base speed (m/s)': 'raceBaseSpeed',
  'Race: speed coefficient (m/s per 100 Speed)': 'raceSpeedCoef',
  'Race: fade penalty past the stamina point': 'raceFadePenalty',
  'Race: acceleration base (m/s²)': 'raceAccelBase',
  'Race: acceleration coefficient (m/s² per 100 Accel)': 'raceAccelCoef',
  'Race: break from the boxes (metres at 100 Trap)': 'raceBreakMetres',
  'Race: bump chance on a bend': 'raceBumpChance',
  'Race: bump speed penalty': 'raceBumpPenalty',
  'Race: bump distance (metres)': 'raceBumpDistance',
  // Condition (GDD §5.2). fitScale multiplies every stat in the race, so it is the most violent
  // lever in the game and the one D13 softens — it does not belong buried in simulateRace.ts.
  'Fitness multiplier: floor': 'fitScaleBase',
  'Fitness multiplier: range': 'fitScaleCoef',
  // Race, Train or Rest (GDD §5.7) and growth by age (§5.6). The whole of Phase A's training
  // game is these eleven numbers, and D14's pup band is narrow enough to want sweeping.
  'Fitness: cost of a race': 'fitnessPerRace',
  'Fitness: gain from a training week': 'fitnessTrain',
  'Fitness: gain from a rest week': 'fitnessRest',
  'Fitness: gain from a rest week with a vet': 'fitnessRestVet',
  'Training: plain kibble, minimum stat points': 'trainKibbleMin',
  'Training: plain kibble, maximum stat points': 'trainKibbleMax',
  'Growth: stat points a week at age 1': 'growthAge1',
  'Growth: stat points a week at age 2': 'growthAge2',
  'Decline: stat points a week at age 5+': 'declinePerWeek',
  'Kennel slots at the top ship tier': 'kennelSlotsMax',
  'Local dog fitness': 'localFitness',
  // Locals are priced by the purse tier of the race they fill, not by a class (D17).
  'Local dog rating: The Open': 'localRatingOpen',
  'Local dog rating: a drawn race': 'localRatingDrawn',
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
