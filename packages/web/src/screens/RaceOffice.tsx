import {
  formatBones,
  purseFor,
  ratingCap,
  RACE_CLASSES,
  type GameState,
  type Player,
  type RaceClass,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { Badge, StableName } from '../components/ui';
import {
  CLASS_LABEL,
  declaredClass,
  ineligibleReason,
  localRatingFor,
  ownedDogs,
  TRAPS,
} from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * GDD §15.7. Declarations are public (§2.4) — but a human's pending pick stays hidden from the
 * other humans at the table until the whole card locks, so hotseat play is not a peeking contest.
 */
export function RaceOffice({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const dogs = ownedDogs(s, me);
  const major = s.calendar[s.week - 1]?.major ?? false;
  const otherHumans = s.players.filter((p) => p.kind === 'human' && p.id !== me.id).length > 0;

  const declare = (cls: RaceClass, dogId: string) =>
    dispatch({ t: 'Declare', playerId: me.id, cls, dogId: dogId || null });

  return (
    <>
      <Panel
        title="Race Office"
        sub="one runner per race; a dog may race up a class, never down"
        actions={
          <span className="muted">
            {dogs.filter((d) => d.injuryWeeks === 0 && d.banWeeks === 0).length} of {dogs.length}{' '}
            dogs fit to run
          </span>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Empty traps are filled by local dogs. Declarations lock when every stable has left the
          planet — after that the fields, traps and odds are public and the races run.
        </p>
      </Panel>

      <div className="grid3">
        {RACE_CLASSES.map((cls) => {
          const purse = purseFor(s, cls);
          const cap = ratingCap(cls);
          const mine = s.declarations[cls][me.id] ?? '';
          const rivals = s.players
            .filter((p) => p.id !== me.id && !p.flags.bankrupt)
            .map((p) => ({ p, dogId: s.declarations[cls][p.id] }));
          const declaredHere = rivals.filter((r) => r.dogId).length + (mine ? 1 : 0);

          return (
            <Panel
              key={cls}
              title={`${CLASS_LABEL[cls]} — ${formatBones(purse[0])}`}
              sub={`rating cap ${cls === 'gold' ? 'none' : cap} · 2nd ${formatBones(purse[1])} · 3rd ${formatBones(purse[2])}`}
            >
              <label>
                <span className="muted">Your runner</span>
                <br />
                <select
                  value={mine}
                  style={{ width: '100%' }}
                  onChange={(e) => declare(cls, e.target.value)}
                >
                  <option value="">— no runner —</option>
                  {dogs.map((d) => {
                    const bad = ineligibleReason(d, cls);
                    const other = declaredClass(s, me.id, d.id);
                    return (
                      <option key={d.id} value={d.id} disabled={!!bad}>
                        {d.name} · {d.rating} · fit {d.fitness}
                        {bad ? ` — ${bad}` : ''}
                        {!bad && other && other !== cls ? ` — in ${CLASS_LABEL[other]}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              <p className="muted" style={{ marginBottom: 4 }}>
                {declaredHere} declared · {Math.max(0, TRAPS - declaredHere)} local dogs will fill
                the rest, rating about {localRatingFor(cls, major)}
              </p>

              <table>
                <tbody>
                  {rivals.map(({ p, dogId }) => {
                    const hide = p.kind === 'human' && !s.locked;
                    const dog = dogId ? s.dogs[dogId] : undefined;
                    return (
                      <tr key={p.id}>
                        <td>
                          <StableName player={p} />
                        </td>
                        <td>
                          {hide ? (
                            <span className="muted">hidden until lock</span>
                          ) : dog ? (
                            <>
                              {dog.name} <Badge>{dog.rating}</Badge>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {otherHumans ? (
                <p className="muted" style={{ marginBottom: 0 }}>
                  Other humans&apos; picks stay hidden until the card locks.
                </p>
              ) : null}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
