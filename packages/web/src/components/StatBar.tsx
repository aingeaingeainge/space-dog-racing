export type StatTone = 'auto' | 'accent';

/**
 * A 0..max number as a lit bar. `auto` ramps pink → hazard → acid with the value, which is
 * what fitness and form want; `accent` paints it in the planet's colour, for the neutral
 * four (speed, accel, stamina, trap) where a red bar would read as a warning it is not.
 */
export function StatBar({
  label,
  value,
  max = 100,
  tone = 'accent',
  wide,
  showValue = true,
}: {
  label?: string;
  value: number;
  max?: number;
  tone?: StatTone;
  wide?: boolean;
  showValue?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const ramp = tone === 'auto' ? (pct < 40 ? ' low' : pct < 70 ? ' mid' : ' high') : '';
  return (
    <span className="statbar">
      {label ? <i className="lab">{label}</i> : null}
      <i className={`bar${wide ? ' wide' : ''}${ramp}`}>
        <span style={{ width: `${pct}%` }} />
      </i>
      {showValue ? <i className="val">{Math.round(value)}</i> : null}
    </span>
  );
}
