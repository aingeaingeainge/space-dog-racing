/**
 * One-shot: add v2 Phase E's tunables to the Assumptions sheet of
 * design/space_dog_racing_economy.xlsx.
 *
 * The spreadsheet is the design instrument and `balance.json` is generated from it — the JSON is
 * never hand-edited (CLAUDE.md). Phase E adds exactly one new thing to the world: the Fixer's
 * **price list**, which is what replaced his weekly wage when D42's arithmetic said a percentage
 * edge on a racing stable's working capital cannot carry one. Three multipliers and an appearance
 * chance, and that is the whole of it — the rest of the phase is agents, measures, screens and
 * prose.
 *
 * ⚠️ **Upserts, like Phase D's.** These numbers are swept in this session and the sheet has to be
 * able to take the answer back.
 *
 * Run with `npx tsx packages/engine/scripts/add-phase-e-rows.ts [--set]`, then `npm run balance`.
 * Kept in the repo as the record of which rows were added and what each note says.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, '../../../design/space_dog_racing_economy.xlsx');

type Row = (string | number)[];

const ROWS: Row[] = [
  [],
  ['The Fixer’s price list (GDD §13 / E-D45 — hired by the job, never by the week)'],
  [
    'Fixing: job price multiplier, Rough fixer',
    1,
    '⚠️ The Fixer left the staff ladder in Phase E and these three rows are what replaced his wage. D42 measured §13 as a 3,498-Bone net loss with every knob inside it already swept: the edge is a percentage of a stake a stable can only take to about 3,000, so a fix grosses ~840 against 250–1,400 a WEEK for a man used twice a season. A price list is charged only when the road is walked',
  ],
  [
    'Fixing: job price multiplier, Proper fixer',
    1.5,
    'Derived rather than guessed, from the same break-even the deterrent was sized against: a fix clears S·(edge − fineStakeMult·catch) − fee − fineBase·catch, so at the measured 27% edge a Proper man’s fee has to leave the job worth placing at the stake a borrowed bankroll reaches (the 8,000 flat ceiling) and NOT at the three thousand a racing stable carries spare. That is §2.1’s “in bursts, at the biggest races”, which is the shape a wage cannot make because a wage is charged in the quiet weeks too',
  ],
  [
    'Fixing: job price multiplier, Prime fixer',
    2,
    'Chosen so the three grades break even at roughly the same stake (5,390 / 5,060 / 4,810 at a 27% edge), which makes the grade a choice about VARIANCE rather than a ladder of whether the road pays at all. The careful man is dearer per job and slightly better per Bone; what he really buys is a smaller chance of the season ban, which is the half of the deterrent that grows with use',
  ],
  [
    'Fixing: chance a fixer is drinking here at all, per planet-week',
    0.45,
    '⚠️ Was the shared staffAppearChance while he was a hire, and it has to be its own row now because it means something different. A HIRE persisted: a crook that signed one in week 3 had him in every week after, so a 45% appearance chance bought a working fixer in 67% of weeks (D41). A JOB does not persist, so this number now IS how often the road can be walked. Lagrange Lows still guarantees one, because its row has said “Fixer for hire” since M0',
  ],
];

function main(): void {
  const set = process.argv.includes('--set');
  const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellStyles: true });
  const sheet = wb.Sheets['Assumptions'];
  if (!sheet) throw new Error('no Assumptions sheet');
  const grid = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, blankrows: true, raw: true });
  const labelAt = new Map<string, number>();
  grid.forEach((r, i) => {
    const label = typeof r[0] === 'string' ? r[0].trim() : '';
    if (label) labelAt.set(label, i);
  });

  let added = 0;
  let updated = 0;
  for (const row of ROWS) {
    const label = typeof row[0] === 'string' ? row[0].trim() : '';
    if (!label) {
      grid.push([]);
      continue;
    }
    const at = labelAt.get(label);
    if (at === undefined) {
      grid.push(row);
      labelAt.set(label, grid.length - 1);
      added++;
    } else if (set && row.length > 1) {
      grid[at] = row;
      updated++;
    }
  }

  wb.Sheets['Assumptions'] = XLSX.utils.aoa_to_sheet(grid);
  writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log(`Assumptions: ${added} rows added, ${updated} updated. Now run npm run balance.`);
}

main();
