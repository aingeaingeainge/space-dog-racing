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
  'Bronze 1st': 'purseBronze1',
  'Bronze 2nd': 'purseBronze2',
  'Bronze 3rd': 'purseBronze3',
  'Silver 1st': 'purseSilver1',
  'Silver 2nd': 'purseSilver2',
  'Silver 3rd': 'purseSilver3',
  'Gold 1st': 'purseGold1',
  'Gold 2nd': 'purseGold2',
  'Gold 3rd': 'purseGold3',
  'Bronze: max rating': 'capBronze',
  'Silver: max rating': 'capSilver',
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
