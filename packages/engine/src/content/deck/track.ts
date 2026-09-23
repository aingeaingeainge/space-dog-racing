/**
 * The Track (GDD_V3 §9.1): racing. A trial that shows the table how your dog runs (§5.4), gallops,
 * a private match, a pool, a coach — things that buy fitness, form or a stat point, at a price.
 *
 * Every card here is a row: two or three choices or a bit of flavour, a choice for the Normal AI, a
 * line in the log, and a story somebody tells afterwards (pillar 3). Its numbers are the card's own.
 */
import { balance } from '../balance';
import {
  dogOf,
  earn,
  fit,
  fittest,
  formBy,
  injure,
  ownDogs,
  revealStyle,
  rollDog,
  spend,
  statBy,
  type EventCard,
} from '../eventKit';
import { winProbAgainst } from '../../race/odds';

export const TRACK: readonly EventCard[] = [
  {
    id: 'trialRun',
    name: 'A timed trial',
    text: 'The track is open for trials this morning. Put a dog in the boxes, run it round alone against the clock, and see how it likes to race. The rail is lined with clockers taking notes.',
    weight: 7,
    kind: 'choice',
    category: 'track',
    // GDD_V3 §5.4: the Track door "includes a trial that reveals your own dog's style". Public,
    // because the clockers are watching — there is only one kind of knowing (decision C4).
    roll: (ctx) => rollDog(ctx, (d) => !d.styleKnown && d.injuryWeeks === 0),
    labels: (ctx) => [`Trial ${dogOf(ctx)?.name ?? 'it'} (−10 fitness)`, 'Keep it a secret'],
    choices: [
      {
        label: 'Trial it (−10 fitness)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          fit(d, -10);
          revealStyle(ctx, d, 'goes round alone and shows the clockers exactly what it is');
        },
      },
      { label: 'Keep it a secret', apply: (ctx) => ctx.log('You keep your dog under a blanket.') },
    ],
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      return d && d.fitness >= 70 ? 0 : 1;
    },
  },
  {
    id: 'hillGallops',
    name: 'Hill gallops',
    text: 'There is a hill behind the track that the old trainers swear by. Up it, down it, up it again. It builds a dog. It also flattens one for a week.',
    weight: 5,
    kind: 'choice',
    category: 'track',
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    labels: (ctx) => [
      `Hill work for ${dogOf(ctx)?.name ?? 'one dog'} (+2 stamina, −15 fitness)`,
      'A gentle canter for all of them (+5 fitness)',
    ],
    choices: [
      {
        label: 'Hill work for one dog',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          statBy(d, 'stamina', 2);
          fit(d, -15);
          ctx.log(`${d.name} does the hill four times and collapses (+2 stamina, −15 fitness).`);
        },
      },
      {
        label: 'A gentle canter for all of them',
        apply: (ctx) => {
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, 5);
          ctx.log('A gentle canter in the sunshine (+5 fitness each).');
        },
      },
    ],
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      return d && d.fitness >= 85 ? 0 : 1;
    },
  },
  {
    id: 'privateMatch',
    name: 'A private match',
    text: 'A local owner with a good dog and a bad temper wants a match race after the gallops: your fittest against his, one lap, 700 a side, no bookies.',
    weight: 5,
    kind: 'swing',
    category: 'track',
    roll: (ctx) => {
      const d = fittest(ctx);
      return d ? { dogId: d.id, theirs: ctx.rng.int(45, 60) } : null;
    },
    labels: (ctx) => [
      `Match ${dogOf(ctx)?.name ?? 'your fittest'} (700 a side; his is rated ${ctx.params.theirs})`,
      'Decline politely',
    ],
    choices: [
      {
        label: 'Match your fittest (700 a side)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 700)) return;
          fit(d, -12);
          const p = winProbAgainst(d.rating, [Number(ctx.params.theirs)]);
          if (ctx.rng.chance(p)) {
            earn(ctx, 1400);
            formBy(d, 3);
            ctx.log(`${d.name} wins the match by a length (+700, +3 form). He pays up in coins.`);
          } else {
            formBy(d, -2);
            ctx.log(`${d.name} is beaten fair and square (−700, −2 form).`);
          }
        },
      },
      { label: 'Decline politely', apply: (ctx) => ctx.log('He calls you a coward. It is fine.') },
    ],
    // His dog's rating is on the card; the match is a bet at evens, so take it when ours is better.
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      return d && d.rating > Number(ctx.params.theirs) + 3 && d.fitness >= 75 && ctx.p.cash > 2000
        ? 0
        : 1;
    },
  },
  {
    id: 'gateSchool',
    name: 'Starting-gate school',
    text: 'An old starter runs a school for dogs that miss the break. A week of bells, flaps and treats. 300.',
    weight: 5,
    kind: 'choice',
    category: 'track',
    roll: (ctx) => rollDog(ctx),
    labels: (ctx) => [`Send ${dogOf(ctx)?.name ?? 'a dog'} (−300, +2 accel)`, 'It breaks fine'],
    choices: [
      {
        label: 'Send a dog (−300)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 300)) return;
          statBy(d, 'accel', 2);
          ctx.log(`${d.name} learns to leave on the bell (+2 accel).`);
        },
      },
      { label: 'It breaks fine', apply: (ctx) => ctx.log('You leave the starter to his bells.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 2500 ? 0 : 1),
  },
  {
    id: 'hydroPool',
    name: 'The hydro pool',
    text: 'The track has a heated pool for tired legs. An hour in it for every dog, 250.',
    weight: 5,
    kind: 'choice',
    category: 'track',
    choices: [
      {
        label: 'In they go (−250)',
        apply: (ctx) => {
          if (!spend(ctx, 250)) return;
          for (const d of ownDogs(ctx.s, ctx.p)) fit(d, 10);
          ctx.log('Three wet, happy dogs (+10 fitness each).');
        },
      },
      { label: 'Dogs hate baths', apply: (ctx) => ctx.log('You spare them the pool.') },
    ],
    aiChoice: (ctx) => {
      const dogs = ownDogs(ctx.s, ctx.p);
      const mean = dogs.reduce((a, d) => a + d.fitness, 0) / Math.max(1, dogs.length);
      return mean < 80 && ctx.p.cash > 1000 ? 0 : 1;
    },
  },
  {
    id: 'schoolingRace',
    name: 'A schooling race',
    text: 'The track is running an unofficial schooling race for dogs that need a run. No purse, no rating, just the experience.',
    weight: 4,
    kind: 'choice',
    category: 'track',
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    labels: (ctx) => [
      `Give ${dogOf(ctx)?.name ?? 'a dog'} a run (+4 form, −12 fitness)`,
      'Save its legs',
    ],
    choices: [
      {
        label: 'Give it a run',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          formBy(d, 4);
          fit(d, -12);
          ctx.log(
            `${d.name} runs well in the schooling race and comes back full of itself (+4 form, −12 fitness).`,
          );
        },
      },
      { label: 'Save its legs', apply: (ctx) => ctx.log('You watch from the rail.') },
    ],
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      return d && d.fitness >= 85 ? 0 : 1;
    },
  },
  {
    id: 'sprintCoach',
    name: 'The sprint coach',
    text: 'A sprint coach with a whistle and a stopwatch says he can find a dog another yard of pace in a week. 400, and he is not cheap because he is good.',
    weight: 4,
    kind: 'choice',
    category: 'track',
    roll: (ctx) => rollDog(ctx),
    labels: (ctx) => [`Hire him for ${dogOf(ctx)?.name ?? 'a dog'} (−400, +2 speed)`, 'No thanks'],
    choices: [
      {
        label: 'Hire him (−400)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 400)) return;
          statBy(d, 'speed', 2);
          ctx.log(`${d.name} does a week of shuttle runs (+2 speed).`);
        },
      },
      { label: 'No thanks', apply: (ctx) => ctx.log('He blows his whistle at somebody else.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 3000 ? 0 : 1),
  },
  {
    id: 'treadmill',
    name: 'The telemetry treadmill',
    text: 'A technician will put one of your dogs on a sensor treadmill and print out exactly how it runs. The print-out goes on the public board. That is the law here.',
    weight: 3,
    kind: 'choice',
    category: 'track',
    planets: ['vatgrown', 'tinkertown'],
    planetBoost: 4,
    roll: (ctx) => rollDog(ctx, (d) => !d.styleKnown),
    labels: (ctx) => [`Put ${dogOf(ctx)?.name ?? 'it'} on the treadmill (−200)`, 'No sensors'],
    choices: [
      {
        label: 'Put it on the treadmill (−200)',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d || !spend(ctx, 200)) return;
          revealStyle(ctx, d, 'runs on the treadmill; the print-out says');
        },
      },
      { label: 'No sensors', apply: (ctx) => ctx.log('You keep your dog off the machine.') },
    ],
    aiChoice: (ctx) => (ctx.p.cash > 800 ? 0 : 1),
  },
  {
    id: 'bogGallops',
    name: 'Bog gallops',
    text: 'The swamp trainers gallop their dogs through knee-deep mud. It builds legs like tree trunks. It also builds swamp fever.',
    weight: 3,
    kind: 'swing',
    category: 'track',
    planets: ['mudhaven', 'ossuary'],
    planetBoost: 4,
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    labels: (ctx) => [`Into the bog with ${dogOf(ctx)?.name ?? 'a dog'}`, 'Stay on dry land'],
    choices: [
      {
        label: 'Into the bog',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          statBy(d, 'stamina', 3);
          if (ctx.rng.chance(0.25)) {
            fit(d, -25);
            ctx.log(
              `${d.name} comes out stronger (+3 stamina) and shivering with swamp fever (−25 fitness).`,
            );
          } else ctx.log(`${d.name} comes out of the bog with legs like tree trunks (+3 stamina).`);
        },
      },
      { label: 'Stay on dry land', apply: (ctx) => ctx.log('You keep your dogs out of the mud.') },
    ],
    aiChoice: (ctx) => {
      const d = dogOf(ctx);
      return d && d.fitness >= balance.fitnessScaleBelow + 25 ? 0 : 1;
    },
  },
  {
    id: 'iceWork',
    name: 'Work on the ice',
    text: 'Glassfall trainers teach their dogs to corner on sheet ice. A dog that can hold a bend on ice can hold one anywhere. Some of them learn by falling over.',
    weight: 3,
    kind: 'swing',
    category: 'track',
    planets: ['glassfall'],
    planetBoost: 5,
    roll: (ctx) => rollDog(ctx, (d) => d.injuryWeeks === 0),
    labels: (ctx) => [`Put ${dogOf(ctx)?.name ?? 'a dog'} on the ice`, 'Too slippery'],
    choices: [
      {
        label: 'On the ice',
        apply: (ctx) => {
          const d = dogOf(ctx);
          if (!d) return;
          statBy(d, 'accel', 3);
          if (ctx.rng.chance(0.2)) {
            injure(d, 1);
            ctx.log(
              `${d.name} learns to corner (+3 accel) the hard way: a sprained wrist, a week out.`,
            );
          } else ctx.log(`${d.name} learns to corner on glass (+3 accel).`);
        },
      },
      { label: 'Too slippery', apply: (ctx) => ctx.log('You watch the local dogs spin.') },
    ],
    aiChoice: (ctx) => (ctx.s.week < balance.weeks - 1 ? 0 : 1),
  },
];
