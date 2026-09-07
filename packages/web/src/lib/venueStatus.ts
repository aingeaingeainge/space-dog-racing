import {
  balance,
  dogValue,
  formatBones,
  loanCap,
  outstanding,
  planetOf,
  upgradePrice,
  RACE_CLASSES,
  type GameState,
  type Player,
} from '@sdr/engine';
import { ineligibleReason, ownedDogs, declaredCount, TRAPS } from './selectors';
import type { VenueId } from './venues';

export interface VenueStatus {
  /** One line of what is actually in there this week, for the hotspot and the tab strip. */
  line: string;
  /**
   * Is there anything here this player can do this week? PLAYTEST_NOTES finding 4 is that a
   * season is a lot of clicks, and most of them are spent opening a venue to discover it has
   * nothing in it. Every venue answers this from state the screens already read, so the hub
   * can say it before you walk in. It never hides or disables anything — a venue you can
   * still walk into stays open, it just stops asking for a click.
   */
  worth: boolean;
}

const nothing = (line: string): VenueStatus => ({ line, worth: false });

/**
 * What each venue has for this player right now. One source of truth for the hub hotspots,
 * the venue tab strip and scripts/hub-clicks.ts, which counts what a weekend costs.
 */
export function venueStatus(s: GameState, me: Player): Record<VenueId, VenueStatus> {
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
            canBuy.length ? `${canBuy.length} dog${canBuy.length === 1 ? '' : 's'} you can afford, from ${formatBones(cheapest)}` : null,
            gearInStock.length ? gearInStock.join(', ') : null,
          ]
            .filter(Boolean)
            .join(' · '),
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
  const wrong = mine.filter((d) => d.injuryWeeks > 0 || d.banWeeks > 0 || d.fitness < balance.fitnessScaleBelow);
  const kennels: VenueStatus =
    inTurn && gearInStock.length
      ? { line: `${mine.length} dogs · ${gearInStock.join(', ')} to fit`, worth: true }
      : nothing(
          wrong.length
            ? `${mine.length} dogs · ${wrong.length} off colour`
            : `${mine.length} dogs, all sound`,
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
          worth: true,
        }
      : nothing(
          s.toggles.trading
            ? `Kibble ${s.planet.foodBuy}/${s.planet.foodSell} · hold ${me.cargo}/${me.ship.cargoCap}`
            : 'No trading this season',
        );

  // --- Saloon: someone to hire, someone to lend, or a training focus going spare.
  const hireable = s.planet.staff.filter(
    (o) => !me.staff[o.role] && o.wage <= me.cash && !(o.role === 'fixer' && s.toggles.cleanSport),
  );
  const lender =
    (planet.special.bank && outstanding(me, 'bank') < loanCap('bank')) ||
    (planet.special.shark && outstanding(me, 'shark') < loanCap('shark'));
  const idleTrainer = !!me.staff.trainer && !me.training;
  const saloon: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : hireable.length || idleTrainer
      ? {
          line: [
            hireable.length ? hireable.map((o) => `${o.role} ${formatBones(o.wage)}/wk`).join(', ') : null,
            idleTrainer ? 'your trainer has nothing to work on' : null,
          ]
            .filter(Boolean)
            .join(' · '),
          worth: true,
        }
      : nothing(
          lender
            ? planet.special.shark
              ? 'Fat Tony is in; nobody to hire'
              : 'The bank is open; nobody to hire'
            : 'Nobody for hire, nobody lending',
        );

  // --- Bookie: only during the betting phase, and only where the planet has one.
  const bookie: VenueStatus = !s.toggles.betting
    ? nothing('No betting this season')
    : planet.special.noBetting
      ? nothing(`No bookie on ${planet.name}`)
      : s.phase === 'betting'
        ? { line: 'Open — three races on the board', worth: true }
        : nothing('Opens when the card locks');

  // --- Race Office: a runner still to declare in a race you are eligible for.
  const undeclared = RACE_CLASSES.filter((cls) => {
    if (s.declarations[cls][me.id]) return false;
    return mine.some((d) => !ineligibleReason(d, cls) && !isDeclaredElsewhere(s, me, d.id, cls));
  });
  const declaredMine = RACE_CLASSES.filter((cls) => s.declarations[cls][me.id]).length;
  const office: VenueStatus = !pre
    ? nothing('The card is closed for this weekend')
    : undeclared.length
      ? {
          line: `${declaredMine} of 3 declared · ${undeclared.length} race${undeclared.length === 1 ? '' : 's'} you can still fill`,
          worth: true,
        }
      : nothing(`All ${declaredMine} declared · ${TRAPS - declaredCount(s, 'gold')} locals in Gold`);

  return {
    hub: { line: '', worth: false },
    map: nothing('The whole circuit, from week 1'),
    market,
    stable: kennels,
    docks,
    saloon,
    bookie,
    office,
  };
}

function isDeclaredElsewhere(
  s: GameState,
  me: Player,
  dogId: string,
  except: (typeof RACE_CLASSES)[number],
): boolean {
  return RACE_CLASSES.some((c) => c !== except && s.declarations[c][me.id] === dogId);
}

/** Highest value of a dog this player owns — used by the hub's one-line stable summary. */
export function bestDogValue(s: GameState, me: Player): number {
  const dogs = ownedDogs(s, me);
  return dogs.length ? Math.max(...dogs.map(dogValue)) : 0;
}
