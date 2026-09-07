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
 * The one frame every screen sits in. M1 renders it as a plain box; M3 swaps in the riveted
 * metal panel of the art bible by rewriting this component alone, not the screens.
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
