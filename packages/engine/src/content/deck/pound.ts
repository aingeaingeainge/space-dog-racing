/**
 * The Pound (GDD_V3 §9.1): dogs. New dogs offered, strays, a vet who will shorten a layoff, a dog's
 * style read by somebody who has seen a thousand of them.
 *
 * Every card here is a row: two or three choices or a bit of flavour, a choice for the Normal AI, a
 * line in the log, and a story somebody tells afterwards (pillar 3). Its numbers are the card's own.
 */
import { balance } from '../balance';
import {
  dogOf,
  fit,
  formBy,
  heal,
  injure,
  ownDogs,
  pay,
  revealStyle,
  rollDog,
  spend,
  statBy,
  type EventCard,
  risk,
} from '../eventKit';
import { weakestStat } from '../../economy/dogValue';
import {
  acceptOffer,
  cheapestDog,
  describeOffer,
  estimateOffer,
  PATTER,
  rollOffer,
  STAT_LABEL,
  type OfferOptions,
} from '../../economy/acquire';
import { dogValue } from '../../economy/dogValue';
import type { EventChoice, EventCtx } from '../eventKit';
import type { StatKey } from '../../types';

/**
 * A Pound card that offers a dog (GDD_V3 §9.2). Four buttons: walk away, or take it and let one of
 * your three go (each named). It is one decision — whether, and for whom — and the dog is **one of a
 * kind on the planet-week** (`unique`): the first stable through the door in turn order gets the
 * offer, and anybody after draws something else (§2.3's contention).
 */
function offerCard(
  id: string,
  name: string,
  text: string,
  weight: number,
  opts: OfferOptions,
  planets?: { ids: string[]; boost: number },
): EventCard {
  const swap = (slot: number): EventChoice => ({
    label: `Take it — let your dog ${slot + 1} go`,
    apply: (ctx: EventCtx) => {
      const outId = ctx.p.dogIds[slot];
      if (!outId) return;
      const { joined, left } = acceptOffer(ctx.s, ctx.p, ctx.params, outId, ctx.nextId);
      ctx.p.stats.dogsTaken++;
      const claimed = String(ctx.params.claimed) as StatKey;
      ctx.log(`${joined.name} joins the stable, style unknown. ${left.name} goes to the Pound.`);
      if (Number(ctx.params.lie) === 1) {
        ctx.p.stats.liesCaught++;
        ctx.log(
          `"${PATTER[claimed]}," he said. ${STAT_LABEL[claimed]} ${joined[claimed]}. He lied.`,
        );
      } else ctx.log(`He was telling the truth: ${STAT_LABEL[claimed]} ${joined[claimed]}.`);
    },
  });
  return {
    id,
    name,
    text,
    weight,
    kind: 'choice',
    category: 'pound',
    unique: true,
    ...(planets ? { planets: planets.ids, planetBoost: planets.boost } : {}),
    roll: (ctx) => {
      const params = rollOffer(ctx.rng, opts);
      ctx.p.stats.dogOffers++;
      if (Number(params.lie) === 1) ctx.p.stats.liesTold++;
      return params;
    },
    detail: (ctx) => describeOffer(ctx.params),
    // "Walk away" first, so the card's default (Enter, the highlighted button) never swaps a dog.
    labels: (ctx) => [
      'Walk away',
      ...[0, 1, 2].map((i) => {
        const d = ctx.s.dogs[ctx.p.dogIds[i] ?? ''];
        return d ? `Take it — let ${d.name} go` : '—';
      }),
    ],
    choices: [
      {
        label: 'Walk away',
        apply: (ctx) => ctx.log(`You leave ${ctx.params.offerName} where it is.`),
      },
      swap(0),
      swap(1),
      swap(2),
    ],
    // Normal: take the offer when what it can see — the shown stat as the dog's level, the patter at
    // this seller's honesty — is worth a clear margin more than its cheapest dog, and let that one go.
    aiChoice: (ctx) => {
      const worst = cheapestDog(ctx.s, ctx.p);
      if (!worst) return 0;
      const est = estimateOffer(ctx.params, opts.lieMult);
      return est > dogValue(worst) * OFFER_MARGIN ? 1 + ctx.p.dogIds.indexOf(worst.id) : 0;
    },
  };
}

/** How much better than its cheapest dog an offer has to look before Normal takes it. */
const OFFER_MARGIN = 1.1;

export const POUND: readonly EventCard[] = [
  {
    id: 'vetLayoff',
    name: 'A vet who owes somebody a favour',
    text: 'The pound vet has a surgery out the back and a waiting room full of strays. She looks at your laid-up dog and says she can have it running sooner — for a price.',
    weight: 6,
    kind: 'choice',
    category: 'pound',
    // GDD_V3 §4.4: "the injury explore door can shorten a layoff". Only for a stable with one to shorten.
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks > 0),
    choices: [
      {
        label: 'Pay her 400 (a week off the layoff)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 400)) return;
          heal(d, 1);
          ctx.log(
            `${d.name} gets the needle and a firm talking-to: back in ${d.injuryWeeks} week(s).`,
          );
        },
      },
      {
        label: 'Pay her 900 (two weeks off)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 900)) return;
          heal(d, 2);
          ctx.log(`${d.name} gets the full treatment: back in ${d.injuryWeeks} week(s).`);
        },
      },
      { label: 'Let nature take its course', apply: (ctx) => ctx.log('You thank her and leave.') },
    ],
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      if (!d) return 2;
      if (d.injuryWeeks >= 2 && ctx.p.cash > 4000) return 1;
      return ctx.p.cash > 1500 ? 0 : 2;
    },
  },
  {
    id: 'strayNight',
    name: 'A stray follows you home',
    text: 'A scruffy stray trots after you all the way back to the ship and sits at the ramp looking hopeful. Your dogs seem to like it. It also seems to be itching.',
    weight: 4,
    kind: 'choice',
    category: 'pound',
    roll: (ctx) => rollDog(ctx),
    choices: [
      {
        label: 'Let it sleep in the kennel tonight',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          formBy(d, 4);
          if (risk(ctx, 0.35)) {
            for (const x of ownDogs(ctx.s, ctx.p)) fit(x, -6);
            ctx.log(
              `${d.name} is besotted (+4 form). In the morning everybody has fleas (−6 fitness each).`,
            );
          } else ctx.log(`${d.name} is besotted with the stray (+4 form). It is gone by morning.`);
        },
      },
      { label: 'Shoo it away', apply: (ctx) => ctx.log('The stray sulks off into the dark.') },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'kennelHand',
    name: 'The kennel hand',
    text: 'A pound volunteer with forty dogs to walk offers to take yours out with them. Big park, long run, a hosepipe at the end. 150 Bones for the lot.',
    weight: 5,
    kind: 'choice',
    category: 'pound',
    choices: [
      {
        label: 'Pay her 150',
        apply: (ctx) => {
          if (!spend(ctx, 150)) return;
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, 6);
          ctx.log('Your dogs come back soaked and happy (+6 fitness each).');
        },
      },
      { label: 'They are fine', apply: (ctx) => ctx.log('You keep your dogs to yourself.') },
    ],
    aiChoice: (ctx) => {
      const dogs = ownDogs(ctx.s, ctx.p);
      const mean = dogs.reduce((a, d) => a + d.fitness, 0) / Math.max(1, dogs.length);
      return mean < 85 && ctx.p.cash > 800 ? 0 : 1;
    },
  },
  {
    id: 'breederEye',
    name: 'An old breeder',
    text: 'A woman who has bred racers for sixty years watches your dogs play in the yard. "That one," she says, pointing. "I know exactly how that one runs." She would tell you for a drink. She would also tell the whole bar.',
    weight: 5,
    kind: 'choice',
    category: 'pound',
    roll: (ctx) => rollDog(ctx, (d) => !d.styleKnown),
    choices: [
      {
        label: 'Buy her a drink (−120)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 120)) return;
          revealStyle(ctx, d, 'is, the old breeder tells the whole bar,');
        },
      },
      {
        label: 'Some things a dog should show you itself',
        apply: (ctx) => ctx.log('You let the dog keep its secret a while longer.'),
      },
    ],
    // Knowing your own dog's style before its first run is worth more than a drink (§7.3's board),
    // even though the whole table learns it too.
    aiChoice: (ctx) => (ctx.p.cash > 600 ? 0 : 1),
  },
  {
    id: 'dogShow',
    name: 'The pound dog show',
    text: 'The pound is holding its annual show — Best in Show, Waggiest Tail, Dog Most Likely to Bite a Judge. 100 to enter, 600 to the winner, and a rosette.',
    weight: 4,
    kind: 'choice',
    category: 'pound',
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    choices: [
      {
        label: 'Enter it (−100)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 100)) return;
          if (ctx.rng.chance(0.3)) {
            ctx.p.cash += 600;
            formBy(d, 3);
            ctx.log(`${d.name} wins Best in Show (+600, +3 form). Unbearable all week.`);
          } else {
            formBy(d, -2);
            ctx.log(`${d.name} bites a judge. Disqualified, and a little ashamed (−2 form).`);
          }
        },
      },
      { label: 'Racing dogs do not do shows', apply: (ctx) => ctx.log('You skip the show.') },
    ],
    aiChoice: () => 1,
  },
  {
    id: 'escapedDog',
    name: 'Slipped the lead',
    text: 'One of your dogs slips its lead at the pound gate and vanishes into the stray pens. The dog-catcher says he can have it back in an hour for 250. Or you can go in after it yourself.',
    weight: 4,
    kind: 'choice',
    category: 'pound',
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    choices: [
      {
        label: 'Pay the dog-catcher (−250)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          const paid = pay(ctx, 250);
          ctx.log(`The catcher brings ${d.name} back on a pole (−${paid}).`);
        },
      },
      {
        label: 'Go in after it',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          fit(d, -12);
          if (risk(ctx, 0.15)) {
            injure(d, 1);
            ctx.log(
              `You find ${d.name} two hours later, limping from a fight (−12 fitness, a week out).`,
            );
          } else ctx.log(`You chase ${d.name} round the pens for two hours (−12 fitness).`);
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 2500 ? 0 : 1),
  },
  {
    id: 'nutritionist',
    name: 'The pound nutritionist',
    text: 'A thin man in a lab coat feeds four hundred strays a day on almost nothing. He says he can fix what is wrong with one of your dogs in a week. 350 Bones.',
    weight: 4,
    kind: 'choice',
    category: 'pound',
    roll: (ctx) => rollDog(ctx),
    choices: [
      {
        label: 'Pay him (−350)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 350)) return;
          const stat = weakestStat(d);
          statBy(d, stat, 2);
          ctx.log(`${d.name} eats whatever he says (+2 ${stat}).`);
        },
      },
      { label: 'Send him away', apply: (ctx) => ctx.log('He shrugs and goes back to his strays.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 2000 ? 0 : 1),
  },
  {
    id: 'worms',
    name: 'Worms',
    text: 'The pound vet takes one look at one of your dogs and reaches for the rubber gloves. Tablets are 200. Or you could wait and see.',
    weight: 4,
    kind: 'choice',
    category: 'pound',
    roll: (ctx) => rollDog(ctx),
    choices: [
      {
        label: 'Buy the tablets (−200)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          const paid = pay(ctx, 200);
          ctx.log(`${d.name} is wormed (−${paid}). Nobody enjoyed it.`);
        },
      },
      {
        label: 'Wait and see',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          if (risk(ctx, 0.6)) {
            fit(d, -15);
            ctx.log(`${d.name} had worms after all (−15 fitness).`);
          } else ctx.log(`${d.name} was fine. The vet was just selling tablets.`);
        },
      },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 1200 ? 0 : 1),
  },
  {
    id: 'shelterDay',
    name: 'Volunteer day',
    text: 'The shelter is short-handed and the strays need walking. It would cost you the afternoon, and your dogs would have to come too.',
    weight: 4,
    kind: 'choice',
    category: 'pound',
    choices: [
      {
        label: 'Muck in',
        apply: (ctx) => {
          for (const d of ownDogs(ctx.s, ctx.p)) {
            formBy(d, 2);
            fit(d, -4);
          }
          ctx.log(
            'Your dogs spend the day with forty strays (+2 form, −4 fitness each). Good for the soul.',
          );
        },
      },
      { label: 'Busy, sorry', apply: (ctx) => ctx.log('You walk past the shelter.') },
    ],
    // Form decays toward zero at `formDecay` a week, so +2 is gone in a week; take it only for a
    // yard that is fresh enough to spare the fitness.
    aiChoice: (ctx) =>
      ownDogs(ctx.s, ctx.p).every((d) => d.fitness >= balance.fitnessScaleBelow + 25) ? 0 : 1,
  },

  // ---- Dogs offered (GDD_V3 §9.2). One of a kind a planet-week; the seller's honesty is the card's. ----
  offerCard(
    'strayOffer',
    'A stray nobody has claimed',
    'A volunteer walks a lean, bright-eyed stray out of the back pens. Nobody has claimed it in a month. She has watched it run round the yard, and she tells you what she saw.',
    10,
    { lieMult: 0.5 },
  ),
  offerCard(
    'runtOfTheLitter',
    'The runt of the litter',
    'A farmer in dungarees holds up a pup by the scruff. "Runt of the litter, but a goer." He wants it gone before his wife counts them again.',
    7,
    { lieMult: 1, ageMin: 1, ageMax: 2, levelShift: -3 },
    { ids: ['kibbleton', 'mudhaven'], boost: 3 },
  ),
  offerCard(
    'longCoatOffer',
    'A man in a long coat',
    'He opens the coat. There is a dog in it. "Won it in a card game. Papers? What papers?" He talks very fast about how it runs.',
    9,
    { lieMult: 1.8 },
    { ids: ['drift', 'lagrangeLows', 'rustgut', 'sunbleach'], boost: 2 },
  ),
  offerCard(
    'retiredRacer',
    'Not quite finished',
    'An old racer, grey round the muzzle, retired to the rescue home too soon — or so its handler says. Swap it for one of yours and it is yours.',
    6,
    { lieMult: 0.8, ageMin: 5, ageMax: 6, levelShift: 5 },
    { ids: ['oldWembley'], boost: 3 },
  ),
  offerCard(
    'monkRehome',
    'The monks rehome a dog',
    'A monk in a brown habit leads out a dog that has lived at the Almshouse since it was a pup. The monks do not lie. They will tell you exactly what it is.',
    3,
    { lieMult: 0 },
    { ids: ['holyBark', 'ossuary'], boost: 6 },
  ),
  offerCard(
    'batchDog',
    'Batch 7, jar 12',
    'A lab tech with a clipboard is clearing out the overstock: a clone grown for a client who never paid. The spec sheet is attached. The spec sheet is mostly right.',
    3,
    { lieMult: 0.5, ageMin: 1, ageMax: 3, levelShift: 2 },
    { ids: ['vatgrown', 'tinkertown'], boost: 6 },
  ),
];
