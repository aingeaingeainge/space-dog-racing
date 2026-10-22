import {
  cutOf,
  formatBones,
  ROLE_INFO,
  STAFF_BONUS_BY_ID,
  STAFF_ROLES,
  staffRow,
  type Player,
  type StaffRole,
  type StaffRow,
} from '@sdr/engine';
import { portraitArt } from '../lib/assets';
import { Badge } from './ui';

/**
 * A member of staff (GDD_V3 §8, three roles since Phase T): portrait, role, name, their line, what
 * they do and what they take — a share of their own side of the game. Everything the engine reads is
 * the bonus; the name and the face are for the table. The portrait resolves through `lib/assets.ts`,
 * so a placeholder draws until the art lands.
 */
export function StaffCard({ row, sub }: { row: StaffRow; sub?: string }) {
  const art = portraitArt(row.portrait);
  const info = ROLE_INFO[row.role];
  return (
    <div className={`staffcard role-${row.role}`}>
      <span className={art && !art.placeholder ? 'portrait' : 'portrait ph'}>
        {art ? (
          <img src={art.url} alt="" decoding="async" loading="lazy" />
        ) : (
          <span>{info.short}</span>
        )}
      </span>
      <div className="staffcard-body">
        <span className="staffcard-role">{info.name}</span>
        <div className="staffcard-head">
          <b>{row.name}</b>
          <Badge tone="hot" title={`commission: a share of your ${info.cutOf}, and nothing else`}>
            {Math.round(cutOf(row) * 100)}% of {info.cutOf}
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

/** An empty role on a stable's staff: a notice left it short, and a Bar or the off-season fills it. */
export function EmptyRoleCard({ role }: { role: StaffRole }) {
  const info = ROLE_INFO[role];
  return (
    <div className={`staffcard role-${role} empty`}>
      <span className="portrait ph">
        <span>{info.short}</span>
      </span>
      <div className="staffcard-body">
        <span className="staffcard-role">{info.name}</span>
        <b className="muted">Nobody — the job is open</b>
        <span className="muted small">
          A Bar can turn somebody up, and the off-season draft has people looking for work.
        </span>
      </div>
    </div>
  );
}

/** The three roles in one line: for the hub and the season end. */
export function staffLine(p: Player): string {
  if (!p.staff.length) return 'No staff';
  return STAFF_ROLES.map((role) => {
    const r = p.staff.map(staffRow).find((x) => x.role === role);
    if (!r) return `${ROLE_INFO[role].short}: nobody`;
    return `${r.name} (${r.bonuses.map((b) => STAFF_BONUS_BY_ID[b].short).join(', ')}; ${Math.round(cutOf(r) * 100)}% of ${ROLE_INFO[role].cutOf})`;
  }).join(' · ');
}

/** The Trade Advisor in a line, for the Market's notes. */
export function tradeAdvisorLine(p: Player): string {
  const r = p.staff.map(staffRow).find((x) => x.role === 'trade');
  if (!r) return 'You have no Trade Advisor: a Bar or the off-season draft can find you one.';
  return `${r.name}, your Trade Advisor: ${r.bonuses.map((b) => STAFF_BONUS_BY_ID[b].short).join(', ')}. Takes ${Math.round(cutOf(r) * 100)}% of the profit on whatever you sell above what you paid — nothing on a sale at a loss.`;
}

/** What the staff have taken this season, for a line under the cards. */
export function commissionLine(p: Player): string {
  const { commission, tradeCommission, betCommission } = p.stats;
  const total = commission + tradeCommission + betCommission;
  if (!total)
    return 'Nothing taken yet: each of them is paid only from their own side, and only when it makes money.';
  const part = (label: string, n: number) => (n ? `${formatBones(n)} ${label}` : null);
  const parts = [
    part('from your purses', commission),
    part('from your trading profit', tradeCommission),
    part('from your winnings', betCommission),
  ].filter(Boolean);
  return `This season they have taken ${parts.join(', ')}. Nothing else is ever theirs.`;
}
