/**
 * Play a whole season the way a person does — through store/loop.ts and screenFor, the same two
 * functions App.tsx walks — issuing exactly the actions the screens can issue, with exactly the
 * guards the screens put on their buttons. Any ActionError means a screen could offer a player
 * a button the engine would refuse.
 *
 *   npx tsx packages/web/scripts/season-check.ts [seed ...]
 *
 * Not part of `npm test` (which is the engine's own suite); this is the UI's end-to-end check.
 */
import {
  balance,
  bettingMargin,
  createSeason,
  drive,
  dogSalePrice,
  dogValue,
  fuelCost,
  loanCap,
  maxStakeFraction,
  outstanding,
  planetOf,
  replay,
  upgradePrice,
  RACE_CLASSES,
  type Action,
  type Dog,
  type GameState,
  type Id,
  type Player,
  type RaceClass,
  type SeasonSetup,
} from '@sdr/engine';
import { applyActions, screenFor, type ScreenUi } from '../src/store/loop';

const HUMAN = 'p1';

function ownDogs(s: GameState, p: Player): Dog[] {
  return p.dogIds.map((id) => s.dogs[id]).filter((d): d is Dog => !!d);
}

function eligibleFor(d: Dog, cls: RaceClass): boolean {
  const cap = cls === 'bronze' ? balance.capBronze : cls === 'silver' ? balance.capSilver : 99;
  return d.injuryWeeks === 0 && d.banWeeks === 0 && d.rating <= cap;
}

/** Best dog to each race, best race first — what a person does at the Race Office. */
function declarations(kennel: Dog[], p: Player): Action[] {
  const out: Action[] = [];
  const taken = new Set<Id>();
  for (const cls of ['gold', 'silver', 'bronze'] as RaceClass[]) {
    const pick = kennel
      .filter((d) => !taken.has(d.id) && eligibleFor(d, cls) && d.fitness > 40)
      .sort((a, b) => b.rating - a.rating)[0];
    if (pick) {
      taken.add(pick.id);
      out.push({ t: 'Declare', playerId: p.id, cls, dogId: pick.id });
    }
  }
  return out;
}

/** Everything a human can do at the planet's venues, with the screens' own guards. */
function planetTurn(s: GameState, p: Player, tally: Record<string, number>): Action[] {
  const out: Action[] = [];
  const planet = planetOf(s.planet.planetId);
  const sp = planet.special;
  const pre = s.phase === 'planetPre';
  let cash = p.cash;
  let cargo = p.cargo;
  const dogs = ownDogs(s, p);
  const kennel = [...dogs]; // what we will own once this turn's buys and sells have landed
  let slots = p.kennelSlots - dogs.length;

  // --- Saloon: staff, training, credit ---
  const trainerOffer = s.planet.staff.find((o) => o.role === 'trainer');
  if (pre && !p.staff.trainer && trainerOffer && cash > trainerOffer.wage * 4) {
    out.push({ t: 'HireStaff', playerId: p.id, role: 'trainer', staffId: trainerOffer.id });
    tally.HireStaff++;
  }
  const vetOffer = s.planet.staff.find((o) => o.role === 'vet');
  if (pre && !p.staff.vet && vetOffer && cash > 8000) {
    out.push({ t: 'HireStaff', playerId: p.id, role: 'vet', staffId: vetOffer.id });
    tally.HireStaff++;
  }
  const fixerOffer = s.planet.staff.find((o) => o.role === 'fixer');
  if (pre && !p.staff.fixer && fixerOffer && !s.toggles.cleanSport && cash > 12000) {
    out.push({ t: 'HireStaff', playerId: p.id, role: 'fixer', staffId: fixerOffer.id });
    tally.HireStaff++;
  }
  // Week 9: the wage bill bites and the staff go, trainer first.
  if (pre && s.week === 9) {
    for (const role of ['vet', 'trainer'] as const) {
      if (p.staff[role]) {
        out.push({ t: 'FireStaff', playerId: p.id, role });
        tally.FireStaff++;
      }
    }
  }
  const willHaveTrainer =
    (!!p.staff.trainer && !out.some((a) => a.t === 'FireStaff' && a.role === 'trainer')) ||
    out.some((a) => a.t === 'HireStaff' && a.role === 'trainer');
  if (pre && willHaveTrainer) {
    const best = [...kennel].sort((a, b) => b.rating - a.rating)[0];
    if (best && p.training?.dogId !== best.id) {
      out.push({ t: 'SetTraining', playerId: p.id, dogId: best.id, stat: 'speed' });
      tally.SetTraining++;
    }
  }
  for (const lender of ['bank', 'shark'] as const) {
    const here = lender === 'bank' ? sp.bank : sp.shark;
    if (!here) continue;
    const owed = outstanding(p, lender);
    const room = loanCap(lender) - owed;
    if (pre && room >= 1000 && (cash < 2500 || (owed === 0 && s.week <= 6))) {
      out.push({ t: 'Borrow', playerId: p.id, lender, amount: 1000 });
      cash += 1000;
      tally.Borrow++;
    } else if (owed > 0 && cash > owed + 3000) {
      const amount = Math.min(owed, Math.floor(cash));
      out.push({ t: 'Repay', playerId: p.id, lender, amount });
      cash -= amount;
      tally.Repay++;
    }
  }

  // --- Market: sell the worst, buy the best that beats it ---
  const declared = RACE_CLASSES.map((c) => s.declarations[c][p.id]).filter(Boolean);
  const worst = [...dogs].sort((a, b) => a.rating - b.rating)[0];
  if (
    worst &&
    dogs.length > 1 &&
    !(pre && declared.includes(worst.id)) &&
    (worst.age >= 6 || (slots <= 0 && s.week >= 5))
  ) {
    out.push({ t: 'SellDog', playerId: p.id, dogId: worst.id });
    cash += dogSalePrice(worst, sp.buyerBonus ?? 0, sp.dogValueMod ?? 1);
    kennel.splice(kennel.indexOf(worst), 1);
    slots++;
    tally.SellDog++;
  }
  if (pre) {
    const forSale = s.planet.marketDogIds
      .map((id) => s.dogs[id])
      .filter((d): d is Dog => !!d)
      .sort((a, b) => b.rating - a.rating);
    for (const d of forSale) {
      const price = d.askingPrice ?? dogValue(d);
      if (slots <= 0 || price > cash - 1500) continue;
      if (worst && d.rating <= worst.rating) continue;
      out.push({ t: 'BuyDog', playerId: p.id, dogId: d.id });
      cash -= price;
      kennel.push(d);
      slots--;
      tally.BuyDog++;
      break;
    }
  }

  // --- Market gear, applied to a named dog in the Kennels ---
  const target = [...kennel].sort((a, b) => b.rating - a.rating)[0];
  if (target) {
    if (s.planet.trackDayPasses) {
      const price = upgradePrice('trackDay', planet, p);
      if (price <= cash - 2000) {
        out.push({ t: 'BuyUpgrade', playerId: p.id, upgrade: 'trackDay', dogId: target.id });
        cash -= price;
        tally.BuyUpgrade++;
      }
    }
    if (s.planet.muzzlesInStock) {
      const price = upgradePrice('muzzle', planet, p);
      if (price <= cash - 2000) {
        out.push({ t: 'BuyUpgrade', playerId: p.id, upgrade: 'muzzle', dogId: target.id });
        cash -= price;
        tally.BuyUpgrade++;
      }
    }
    if (pre && !s.toggles.cleanSport && !target.supplemented) {
      const price = upgradePrice('supplement', planet, p);
      const rate = sp.dopingCatch ?? balance.supplementCatchBase;
      if (rate <= 0.15 && price <= cash - 3000) {
        out.push({ t: 'BuyUpgrade', playerId: p.id, upgrade: 'supplement', dogId: target.id });
        cash -= price;
        tally.BuyUpgrade++;
      }
    }
  }

  // --- Docks: ship, then kibble ---
  for (const upgrade of ['engine', 'cargo', 'kennel', 'coldStore'] as const) {
    if (upgrade === 'engine' && p.ship.speed >= balance.shipMaxSpeed) continue;
    if (upgrade === 'kennel' && p.kennelSlots >= balance.kennelSlotsMax) continue;
    if (upgrade === 'coldStore' && p.ship.coldStore) continue;
    const price = upgradePrice(upgrade, planet, p);
    if (price > cash - 9000) continue;
    out.push({ t: 'BuyUpgrade', playerId: p.id, upgrade });
    cash -= price;
    tally.BuyUpgrade++;
    break;
  }
  if (s.toggles.trading) {
    const need = kennel.length;
    const next = s.calendar[s.week];
    const nextBand = next ? planetOf(next.planetId).foodBand : null;
    const nextMid = nextBand ? (nextBand[0] + nextBand[1]) / 2 : s.planet.foodBuy;
    let units = 0;
    if (s.planet.foodSell > nextMid + 20 && cargo > need) units = -(cargo - need);
    else if (nextMid - s.planet.foodBuy > 20) {
      const spend = Math.max(0, cash - 2500);
      units = Math.min(p.ship.cargoCap - cargo, Math.floor(spend / s.planet.foodBuy));
    } else if (cargo < need) {
      units = Math.min(
        p.ship.cargoCap - cargo,
        need - cargo,
        Math.floor(Math.max(0, cash - 500) / s.planet.foodBuy),
      );
    }
    if (units !== 0) {
      out.push({ t: 'TradeFood', playerId: p.id, units });
      cash -= units * (units > 0 ? s.planet.foodBuy : s.planet.foodSell);
      cargo += units;
      tally.TradeFood++;
    }
  }

  if (pre) {
    out.push(...declarations(kennel, p));
    tally.Declare += RACE_CLASSES.length;
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

/** The Bookie screen: a stake inside the planet's cap, on the favourite and one outsider. */
function bettingTurn(s: GameState, p: Player, tally: Record<string, number>): Action[] {
  const out: Action[] = [];
  if (!s.fields) return [{ t: 'EndPhase', playerId: p.id }];
  const frac = maxStakeFraction(s);
  let cash = p.cash;
  for (const cls of RACE_CLASSES) {
    const already = s.bets
      .filter((b) => b.playerId === p.id && b.week === s.week && b.cls === cls)
      .reduce((sum, b) => sum + b.stake, 0);
    const cap = Math.floor(cash * frac);
    const room = Math.max(0, Math.min(cap - already, Math.floor(cash)));
    if (room < 50) continue;
    const runners = [...s.fields[cls]].sort((a, b) => b.winProb - a.winProb);
    const fav = runners[0];
    const outsider = runners[Math.min(3, runners.length - 1)];
    const stake = Math.min(100, room);
    if (fav) {
      out.push({ t: 'PlaceBet', playerId: p.id, cls, dogId: fav.dogId, kind: 'win', stake });
      cash -= stake;
      tally.PlaceBet++;
    }
    const room2 = Math.max(0, Math.min(Math.floor(cash * frac) - already - stake, Math.floor(cash)));
    if (outsider && outsider !== fav && room2 >= 50) {
      const stake2 = Math.min(50, room2);
      out.push({
        t: 'PlaceBet',
        playerId: p.id,
        cls,
        dogId: outsider.dogId,
        kind: 'place',
        stake: stake2,
      });
      cash -= stake2;
      tally.PlaceBet++;
    }
  }
  out.push({ t: 'EndPhase', playerId: p.id });
  return out;
}

function playSeason(seed: number, toggles?: SeasonSetup['toggles']) {
  const setup: SeasonSetup = {
    seed,
    ...(toggles ? { toggles } : {}),
    players: [
      { name: 'Jesse', kind: 'human' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
      { name: '', kind: 'ai', difficulty: 'normal' },
    ],
  };
  const tally: Record<string, number> = {
    BuyDog: 0,
    SellDog: 0,
    Declare: 0,
    PlaceBet: 0,
    TradeFood: 0,
    HireStaff: 0,
    FireStaff: 0,
    SetTraining: 0,
    BuyUpgrade: 0,
    Borrow: 0,
    Repay: 0,
    ResolveEvent: 0,
  };
  const screens: Record<string, number> = {};

  let state = createSeason(setup);
  const log: Action[] = [];
  drive(state, log);
  const ui: ScreenUi = { resultsSeenWeek: 0, passAck: null };

  for (let step = 0; step < 20000; step++) {
    const screen = screenFor(state, ui);
    screens[screen.kind] = (screens[screen.kind] ?? 0) + 1;
    if (screen.kind === 'seasonEnd') {
      const human = state.players.find((p) => p.id === HUMAN)!;
      const rehearsed = replay(createSeason(setup), log);
      if (JSON.stringify(rehearsed) !== JSON.stringify(state))
        throw new Error(`seed ${seed}: replaying the log did not reproduce the season`);
      return { state, log, tally, screens, human };
    }
    if (screen.kind === 'noHuman') throw new Error(`seed ${seed}: lost the human stable`);
    const me = screen.me!;
    if (screen.kind === 'results') {
      ui.resultsSeenWeek = state.week;
      continue;
    }
    if (screen.kind === 'pass') {
      ui.passAck = me.id;
      continue;
    }
    let actions: Action[];
    if (state.pendingEvent && state.pendingEvent.playerId === me.id) {
      actions = [
        { t: 'ResolveEvent', playerId: me.id, choice: state.week % state.pendingEvent.choices.length },
      ];
      tally.ResolveEvent++;
    } else if (screen.kind === 'betting') {
      actions = bettingTurn(state, me, tally);
    } else {
      actions = planetTurn(state, me, tally);
    }
    const applied = applyActions(state, actions);
    state = applied.state;
    log.push(...applied.added);
  }
  throw new Error(`seed ${seed}: the season never ended`);
}

const seeds = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const toRun = seeds.length ? seeds : [42, 7, 1234, 90210];
let failures = 0;
for (const seed of toRun) {
  const variants: [string, SeasonSetup['toggles'] | undefined][] =
    seed === toRun[0]
      ? [
          ['default toggles', undefined],
          ['clean sport, no betting, no trading, casual events', {
            cleanSport: true,
            betting: false,
            trading: false,
            casualEvents: true,
          }],
        ]
      : [['default toggles', undefined]];
  for (const [label, toggles] of variants) {
    try {
      const { state, log, tally, screens, human } = playSeason(seed, toggles);
      const worth = state.finalStandings?.find((f) => f.playerId === HUMAN)?.netWorth ?? 0;
      const rank = (state.finalStandings ?? []).findIndex((f) => f.playerId === HUMAN) + 1;
      const missing = Object.entries(tally)
        .filter(([, n]) => n === 0)
        .map(([k]) => k);
      console.log(
        `seed ${seed} (${label}): finished week ${state.week}, ${log.length} actions, ` +
          `${human.name} ${rank}/${state.players.length} on ${worth.toLocaleString('en-NZ')} Bones`,
      );
      console.log(
        `  actions: ${Object.entries(tally)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}`,
      );
      console.log(
        `  screens: ${Object.entries(screens)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}${missing.length ? `\n  never used: ${missing.join(', ')}` : ''}`,
      );
      // Fuel and value helpers are display-only in the UI; check they still line up.
      if (fuelCost(0) !== balance.fuelBase) throw new Error('fuelCost drifted from balance.json');
      if (bettingMargin(state) <= 0) throw new Error('betting margin went to zero');
    } catch (e) {
      failures++;
      console.error(`seed ${seed} (${label}) FAILED: ${(e as Error).message}`);
    }
  }
}
console.log(failures ? `\n${failures} season(s) failed` : '\nAll seasons played out clean.');
process.exit(failures ? 1 : 0);
