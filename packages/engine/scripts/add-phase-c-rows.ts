/**
 * Adds v3 Phase C's tunables to design/space_dog_racing_economy.xlsx, and removes the ones Phase C
 * retires. Run with `npx tsx packages/engine/scripts/add-phase-c-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-b-rows.ts`, which says why this is TypeScript rather than openpyxl and which
 * two properties of the workbook make rewriting it safe (no formula cells, no cell styles). Both were
 * re-checked before this script was first run. It is an upserter and idempotent: a label that exists
 * has its value overwritten in place, a label that does not is appended under its section.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * ⚠️ **Phase C's rows arrive in the commit that reads them, not all at once.** The first run added
 * the style and contest rows, which nothing read yet, so it moved nothing; the equal-rating deal, the
 * absolute fade (A7) and the bookie's style term each added theirs in their own commit, because a
 * row that is read changes the game from the commit it lands in.
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

const STYLE_SECTION =
  'Running styles (GDD_V3 §5.1–5.2 — a redistribution of the same energy, not a bonus)';
const CONTEST_SECTION = 'The contest rule (GDD_V3 §5.3 — a kill switch, not a tuning target)';

/**
 * §5.1's three styles, one row each. **A style is data**: the pace-curve modifiers and whether it
 * contests the lead are cells, and nothing in the simulation branches on which style it is.
 */
const STYLES: {
  name: string;
  speed: number;
  fade: number;
  fadeMult: number;
  contests: number;
  note?: string;
}[] = [
  {
    name: 'Front-runner',
    speed: 1.08,
    fade: -0.06,
    fadeMult: 1,
    contests: 1,
    note: 'Bursts from the boxes, leads early, pays for it later. Leans on Acceleration',
  },
  {
    name: 'Stalker',
    speed: 1,
    fade: 0,
    fadeMult: 1,
    contests: 0,
    note: 'The baseline: even pace, sits handy, wins by being better. Leans on Speed',
  },
  {
    name: 'Closer',
    speed: 0.94,
    fade: 0.05,
    fadeMult: 1,
    contests: 0,
    note: 'Slow away, comes home hardest. Leans on Stamina',
  },
];

const ROWS: NewRow[] = [];
for (const st of STYLES) {
  ROWS.push(
    {
      section: STYLE_SECTION,
      label: `${st.name}: early top-speed multiplier`,
      value: st.speed,
      note: st.note,
    },
    {
      section: STYLE_SECTION,
      label: `${st.name}: fade start shift`,
      value: st.fade,
      note:
        st.name === 'Front-runner'
          ? 'In the same units as the fade point itself; negative is earlier'
          : undefined,
    },
    { section: STYLE_SECTION, label: `${st.name}: fade penalty multiplier`, value: st.fadeMult },
    {
      section: STYLE_SECTION,
      label: `${st.name}: contests the lead (1 = yes)`,
      value: st.contests,
      note:
        st.name === 'Front-runner'
          ? 'Which styles the contest rule of §5.3 reads. A flag on the row, so the rule never names a style'
          : undefined,
    },
  );
}
ROWS.push(
  {
    section: STYLE_SECTION,
    label: 'Style: the early part of the race (fraction of the trip)',
    value: 0.333,
    note: 'Where the early top-speed multiplier applies. The first third, the same window the contest rule reads',
  },
  {
    section: STYLE_SECTION,
    label: 'Style expression: minimum',
    value: 0.3,
    note: 'GDD_V3 §5.2, V13: one U(min, max) draw per runner per race, scaling how strongly its style applies that day. NOT a multiplier on speed — the area under the curve stays put and only its shape moves',
  },
  { section: STYLE_SECTION, label: 'Style expression: maximum', value: 1.3 },
  {
    section: CONTEST_SECTION,
    label: 'Contest: window (fraction of the trip)',
    value: 0.333,
    note: 'While a front-runner is inside the first third of the race',
  },
  {
    section: CONTEST_SECTION,
    label: 'Contest: distance at the head of the field (metres)',
    value: 2,
    note: '…and another dog is within this of it at the head of the field',
  },
  {
    section: CONTEST_SECTION,
    label: 'Contest: speed boost while contesting',
    value: 0.03,
    note: '…both get this much on current speed',
  },
  {
    section: CONTEST_SECTION,
    label: 'Contest: fade start cost for a whole first third contested',
    value: 0.05,
    note: '…and their fade point moves this much earlier, in proportion to the share of the window spent contesting. A cost larger than the boost is worth. If the closer’s gap against a front-runner-heavy field is under 4 points, the rule is cut, not tuned',
  },
);

// ---- The deal (GDD_V3 §5.5, V2) — Jesse's call before this phase: fix it here. ----
const DEAL_SECTION = 'The opening hand (GDD_V3 §5.5 — equal strength, different shapes)';
ROWS.push(
  {
    section: DEAL_SECTION,
    label: 'Starting dog rating (every dealt dog, exactly)',
    value: 50,
    note: 'V2’s promise, kept by the rating rather than by a stat total: with weights of 0.40 / 0.35 / 0.25, an equal total dealt dogs rated 44–55 (Phase B, correction 3)',
  },
  {
    section: DEAL_SECTION,
    label: 'Starting dog shape: widest deviation on speed or accel',
    value: 15,
    note: 'Speed and accel are each drawn within this of the rating, and stamina solves for it — so a dealt dog can be a speed dog, an accel dog or a stamina dog, and never a better one',
  },
);

const REMOVE: { label: string; why: string }[] = [
  {
    label: 'Starting dog stat budget (total across three stats)',
    why: 'Replaced by an exact starting rating (decision C1). An equal stat total is not an equal dog when the rating weights are unequal',
  },
  {
    label: 'Average starting dog rating',
    why: 'Nothing had read it since v3 Phase A dealt to a budget, and it said 43 against a deal that averaged 50. The exact rating above replaces it',
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
