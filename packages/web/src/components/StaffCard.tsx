import {
  cutOf,
  formatBones,
  STAFF_BONUS_BY_ID,
  staffRow,
  type Player,
  type StaffRow,
} from '@sdr/engine';
import { portraitArt } from '../lib/assets';
import { Badge } from './ui';

/**
 * A trainer (GDD_V3 §8): portrait, name, their line, what they do and what they take. Everything the
 * engine reads is the bonus; the name and the face are for the table. The portrait resolves through
 * `lib/assets.ts`, so a placeholder draws until the art lands.
 */
export function StaffCard({ row, sub }: { row: StaffRow; sub?: string }) {
  const art = portraitArt(row.portrait);
  return (
    <div className="staffcard">
      <span className={art && !art.placeholder ? 'portrait' : 'portrait ph'}>
        {art ? <img src={art.url} alt="" decoding="async" loading="lazy" /> : <span>trainer</span>}
      </span>
      <div className="staffcard-body">
        <div className="staffcard-head">
          <b>{row.name}</b>
          <Badge tone="hot" title="commission: a share of race prize money only">
            {Math.round(cutOf(row) * 100)}% of purses
          </Badge>
        </div>
        <span className="muted small">{row.blurb}</span>
        <ul className="staffcard-bonuses">
          {row.bonuses.map((b) => (
            <li key={b}>{STAFF_BONUS_BY_ID[b].text}.</li>
          ))}
        </ul>
        {sub ? <span className="muted small">{sub}</span> : null}
      </div>
    </div>
  );
}

/** The two trainers in one line: for the hub and the season end. */
export function staffLine(p: Player): string {
  if (!p.staff.length) return 'No trainers';
  const rows = p.staff.map(staffRow);
  const cut = rows.reduce((a, r) => a + cutOf(r), 0);
  return `${rows.map((r) => `${r.name} (${r.bonuses.map((b) => STAFF_BONUS_BY_ID[b].short).join(', ')})`).join(' · ')} — ${Math.round(cut * 100)}% of purses`;
}

/** What the trainers have taken this season, for a line under the cards. */
export function commissionLine(p: Player): string {
  const gross = p.stats.prizeIncome + p.stats.commission;
  if (!gross) return 'Nothing won yet, so nothing taken: they are paid only from purses.';
  return `This season they have taken ${formatBones(p.stats.commission)} of ${formatBones(gross)} in purses (${Math.round((100 * p.stats.commission) / gross)}%). Bets, trades and dog sales are never theirs.`;
}
