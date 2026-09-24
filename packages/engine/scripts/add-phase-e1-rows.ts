/**
 * Adds v3 Phase E1's tunables to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-e1-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-d2-rows.ts` (itself a copy of D1's, C2's, C's and B's upserter, which says why
 * this is TypeScript rather than openpyxl). It is an upserter and idempotent: a label that exists has
 * its value overwritten in place, a label that does not is appended under its section, and a label on
 * the REMOVE list is deleted.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * What is here: the game's length (GDD_V3 §2.1) — the seasons a table may choose, the two suggested
 * targets and how long a Target game may run — and the off-season (§2.2): a trainer's notice, and the
 * AI's retirement thresholds, which are rows because "content is data" names them.
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

// ---- GDD_V3 §2.1 — how long a game is. ----
const GAME_SECTION = 'The game (GDD_V3 §2.1 — 1 to 5 seasons, or Race to a Target)';
const ROWS: NewRow[] = [
  {
    section: GAME_SECTION,
    label: 'Game: fewest seasons a table may choose',
    value: 1,
    note: 'The default game is one season, and a setup that names no length means one season',
  },
  { section: GAME_SECTION, label: 'Game: most seasons a table may choose', value: 5 },
  {
    section: GAME_SECTION,
    label: 'Target: suggested net worth, a short game',
    value: 60000,
    note: 'Net worth is checked at the end of every weekend; the first crossing ends the game at the end of that weekend, and the highest net worth wins (§2.1)',
  },
  { section: GAME_SECTION, label: 'Target: suggested net worth, a long game', value: 150000 },
  {
    section: GAME_SECTION,
    label: 'Target: the most seasons a Target game runs',
    value: 10,
    note: 'A cap so a target nobody reaches still ends. If it bites, the highest net worth wins as usual',
  },
];

// ---- GDD_V3 §2.2 — between seasons. ----
const OFF_SECTION = 'The off-season (GDD_V3 §2.2 — age, one retirement, the staff notice)';
ROWS.push(
  {
    section: OFF_SECTION,
    label: 'Off-season: a trainer leaves, chance each',
    value: 0.15,
    note: "Rolled per trainer on the stable's own off-season stream. A stable left with fewer than two is offered one candidate",
  },
  {
    section: OFF_SECTION,
    label: "Off-season: the replacement's seller lies, × the dog-offer rate",
    value: 1,
    note: 'A retirement is offered a replacement under §9.2: age, one true stat, and patter that lies at this × 0.35',
  },
  {
    section: OFF_SECTION,
    label: 'Off-season: AI retires when the offer beats its cheapest dog by (Bones)',
    value: 500,
    note: "Normal's rule: the offer as it can read it (estimateOffer) against the cheapest dog's book value plus this. Hard uses half",
  },
  {
    section: OFF_SECTION,
    label: 'Off-season: AI retires a dog this old, whatever the offer',
    value: 6,
  },
);

const REMOVE: { label: string; why: string }[] = [
  {
    label: 'Local runner: a dog counts as fit at this fitness or above',
    why: "Jesse's call for Phase E1: no free local runner at all. D2 measured an injury nearly free because of it. ⚠️ `add-phase-d-rows.ts` still writes this row; re-running it would put it back",
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
