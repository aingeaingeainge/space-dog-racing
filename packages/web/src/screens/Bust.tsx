import { formatBones, isSeasonOver, outstanding, type GameState, type Player } from '@sdr/engine';
import { Panel } from '../components/Panel';
import { OwnerFace } from '../components/Owner';
import { NeonButton } from '../components/NeonButton';
import { StableName } from '../components/ui';
import { humans, standings } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * A human stable that has gone under, told to its face.
 *
 * Until now this was silent. `nextLivePlayer` skips a bankrupt stable, so the instant the last
 * human went bust `drive` played the rest of the season against the AI and handed back a finished
 * one: the screen went from week five to the podium and nothing in between ever said why. Nothing
 * here changes the rule — the engine has always sold your cheapest dogs to cover the bills and
 * called it a day when there were none left. This is the sentence that was missing.
 */
export function Bust({ s, me }: { s: GameState; me: Player }) {
  const ackBust = useGame((g) => g.ackBust);
  const owed = outstanding(me, 'bank') + outstanding(me, 'shark');
  const mine = s.eventLog.filter(
    (l) => l.playerId === me.id && (l.text.includes('Forced sale') || l.text.includes('bankrupt')),
  );
  const week = mine.length ? mine[mine.length - 1]!.week : s.week;
  const others = humans(s).filter((p) => p.id !== me.id && !p.flags.bankrupt);
  const leader = standings(s)[0];
  const over = isSeasonOver(s);

  return (
    <div className="app">
      <div className="centre">
        <h1>Wound up</h1>
        <p className="muted">
          <StableName player={me} /> — out in week {week} of {s.calendar.length}
        </p>
      </div>

      <Panel title="What happened" sub="the bills came in and there was nothing left to sell">
        <div className="row gap-b">
          <OwnerFace player={me} big />
          <p className="flush">
            The stewards have wound the stable up. Your last dogs went to cover upkeep, wages, fuel
            and kibble; with the kennel empty and the cash still short, that is the end of your
            season. You are carrying {owed ? formatBones(owed) : 'nothing'} in debt.
          </p>
        </div>
        {mine.length ? (
          <ul className="notes">
            {mine.slice(-6).map((l, i) => (
              <li key={i}>
                Week {l.week} — {l.text}
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel title="The circuit goes on without you">
        <p className="flush-t">
          {others.length
            ? `${others.length === 1 ? 'One stable' : `${others.length} stables`} at this table ${others.length === 1 ? 'is' : 'are'} still running, so the laptop carries on.`
            : over
              ? 'The remaining stables have played the season out.'
              : 'The remaining stables will play the season out.'}
          {leader ? (
            <>
              {' '}
              <StableName player={leader.player} /> leads on {formatBones(leader.netWorth)}.
            </>
          ) : null}
        </p>
        <div className="row gap-t">
          <NeonButton variant="primary" onClick={() => ackBust(me.id)}>
            {over ? 'See how it finished' : 'Carry on'}
          </NeonButton>
        </div>
      </Panel>
    </div>
  );
}
