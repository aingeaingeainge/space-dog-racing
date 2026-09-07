import type { ReactNode } from 'react';
import { formatBones, type Player } from '@sdr/engine';
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
