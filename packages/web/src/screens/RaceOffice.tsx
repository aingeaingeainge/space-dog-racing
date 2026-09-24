import {
  balance,
  formatBones,
  LOAN_RACE,
  planetOf,
  publicStyle,
  purseFor,
  restBonus,
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
import { NeonButton } from '../components/NeonButton';
import { useGame } from '../store/gameStore';

/**
 * GDD_V3 §9.3's bought trap draw, spent: a stable that slipped the steward something in the Back
 * Alley names its box here, once it knows the race. One press on a box (and one on the race, if it
 * has runners in more than one). It is honoured at the lock, if the dog is still declared, and the
 * screen says what a box is worth on this track: about 3.5 points of win rate on tight bends, and
 * nothing on a straight.
 */
function BoxChooser({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const job = s.jobs.find((j) => j.by === me.id && j.kind === 'box');
  if (!job || s.phase !== 'planetPre') return null;
  const bends = planetOf(s.planet.planetId).track.bends;
  const entered = thisWeeksCard().filter((r) => s.declarations[r][me.id]);
  const race = job.race && entered.includes(job.race) ? job.race : entered[entered.length - 1];
  const worth =
    bends === 'tight'
      ? 'Tight bends: the rail (box 1) is the short way round — worth about 3.5 points of win rate.'
      : bends === 'none'
        ? 'A straight: the box is worth nothing here. You paid for it anyway.'
        : `${bends === 'wide' ? 'Wide' : 'Medium'} bends: the inside is worth something, less than on tight ones.`;
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
    <table className="ledger">
      <thead>
        <tr>
          <th>Dog</th>
          <th>Style</th>
          <th>Rating</th>
          <th>Fitness</th>
          <th>If it runs</th>
          <th>If it rests</th>
          <th>This week</th>
        </tr>
      </thead>
      <tbody>
        {dogs.map((d) => {
          const f = fitnessOutlook(d, restBonus(me));
          const barred = cannotRunReason(s, d);
          const race = declaredRace(s, me.id, d.id);
          return (
            <tr key={d.id} className={barred ? 'muted' : undefined}>
              <td>{d.name}</td>
              <td>
                <StyleTag style={publicStyle(d)} />
              </td>
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
 * GDD §15.7, and GDD_V3 §7.3 (V16): **declarations are made in turn order and are public the instant
 * they are made.** The stables ahead of you in the turn order have already declared, and their
 * runners — with their styles, once known — are on the board; the stables behind you will see yours.
 *
 * ⚠️ **v2 hid a human's picks from the other humans until the card locked**, so that hotseat play was
 * not a peeking contest. V16 reverses that on purpose: going first buys the best of a finite shelf,
 * going last buys the right to see the field before you commit a dog to it, and that trade is only
 * real if the board is. Turn order already stops anybody seeing a pick that has not been made.
 */
export function RaceOffice({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const dogs = ownedDogs(s, me);
  const entry = s.calendar[s.week - 1];
  const major = entry?.major ?? false;
  const planet = planetOf(s.planet.planetId);
  const sp = planet.special;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const myTurn = s.turnOrder.indexOf(me.id);
  const trip = planet.track.length;

  const card = thisWeeksCard();
  // GDD_V3 §4.4: a stable short of fit dogs is lent a local for the Bronze Dash, free.
  const loaner = me.loanerId ? s.dogs[me.loanerId] : undefined;
  const declare = (race: RaceTypeId, dogId: string) =>
    dispatch({ t: 'Declare', playerId: me.id, race, dogId: dogId || null });

  return (
    <>
      <Panel
        title="Race Office"
        sub="one runner per race, any dog in any race; declared in turn order, public as they are made"
        actions={
          <span className="muted">
            {dogs.filter((d) => d.injuryWeeks === 0).length} of {dogs.length} dogs fit to run
          </span>
        }
      >
        <p className="muted first">
          Stables declare in turn order and every declaration is public the moment it is made — so
          the later you go, the more of each field you can see before you commit. Empty traps are
          filled by local dogs, whose styles are on the form guide at the lock.
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
              ? 'A sprint: a dog barely gets to tire over 350 m, so front-runners come into their own and closers run out of track.'
              : planet.track.length === 'staying'
                ? 'A staying trip: 600 m finds out every dog’s stamina, and a closer has time to come back at the front-runners.'
                : null,
            planet.track.bends === 'none'
              ? 'No bends at all: the draw is a starting position and nothing more.'
              : planet.track.bends === 'tight'
                ? 'Tight bends: the rail is the short way round and where the traffic is, so the draw matters most here — and a dog needs the trap craft to hold the inside line.'
                : 'The draw counts for something on these bends: inside is shorter, outside is cleaner.',
            entry?.grandFinal
              ? `The Grand Final — purses ×${balance.finalMult}.`
              : major
                ? `A Major — purses ×${balance.majorMult}, Showboats lift, and the locals are ${balance.localRatingMajorBonus} points better.`
                : null,
            sp.purseMult ? `${planet.name} adds ×${sp.purseMult} to every purse.` : null,
            sp.winningsTax ? `${pct(sp.winningsTax)} of any prize money is taxed here.` : null,
            `A run costs ${balance.fitnessPerRace} fitness and a rest returns ${balance.fitnessRest}; below ${balance.fitnessScaleBelow} every stat is scaled down. What you enter this weekend is what you cannot enter next.`,
          ]}
        />
        <WeekLedger s={s} me={me} dogs={dogs} />
        {loaner ? (
          <p className="event-detail">
            You are short of fit dogs, so the track lends you <b>{loaner.name}</b> (rated{' '}
            {loaner.rating}, a {STYLE_BY_ID[loaner.style].name.toLowerCase()}) for the{' '}
            {raceLabel(LOAN_RACE)}. It runs in your colours and you keep the prize; it goes back at
            the end of the weekend and is nobody&apos;s asset.
          </p>
        ) : null}
      </Panel>
      <BoxChooser s={s} me={me} />
      <Whispers s={s} me={me} where="a knock on your own dog is a reason to rest it" />

      <div className="grid3">
        {card.map((race) => {
          const purse = purseFor(s, race);
          const mine = s.declarations[race][me.id] ?? '';
          // The board, in the order the stables declare (GDD_V3 §7.3).
          const rivals = s.turnOrder
            .filter((id) => id !== me.id)
            .map((id) => s.players.find((p) => p.id === id)!)
            .map((p) => ({
              p,
              dogId: s.declarations[race][p.id],
              after: s.turnOrder.indexOf(p.id) > myTurn,
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
                  {loaner && race === LOAN_RACE ? (
                    <option value={loaner.id}>
                      {loaner.name} · {loaner.rating} · the lent local runner
                    </option>
                  ) : null}
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
                <p className="tight-p">
                  <DogThumb dog={s.dogs[mine]!} big />
                  <StyleTag style={publicStyle(s.dogs[mine]!)} />
                  <Traits ids={s.dogs[mine]!.traits} />
                  <span className="muted">
                    fitness {s.dogs[mine]!.fitness} · form {s.dogs[mine]!.form}
                  </span>
                </p>
              ) : null}

              <p className="tight-p">
                <b>In so far:</b> {shape}.
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
                {declaredHere} declared · {Math.max(0, TRAPS - declaredHere)} local dogs will fill
                the rest, rating about {localRatingFor(race, major)}
              </p>

              <table className="rivals">
                <tbody>
                  {rivals.map(({ p, dogId, after }) => {
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
                          ) : after && !s.locked ? (
                            <span className="muted">declares after you</span>
                          ) : (
                            <span className="muted">no runner</span>
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
