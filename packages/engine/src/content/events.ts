import { balance } from './balance';
import { TRAIT_IDS } from './traits';
import { createDog, type IdGen } from '../economy/market';
import { dogValue } from '../economy/dogValue';
import { outstanding } from '../economy/loans';
import { winProbAgainst } from '../race/odds';
import { clamp, type Rng } from '../rng';
import type { Dog, GameState, Id, Planet, Player, StatKey } from '../types';
import { STAT_KEYS } from '../types';

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
const bestDog = (s: GameState, p: Player): Dog | undefined =>
  ownDogs(s, p).sort((a, b) => dogValue(b) - dogValue(a))[0];
const randomDog = (ctx: { s: GameState; p: Player; rng: Rng }): Dog | undefined => {
  const dogs = ownDogs(ctx.s, ctx.p);
  return dogs.length ? ctx.rng.pick(dogs) : undefined;
};
const cargoValue = (ctx: EventCtx) => Math.round(ctx.p.cargo * ctx.s.planet.foodBuy);
const fit = (d: Dog, delta: number) => {
  d.fitness = clamp(Math.round(d.fitness + delta), 0, 100);
};

export const EVENTS: readonly EventCard[] = [
  {
    id: 'stowawayPup',
    name: 'Stowaway pup',
    text: 'A scrawny pup has hidden in your hold, chewing a crate of kibble.',
    weight: 6,
    kind: 'choice',
    choices: [
      {
        label: 'Keep it (needs a kennel slot)',
        apply: (ctx) => {
          if (ctx.p.dogIds.length >= ctx.p.kennelSlots) {
            ctx.p.cash += 300;
            ctx.log('No room in the kennels — the pound takes the stowaway (+300).');
            return;
          }
          const pup = createDog(
            { quality: 25, age: 1, owner: ctx.p.id, traits: [ctx.rng.pick(TRAIT_IDS)] },
            ctx.rng,
            ctx.nextId,
          );
          ctx.s.dogs[pup.id] = pup;
          ctx.p.dogIds.push(pup.id);
          ctx.log(`${pup.name} joins the kennel.`);
        },
      },
      {
        label: 'Hand it to the pound (+300)',
        apply: (ctx) => {
          ctx.p.cash += 300;
          ctx.log('The pound pays 300 for the stowaway.');
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.dogIds.length < ctx.p.kennelSlots && ctx.p.cash > 4000 ? 0 : 1),
  },
  {
    id: 'customsShakedown',
    name: 'Customs shakedown',
    text: 'Customs officers with very shiny boots take an interest in your cargo.',
    weight: 5,
    kind: 'choice',
    roll: (ctx) => (ctx.p.cargo > 0 ? { cargo: ctx.p.cargo } : null),
    choices: [
      {
        label: 'Pay 10% of cargo value',
        apply: (ctx) => {
          const fee = Math.round(cargoValue(ctx) * 0.1);
          ctx.p.cash -= fee;
          ctx.p.stats.costs += fee;
          ctx.log(`Paid ${fee} to customs.`);
        },
      },
      {
        label: 'Refuse — lose 30% of cargo',
        apply: (ctx) => {
          const lost = Math.ceil(ctx.p.cargo * 0.3);
          ctx.p.cargo -= lost;
          ctx.log(`Customs "confiscate" ${lost} crates.`);
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > cargoValue(ctx) * 0.1 ? 0 : 1),
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
          const delta = ctx.p.staff.vet ? -5 : -20;
          fit(d, delta);
          ctx.log(
            `${d.name} has kennel cough (${delta} fitness${ctx.p.staff.vet ? ', the vet helped' : ''}).`,
          );
        },
      },
    ],
  },
  {
    id: 'talentScout',
    name: 'Talent scout',
    text: 'A rival stable’s scout offers 120% of value for your best dog.',
    weight: 4,
    kind: 'swing',
    roll: (ctx) => {
      const d = bestDog(ctx.s, ctx.p);
      return d && ctx.p.dogIds.length > 1
        ? { dogId: d.id, offer: Math.round(dogValue(d) * 1.2) }
        : null;
    },
    choices: [
      {
        label: 'Sell',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          const offer = Number(ctx.params['offer']);
          ctx.p.cash += offer;
          ctx.p.stats.dogsSold++;
          ctx.p.dogIds = ctx.p.dogIds.filter((id) => id !== d.id);
          delete ctx.s.dogs[d.id];
          ctx.log(`Sold ${d.name} to the scout for ${offer}.`);
        },
      },
      { label: 'Not for sale', apply: (ctx) => ctx.log('You send the scout packing.') },
    ],
    aiChoice: () => 1,
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
    id: 'dodgySteward',
    name: 'Dodgy steward',
    text: 'A steward with a gambling problem offers, for 800, to draw your Gold rival’s best dog in trap 8.',
    weight: 3,
    kind: 'choice',
    roll: (ctx) => (ctx.s.toggles.cleanSport || ctx.p.cash < 800 ? null : {}),
    choices: [
      {
        label: 'Pay 800',
        apply: (ctx) => {
          ctx.p.cash -= 800;
          ctx.p.stats.costs += 800;
          ctx.p.flags.rivalTrap8 = true;
          ctx.log('The steward pockets 800 and winks.');
        },
      },
      { label: 'No thanks', apply: (ctx) => ctx.log('You keep your hands clean.') },
    ],
    aiChoice: () => 1,
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
    id: 'fatTonyFavour',
    name: 'Fat Tony calls in a favour',
    text: 'Fat Tony Nebula wants double interest now — or he takes your best dog.',
    weight: 4,
    kind: 'swing',
    roll: (ctx) => {
      const owed = outstanding(ctx.p, 'shark');
      const d = bestDog(ctx.s, ctx.p);
      return owed > 0 && d ? { due: Math.round(owed * balance.sharkRate * 2), dogId: d.id } : null;
    },
    choices: [
      {
        label: 'Pay double interest',
        apply: (ctx) => {
          const due = Number(ctx.params['due']);
          ctx.p.cash -= due;
          ctx.p.stats.costs += due;
          ctx.log(`Paid Fat Tony ${due}.`);
        },
      },
      {
        label: 'Refuse',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          ctx.p.dogIds = ctx.p.dogIds.filter((id) => id !== d.id);
          delete ctx.s.dogs[d.id];
          ctx.log(`Fat Tony’s boys walk off with ${d.name}.`);
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash >= Number(ctx.params['due']) ? 0 : 1),
  },
  {
    id: 'kibbleGlut',
    name: 'Kibble glut',
    text: 'A bumper harvest: kibble is half price here until you leave.',
    weight: 4,
    kind: 'flavour',
    choices: [
      {
        label: 'Stock up',
        apply: (ctx) => {
          ctx.s.planet.foodMod = 0.5;
          ctx.s.planet.foodBuy = Math.max(1, Math.round(ctx.s.planet.foodBuy * 0.5));
          ctx.s.planet.foodSell = Math.max(1, Math.round(ctx.s.planet.foodSell * 0.5));
          ctx.log('Kibble glut: food prices halved on this planet.');
        },
      },
    ],
  },
  {
    id: 'kibbleShortage',
    name: 'Kibble shortage',
    text: 'The kibble freighter never arrived. Prices double here until you leave.',
    weight: 4,
    kind: 'flavour',
    choices: [
      {
        label: 'Typical',
        apply: (ctx) => {
          ctx.s.planet.foodMod = 2;
          ctx.s.planet.foodBuy = Math.round(ctx.s.planet.foodBuy * 2);
          ctx.s.planet.foodSell = Math.round(ctx.s.planet.foodSell * 2);
          ctx.log('Kibble shortage: food prices doubled on this planet.');
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
    roll: (ctx) => (ctx.p.cargo > 0 ? {} : null),
    choices: [
      {
        label: 'Hand over 50% of cargo',
        apply: (ctx) => {
          const lost = Math.ceil(ctx.p.cargo * 0.5);
          ctx.p.cargo -= lost;
          ctx.log(`Pirates take ${lost} crates.`);
        },
      },
      {
        label: 'Fight (60% keep everything)',
        apply: (ctx) => {
          if (ctx.rng.chance(0.6)) {
            ctx.log('You fight off the pirates and keep the lot.');
          } else {
            const lost = ctx.p.cargo;
            ctx.p.cargo = 0;
            ctx.p.ship.speed = Math.max(1, ctx.p.ship.speed - 1);
            ctx.log(`The pirates win: ${lost} crates gone and an engine tier shot out.`);
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
    id: 'retirementOffer',
    name: 'Retirement offer',
    text: 'A stud farm offers 150% of value for one of your older dogs.',
    weight: 3,
    kind: 'choice',
    roll: (ctx) => {
      const d = ownDogs(ctx.s, ctx.p)
        .filter((x) => x.age >= 5)
        .sort((a, b) => dogValue(b) - dogValue(a))[0];
      return d ? { dogId: d.id, offer: Math.round(dogValue(d) * 1.5) } : null;
    },
    choices: [
      {
        label: 'Accept',
        apply: (ctx) => {
          const d = ctx.s.dogs[String(ctx.params['dogId'])];
          if (!d) return;
          const offer = Number(ctx.params['offer']);
          ctx.p.cash += offer;
          ctx.p.stats.dogsSold++;
          ctx.p.dogIds = ctx.p.dogIds.filter((id) => id !== d.id);
          delete ctx.s.dogs[d.id];
          ctx.log(`${d.name} retires to the stud farm for ${offer}.`);
        },
      },
      { label: 'Decline', apply: (ctx) => ctx.log('Not yet.') },
    ],
    aiChoice: (ctx) => (ctx.p.dogIds.length > 3 ? 0 : 1),
  },
  {
    id: 'localDerby',
    name: 'Local derby',
    text: 'The locals run an exhibition race with a 400 purse. Your best reserve can have a go — no rating change.',
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
    id: 'trainerPoached',
    name: "Rival's trainer poached",
    text: 'A rival stable is trying to hire your trainer away. Match the offer (+100 this week) or lose them.',
    weight: 4,
    kind: 'choice',
    roll: (ctx) => (ctx.p.staff.trainer ? {} : null),
    choices: [
      {
        label: 'Match it (−100)',
        apply: (ctx) => {
          ctx.p.cash -= 100;
          ctx.p.stats.costs += 100;
          ctx.log('You match the offer; the trainer stays.');
        },
      },
      {
        label: 'Let them go',
        apply: (ctx) => {
          delete ctx.p.staff.trainer;
          ctx.log('Your trainer leaves for a rival stable.');
        },
      },
    ],
    aiChoice: () => 0,
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
    text: 'The hold got warm. A quarter of your kibble has gone green.',
    weight: 4,
    kind: 'flavour',
    roll: (ctx) => (ctx.p.cargo > 0 && !ctx.p.ship.coldStore ? {} : null),
    choices: [
      {
        label: 'Ugh',
        apply: (ctx) => {
          const lost = Math.ceil(ctx.p.cargo * 0.25);
          ctx.p.cargo -= lost;
          ctx.log(`${lost} crates spoiled. A cold store would have saved them.`);
        },
      },
    ],
  },
  {
    id: 'freeKibble',
    name: 'Fallen off a freighter',
    text: 'Five crates of kibble drift past your airlock. Nobody is looking.',
    weight: 4,
    kind: 'flavour',
    roll: (ctx) => (ctx.p.cargo + 5 <= ctx.p.ship.cargoCap ? {} : null),
    choices: [
      {
        label: 'Haul them in',
        apply: (ctx) => {
          ctx.p.cargo += 5;
          ctx.log('+5 crates of mystery kibble.');
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
    id: 'engineTrouble',
    name: 'Engine trouble',
    text: 'The port nacelle is making a noise like a bag of spanners. Repair for 500, or limp on.',
    weight: 4,
    kind: 'choice',
    roll: (ctx) => (ctx.p.ship.speed > 1 ? {} : null),
    choices: [
      {
        label: 'Repair (−500)',
        apply: (ctx) => {
          ctx.p.cash -= 500;
          ctx.p.stats.costs += 500;
          ctx.log('Engine repaired for 500.');
        },
      },
      {
        label: 'Limp on (engine tier −1)',
        apply: (ctx) => {
          ctx.p.ship.speed = Math.max(1, ctx.p.ship.speed - 1);
          ctx.log('The nacelle gives out: engine tier −1.');
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 1500 ? 0 : 1),
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
];

export const EVENT_BY_ID: Record<Id, EventCard> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
