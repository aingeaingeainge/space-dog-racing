import type { ReactNode } from 'react';

export interface PanelProps {
  title: ReactNode;
  /** Small print under the title: planet vibe, rating cap, that sort of thing. */
  sub?: ReactNode;
  /** Buttons pinned to the right of the header. */
  actions?: ReactNode;
  /** Drop the body padding — for panels that are nothing but a table. */
  tight?: boolean;
  children?: ReactNode;
}

/**
 * The one frame every screen sits in.
 *
 * M1 and M2 both kept the promise that every screen sits inside this component and nothing
 * else, and M3 is the payoff: the riveted metal plate of GDD §16 arrived as CSS on these exact
 * class names, with the same four props and not a line changed in any screen. The header rule
 * and the title are painted in the planet's first accent, so the frame tints itself.
 */
export function Panel({ title, sub, actions, tight, children }: PanelProps) {
  return (
    <section className={tight ? 'panel tight' : 'panel'}>
      <header>
        <h2>{title}</h2>
        {sub ? <span className="sub">{sub}</span> : null}
        {actions ? <span className="head-actions">{actions}</span> : null}
      </header>
      <div className="body">{children}</div>
    </section>
  );
}
