import type { ReactNode } from 'react';
import { useState } from 'react';
import { planetBackdrop } from '../lib/assets';
import type { Id } from '@sdr/engine';

/**
 * The painted planet (GDD §15.3). The stage paints its own chrome — accent wash, hazard
 * hatching, vignette and the name plate — the instant it mounts, and the 1920×1080 backdrop
 * fades in on top whenever it finishes loading. A planet with no image at all is therefore
 * still a legible screen, and a missing file is never a blank one.
 *
 * While the file on disk is still the generated stand-in (a .png, per lib/assets.ts) the stage
 * stamps PLACEHOLDER in the corner, and that stamp disappears by itself the moment the .webp
 * lands beside it.
 */
export function HubStage({
  planetId,
  name,
  vibe,
  children,
}: {
  planetId: Id;
  name: ReactNode;
  vibe: ReactNode;
  /** The hotspots. */
  children: ReactNode;
}) {
  const art = planetBackdrop(planetId);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="hub-stage">
      {art ? (
        <img
          className={`hub-backdrop${loaded ? ' on' : ''}${art.placeholder ? ' ph' : ''}`}
          src={art.url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
        />
      ) : null}
      <div className="hub-title">
        <h2>{name}</h2>
        <span className="vibe">{vibe}</span>
      </div>
      {children}
      {!art ? (
        <span className="hub-ph">no backdrop yet</span>
      ) : art.placeholder ? (
        <span className="hub-ph">placeholder</span>
      ) : null}
    </div>
  );
}
