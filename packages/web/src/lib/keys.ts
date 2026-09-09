import { useEffect, useRef } from 'react';

/** Key name (as `KeyboardEvent.key`) to what it does. Lower-case letters; 'Enter', 'Escape', ' '. */
export type KeyMap = Record<string, (() => void) | undefined>;

/**
 * One keystroke per control — the pattern RaceView has used since M2, lifted into a hook so the
 * rest of the game can have it without four copies of the same listener.
 *
 * Two rules it enforces for every caller. A keystroke is ignored while the player is typing into a
 * field, so the seed box and the stake sliders keep working; and any modifier means the browser's
 * shortcut wins, so nothing here shadows ⌘R or Ctrl-F. The map is read through a ref, so a caller
 * may rebuild it every render — which they all do, since what a key means depends on the state —
 * without the listener being torn down and rebound each time.
 */
export function useKeys(map: KeyMap): void {
  const latest = useRef(map);
  latest.current = map;
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      const fn = latest.current[e.key] ?? latest.current[e.key.toLowerCase()];
      if (!fn) return;
      e.preventDefault();
      fn();
    }
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, []);
}
