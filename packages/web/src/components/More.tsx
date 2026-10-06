import { useState, type ReactNode } from 'react';

/**
 * Phase P: the "?" that every cut explanation moved behind. One press opens it, one closes it; the
 * text inside is whatever the screen used to print out loud. A returning player never has to read
 * it, a new one is always one press from it (GDD_V3 pillar 1: explainable in a sentence, visible on
 * one screen).
 */
export function More({
  label = 'How this works',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={open ? 'more primary' : 'more'}
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open ? <div className="more-body">{children}</div> : null}
    </>
  );
}
