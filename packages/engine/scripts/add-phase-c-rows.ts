/**
 * One-shot: add v2 Phase C's tunables to the Assumptions sheet of
 * design/space_dog_racing_economy.xlsx.
 *
 * The spreadsheet is the design instrument and `balance.json` is generated from it — the JSON is
 * never hand-edited (CLAUDE.md). Phase C introduces the goods ladder, the staff ladder and the
 * two fuel numbers, and every one of them is a number a designer will want to sweep, so they go
 * in the sheet rather than in `balance.extras.json`.
 *
 * Run once with `npx tsx packages/engine/scripts/add-phase-c-rows.ts`, then `npm run balance`.
 * Kept in the repo as the record of which rows were added and what each note says.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, '../../../design/space_dog_racing_economy.xlsx');

type Row = (string | number)[];

/** Rows to append. A row with only a label is a section heading, matching the sheet's own style. */
const ROWS: Row[] = [
  [],
  ['The tier ladder (GDD §8.1 / D11 — one vocabulary for goods, staff and the ship)'],
  [
    'Tier stock chance: Rough',
    0.7,
    'GDD §8.1 rolls stock roughly 70/25/5. Applied per stat-and-tier, so a planet stocks about four feeds out of twelve',
  ],
  ['Tier stock chance: Proper', 0.25, 'The working middle of the game'],
  [
    'Tier stock chance: Prime',
    0.05,
    'Rare on purpose. 13 planets × 4 stats × 0.05 is 2.6 Prime feeds a season, which is the 2–5 acceptance row',
  ],
  ['Tier shelf depth: Rough, min crates', 8],
  ['Tier shelf depth: Rough, max crates', 20],
  ['Tier shelf depth: Proper, min crates', 5],
  ['Tier shelf depth: Proper, max crates', 12],
  ['Tier shelf depth: Prime, min crates', 2],
  [
    'Tier shelf depth: Prime, max crates',
    6,
    'A Prime shelf is shallow as well as rare, so the top tier is a supply you spend rather than an advantage you bank (§8.1)',
  ],
  [],
  ['Stat feeds (GDD §8.2 / D4 — four stats × three tiers, plus kibble as the staple)'],
  [
    'Feed price: base crate (Rough trap feed)',
    120,
    'Every feed is this × its stat multiplier × its tier multiplier. The cheapest crate in the game above kibble',
  ],
  [
    'Feed price: Speed multiplier',
    1.58,
    'Priced by what the stat is worth in the race sim (§5.1): measured leverage 24.2 / 19.2 / 16.1 / 15.3 for speed / stamina / accel / trap, normalised on trap',
  ],
  [
    'Feed price: Stamina multiplier',
    1.25,
    'Stamina reads a flat 19.0% on a sprint and 19.2% on a stayer — it is the second most valuable stat at every distance, and NOT a distance play (§5.1)',
  ],
  ['Feed price: Accel multiplier', 1.05, 'Peaks on the 350 m sprints but averages third'],
  ['Feed price: Trap multiplier', 1, 'The cheap one, as §8.2 asks'],
  [
    'Feed price: Rough tier multiplier',
    1,
    'Per stat point, the tiers get DEARER as they climb: Rough buys points cheaply, Prime buys them fast',
  ],
  ['Feed price: Proper tier multiplier', 2.2],
  [
    'Feed price: Prime tier multiplier',
    5,
    '§8.2: Rough feed should be obviously worth eating and Prime feed a genuine agony',
  ],
  ['Feed gain: Rough, minimum stat points', 1],
  ['Feed gain: Rough, maximum stat points', 3],
  ['Feed gain: Proper, minimum stat points', 2],
  ['Feed gain: Proper, maximum stat points', 4],
  ['Feed gain: Prime, minimum stat points', 4],
  [
    'Feed gain: Prime, maximum stat points',
    6,
    'GDD §8.2. One crate is consumed per dog per Train week, which is what makes Prime food a consumable rather than an upgrade',
  ],
  [
    'Feed bias: a feed-poor planet',
    0.25,
    'Rustgut rarely has anything above Rough (§8.1). Multiplies the Proper and Prime stock chances',
  ],
  ['Feed bias: a feed-rich planet', 3, 'Vatgrown is where the good stuff is'],
  [],
  ['Staff (GDD §8.3 / D7 — three slots, any mix, no stacking penalty; price is the gate)'],
  ['Staff slots', 3, 'Fill them with any combination, including three of one role (D7)'],
  ['Staff wage per week: Rough', 250, 'GDD §7.2'],
  ['Staff wage per week: Proper', 600],
  [
    'Staff wage per week: Prime',
    1400,
    'Three Prime staff is 4,200 a week and 54,600 a season against a careless stable’s ~43,600 of prize money — §7.5’s route to bankruptcy, and the D6 acceptance row',
  ],
  ['Staff appearance chance per role', 0.45, 'Whether a role turns up on a planet at all'],
  ['Trainer: stat points a Train week, Rough', 1],
  ['Trainer: stat points a Train week, Proper', 2],
  ['Trainer: stat points a Train week, Prime', 4, 'GDD §8.3. Landing on the stat the dog is on'],
  ['Vet: injury weeks removed, Rough', 1, 'The cheap vet shortens a layoff and nothing else'],
  ['Vet: rest bonus, Proper', 5, 'On top of the 30 a rest week already returns'],
  ['Vet: rest bonus, Prime', 10],
  ['Vet: injury chance cut, Prime', 0.25, 'A quarter fewer injuries in the first place'],
  ['Scout: extra market dogs, Rough', 1, 'Dogs only your stable can see and buy'],
  ['Scout: extra market dogs, Proper', 2],
  ['Scout: extra market dogs, Prime', 3],
  [
    'Scout: the under-book dog, fraction of value',
    0.75,
    'Proper and Prime each turn up one dog priced under book — which is only an offer you can see because the Market prints the book (§7.3)',
  ],
  ['Trader: extra hold, Rough', 10],
  ['Trader: extra hold, Proper', 20],
  ['Trader: extra hold, Prime', 30],
  [
    'Trader: consigned crates, Proper',
    10,
    'A Proper trader has Proper goods put aside for you on every planet; Prime has Prime. Yours alone, at the shelf price',
  ],
  ['Trader: consigned crates, Prime', 8],
  ['Trader: buy-price discount, Prime', 0.05],
  [],
  ['The trader’s road (GDD §9.2 / §20 Q6 — making a hold worth buying)'],
  [
    'Ship fuel per cargo unit over the free allowance',
    2,
    'GDD §9.2 names 5 → 2 as the lever. At 5 a +20 hold returned about 1,000 a season against 2,500 paid and never repaid itself',
  ],
  ['Ship fuel: crates carried free', 20],
  [
    'Cargo hold upgrade price',
    1800,
    'The other half of Q6. Down from 2,500: the payback row asks that a +20 hold clears its own cost inside one season',
  ],
  [],
  ['The ship’s three tiers (GDD §8.1 — five engine tiers fold onto the one ladder)'],
  ['Ship engine: top tier', 3, 'Rough / Proper / Prime, as everything else'],
  ['Ship engine: starting tier', 1, 'You start at the bottom of the ladder with two steps to buy'],
  [
    'Ship engine: arrival roll per tier',
    15,
    'Was 10 across five tiers; three tiers over the same spread means each step is worth more',
  ],
  ['Ship engine upgrade price', 3200],
];

const wb = XLSX.read(readFileSync(path));
const ws = wb.Sheets['Assumptions'];
if (!ws) throw new Error('no Assumptions sheet');
const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: true });
const labels = new Set(grid.map((r) => String(r[0] ?? '')));

const added: string[] = [];
for (const row of ROWS) {
  const label = String(row[0] ?? '');
  if (label && labels.has(label)) {
    console.log(`skip (already there): ${label}`);
    continue;
  }
  grid.push(row as unknown[]);
  if (label) added.push(label);
}

wb.Sheets['Assumptions'] = XLSX.utils.aoa_to_sheet(grid as unknown[][]);
writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
console.log(`\nAdded ${added.length} rows to the Assumptions sheet.`);
