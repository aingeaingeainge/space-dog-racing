import {
  balance,
  dogValue,
  formatBones,
  loanCap,
  outstanding,
  planetOf,
  upgradePrice,
  weekStatusOf,
  thisWeeksCard,
  OPEN_TYPE_ID,
  RACE_TYPE_IDS,
  type Action,
  type GameState,
  type Player,
  type RaceTypeId,
} from '@sdr/engine';
import {
  declaredCount,
  dossierWeek,
  dossierWeeks,
  ineligibleReason,
  ownedDogs,
  raceLabel,
  TRAPS,
} from './selectors';
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
export function venueStatus(
  s: GameState,
  me: Player,
  /**
   * The season's action log. Only the fog needs it: what a stable has paid to see lives in the
   * log rather than in GameState (GDD §9.3), so the map's hint cannot be read off the state
   * alone. Optional because the headless click budget does not buy dossiers.
   */
  log: readonly Action[] = [],
): Record<VenueId, VenueStatus> {
  const planet = planetOf(s.planet.planetId);
  const pre = s.phase === 'planetPre';
  const inTurn = pre || s.phase === 'planetPost';
  const mine = ownedDogs(s, me);
  const slotsFree = me.kennelSlots - mine.length;

  // --- Market: dogs you could actually take home, and gear you could actually pay for.
  const forSale = s.planet.marketDogIds.map((id) => s.dogs[id]).filter((d) => !!d);
  const canBuy = forSale.filter((d) => slotsFree > 0 && (d?.askingPrice ?? 0) <= me.cash);
  const gearInStock: string[] = [];
  if (s.planet.trackDayPasses && upgradePrice('trackDay', planet, me) <= me.cash)
    gearInStock.push('pass');
  if (s.planet.muzzlesInStock && upgradePrice('muzzle', planet, me) <= me.cash)
    gearInStock.push('muzzle');
  if (pre && !s.toggles.cleanSport && upgradePrice('supplement', planet, me) <= me.cash)
    gearInStock.push('supplement');
  const cheapest = canBuy.length
    ? Math.min(...canBuy.map((d) => d!.askingPrice ?? 0))
    : forSale.length
      ? Math.min(...forSale.map((d) => d!.askingPrice ?? 0))
      : 0;
  const market: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : canBuy.length || gearInStock.length
      ? {
          line: [
            canBuy.length
              ? `${canBuy.length} dog${canBuy.length === 1 ? '' : 's'} you can afford, from ${formatBones(cheapest)}`
              : null,
            gearInStock.length ? gearInStock.join(', ') : null,
          ]
            .filter(Boolean)
            .join(' · '),
          short: [
            canBuy.length ? `${canBuy.length} dog${canBuy.length === 1 ? '' : 's'}` : null,
            gearInStock.length ? 'gear' : null,
          ]
            .filter(Boolean)
            .join(' + '),
          worth: true,
        }
      : nothing(
          forSale.length
            ? slotsFree > 0
              ? `${forSale.length} on the block, cheapest ${formatBones(cheapest)} — out of reach`
              : 'Kennels full; nothing you can take'
            : 'Nothing left on the block',
        );

  // --- Kennels: gear you can put on a dog, and anything wrong with one.
  const wrong = mine.filter(
    (d) => d.injuryWeeks > 0 || d.banWeeks > 0 || d.fitness < balance.fitnessScaleBelow,
  );
  // GDD §5.7 made the Kennels the centre of the game, so its hotspot now answers the question
  // the screen exists for: is every dog's week decided? A stable whose plan is already set can
  // walk past, which is the whole point of §15.3's click budget — the decision is per dog, the
  // *visit* is not.
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
    inTurn && (unplanned || gearInStock.length)
      ? {
          line: [
            plan,
            unplanned ? `${unplanned} with no race and no plan` : null,
            gearInStock.length ? `${gearInStock.join(', ')} to fit` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          short: unplanned ? `${unplanned} undecided` : 'gear to fit',
          worth: true,
        }
      : nothing(
          wrong.length ? `${plan} · ${wrong.length} off colour` : plan || `${mine.length} dogs`,
          wrong.length ? `${wrong.length} off colour` : plan || `${mine.length} dogs`,
        );

  // --- Docks: an upgrade you can pay for, or a kibble trade with somewhere to go.
  const upgrades: string[] = [];
  if (me.ship.speed < balance.shipMaxSpeed && upgradePrice('engine', planet, me) <= me.cash)
    upgrades.push('engine');
  if (upgradePrice('cargo', planet, me) <= me.cash) upgrades.push('hold');
  if (me.kennelSlots < balance.kennelSlotsMax && upgradePrice('kennel', planet, me) <= me.cash)
    upgrades.push('kennel');
  if (!me.ship.coldStore && upgradePrice('coldStore', planet, me) <= me.cash)
    upgrades.push('cold store');
  const next = s.calendar[s.week];
  const nextBand = next ? planetOf(next.planetId).foodBand : null;
  const roomToBuy = me.ship.cargoCap - me.cargo > 0 && me.cash >= s.planet.foodBuy;
  const worthSelling = me.cargo > 0 && nextBand !== null && s.planet.foodSell > nextBand[1];
  const worthBuying =
    roomToBuy && nextBand !== null && s.planet.foodBuy < nextBand[0] && s.toggles.trading;
  const docks: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : upgrades.length || worthBuying || worthSelling
      ? {
          line: [
            upgrades.length ? upgrades.join(', ') : null,
            worthBuying ? `kibble ${s.planet.foodBuy} here, dearer next stop` : null,
            worthSelling ? `sell at ${s.planet.foodSell}, dearer than next stop` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          short: [
            upgrades.length
              ? `${upgrades.length} upgrade${upgrades.length === 1 ? '' : 's'}`
              : null,
            worthBuying ? 'kibble cheap' : null,
            worthSelling ? 'kibble dear' : null,
          ]
            .filter(Boolean)
            .join(' + '),
          worth: true,
        }
      : nothing(
          s.toggles.trading
            ? `Kibble ${s.planet.foodBuy}/${s.planet.foodSell} · hold ${me.cargo}/${me.ship.cargoCap}`
            : 'No trading this season',
          s.toggles.trading ? `hold ${me.cargo}/${me.ship.cargoCap}` : 'no trading',
        );

  // --- Saloon: someone to hire, someone to lend, or a training focus going spare.
  const hireable = s.planet.staff.filter(
    (o) => !me.staff[o.role] && o.wage <= me.cash && !(o.role === 'fixer' && s.toggles.cleanSport),
  );
  const lender =
    (planet.special.bank && outstanding(me, 'bank') < loanCap('bank')) ||
    (planet.special.shark && outstanding(me, 'shark') < loanCap('shark'));

  const saloon: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : hireable.length
      ? {
          // The training focus used to live here; §5.7 moved it to the Kennels, so the Saloon is
          // back to being about people — somebody to hire, somebody to lend.
          line: hireable.map((o) => `${o.role} ${formatBones(o.wage)}/wk`).join(', '),
          short: `${hireable.length} to hire`,
          worth: true,
        }
      : nothing(
          lender
            ? planet.special.shark
              ? 'Fat Tony is in; nobody to hire'
              : 'The bank is open; nobody to hire'
            : 'Nobody for hire, nobody lending',
          lender ? (planet.special.shark ? 'Fat Tony is in' : 'bank open') : 'nobody about',
        );

  // --- Bookie: only during the betting phase, and only where the planet has one.
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

  const buyable = dossierWeek(s);
  const haveIt = buyable !== null && dossierWeeks(log, me.id).has(buyable);
  const map: VenueStatus =
    buyable === null
      ? nothing('The last stop is the Collar. Nothing left to scout', 'circuit done')
      : haveIt
        ? nothing(`You have the file on week ${buyable}`, `wk ${buyable} known`)
        : {
            line: `Week ${buyable} is dark — a dossier names the planet, its kibble and its card`,
            short: `wk ${buyable} for sale`,
            worth: pre && me.cash >= upgradePrice('dossier', planet, me),
          };

  return {
    hub: { line: '', short: '', worth: false },
    // GDD §9.3: the map is a fog now, and it is the one venue where a purchase buys information
    // rather than a thing. It is worth the walk while there is a week you have not paid to see.
    map,
    market,
    stable: kennels,
    docks,
    saloon,
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
  return dogs.length ? Math.max(...dogs.map(dogValue)) : 0;
}
