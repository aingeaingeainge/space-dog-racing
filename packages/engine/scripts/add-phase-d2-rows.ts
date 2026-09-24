/**
 * Adds v3 Phase D2's tunables to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-d2-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-d-rows.ts` (itself a copy of Phase C2's, C's and B's upserter, which says why
 * this is TypeScript rather than openpyxl). It is an upserter and idempotent: a label that exists has
 * its value overwritten in place, a label that does not is appended under its section.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * ⚠️ **What is here and what is not**, as in D1: the *system's* numbers — what each trainer bonus
 * costs in commission and how big it is, what a nobble does to a runner, how likely the stewards are
 * to catch it and what they fine. A card's own price — what the man with the syringe charges, what
 * the steward wants for a box — stays on the card row in `content/deck/*.ts`.
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

// ---- GDD_V3 §8 — two trainers on commission. ----
const STAFF_SECTION = 'Staff (GDD_V3 §8 — two trainers, paid a cut of race prize money only)';
const ROWS: NewRow[] = [
  {
    section: STAFF_SECTION,
    label: 'Staff: trainers dealt to each stable at the start of a game',
    value: 2,
    note: 'Two slots, everyone a trainer (§8.1). Dealt at createSeason from the staff rows; the only way to change one in Phase D is a Bar card',
  },
  {
    section: STAFF_SECTION,
    label: 'Staff cut: +1 stat a week',
    value: 0.03,
    note: 'Commission, a share of race prize money only (§8.1). A trainer with one bonus takes its cut; with two, the sum plus the premium below, capped',
  },
  {
    section: STAFF_SECTION,
    label: 'Staff cut: +5 fitness recovery a week',
    value: 0.05,
    note: '3% at first. Measured at 800 seasons by regressing end worth on the dealt bonuses (the deal is random, so it is a clean experiment): a +5-recovery trainer was worth ~1,300 to its stable at 3%. 5% leaves it worth having',
  },
  { section: STAFF_SECTION, label: 'Staff cut: injury chance halved', value: 0.04 },
  { section: STAFF_SECTION, label: 'Staff cut: injury duration −1 week', value: 0.02 },
  { section: STAFF_SECTION, label: "Staff cut: reveals a rival dog's style a week", value: 0.02 },
  {
    section: STAFF_SECTION,
    label: "Staff cut: next planet's band position for all six goods",
    value: 0.08,
    note: "3% at first, and it was the cheapest bonus in the pool for what it did: knowing all six of next week's prices every week lifted food's share of gross income four points and was worth ~1,000 to its stable. At 8% the regression reads it at nothing either way — the same 8% trainer is cheap for a trader and dear for a racer (§8.1)",
  },
  {
    section: STAFF_SECTION,
    label: 'Staff cut: +10% prize money',
    value: 0.06,
    note: '5% at first; 6% after the 800-season regression',
  },
  { section: STAFF_SECTION, label: 'Staff cut: Explore less likely to go badly', value: 0.03 },
  {
    section: STAFF_SECTION,
    label: 'Staff cut: premium for a trainer with two bonuses',
    value: 0.02,
    note: '§8.2: "two of the above, 6–10%". The cheapest pair (2% + 2%) lands on 6%',
  },
  {
    section: STAFF_SECTION,
    label: 'Staff cut: the most a trainer takes',
    value: 0.1,
    note: '§8.1: 1–10%. A 10% trainer on a stable earning 30,000 in purses costs 3,000',
  },
  {
    section: STAFF_SECTION,
    label: 'Staff bonus: stat points a week, to one dog',
    value: 1,
    note: "§8.2's \"+1 to one stat per week\": at the jump, beside the food, on the lowest-rated dog's weakest stat by the rating's weights — a rule, not a draw. Built first as +1 to every dog, which made a 3% trainer worth ~4,000 of end worth and took mean end worth out of its band (decision D10)",
  },
  {
    section: STAFF_SECTION,
    label: 'Staff bonus: fitness a week, to a dog that did not run',
    value: 5,
    note: "Folded into weeklyFitnessDelta's bonus, so it goes through the week's one clamp",
  },
  { section: STAFF_SECTION, label: 'Staff bonus: injury chance ×', value: 0.5 },
  {
    section: STAFF_SECTION,
    label: 'Staff bonus: weeks off a layoff, at the roll',
    value: 1,
    note: 'Never below one week',
  },
  {
    section: STAFF_SECTION,
    label: 'Staff bonus: extra prize money, share of the purse',
    value: 0.1,
    note: 'Added before the commission is taken',
  },
  {
    section: STAFF_SECTION,
    label: "Staff bonus: an Explore card's bad-outcome chance ×",
    value: 0.5,
    note: "Read by every card through the kit's risk() and luck() helpers, never by a branch",
  },
];

// ---- GDD_V3 §9.3 — sabotage and the bought trap draw, through the Back Alley. ----
const SAB_SECTION =
  'Sabotage (GDD_V3 §9.3 — a nobble, a bought box, and the stewards who might notice)';
ROWS.push(
  {
    section: SAB_SECTION,
    label: "Sabotage: a nobbled runner's fitness on race day",
    value: -25,
    note: "Applied to the runner, like a race-day condition: the book has struck its prices and the victim's stated fitness never changes",
  },
  {
    section: SAB_SECTION,
    label: 'Sabotage: stewards catch a nobbler, chance (any planet without its own)',
    value: 0.35,
    note: 'Rolled on race day from one draw per stable, made every week whether or not anybody booked a job, so the game stream never depends on a door',
  },
  { section: SAB_SECTION, label: 'Sabotage: catch chance at Lagrange Lows', value: 0.2 },
  { section: SAB_SECTION, label: 'Sabotage: catch chance at Holy Bark', value: 0.6 },
  {
    section: SAB_SECTION,
    label: 'Sabotage: caught, a flat fine',
    value: 800,
    note: 'Paid as far as the cash goes: nobody is pushed into debt (V10)',
  },
  {
    section: SAB_SECTION,
    label: 'Sabotage: caught, share of what the nobbler had on the race',
    value: 0.25,
  },
);

const REMOVE: { label: string; why: string }[] = [
  {
    label: 'Staff bonus: stat points a week, to each dog',
    why: 'Renamed: the bonus works one dog a week, not every dog (decision D10)',
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
