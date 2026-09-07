import type { Spot } from '../lib/hotspots';

/**
 * One clickable place on the hub backdrop (GDD §15.3). Position comes from lib/hotspots.ts, so
 * it is data; everything else is the kit's neon plate. A shut venue stays on the backdrop,
 * dashed and grey with the reason under it — M1 note 2: "a vanished button teaches nothing".
 */
export function Hotspot({
  spot,
  icon,
  label,
  status,
  reason,
  onClick,
}: {
  spot: Spot;
  icon: string;
  label: string;
  /** What is in there this week; also the tooltip when the venue is open. */
  status?: string;
  /** Why it is shut. Present means disabled. */
  reason?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="hotspot"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
      disabled={!!reason}
      title={reason ? `${label} — ${reason}` : status ? `${label} — ${status}` : label}
      onClick={onClick}
    >
      <span className="icon" aria-hidden="true">
        {icon}
      </span>
      <span className="lab">{label}</span>
      {reason ? <span className="why">{reason}</span> : status ? <span className="why open">{status}</span> : null}
    </button>
  );
}
