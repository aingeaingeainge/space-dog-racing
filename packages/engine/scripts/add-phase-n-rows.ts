/**
 * Adds v3 Phase N's rows to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-n-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-i-rows.ts` (itself a copy of G's, E2's, E1's, D2's, D1's, C2's, C's and B's
 * upserter, which says why this is TypeScript rather than openpyxl). It is an upserter and idempotent:
 * a label that exists has its value overwritten in place, a label that does not is appended under its
 * section, and a label on the REMOVE list is deleted.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * What is here: **the draft** (GDD_V3 §2.2, §5.5, V29–V33, Jesse's call for Phase N). A game opens on
 * a six-round snake draft of four dogs and two trainers from a public board, and each off-season is one
 * round of the same draft in reverse order of the standings.
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

// ---- GDD_V3 §2.2, §5.5, §8.1 — the draft (V29–V33). ----
const DRAFT_SECTION =
  'The draft (GDD_V3 §2.2, §5.5 — four dogs and two trainers, picked from a board; V29–V33)';
const ROWS: NewRow[] = [
  {
    section: DRAFT_SECTION,
    label: 'Draft: dogs on the opening board, per stable',
    value: 5,
    note: 'V29/V31: the opening board carries this many dogs for every stable at the table; each stable drafts four, so a fifth of the board is left over',
  },
  {
    section: DRAFT_SECTION,
    label: 'Draft: trainers on the opening board, per stable',
    value: 3,
    note: 'V29: each stable drafts two; capped by the pool of 24, so eight stables see every trainer',
  },
  {
    section: DRAFT_SECTION,
    label: 'Draft: the weakest dog on a board (rating)',
    value: 40,
    note: 'V31: a board is rated evenly from this to the strongest, each style spanning the range, so a pick matters and the snake order keeps it fair',
  },
  {
    section: DRAFT_SECTION,
    label: 'Draft: the strongest dog on a board (rating)',
    value: 60,
  },
  {
    section: DRAFT_SECTION,
    label: 'Draft: dogs on the off-season board, per stable (rounded up)',
    value: 1.5,
    note: 'V32: one round, last on the standings picks first, from a fresh board of this many dogs a stable plus every unemployed trainer, up to one a stable',
  },
  {
    section: DRAFT_SECTION,
    label: 'Draft: AI takes an off-season pick when it beats what it lets go by (Bones)',
    value: 500,
    note: 'V32: otherwise it passes. Scored as book value plus expected season purses by rating (the harness fit)',
  },
];

// ---- Starting position (GDD_V3 §5.5, V33) — four dogs, and the food to feed them. ----
const START_SECTION = 'Starting position';
ROWS.push(
  {
    section: START_SECTION,
    label: 'Starting dogs',
    value: 4,
    note: 'V33: four dogs, not three — drafted, not dealt (V29). The Pound swaps one for one, so the kennel stays at four',
  },
  {
    section: START_SECTION,
    label: 'Starting crates of the staple aboard',
    value: 7,
    note: 'V33: four dogs eat four crates a week, so a stable starts with the same weeks of food as three dogs had on five (was in balance.extras.json)',
  },
);

const REMOVE: { label: string; why: string }[] = [
  { label: 'Dogs dealt at the start', why: 'V29: nothing is dealt; the draft picks `startDogs`' },
  {
    label: "Off-season: the draft, last stable's offer level above the ordinary (points)",
    why: "V32 replaced V23's breeder's pick with the off-season draft",
  },
  {
    label: "Off-season: the replacement's seller lies, × the dog-offer rate",
    why: 'V32: there is no retirement offer; the board shows every dog',
  },
  {
    label: 'Off-season: AI retires when the offer beats its cheapest dog by (Bones)',
    why: 'V32: replaced by the AI draft margin',
  },
  {
    label: 'Off-season: AI retires a dog this old, whatever the offer',
    why: 'V32: the AI draft scores every dog, age included',
  },
];

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
