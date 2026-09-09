import { useEffect, useRef, useState, type RefObject } from 'react';
import { formatBones, type GameState } from '@sdr/engine';
import { STABLE_COLOURS, Swatch } from './ui';
import { weeksPlayed, worthSeries, type WorthSeries } from '../lib/seasonEnd';

/**
 * GDD §15.11's net-worth-over-time chart. Inline SVG, no chart library, kit colours only, and
 * every line in its stable's saddle-cloth colour so the chart reads against the podium and the
 * leaderboard without a second legend to learn.
 *
 * Three things about the shape of it.
 *
 * **The viewBox is measured, not fixed.** An SVG that scales to its container scales its text
 * too, so a fixed viewBox is either unreadable at 390 px or comically large at 1440 px. The
 * container's width is measured and used as the viewBox width, so one user unit is one pixel and
 * `font-size: 12` is twelve real pixels at every width. That is what makes this legible on a
 * phone *and* worth looking at on a laptop, which the last screen of an hour of play should be.
 *
 * **Every line is drawn twice**: a halo underneath in the opposite luminance, then the colour on
 * top. Two of the eight saddle cloths are near-black (#2b2b33) and near-white (#f4f4f4), and on
 * charcoal one of those is invisible without it. The 299/587/114 weighting is the same one the
 * planet theme uses to pick readable ink.
 *
 * **A bust stable's line stops.** `endTurn` skips a bankrupt stable, so its series is short by
 * design; the line ends where the money did, with a cross rather than a dot.
 */

function luma(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

/** A round gridline step — 1, 2 or 5 times a power of ten — for roughly four lines. */
function niceStep(range: number): number {
  if (range <= 0) return 1;
  const raw = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

/** Axis numbers only: "40.9k". The legend carries the real figure in Bones. */
function compact(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

function colourOf(series: WorthSeries): string {
  return STABLE_COLOURS[series.player.colour % STABLE_COLOURS.length]!;
}

/** The container's width in CSS pixels, so the plot can be drawn 1:1 into it. */
function useMeasuredWidth(fallback = 640): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function WorthChart({ s }: { s: GameState }) {
  const [ref, W] = useMeasuredWidth();
  const series = worthSeries(s);
  const weeks = weeksPlayed(s);
  const all = series.flatMap((x) => x.points);

  const H = Math.round(Math.min(300, Math.max(190, W * 0.46)));
  const pad = { l: 44, r: 12, t: 12, b: 34 };
  const plotW = Math.max(10, W - pad.l - pad.r);
  const plotH = Math.max(10, H - pad.t - pad.b);

  // Zero is always on the chart: a stable can finish behind its debts and the line has to be
  // able to cross something.
  const lo = Math.min(0, ...(all.length ? all : [0]));
  const hi = Math.max(...(all.length ? all : [1]));
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const span = max - min || 1;

  const x = (week: number) =>
    pad.l + (weeks <= 1 ? plotW / 2 : ((week - 1) / (weeks - 1)) * plotW);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * plotH;

  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v));

  const majors = s.calendar.filter((c) => c.major && c.week <= weeks);
  const champion = series[0];
  const narrow = W < 420;

  // Humans last so a human line is never buried under an AI's.
  const drawOrder = [...series].sort(
    (a, b) => Number(a.player.kind === 'human') - Number(b.player.kind === 'human'),
  );

  return (
    <div className="worth-chart" ref={ref}>
      {weeks > 0 && all.length > 0 ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="worth-plot"
          role="img"
          aria-label={
            champion
              ? `Net worth by week for ${series.length} stables over ${weeks} weeks. ${champion.player.name} finished first on ${formatBones(champion.points[champion.points.length - 1] ?? 0)}.`
              : 'Net worth by week'
          }
        >
          {ticks.map((v) => (
            <g key={`t${v}`}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? 'var(--edge-lit)' : '#33303f'}
                strokeWidth={v === 0 ? 2 : 1}
              />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="axis">
                {compact(v)}
              </text>
            </g>
          ))}

          {/* The Majors, because the snowball usually starts at one. */}
          {majors.map((c) => (
            <g key={`m${c.week}`}>
              <line
                x1={x(c.week)}
                x2={x(c.week)}
                y1={pad.t}
                y2={pad.t + plotH}
                stroke={c.grandFinal ? 'var(--hazard)' : 'var(--edge)'}
                strokeWidth={c.grandFinal ? 2 : 1}
                strokeDasharray="4 5"
                opacity={c.grandFinal ? 0.75 : 0.5}
              />
              <text x={x(c.week)} y={pad.t + plotH + 28} textAnchor="middle" className="axis major">
                {c.grandFinal ? 'GF' : 'M'}
              </text>
            </g>
          ))}

          {/* Weeks along the bottom: the ends always, and a thinned-out set between. */}
          {Array.from({ length: weeks }, (_, i) => i + 1)
            .filter((w) => w === 1 || w === weeks || w % (narrow ? 4 : 2) === 0)
            .map((w) => (
              <text
                key={`w${w}`}
                x={x(w)}
                y={pad.t + plotH + 15}
                textAnchor="middle"
                className="axis"
              >
                {w}
              </text>
            ))}

          {drawOrder.map((line) => {
            const colour = colourOf(line);
            const halo = luma(colour) < 90 ? 'rgba(242,240,246,0.6)' : 'var(--ink)';
            const wide = line.player.kind === 'human';
            const pts = line.points.map((v, i) => `${x(i + 1)},${y(v)}`).join(' ');
            const last = line.points.length;
            const lastV = line.points[last - 1];
            return (
              <g key={line.player.id}>
                <title>
                  {`${line.player.name} — ${formatBones(lastV ?? 0)}${line.bustWeek ? `, bust in week ${line.bustWeek}` : ''}`}
                </title>
                {last > 1 ? (
                  <>
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={halo}
                      strokeWidth={wide ? 7 : 5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity="0.75"
                    />
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={colour}
                      strokeWidth={wide ? 3.5 : 2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </>
                ) : null}
                {lastV !== undefined ? (
                  line.bustWeek ? (
                    <g stroke={colour} strokeWidth="2.5" strokeLinecap="round">
                      <line x1={x(last) - 4} y1={y(lastV) - 4} x2={x(last) + 4} y2={y(lastV) + 4} />
                      <line x1={x(last) - 4} y1={y(lastV) + 4} x2={x(last) + 4} y2={y(lastV) - 4} />
                    </g>
                  ) : (
                    <circle
                      cx={x(last)}
                      cy={y(lastV)}
                      r={wide ? 4.5 : 3}
                      fill={colour}
                      stroke="var(--ink)"
                      strokeWidth="1.5"
                    />
                  )
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}

      <p className="muted chart-axis-note">
        Net worth in Bones by race weekend. M is a Major, GF the Grand Final.
      </p>

      <ul className="chart-key">
        {series.map((line) => {
          const lastV = line.points[line.points.length - 1];
          return (
            <li key={line.player.id} className={line.player.kind === 'human' ? 'me' : undefined}>
              <b className="rank">{line.rank}</b>
              <Swatch colour={line.player.colour} />
              <span className="who">
                {line.player.name}
                {line.player.kind === 'human' ? <span className="muted"> — you</span> : null}
              </span>
              <span className="fig">{formatBones(lastV ?? 0)}</span>
              {line.bustWeek ? <span className="muted">bust, week {line.bustWeek}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
