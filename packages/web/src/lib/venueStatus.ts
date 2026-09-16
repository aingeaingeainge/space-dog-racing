import {
  balance,
  cargoTotal,
  HOLD_CAP,
  KIBBLE_ID,
  formatBones,
  planetOf,
  weekStatusOf,
  thisWeeksCard,
  dogValue,
  OPEN_TYPE_ID,
  RACE_TYPE_IDS,
  type GameState,
  type Player,
  type RaceTypeId,
} from '@sdr/engine';
import { declaredCount, ineligibleReason, ownedDogs, raceLabel, TRAPS } from './selectors';
import type { VenueId } from './venues';

export interface VenueStatus {
  /** One line of what is actually in there this week, for the tab strip and the hub's list. */
  line: string;
  /** Two or three words of the same thing, for the hotspot on the backdrop. */
  short: string;
  /**
   * Is there anything here this player can do this week? PLAYTEST_NOTES finding 4 is that a
   * season is a lot of clicks, and most of them are spent opening a venue to discover it has
   * nothing in it. Every venue answers this from state the screens already read, so the hub
   * can say it before you walk in. It never hides or disables anything — a venue you can
   * still walk into stays open, it just stops asking for a click.
   */
  worth: boolean;
}

const nothing = (line: string, short = 'nothing today'): VenueStatus => ({
  line,
  short,
  worth: false,
});

/**
 * What each venue has for this player right now. One source of truth for the hub hotspots,
 * the venue tab strip and scripts/hub-clicks.ts, which counts what a weekend costs.
 */
/**
 * ⚠️ **The action-log parameter is gone with the dossier (BUILD_PLAN_V3 §2.1).** It was here because
 * what a stable had paid to see lived in the log rather than in GameState; nothing is bought through
 * the fog any more, so every venue's status is a function of the state alone. Phase D's Bar events
 * (GDD_V3 §9.4) put information back, and if it is again bought rather than granted this is where
 * the log comes back.
 */
export function venueStatus(s: GameState, me: Player): Record<VenueId, VenueStatus> {
  const planet = planetOf(s.planet.planetId);
  const pre = s.phase === 'planetPre';
  const inTurn = pre || s.phase === 'planetPost';
  const mine = ownedDogs(s, me);

  // --- Market: the food shelf, and whether there is a margin in carrying any of it.
  //
  // ⚠️ **This is the Docks' old arithmetic, moved (BUILD_PLAN_V3 §2.1).** The dog market, the gear
  // and the ship upgrades are deleted, so what is left of "the Market" is the food trade that used
  // to live at the Docks — which is what GDD_V3 §6 makes the only market in the game. The fuel term
  // is gone with the fuel, so a crate is worth carrying whenever the next planet's floor beats this
  // planet's price, full stop.
  //
  // Phase B replaces this with the six goods of §6.1 and the Price Range column of §6.2, at which
  // point the summary should name **which** good is cheap rather than just that something is.
  const next = s.calendar[s.week];
  const nextBand = next ? planetOf(next.planetId).foodBand : null;
  const kibble = s.planet.goods[KIBBLE_ID];
  const crates = cargoTotal(me.cargo);
  const roomToBuy = HOLD_CAP - crates > 0 && me.cash >= kibble.buy;
  const worthSelling = crates > 0 && nextBand !== null && kibble.sell > nextBand[1];
  const worthBuying =
    roomToBuy &&
    nextBand !== null &&
    s.toggles.trading &&
    nextBand[0] * (1 - balance.foodSpread) > kibble.buy;
  const market: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : worthBuying || worthSelling
      ? {
          line: worthBuying
            ? `Food at ${formatBones(kibble.buy)} a crate — cheap against next week`
            : `Food sells at ${formatBones(kibble.sell)} — dearer than next week`,
          short: worthBuying ? 'cheap food' : 'sell high',
          worth: true,
        }
      : nothing(
          `Food ${formatBones(kibble.buy)} / ${formatBones(kibble.sell)} · ${crates} crates aboard`,
          `${crates} crates`,
        );

  // --- Kennels: is every dog's week decided, and is anything wrong with one?
  const wrong = mine.filter((d) => d.injuryWeeks > 0 || d.fitness < balance.fitnessScaleBelow);
  // GDD §5.7 made the Kennels the centre of the game, so its hotspot answers the question the
  // screen exists for: is every dog's week decided? A stable whose plan is already set can walk
  // past, which is the whole point of the click budget — the decision is per dog, the *visit* is
  // not. GDD_V3 §10.1 cuts that budget from 14.5 to 10, so this matters more than it did.
  const plans = mine.map((d) => weekStatusOf(d));
  const racing = plans.filter((x) => x === 'race').length;
  const training = plans.filter((x) => x === 'train').length;
  const resting = plans.filter((x) => x === 'rest').length;
  const layoff = plans.filter((x) => x === 'layoff').length;
  // "Unplanned" is a dog set to race that nothing has entered yet — it will idle the week away.
  const unplanned =
    inTurn && pre
      ? mine.filter(
          (d) =>
            weekStatusOf(d) === 'race' &&
            !RACE_TYPE_IDS.some((r) => s.declarations[r][me.id] === d.id),
        ).length
      : 0;
  const plan = [
    racing ? `${racing} racing` : null,
    training ? `${training} training` : null,
    resting ? `${resting} resting` : null,
    layoff ? `${layoff} on layoff` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const kennels: VenueStatus =
    inTurn && unplanned
      ? {
          line: [plan, `${unplanned} with no race and no plan`].filter(Boolean).join(' · '),
          short: `${unplanned} undecided`,
          worth: true,
        }
      : nothing(
          wrong.length ? `${plan} · ${wrong.length} off colour` : plan || `${mine.length} dogs`,
          wrong.length ? `${wrong.length} off colour` : plan || `${mine.length} dogs`,
        );

  const bookie: VenueStatus = !s.toggles.betting
    ? nothing('No betting this season')
    : planet.special.noBetting
      ? nothing(`No bookie on ${planet.name}`)
      : s.phase === 'betting'
        ? { line: 'Open — three races on the board', short: 'three races up', worth: true }
        : nothing('Opens when the card locks', 'shut till lock');

  // --- Race Office: a runner still to declare in a race you are eligible for.
  const card = thisWeeksCard(s);
  const undeclared = card.filter((race) => {
    if (s.declarations[race][me.id]) return false;
    return mine.some((d) => !ineligibleReason(d, race) && !isDeclaredElsewhere(s, me, d.id, race));
  });
  const declaredMine = card.filter((race) => s.declarations[race][me.id]).length;
  const office: VenueStatus = !pre
    ? nothing('The card is closed for this weekend')
    : undeclared.length
      ? {
          line: `${declaredMine} of ${card.length} declared · ${undeclared.length} race${undeclared.length === 1 ? '' : 's'} you can still fill`,
          short: `${undeclared.length} to fill`,
          worth: true,
        }
      : nothing(
          `All ${declaredMine} declared · ${TRAPS - declaredCount(s, OPEN_TYPE_ID)} locals in the ${raceLabel(OPEN_TYPE_ID)}`,
          `${declaredMine} declared`,
        );

  /**
   * The map is a fog, and there is nothing to buy through it any more.
   *
   * ⚠️ **The dossier is deleted (BUILD_PLAN_V3 §2.1)**, so the map is never "worth a walk": it shows
   * this planet, next week's name, and the rest hatched. GDD_V3 §9.4 keeps the fog and says
   * information now arrives through Bar events and staff bonuses instead — Phase D — and that it has
   * exactly one use, which is knowing whether next week's planet buys your food high.
   */
  const map: VenueStatus = nothing(
    next ? `Next week: ${planetOf(next.planetId).name}. The rest is dark` : 'The last stop',
    next ? planetOf(next.planetId).name : 'last stop',
  );

  return {
    hub: { line: '', short: '', worth: false },
    map,
    market,
    stable: kennels,
    bookie,
    office,
  };
}

function isDeclaredElsewhere(s: GameState, me: Player, dogId: string, except: RaceTypeId): boolean {
  return RACE_TYPE_IDS.some((r) => r !== except && s.declarations[r][me.id] === dogId);
}

/** Highest value of a dog this player owns — used by the hub's one-line stable summary. */
export function bestDogValue(s: GameState, me: Player): number {
  const dogs = ownedDogs(s, me);
  return dogs.length ? Math.max(...dogs.map((d) => dogValue(d))) : 0;
}
