import { useState } from 'react';
import { formatBones, type AiAgent, type GameLength } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { NeonButton } from '../components/NeonButton';
import { Notes, Swatch } from '../components/ui';
import { portraitArt } from '../lib/assets';
import { HUMAN_FACES, humanFaceStem } from '../lib/owners';
import { useGame } from '../store/gameStore';
import { roomLink, type LobbySeat } from '../store/online';
import { FaceButton, FacePicker, GameLengthPicker } from './Title';

/**
 * **The lobby** (ONLINE_PLAN §5.5, §6 item 1, V28): a link and a code, a name at the door, no
 * accounts. "Play online" on the Title opens the door — create a room, or join one by its code — and
 * `?room=KFZQPX` in the URL opens the join straight away. The room's code and link are shown big, to
 * read aloud; the seats fill in as people sit down, "away" beside a browser that has closed; and the
 * host sets the length and the AI rows and presses Start.
 *
 * A browser that holds a token for the room never sees any of this: it goes straight back into its
 * seat, in the lobby or in the game (store/gameStore.ts, `hello`).
 */
const MIN_STABLES = 3;
const MAX_STABLES = 8;
const DIFFICULTY_LABEL: Record<AiAgent, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export function Lobby() {
  const code = useGame((g) => g.code);
  const seat = useGame((g) => g.seat);
  const lobby = useGame((g) => g.lobby);
  const stale = useGame((g) => g.stale);
  const error = useGame((g) => g.error);
  const clearError = useGame((g) => g.clearError);
  const conn = useGame((g) => g.conn);

  let body;
  if (!code) body = <TheDoor />;
  else if (stale) body = <StaleRoom />;
  else if (!seat) {
    if (!lobby)
      body = <Waiting text={conn === 'down' ? 'Cannot reach the room — retrying…' : 'Knocking…'} />;
    else if (lobby.started) body = <Started />;
    else body = <SitDown />;
  } else if (lobby && !lobby.started) body = <TheTable />;
  else body = <Waiting text="Taking your seat…" />;

  return (
    <div className="app lobby">
      <div className="centre">
        <h1>Space Dog Racing</h1>
        <p className="muted tagline">Online — one room, a browser each, no accounts.</p>
      </div>
      {error ? (
        <div className="notice error" onClick={clearError}>
          {error} <span className="muted">(click to dismiss)</span>
        </div>
      ) : null}
      {body}
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  const leaveRoom = useGame((g) => g.leaveRoom);
  return (
    <Panel title="The room" sub={text}>
      <div className="row">
        <span className="muted">{text}</span>
        <span className="spacer" />
        <NeonButton onClick={leaveRoom}>Back to the title</NeonButton>
      </div>
    </Panel>
  );
}

/** Create a room, or join one with its code. */
function TheDoor() {
  const createRoom = useGame((g) => g.createRoom);
  const joinRoom = useGame((g) => g.joinRoom);
  const openLobby = useGame((g) => g.openLobby);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Panel title="Create a room" sub="you are the host: you set the table and press Start">
        <WhoAreYou
          taken={[]}
          action={busy ? 'Making the room…' : 'Create the room'}
          disabled={busy}
          onGo={(name, colour) => {
            setBusy(true);
            void createRoom(name, colour).finally(() => setBusy(false));
          }}
        />
      </Panel>
      <Panel title="Join a room" sub="the six letters your host read out, or open their link">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            joinRoom(code);
          }}
        >
          <label>
            Room code{' '}
            <input
              className="room-code-input"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="KFZQPX"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
          </label>
          <NeonButton variant="primary" type="submit" disabled={code.length !== 6}>
            Join
          </NeonButton>
        </form>
      </Panel>
      <div className="row centre-row">
        <NeonButton onClick={() => openLobby(false)}>Back to the title</NeonButton>
      </div>
    </>
  );
}

/**
 * A name and a face (the Title's picker). Faces another human holds are shown taken, from the
 * room's `lobby`; the first face free is picked to start with.
 */
function WhoAreYou({
  taken,
  action,
  disabled,
  onGo,
}: {
  taken: LobbySeat[];
  action: string;
  disabled?: boolean;
  onGo: (name: string, colour: number) => void;
}) {
  const holder = (c: number) =>
    taken.find((x) => x.kind === 'human' && x.colour === c)?.name ?? null;
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const firstFree = HUMAN_FACES.findIndex((_, c) => !holder(c));
  const colour = picked !== null && !holder(picked) ? picked : firstFree;
  const clean = name.trim();
  const ok = clean.length > 0 && clean.length <= 24 && colour >= 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !disabled) onGo(clean, colour);
      }}
    >
      <div className="row gap-b">
        <label>
          Your name{' '}
          <input
            value={name}
            maxLength={24}
            placeholder="Aroha"
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <span className="lobby-face">
          <FaceButton
            colour={Math.max(0, colour)}
            open={picking}
            onClick={() => setPicking(!picking)}
          />
          <span className="muted">
            {colour >= 0 ? `${HUMAN_FACES[colour]!.colour} — pick your face` : ''}
          </span>
        </span>
      </div>
      {picking ? (
        <FacePicker
          who={clean || 'you'}
          current={colour}
          takenBy={holder}
          onPick={setPicked}
          onClose={() => setPicking(false)}
        />
      ) : null}
      <div className="row gap-t">
        <NeonButton variant="primary" type="submit" disabled={!ok || disabled}>
          {action}
        </NeonButton>
        {colour < 0 ? <span className="muted">Every face is taken: the table is full.</span> : null}
      </div>
    </form>
  );
}

function FaceChip({ colour }: { colour: number }) {
  const face = HUMAN_FACES[colour % 8]!;
  const art = portraitArt(humanFaceStem(colour));
  return (
    <span className="face-chip" title={`${face.colour} — ${face.who}`}>
      {art && !art.placeholder ? <img src={art.url} alt="" decoding="async" /> : null}
      <Swatch colour={colour} />
    </span>
  );
}

/** At the door of a room not yet started: the code, who is in, and a name and a face to sit down. */
function SitDown() {
  const code = useGame((g) => g.code)!;
  const lobby = useGame((g) => g.lobby)!;
  const sitDown = useGame((g) => g.sitDown);
  const leaveRoom = useGame((g) => g.leaveRoom);
  const full = lobby.seats.length >= MAX_STABLES;
  return (
    <>
      <RoomCode code={code} />
      <Seats seats={lobby.seats} host={lobby.host} me={null} />
      <Panel title="Sit down" sub="a name and a face — your face is your saddle-cloth colour">
        {full ? (
          <p className="muted">This table is full.</p>
        ) : (
          <WhoAreYou taken={lobby.seats} action="Sit down" onGo={sitDown} />
        )}
      </Panel>
      <div className="row centre-row">
        <NeonButton onClick={leaveRoom}>Back to the title</NeonButton>
      </div>
    </>
  );
}

function Started() {
  const leaveRoom = useGame((g) => g.leaveRoom);
  return (
    <Panel title="This game has started" sub="only its players can rejoin">
      <p className="muted flush">
        A seat comes back only to the browser that sat in it, from the link it joined with. If that
        was you on another device, open the link there.
      </p>
      <div className="row gap-t">
        <NeonButton onClick={leaveRoom}>Back to the title</NeonButton>
      </div>
    </Panel>
  );
}

/** The code, big, for reading aloud; the link with a Copy button. */
function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const link = roomLink(window.location.href, code);
  const copy = () => {
    try {
      const p = navigator.clipboard?.writeText(link);
      if (!p) return setCopied('failed');
      p.then(
        () => setCopied('yes'),
        () => setCopied('failed'),
      );
    } catch {
      setCopied('failed');
    }
  };
  return (
    <Panel title="The room" sub="read the code out, or send the link">
      <div className="room-code" aria-label={`Room code ${code.split('').join(' ')}`}>
        {code}
      </div>
      <div className="row room-link">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <NeonButton onClick={copy}>{copied === 'yes' ? 'Link copied' : 'Copy the link'}</NeonButton>
      </div>
      {copied === 'failed' ? (
        <p className="muted">The clipboard said no: select the link above and copy it by hand.</p>
      ) : null}
    </Panel>
  );
}

function Seats({ seats, host, me }: { seats: LobbySeat[]; host: string; me: string | null }) {
  const isHost = me !== null && me === host;
  const setTable = useGame((g) => g.setTable);
  const ai = seats.filter((x) => x.kind === 'ai');
  const setAi = (rows: { difficulty: AiAgent }[]) => setTable({ ai: rows });
  return (
    <Panel title="The table" sub={`${seats.length} of ${MAX_STABLES} stables, in seat order`}>
      <div className="table-wrap">
        <table className="lobby-seats">
          <tbody>
            {seats.map((x, i) => (
              <tr key={x.seat} className={x.seat === me ? 'me' : ''}>
                <td className="num">{i + 1}</td>
                <td>
                  <FaceChip colour={x.colour} />
                </td>
                <td>
                  {x.kind === 'human' ? (
                    <>
                      <b>{x.name}</b>
                      {x.seat === host ? <span className="muted"> · host</span> : null}
                      {x.seat === me ? <span className="muted"> · you</span> : null}
                    </>
                  ) : (
                    <span className="muted">An AI stable (named at the start)</span>
                  )}
                </td>
                <td>
                  {x.kind === 'human' ? (
                    x.online ? (
                      <span>here</span>
                    ) : (
                      <span className="muted">away</span>
                    )
                  ) : isHost ? (
                    <select
                      aria-label={`AI ${i + 1} difficulty`}
                      value={x.difficulty ?? 'normal'}
                      onChange={(e) => {
                        const k = ai.indexOf(x);
                        setAi(
                          ai.map((a, j) => ({
                            difficulty: j === k ? (e.target.value as AiAgent) : a.difficulty!,
                          })),
                        );
                      }}
                    >
                      <option value="easy">Easy</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Hard</option>
                    </select>
                  ) : (
                    <span className="muted">{DIFFICULTY_LABEL[x.difficulty ?? 'normal']}</span>
                  )}
                </td>
                <td>
                  {x.kind === 'ai' && isHost ? (
                    <NeonButton
                      variant="link"
                      onClick={() =>
                        setAi(ai.filter((a) => a !== x).map((a) => ({ difficulty: a.difficulty! })))
                      }
                    >
                      remove
                    </NeonButton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isHost ? (
        <div className="row gap-t">
          <NeonButton
            disabled={seats.length >= MAX_STABLES}
            onClick={() =>
              setAi([...ai.map((a) => ({ difficulty: a.difficulty! })), { difficulty: 'normal' }])
            }
          >
            Add an AI
          </NeonButton>
          <span className="muted">
            Easy leaves half the card to the locals; Hard buys gear, prices its own runners and
            doses where it pays.
          </span>
        </div>
      ) : null}
    </Panel>
  );
}

/** Seated, before Start: the code, the seats, and the host's length, AI rows and Start. */
function TheTable() {
  const code = useGame((g) => g.code)!;
  const seat = useGame((g) => g.seat)!;
  const lobby = useGame((g) => g.lobby)!;
  const setTable = useGame((g) => g.setTable);
  const startRoom = useGame((g) => g.startRoom);
  const leaveRoom = useGame((g) => g.leaveRoom);
  const isHost = lobby.host === seat;
  const hostName = lobby.seats.find((x) => x.seat === lobby.host)?.name ?? 'the host';
  const n = lobby.seats.length;
  const humans = lobby.seats.filter((x) => x.kind === 'human').length;
  const why =
    n < MIN_STABLES
      ? `A game needs at least ${MIN_STABLES} stables: add an AI, or wait for a friend.`
      : n > MAX_STABLES
        ? `At most ${MAX_STABLES} stables.`
        : humans < 1
          ? 'A game needs a human.'
          : null;
  // The host's own draft of the length, so typing a target is not a round trip a keystroke; the
  // room's `lobby` is what everybody else sees, and what Start uses.
  const [draft, setDraft] = useState<GameLength | null>(null);
  const length = draft ?? lobby.length;
  const setLength = (l: GameLength) => {
    setDraft(l);
    setTable({ length: l });
  };
  return (
    <>
      <RoomCode code={code} />
      <Seats seats={lobby.seats} host={lobby.host} me={seat} />
      <Panel
        title={isHost ? 'Start the game' : 'Waiting to start'}
        sub={isHost ? 'you are the host' : `${hostName} is the host`}
        actions={
          isHost ? (
            <NeonButton variant="primary" disabled={!!why} onClick={startRoom}>
              Start
            </NeonButton>
          ) : undefined
        }
      >
        {isHost ? (
          <>
            <GameLengthPicker length={length} setLength={setLength} />
            {why ? <p className="muted flush">{why}</p> : null}
          </>
        ) : (
          <p className="flush">
            {length.kind === 'seasons'
              ? `${length.seasons} season${length.seasons === 1 ? '' : 's'}`
              : `A race to ${formatBones(length.worth)}`}
            . <span className="muted">{hostName} presses Start when everybody is in.</span>
          </p>
        )}
        <Notes
          lines={[
            'Each stable plays on its own screen: no passing, no looking away. The shelf and the declarations still go in turn order, so the screen says who everybody is waiting on.',
            'Close the tab and your seat waits for you: the link brings you straight back.',
          ]}
        />
      </Panel>
      <div className="row centre-row">
        <NeonButton onClick={leaveRoom}>Leave the room</NeonButton>
      </div>
    </>
  );
}

/** §7: a room started on an older engine. Its last standings, and no more play. */
function StaleRoom() {
  const stale = useGame((g) => g.stale)!;
  const leaveRoom = useGame((g) => g.leaveRoom);
  return (
    <Panel
      title="This room cannot play on"
      sub={`it was started on an older version of the game (${stale.stateVersion}, now ${stale.engineVersion})`}
    >
      <p className="muted">
        The last standings it kept, season {stale.season} week {stale.week}:
      </p>
      <ol>
        {stale.standings.map((x) => (
          <li key={x.name}>
            {x.name} — {formatBones(x.netWorth)}
          </li>
        ))}
      </ol>
      <NeonButton onClick={leaveRoom}>Back to the title</NeonButton>
    </Panel>
  );
}
