import {
  balance,
  bestFeedAboard,
  cargoCap,
  cargoTotal,
  GOODS,
  KIBBLE_ID,
  TIER_LABEL,
  TIER_ORDER,
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
  type StaffRole,
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
  // What this stable's own Scout and Trader turned up here, which nobody else can see (GDD §8.3).
  const mineFinds = s.planet.finds[me.id];
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
  const next = s.calendar[s.week];
  const nextBand = next ? planetOf(next.planetId).foodBand : null;
  const kibble = s.planet.goods[KIBBLE_ID];
  const crates = cargoTotal(me.cargo);
  const roomToBuy = cargoCap(me) - crates > 0 && me.cash >= kibble.buy;
  const worthSelling = crates > 0 && nextBand !== null && kibble.sell > nextBand[1];
  /**
   * Worth carrying, **after the fuel** (GDD §9.1).
   *
   * v1 asked only whether kibble was cheaper here than the next planet's band, which is true about
   * half the time and ignores the tax that makes blind carrying lose 9.5 a crate. The Docks itself
   * now prints a break-even price a crate; the hotspot uses the same arithmetic, so the two agree
   * and a walk is only suggested when there is actually a margin in it.
   */
  const perCrateFuel = crates >= balance.fuelCargoFree ? balance.fuelPerCargoUnitOver : 0;
  const worthBuying =
    roomToBuy &&
    nextBand !== null &&
    s.toggles.trading &&
    nextBand[0] * (1 - balance.foodSpread) > kibble.buy + perCrateFuel;
  /**
   * The feed shelf, summarised (GDD §8.5, D10).
   *
   * This is where the busier market gets paid for. Thirteen goods is a table nobody wants to open
   * on the chance that something good is on it, so the hotspot names **the best tier on the shelf**
   * and whether anything there is worth carrying — and a player who is not shopping for feed this
   * week never has to walk in to find that out. The click budget is 14.5 and the answer to "the
   * market got busier" is a better summary, not another visit.
   */
  const feedShelf = GOODS.filter(
    (g) => g.tier && (s.planet.goods[g.id].stock > 0 || (mineFinds?.goods[g.id] ?? 0) > 0),
  );
  const bestShelfTier = TIER_ORDER.filter((t) => feedShelf.some((g) => g.tier === t)).pop() ?? null;
  const primeOnShelf = feedShelf.filter((g) => g.tier === 'prime');
  // A feed a dog of yours is actually on, which is the only kind worth a walk for a trainer.
  const trainingStats = new Set(
    mine.filter((d) => d.weekState === 'train').map((d) => d.trainStat),
  );
  /**
   * Feed a dog of yours is on and would actually be better for.
   *
   * ⚠️ The third tightening, and the one that matters: "Rough trap feed is on the shelf and a dog is
   * on trap" is true most weeks, which made the Docks worth a walk 87% of them. A Rough crate is the
   * *floor* — GDD §8.1 calls it "what you start with" — so it is only news when the alternative is
   * the dog eating kibble and taking its points on a random stat. Anything above Rough is news
   * whatever else is aboard.
   */
  const wantedFeed = feedShelf.filter((g) => {
    if (!g.stat || !trainingStats.has(g.stat) || s.planet.goods[g.id].buy > me.cash) return false;
    const have = bestFeedAboard(me.cargo, g.stat);
    if (g.tier !== 'rough')
      return !have || TIER_ORDER.indexOf(have.tier!) < TIER_ORDER.indexOf(g.tier!);
    return !have;
  });
  // Only the consignments that are both affordable and wanted: a crate put aside for you that you
  // cannot pay for, or have nothing to feed it to, is not a reason to walk down to the docks.
  const consigned = GOODS.filter(
    (g) =>
      (mineFinds?.goods[g.id] ?? 0) > 0 &&
      s.planet.goods[g.id].buy <= me.cash &&
      (g.tier === 'prime' || (g.stat !== null && trainingStats.has(g.stat))),
  );

  /**
   * An upgrade worth walking in for — which is not the same as one you can afford.
   *
   * ⚠️ **Tightened, with a number.** Cutting the hold's price to 1,400 (GDD §20 Q6) made "you could
   * afford a bigger hold" true almost every week, and `hub-clicks` went 14.0 → 15.3 against a 14.5
   * budget. The fix BUILD_PLAN §11 asks for is a better summary, and the better summary is the thing
   * the payback ablation actually found: **capacity you cannot fill is worth nothing**, so a bigger
   * hold is only news when the one you have is nearly full. The kennel module likewise waits until
   * the kennel is full, and the cold store until there is something in the hold to spoil.
   */
  const upgrades: string[] = [];
  if (me.ship.speed < balance.shipMaxSpeed && upgradePrice('engine', planet, me) <= me.cash)
    upgrades.push('engine');
  if (
    cargoTotal(me.cargo) >= cargoCap(me) * 0.75 &&
    (worthBuying || wantedFeed.length > 0) &&
    upgradePrice('cargo', planet, me) <= me.cash
  )
    upgrades.push('hold');
  if (
    me.kennelSlots < balance.kennelSlotsMax &&
    ownedDogs(s, me).length >= me.kennelSlots &&
    upgradePrice('kennel', planet, me) <= me.cash
  )
    upgrades.push('kennel');
  if (
    !me.ship.coldStore &&
    cargoTotal(me.cargo) > 0 &&
    upgradePrice('coldStore', planet, me) <= me.cash
  )
    upgrades.push('cold store');

  /**
   * ⚠️ **The principle that brought `hub-clicks` back inside its budget, and the useful part of this
   * whole pass: a hotspot flags what CHANGES, not what is always there.**
   *
   * The measured culprit was not the new market at all — it was `upgrades.length`, firing 533 times
   * in 650 planet phases, because "you could afford an engine tier" is true every week for the rest
   * of the season once it is true once. A permanent fit does not expire: it will be on the shelf next
   * week and the week after, so it is a standing option rather than news, and a player who wants one
   * can walk in whenever they like. Stock and prices *do* expire, so those are news.
   *
   * So the ship's permanent upgrades no longer make the Docks "worth a walk" — they are named in the
   * quiet line instead, where they stay visible and cost nothing. That is §8.5's "spend the
   * difference on better summaries" done properly.
   */
  const docks: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : primeOnShelf.length || wantedFeed.length || consigned.length || worthBuying || worthSelling
      ? {
          line: [
            primeOnShelf.length ? `PRIME ${primeOnShelf.map((g) => g.short).join('/')} feed` : null,
            wantedFeed.length
              ? `${wantedFeed[0]!.label} for ${formatBones(s.planet.goods[wantedFeed[0]!.id].buy)}`
              : null,
            consigned.length ? `${consigned[0]!.label} put aside for you` : null,
            worthBuying ? `kibble ${kibble.buy} here, dearer next stop` : null,
            worthSelling ? `sell at ${kibble.sell}, dearer than next stop` : null,
            upgrades.length ? `${upgrades.join(', ')} affordable too` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          short: [
            primeOnShelf.length ? 'PRIME feed' : wantedFeed.length ? 'feed you want' : null,
            consigned.length ? 'consignment' : null,
            worthBuying ? 'kibble cheap' : null,
            worthSelling ? 'kibble dear' : null,
          ]
            .filter(Boolean)
            .join(' + '),
          worth: true,
        }
      : nothing(
          [
            s.toggles.trading
              ? `Kibble ${kibble.buy}/${kibble.sell} · hold ${crates}/${cargoCap(me)}`
              : 'No trading this season',
            bestShelfTier ? `nothing above ${TIER_LABEL[bestShelfTier]} feed on the shelf` : null,
            // Standing options, named but never urgent: they will still be here next week.
            upgrades.length ? `${upgrades.join(', ')} affordable whenever you want` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          s.toggles.trading ? `hold ${crates}/${cargoCap(me)}` : 'no trading',
        );

  // --- Saloon: someone to hire, someone to lend, or a training focus going spare.
  /**
   * Somebody worth walking in for (GDD §8.3, §8.5).
   *
   * ⚠️ **Tightened, with a number.** Six roles × three tiers made the Saloon "worth a walk" almost
   * every week, and `hub-clicks` went 14.0 → 15.3 against a 14.5 budget. BUILD_PLAN §11's answer to
   * that is a better summary rather than fewer decisions, and the better summary is this: an offer
   * is only worth a walk if taking it would **change something** — a role you have not got, or a
   * better tier than the one you have in it. A third Rough tipster is not an offer, it is furniture.
   * That took it back to 14.2.
   */
  const staffSlotsFree = balance.staffSlots - me.staff.length;
  const bestInRole = (role: StaffRole): number =>
    Math.max(-1, ...me.staff.filter((o) => o.role === role).map((o) => TIER_ORDER.indexOf(o.tier)));
  const hireable = s.planet.staff.filter((o) => {
    if (o.wage > me.cash) return false;
    const mineTier = bestInRole(o.role);
    // A free slot takes anything new; a full yard only takes a clear upgrade on what is in it.
    if (mineTier < 0) return staffSlotsFree > 0;
    return TIER_ORDER.indexOf(o.tier) > mineTier;
  });
  /**
   * And of those, the ones worth *interrupting* for.
   *
   * A Rough hire is the floor of the ladder — "what you start with" (GDD §8.1) — and another will be
   * along next week, so an empty slot and a Rough body in it is not an event. Proper and Prime are:
   * they are rare, they are gone when you jump, and a Prime trainer in week 3 makes a different
   * season out of the same seed (§8.3's "rarity is the point"). Rough offers stay in the quiet line.
   */
  const worthHiring = hireable.filter((o) => o.tier !== 'rough' || bestInRole(o.role) >= 0);
  const primeHire = hireable.filter((o) => o.tier === 'prime');
  const lender =
    (planet.special.bank && outstanding(me, 'bank') < loanCap('bank')) ||
    (planet.special.shark && outstanding(me, 'shark') < loanCap('shark'));

  const saloon: VenueStatus = !inTurn
    ? nothing('Shut while the races are on')
    : worthHiring.length
      ? {
          // The training focus used to live here; §5.7 moved it to the Kennels, so the Saloon is
          // back to being about people. Tier first, because on the one ladder the tier is the
          // headline and the role is the detail: "Prime trainer" is a week-defining offer and
          // "Rough tipster" is furniture.
          //
          // A **lender** does not make it worth a walk, for the same reason a ship upgrade does not:
          // the bank is on that planet whether you go in or not, and borrowing is something you do
          // when you need cash rather than because the bank is open. It stays in the quiet line.
          line: [
            hireable
              .map((o) => `${TIER_LABEL[o.tier]} ${o.role} ${formatBones(o.wage)}/wk`)
              .join(', '),
            lender ? (planet.special.shark ? 'and Fat Tony is in' : 'and the bank is open') : null,
          ]
            .filter(Boolean)
            .join(' · '),
          short: primeHire.length ? `PRIME ${primeHire[0]!.role}` : `${worthHiring.length} to hire`,
          worth: true,
        }
      : nothing(
          [
            hireable.length
              ? `${hireable.map((o) => `${TIER_LABEL[o.tier]} ${o.role}`).join(', ')} about, if you want one`
              : 'Nobody worth hiring',
            lender ? (planet.special.shark ? 'Fat Tony is in' : 'the bank is open') : null,
          ]
            .filter(Boolean)
            .join(' · '),
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
