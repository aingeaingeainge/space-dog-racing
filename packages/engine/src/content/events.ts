import { balance } from './balance';
import { planetOf } from './planets';

import { good, STAPLE_ID } from './goods';
import { type IdGen } from '../economy/dogs';
import { cargoTotal, emptyHold, spoilCargo, HOLD_CAP } from '../economy/goods';
import { describeTaste } from '../economy/food';
import { winProbAgainst } from '../race/odds';
import { clamp, type Rng } from '../rng';
import type { Dog, GameState, GoodId, Id, Planet, Player, StatKey } from '../types';
import { GOOD_IDS, STAT_KEYS } from '../types';

export type EventParams = Record<string, number | string>;

export interface EventCtx {
  s: GameState;
  rng: Rng;
  nextId: IdGen;
  p: Player;
  planet: Planet;
  params: EventParams;
  log: (text: string) => void;
}

export interface EventChoice {
  label: string;
  apply: (ctx: EventCtx) => void;
}

export interface EventCard {
  id: Id;
  name: string;
  text: string;
  weight: number;
  /** 'flavour' | 'choice' | 'swing' — swings are excluded by the Casual events toggle. */
  kind: 'flavour' | 'choice' | 'swing';
  /** Planet ids where this card is more likely; the weight is multiplied by `planetBoost`. */
  planets?: Id[];
  planetBoost?: number;
  /** Return rolled parameters, or null if the card cannot apply to this player right now. */
  roll?: (ctx: Omit<EventCtx, 'params' | 'log'>) => EventParams | null;
  choices: EventChoice[];
  /** Which choice a Normal AI takes (default 0). */
  aiChoice?: (ctx: EventCtx) => number;
}

const ownDogs = (s: GameState, p: Player): Dog[] =>
  p.dogIds.map((id) => s.dogs[id]!).filter(Boolean);
const randomDog = (ctx: { s: GameState; p: Player; rng: Rng }): Dog | undefined => {
  const dogs = ownDogs(ctx.s, ctx.p);
  return dogs.length ? ctx.rng.pick(dogs) : undefined;
};
// What the hold is worth at this planet's *buy* prices — what a customs officer would tax, which
// is not the same as the sell-side valuation net worth uses.
const holdValue = (ctx: { s: GameState; p: Player }): number => {
  let total = 0;
  for (const id of GOOD_IDS) total += ctx.p.cargo[id] * ctx.s.planet.goods[id].buy;
  return Math.round(total);
};
const crates = (ctx: { p: Player }): number => cargoTotal(ctx.p.cargo);
/** Move one good's buy and sell price on this planet until the field leaves. */
/**
 * Move one good's price on this planet by a factor, **inside its §6.1 band**.
 *
 * ⚠️ Clamped since v3 Phase B, because the band became a hard global range: every good is exactly
 * 8× from floor to ceiling on every planet (GDD_V3 §6.1), and §6.4's whole guard on the p99 trading
 * leg is that no price escapes it. An event that doubled a price already near the ceiling would be
 * the one way left to break that, so the event moves the price as far as the band allows and no
 * further. The sell price is re-derived from the buy rather than scaled separately, so the spread
 * stays `foodSpread` exactly — the same rule the weekly draw keeps.
 */
const scaleGood = (ctx: { s: GameState }, id: GoodId, mult: number): void => {
  const m = ctx.s.planet.goods[id];
  const g = good(id);
  m.buy = clamp(Math.round(m.buy * mult), g.floor, g.ceiling);
  m.sell = Math.max(1, Math.round(m.buy * (1 - balance.foodSpread)));
};
const fit = (d: Dog, delta: number) => {
  d.fitness = clamp(Math.round(d.fitness + delta), 0, 100);
};

export const EVENTS: readonly EventCard[] = [
  {
    id: 'customsShakedown',
    name: 'Customs shakedown',
    text: 'Customs officers with very shiny boots take an interest in your cargo.',
    weight: 5,
    kind: 'choice',
    roll: (ctx) => (crates(ctx) > 0 ? { cargo: crates(ctx) } : null),
    choices: [
      {
        label: 'Pay 10% of cargo value',
        apply: (ctx) => {
          const fee = Math.round(holdValue(ctx) * 0.1);
          ctx.p.cash -= fee;
          ctx.p.stats.costs += fee;
          ctx.log(`Paid ${fee} to customs.`);
        },
      },
      {
        label: 'Refuse — lose 30% of cargo',
        apply: (ctx) => {
          const lost = spoilCargo(ctx.p.cargo, 0.3);
          ctx.log(`Customs "confiscate" ${lost} crates.`);
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > holdValue(ctx) * 0.1 ? 0 : 1),
  },
  {
    id: 'sponsorGlorbo',
    name: "Sponsor: Glorbo's Meat Paste",
    text: "Glorbo's Meat Paste offers 1,500 Bones if your dogs wear the logo — and eat the paste — for two weeks.",
    weight: 4,
    kind: 'choice',
    choices: [
      {
        label: 'Take the money (+1,500; dogs eat double for 2 weeks)',
        apply: (ctx) => {
          ctx.p.cash += 1500;
          ctx.p.sponsorWeeks = 2;
          ctx.log("Glorbo's pays 1,500. The dogs look hideous and hungry.");
        },
      },
      { label: 'Decline', apply: (ctx) => ctx.log("You turn Glorbo's down.") },
    ],
  },
  {
    id: 'kennelCough',
    name: 'Kennel cough',
    text: 'A rattling cough goes round the kennels.',
    weight: 6,
    kind: 'flavour',
    roll: (ctx) => {
      const d = randomDog(ctx);
      return d ? { dogId: d.id } : null;
    },
    choices: [
      {
        label: 'Oh dear',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          // No vet to soften it any more (BUILD_PLAN_V3 §2.1). Phase D's staff bonuses (GDD_V3
          // §8.2) include "injury chance halved" and "+5 fitness recovery", which is where a hire
          // gets to matter here again.
          fit(d, -20);
          ctx.log(`${d.name} has kennel cough (−20 fitness).`);
        },
      },
    ],
  },
  {
    id: 'solarFlare',
    name: 'Solar flare',
    text: 'A solar flare scrambles every ship’s approach. Turn order is rerolled.',
    weight: 3,
    kind: 'flavour',
    choices: [
      {
        label: 'Hold on',
        apply: (ctx) => {
          ctx.rng.shuffle(ctx.s.turnOrder);
          for (const id of ctx.s.turnOrder) ctx.s.turnOrderReason[id] = 'solar flare';
          ctx.log('Turn order rerolled by a solar flare.');
        },
      },
    ],
  },
  {
    id: 'tipOff',
    name: 'Tip-off',
    text: 'A whisper in the saloon: one of the local dogs is "not trying" this week.',
    weight: 4,
    kind: 'flavour',
    choices: [
      {
        label: 'Interesting',
        apply: (ctx) => {
          ctx.p.flags.tipOff = true;
          ctx.log('You hear a local runner is not trying. The bookie’s odds will be wrong.');
        },
      },
    ],
  },
  {
    id: 'kibbleGlut',
    name: 'Mash glut',
    text: 'A bumper harvest: Grey Mash is half price here until you leave.',
    weight: 4,
    kind: 'flavour',
    choices: [
      {
        label: 'Stock up',
        apply: (ctx) => {
          // The glut is in the staple, so it moves that one shelf and leaves the other five alone —
          // a bumper harvest of Grey Mash is not a sale on Ambrosia. The id stays `kibbleGlut`
          // because it is a save-file and asset key; Phase D rewrites the deck.
          scaleGood(ctx, STAPLE_ID, 0.5);
          ctx.log('Mash glut: Grey Mash prices halved on this planet.');
        },
      },
    ],
  },
  {
    id: 'kibbleShortage',
    name: 'Mash shortage',
    text: 'The Grey Mash freighter never arrived. Prices double here until you leave.',
    weight: 4,
    kind: 'flavour',
    choices: [
      {
        label: 'Typical',
        apply: (ctx) => {
          scaleGood(ctx, STAPLE_ID, 2);
          ctx.log('Mash shortage: Grey Mash prices doubled on this planet.');
        },
      },
    ],
  },
  {
    id: 'fanClub',
    name: 'Fan club',
    text: 'One of your winners has a fan club. They send 200 a week while the wins keep coming.',
    weight: 3,
    kind: 'flavour',
    roll: (ctx) => {
      const d = ownDogs(ctx.s, ctx.p).find((x) => x.wins >= 3);
      return d && !ctx.p.fanClubDogId ? { dogId: d.id } : null;
    },
    choices: [
      {
        label: 'Wave to the fans',
        apply: (ctx) => {
          ctx.p.fanClubDogId = String(ctx.params['dogId']);
          ctx.log(`${ctx.s.dogs[ctx.p.fanClubDogId]?.name ?? 'Your dog'} has a fan club.`);
        },
      },
    ],
  },
  {
    id: 'pirates',
    name: 'Pirates!',
    text: 'Kibble pirates match your course. Hand over half the hold, or fight.',
    weight: 3,
    kind: 'swing',
    planets: ['drift'],
    planetBoost: 3,
    roll: (ctx) => (crates(ctx) > 0 ? {} : null),
    choices: [
      {
        label: 'Hand over 50% of cargo',
        apply: (ctx) => {
          const lost = spoilCargo(ctx.p.cargo, 0.5);
          ctx.log(`Pirates take ${lost} crates.`);
        },
      },
      {
        label: 'Fight (60% keep everything)',
        apply: (ctx) => {
          if (ctx.rng.chance(0.6)) {
            ctx.log('You fight off the pirates and keep the lot.');
          } else {
            const lost = emptyHold(ctx.p.cargo);
            ctx.log(`The pirates win: ${lost} crates gone.`);
          }
        },
      },
    ],
    aiChoice: () => 0,
  },
  {
    id: 'wormhole',
    name: 'Wormhole shortcut',
    text: 'Your navigator finds a wormhole. You will arrive first next week regardless.',
    weight: 3,
    kind: 'flavour',
    choices: [
      {
        label: 'Punch it',
        apply: (ctx) => {
          ctx.p.flags.arriveFirstNextWeek = true;
          ctx.log('Wormhole found: you arrive first next week.');
        },
      },
    ],
  },
  {
    id: 'localDerby',
    name: 'Local derby',
    text: 'The locals run an exhibition race with a 400 purse. Your least-raced dog can have a go — no rating change.',
    weight: 3,
    kind: 'flavour',
    roll: (ctx) => {
      const d = ownDogs(ctx.s, ctx.p)
        .filter((x) => x.injuryWeeks === 0)
        .sort((a, b) => a.rating - b.rating)[0];
      return d ? { dogId: d.id } : null;
    },
    choices: [
      {
        label: 'Run it',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          const p = winProbAgainst(d.rating, [35, 35, 35, 35, 35, 35, 35]);
          if (ctx.rng.chance(p)) {
            ctx.p.cash += 400;
            ctx.p.stats.prizeIncome += 400;
            ctx.log(`${d.name} wins the local derby (+400).`);
          } else ctx.log(`${d.name} loses the local derby. Good practice.`);
          fit(d, -6);
        },
      },
    ],
  },
  {
    id: 'spaceFleas',
    name: 'Space fleas',
    text: 'Space fleas in the bedding. Every dog −5 fitness.',
    weight: 5,
    kind: 'flavour',
    choices: [
      {
        label: 'Scratch',
        apply: (ctx) => {
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, -5);
          ctx.log('Space fleas: all dogs −5 fitness.');
        },
      },
    ],
  },
  {
    id: 'goodPress',
    name: 'Good press',
    text: 'A racing rag runs a flattering profile of your stable. A sponsor sends 500.',
    weight: 5,
    kind: 'flavour',
    choices: [
      {
        label: 'Frame it',
        apply: (ctx) => {
          ctx.p.cash += 500;
          ctx.log('Good press: +500.');
        },
      },
    ],
  },
  {
    id: 'cargoSpoiled',
    name: 'Spoiled cargo',
    text: 'The hold got warm. A quarter of your food has gone green.',
    weight: 4,
    kind: 'flavour',
    roll: (ctx) => (crates(ctx) > 0 ? {} : null),
    choices: [
      {
        label: 'Ugh',
        apply: (ctx) => {
          const lost = spoilCargo(ctx.p.cargo, 0.25);
          ctx.log(`${lost} crates spoiled.`);
        },
      },
    ],
  },
  {
    id: 'freeKibble',
    name: 'Fallen off a freighter',
    text: 'Five crates of Grey Mash drift past your airlock. Nobody is looking.',
    weight: 4,
    kind: 'flavour',
    roll: (ctx) => (crates(ctx) + 5 <= HOLD_CAP ? {} : null),
    choices: [
      {
        label: 'Haul them in',
        apply: (ctx) => {
          ctx.p.cargo[STAPLE_ID] += 5;
          ctx.log('+5 crates of mystery Grey Mash.');
        },
      },
    ],
  },
  {
    id: 'lostLuggage',
    name: 'Lost luggage',
    text: 'The spaceport lost your kennel gear. Replacing it costs 300.',
    weight: 5,
    kind: 'flavour',
    choices: [
      {
        label: 'Sigh',
        apply: (ctx) => {
          ctx.p.cash -= 300;
          ctx.p.stats.costs += 300;
          ctx.log('Lost luggage: −300.');
        },
      },
    ],
  },
  {
    id: 'mysteryBenefactor',
    name: 'Mystery benefactor',
    text: 'An anonymous fan pays for a week at a fancy training camp.',
    weight: 4,
    kind: 'flavour',
    roll: (ctx) => {
      const d = randomDog(ctx);
      return d ? { dogId: d.id, stat: ctx.rng.pick(STAT_KEYS) } : null;
    },
    choices: [
      {
        label: 'Lovely',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          const stat = String(ctx.params['stat']) as StatKey;
          if (!d) return;
          d[stat] = clamp(d[stat] + 2, 1, 99);
          ctx.log(`${d.name} +2 ${stat} from a mystery benefactor.`);
        },
      },
    ],
  },
  {
    id: 'secondWind',
    name: 'Second wind',
    text: 'One of your dogs has been bouncing off the walls all week.',
    weight: 4,
    kind: 'flavour',
    roll: (ctx) => {
      const d = randomDog(ctx);
      return d ? { dogId: d.id } : null;
    },
    choices: [
      {
        label: 'Good dog',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          d.form = clamp(d.form + 5, -balance.formMax, balance.formMax);
          ctx.log(`${d.name} is in great form (+5).`);
        },
      },
    ],
  },
  {
    id: 'monksBlessing',
    name: "The monks' blessing",
    text: 'Monks of the Good Boy bless your kennel. Every dog +10 fitness.',
    weight: 2,
    kind: 'flavour',
    planets: ['holyBark'],
    planetBoost: 6,
    choices: [
      {
        label: 'Bow',
        apply: (ctx) => {
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, 10);
          ctx.log('Blessed: all dogs +10 fitness.');
        },
      },
    ],
  },
  {
    id: 'kidnappedByFans',
    name: 'Kidnapped by fans',
    text: 'Over-excited fans "borrow" one of your dogs for a party. It comes back dizzy — unless you send a taxi (400).',
    weight: 3,
    kind: 'choice',
    roll: (ctx) => {
      const d = randomDog(ctx);
      return d ? { dogId: d.id } : null;
    },
    choices: [
      {
        label: 'Send a taxi (−400)',
        apply: (ctx) => {
          ctx.p.cash -= 400;
          ctx.p.stats.costs += 400;
          ctx.log('A taxi brings the dog home in one piece (−400).');
        },
      },
      {
        label: 'Let it party (−15 fitness)',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          fit(d, -15);
          ctx.log(`${d.name} comes home at dawn, −15 fitness.`);
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 2000 ? 0 : 1),
  },
  {
    id: 'luckyBone',
    name: 'Lucky bone',
    text: 'A dog digs up a suspiciously glowing bone. It seems… faster.',
    weight: 4,
    kind: 'flavour',
    roll: (ctx) => {
      const d = randomDog(ctx);
      return d ? { dogId: d.id } : null;
    },
    choices: [
      {
        label: 'Let it keep it',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          d.raceBonus += 4;
          ctx.log(`${d.name} has a lucky bone: +4 speed this weekend.`);
        },
      },
    ],
  },
  {
    id: 'casinoComp',
    name: 'Casino comp',
    text: 'The casino comps you a suite and a stack of chips for being a "valued guest".',
    weight: 2,
    kind: 'flavour',
    planets: ['neonSnout', 'collarPrime'],
    planetBoost: 6,
    choices: [
      {
        label: 'Cash the chips (+400)',
        apply: (ctx) => {
          ctx.p.cash += 400;
          ctx.log('Casino comp: +400.');
        },
      },
    ],
  },
  {
    id: 'dustStorm',
    name: 'Dust storm',
    text: 'A dust storm keeps everyone indoors coughing. Every dog −5 fitness.',
    weight: 1,
    kind: 'flavour',
    planets: ['sunbleach', 'rustgut'],
    planetBoost: 8,
    choices: [
      {
        label: 'Cover your snout',
        apply: (ctx) => {
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, -5);
          ctx.log('Dust storm: all dogs −5 fitness.');
        },
      },
    ],
  },
  {
    id: 'quietWeek',
    name: 'Quiet week',
    text: 'Nothing happens. The dogs sleep. It is lovely.',
    weight: 6,
    kind: 'flavour',
    choices: [{ label: 'Enjoy it', apply: (ctx) => ctx.log('A quiet week.') }],
  },

  // -------------------------------------------------------------------------------------------
  // §9.3's third carrier: information, sold from the deck. Phase B's debt, deferred twice.
  //
  // ⚠️ **These are the reason the fog has a fourth price, and they are the only carrier that can
  // be wrong.** §9.3's table gives four ways to see past next week — a free Saloon rumour that may
  // be wrong, a 650 dossier that is exact, a Tipster's standing wage, and the deck: "varies /
  // usually exact, sometimes a lie / varies". Three shipped in Phases B and C; this is the fourth,
  // and what it adds that the others cannot is a **price you did not choose and a source you
  // cannot check**. A dossier is a purchase; a drunk navigator is an offer.
  //
  // They add nothing to `GameState`, exactly as the dossier does not (D5, D36): the circuit is
  // already in `calendar` and the fog is a rule about who may look, so what a card sells is a log
  // line addressed to the buyer. A card that lies writes a line that is wrong, and nothing
  // anywhere marks it — which is the whole of "sometimes a lie".
  // -------------------------------------------------------------------------------------------
  {
    id: 'drunkNavigator',
    name: 'A navigator, three sheets to the wind',
    text: 'A freighter navigator is telling the whole bar where the circuit goes after next week. He will tell you properly for a drink or two.',
    weight: 4,
    kind: 'choice',
    // Only while there is a week past the free horizon left to sell.
    //
    // ⚠️ **The price and the reach are the card's own now (BUILD_PLAN_V3 §2.1).** They were
    // `dossierCost` and `dossierReach`, and the dossier is deleted. GDD_V3 §9.4 keeps information but
    // moves it into Bar events like this one, and says it has exactly one use: knowing whether next
    // week's planet buys your food high. That makes it a number about *this card* rather than a
    // global tunable, which is also the shape Phase D's eighty events need.
    roll: (ctx) => (ctx.s.calendar[ctx.s.week + 1] ? { price: 260 } : null),
    choices: [
      {
        label: 'Buy him a drink',
        apply: (ctx) => {
          const price = Number(ctx.params.price ?? 0);
          if (ctx.p.cash < price) {
            ctx.log('You cannot even afford the drink. He wanders off.');
            return;
          }
          ctx.p.cash -= price;
          ctx.p.stats.costs += price;
          const week = ctx.s.week + 2;
          const entry = ctx.s.calendar[week - 1]!;
          const ahead = planetOf(entry.planetId);
          // No card to sell: the same three races run every weekend now (GDD_V3 §7.1), so what is
          // worth buying is the planet and its food map — which is precisely §9.4's one use.
          ctx.log(
            `Week ${week} (${price} and two drinks): ${ahead.name}${entry.major ? ` — ${ahead.event}` : ''}. ` +
              `Food there is ${describeTaste(ahead)}.`,
          );
        },
      },
      { label: 'Leave him to it', apply: (ctx) => ctx.log('You leave him to it.') },
    ],
    // Worth it to a stable with a hold to price and cash to spare — which is the trader's road,
    // and the same test `tradeFoodPlan` applies to a leg.
    aiChoice: (ctx) =>
      ctx.p.cash > Number(ctx.params.price ?? 0) * 6 && cargoTotal(ctx.p.cargo) > 10 ? 0 : 1,
  },
  {
    id: 'customsManifest',
    name: 'A clerk with a manifest',
    text: 'A customs clerk has the freight manifests for the run after next. He is not supposed to show anyone. He would like 200 Bones.',
    weight: 4,
    kind: 'choice',
    roll: (ctx) => {
      const entry = ctx.s.calendar[ctx.s.week + 1];
      if (!entry) return null;
      // ⚠️ The lie is rolled **when the card is drawn**, not when the choice is taken, so that a
      // human and an AI facing the same card face the same manifest — and so that the rng stream
      // does not depend on which choice a player happens to make.
      return { lying: ctx.rng.chance(0.25) ? 1 : 0, drift: ctx.rng.int(-25, 25) };
    },
    choices: [
      {
        label: 'Slip him 200',
        apply: (ctx) => {
          if (ctx.p.cash < 200) {
            ctx.log('He looks at your pockets and thinks better of it.');
            return;
          }
          ctx.p.cash -= 200;
          ctx.p.stats.costs += 200;
          const week = ctx.s.week + 2;
          const ahead = planetOf(ctx.s.calendar[week - 1]!.planetId);
          // ⚠️ v3 Phase B: `foodBand` is a per-good map now, not a price band, so the lie is an
          // inverted map rather than a band nudged by `drift`. `drift` is still rolled when the card
          // is drawn — removing it would shift the rng stream for a Phase D rewrite to inherit.
          const lying = Number(ctx.params.lying) === 1;
          ctx.log(`Manifest, week ${week}: food out there is ${describeTaste(ahead, lying)}.`);
        },
      },
      { label: 'Not interested', apply: (ctx) => ctx.log('The clerk shrugs and rolls it up.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 2000 && cargoTotal(ctx.p.cargo) > 10 ? 0 : 1),
  },
];

export const EVENT_BY_ID: Record<Id, EventCard> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
