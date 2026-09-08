import type { Art } from '../lib/assets';
import type { Spot } from '../lib/hotspots';

/**
 * One clickable place on the hub backdrop (GDD §15.3). Position comes from lib/hotspots.ts, so
 * it is data; everything else is the kit's neon plate. A shut venue stays on the backdrop,
 * dashed and grey with the reason under it — M1 note 2: "a vanished button teaches nothing".
 *
 * The icon is an emoji until a painted one lands. `iconArt` is only ever handed finished art,
 * so an unfinished set is six emoji rather than six hatched squares.
 */
export function Hotspot({
  spot,
  icon,
  iconArt,
  label,
  status,
  detail,
  worth,
  reason,
  onClick,
}: {
  spot: Spot;
  icon: string;
  /** The painted icon, where one exists. The emoji stays as the fallback. */
  iconArt?: Art | null;
  label: string;
  /** Two or three words on what is in there this week. */
  status?: string;
  /** The full sentence, for the tooltip. */
  detail?: string;
  /** True when there is something here worth a walk — lights the plate. */
  worth?: boolean;
  /** Why it is shut. Present means disabled. */
  reason?: string;
  onClick: () => void;
}) {
  const cls = ['hotspot', worth && !reason ? 'worth' : null].filter(Boolean).join(' ');
  return (
    <button
      className={cls}
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
      disabled={!!reason}
      title={reason ? `${label} — ${reason}` : detail ? `${label} — ${detail}` : label}
      onClick={onClick}
    >
      <span className="icon" aria-hidden="true">
        {iconArt ? <img src={iconArt.url} alt="" decoding="async" loading="lazy" /> : icon}
      </span>
      <span className="lab">{label}</span>
      {reason ? (
        <span className="why">{reason}</span>
      ) : status ? (
        <span className={worth ? 'why open lit' : 'why open'}>{status}</span>
      ) : null}
    </button>
  );
}
