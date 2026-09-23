/**
 * The Bar (GDD_V3 §9.1): people and talk. Rumours, a rival running his mouth, games of chance with
 * people who have played them before, and — from Phase D1 item 5 and 6 — the only place a stable can
 * learn next week's prices or what is wrong with a dog on race day.
 *
 * Every card here is a row: two or three choices or a bit of flavour, a choice for the Normal AI, a
 * line in the log, and a story somebody tells afterwards (pillar 3). Its numbers are the card's own.
 */
import { STYLE_BY_ID } from '../styles';
import {
  dogOf,
  earn,
  formBy,
  ownDogs,
  pay,
  rollDog,
  spend,
  statBy,
  giveTip,
  rollTip,
  type EventCard,
} from '../eventKit';
import { weakestStat } from '../../economy/dogValue';
import type { Dog } from '../../types';

export const BAR: readonly EventCard[] = [
  {
    id: 'rivalBrag',
    name: 'A rival running his mouth',
    text: 'A rival owner is three drinks in and telling everyone how his new dog will run on Sunday. One more round and he will say exactly how.',
    weight: 5,
    kind: 'choice',
    category: 'bar',
    roll: (ctx) => {
      const theirs: Dog[] = [];
      for (const p of ctx.s.players)
        if (p.id !== ctx.p.id) for (const d of ownDogs(ctx.s, p)) if (!d.styleKnown) theirs.push(d);
      return theirs.length ? { dogId: ctx.rng.pick(theirs).id } : null;
    },
    choices: [
      {
        label: 'Buy the next round (−100)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 100)) return;
          // Loud enough for the whole bar: a style is public or it is not (decision C4).
          d.styleKnown = true;
          ctx.log(
            `He cannot help himself: ${d.name} is a ${STYLE_BY_ID[d.style].name.toLowerCase()}. The whole bar heard. It is on the card now.`,
          );
        },
      },
      { label: 'Let him ramble', apply: (ctx) => ctx.log('You leave him to his audience.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 800 ? 0 : 1),
  },
  {
    id: 'armWrestle',
    name: 'Arm-wrestling a miner',
    text: 'A miner the size of a cargo pod slams his elbow on the bar. "Three hundred says you cannot move it." The bar goes quiet.',
    weight: 4,
    kind: 'swing',
    category: 'bar',
    planets: ['rustgut'],
    planetBoost: 3,
    choices: [
      {
        label: 'Take him on (300 a side)',
        apply: (ctx) => {
          if (!spend(ctx, 300)) return;
          if (ctx.rng.chance(0.4)) {
            earn(ctx, 600);
            ctx.log('You find leverage nobody knew you had. +300, and a round of applause.');
          } else ctx.log('Your hand hits the bar before you have finished sitting down (−300).');
        },
      },
      { label: 'Buy him a drink instead', apply: (ctx) => ctx.log('He accepts. Wise.') },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'oldTrainer',
    name: 'The old trainer',
    text: 'An old trainer who once won the Cosmodrome Classic is nursing a warm beer. Buy him another and he will tell you what is wrong with one of your dogs.',
    weight: 5,
    kind: 'choice',
    category: 'bar',
    roll: (ctx) => rollDog(ctx),
    choices: [
      {
        label: 'Buy him a beer (−80)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 80)) return;
          const stat = weakestStat(d);
          statBy(d, stat, 1);
          formBy(d, 2);
          ctx.log(
            `He talks ${d.name} through it for an hour (+1 ${stat}, +2 form). You buy him two more.`,
          );
        },
      },
      { label: 'Heard it all before', apply: (ctx) => ctx.log('You leave him with his beer.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 300 ? 0 : 1),
  },
  {
    id: 'barFight',
    name: 'Bar fight',
    text: 'Somebody calls somebody else’s dog a mongrel and the furniture starts moving. The barman is under the bar, waving at you to help.',
    weight: 4,
    kind: 'choice',
    category: 'bar',
    choices: [
      {
        label: 'Wade in on the barman’s side',
        apply: (ctx) => {
          if (ctx.rng.chance(0.5)) {
            earn(ctx, 300);
            ctx.log('You clear the bar. The barman slips you 300 and a free tab.');
          } else {
            const paid = pay(ctx, 250);
            ctx.log(`You get a chair in the face and the bill for it (−${paid}).`);
          }
        },
      },
      {
        label: 'Slip out the back',
        apply: (ctx) => ctx.log('You finish your drink in the alley.'),
      },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'liarsDice',
    name: "Liar's dice",
    text: 'Three spacers with no teeth between them are playing liar’s dice for real money. There is an empty stool. The minimum is 500.',
    weight: 3,
    kind: 'swing',
    category: 'bar',
    planets: ['neonSnout', 'blackreach'],
    planetBoost: 3,
    choices: [
      {
        label: 'Sit down (500 in)',
        apply: (ctx) => {
          if (!spend(ctx, 500)) return;
          if (ctx.rng.chance(0.4)) {
            earn(ctx, 1200);
            ctx.log('You call every bluff at the table. +700, and nobody will look at you.');
          } else ctx.log('Five sixes. There were not five sixes. You are 500 lighter.');
        },
      },
      { label: 'Watch', apply: (ctx) => ctx.log('You watch a man lose his ship.') },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'journalist',
    name: 'The racing rag',
    text: 'A reporter from The Daily Muzzle wants a quote about your stable for the weekend edition. She pays 300 for a good one. The last owner who gave her a good one got torn apart when his dogs lost.',
    weight: 4,
    kind: 'choice',
    category: 'bar',
    choices: [
      {
        label: 'Give her a headline (+300)',
        apply: (ctx) => {
          earn(ctx, 300);
          for (const d of ownDogs(ctx.s, ctx.p)) formBy(d, -1);
          ctx.log('"We will win everything." +300. The dogs feel the pressure (−1 form each).');
        },
      },
      {
        label: '"No comment"',
        apply: (ctx) => ctx.log('She writes "no comment" and makes it sound sinister.'),
      },
    ],
    aiChoice: () => 0,
  },
  {
    id: 'pilotShortcut',
    name: 'A pilot with a chart',
    text: 'A pilot with one eye and a very old star chart says there is a way into next week’s system that nobody else uses. 250 Bones and you will be first down.',
    weight: 4,
    kind: 'choice',
    category: 'bar',
    roll: (ctx) => (ctx.s.calendar[ctx.s.week] ? {} : null),
    choices: [
      {
        label: 'Buy the chart (−250)',
        apply: (ctx) => {
          if (!spend(ctx, 250)) return;
          ctx.p.flags.arriveFirstNextWeek = true;
          ctx.log('The chart is real. You will land first next week.');
        },
      },
      {
        label: 'You have a navicomp',
        apply: (ctx) => ctx.log('He shrugs and sells it to somebody else.'),
      },
    ],
    // First look at a finite shelf is worth most to a stable that trades.
    aiChoice: (ctx) => (ctx.p.cash > 2500 ? 0 : 1),
  },
  {
    id: 'barTab',
    name: 'Somebody else’s tab',
    text: 'You wake up in a booth with a bar tab in your hand. It is not your tab. The barman is quite sure it is.',
    weight: 3,
    kind: 'choice',
    category: 'bar',
    choices: [
      {
        label: 'Pay it (−200)',
        apply: (ctx) => {
          const paid = pay(ctx, 200);
          ctx.log(`You pay somebody else’s tab (−${paid}). Somebody had a good night.`);
        },
      },
      {
        label: 'Argue',
        apply: (ctx) => {
          if (ctx.rng.chance(0.5))
            ctx.log('The barman finds the real culprit asleep in the toilets.');
          else {
            const paid = pay(ctx, 450);
            ctx.log(`The barman’s brother arrives. You pay the tab and the door (−${paid}).`);
          }
        },
      },
    ],
    aiChoice: () => 0,
  },

  // ---- Race-day tips (Phase D1 item 6): true, private, and never priced by the book. ----
  {
    id: 'stableLad',
    name: 'A stable lad who talks too much',
    text: 'A lad from one of the big kennels is drinking alone and wants company. He knows every dog on the planet and he cannot keep his mouth shut. A drink or two and he will tell you something the bookie does not know.',
    weight: 9,
    kind: 'choice',
    category: 'bar',
    roll: rollTip,
    choices: [
      {
        label: 'Buy him a drink (−100)',
        apply: (ctx) => {
          if (spend(ctx, 100)) giveTip(ctx);
        },
      },
      { label: 'Leave him be', apply: (ctx) => ctx.log('You leave the lad to his drink.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 400 ? 0 : 1),
  },
  {
    id: 'offDutyVet',
    name: 'The track vet, off duty',
    text: 'The track vet is three brandies into her night off. She has had her hands on every dog on this card this week. Buy her the fourth.',
    weight: 7,
    kind: 'choice',
    category: 'bar',
    planets: ['collarPrime', 'cosmodrome', 'oldWembley'],
    planetBoost: 2,
    roll: rollTip,
    choices: [
      {
        label: 'Buy the brandy (−200)',
        apply: (ctx) => {
          if (spend(ctx, 200)) giveTip(ctx);
        },
      },
      {
        label: 'Let her drink in peace',
        apply: (ctx) => ctx.log('You let the vet drink in peace.'),
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 800 ? 0 : 1),
  },
  {
    id: 'feedMerchant',
    name: 'The feed merchant',
    text: 'The feed merchant delivers to every kennel on the planet, and he notices whose bowls come back full. He trades gossip for custom.',
    weight: 6,
    kind: 'choice',
    category: 'bar',
    roll: rollTip,
    choices: [
      {
        label: 'Buy a crate’s worth of gossip (−80)',
        apply: (ctx) => {
          if (spend(ctx, 80)) giveTip(ctx);
        },
      },
      { label: 'Not today', apply: (ctx) => ctx.log('The feed merchant goes back to his cart.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 320 ? 0 : 1),
  },
];
