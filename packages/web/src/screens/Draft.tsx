import { useEffect, useState } from 'react';
import {
  ageFactor,
  balance,
  currentDraft,
  decideDraft,
  dogValue,
  draftRoom,
  formatBones,
  restRateFor,
  staffRow,
  STYLE_BY_ID,
  type Action,
  type Dog,
  type DraftPickRecord,
  type DraftState,
  type GameState,
  type Id,
  type Player,
} from '@sdr/engine';
import { Panel } from '../components/Panel';
import { NeonButton } from '../components/NeonButton';
import { DogCard } from '../components/DogCard';
import { StaffCard } from '../components/StaffCard';
import { OwnerFace } from '../components/Owner';
import { Notes, StableName } from '../components/ui';
import { More } from '../components/More';
import { Guide } from '../components/Guide';
import { useKeys } from '../lib/keys';
import { playerById } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * **The draft** (GDD_V3 V29–V33, v3 Phase N): the game's opening draft and every off-season's one
 * round, on one **public** screen — nobody passes the laptop for it, as for the arrival and race day
 * (E8). The board is two lists (dogs, trainers), the pick order is laid out round by round with the
 * stable on the clock lit, and every stable's picks so far sit beside it.
 *
 * A human's pick is **two presses**: the item, then "Take *name*" (or, in the off-season with a full
 * kennel or full staff, "Retire *dog* and take *name*" — which dog to retire is the second press). A
 * pass is one. AI picks land one at a time with a short beat so the table sees them; "Skip" shows them
 * all at once. Keys: ↑/↓ move through the lists, Enter takes, P passes, S skips.
 *
 * Online the same screen, and only the seat on the clock may press; everybody else watches the picks
 * land and reads the waiting line above it.
 */
export function Draft({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const online = useGame((g) => g.source === 'online');
  const d = currentDraft(s);
  const picks = d?.picks.length ?? 0;
  const [shown, setShown] = useState(0);
  const [sel, setSel] = useState<{ dog: Id } | { staff: Id } | null>(null);
  /**
   * Phase P (Jesse's call, P1): "Pick for me" — the rest of this human's picks, made as a Normal AI
   * would, through the same `DraftPick` a press makes. Held per human, so at a hotseat table one
   * human handing over does not hand over the next.
   */
  const [auto, setAuto] = useState<Id | null>(null);

  // The beat: one AI pick every 700 ms. A human's own pick needs no beat — they just made it.
  useEffect(() => {
    if (!d || shown >= picks) return;
    const next = d.picks[shown]!;
    const human = playerById(s, next.playerId)?.kind === 'human';
    if (human) {
      setShown(shown + 1);
      return;
    }
    // Picking for me: no beat — the table is not watching a draft its human handed over.
    if (auto !== null) {
      setShown(picks);
      return;
    }
    const t = setTimeout(() => setShown(shown + 1), 700);
    return () => clearTimeout(t);
  }, [d, shown, picks, s, auto]);
  // A new draft (the next off-season) starts the count again.
  useEffect(() => {
    if (shown > picks) setShown(0);
  }, [shown, picks]);

  const catching = shown < picks;
  const board = d ? boardAt(s, d, Math.min(shown, picks)) : { dogs: [], staff: [] };
  const onId = d ? (catching ? d.order[shown] : d.order[d.at]) : undefined;
  const on = onId ? playerById(s, onId) : undefined;
  const mine = !!on && !catching && (online ? on.id === me.id : on.kind === 'human');
  const picker = mine ? on : undefined;
  // A human who handed their picks over has nothing to press until the draft is done.
  const room =
    picker && picker.id !== auto ? draftRoom(s, picker.id) : { dog: false, staff: false };
  const off = d?.kind === 'offSeason';
  const kennel = picker ? picker.dogIds.map((id) => s.dogs[id]!).filter(Boolean) : [];
  const kennelFull = kennel.length >= balance.startDogs;
  const staffFull = (picker?.staff.length ?? 0) >= balance.staffSlots;

  // The selection must be something still on the board, and something this stable may take.
  const selDog = sel && 'dog' in sel ? board.dogs.find((x) => x.id === sel.dog) : undefined;
  const selStaff = sel && 'staff' in sel && board.staff.includes(sel.staff) ? sel.staff : undefined;
  const choice =
    (selDog && room.dog) || (selStaff && room.staff)
      ? selDog
        ? { dog: selDog.id }
        : { staff: selStaff! }
      : null;
  const choiceName = selDog?.name ?? (selStaff ? staffRow(selStaff).name : '');

  const send = (a: Action) => {
    setSel(null);
    dispatch(a);
  };
  const take = (release?: Id) => {
    if (!picker || !choice) return;
    send(
      release === undefined
        ? { t: 'DraftPick', playerId: picker.id, pick: choice }
        : { t: 'DraftPick', playerId: picker.id, pick: choice, release },
    );
  };
  const pass = () => {
    if (picker && off) send({ t: 'DraftPick', playerId: picker.id, pick: null });
  };
  const needsRelease = !!choice && off && ('dog' in choice ? kennelFull : staffFull);
  // ↑/↓ through the items this stable may take, dogs first, then trainers.
  const items: ({ dog: Id } | { staff: Id })[] = [
    ...(room.dog ? board.dogs.map((x) => ({ dog: x.id })) : []),
    ...(room.staff ? board.staff.map((id) => ({ staff: id })) : []),
  ];
  const at = choice ? items.findIndex((x) => JSON.stringify(x) === JSON.stringify(choice)) : -1;
  const move = (k: number) => {
    if (!items.length) return;
    setSel(items[(at + k + items.length) % items.length]!);
  };
  useEffect(() => {
    if (!picker || picker.id !== auto) return;
    const a = decideDraft(s, picker.id, 'normal')[0];
    if (a) {
      setSel(null);
      dispatch(a);
    }
    // The pick count is in the deps because the state may be the same object between picks.
  }, [auto, picker, s, dispatch, d?.at, catching]);
  useKeys({
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    Enter: () => {
      if (!needsRelease) take();
    },
    p: pass,
    s: () => setShown(picks),
  });

  if (!d) return null;
  const n = s.players.length;
  const pickForMe = () => {
    if (picker) setAuto(picker.id);
  };
  const title = off ? 'The off-season draft' : 'The draft';

  return (
    <>
      <div className="centre">
        <h1>{title}</h1>
        <p className="muted">
          {off
            ? `Between season ${d.season - 1} and season ${d.season} · one pick each · last at the table picks first`
            : 'Four dogs and two trainers each, one at a time, in turns.'}
        </p>
      </div>

      {off ? <OffSeasonNews s={s} /> : null}
      {picker && !off ? (
        <Guide id="draft">
          Press a dog or a trainer, then <b>Take</b> — or <b>Pick for me</b> and get racing.
        </Guide>
      ) : null}

      <div className="draft-clock">
        {catching ? (
          <p>
            <b>{on?.name}</b> is picking…{' '}
            <NeonButton small onClick={() => setShown(picks)} title="key: S">
              Skip
            </NeonButton>
          </p>
        ) : picker ? (
          <p>
            <OwnerFace player={picker} /> <b>{picker.name}</b>, your pick
            {off ? '' : ` — round ${Math.floor(d.at / n) + 1} of ${d.rounds}`}.{' '}
            {!room.dog
              ? 'Your kennel is full: a trainer.'
              : !room.staff && !off
                ? 'Your staff is full: a dog.'
                : ''}
          </p>
        ) : on ? (
          <p className="muted">Waiting on {on.name}.</p>
        ) : null}
      </div>

      {picker && picker.id === auto ? (
        <div className="draft-take">
          <span className="muted">Picking for you…</span>
        </div>
      ) : picker ? (
        <div className="draft-take">
          {choice && !needsRelease ? (
            <NeonButton variant="primary" onClick={() => take()} title="key: Enter">
              Take {choiceName}
            </NeonButton>
          ) : null}
          {choice && needsRelease && 'dog' in choice
            ? kennel.map((x) => (
                <NeonButton key={x.id} variant="primary" onClick={() => take(x.id)}>
                  Retire {x.name} ({formatBones(dogValue(x))}) and take {choiceName}
                </NeonButton>
              ))
            : null}
          {choice && needsRelease && 'staff' in choice
            ? picker.staff.map((id) => (
                <NeonButton key={id} variant="primary" onClick={() => take(id)}>
                  Let {staffRow(id).name} go and take {choiceName}
                </NeonButton>
              ))
            : null}
          {!choice ? <span className="muted">Press a dog or a trainer below.</span> : null}
          <NeonButton onClick={pickForMe} title="The rest of your picks, made as a Normal AI would">
            Pick for me
          </NeonButton>
          {off ? (
            <NeonButton onClick={pass} title="key: P">
              Pass
            </NeonButton>
          ) : null}
        </div>
      ) : null}

      <div className="draft-grid">
        <div className="draft-board">
          <Panel title={`Dogs (${board.dogs.length})`} sub="strongest first">
            <div className="dogcards">
              {board.dogs.map((x) => {
                const picked = !!selDog && selDog.id === x.id;
                return (
                  <button
                    key={x.id}
                    type="button"
                    className={`draft-item${picked ? ' picked' : ''}`}
                    disabled={!room.dog}
                    onClick={() => setSel({ dog: x.id })}
                    aria-pressed={picked}
                  >
                    <DogCard
                      dog={x}
                      declared={picked}
                      unraced
                      sub={off ? `age ${x.age} · ${formatBones(dogValue(x))}` : `age ${x.age}`}
                    />
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel title={`Trainers (${board.staff.length})`} sub="each takes a cut of your purses">
            {board.staff.length ? (
              <div className="staffcards">
                {board.staff.map((id) => {
                  const picked = selStaff === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`draft-item${picked ? ' picked' : ''}`}
                      disabled={!room.staff}
                      onClick={() => setSel({ staff: id })}
                      aria-pressed={picked}
                    >
                      <StaffCard row={staffRow(id)} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Nobody left on the board.</p>
            )}
          </Panel>
        </div>

        <div className="draft-side">
          <PickOrder s={s} d={d} upTo={Math.min(shown, picks)} />
          <Stables s={s} d={d} upTo={Math.min(shown, picks)} />
        </div>
      </div>

      <More label="How the draft works">
        <Notes
          lines={[
            off
              ? 'Take a dog and one of yours retires, paid its book value. Take a trainer with two already and one goes. Or pass. Everything carries over; the new season starts every dog on full fitness.'
              : `A pick is one dog or one trainer. Four dogs and two trainers each: a full kennel takes trainers, full staff takes dogs. ${balance.draftThirdRoundReverses === 1 ? 'Round 1’s order is drawn and each round turns it round — except round 3, which goes the same way as round 2, so the first pick is not also first in the trainers’ rounds.' : 'Round 1’s order is drawn, and each round turns it round.'} Every style on the board is public, and stays public.`,
          ]}
        />
      </More>
    </>
  );
}

/** The board as it stood after `upTo` picks: today's board with the later picks put back. */
function boardAt(s: GameState, d: DraftState, upTo: number): { dogs: Dog[]; staff: Id[] } {
  const later = d.picks.slice(upTo);
  const dogs = [
    ...d.dogs,
    ...later.map((x) => (x.dog ? s.dogs[x.dog.id] : undefined)).filter((x): x is Dog => !!x),
  ];
  const staff = [...d.staff, ...later.map((x) => x.staff).filter((x): x is Id => !!x)];
  dogs.sort((a, b) => b.rating - a.rating || (a.name < b.name ? -1 : 1));
  staff.sort((a, b) => (staffRow(a).name < staffRow(b).name ? -1 : 1));
  return { dogs, staff };
}

function pickText(x: DraftPickRecord): string {
  if (x.dog)
    return `${x.dog.name} (${x.dog.rating}, ${STYLE_BY_ID[x.dog.style].name.toLowerCase()})`;
  if (x.staff) return staffRow(x.staff).name;
  return 'passed';
}

/** The snake, round by round: faces, whose turn it is, and what each pick took. */
function PickOrder({ s, d, upTo }: { s: GameState; d: DraftState; upTo: number }) {
  const n = s.players.length;
  // Phase P: the round being picked, not all six — the snake is in the "?" under the board.
  const current = Math.min(Math.floor(upTo / n), d.rounds - 1);
  const rounds = [d.order.slice(current * n, (current + 1) * n)];
  return (
    <Panel
      title="Pick order"
      sub={d.kind === 'offSeason' ? 'last at the table picks first' : undefined}
    >
      <ol className="draft-order">
        {rounds.map((round, r) => (
          <li key={r}>
            {d.rounds > 1 ? (
              <span className="muted small">
                Round {current + r + 1} of {d.rounds}
              </span>
            ) : null}
            <ul>
              {round.map((id, k) => {
                const i = (current + r) * n + k;
                const p = playerById(s, id)!;
                const done = i < upTo;
                const now = i === upTo;
                return (
                  <li key={i} className={now ? 'now' : done ? 'done' : ''}>
                    <OwnerFace player={p} /> <StableName player={p} />
                    <span className="muted small">
                      {done ? ` — ${pickText(d.picks[i]!)}` : now ? ' — on the clock' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** Every stable's picks so far in this draft. */
function Stables({ s, d, upTo }: { s: GameState; d: DraftState; upTo: number }) {
  const seen = d.picks.slice(0, upTo);
  const order = d.order.slice(0, s.players.length);
  return (
    <Panel title="The stables" sub={d.kind === 'offSeason' ? 'this off-season' : 'picked so far'}>
      <ul className="draft-stables">
        {order.map((id) => {
          const p = playerById(s, id)!;
          const got = seen.filter((x) => x.playerId === id);
          const dogs = got.filter((x) => x.dog);
          const staff = got.filter((x) => x.staff);
          return (
            <li key={id}>
              <StableName player={p} />
              <span className="small">
                {dogs.length
                  ? dogs.map((x) => `${x.dog!.name} ${x.dog!.rating}`).join(' · ')
                  : d.kind === 'offSeason'
                    ? ''
                    : 'no dogs yet'}
                {staff.length ? ` · ${staff.map((x) => staffRow(x.staff!).name).join(' · ')}` : ''}
                {d.kind === 'offSeason' && got.length && !dogs.length && !staff.length
                  ? 'passed'
                  : ''}
                {got[0]?.released?.dog
                  ? ` (retired ${got[0].released.dog.name}, ${formatBones(got[0].released.dog.paid)})`
                  : got[0]?.released?.staff
                    ? ` (let ${staffRow(got[0].released.staff).name} go)`
                    : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The off-season's news, read before the board: every dog a year older, and who has left. */
function OffSeasonNews({ s }: { s: GameState }) {
  const left = Object.entries(s.offSeason?.notices ?? {}).filter(([, x]) => x.left.length);
  return (
    <Panel title="A year older" sub="every dog on the circuit ages once, now">
      <ul className="draft-stables">
        {s.players.map((p) => (
          <li key={p.id}>
            <StableName player={p} />
            <span className="small">
              {p.dogIds
                .map((id) => s.dogs[id])
                .filter((x): x is Dog => !!x)
                .map((x) => `${x.name} ${x.age}`)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      <Notes
        lines={[
          ageLine(2),
          ageLine(4),
          ageLine(5),
          left.length
            ? `The staff notice: ${left
                .map(
                  ([id, x]) =>
                    `${x.left.map((t) => staffRow(t).name).join(' and ')} left ${playerById(s, id)?.name}`,
                )
                .join('; ')}.`
            : 'The staff notice: every trainer is staying.',
        ]}
      />
    </Panel>
  );
}

/** §4.3 in a line: what this age does to a dog's week and its price. */
function ageLine(age: number): string {
  const band = age <= 2 ? 'Up to 2' : age <= 4 ? '3–4' : '5 and over';
  const growth = age <= 2 ? '+1 stat a week' : age <= 4 ? 'holds its stats' : '−1 stat a week';
  return `${band}: ${growth}; rests back ${restRateFor(age)} a week; book value ×${ageFactor(age)}.`;
}
