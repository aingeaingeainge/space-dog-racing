/**
 * Adds v3 Phase B's tunables to design/space_dog_racing_economy.xlsx, and removes the ones Phase B
 * retires. Run with `npx tsx packages/engine/scripts/add-phase-b-rows.ts`, then `npm run balance`.
 *
 * **Why this exists, and why it is TypeScript.** v3 Phase A pruned 81 rows with openpyxl and then
 * deleted the three v2 row-writing scripts, because any of them re-run would have put the pruned
 * tunables back. That left the repo with no way to add a row, and Phase B adds forty-odd. This is
 * the replacement, written against `xlsx`, which the engine already depends on for
 * `balance-from-xlsx.ts` — so the sheet is written and read by the same library.
 *
 * **It is an upserter, and it is idempotent.** A label that already exists has its value and note
 * overwritten in place; a label that does not is appended under its section, with the section
 * header added if it is not there yet. Running it twice produces the same workbook.
 *
 * ⚠️ **Two facts about this workbook that make rewriting it safe**, both verified rather than
 * assumed (Phase A checked the first, this script's author checked the second):
 *
 * 1. **There are no formula cells in any of the eight sheets** — no `<f>` element anywhere — so a
 *    row that moves cannot break a reference.
 * 2. **There are no cell styles**: `xl/styles.xml` carries exactly one `cellXf`, the default. So a
 *    SheetJS round-trip, which does not preserve styling, has nothing to lose. The header's "edit
 *    blue cells" is aspirational; nothing in the workbook is blue.
 *
 * If either stops being true, this script needs to change before it is run again.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by their human-readable label.** A renamed label reads
 * the wrong cell silently, where a deleted one fails loudly. So the labels below and the `LABELS`
 * map in that file are a pair and must be edited together.
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

/**
 * The six goods of GDD_V3 §6.1, on Gazillionaire's bands: every one is exactly 8× floor to
 * ceiling, and the across-good ladder at the floor is 1 / 2 / 3 / 6 / 7.5 / 9. Do not round these
 * into tidier numbers — the near-equality of the two spreads is what makes a cash-bound stable and
 * a hold-bound stable play different games (§6.1).
 */
const GOODS_SECTION = 'The six goods (GDD_V3 §6.1 — every band is exactly 8× floor to ceiling)';
const FEED_SECTION = 'Food as training (GDD_V3 §6.3 — what one week of each food does)';
const RUNNING_SECTION = 'Food as the running cost (GDD_V3 §6.3, V10 — the only one there is)';
const PRICE_SECTION = 'The price distribution (GDD_V3 §6.4 — the row that protects the game)';

const GOODS: { key: string; name: string; lo: number; hi: number; min: number; max: number }[] = [
  { key: 'GreyMash', name: 'Grey Mash', lo: 10, hi: 80, min: 40, max: 60 },
  { key: 'Scrapmeat', name: 'Scrapmeat', lo: 20, hi: 160, min: 30, max: 45 },
  { key: 'GlowTripe', name: 'Glow Tripe', lo: 30, hi: 240, min: 20, max: 30 },
  { key: 'VatSteak', name: 'Vat Steak', lo: 60, hi: 480, min: 10, max: 18 },
  { key: 'PulsarMarrow', name: 'Pulsar Marrow', lo: 75, hi: 600, min: 6, max: 12 },
  { key: 'Ambrosia', name: 'Ambrosia', lo: 90, hi: 720, min: 3, max: 8 },
];

const ROWS: NewRow[] = [
  // ---- Item 5, the empty-hold penalty. This is the whole of v3's running cost (V10). ----
  {
    section: RUNNING_SECTION,
    label: 'Empty hold: fitness a dog loses when it does not eat',
    value: 10,
    note: 'GDD_V3 §6.3. There is no upkeep, no wages, no fuel and no debt, so this one rule is the only thing keeping money scarce. It replaces v2’s cash penalty rather than joining it',
  },
];

// ---- Item 1: a band and a shelf per good. ----
for (const g of GOODS) {
  ROWS.push(
    {
      section: GOODS_SECTION,
      label: `${g.name}: price floor`,
      value: g.lo,
      note: g.key === 'GreyMash' ? 'The ladder at the floor is 1 / 2 / 3 / 6 / 7.5 / 9' : undefined,
    },
    { section: GOODS_SECTION, label: `${g.name}: price ceiling`, value: g.hi },
    { section: GOODS_SECTION, label: `${g.name}: shelf depth, minimum`, value: g.min },
    {
      section: GOODS_SECTION,
      label: `${g.name}: shelf depth, maximum`,
      value: g.max,
      note:
        g.key === 'Ambrosia'
          ? 'V7: the scarcity rule. ~8 units a planet, so the big trade has to be assembled over several weeks under a fog'
          : undefined,
    },
  );
}

// ---- Item 4: the feeding table of §6.3. ----
const FEEDS: { name: string; min: number; max: number; fit?: number; note?: string }[] = [
  {
    name: 'Grey Mash',
    min: 1,
    max: 1,
    note: 'Lands on a random stat — the floor of improvement a stable that spends nothing still gets',
  },
  { name: 'Scrapmeat', min: 1, max: 2, note: 'Stamina' },
  { name: 'Glow Tripe', min: 1, max: 3, note: 'Acceleration' },
  { name: 'Vat Steak', min: 2, max: 4, note: 'Speed' },
  { name: 'Pulsar Marrow', min: 2, max: 4, fit: 5, note: 'Random stat, and it touches condition' },
  {
    name: 'Ambrosia',
    min: 3,
    max: 6,
    fit: 8,
    note: 'Random stat, condition, and injury chance halved this week',
  },
];
for (const f of FEEDS) {
  ROWS.push(
    { section: FEED_SECTION, label: `${f.name}: stat points a week, minimum`, value: f.min },
    {
      section: FEED_SECTION,
      label: `${f.name}: stat points a week, maximum`,
      value: f.max,
      note: f.note,
    },
  );
  if (f.fit !== undefined)
    ROWS.push({ section: FEED_SECTION, label: `${f.name}: fitness a week`, value: f.fit });
}
ROWS.push({
  section: FEED_SECTION,
  label: 'Ambrosia: injury chance multiplier for the week',
  value: 0.5,
  note: 'GDD_V3 §6.3 — halved',
});

// ---- Item 2: the shape of the price draw. ----
ROWS.push(
  {
    section: PRICE_SECTION,
    label: 'Price draw: standard deviation as a fraction of the band',
    value: 0.16,
    note: 'GDD_V3 §6.4: prices cluster mid-band with RARE excursions to the ends, so the 8× is something a player hunts rather than something that happens to them. At 0.16 a draw reaches the outer twentieth of the band about 0.2% of the time at either end',
  },
  {
    section: PRICE_SECTION,
    label: 'Price draw: clamp, closest a draw may come to either end of the band',
    value: 0.02,
    note: 'As a fraction of the band. A normal deviate is unbounded; the band is not, and §6.1’s 8× is a hard global range',
  },
  {
    section: PRICE_SECTION,
    label: 'Planet band bias: floor',
    value: 0.45,
    note: 'A planet’s per-good multiplier over the mid-band centre (GDD_V3 §12). Clamped to this range so every planet can still throw an excursion to either end',
  },
  { section: PRICE_SECTION, label: 'Planet band bias: ceiling', value: 1.55 },
);

// ---- Item 3: the hold, for everybody, forever. ----
//
// ⚠️ `Hold capacity (units, everyone, forever)` is **not** in this list, and that is deliberate. It
// already exists at 20, so raising it here would change the economy from a pass that is otherwise
// pure data — a snapshot move in a commit whose message does not claim one. It is flipped to 50 in
// the commit that spends it, where the six goods and the shelf depth already exist to spend it on.

/**
 * Labels to delete outright, with the reason. A row removed here must also leave `LABELS` in
 * `balance-from-xlsx.ts`, or the read fails loudly on the next `npm run balance` — which is the
 * good failure mode and the reason the two files are edited together.
 *
 * ⚠️ **A row leaves only in the commit where the last code that reads it leaves.** `balance.json`
 * is typed, so pruning a key the engine still reads is a compile error rather than a silent zero —
 * which is the right failure, and the reason this list grew across the phase rather than arriving
 * whole. The six goods took the kibble rows and the AI's reserve figure with them.
 */
const REMOVE: { label: string; why: string }[] = [
  {
    label: 'Fitness: gain from a training week',
    why: 'There is no Train state (GDD_V3 V8, cut in Phase A). Nothing in the engine read it; one display helper still computed a "training" outlook nobody rendered',
  },
  {
    label: 'Food price: cheapest planet',
    why: '`foodBand` is a per-planet multiplier over six global bands now (GDD_V3 §12), so there is no single absolute food price to have a cheapest of',
  },
  {
    label: 'Typical realised margin per unit',
    why: 'A planning figure for one good on one band. With six bands and a per-planet bias the harness measures the realised margin directly, per good',
  },
  // ---- left with the six goods ----
  {
    label: 'Food price: dearest planet',
    why: 'As above. The AI reserve that read it now prices two weeks of dinner off the staple’s own ceiling',
  },
  {
    label: 'Training: plain kibble, minimum stat points',
    why: 'Kibble is gone. Grey Mash is the floor now and carries its own row above',
  },
  { label: 'Training: plain kibble, maximum stat points', why: 'As above' },
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
