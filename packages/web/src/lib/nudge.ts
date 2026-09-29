/**
 * **A nudge arriving** (ONLINE_PLAN §5.1, V25): a short sound and a flashing tab title until the
 * window has focus. The room sends at most one a minute a seat, so this plays at most that often.
 *
 * The sound is generated — a two-note blip from Web Audio — not an asset, and failing to play it
 * (no audio device, autoplay refused, an old browser) is silent.
 */
export function blip(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const at = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    for (const [freq, start] of [
      [660, 0],
      [990, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, at + start);
      osc.connect(gain);
      osc.start(at + start);
      osc.stop(at + start + 0.18);
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 800);
  } catch {
    // No sound: the flashing title still says it.
  }
}

/**
 * Flash the tab's title between `text` and what it was, until the window has focus (or, if it has
 * focus already, for a few seconds). Returns a stop function; `onFocus` runs when it stops on focus.
 */
export function flashTitle(text: string, onFocus: () => void): () => void {
  const original = document.title;
  let on = false;
  let stopped = false;
  const timer = window.setInterval(() => {
    on = !on;
    document.title = on ? text : original;
  }, 900);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener('focus', focused);
    document.title = original;
  };
  const focused = () => {
    stop();
    onFocus();
  };
  window.addEventListener('focus', focused);
  if (document.hasFocus()) window.setTimeout(focused, 4000);
  return stop;
}
