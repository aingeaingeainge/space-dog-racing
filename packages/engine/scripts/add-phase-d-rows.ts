/**
 * One-shot: add v2 Phase D's tunables to the Assumptions sheet of
 * design/space_dog_racing_economy.xlsx.
 *
 * The spreadsheet is the design instrument and `balance.json` is generated from it — the JSON is
 * never hand-edited (CLAUDE.md). Phase D introduces the draw, §13's two shady acts and their
 * deterrent, the flat stake ceiling and the championship purse, and every one of them is a number
 * somebody will want to sweep, so they go in the sheet.
 *
 * ⚠️ **This one upserts rather than appends.** Phase C's `add-phase-c-rows.ts` skipped a label it
 * found, which was right for a set of numbers arrived at by argument; Phase D's deterrent was
 * arrived at by *sweep*, so the same script has to be able to write the answer back into the sheet
 * once the sweep has run. Pass `--set` to overwrite the values of rows that already exist; without
 * it, existing rows are left alone and only missing ones are added.
 *
 * Run with `npx tsx packages/engine/scripts/add-phase-d-rows.ts [--set]`, then `npm run balance`.
 * Kept in the repo as the record of which rows were added and what each note says.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, '../../../design/space_dog_racing_economy.xlsx');

type Row = (string | number)[];

/** Rows to write. A row with only a label is a section heading, matching the sheet's own style. */
const ROWS: Row[] = [
  [],
  ['The trap draw (GDD §6.2 / D37 — the rail is the short way round and where the traffic is)'],
  [
    'Trap draw: top-speed edge across the width of the boxes',
    0.018,
    'Trap 1 runs +half of this and the outside trap −half, scaled by how tight the bends are and zero on a track with none. Symmetric, so a full field gains nothing on average — the draw redistributes a race rather than adding speed to it',
  ],
  [
    'Trap draw: trap craft the rail costs, across the width of the boxes',
    20,
    'A dog on the rail has less room, so it needs the craft to hold its line when two meet on a bend. Pays for the shorter trip above, and is what makes which end of the draw a dog wants depend on the dog. Replaces an accidental array-index tie-break worth 9.1% against 17.3% between identical dogs',
  ],
  [],
  ['The crook’s road (GDD §13 / D8 — the section that had never existed in code)'],
  [
    'Steward bribe: fee',
    800,
    'Choose your own dog’s trap draw, placed before the draw is made. A Fixer of any tier can do it (§8.3)',
  ],
  [
    'Sabotage: fee',
    500,
    'Take fitness off one runner that is not yours, after the prices have gone up. Needs a Proper or Prime Fixer (§8.3)',
  ],
  [
    'Sabotage: fitness taken off the target for that race',
    25,
    'D8 measured this against −15 and −15 is not a strategy: at −15 the move is worth +163 against the fee, at −25 it is +288 of purse EV and the betting edge is what pays. Not re-derived in Phase D',
  ],
  [
    'Fixing: chance the stewards catch you',
    0.25,
    'GDD §13’s starting point. Per job, rolled on race day so it is rolled after the bets are struck — which is what lets the fine be sized against the bet',
  ],
  [
    'Fixing: catch chance multiplier, Rough fixer',
    1.5,
    '⚠️ The Fixer’s ladder is a ladder of THIS number rather than of what he will do. It started out as a ladder of abilities — a Rough man could buy a box and not get at a dog — and that starved the road: a Proper-or-better fixer turns up rarely enough that a crook had a working one in 30% of its weeks, first arriving in week 6.5. Any fixer does either job now; what you pay for is how well he covers his tracks (D41)',
  ],
  ['Fixing: catch chance multiplier, Proper fixer', 1],
  ['Fixing: catch chance multiplier, Prime fixer', 0.5],
  [
    'Fixing: fine, flat part',
    1200,
    'Charged on a catch, on top of the fee already paid and whatever the job was worth',
  ],
  [
    'Fixing: fine, multiple of what you had on that race',
    0.25,
    '⚠️ The whole deterrent design in one number. §8.4’s supplement forfeits the *purse*, so its punishment scales with the size of the race while its benefit is a fixed speed bump — backwards from tempting. §13’s edge is a percentage of the stake, so the fine is a multiple of the stake: it grows with what the crime was actually for. Must stay below (the betting edge ÷ the catch chance) or no stake is ever worth fixing',
  ],
  [],
  ['Betting (GDD §10 / §20 Q7 — the guard on the rich-get-richer channel)'],
  [
    'Max stake per race (flat ceiling)',
    8000,
    '⚠️ Applies alongside the 50%-of-cash fraction; the binding one is whichever is lower. §10: the crook’s edge is a percentage, so its cash value scales with what you can stake and the leader earns most from the identical fixer’s fee. The fraction alone cannot stop that. Collar Prime lifts it for the Grand Final, which is the one week the road is allowed to pay in a burst',
  ],
  [
    'Max stake per race (flat ceiling), Collar Prime multiple',
    3,
    'The Galactic Collar already lifts the fraction to 100% (§12). The crook’s road “pays in bursts, at the biggest races” (§2.1) and this is the burst — one week, at the end, where the season is decided anyway',
  ],
  [],
  ['The championship purse (GDD §4.3 / D3 — a purse, not a scoreboard)'],
  [
    'Championship points: 1st',
    10,
    'For the first four home in ANY race, so it rewards racing breadth — which is the trainer’s road only, and why the purse is deliberately modest',
  ],
  ['Championship points: 2nd', 6],
  ['Championship points: 3rd', 3],
  ['Championship points: 4th', 1],
  [
    'Championship purse: 1st on points',
    12000,
    'Paid once, at the Galactic Collar, as prize money. About 6% of a champion’s end worth — D3 keeps it small because net worth is the only condition under which all three roads compete',
  ],
  ['Championship purse: 2nd on points', 6000],
  ['Championship purse: 3rd on points', 3000],
];

const setMode = process.argv.includes('--set');

const wb = XLSX.read(readFileSync(path));
const ws = wb.Sheets['Assumptions'];
if (!ws) throw new Error('no Assumptions sheet');
const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: true });
const at = new Map<string, number>();
grid.forEach((r, i) => {
  const label = String(r[0] ?? '').trim();
  if (label) at.set(label, i);
});

const added: string[] = [];
const updated: string[] = [];
for (const row of ROWS) {
  const label = String(row[0] ?? '').trim();
  const existing = label ? at.get(label) : undefined;
  if (existing !== undefined) {
    if (!setMode || row.length < 2) {
      console.log(`skip (already there): ${label}`);
      continue;
    }
    const target = grid[existing]!;
    if (target[1] !== row[1]) {
      console.log(`set: ${label}  ${String(target[1])} -> ${String(row[1])}`);
      target[1] = row[1];
      updated.push(label);
    }
    continue;
  }
  grid.push(row as unknown[]);
  if (label) added.push(label);
}

wb.Sheets['Assumptions'] = XLSX.utils.aoa_to_sheet(grid as unknown[][]);
writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
console.log(`\nAdded ${added.length} rows, updated ${updated.length}. Now run: npm run balance`);
