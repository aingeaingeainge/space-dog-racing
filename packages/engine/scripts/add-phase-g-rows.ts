/**
 * Adds v3 Phase G's tunable to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-g-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-e2-rows.ts` (itself a copy of E1's, D2's, D1's, C2's, C's and B's upserter,
 * which says why this is TypeScript rather than openpyxl). It is an upserter and idempotent: a label
 * that exists has its value overwritten in place, a label that does not is appended under its
 * section, and a label on the REMOVE list is deleted.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * What is here: one row, Jesse's call for Phase G — **a flat ceiling on a stable's stake on one race**
 * (GDD_V3 §7.4, V21). The stake is capped at the lesser of `maxStakeFraction` of cash and this number;
 * Neon Snout's planet row doubles it. The number is the one Jesse picked from the Phase G sweep.
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

// ---- GDD_V3 §7.4 — betting. ----
const BET_SECTION = 'Betting';
const ROWS: NewRow[] = [
  {
    section: BET_SECTION,
    label: 'Max stake per race (flat ceiling, Bones)',
    value: 1000,
    note: "Jesse's call for Phase G: a stable's stake on one race is the lesser of the % of cash above and this. Neon Snout doubles it. Chosen from a sweep of none / 1,000 / 1,500 / 2,000 / 3,000 / 5,000 after a two-season game was won at the bookie",
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
