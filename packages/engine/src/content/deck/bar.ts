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
  giveIntel,
  giveTip,
  rollGoods,
  rollTip,
  type EventCard,
  luck,
} from '../eventKit';
import { weakestStat } from '../../economy/dogValue';
import { hireSlot, unemployedStaff } from '../../economy/staff';
import { cutOf, STAFF_BONUS_BY_ID, staffRow, type StaffRow } from '../staff';
import { GOOD_IDS, type Dog, type GoodId } from '../../types';
import type { EventChoice, EventCtx } from '../eventKit';

/** What a trainer's offer says: who they are, what they do, what they take (GDD_V3 §8.2). */
export function describeTrainer(row: StaffRow): string {
  const does = row.bonuses.map((b) => STAFF_BONUS_BY_ID[b].text).join('; and ');
  return `${row.name}. ${row.blurb} ${does}. Takes ${Math.round(cutOf(row) * 100)}% of your race prize money — purses only, never a bet or a trade.`;
}

/**
 * A Bar card that offers a trainer looking for work (GDD_V3 §8, Phase D2 item 2). You see who they
 * are, what they do and what they take. You can hire them into a slot — letting that trainer go,
 * named on the button — or walk away. **Walk away comes first**, as D1's dog offers do, so Enter
 * never fires anybody. The card is one of a kind on the planet-week (`unique`), and the trainer is
 * drawn on the stable's own stream from whoever nobody employs.
 */
function trainerCard(
  id: string,
  name: string,
  text: string,
  weight: number,
  pickFrom: (free: StaffRow[]) => StaffRow[] = (free) => free,
  planets?: { ids: string[]; boost: number },
): EventCard {
  const hire = (slot: number): EventChoice => ({
    label: `Hire — let trainer ${slot + 1} go`,
    apply: (ctx: EventCtx) => {
      const row = staffRow(String(ctx.params.staffId));
      if (ctx.s.players.some((x) => x.staff.includes(row.id))) {
        ctx.log(`${row.name} has already taken a job with somebody else.`);
        return;
      }
      const gone = ctx.p.staff[slot];
      if (gone) ctx.p.staff[slot] = row.id;
      else ctx.p.staff.push(row.id);
      ctx.p.stats.staffHired++;
      ctx.log(
        gone
          ? `${row.name} is hired, at ${Math.round(cutOf(row) * 100)}% of the purses. ${staffRow(gone).name} packs a bag and goes.`
          : `${row.name} is hired, at ${Math.round(cutOf(row) * 100)}% of the purses.`,
      );
    },
  });
  return {
    id,
    name,
    text,
    weight,
    kind: 'choice',
    category: 'bar',
    unique: true,
    ...(planets ? { planets: planets.ids, planetBoost: planets.boost } : {}),
    roll: (ctx) => {
      const free = pickFrom(unemployedStaff(ctx.s));
      if (!free.length) return null;
      ctx.p.stats.staffOffers++;
      return { staffId: ctx.rng.pick(free).id };
    },
    detail: (ctx) => describeTrainer(staffRow(String(ctx.params.staffId))),
    labels: (ctx) => [
      'Walk away',
      ...[0, 1].map((i) => {
        const now = ctx.p.staff[i];
        return now ? `Hire — let ${staffRow(now).name} go` : 'Hire into the empty slot';
      }),
    ],
    choices: [
      {
        label: 'Walk away',
        apply: (ctx) => ctx.log(`You wish ${staffRow(String(ctx.params.staffId)).name} luck.`),
      },
      hire(0),
      hire(1),
    ],
    // Normal: hire into the slot of the trainer worth least to it, if the offer beats that trainer
    // by two points of its weekly prize money (economy/staff.ts `hireSlot`).
    aiChoice: (ctx) => 1 + hireSlot(ctx.s, ctx.p, staffRow(String(ctx.params.staffId))),
  };
}

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
          if (luck(ctx, 0.5)) {
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
    text: 'A reporter from The Daily Muzzle wants a quote about your stable for the weekend edition. She pays 200 for a good one. The last owner who gave her a good one got torn apart when his dogs lost.',
    weight: 4,
    kind: 'choice',
    category: 'bar',
    choices: [
      {
        label: 'Give her a headline (+200)',
        apply: (ctx) => {
          earn(ctx, 200);
          for (const d of ownDogs(ctx.s, ctx.p)) formBy(d, -1);
          ctx.log('"We will win everything." +200. The dogs feel the pressure (−1 form each).');
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
          if (luck(ctx, 0.5)) ctx.log('The barman finds the real culprit asleep in the toilets.');
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

  // ---- Next week's shelf (GDD_V3 §9.4, Phase D1 item 5): the only way through the fog. ----
  {
    id: 'freightClerk',
    name: 'The freight clerk',
    text: 'A freight clerk has next week’s price sheets for the planet you are flying to — every good, every shelf. He will read them to you for 300. He will not write them down.',
    weight: 5,
    kind: 'choice',
    category: 'bar',
    roll: (ctx) => (ctx.s.nextPlanet ? {} : null),
    choices: [
      {
        label: 'Pay him to read (−300)',
        apply: (ctx) => {
          if (spend(ctx, 300)) giveIntel(ctx, GOOD_IDS);
        },
      },
      { label: 'You like surprises', apply: (ctx) => ctx.log('The clerk folds his sheets away.') },
    ],
    // Worth it to a stable with money to trade: that is who the next shelf matters to.
    aiChoice: (ctx) => (ctx.p.cash > 3000 ? 0 : 1),
  },
  {
    id: 'dockers',
    name: 'Dockers on their break',
    text: 'Two dockers are arguing about what next week’s planet is paying for food. They have both just come from there. They do not mind you listening if you buy the round.',
    weight: 5,
    kind: 'choice',
    category: 'bar',
    roll: (ctx) => (ctx.s.nextPlanet ? { goods: rollGoods(ctx.rng, 2) } : null),
    choices: [
      {
        label: 'Buy the round (−60)',
        apply: (ctx) => {
          if (spend(ctx, 60)) giveIntel(ctx, String(ctx.params.goods).split(',') as GoodId[]);
        },
      },
      { label: 'Drink up and go', apply: (ctx) => ctx.log('You leave the dockers to it.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 500 ? 0 : 1),
  },
  {
    id: 'commodityMan',
    name: 'A man with a price board',
    text: 'A commodities man in a velvet jacket has a little chalk board of next week’s prices. He will rub out all but three and let you look. 150.',
    weight: 4,
    kind: 'choice',
    category: 'bar',
    roll: (ctx) => (ctx.s.nextPlanet ? { goods: rollGoods(ctx.rng, 3) } : null),
    choices: [
      {
        label: 'Look at the board (−150)',
        apply: (ctx) => {
          if (spend(ctx, 150)) giveIntel(ctx, String(ctx.params.goods).split(',') as GoodId[]);
        },
      },
      { label: 'Walk on', apply: (ctx) => ctx.log('He rubs out the board.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 1500 ? 0 : 1),
  },

  // ---- Trainers looking for work (GDD_V3 §8, Phase D2 item 2). One of a kind a planet-week. ----
  trainerCard(
    'trainerBetweenYards',
    'A trainer between yards',
    'Somebody at the end of the bar has a whistle round their neck and nobody to blow it at. They have heard about your dogs. They would like to hear more — and to talk about money.',
    14,
  ),
  trainerCard(
    'trainerWalkedOut',
    'Walked out this morning',
    'A trainer threw a bucket at a stable owner at breakfast and has been drinking to it ever since. Good with dogs, they say. Less good with owners.',
    12,
  ),
  trainerCard(
    'trainerOldHand',
    'An old hand',
    'The barman points you at a corner table. "Trained three Grand Final winners, that one. Not lately." The old hand looks up. One trick, done properly, for a small cut.',
    11,
    (free) => {
      const singles = free.filter((r) => r.bonuses.length === 1);
      return singles.length ? singles : free;
    },
    { ids: ['oldWembley', 'ossuary', 'kibbleton'], boost: 2 },
  ),
  trainerCard(
    'trainerAgent',
    'An agent with a list',
    'A sharp little agent in a sharper suit slides a card across the bar. "I represent talent. Expensive talent. Two tricks each, minimum." The list is short and every name on it is dear.',
    10,
    (free) => {
      const pairs = free.filter((r) => r.bonuses.length > 1);
      return pairs.length ? pairs : free;
    },
    { ids: ['neonSnout', 'collarPrime', 'cosmodrome'], boost: 2 },
  ),
];
