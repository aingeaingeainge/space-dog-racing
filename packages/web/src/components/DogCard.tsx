import type { ReactNode } from 'react';
import { dogValue, formatBones, type Dog } from '@sdr/engine';
import { StatBar } from './StatBar';
import { Delta, Traits } from './ui';

/**
 * The portrait slot (GDD §16: 12 bodies × 6 palettes × 8 accessories, composed in code).
 *
 * Session 2 builds the compositor over `Dog.look`, which every dog has carried since M0. Until
 * then this is a labelled hole: hazard tape and the three layer indices, so it reads as a slot
 * waiting for art rather than a picture that failed to load.
 */
export function DogPortrait({ dog, big }: { dog: Dog; big?: boolean }) {
  const { body, palette, accessory } = dog.look;
  return (
    <div
      className={`portrait ph${big ? ' big' : ''}`}
      title={`Portrait slot — body ${body}, palette ${palette}, accessory ${accessory} (art lands in M3 session 2)`}
    >
      <span>
        portrait
        <br />
        b{body} p{palette} a{accessory}
      </span>
    </div>
  );
}

export interface DogCardProps {
  dog: Dog;
  /** Badges beside the name: declared class, injury, training. */
  badges?: ReactNode;
  /** Small print under the name. */
  sub?: ReactNode;
  /** Buttons along the bottom — the gear counter, mostly. */
  actions?: ReactNode;
  /** Anything extra between the stats and the actions. */
  children?: ReactNode;
  /** Lights the card's edge in the planet accent — used for this weekend's runners. */
  declared?: boolean;
}

/**
 * GDD §15.4: "your dogs as cards — portrait, stats bars, rating, fitness, form arrows, age,
 * traits, value, training focus". One card, used wherever a dog is the subject rather than a
 * row in a comparison.
 */
export function DogCard({ dog, badges, sub, actions, children, declared }: DogCardProps) {
  return (
    <article className={declared ? 'dogcard declared' : 'dogcard'}>
      <div className="head">
        <span className="nm">
          <b>{dog.name}</b>
          <span className="muted">
            {sub ?? `age ${dog.age} · ${dog.wins}/${dog.runs} · ${formatBones(dogValue(dog))}`}
          </span>
        </span>
        <span className="rating" title={`Rating ${dog.rating}`}>
          {dog.rating}
        </span>
      </div>
      <div className="mid">
        <DogPortrait dog={dog} />
        <div className="stats">
          <StatBar label="Spd" value={dog.speed} />
          <StatBar label="Acc" value={dog.accel} />
          <StatBar label="Sta" value={dog.stamina} />
          <StatBar label="Trp" value={dog.trap} />
          <StatBar label="Fit" value={dog.fitness} tone="auto" />
          <span className="form">
            form <Delta n={dog.form} />
          </span>
        </div>
      </div>
      <div className="tags">
        {badges}
        <Traits ids={dog.traits} />
      </div>
      {children ? <div className="extra">{children}</div> : null}
      {actions ? <div className="foot">{actions}</div> : null}
    </article>
  );
}
