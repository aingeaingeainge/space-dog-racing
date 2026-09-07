import {
  balance,
  formatBones,
  planetOf,
  purseFor,
  ratingCap,
  RACE_CLASSES,
  type GameState,
  type Player,
  type RaceClass,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { TicketCard } from '../components/TicketCard';
import { Badge, Notes, StableName, Traits } from '../components/ui';
import { trackText } from '../lib/planetText';
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
  const entry = s.calendar[s.week - 1];
  const major = entry?.major ?? false;
  const planet = planetOf(s.planet.planetId);
  const sp = planet.special;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
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
        <p className="muted first">
          Empty traps are filled by local dogs. Declarations lock when every stable has left the
          planet — after that the fields, traps and odds are public and the races run.
        </p>
        <Notes
          lines={[
            `${planet.name}: ${trackText(planet.track)}.`,
            planet.track.hazard !== 1
              ? `A hazardous surface — injury risk ×${planet.track.hazard} on top of the base ${pct(balance.injuryBase)} a race.`
              : null,
            planet.track.mud ? 'Mudlarks love it here.' : null,
            planet.track.slippery ? 'Slippery: acceleration counts for more than usual.' : null,
            planet.track.length === 'sprint'
              ? 'A sprint: Sprinters and fast starters.'
              : planet.track.length === 'staying'
                ? 'A staying trip: Stayers and stamina.'
                : null,
            planet.track.bends === 'tight' ? 'Tight bends: Railers gain, everyone else risks a bump.' : null,
            entry?.grandFinal
              ? `The Grand Final — purses ×${balance.finalMult}.`
              : major
                ? `A Major — purses ×${balance.majorMult}, Showboats lift, and the locals are ${balance.localRatingMajorBonus} points better.`
                : null,
            sp.purseMult ? `${planet.name} adds ×${sp.purseMult} to every purse.` : null,
            sp.winningsTax ? `${pct(sp.winningsTax)} of any prize money is taxed here.` : null,
            sp.localsNervy ? 'The locals are Nervy: they lose 5% in traps 1 and 8.' : null,
            `A run costs ${balance.fitnessPerRace} fitness; below ${balance.fitnessScaleBelow} every stat is scaled down.`,
          ]}
        />
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
            <TicketCard
              key={cls}
              cls={CLASS_LABEL[cls]}
              tone={cls}
              cap={cls === 'gold' ? 'no cap' : `cap ${cap}`}
              purse={formatBones(purse[0])}
              serial={`2nd ${formatBones(purse[1])} · 3rd ${formatBones(purse[2])}`}
            >
              <label>
                <span className="muted">Your runner</span>
                <br />
                <select className="wide" value={mine} onChange={(e) => declare(cls, e.target.value)}>
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

              {mine && s.dogs[mine] ? (
                <p className="tight-p">
                  <Traits ids={s.dogs[mine]!.traits} />
                  <span className="muted">
                    fitness {s.dogs[mine]!.fitness} · form {s.dogs[mine]!.form}
                  </span>
                </p>
              ) : null}

              <p className="muted tight-p">
                {declaredHere} declared · {Math.max(0, TRAPS - declaredHere)} local dogs will fill
                the rest, rating about {localRatingFor(cls, major)}
              </p>

              <table className="rivals">
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
                <p className="muted last">Other humans&apos; picks stay hidden until the card locks.</p>
              ) : null}
            </TicketCard>
          );
        })}
      </div>
    </>
  );
}
