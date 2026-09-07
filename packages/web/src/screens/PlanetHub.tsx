import {
  formatBones,
  planetOf,
  purseFor,
  ratingCap,
  RACE_CLASSES,
  type GameState,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, KV, StableName } from '../components/ui';
import { specialText, trackText } from '../lib/planetText';
import {
  CLASS_LABEL,
  PHASE_LABEL,
  PHASE_ORDER,
  declaredCount,
  localRatingFor,
  playerById,
  TRAPS,
} from '../lib/selectors';

/** GDD §15.3 as a shell: what is on this week, what the planet does to you, whose turn it is. */
export function PlanetHub({ s, me }: { s: GameState; me: Player }) {
  const entry = s.calendar[s.week - 1]!;
  const planet = planetOf(entry.planetId);
  const rules = specialText(planet);
  const weekLog = s.eventLog.filter((l) => l.week === s.week && (!l.playerId || l.playerId === me.id));

  return (
    <>
      <Panel
        title={
          <>
            {planet.name}
            {entry.grandFinal ? ' ★★' : entry.major ? ' ★' : ''}
          </>
        }
        sub={entry.major ? planet.event : planet.vibe}
      >
        <div className="grid2">
          <KV
            items={[
              ['Track', trackText(planet.track)],
              ['Kibble', `buy ${s.planet.foodBuy} / sell ${s.planet.foodSell} per crate`],
              ['Market', planet.marketBias],
              ['Phase', PHASE_LABEL[s.phase]],
            ]}
          />
          <div>
            <div className="phases" style={{ marginBottom: 8 }}>
              {PHASE_ORDER.map((p) => (
                <span
                  key={p}
                  className={
                    p === s.phase
                      ? 'now'
                      : PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(s.phase)
                        ? 'done'
                        : ''
                  }
                >
                  {PHASE_LABEL[p]}
                </span>
              ))}
            </div>
            <div style={{ whiteSpace: 'normal' }}>
              {rules.length ? (
                rules.map((t) => (
                  <Badge key={t} tone="hot">
                    {t}
                  </Badge>
                ))
              ) : (
                <span className="muted">No special rules on this rock.</span>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid2">
        <Panel title="This weekend's card" sub="one dog per race, per stable">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Race</th>
                  <th className="num">Cap</th>
                  <th className="num">Purse 1st/2nd/3rd</th>
                  <th>Your runner</th>
                  <th className="num">Stables in</th>
                </tr>
              </thead>
              <tbody>
                {RACE_CLASSES.map((cls) => {
                  const purse = purseFor(s, cls);
                  const mine = s.declarations[cls][me.id];
                  const dog = mine ? s.dogs[mine] : undefined;
                  const declared = declaredCount(s, cls);
                  return (
                    <tr key={cls}>
                      <td>
                        <b>{CLASS_LABEL[cls]}</b>
                      </td>
                      <td className="num">{cls === 'gold' ? 'any' : ratingCap(cls)}</td>
                      <td className="num">
                        {purse.map((n) => formatBones(n).replace(' Bones', '')).join(' / ')}
                      </td>
                      <td>
                        {dog ? (
                          `${dog.name} (${dog.rating})`
                        ) : (
                          <span className="muted">not declared</span>
                        )}
                      </td>
                      <td className="num">
                        {declared} + {Math.max(0, TRAPS - declared)} locals ≈{' '}
                        {localRatingFor(cls, entry.major)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Turn order" sub="ship speed × 10 − cargo ÷ 5 + d10">
          <div className="table-wrap">
            <table>
              <tbody>
                {s.turnOrder.map((id, i) => {
                  const p = playerById(s, id);
                  if (!p) return null;
                  return (
                    <tr key={id} className={id === me.id ? 'me' : ''}>
                      <td>{i + 1}</td>
                      <td>
                        <StableName player={p} me={id === me.id} />
                      </td>
                      <td className="muted">{s.turnOrderReason[id]}</td>
                      <td className="muted">{s.done.includes(id) ? 'done' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="This week" sub="what has happened so far">
        <div className="log">
          {weekLog.length ? (
            weekLog.map((l, i) => (
              <p key={i} className={l.playerId === me.id ? '' : 'muted'}>
                {l.text}
              </p>
            ))
          ) : (
            <p className="muted">Quiet so far.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
