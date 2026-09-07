import type { ReactNode } from 'react';

/**
 * GDD §16: "ticket-stub cards for races". One race, one stub — the class and purse printed on
 * a coloured tear-off in the planet's accent, the field underneath on manila card. Used by the
 * Race Office, the Bookie and the weekend card on the hub, so a race looks the same everywhere.
 */
export function TicketCard({
  cls,
  purse,
  cap,
  serial,
  sub,
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
  children?: ReactNode;
}) {
  return (
    <section className="ticket">
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
