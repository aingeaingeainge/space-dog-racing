import {
  vetRestBonus,
  balance,
  formatBones,
  planetOf,
  purseFor,
  thisWeeksCard,
  type Dog,
  type GameState,
  type Player,
  type RaceTypeId,
} from '@sdr/engine';
import { DogThumb } from '../components/DogCard';
import { Panel } from '../components/Panel';
import { TicketCard } from '../components/TicketCard';
import { Badge, Notes, StableName, Traits } from '../components/ui';
import { trackText } from '../lib/planetText';
import {
  cannotRunReason,
  criterionFor,
  declaredRace,
  fitnessOutlook,
  ineligibleReason,
  localRatingFor,
  ownedDogs,
  raceLabel,
  raceTone,
  TRAPS,
} from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * What the week costs, dog by dog (GDD §5.7, §6.5).
 *
 * Phase A put a real decision in the game — race a dog tired, or rest it and give up the purse —
 * and then left it on a screen the player had no reason to open. Every dog defaults to Race,
 * declaring one sets it to Race, and this screen said nothing about fitness at all, so a player
 * could walk from the hub to the Race Office, declare their best three and end the turn having
 * played v1. This table is where the price is printed: it sits above the card, on the screen
 * where the entries are actually made, and it names the number the choice turns on.
 *
 * One table rather than a line on each of the three stubs: the answer does not change per race,
 * and repeating it three times is how a screen stops being read.
 */
function WeekLedger({ s, me, dogs }: { s: GameState; me: Player; dogs: Dog[] }) {
  if (!dogs.length) return null;
  return (
    <table className="ledger">
      <thead>
        <tr>
          <th>Dog</th>
          <th>Rating</th>
          <th>Fitness</th>
          <th>If it runs</th>
          <th>If it rests</th>
          <th>This week</th>
        </tr>
      </thead>
      <tbody>
        {dogs.map((d) => {
          const f = fitnessOutlook(d, me);
          const barred = cannotRunReason(s, d);
          const race = declaredRace(s, me.id, d.id);
          return (
            <tr key={d.id} className={barred ? 'muted' : undefined}>
              <td>{d.name}</td>
              <td>{d.rating}</td>
              <td>{f.now}</td>
              <td>{barred ? '—' : `${f.racing}`}</td>
              <td>{f.resting}</td>
              <td>
                {barred ? (
                  <span className="muted">{barred}</span>
                ) : race ? (
                  <Badge tone="good">declared in the {raceLabel(race)}</Badge>
                ) : (
                  <span className="muted">not entered</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

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

  const card = thisWeeksCard(s);
  const declare = (race: RaceTypeId, dogId: string) =>
    dispatch({ t: 'Declare', playerId: me.id, race, dogId: dogId || null });

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
            planet.track.bends === 'tight'
              ? 'Tight bends: Railers gain, everyone else risks a bump.'
              : null,
            entry?.grandFinal
              ? `The Grand Final — purses ×${balance.finalMult}.`
              : major
                ? `A Major — purses ×${balance.majorMult}, Showboats lift, and the locals are ${balance.localRatingMajorBonus} points better.`
                : null,
            sp.purseMult ? `${planet.name} adds ×${sp.purseMult} to every purse.` : null,
            sp.winningsTax ? `${pct(sp.winningsTax)} of any prize money is taxed here.` : null,
            sp.localsNervy ? 'The locals are Nervy: they lose 5% in traps 1 and 8.' : null,
            `A run costs ${balance.fitnessPerRace} fitness and a rest returns ${balance.fitnessRest}${vetRestBonus(me) ? ` (${balance.fitnessRest + vetRestBonus(me)} with your vet)` : ''}; below ${balance.fitnessScaleBelow} every stat is scaled down. What you enter this weekend is what you cannot enter next.`,
          ]}
        />
        <WeekLedger s={s} me={me} dogs={dogs} />
      </Panel>

      <div className="grid3">
        {card.map((race) => {
          const purse = purseFor(s, race);
          const mine = s.declarations[race][me.id] ?? '';
          const rivals = s.players
            .filter((p) => p.id !== me.id && !p.flags.bankrupt)
            .map((p) => ({ p, dogId: s.declarations[race][p.id] }));
          const declaredHere = rivals.filter((r) => r.dogId).length + (mine ? 1 : 0);

          return (
            <TicketCard
              key={race}
              cls={raceLabel(race)}
              tone={raceTone(race, card)}
              cap={criterionFor(race)}
              purse={formatBones(purse[0])}
              serial={`2nd ${formatBones(purse[1])} · 3rd ${formatBones(purse[2])}`}
            >
              <label>
                <span className="muted">Your runner</span>
                <br />
                <select
                  className="wide"
                  value={mine}
                  onChange={(e) => declare(race, e.target.value)}
                >
                  <option value="">— no runner —</option>
                  {dogs.map((d) => {
                    const bad = ineligibleReason(d, race);
                    const other = declaredRace(s, me.id, d.id);
                    const f = fitnessOutlook(d, me);
                    return (
                      <option key={d.id} value={d.id} disabled={!!bad}>
                        {d.name} · {d.rating} · fit {f.now} → {f.racing} if it runs
                        {bad ? ` — ${bad}` : ''}
                        {!bad && other && other !== race ? ` — in the ${raceLabel(other)}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              {mine && s.dogs[mine] ? (
                <p className="tight-p">
                  <DogThumb dog={s.dogs[mine]!} big />
                  <Traits ids={s.dogs[mine]!.traits} />
                  <span className="muted">
                    fitness {s.dogs[mine]!.fitness} · form {s.dogs[mine]!.form}
                  </span>
                </p>
              ) : null}

              <p className="muted tight-p">
                {declaredHere} declared · {Math.max(0, TRAPS - declaredHere)} local dogs will fill
                the rest, rating about {localRatingFor(race, major)}
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
                <p className="muted last">
                  Other humans&apos; picks stay hidden until the card locks.
                </p>
              ) : null}
            </TicketCard>
          );
        })}
      </div>
    </>
  );
}
