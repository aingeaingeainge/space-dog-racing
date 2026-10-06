import { useEffect, useState, type ReactNode } from 'react';

/**
 * Phase P: the first-game guide. One line at the moment it matters — "Pick a door", "Put a dog in
 * each race" — and never again once it has been shown and the player has moved on. Not a tutorial:
 * it teaches nothing the screen does not, it only says which thing on it to press first.
 *
 * What has been seen lives in this browser's storage (a per-viewer convenience, never game state:
 * nothing here reaches the engine, a save or a room). A browser that cannot store simply shows the
 * line each time it applies; "No more tips" turns them all off.
 */
const KEY = 'sdr.guide.v1';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function write(seen: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    // Storage refused: the tip shows again next time, which is harmless.
  }
}

export function Guide({ id, children }: { id: string; children: ReactNode }) {
  const [show] = useState(() => {
    const seen = read();
    return !seen.has(id) && !seen.has('*');
  });
  const [hidden, setHidden] = useState(false);
  // Seen once shown: leaving the screen is moving on.
  useEffect(() => {
    if (!show) return;
    return () => {
      const seen = read();
      seen.add(id);
      write(seen);
    };
  }, [show, id]);
  if (!show || hidden) return null;
  return (
    <div className="guide" role="note">
      <span>{children}</span>
      <button
        type="button"
        className="link"
        onClick={() => {
          const seen = read();
          seen.add('*');
          write(seen);
          setHidden(true);
        }}
      >
        No more tips
      </button>
    </div>
  );
}
