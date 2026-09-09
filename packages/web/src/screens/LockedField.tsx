import {
  bettingMargin,
  formatBones,
  planetOf,
  purseFor,
  RACE_CLASSES,
  type GameState,
  type Player,
} from '@sdr/engine';
import { FieldTable } from '../components/FieldTable';
import { Panel } from '../components/Panel';
import { Notes } from '../components/ui';
import { NeonButton } from '../components/NeonButton';
import { TicketCard } from '../components/TicketCard';
import { useKeys } from '../lib/keys';
import { CLASS_LABEL } from '../lib/selectors';
import { useGame } from '../store/gameStore';

/**
 * The card, locked, on a weekend with no bookie — Holy Bark, or a season with No Betting on.
 *
 * Those weekends used to go straight from the planet phase to the race replay, so the one thing
 * every other weekend shows you before the traps open — who is in, out of which box, and what the
 * market makes of them — was the one thing you never saw. Nothing here is a rule: the fields, the
 * trap draw and the prices are all in `s.fields` on every weekend already. On a betting week the
 * bookie's own screen shows the same table with the odds as buttons.
 */
export function LockedField({ s, me }: { s: GameState; me: Player }) {
  const ackFields = useGame((g) => g.ackFields);
  useKeys({ Enter: ackFields, ' ': ackFields });
  const planet = planetOf(s.planet.planetId);
  // The same margin lockDeclarations priced this field with, so these are the stored odds and not
  // a second opinion.
  const margin = bettingMargin(s);
  if (!s.fields) return null;

  return (
    <>
      <Panel
        title="The card is locked"
        sub={`${planet.name} · week ${s.week} — no bookie here`}
        actions={
          <NeonButton variant="primary" onClick={ackFields} title="key: Enter">
            Watch the races
          </NeonButton>
        }
      >
        <Notes
          lines={[
            s.toggles.betting
              ? `${planet.name} has no bookie, so there is nothing to back this weekend — but this is still the field you are running into.`
              : 'No Betting is on for this season, so the prices below are only the market talking.',
            'Traps are drawn. Wide runners are pushed to the outside boxes and a bribed steward has already had his say.',
          ]}
        />
      </Panel>

      {RACE_CLASSES.map((cls) => {
        const purse = purseFor(s, cls);
        return (
          <TicketCard
            key={cls}
            cls={CLASS_LABEL[cls]}
            tone={cls}
            cap="trap draw and prices"
            purse={formatBones(purse[0])}
            serial={`2nd ${formatBones(purse[1])} · 3rd ${formatBones(purse[2])}`}
          >
            <FieldTable s={s} meId={me.id} field={s.fields![cls]} margin={margin} />
          </TicketCard>
        );
      })}
    </>
  );
}
