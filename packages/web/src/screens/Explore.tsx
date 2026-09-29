import { planetOf, type DoorCategory, type GameState, type Player } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { NeonButton } from '../components/NeonButton';
import { Notes } from '../components/ui';
import { doorArt } from '../lib/assets';
import { useKeys } from '../lib/keys';
import { useGame } from '../store/gameStore';
import { LastSlips } from './Results';

/** What each kind of door is called in general, under the planet's own name for it (GDD_V3 §9.1). */
export const DOOR_KIND: Record<DoorCategory, { label: string; offers: string }> = {
  pound: { label: 'The Pound', offers: 'dogs — offers, strays, a vet' },
  bar: { label: 'The Bar', offers: 'talk — next week’s prices, race-day whispers' },
  alley: { label: 'The Back Alley', offers: 'trouble — stolen goods, whispers bought, risks' },
  strip: { label: 'The Strip', offers: 'money and food — sponsors, card games, fines' },
  track: { label: 'The Track', offers: 'racing — trials, gallops, a coach, a match' },
};

/**
 * GDD_V3 §2.3 step 2, §9.1 — Explore: **three doors, in the planet's own voice; pick one.**
 *
 * It is the first thing on a new planet, before the market, and it is the whole of the arrival's
 * cost in clicks: one press on a door. A card with a choice then asks for a second (EventModal); a
 * card without one resolves on the spot and the hub reads it back under "Behind the door", so a
 * flavour card costs nothing to read. Nobody sees anybody else's door (decision D1).
 */
export function Explore({ s, me }: { s: GameState; me: Player }) {
  const dispatch = useGame((g) => g.dispatch);
  const planet = planetOf(s.planet.planetId);
  // Online (v3l3, §5.1): a door can be picked before this stable's turn. The room holds it, and
  // the card comes when the turn does; until then the doors stay up and say so.
  const early = useGame(
    (g) => g.source === 'online' && !!g.meta && !g.meta.clock.seats.includes(me.id),
  );
  const held = useGame((g) => g.source === 'online' && g.meta?.queued[me.id] === 'door');
  const go = (door: number) => {
    if (!held) dispatch({ t: 'ChooseDoor', playerId: me.id, door });
  };
  useKeys({ '1': () => go(0), '2': () => go(1), '3': () => go(2) });

  return (
    <>
      <LastSlips s={s} me={me} />
      {held ? (
        <div className="notice held">
          <b>Your door is chosen</b>, and you will see what is behind it when your turn comes.
        </div>
      ) : early ? (
        <div className="notice">
          It is not your turn at the doors yet. Pick one now and it is kept for you: where two
          stables want the same one-of-a-kind card, the first in the turn order still gets it.
        </div>
      ) : null}
      <Panel
        title={`Explore ${planet.name}`}
        sub="pick one door — what is behind it is a card, and it is yours alone"
      >
        <div className="doors">
          {planet.exploreDoors.map((d, i) => {
            const art = doorArt(planet.id, d.category);
            return (
              <button
                key={d.category}
                className={`door door-${d.category}`}
                disabled={held}
                onClick={() => go(i)}
              >
                <span className="door-art">
                  {art ? <img src={art.url} alt="" decoding="async" /> : null}
                  {!art || art.placeholder ? <span className="ph">placeholder</span> : null}
                </span>
                <span className="door-name">{d.name}</span>
                <span className="door-kind">
                  {DOOR_KIND[d.category].label} · key {i + 1}
                </span>
                <span className="door-blurb">{d.blurb}</span>
                <span className="door-offers muted">{DOOR_KIND[d.category].offers}</span>
              </button>
            );
          })}
        </div>
        <Notes
          lines={[
            'Everything unpredictable in the game comes through a door: dogs, tips, money, trouble. Every stable picks one, privately; where two want the same one-of-a-kind thing, the first in the turn order gets it.',
          ]}
        />
        <div className="row">
          {planet.exploreDoors.map((d, i) => (
            <NeonButton
              key={d.category}
              variant="default"
              disabled={held}
              onClick={() => go(i)}
              title={`key: ${i + 1}`}
            >
              {d.name}
            </NeonButton>
          ))}
        </div>
      </Panel>
    </>
  );
}
