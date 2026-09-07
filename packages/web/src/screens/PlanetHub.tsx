import {
  balance,
  formatBones,
  planetOf,
  purseFor,
  ratingCap,
  RACE_CLASSES,
  type GameState,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, KV, Notes, StableName } from '../components/ui';
import { specialText, trackText } from '../lib/planetText';
import { venues } from '../lib/venues';
import {
  CLASS_LABEL,
  PHASE_LABEL,
  PHASE_ORDER,
  declaredCount,
  localRatingFor,
  playerById,
  weeklyBill,
  TRAPS,
} from '../lib/selectors';
import { useGame, type View } from '../store/gameStore';

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** GDD §15.3: what is on this week, what this rock does to you, and the way into every venue. */
export function PlanetHub({ s, me }: { s: GameState; me: Player }) {
  const setView = useGame((g) => g.setView);
  const entry = s.calendar[s.week - 1]!;
  const planet = planetOf(entry.planetId);
  const sp = planet.special;
  const rules = specialText(planet);
  const bill = weeklyBill(s, me);
  const weekLog = s.eventLog.filter(
    (l) => l.week === s.week && (!l.playerId || l.playerId === me.id),
  );
  const purseMult = (entry.grandFinal ? balance.finalMult : entry.major ? balance.majorMult : 1) *
    (sp.purseMult ?? 1);

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
              [
                'This week costs',
                `${formatBones(bill.total)} — upkeep ${formatBones(bill.upkeep)}, wages ${formatBones(bill.wages)}, fuel ${formatBones(bill.fuel)}${bill.food ? `, kibble ${formatBones(bill.food)}` : ''}${bill.interest ? `, interest ${formatBones(bill.interest)}` : ''}`,
              ],
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
            <Notes
              lines={[
                purseMult !== 1 ? `Purses are ×${purseMult} this weekend.` : null,
                sp.winningsTax ? `${pct(sp.winningsTax)} of every purse goes to the port authority.` : null,
                sp.noUpkeep ? 'The monks feed and house your dogs: no upkeep this week.' : null,
                sp.fitnessOnArrival
                  ? `Your dogs arrived ${sp.fitnessOnArrival > 0 ? 'refreshed' : 'flat'}: fitness ${sp.fitnessOnArrival > 0 ? '+' : ''}${sp.fitnessOnArrival}.`
                  : null,
                sp.dopingCatch !== undefined
                  ? sp.dopingCatch === 0
                    ? 'Supplements are legal here — the stewards catch nobody.'
                    : `The stewards here catch ${pct(sp.dopingCatch)} of doped dogs, against ${pct(balance.supplementCatchBase)} elsewhere.`
                  : null,
                sp.localsNervy ? 'The local runners are all Nervy — traps 1 and 8 do them no favours.' : null,
              ]}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Where to?" sub="GDD §4.2 phase 3 — spend your time in turn order">
        <div className="venues">
          {venues(s).map((v) => (
            <button
              key={v.id}
              disabled={!v.open || v.id === 'bookie'}
              title={v.reason}
              onClick={() => setView(v.id as View)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <Notes lines={venues(s).filter((v) => v.reason).map((v) => `${v.label}: ${v.reason}`)} />
      </Panel>

      <Panel title="This weekend's card" sub="one dog per race, per stable">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Race</th>
                <th className="num">Cap</th>
                <th className="num">Purse 1st/2nd/3rd</th>
                <th>Your runner</th>
                <th className="num">Field</th>
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
                      {declared} stable{declared === 1 ? '' : 's'} + {Math.max(0, TRAPS - declared)}{' '}
                      locals (rating ≈ {localRatingFor(cls, entry.major)})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid2">
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
      </div>
    </>
  );
}
