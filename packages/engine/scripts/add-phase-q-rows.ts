/**
 * Adds v3 Phase Q's rows to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-q-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-n-rows.ts` (and so of every phase's upserter before it). It is an upserter and
 * idempotent: a label that exists has its value overwritten in place, a label that does not is appended
 * under its section, and a label on the REMOVE list is deleted.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * What is here: **Phase Q's rule changes**, each made unattended on Claude's judgement and each a Q row
 * in GDD_V3 §13 for Jesse to keep or revert. Every row is a dial a sweep turned with `--set`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const xlsxPath = resolve(here, '../../../design/space_dog_racing_economy.xlsx');

type Cell = string | number | null;
type Row = Cell[];

interface NewRow {
  /** Column A of the section header this row lives under. Created at the end if absent. */
  section: string;
  label: string;
  value: string | number;
  note?: string;
}

const Q_SECTION = "Phase Q (v3q) — Claude's unattended changes, each a Q row in GDD_V3 §13";
const ROWS: NewRow[] = [
  {
    section: Q_SECTION,
    label: 'Book: rating points a fitness point is worth, against a local at 75',
    value: 0.2,
    note: "Q1 (GDD_V3 §5.6, §14 Q9): the book prices a stable runner's fitness, rounded to whole rating points; locals are always priced at 75. At 0 (v3p) a 1-Bone win bet on a stable runner at fitness 100 returned +92%, at 80–89 +22%, under 60 −33%; at 0.1 +35% / +9% / −22%; at 0.2 +8% / +3% / −7%; at 0.3 −15% / −3% / +16%",
  },
  {
    section: Q_SECTION,
    label: 'Draft: round 3 runs the way round 2 did (1 yes, 0 a plain snake)',
    value: 1,
    note: "Q2 (GDD_V3 §5.5, V29): the third-round reversal. Win rate by draft position, widest gap from fair at 3 / 6 / 8 stables, all Normal, one season: plain snake 4.4 / 5.2 / 4.7 points (1,000 games); round 3 reversed 1.0 / 2.0 / 3.1 (1,000) and 2.3 / 1.1 / 2.7 (2,000) against ±3. Jesse's 45–55 board is untouched",
  },
];

const REMOVE: { label: string; why: string }[] = [];

// ---------------------------------------------------------------------------

const wb = XLSX.read(readFileSync(xlsxPath), { cellStyles: false });
const sheet = wb.Sheets['Assumptions'];
if (!sheet) throw new Error('No "Assumptions" sheet in ' + xlsxPath);
const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, blankrows: true });

const labelAt = (r: Row): string => (typeof r?.[0] === 'string' ? r[0].trim() : '');
const indexOfLabel = (label: string) => rows.findIndex((r) => labelAt(r) === label);

let removed = 0;
for (const { label } of REMOVE) {
  const at = indexOfLabel(label);
  if (at >= 0) {
    rows.splice(at, 1);
    removed++;
  }
}

let updated = 0;
let added = 0;
for (const row of ROWS) {
  const at = indexOfLabel(row.label);
  const cells: Row = [row.label, row.value, row.note ?? null];
  if (at >= 0) {
    // Keep a note already in the sheet if this row does not carry one of its own.
    if (row.note === undefined) cells[2] = rows[at]?.[2] ?? null;
    rows[at] = cells;
    updated++;
    continue;
  }
  let head = indexOfLabel(row.section);
  if (head < 0) {
    rows.push([], [row.section]);
    head = rows.length - 1;
  }
  // Append at the end of the section: the run of rows after the header that carry a value in B.
  let at2 = head + 1;
  while (at2 < rows.length && rows[at2]?.[1] !== undefined && rows[at2]?.[1] !== null) at2++;
  rows.splice(at2, 0, cells);
  added++;
}

const out = XLSX.utils.aoa_to_sheet(rows);
wb.Sheets['Assumptions'] = out;
writeFileSync(xlsxPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
console.log(
  `Assumptions: ${added} rows added, ${updated} updated, ${removed} removed → ${rows.length} rows`,
);
