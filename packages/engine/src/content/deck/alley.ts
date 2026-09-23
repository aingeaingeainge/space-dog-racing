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
  type EventCard,
  type EventChoice,
} from '../eventKit';
import { spoilCargo, HOLD_CAP, cargoTotal } from '../../economy/goods';
import { winProbAgainst } from '../../race/odds';
import type { GoodId } from '../../types';

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
      if (ctx.rng.chance(0.25)) {
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
          if (ctx.rng.chance(0.6))
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
          if (ctx.rng.chance(0.7)) {
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
          if (ctx.rng.chance(0.75)) {
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
          if (ctx.rng.chance(0.2)) {
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
          if (ctx.rng.chance(0.1)) {
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
          if (ctx.rng.chance(0.5)) {
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
          if (ctx.rng.chance(0.15)) {
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
];
