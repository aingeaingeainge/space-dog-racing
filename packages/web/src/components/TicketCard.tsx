import type { ReactNode } from 'react';

/**
 * GDD §16: "ticket-stub cards for races". One race, one stub — the class and purse printed on
 * a coloured tear-off in the planet's accent, the field underneath on manila card. Used by the
 * Race Office, the Bookie and the weekend card on the hub, so a race looks the same everywhere.
 */
export type TicketTone = 'accent' | 'bronze' | 'silver' | 'gold';

export function TicketCard({
  cls,
  purse,
  cap,
  serial,
  sub,
  tone = 'accent',
  children,
}: {
  /** Bronze / Silver / Gold. */
  cls: ReactNode;
  purse: ReactNode;
  /** Rating cap, or whatever small print belongs on the stub. */
  cap?: ReactNode;
  /** Bottom-left small print: 2nd and 3rd money, usually. */
  serial?: ReactNode;
  sub?: ReactNode;
  /**
   * The stub's colour. The three race classes get metal, because three identical stubs side by
   * side is a worse screen than three that name themselves; everything else takes the planet's
   * accent like the rest of the chrome.
   */
  tone?: TicketTone;
  children?: ReactNode;
}) {
  return (
    <section className={tone === 'accent' ? 'ticket' : `ticket ${tone}`}>
      <div className="stub">
        <span className="cls">{cls}</span>
        {cap ? <span className="cap">{cap}</span> : null}
        <span className="purse">{purse}</span>
      </div>
      <div className="tear" />
      <div className="fill">
        {sub ? (
          <p className="muted tight-p">
            {sub}
          </p>
        ) : null}
        {children}
        {serial ? <div className="serial">{serial}</div> : null}
      </div>
    </section>
  );
}
