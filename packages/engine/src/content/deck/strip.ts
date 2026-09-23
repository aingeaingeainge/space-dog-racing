/**
 * The Strip (GDD_V3 §9.1): money and food. A card game, a sponsor with a catch, a clamp on the ship,
 * a caterer who wants your Grey Mash, free samples.
 *
 * Every card here is a row: two or three choices or a bit of flavour, a choice for the Normal AI, a
 * line in the log, and a story somebody tells afterwards (pillar 3). Its numbers are the card's own.
 */
import { STAPLE_ID } from '../goods';
import {
  addCrates,
  earn,
  fit,
  formBy,
  goodName,
  ownDogs,
  pay,
  spend,
  type EventCard,
} from '../eventKit';
import { cargoTotal, HOLD_CAP } from '../../economy/goods';

export const STRIP: readonly EventCard[] = [
  {
    id: 'threeCardMonte',
    name: 'Find the lady',
    text: 'Three cards on an upturned crate and a man with very fast hands. "Find the lady, double your money." A tourist just won. The tourist looks a lot like him.',
    weight: 4,
    kind: 'swing',
    category: 'strip',
    choices: [
      {
        label: 'Put down 200',
        apply: (ctx) => {
          if (!spend(ctx, 200)) return;
          if (ctx.rng.chance(0.33)) {
            earn(ctx, 400);
            ctx.log('You find the lady. He looks genuinely surprised. +200.');
          } else ctx.log('The lady was never on the crate. −200.');
        },
      },
      {
        label: 'Put down 600',
        apply: (ctx) => {
          if (!spend(ctx, 600)) return;
          if (ctx.rng.chance(0.33)) {
            earn(ctx, 1200);
            ctx.log('You find the lady. His friends are less pleased than he is. +600.');
          } else ctx.log('The lady was never on the crate. −600.');
        },
      },
      {
        label: 'Keep walking',
        apply: (ctx) => ctx.log('You keep walking. The tourist wins again.'),
      },
    ],
    aiChoice: () => 2,
  },
  {
    id: 'zappSponsor',
    name: 'Sponsor: Zapp! Energy',
    text: 'Zapp! Energy ("It Makes You Go") will pay 900 to have your dogs photographed drinking it. They will have to actually drink it.',
    weight: 4,
    kind: 'choice',
    category: 'strip',
    choices: [
      {
        label: 'Take the money (+900, the dogs drink it)',
        apply: (ctx) => {
          earn(ctx, 900);
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, -8);
          ctx.log('Zapp! pays 900. The dogs go, and then they very much stop (−8 fitness each).');
        },
      },
      { label: 'Decline', apply: (ctx) => ctx.log('Zapp! finds another stable. Their dogs go.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash < 3000 ? 0 : 1),
  },
  {
    id: 'clamped',
    name: 'Clamped',
    text: 'You come back to the ship to find a clamp on the landing gear and a note: 300 to release. You were parked in a loading bay. There is no sign saying so.',
    weight: 4,
    kind: 'choice',
    category: 'strip',
    choices: [
      {
        label: 'Pay the 300',
        apply: (ctx) => {
          const paid = pay(ctx, 300);
          ctx.log(`You pay the clamp (−${paid}).`);
        },
      },
      {
        label: 'Appeal',
        apply: (ctx) => {
          if (ctx.rng.chance(0.5)) ctx.log('The appeals officer has a dog. She lets you off.');
          else {
            const paid = pay(ctx, 600);
            ctx.log(
              `The appeals officer does not have a dog. Doubled for wasting her time (−${paid}).`,
            );
          }
        },
      },
    ],
    aiChoice: () => 0,
  },
  {
    id: 'slotMachine',
    name: 'The Big Bone slot machine',
    text: 'A slot machine the size of a shuttle, flashing a jackpot of 1,500. A pull is 100. It has not paid out since the old sheriff died.',
    weight: 4,
    kind: 'swing',
    category: 'strip',
    planets: ['neonSnout', 'collarPrime'],
    planetBoost: 3,
    choices: [
      {
        label: 'One pull (−100)',
        apply: (ctx) => {
          if (!spend(ctx, 100)) return;
          if (ctx.rng.chance(0.06)) {
            earn(ctx, 1500);
            ctx.log('Three bones. Sirens. The whole Strip comes to look. +1,400.');
          } else ctx.log('Two bones and a cat. −100.');
        },
      },
      { label: 'Walk past', apply: (ctx) => ctx.log('The machine flashes sadly at you.') },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'calendarShoot',
    name: 'The calendar',
    text: 'A glossy wants your dogs for the Dogs of the Circuit calendar. 400, a morning under hot lights, and a stylist with strong opinions about ears.',
    weight: 4,
    kind: 'choice',
    category: 'strip',
    choices: [
      {
        label: 'Say cheese (+400)',
        apply: (ctx) => {
          earn(ctx, 400);
          const best = [...ownDogs(ctx.s, ctx.p)].sort((a, b) => b.rating - a.rating)[0];
          if (best) formBy(best, 2);
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, -3);
          ctx.log(
            `+400. ${best?.name ?? 'Your best dog'} is Mr October and knows it (+2 form); the rest are tired of the lights (−3 fitness each).`,
          );
        },
      },
      { label: 'No time', apply: (ctx) => ctx.log('Another stable gets October.') },
    ],
    aiChoice: () => 0,
  },
  {
    id: 'freeSamples',
    name: 'Free samples',
    text: 'A food brand is handing out samples on the Strip. If you have a hold, they will fill a corner of it with Scrapmeat and call it marketing.',
    weight: 4,
    kind: 'flavour',
    category: 'strip',
    roll: (ctx) => (HOLD_CAP - cargoTotal(ctx.p.cargo) >= 2 ? {} : null),
    choices: [
      {
        label: 'Open the hatch',
        apply: (ctx) => {
          const n = addCrates(ctx, 'scrapmeat', 4, 0);
          ctx.log(`+${n} crates of free ${goodName('scrapmeat')}.`);
        },
      },
    ],
  },
  {
    id: 'caterer',
    name: 'A caterer in a hurry',
    text: 'A wedding caterer has three hundred guests and no Grey Mash — do not ask what kind of wedding. She will pay double the shelf for ten crates, right now.',
    weight: 4,
    kind: 'choice',
    category: 'strip',
    roll: (ctx) => (ctx.p.cargo[STAPLE_ID] >= 10 ? {} : null),
    choices: [
      {
        label: 'Sell her ten crates',
        apply: (ctx) => {
          const each = ctx.s.planet.goods[STAPLE_ID].buy * 2;
          ctx.p.cargo[STAPLE_ID] -= 10;
          earn(ctx, 10 * each);
          ctx.p.stats.tradeIncome += 10 * each;
          ctx.log(`Ten crates of Grey Mash at ${each} each. Congratulations to the happy couple.`);
        },
      },
      { label: 'The dogs need it', apply: (ctx) => ctx.log('She runs off to try the next ship.') },
    ],
    // Double the shelf beats any leg, as long as there is Mash here to buy back for the dogs.
    aiChoice: (ctx) => (ctx.s.planet.goods[STAPLE_ID].stock >= 10 ? 0 : 1),
  },
  {
    id: 'taxMan',
    name: 'The Strip tax man',
    text: 'A man with a ledger says there is a Strip levy on visiting stables: five per cent of what you are carrying. There is also, he says quietly, a cash discount.',
    weight: 4,
    kind: 'choice',
    category: 'strip',
    choices: [
      {
        label: 'Pay the levy (5% of cash)',
        apply: (ctx) => {
          const paid = pay(ctx, Math.min(800, Math.round(ctx.p.cash * 0.05)));
          ctx.log(`You pay the levy (−${paid}) and get a receipt nobody will ever ask to see.`);
        },
      },
      {
        label: 'Take the discount (−200)',
        apply: (ctx) => {
          const paid = pay(ctx, 200);
          if (ctx.rng.chance(0.3)) {
            const more = pay(ctx, Math.min(800, Math.round(ctx.p.cash * 0.1)));
            ctx.log(
              `The discount was a test. His supervisor fines you 10% (−${paid + more} in all).`,
            );
          } else ctx.log(`The discount is real (−${paid}). He winks. You feel dirty.`);
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash * 0.05 > 300 ? 1 : 0),
  },
];
