/**
 * Adds v3 Phase T's rows to design/space_dog_racing_economy.xlsx. Run with
 * `npx tsx packages/engine/scripts/add-phase-t-rows.ts`, then `npm run balance`.
 *
 * A copy of `add-phase-q-rows.ts` (and so of every phase's upserter before it). It is an upserter and
 * idempotent: a label that exists has its value overwritten in place, a label that does not is appended
 * under its section, and a label on the REMOVE list is deleted.
 *
 * ⚠️ **`balance-from-xlsx.ts` matches rows by label**, so the labels here and its `LABELS` map are a
 * pair and are edited together.
 *
 * What is here: **Phase T, Jesse's two calls** (GDD_V3 T1–T4) — everybody plays the weekend at once, so
 * nothing in the sheet is turn order any more; and three staff, one of each role, each paid a cut of
 * their own side. The advisors' cuts are first estimates, measured in `claude/V3_PHASE_T_NOTES.md`.
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

const T_SECTION = 'Phase T (v3t) — the weekend at once, and three staff (GDD_V3 T1–T4)';
const ROWS: NewRow[] = [
  {
    section: T_SECTION,
    label: 'Market: a stable’s own shelf is this share of the posted depth (rounded up)',
    value: 0.2,
    note: 'T2: every stable has a shelf of its own now. The posted depths (the goods rows above) were a whole table’s shelf, shared in turn order; given whole to every stable they tripled the trade (food sold 10,399 → 34,737 gross a stable-season, cash-bound → hold-bound at week 1.9). Six Normal stables, 50 seasons: at 0.15 food sold 10,313, crossover week 5.1 (19% of stable-seasons cross); at 0.2 13,417, week 4.7 (45%); at 0.25 15,489; at 0.3 18,500. v3s: 10,399, week 4.6 (73%). 0.2 is the nearest to v3s on the crossover row, which is the progression §6.1 is about',
  },
  {
    section: T_SECTION,
    label: 'Trade Advisor bonus: every crate bought costs this share less',
    value: 0.05,
    note: 'T3 [estimate]. With the sell price raised by sellUp it must stay under foodSpread (0.10) or a crate bought and sold in one place would pay; the engine also holds a stable’s sell price under its buy price',
  },
  {
    section: T_SECTION,
    label: 'Trade Advisor bonus: every crate sold fetches this share more',
    value: 0.04,
    note: 'T3 [estimate]',
  },
  {
    section: T_SECTION,
    label: 'Trade Advisor bonus: the stable’s own shelf is this share deeper',
    value: 0.25,
    note: 'T3. Rounded up per good. Measured at 0.5 by harness --draft (17,000 stables): +1,941 (± 279) of end worth, a fair cut of 43% of trading profit; halved, and its cut raised',
  },
  {
    section: T_SECTION,
    label: 'Gambling Advisor bonus: a slip’s odds are this share better',
    value: 0.05,
    note: 'T3. At the 15% margin a blind slip returns 0.85 × 1.05 = 0.89 a Bone: still a loss without a read. At 0.08: +733 (± 358), a fair cut of 56% of winnings; cut back to 0.05',
  },
  {
    section: T_SECTION,
    label: 'Gambling Advisor bonus: the flat stake ceiling is this share higher',
    value: 0.5,
    note: 'T3 [estimate]. 1,000 → 1,500 a race (Neon Snout 3,000); the share-of-cash fraction is unchanged',
  },
  {
    section: T_SECTION,
    label: 'Trade Advisor cut: buys cheaper, share of trading profit',
    value: 0.2,
    note: 'T4. Trading profit is (sell − You Paid) × crates on every sale that makes one, about 4,800 a stable-season. harness --draft, 17,000 stables (1,000 one-season games at 3, 6 and 8 stables, all Normal), Bones of end worth per bonus held net of its cut: at 8% +741 (± 438), fair 22%; at 20% +229 (± 299), fair 25%; at 22% −179 (± 244) and +65 (± 241), fair 18–23%',
  },
  {
    section: T_SECTION,
    label: 'Trade Advisor cut: sells dearer, share of trading profit',
    value: 0.03,
    note: 'T4. harness --draft, 17,000 stables (1,000 one-season games at 3, 6 and 8 stables, all Normal), Bones of end worth per bonus held net of its cut: at 8% +62 (± 329), fair 9%; again at 8% −244 (± 391), fair 3%; at 5% −384 (± 290) and −126 (± 278), fair 2–3%',
  },
  {
    section: T_SECTION,
    label: 'Trade Advisor cut: a deeper shelf, share of trading profit',
    value: 0.15,
    note: 'T4. harness --draft, 17,000 stables (1,000 one-season games at 3, 6 and 8 stables, all Normal), Bones of end worth per bonus held net of its cut: at 6% with a +50% shelf +1,941 (± 279), fair 43%; at 20% with +25% +147 (± 276), fair 23%; at 22% −245 (± 261) and −437 (± 265), fair 13–17%',
  },
  {
    section: T_SECTION,
    label: 'Gambling Advisor cut: better odds, share of winnings',
    value: 0.15,
    note: 'T4. Winnings are payout − stake on every slip that wins, about 1,500 a stable-season. harness --draft, 17,000 stables (1,000 one-season games at 3, 6 and 8 stables, all Normal), Bones of end worth per bonus held net of its cut: at 12% with +8% odds +733 (± 358), fair 56%; at 30% with +5% −75 (± 311), fair 25%; at 25% −428 (± 309) and −384 (± 314), fair below 0 — noisy: winnings are a small side, and Normal bets little',
  },
  {
    section: T_SECTION,
    label: 'Gambling Advisor cut: a higher stake ceiling, share of winnings',
    value: 0.02,
    note: 'T4. harness --draft, 17,000 stables (1,000 one-season games at 3, 6 and 8 stables, all Normal), Bones of end worth per bonus held net of its cut: at 8% +108 (± 265), fair 14.5%; at 12% −343 (± 283), fair below zero: Normal seldom bets at the ceiling, so the lift is worth little to it. Held at the floor of the 1–10% range rather than given away; at 5% −406 (± 441) and −475 (± 427): held near nothing',
  },
  {
    section: T_SECTION,
    label: 'Staff cut: the most an advisor takes, of their side',
    value: 0.4,
    note: 'T4: a Trainer is still capped at staffCutMax (10% of purses); an advisor’s side is a profit, a fifth of the purses (trade) or a seventeenth (winnings), so its cap is higher',
  },
  {
    section: T_SECTION,
    label: 'Arrival: fitness a rested landing gives (a wormhole, a pilot’s chart)',
    value: 10,
    note: 'T1: the two cards that bought "arrive first next week" — there is no turn order to be first in',
  },
  {
    section: T_SECTION,
    label: 'Arrival: fitness a shaken landing costs (a fried navicomp)',
    value: -10,
    note: 'T1: the Solar flare card’s "land last next week"',
  },
  {
    section: T_SECTION,
    label: 'Blackreach: every stable’s shelf is this many times the posted depth',
    value: 2,
    note: 'T1: Blackreach reversed the turn order; with no turn order its time-bending station restocks twice',
  },
];

// Q2's third-round reversal, re-measured for the seven-round draft (T2) and kept on.
ROWS.push({
  section: "Phase Q (v3q) — Claude's unattended changes, each a Q row in GDD_V3 §13",
  label: 'Draft: round 3 runs the way round 2 did (1 yes, 0 a plain snake)',
  value: 1,
  note: "Q2 (GDD_V3 §5.5, V29): the third-round reversal. Win rate by draft position, widest gap from fair at 3 / 6 / 8 stables, all Normal, one season: plain snake 4.4 / 5.2 / 4.7 points (1,000 games); round 3 reversed 1.0 / 2.0 / 3.1 (1,000) and 2.3 / 1.1 / 2.7 (2,000) against ±3. Jesse's 45–55 board is untouched. Phase T (seven rounds: four dogs, then one of each staff role), 1,000 games, with the staff priced as they ship: reversed 1.7 / 1.8 / 2.2, MET; plain snake 4.0 / 4.7 / 6.8, the first pick taking the first Trainer. Kept on",
});

const REMOVE: { label: string; why: string }[] = [
  {
    label: 'Staff: trainers dealt to each stable at the start of a game',
    why: 'T2: a stable has one of each of three roles, so the slot count is the roles',
  },
];

/** A row renamed where it stands, so its section and its neighbours stay put. */
const RENAME: { from: string; to: string; value: number; note: string }[] = [
  {
    from: 'Draft: trainers on the opening board, per stable',
    to: 'Draft: staff of each role on the opening board, per stable (rounded up)',
    value: 1.5,
    note: 'T2: the opening draft takes one of each role, so the board carries 1.5 a stable of each — the 1.5× choice the two-trainer board gave (3 a stable for 2 picks). 12 of each at 8 stables, which is every Trade and Gambling Advisor there is',
  },
  {
    from: "Staff cut: next planet's band position for all six goods",
    to: "Trade Advisor cut: next week's prices for all six goods, share of trading profit",
    value: 0.05,
    note: 'T4: was 8% of purses as a trainer bonus (D12’s regression); a share of trading profit now. harness --draft, 17,000 stables (1,000 one-season games at 3, 6 and 8 stables, all Normal), Bones of end worth per bonus held net of its cut: at 10% +823 (± 545), fair 26%; at 25% −800 (± 311), fair 8%; at 12% −662 (± 348) and −649 (± 375), fair below 0: Normal trades on a price it knows little better than on the map',
  },
  {
    from: 'Staff cut: a race-day tip a week',
    to: 'Gambling Advisor cut: a race-day tip a week, share of winnings',
    value: 0.1,
    note: 'T4: was 2% of purses as a trainer bonus (Q3); a share of winnings now, and about rivals’ dogs only (a tip about your own dog is a Race-or-Rest call, the Trainer’s side). harness --draft, 17,000 stables (1,000 one-season games at 3, 6 and 8 stables, all Normal), Bones of end worth per bonus held net of its cut: at 10% and any dog +1,886 (± 511), fair 124%; at 30% and rivals only −161 (± 492), fair 20%; at 20% −153 (± 312) and −350 (± 315), fair −6 to 9%',
  },
  {
    from: 'Off-season: a trainer leaves, chance each',
    to: 'Off-season: a member of staff leaves, chance each',
    value: 0.15,
    note: 'E5, unchanged: every member of staff, of every role, rolls it',
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

let renamed = 0;
for (const r of RENAME) {
  const at = indexOfLabel(r.from);
  if (at >= 0) {
    rows[at] = [r.to, r.value, r.note];
    renamed++;
  } else {
    const now = indexOfLabel(r.to);
    if (now >= 0) rows[now] = [r.to, r.value, r.note];
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
  `Assumptions: ${added} rows added, ${updated} updated, ${renamed} renamed, ${removed} removed → ${rows.length} rows`,
);
