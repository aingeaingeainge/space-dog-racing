import type { ReactNode } from 'react';
import { formatBones, TRAIT_BY_ID, type Dog, type Player, type TraitId } from '@sdr/engine';
import { Panel } from './Panel';

/** GDD §16: the eight saddle-cloth colours, in Player.colour order. */
export const STABLE_COLOURS = [
  '#e03131',
  '#3b82f6',
  '#f4f4f4',
  '#2b2b33',
  '#f97316',
  '#9be84b',
  '#f4c542',
  '#f04e98',
];

export function Swatch({ colour }: { colour: number }) {
  return (
    <i className="swatch" style={{ background: STABLE_COLOURS[colour % STABLE_COLOURS.length] }} />
  );
}

export function StableName({ player, me }: { player: Player; me?: boolean }) {
  return (
    <span>
      <Swatch colour={player.colour} />
      {player.name}
      {player.kind === 'ai' ? <span className="muted"> (AI)</span> : null}
      {me ? <span className="muted"> — you</span> : null}
    </span>
  );
}

export function Bones({ n }: { n: number }) {
  return <span>{formatBones(n)}</span>;
}

export function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <>
      <i className="bar">
        <span style={{ width: `${pct}%` }} />
      </i>
      {Math.round(value)}
    </>
  );
}

export function Delta({ n }: { n: number }) {
  if (!n) return <span className="muted">0</span>;
  return <span className={n > 0 ? 'up' : 'down'}>{n > 0 ? `+${n}` : n}</span>;
}

export function Badge({
  children,
  tone,
  title,
}: {
  children: ReactNode;
  tone?: 'hot' | 'bad' | 'good';
  title?: string;
}) {
  return (
    <span className={tone ? `badge ${tone}` : 'badge'} title={title}>
      {children}
    </span>
  );
}

export function Modal({
  title,
  sub,
  children,
  onClose,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="scrim">
      <Panel
        title={title}
        sub={sub}
        actions={onClose ? <button onClick={onClose}>Close</button> : undefined}
      >
        {children}
      </Panel>
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** GDD §5.4 — quirks are icons with tooltips wherever a dog appears, not just in your stable. */
export function Traits({ ids }: { ids: readonly TraitId[] }) {
  if (!ids.length) return <span className="muted">—</span>;
  return (
    <>
      {ids.map((t) => (
        <Badge key={t} title={TRAIT_BY_ID[t]?.blurb}>
          {TRAIT_BY_ID[t]?.name ?? t}
        </Badge>
      ))}
    </>
  );
}

/** A filled bar with its own caption — the cargo hold, mostly. */
export function Gauge({ value, max, unit }: { value: number; max: number; unit: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="gauge">
      <i className="bar wide">
        <span style={{ width: `${pct}%` }} />
      </i>
      {value} / {max} {unit}
    </span>
  );
}

/** The four stats as table headers, so every dog table lines up. */
export function StatHeads() {
  return (
    <>
      <th className="num" title="Speed">
        Spd
      </th>
      <th className="num" title="Acceleration">
        Acc
      </th>
      <th className="num" title="Stamina">
        Sta
      </th>
      <th className="num" title="Trap">
        Trp
      </th>
    </>
  );
}

export function StatCells({ d }: { d: Dog }) {
  return (
    <>
      <td className="num">{d.speed}</td>
      <td className="num">{d.accel}</td>
      <td className="num">{d.stamina}</td>
      <td className="num">{d.trap}</td>
    </>
  );
}

/** A row of "what this planet does to this counter" notes (GDD §12). */
export function Notes({ lines }: { lines: (string | null | false | undefined)[] }) {
  const shown = lines.filter((l): l is string => !!l);
  if (!shown.length) return null;
  return (
    <ul className="notes">
      {shown.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}
