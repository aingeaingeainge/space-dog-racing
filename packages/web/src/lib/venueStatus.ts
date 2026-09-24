import {
  balance,
  cargoTotal,
  HOLD_CAP,
  planetOf,
  weekStatusOf,
  thisWeeksCard,
  dogValue,
  HEADLINE_TYPE_ID,
  RACE_TYPE_IDS,
  type GameState,
  type Player,
  type RaceTypeId,
} from '@sdr/engine';
import { marketHeadline } from './market';
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

  // --- Market: the six foods, and whether anything on the shelf or in the hold is worth a walk.
  //
  // Names **which** good, now that there are six (GDD_V3 §6.1): "cheap Steak" is a reason to go in,
  // "something is cheap" is not. The judgement is `marketHeadline`'s — a price in the bottom or top
  // quarter of its own band — which is the same reading the Price Range column asks a player to make.
  const crates = cargoTotal(me.cargo);
  const headline = s.toggles.trading ? marketHeadline(s, me) : null;
  const market: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : headline
      ? { line: headline.line, short: headline.short, worth: true }
      : nothing(`Six foods · ${crates} / ${HOLD_CAP} crates aboard`, `${crates} crates`);

  // --- Kennels: is every dog's week decided, and is anything wrong with one?
  const wrong = mine.filter((d) => d.injuryWeeks > 0 || d.fitness < balance.fitnessScaleBelow);
  // ⚠️ **Since Phase D2 the Kennels never asks for a weekly visit** (item 5, Jesse's call). It used to
  // flag a dog "set to race that nothing has entered" so the player would walk in and plan the week;
  // the Race Office now sets the week (a declared dog races, the rest rest), so there is nothing to
  // plan and the hotspot only reports. What is left to do in there — the diet — is sticky.
  const plans = mine.map((d) => weekStatusOf(d));
  const racing = plans.filter((x) => x === 'race').length;
  const resting = plans.filter((x) => x === 'rest').length;
  const layoff = plans.filter((x) => x === 'layoff').length;
  const plan = [
    racing ? `${racing} racing` : null,
    resting ? `${resting} resting` : null,
    layoff ? `${layoff} on layoff` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const kennels: VenueStatus = nothing(
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
  const card = thisWeeksCard();
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
          `All ${declaredMine} declared · ${TRAPS - declaredCount(s, HEADLINE_TYPE_ID)} locals in the ${raceLabel(HEADLINE_TYPE_ID)}`,
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
  const next = s.calendar[s.week];
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
