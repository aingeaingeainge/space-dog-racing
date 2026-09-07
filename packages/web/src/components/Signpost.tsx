import type { ReactNode } from 'react';

/**
 * GDD §15.3: "Planet special rules on a signpost." A rust-brown board bolted to the hub with
 * one slat per always-on rule, each keyed to the planet's first accent. The rules themselves
 * come from lib/planetText.ts, which reads PlanetSpecial — add a rule to the data and it
 * appears here without a line of layout changing.
 */
export function Signpost({
  title = 'Local rules',
  rules,
  empty = 'No special rules on this rock.',
  children,
}: {
  title?: ReactNode;
  rules: readonly string[];
  empty?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="signpost">
      <h3>{title}</h3>
      {rules.length ? (
        <div className="slats">
          {rules.map((r) => (
            <span className="slat" key={r}>
              {r}
            </span>
          ))}
        </div>
      ) : (
        <p className="none flush">
          {empty}
        </p>
      )}
      {children}
    </div>
  );
}
