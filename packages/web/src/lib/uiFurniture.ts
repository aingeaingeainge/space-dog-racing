import { uiArt } from './assets';

/**
 * The painted furniture behind the kit (design/ASSET_LIST.md, group `ui`).
 *
 * Every one of these is already drawn in CSS or, for the hotspots, stood in for by an emoji —
 * session 1 built the whole look without a single image, which is why this group is tier 3 and
 * last. So none of it is a rewrite: each finished file is published here as a custom property,
 * and app.css names that property with the CSS it already had as the fallback. Nothing changes
 * until a `.webp` lands; the moment one does, that surface is painted instead.
 *
 * Stand-ins are ignored on purpose. A hatched "PLACEHOLDER" tile repeated across every panel
 * would be far worse than the brushed metal the kit already draws, and the placeholder promise
 * is kept where it belongs — on the big art, and in `npm run asset-check`.
 *
 * The properties go on the document root, once, at boot — not on the planet theme. Nothing here
 * mixes another custom property (M3 note 6's trap), the set never changes during a season, and
 * keeping it out of `theme/planetTheme.tsx` is what stops `race-view/palette.ts` — and through
 * it `scripts/race-view-check.ts` — from ever having to resolve a Vite glob outside Vite.
 */
const TEXTURES = ['plate', 'rivet', 'ticket', 'slip', 'signpost', 'logo'] as const;

/** Put `--art-plate`, `--art-rivet`, … on the document for every piece of finished art there is. */
export function applyFurniture(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const id of TEXTURES) {
    const art = uiArt(id);
    if (art && !art.placeholder) root.style.setProperty(`--art-${id}`, `url(${art.url})`);
  }
}

/** Which pieces are actually painted — for the notes, and for asset-check to agree with. */
export function furnitureInPlace(): string[] {
  return TEXTURES.filter((id) => {
    const art = uiArt(id);
    return !!art && !art.placeholder;
  });
}
