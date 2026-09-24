import {
  ageFactor,
  describeRetirementOffer,
  dogValue,
  formatBones,
  restRateFor,
  staffRow,
  type GameState,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { NeonButton } from '../components/NeonButton';
import { StaffCard } from '../components/StaffCard';
import { Notes } from '../components/ui';
import { ownedDogs } from '../lib/selectors';
import { useGame } from '../store/gameStore';
import { LastSlips } from './Results';

/**
 * GDD_V3 §2.2 — the off-season, one screen per human, **at most three presses**: the retirement
 * window, the staff notice if there is one, and "On to season N". The ageing is shown, not asked.
 *
 * Each answer is dispatched the moment it is pressed, so the count of presses is the count of
 * actions and `season-check` can hold the screen to three. A press cannot be taken back: that is the
 * engine's rule (each answer once), and it is also the table's — the laptop is about to move on.
 */
export function OffSeason({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const n = s.offSeason?.notices[me.id];
  if (!n) return null;
  const dogs = ownedDogs(s, me);
  const retiredAnswered = n.retired !== undefined;
  const staffAnswered = !n.candidate || n.hired !== undefined;
  const next = s.season + 1;

  return (
    <>
      <div className="centre">
        <h1>The off-season</h1>
        <p className="muted">
          {me.name} · between season {s.season} and season {next}
        </p>
      </div>

      <LastSlips s={s} me={me} />

      <Panel title="A year older" sub="every dog on the circuit ages once, now (GDD §4.3)">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dog</th>
                <th className="num">Age</th>
                <th className="num">Rating</th>
                <th className="num">Book value</th>
                <th>What the year means</th>
              </tr>
            </thead>
            <tbody>
              {dogs.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="num">
                    {d.age - 1} → <b>{d.age}</b>
                  </td>
                  <td className="num">{d.rating}</td>
                  <td className="num">{formatBones(dogValue(d))}</td>
                  <td className="small">{ageLine(d.age)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="The retirement window"
        sub="retire one dog for its book value and take the dog on offer — or keep them all"
      >
        <p className="event-detail">{describeRetirementOffer(n)}</p>
        {retiredAnswered ? (
          <p className="muted">
            {n.retired
              ? `Done: retired for ${formatBones(n.paid ?? 0)}, and the new dog is in the kennel.`
              : 'Done: you keep them all.'}
          </p>
        ) : (
          <div className="row">
            <NeonButton
              variant="primary"
              onClick={() => dispatch({ t: 'Retire', playerId: me.id, dogId: null })}
            >
              Keep them all
            </NeonButton>
            {dogs.map((d) => (
              <NeonButton
                key={d.id}
                onClick={() => dispatch({ t: 'Retire', playerId: me.id, dogId: d.id })}
              >
                Retire {d.name} · {formatBones(dogValue(d))}
              </NeonButton>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="The staff notice" sub="a trainer may leave for a better stable">
        {n.left.length ? (
          <p>
            {n.left.map((id) => staffRow(id).name).join(' and ')}{' '}
            {n.left.length > 1 ? 'have' : 'has'} handed in their notice.
          </p>
        ) : (
          <p className="muted">Your trainers are staying.</p>
        )}
        {n.candidate ? (
          <>
            <StaffCard row={staffRow(n.candidate)} sub="looking for work" />
            {staffAnswered ? (
              <p className="muted">{n.hired ? 'Done: taken on.' : 'Done: sent away.'}</p>
            ) : (
              <div className="row">
                <NeonButton
                  variant="primary"
                  onClick={() => dispatch({ t: 'ResolveStaffNotice', playerId: me.id, hire: true })}
                >
                  Take on {staffRow(n.candidate).name}
                </NeonButton>
                <NeonButton
                  onClick={() =>
                    dispatch({ t: 'ResolveStaffNotice', playerId: me.id, hire: false })
                  }
                >
                  No thanks
                </NeonButton>
              </div>
            )}
          </>
        ) : null}
      </Panel>

      <div className="row centre">
        <NeonButton
          variant="primary"
          disabled={!retiredAnswered || !staffAnswered}
          onClick={() => dispatch({ t: 'EndPhase', playerId: me.id })}
        >
          On to season {next}
        </NeonButton>
      </div>
      <Notes
        lines={[
          'Cash, cargo, dogs, trainers and every style the table knows carry over. The off-season is a long rest: every dog starts the new season on full fitness, and any layoff has healed. The circuit is re-drawn and the prices start again.',
        ]}
      />
    </>
  );
}

/** §4.3 in a line: what this age does to a dog's week and its price. */
function ageLine(age: number): string {
  const growth = age <= 2 ? '+1 stat a week' : age <= 4 ? 'holds its stats' : '−1 stat a week';
  return `${growth}; rests back ${restRateFor(age)} a week; book value ×${ageFactor(age)}`;
}
