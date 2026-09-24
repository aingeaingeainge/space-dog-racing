/**
 * The Back Alley (GDD_V3 §9.1): trouble. Stolen food at 60%, a man with a pill, a sprint down a wet
 * alley for money, things that can go wrong. D2 adds the sabotage and the bought trap draw here.
 *
 * Every card here is a row: two or three choices or a bit of flavour, a choice for the Normal AI, a
 * line in the log, and a story somebody tells afterwards (pillar 3). Its numbers are the card's own.
 */
import { good } from '../goods';
import {
  addCrates,
  dogOf,
  earn,
  fit,
  fittest,
  formBy,
  goodName,
  heal,
  heldGoods,
  injure,
  ownDogs,
  pay,
  rollDog,
  spend,
  statBy,
  giveTip,
  rollTip,
  type EventCard,
  type EventChoice,
  luck,
  risk,
} from '../eventKit';
import { spoilCargo, HOLD_CAP, cargoTotal } from '../../economy/goods';
import { winProbAgainst } from '../../race/odds';
import { balance } from '../balance';
import { catchChanceHere, currentPlanet } from '../../state';
import { netWorth } from '../../economy/netWorth';
import { HARD_KNOBS } from '../../ai/knobs';
import type { Dog, GoodId } from '../../types';

/** What the steward wants for a box (GDD_V3 §9.3): the card's own price. */
const BOX_COST = 250;

/** Rival seats a nobble card can name: every other stable, up to seven. */
const RIVAL_SLOTS = 7;

/**
 * A Back Alley card that sells a nobble (GDD_V3 §9.3), **freely targetable**: a button per rival,
 * every one the same price. Explore comes before the Race Office, so the job is booked against a
 * rival's **dog**, not a race entry — the card names one of each rival's sound dogs, picked on this
 * stable's own stream ("he can get into one kennel per yard, and this is the dog in it"), and the job
 * bites if that dog runs this weekend: −25 fitness on race day, on the runner, after the book has
 * priced it. The stewards may catch it on race day (`stewardsEnquiry`), and if they do the whole
 * table is told.
 */
function nobbleCard(
  id: string,
  name: string,
  text: string,
  weight: number,
  cost: number,
  planets?: { ids: string[]; boost: number },
): EventCard {
  const target = (i: number): EventChoice => ({
    label: `Nobble rival ${i + 1}'s dog (−${cost})`,
    apply: (ctx) => {
      const d = ctx.s.dogs[String(ctx.params[`t${i}`] ?? '')];
      if (!d || !spend(ctx, cost)) return;
      ctx.s.jobs.push({ by: ctx.p.id, kind: 'nobble', dogId: d.id });
      ctx.p.stats.nobbles++;
      const owner = ctx.s.players.find((x) => x.id === d.ownerId);
      ctx.log(
        `The money changes hands. If ${d.name} (${owner?.name ?? 'a rival'}) runs this weekend, it runs on ${-balance.nobbleFitness} less than the card says. The stewards here catch about ${Math.round(catchChanceHere(ctx.s) * 100)}% of these.`,
      );
    },
  });
  return {
    id,
    name,
    text,
    weight,
    kind: 'choice',
    category: 'alley',
    ...(planets ? { planets: planets.ids, planetBoost: planets.boost } : {}),
    roll: (ctx) => {
      const params: Record<string, string | number> = {};
      let any = false;
      ctx.s.players
        .filter((x) => x.id !== ctx.p.id)
        .slice(0, RIVAL_SLOTS)
        .forEach((x, i) => {
          const dogs = x.dogIds.map((d) => ctx.s.dogs[d]!).filter((d) => d && d.injuryWeeks === 0);
          params[`t${i}`] = dogs.length ? ctx.rng.pick(dogs).id : '';
          if (dogs.length) any = true;
        });
      return any ? params : null;
    },
    detail: (ctx) =>
      `${-balance.nobbleFitness} fitness off the dog on race day if it runs, whichever race it is in — after the book has priced it. The stewards here catch about ${Math.round(catchChanceHere(ctx.s) * 100)}% of these: a ${balance.caughtFine} fine plus a quarter of what you had on the race, and everybody hears who did it.`,
    labels: (ctx) => [
      'Walk away',
      ...Array.from({ length: RIVAL_SLOTS }, (_, i) => {
        const d = ctx.s.dogs[String(ctx.params[`t${i}`] ?? '')];
        if (!d) return '—';
        const owner = ctx.s.players.find((x) => x.id === d.ownerId);
        return `${owner?.name ?? 'A rival'}'s ${d.name} (−${cost})`;
      }),
    ],
    choices: [
      {
        label: 'Walk away',
        apply: (ctx) => ctx.log('You keep your hands clean. This week.'),
      },
      ...Array.from({ length: RIVAL_SLOTS }, (_, i) => target(i)),
    ],
    // Normal's rule, readable and not tuned: nobble the rival dog on offer most likely to beat its
    // own best runner — the best-rated one — if it outrates that runner, and only with cash to spare.
    aiChoice: (ctx) => {
      const best = Math.max(...ownDogs(ctx.s, ctx.p).map((d) => d.rating), 0);
      const pick = offered(ctx).sort((a, b) => b.d.rating - a.d.rating)[0];
      return pick && pick.d.rating > best && ctx.p.cash > cost * 6 ? 1 + pick.i : 0;
    },
    // Hard: net worth is the score (§2.4), so when it is not leading it goes after the leader's dog
    // whatever it is rated — the leader is the stable standing between Hard and the win. Leading,
    // it plays Normal's rule.
    hardChoice: (ctx) => {
      const normal = () => {
        const best = Math.max(...ownDogs(ctx.s, ctx.p).map((d) => d.rating), 0);
        const pick = offered(ctx).sort((a, b) => b.d.rating - a.d.rating)[0];
        return pick && pick.d.rating > best && ctx.p.cash > cost * 6 ? 1 + pick.i : 0;
      };
      if (!HARD_KNOBS.nobblesBetter) return normal();
      const worth = (id: string) =>
        netWorth(
          ctx.s,
          ctx.s.players.find((x) => x.id === id)!,
        );
      const leader = [...ctx.s.players].sort((a, b) => worth(b.id) - worth(a.id))[0]!;
      if (leader.id === ctx.p.id) return normal();
      const hit = offered(ctx).find((o) => o.d.ownerId === leader.id);
      return hit && ctx.p.cash > cost * 4 ? 1 + hit.i : normal();
    },
  };
}

/** The dogs a nobble card is offering, with their button index. */
export function offered(ctx: {
  s: { dogs: Record<string, Dog> };
  params: Record<string, string | number>;
}): { i: number; d: Dog }[] {
  const out: { i: number; d: Dog }[] = [];
  for (let i = 0; i < RIVAL_SLOTS; i++) {
    const d = ctx.s.dogs[String(ctx.params[`t${i}`] ?? '')];
    if (d) out.push({ i, d });
  }
  return out;
}

/** Take `n` crates of the stolen good at 60% of the shelf; a quarter of the time the load is bad. */
function takeStolen(n: number): EventChoice {
  return {
    label: `Take ${n} crates`,
    apply: (ctx) => {
      const g = String(ctx.params.good) as GoodId;
      const each = Math.round(ctx.s.planet.goods[g].buy * 0.6);
      const room = HOLD_CAP - cargoTotal(ctx.p.cargo);
      const k = Math.min(n, room, Math.floor(ctx.p.cash / Math.max(1, each)));
      if (k <= 0) {
        ctx.log('You cannot take any. He is already gone.');
        return;
      }
      // A purchase of food, so it is a trade in the income split, not an event bill.
      const paid = pay(ctx, k * each);
      ctx.p.stats.costs -= paid;
      ctx.p.stats.tradeIncome -= paid;
      addCrates(ctx, g, k, each);
      if (risk(ctx, 0.25)) {
        const lost = spoilCargo(ctx.p.cargo, 0.3);
        ctx.log(
          `${k} crates of ${goodName(g)} at ${each}. The bottom layer is rotten: ${lost} crates of your hold go over the side with it.`,
        );
      } else ctx.log(`${k} crates of ${goodName(g)} at ${each} each. They look fine. Probably.`);
    },
  };
}

export const ALLEY: readonly EventCard[] = [
  {
    id: 'stolenFood',
    name: 'Off the back of a freighter',
    text: 'A man in a long coat opens it to show you crates, not watches. Good food, he says, at sixty per cent of the shelf price. Cash. Now. Do not ask where it came from.',
    weight: 6,
    kind: 'choice',
    category: 'alley',
    // One good, drawn from the three middle rungs of the ladder: a stolen crate of Grey Mash is not
    // worth the risk and a stolen crate of Ambrosia is a crime with a name.
    roll: (ctx) =>
      HOLD_CAP - cargoTotal(ctx.p.cargo) >= 4
        ? { good: ctx.rng.pick(['scrapmeat', 'glowTripe', 'vatSteak'] as const) }
        : null,
    labels: (ctx) => {
      const g = String(ctx.params.good) as GoodId;
      const each = Math.round(ctx.s.planet.goods[g].buy * 0.6);
      return [
        `Take 8 crates of ${goodName(g)} (${each} each)`,
        `Take 4 (${each} each)`,
        'Walk away',
      ];
    },
    choices: [
      takeStolen(8),
      takeStolen(4),
      {
        label: 'Walk away',
        apply: (ctx) => ctx.log('You walk away. He shouts a lower price after you.'),
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 3000 ? 0 : ctx.p.cash > 1500 ? 1 : 2),
  },
  {
    id: 'mugging',
    name: 'Jumped',
    text: 'Two of them, one with a pipe. "Wallet." Your dogs are back at the ship.',
    weight: 4,
    kind: 'choice',
    category: 'alley',
    choices: [
      {
        label: 'Hand over 300',
        apply: (ctx) => {
          const paid = pay(ctx, 300);
          ctx.log(`You hand over ${paid}. They thank you. They are very polite about it.`);
        },
      },
      {
        label: 'Run',
        apply: (ctx) => {
          if (luck(ctx, 0.6))
            ctx.log('You are faster than you look. They are slower than they look.');
          else {
            const paid = pay(ctx, 700);
            ctx.log(
              `You are not faster than you look. They take everything in your pockets (−${paid}).`,
            );
          }
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 2000 ? 0 : 1),
  },
  {
    id: 'backstreetVet',
    name: 'A vet with no licence',
    text: 'He was struck off on three planets. He also once put a dog back together that four vets had given up on. He will look at your laid-up dog for 250.',
    weight: 5,
    kind: 'swing',
    category: 'alley',
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks > 0),
    choices: [
      {
        label: 'Let him operate (−250)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 250)) return;
          if (luck(ctx, 0.7)) {
            heal(d, 2);
            ctx.log(`Miraculous. ${d.name} is back in ${d.injuryWeeks} week(s).`);
          } else {
            injure(d, 1);
            statBy(d, 'speed', -2);
            ctx.log(
              `Not miraculous. ${d.name} is out a week longer and has lost a yard of pace (−2 speed).`,
            );
          }
        },
      },
      {
        label: 'Not a chance',
        apply: (ctx) => ctx.log('You carry your dog out past his waiting room.'),
      },
    ],
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      return d && d.injuryWeeks >= 2 && ctx.p.cash > 1000 ? 0 : 1;
    },
  },
  {
    id: 'chemistPill',
    name: 'The chemist',
    text: 'A chemist with yellow fingers holds out a pill. "One of these on Sunday morning and your dog will run through a wall." 300. Some dogs, he admits, try to run through the wall.',
    weight: 4,
    kind: 'swing',
    category: 'alley',
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    choices: [
      {
        label: 'Buy it (−300)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 300)) return;
          if (luck(ctx, 0.75)) {
            d.raceBonus += 6;
            ctx.log(`${d.name} takes the pill and will not sit still (+6 speed this weekend).`);
          } else {
            fit(d, -25);
            ctx.log(`${d.name} takes the pill and is sick on your shoes (−25 fitness).`);
          }
        },
      },
      { label: 'Keep your pills', apply: (ctx) => ctx.log('You leave him to his yellow fingers.') },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'counterfeitBones',
    name: 'A good rate',
    text: 'A woman will change your Bones for newer Bones at two for one. Only five hundred. She shows you one: it looks real. It feels real.',
    weight: 3,
    kind: 'swing',
    category: 'alley',
    choices: [
      {
        label: 'Change 500',
        apply: (ctx) => {
          if (!spend(ctx, 500)) return;
          if (ctx.rng.chance(0.3)) {
            earn(ctx, 1000);
            ctx.log('They are real. You do not ask how. +500.');
          } else ctx.log('They are printed on the back of bus tickets. You are 500 down.');
        },
      },
      { label: 'Decline', apply: (ctx) => ctx.log('She says your loss and means it.') },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'pickpocket',
    name: 'Light fingers',
    text: 'Somebody bumps into you, apologises beautifully, and is gone. So is your purse.',
    weight: 3,
    kind: 'flavour',
    category: 'alley',
    choices: [
      {
        label: 'Check your pockets',
        apply: (ctx) => {
          const paid = pay(ctx, Math.min(400, Math.round(ctx.p.cash * 0.05)));
          ctx.log(`A pickpocket had ${paid} off you.`);
        },
      },
    ],
  },
  {
    id: 'sealedCrate',
    name: 'A sealed crate',
    text: 'A man needs a crate carried to the next planet. It is sealed, it is heavy, it hums. 500 now. Do not open it and do not declare it.',
    weight: 4,
    kind: 'swing',
    category: 'alley',
    roll: (ctx) => (ctx.s.calendar[ctx.s.week] ? {} : null),
    choices: [
      {
        label: 'Carry it (+500)',
        apply: (ctx) => {
          earn(ctx, 500);
          if (risk(ctx, 0.2)) {
            const paid = pay(ctx, 1200);
            ctx.log(
              `Customs open it at the gate. It is full of bees. You are fined ${paid} and keep the 500.`,
            );
          } else ctx.log('You deliver it. You never find out. +500.');
        },
      },
      { label: 'Not in my hold', apply: (ctx) => ctx.log('He finds somebody else. You hope.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 2500 ? 0 : 1),
  },
  {
    id: 'alleySprint',
    name: 'Down the wet alley',
    text: 'A local runs a sprint down the length of the alley on Saturday nights, 500 a side, no stewards, no rules, a bin at the finish. His dog has never lost.',
    weight: 5,
    kind: 'swing',
    category: 'alley',
    roll: (ctx) => {
      const d = fittest(ctx);
      return d ? { dogId: d.id, theirs: ctx.rng.int(44, 58) } : null;
    },
    labels: (ctx) => [`Send ${dogOf(ctx)?.name ?? 'your fittest'} (500 a side)`, 'Not tonight'],
    choices: [
      {
        label: 'Send your fittest (500 a side)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 500)) return;
          fit(d, -10);
          const p = winProbAgainst(d.rating, [Number(ctx.params.theirs)]);
          if (ctx.rng.chance(p)) {
            earn(ctx, 1000);
            formBy(d, 3);
            ctx.log(
              `${d.name} beats the alley champion by a whisker (+500, +3 form). The locals are furious.`,
            );
          } else ctx.log(`${d.name} runs into the bin (−500, −10 fitness).`);
          if (risk(ctx, 0.1)) {
            injure(d, 1);
            ctx.log(`${d.name} cut a pad on the cobbles: out a week.`);
          }
        },
      },
      { label: 'Not tonight', apply: (ctx) => ctx.log('You watch his dog win again.') },
    ],
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      return d && d.rating >= 55 && d.fitness >= 80 && ctx.p.cash > 2000 ? 0 : 1;
    },
  },
  {
    id: 'protection',
    name: 'Nice kennel',
    text: '"Nice kennel. Nice dogs. Be a shame if the door came open in the night." He wants 250 a week. He means this week.',
    weight: 4,
    kind: 'choice',
    category: 'alley',
    choices: [
      {
        label: 'Pay him (−250)',
        apply: (ctx) => {
          const paid = pay(ctx, 250);
          ctx.log(`You pay (−${paid}). The door stays shut.`);
        },
      },
      {
        label: 'Tell him where to go',
        apply: (ctx) => {
          if (risk(ctx, 0.5)) {
            for (const d of ownDogs(ctx.s, ctx.p)) fit(d, -12);
            ctx.log(
              'The door comes open. You find your dogs at dawn, three streets away (−12 fitness each).',
            );
          } else ctx.log('He never comes back. You never find out why.');
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 1500 ? 0 : 1),
  },
  {
    id: 'alleyCat',
    name: 'The alley cat',
    text: 'The biggest cat anybody has ever seen sits on a wall and looks at your dogs. Your dogs look back.',
    weight: 3,
    kind: 'flavour',
    category: 'alley',
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    choices: [
      {
        label: 'Hold on to the lead',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          fit(d, -5);
          formBy(d, 3);
          ctx.log(
            `${d.name} chases the cat four blocks and comes back very pleased with itself (−5 fitness, +3 form).`,
          );
        },
      },
    ],
  },
  {
    id: 'fence',
    name: 'The fence',
    text: 'A fence who deals in "surplus" will take food off you at over the odds — no paperwork, no questions. Twenty per cent over the shelf, for up to ten crates of one thing.',
    weight: 4,
    kind: 'swing',
    category: 'alley',
    roll: (ctx) => {
      const goods = heldGoods(ctx.p);
      if (!goods.length) return null;
      // The dearest thing aboard is what he wants.
      const g = goods[goods.length - 1]!;
      return { good: g };
    },
    labels: (ctx) => {
      const g = String(ctx.params.good) as GoodId;
      const n = Math.min(10, ctx.p.cargo[g]);
      const each = Math.round(ctx.s.planet.goods[g].sell * 1.2);
      return [`Sell him ${n} ${goodName(g)} at ${each}`, 'Keep your food'];
    },
    choices: [
      {
        label: 'Sell to the fence',
        apply: (ctx) => {
          const g = String(ctx.params.good) as GoodId;
          const n = Math.min(10, ctx.p.cargo[g]);
          if (n <= 0) return;
          const each = Math.round(ctx.s.planet.goods[g].sell * 1.2);
          ctx.p.cargo[g] -= n;
          if (risk(ctx, 0.15)) {
            const paid = pay(ctx, 300);
            ctx.log(`It is a sting. The crates are evidence now, and you are fined ${paid}.`);
          } else {
            earn(ctx, n * each);
            ctx.p.stats.tradeIncome += n * each;
            ctx.log(`${n} crates of ${goodName(g)} gone at ${each} each. Nobody asked anything.`);
          }
        },
      },
      { label: 'Keep your food', apply: (ctx) => ctx.log('The fence tips his hat.') },
    ],
    // Worth it when the shelf here is below the good's middle — the fence's 20% beats what the next
    // stop is likely to pay.
    aiChoice: (ctx) => {
      const g = String(ctx.params.good) as GoodId;
      const gd = good(g);
      const pos = (ctx.s.planet.goods[g].buy - gd.floor) / (gd.ceiling - gd.floor);
      return pos >= 0.4 ? 0 : 1;
    },
  },

  // ---- Race-day tips (Phase D1 item 6): true, private, and never priced by the book. ----
  {
    id: 'kennelBoy',
    name: 'A kennel-boy for hire',
    text: 'A kennel-boy from a rival stable waits by the bins. For the right money he will tell you what really goes on in his yard — or anybody else’s.',
    weight: 8,
    kind: 'choice',
    category: 'alley',
    roll: rollTip,
    choices: [
      {
        label: 'Pay him (−250)',
        apply: (ctx) => {
          if (spend(ctx, 250)) giveTip(ctx);
        },
      },
      {
        label: 'Send him back to his bins',
        apply: (ctx) => ctx.log('You send the kennel-boy away.'),
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 1000 ? 0 : 1),
  },
  {
    id: 'bookiesRunner',
    name: 'The bookie’s runner',
    text: 'The bookie’s runner hears everything the bookie hears, and the bookie hears everything. He is underpaid and he knows it.',
    weight: 7,
    kind: 'choice',
    category: 'alley',
    planets: ['neonSnout', 'collarPrime', 'portSlobber'],
    planetBoost: 2,
    roll: rollTip,
    choices: [
      {
        label: 'Slip him 150',
        apply: (ctx) => {
          if (spend(ctx, 150)) giveTip(ctx);
        },
      },
      {
        label: 'Stay out of it',
        apply: (ctx) => ctx.log('You stay out of the bookie’s business.'),
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 600 ? 0 : 1),
  },

  // ---- Sabotage and the bought trap draw (GDD_V3 §9.3). Freely targetable; the same cost for all. ----
  nobbleCard(
    'syringeMan',
    'A man with a syringe',
    'He does not say what is in it. He says it is not illegal, exactly, and that it wears off by Tuesday. He can get into one kennel in every yard on the planet. Pick a yard.',
    8,
    500,
  ),
  nobbleCard(
    'kennelBoyBribe',
    'A kennel-boy with debts',
    'A kennel-boy who works nights at half the yards on the planet owes money to the wrong people. He could leave a bowl of something in the wrong pen. He could use the money.',
    5,
    350,
    { ids: ['lagrangeLows', 'drift', 'rustgut', 'hushmarket'], boost: 2 },
  ),
  {
    id: 'stewardBox',
    name: 'A steward with a clipboard',
    text: 'One of the track stewards is having a cigarette where he should not be. He does the trap draw. For a consideration, he can do it a little less randomly — for one dog, in one race, your choice once you know it.',
    weight: 6,
    kind: 'choice',
    category: 'alley',
    detail: (ctx) => {
      const bends = currentPlanet(ctx.s).track.bends;
      return bends === 'tight'
        ? 'This track has tight bends: the rail (box 1) is worth about 3.5 points of win rate. You choose the box in the Race Office.'
        : bends === 'none'
          ? 'This track is a straight: the box is worth nothing here. You choose it in the Race Office anyway.'
          : `This track has ${bends} bends: the box is worth something, less than on tight ones. You choose it in the Race Office.`;
    },
    choices: [
      {
        label: `Slip him ${BOX_COST}`,
        apply: (ctx) => {
          if (!spend(ctx, BOX_COST)) return;
          ctx.s.jobs.push({ by: ctx.p.id, kind: 'box' });
          ctx.p.stats.boxes++;
          ctx.log(
            'He pockets it. Name your box at the Race Office once you have declared — on tight bends the rail is worth about 3.5 points of win rate; on a straight, nothing.',
          );
        },
      },
      { label: 'Not today', apply: (ctx) => ctx.log('He finishes his cigarette and goes in.') },
    ],
    // Normal buys a box only where it is worth one — tight bends — and only with cash to spare.
    aiChoice: (ctx) =>
      currentPlanet(ctx.s).track.bends === 'tight' && ctx.p.cash > BOX_COST * 8 ? 0 : 1,
    // Hard: on medium bends too, where the rail is still worth something.
    hardChoice: (ctx) => {
      const bends = currentPlanet(ctx.s).track.bends;
      const worth = bends === 'tight' || (HARD_KNOBS.buysBoxesWider && bends === 'medium');
      return worth && ctx.p.cash > BOX_COST * 8 ? 0 : 1;
    },
  },
];
