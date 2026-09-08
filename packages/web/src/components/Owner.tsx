import { useState } from 'react';
import type { Player } from '@sdr/engine';
import { ownerArtFor, ownerLine } from '../lib/owners';

/**
 * The face across the table (GDD §14: "a name, a colour, a portrait and a one-line
 * personality"). Display only — nothing here reaches the AI's decisions, which stay M4's.
 *
 * Two sizes and two degrade paths. In a table the face is a chip beside the saddle-cloth
 * swatch that already names the stable, so with no finished art it simply is not there and the
 * row reads exactly as it did before. On the podium the portrait is the point, so a missing one
 * leaves the hatched slot rather than a gap. Either way an image that fails to load hides
 * itself and falls back to the same place.
 */
export function OwnerFace({ player, big }: { player: Player; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  const art = ownerArtFor(player);
  const line = ownerLine(player);
  const usable = art && !art.placeholder && !broken;

  if (!usable) {
    if (!big) return null;
    return (
      <span className="ownerface big ph" title={line ?? player.name}>
        <span>
          owner
          <br />
          portrait
        </span>
      </span>
    );
  }
  return (
    <span className={big ? 'ownerface big' : 'ownerface'} title={line ?? player.name}>
      <img src={art.url} alt="" decoding="async" loading="lazy" onError={() => setBroken(true)} />
    </span>
  );
}

/** The one-liner, where there is room for it. */
export function OwnerBlurb({ player }: { player: Player }) {
  const line = ownerLine(player);
  if (!line) return null;
  return <span className="owner-blurb">{line}</span>;
}
