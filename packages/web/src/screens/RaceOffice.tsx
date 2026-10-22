import {
  balance,
  formatBones,
  planetOf,
  publicStyle,
  purseFor,
  restBonus,
  boxWorthText,
  STYLE_BY_ID,
  STYLE_IDS,
  thisWeeksCard,
  type Dog,
  type GameState,
  type Player,
  type RaceTypeId,
  type StyleId,
} from '@sdr/engine';
import { DogThumb } from '../components/DogCard';
import { Whispers } from '../components/Whispers';
import { Panel } from '../components/Panel';
import { TicketCard } from '../components/TicketCard';
import { Badge, Notes, StableName, StyleTag, Traits } from '../components/ui';
import { More } from '../components/More';
import { Guide } from '../components/Guide';
import { trackLine, trackText } from '../lib/planetText';
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
import { NeonButton } from '../components/NeonButton';
import { useGame } from '../store/gameStore';

/**
 * GDD_V3 §9.3's bought trap draw, spent: a stable that slipped the steward something in the Back
 * Alley names its box here, once it knows the race. One press on a box (and one on the race, if it
 * has runners in more than one). It is honoured at the lock, if the dog is still declared, and the
 * screen says what a box is worth on this track — about two points of win rate on tight bends, and
 * nothing on a straight — from the engine's one measured figure.
 */
function BoxChooser({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const job = s.jobs.find((j) => j.by === me.id && j.kind === 'box');
  if (!job || s.phase !== 'planetPre') return null;
  const worth = boxWorthText(planetOf(s.planet.planetId).track);
  const entered = thisWeeksCard().filter((r) => s.declarations[r][me.id]);
  const race = job.race && entered.includes(job.race) ? job.race : entered[entered.length - 1];
  return (
    <Panel
      title="The steward's box"
      sub="bought in the Back Alley — name it once you know the race"
    >
      <p className="flush">{worth}</p>
      {!race ? (
        <p className="muted">Declare a runner first; then choose its box.</p>
      ) : (
        <>
          {entered.length > 1 ? (
            <p className="row tight">
              {entered.map((r) => (
                <NeonButton
                  key={r}
                  small
                  variant={r === race ? 'primary' : undefined}
                  onClick={() =>
                    dispatch({ t: 'ChooseBox', playerId: me.id, race: r, box: job.box ?? 1 })
                  }
                >
                  {raceLabel(r)}
                </NeonButton>
              ))}
            </p>
          ) : null}
          <p className="row tight">
            <span className="muted">
              {s.dogs[s.declarations[race][me.id]!]?.name ?? 'Your runner'} in the {raceLabel(race)}{' '}
              goes in box:
            </span>
            {Array.from({ length: TRAPS }, (_, i) => i + 1).map((b) => (
              <NeonButton
                key={b}
                small
                variant={job.race === race && job.box === b ? 'primary' : undefined}
                onClick={() => dispatch({ t: 'ChooseBox', playerId: me.id, race, box: b })}
              >
                {b}
              </NeonButton>
            ))}
          </p>
          <p className="muted small">
            {job.box && job.race
              ? `Box ${job.box} in the ${raceLabel(job.race)}. You can change it until the card locks.`
              : 'Not named yet: a box you do not name is a box you do not get.'}
          </p>
        </>
      )}
    </Panel>
  );
}

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
    <div className="table-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th>Dog</th>
            <th>Style</th>
            <th>Rating</th>
            <th>Fitness</th>
            <th>If it runs</th>
          </tr>
        </thead>
        <tbody>
          {dogs.map((d) => {
            const f = fitnessOutlook(d, restBonus(me));
            const barred = cannotRunReason(s, d);
            // Phase P: "if it rests" and "this week" folded into one cell — the run's cost, and the
            // race it is in once declared. A dog not declared rests (D16).
            const race = declaredRace(s, me.id, d.id);
            return (
              <tr key={d.id} className={barred ? 'muted' : undefined}>
                <td>{d.name}</td>
                <td>
                  <StyleTag style={publicStyle(d)} />
                </td>
                <td>{d.rating}</td>
                <td>{f.now}</td>
                <td>
                  {barred ? (
                    <span className="muted">{barred}</span>
                  ) : race ? (
                    <Badge tone="good">
                      {f.racing} · {raceLabel(race)}
                    </Badge>
                  ) : (
                    `${f.racing}`
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "2 front-runners, a closer and one nobody has seen run" — the shape of a field so far, in words.
 * The Race Office's whole reason for showing the board (GDD_V3 §7.3) is that this line can change
 * which dog you put in the race.
 */
function fieldShape(styles: readonly (StyleId | null)[]): string {
  if (!styles.length) return 'nobody declared yet';
  const parts: string[] = [];
  for (const id of STYLE_IDS) {
    const k = styles.filter((st) => st === id).length;
    if (!k) continue;
    const name = STYLE_BY_ID[id].name.toLowerCase();
    parts.push(k === 1 ? `a ${name}` : `${k} ${name}s`);
  }
  const unknown = styles.filter((st) => !st).length;
  if (unknown)
    parts.push(unknown === 1 ? 'one nobody has seen run' : `${unknown} nobody has seen run`);
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0]!;
}

/**
 * GDD_V3 §7.3, as Phase T rewrote it (T1, Jesse's call): **everybody declares at once, sealed.** A
 * stable sees its own entries and nobody else's until the last stable has finished its weekend; then
 * the whole card is public at the lock, before the Bookie. What a stable *can* read is every rival's
 * kennel — who is fit, how they run — so guessing the field is the skill where reading it was.
 *
 * ⚠️ V16 (`v3c`–`v3s`) had declarations in turn order and public as they were made, so the last
 * stable saw the field; that needed turn order, which went at `v3t`. Hotseat never shows another
 * human's entries before the lock: the state has them, and this screen does not draw them.
 */
export function RaceOffice({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const dogs = ownedDogs(s, me);
  const entry = s.calendar[s.week - 1];
  const major = entry?.major ?? false;
  const planet = planetOf(s.planet.planetId);
  const sp = planet.special;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const trip = planet.track.length;

  const card = thisWeeksCard();
  const declare = (race: RaceTypeId, dogId: string) =>
    dispatch({ t: 'Declare', playerId: me.id, race, dogId: dogId || null });

  return (
    <>
      <Guide id="office">
        Pick a dog for each race. The bigger the purse, the tougher the field.
      </Guide>
      <Panel
        title="Race Office"
        actions={
          <span className="muted">
            {dogs.filter((d) => d.injuryWeeks === 0).length} of {dogs.length} dogs fit to run
          </span>
        }
      >
        {/* Phase P: one line on the screen — the track, and the weekend if it is a big one — and the
            rest of what the Race Office used to say out loud behind the "?". */}
        <div className="oneline">
          {trackLine(planet.track)}
          {entry?.grandFinal
            ? ` The Grand Final: purses ×${balance.finalMult}.`
            : major
              ? ` A Major: purses ×${balance.majorMult}, and the locals are better.`
              : ''}{' '}
          <More label="How declaring works">
            <Notes
              lines={[
                'Everybody declares at once, and every entry is sealed until the last stable is done: you see your own, and the whole card goes up together before the Bookie opens. What you can see is every rival’s kennel — who is fit to run and how they run. Empty traps are filled by local dogs.',
                `${planet.name}: ${trackText(planet.track)}.`,
                planet.track.hazard !== 1
                  ? `A hazardous surface — injury risk ×${planet.track.hazard} on top of the base ${pct(balance.injuryBase)} a race.`
                  : null,
                planet.track.mud ? 'Mudlarks love it here.' : null,
                planet.track.slippery ? 'Slippery: acceleration counts for more than usual.' : null,
                planet.track.length === 'sprint'
                  ? 'A sprint: a dog barely gets to tire over 350 m, so front-runners come into their own and closers run out of track.'
                  : planet.track.length === 'staying'
                    ? 'A staying trip: 600 m finds out every dog’s stamina, and a closer has time to come back at the front-runners.'
                    : null,
                planet.track.bends === 'none'
                  ? 'No bends at all: the draw is a starting position and nothing more.'
                  : planet.track.bends === 'tight'
                    ? 'Tight bends: the rail is the short way round and where the traffic is, so the draw matters most here — and a dog needs the trap craft to hold the inside line.'
                    : 'The draw counts for something on these bends: inside is shorter, outside is cleaner.',
                major && !entry?.grandFinal
                  ? `A Major: Showboats lift, and the locals are ${balance.localRatingMajorBonus} points better.`
                  : null,
                sp.purseMult ? `${planet.name} adds ×${sp.purseMult} to every purse.` : null,
                sp.winningsTax ? `${pct(sp.winningsTax)} of any prize money is taxed here.` : null,
                `A run costs ${balance.fitnessPerRace} fitness and a rest returns ${balance.fitnessRest}; below ${balance.fitnessScaleBelow} every stat is scaled down. A dog you do not declare rests.`,
              ]}
            />
          </More>
        </div>
        <WeekLedger s={s} me={me} dogs={dogs} />
        {dogs.some((d) => d.injuryWeeks > 0) ? (
          <p className="event-detail">
            A dog on layoff cannot be declared. A vet behind the Pound — or a riskier one in the
            Back Alley — can shorten a layoff.
          </p>
        ) : null}
      </Panel>
      <BoxChooser s={s} me={me} />
      <Whispers s={s} me={me} where="a knock on your own dog is a reason to rest it" />

      <div className="grid3">
        {card.map((race) => {
          const purse = purseFor(s, race);
          const mine = s.declarations[race][me.id] ?? '';
          // Phase T: the rivals' entries are sealed until the lock. What is public is who could run:
          // each rival's sound dogs, rated, with their styles.
          const rivals = s.turnOrder
            .filter((id) => id !== me.id)
            .map((id) => s.players.find((p) => p.id === id)!)
            .map((p) => ({
              p,
              dogId: s.locked ? s.declarations[race][p.id] : undefined,
              fit: ownedDogs(s, p).filter((d) => d.injuryWeeks === 0),
            }));
          const declaredHere = rivals.filter((r) => r.dogId).length + (mine ? 1 : 0);
          const shape = fieldShape(
            rivals
              .map((r) => (r.dogId ? s.dogs[r.dogId] : undefined))
              .filter((d): d is Dog => !!d)
              .map(publicStyle),
          );

          return (
            <TicketCard
              key={race}
              cls={raceLabel(race)}
              tone={raceTone(race)}
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
                    const f = fitnessOutlook(d, restBonus(me));
                    const st = publicStyle(d);
                    return (
                      <option key={d.id} value={d.id} disabled={!!bad}>
                        {d.name} · {d.rating}
                        {st ? ` · ${STYLE_BY_ID[st].name.toLowerCase()}` : ''} · fit {f.now} →{' '}
                        {f.racing} if it runs
                        {bad ? ` — ${bad}` : ''}
                        {!bad && other && other !== race ? ` — in the ${raceLabel(other)}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              {mine && s.dogs[mine] ? (
                <p className="tight-p runner-line">
                  <DogThumb dog={s.dogs[mine]!} big />
                  <StyleTag style={publicStyle(s.dogs[mine]!)} />
                  <Traits ids={s.dogs[mine]!.traits} />
                  <span className="muted">fitness {s.dogs[mine]!.fitness}</span>
                </p>
              ) : null}

              <p className="tight-p">
                {s.locked ? (
                  <>
                    <b>The field:</b> {shape}.
                  </>
                ) : (
                  <>
                    <b>Sealed:</b> nobody sees the field until everybody is done.
                  </>
                )}
                {(() => {
                  const lean = STYLE_IDS.filter((id) => STYLE_BY_ID[id].bookEdge[trip] > 0);
                  return lean.length && trip !== 'standard' ? (
                    <span className="muted">
                      {' '}
                      This trip suits{' '}
                      {lean.map((id) => `${STYLE_BY_ID[id].name.toLowerCase()}s`).join(' and ')}.
                    </span>
                  ) : null;
                })()}
              </p>
              <p className="muted tight-p">
                {s.locked
                  ? `+ ${Math.max(0, TRAPS - declaredHere)} locals, rated about ${localRatingFor(race, major)}`
                  : `Empty traps go to locals rated about ${localRatingFor(race, major)}`}
              </p>

              <table className="rivals">
                <tbody>
                  {rivals.map(({ p, dogId, fit }) => {
                    const dog = dogId ? s.dogs[dogId] : undefined;
                    return (
                      <tr key={p.id}>
                        <td>
                          <StableName player={p} />
                        </td>
                        <td>
                          {dog ? (
                            <>
                              {dog.name} <Badge>{dog.rating}</Badge>{' '}
                              <StyleTag style={publicStyle(dog)} />
                            </>
                          ) : s.locked ? (
                            <span className="muted">no runner</span>
                          ) : (
                            <span className="muted" title="Sealed until everybody is done">
                              could run{' '}
                              {fit.length
                                ? fit
                                    .map(
                                      (d) =>
                                        `${d.rating}${publicStyle(d) ? ` ${STYLE_BY_ID[publicStyle(d)!].name.toLowerCase()}` : ''}`,
                                    )
                                    .join(', ')
                                : 'nobody'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TicketCard>
          );
        })}
      </div>
    </>
  );
}
