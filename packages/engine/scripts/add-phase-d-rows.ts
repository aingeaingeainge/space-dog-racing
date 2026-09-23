/**
 * Adds v3 Phase D1's tunables to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-d-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-c2-rows.ts` (itself a copy of Phase C's and Phase B's upserter, which says why
 * this is TypeScript rather than openpyxl). No formula cells and one cell style were re-checked before
 * it was first run. It is an upserter and idempotent: a label that exists has its value overwritten
 * in place, a label that does not is appended under its section.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * ⚠️ **What is here and what is not.** These are the *system's* numbers: how often a seller lies, how
 * big a race-day knock is, when a stable is short enough of dogs to be lent one. A card's own numbers
 * — what a drink costs the drunk navigator, what the sponsor pays — are part of the card row in
 * `content/events.ts`, as they have been since v3 Phase A made the navigator's price "a number about
 * this card rather than a global tunable". A card is content; content is data; the row is the data.
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

// ---- GDD_V3 §9.2, V4 — a dog offered in the Pound. ----
const OFFER_SECTION =
  'Dog offers (GDD_V3 §9.2 — age, one stat, and patter that is sometimes a lie)';
const ROWS: NewRow[] = [
  {
    section: OFFER_SECTION,
    label: 'Dog offer: the seller lies, chance',
    value: 0.35,
    note: "Before the card row's own multiplier: a monk never lies (×0), a man in a long coat usually does. A lie is a claimed stat that is really poor",
  },
  {
    section: OFFER_SECTION,
    label: 'Dog offer: rating, mean',
    value: 44,
    note: "Where an offered dog's stats centre. A dealt dog rates 50, so the average offer is a step down and the gamble is the spread and the patter. 50 at first; 44 in Phase D1, because at 50 the Pound alone lifted mean end worth about 2,000 and out of its 25-40k band",
  },
  {
    section: OFFER_SECTION,
    label: 'Dog offer: rating, sd',
    value: 7,
    note: "Spread of the offered dog's level, before its shape. Rating is never shown",
  },
  { section: OFFER_SECTION, label: 'Dog offer: youngest age', value: 1 },
  { section: OFFER_SECTION, label: 'Dog offer: oldest age', value: 6 },
  {
    section: OFFER_SECTION,
    label: 'Dog offer: the claimed stat, when honest (points above the level)',
    value: 10,
    note: "The seller talks up one stat you cannot see. Honest, it really is this far above the dog's level",
  },
  {
    section: OFFER_SECTION,
    label: 'Dog offer: the claimed stat, when lying (points below the level)',
    value: 12,
    note: 'Lying, the stat he talks up is this far below it',
  },
];

// ---- Phase D1 item 6 — race-day conditions: true information the book never prices. ----
const COND_SECTION =
  'Race-day conditions (Phase D1 — drawn on arrival, applied on race day, never priced by the book)';
ROWS.push(
  {
    section: COND_SECTION,
    label: 'Condition: a knock, chance per stable dog per weekend',
    value: 0.06,
    note: 'Drawn for every stable dog at arrival, one draw a dog whatever it lands on, so the stream never depends on the outcome',
  },
  {
    section: COND_SECTION,
    label: 'Condition: a knock, fitness on race day',
    value: -30,
    note: 'Applied to the runner, never to the stored fitness: every screen and the whole book go on reading the dog as it was',
  },
  {
    section: COND_SECTION,
    label: 'Condition: off its feed, chance per stable dog per weekend',
    value: 0.06,
  },
  { section: COND_SECTION, label: 'Condition: off its feed, fitness on race day', value: -15 },
  {
    section: COND_SECTION,
    label: 'Condition: buzzing, chance per stable dog per weekend',
    value: 0.08,
  },
  {
    section: COND_SECTION,
    label: 'Condition: buzzing, speed on race day (stat points)',
    value: 5,
    note: 'Like the lucky bone, but nobody knows unless tipped — the owner included',
  },
);

// ---- GDD_V3 §4.4 — the free local runner. ----
const LOAN_SECTION = 'The free local runner (GDD_V3 §4.4 — a stable short of fit dogs is lent one)';
ROWS.push({
  section: LOAN_SECTION,
  label: 'Local runner: a dog counts as fit at this fitness or above',
  value: 50,
  note: 'The injury-doubling line (§4.4). A stable with fewer than three uninjured dogs at or above it is lent a local for the Bronze Dash',
});

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
