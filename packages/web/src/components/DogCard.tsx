import { useEffect, useRef, useState, type ReactNode } from 'react';
import { dogValue, formatBones, type Dog } from '@sdr/engine';
import { StatBar } from './StatBar';
import { Delta, Traits } from './ui';
import {
  lookKey,
  lookTitle,
  paintPortrait,
  peekPortrait,
  portraitFor,
  type Look,
} from '../lib/dogArt';

/**
 * The composited portrait (GDD §16: 12 bodies × 6 palettes × 8 accessories, composed in code).
 *
 * lib/dogArt.ts does the work and caches by look, so eight dogs on a screen composite at most
 * eight times ever, not eight times a frame. Everything here is the degrade path:
 *
 * - no finished body art for this look → the labelled hole, exactly as session 1 left it
 * - a body but no accessory → the body alone, which dogArt already handles
 * - a file that will not load → the labelled hole again, never an empty box
 *
 * A stand-in .svg counts as "no art": the labelled hole names the three layers, which is more
 * use than a generic placeholder, and it keeps a tinted dog on screen honest — if you can see
 * a coat, that coat is real art.
 */
function useComposite(look: Look): HTMLCanvasElement | null {
  const key = lookKey(look);
  const [art, setArt] = useState<HTMLCanvasElement | null>(() => peekPortrait(look));

  useEffect(() => {
    const ready = peekPortrait(look);
    if (ready) {
      setArt(ready);
      return;
    }
    let live = true;
    void portraitFor(look).then((made) => {
      if (live) setArt(made);
    });
    return () => {
      live = false;
    };
    // `key` is the whole of what a composite depends on: same three indices, same picture.
  }, [key, look]);

  return art;
}

function Composite({ art, className }: { art: HTMLCanvasElement; className: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) paintPortrait(ref.current, art);
  }, [art]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export function DogPortrait({ dog, big }: { dog: Dog; big?: boolean }) {
  const { body, palette, accessory } = dog.look;
  const art = useComposite(dog.look);

  if (!art) {
    return (
      <div
        className={`portrait ph${big ? ' big' : ''}`}
        title={`Portrait slot — body ${body}, palette ${palette}, accessory ${accessory} (no finished art for this body yet)`}
      >
        <span>
          portrait
          <br />b{body} p{palette} a{accessory}
        </span>
      </div>
    );
  }

  return (
    <div className={`portrait${big ? ' big' : ''}`} title={lookTitle(dog)}>
      <Composite art={art} className="portrait-canvas" />
    </div>
  );
}

/**
 * The same portrait at table size, for the screens where you want to recognise a dog rather
 * than study it: the Market's two tables, the Race Office's chosen runner, the Bookie's field.
 * A look with no art keeps a chip with its body number, so a half-generated set does not leave
 * a table half-ragged.
 */
export function DogThumb({ dog, title, big }: { dog: Dog; title?: string; big?: boolean }) {
  const art = useComposite(dog.look);
  if (!art) {
    return (
      <span
        className={`dogthumb ph${big ? ' big' : ''}`}
        title={title ?? `No portrait art yet — body ${dog.look.body}`}
        aria-hidden="true"
      >
        {dog.look.body}
      </span>
    );
  }
  return (
    <span className={`dogthumb${big ? ' big' : ''}`} title={title ?? lookTitle(dog)}>
      <Composite art={art} className="portrait-canvas" />
    </span>
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
