/**
 * Adds v3 Phase C2's tunables to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-c2-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-c-rows.ts` (itself a copy of Phase B's upserter, which says why this is
 * TypeScript rather than openpyxl). The two properties that make rewriting the workbook safe — no
 * formula cells, no cell styles — were re-checked before this script was first run: no `<f>` element
 * in any sheet, one `<xf>` in styles.xml. It is an upserter and idempotent: a label that exists has its
 * value overwritten in place, a label that does not is appended under its section.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * ⚠️ **Phase C2's rows arrive in the order the prompt lands its commits.** The hot pace's rows came
 * first, read by nothing; each later commit that reads a row changes its value here, in that commit.
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

// ---- GDD_V3 §5.3, V14, §14 Q10 — the hot pace, replacing the contest rule cut at v3c (C3). ----
const HOT_SECTION =
  'The hot pace (GDD_V3 §5.3 — two front-runners at the head light it; the lead group pays)';
const ROWS: NewRow[] = [
  {
    section: HOT_SECTION,
    label: 'Hot pace: window (fraction of the trip)',
    value: 0.333,
    note: 'The pace can only be hot while the leader is inside this much of the trip. The first third, as for the style curve',
  },
  {
    section: HOT_SECTION,
    label: 'Hot pace: front-runners within this of each other at the head (metres)',
    value: 4,
    note: 'Two or more runners whose style lights the pace, both this close to the leader (so to each other), make the pace hot. One alone never does',
  },
  {
    section: HOT_SECTION,
    label: 'Hot pace: the lead group, within this of the leader (metres)',
    value: 6,
    note: 'While the pace is hot, every runner this close to the leader pays — front-runners and the stalkers sitting on them alike. A dog further back pays nothing',
  },
  {
    section: HOT_SECTION,
    label: 'Hot pace: fade point cost for a whole window in a hot lead group (metres)',
    value: 90,
    note: 'Pro rata to the ground a dog covers in the lead group while the pace is hot. Metres, like the fade point itself (A7)',
  },
  {
    section: HOT_SECTION,
    label: 'Front-runner: lights the pace (1 = yes)',
    value: 1,
    note: 'A style is a row: the rule counts runners whose style says 1 here, and never asks a style its name',
  },
  { section: HOT_SECTION, label: 'Stalker: lights the pace (1 = yes)', value: 0 },
  { section: HOT_SECTION, label: 'Closer: lights the pace (1 = yes)', value: 0 },
];

// ---- Decision C13: the style curve re-balanced under the hot pace (Jesse's call, option A). ----
// With the hot pace on, most fields (79% of real races have 2+ front-runners) burn their leaders, so a
// front-runner lost ~3 points across the calendar. Its own fade is eased and the closer's late edge
// trimmed until the calendar is even again; the curve's shape — burst and fade, slow away and home
// late — is unchanged. Sections are Phase C's, so these rows update in place.
const STYLE_SECTION =
  'Running styles (GDD_V3 §5.1–5.2 — a redistribution of the same energy, not a bonus)';
ROWS.push(
  {
    section: STYLE_SECTION,
    label: 'Front-runner: fade start shift',
    value: -0.05,
    note: 'In the same units as the fade point itself; negative is earlier. −0.07 at v3c; eased at v3c2 (C13) because the hot pace now burns front-runners that go together',
  },
  {
    section: STYLE_SECTION,
    label: 'Closer: fade start shift',
    value: 0.035,
    note: '+0.06 at v3c; trimmed at v3c2 to +0.04 (C13) because the hot pace now hands the closer the wins crowded front-runners lose, and to +0.035 (C14) because the run-in favours whoever is quickest over the last metres',
  },
);

// ---- GDD_V3 §14 Q11: closer finishes. The whole field tires into the line (decision C14). ----
const RUNIN_SECTION =
  'The run-in (GDD_V3 §7.2, §14 Q11 — the whole field tires into the line; nobody is pulled back)';
ROWS.push(
  {
    section: RUNIN_SECTION,
    label: 'Race: the run-in, the last metres of every trip (metres)',
    value: 15,
    note: 'Over these last metres every runner slows by the same fraction at the same point on the track, reaching the loss below at the line. Keyed to where a dog is, never to where the others are',
  },
  {
    section: RUNIN_SECTION,
    label: 'Race: speed lost at the line in the run-in',
    value: 0.5,
    note: 'What the fade in fractions (v3b) did to the whole field before A7 made the fade metres: a time gap stays a time gap, and the metres it shows at the line shrink with the speed',
  },
);

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
