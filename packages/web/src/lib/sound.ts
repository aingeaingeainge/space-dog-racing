/**
 * **The sound of the circuit** (v3 Phase R). Every sound in the game is synthesised here with Web
 * Audio — noise, oscillators and envelopes — so there is not one byte of audio to download, and the
 * asset budget (`npm run asset-check`) does not move.
 *
 * UI only. Nothing in here reads or writes game state, rolls a number the engine sees, or changes what
 * a replay does: `Math.random` is fine in this file (the jitter on a coin or a cheer), because the
 * engine is the only place held to determinism. Every entry point is a no-op where there is no
 * `AudioContext` — the headless walks, an old browser, a refused autoplay — and nothing here throws.
 *
 * One switch, **Sound on / off**, in the top bar and on race day (key: V). It is a browser
 * preference, not part of a save: a game played on a muted laptop resumes muted, and a seed link
 * never carries it.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'sdr.sound';

type Ctx = AudioContext;

let enabled = readPref();
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const listeners = new Set<() => void>();

function readPref(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Is sound on? Defaults to on; the choice is remembered per browser. */
export function soundOn(): boolean {
  return enabled;
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  try {
    globalThis.localStorage?.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // A private window: the switch still works for this visit.
  }
  if (master && ctx) {
    const at = ctx.currentTime;
    master.gain.cancelScheduledValues(at);
    master.gain.setTargetAtTime(on ? MASTER : 0, at, 0.04);
  }
  if (!on) crowd.stop(true);
  else
    void ensure()
      ?.resume?.()
      .catch(() => undefined);
  for (const fn of listeners) fn();
}

export function toggleSound(): void {
  setSoundOn(!enabled);
}

/** React: re-render when the switch moves. */
export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => enabled,
    () => enabled,
  );
}

const MASTER = 0.55;

/**
 * The context, made on first use. Browsers start it suspended until a press, so the first press or
 * key anywhere on the page resumes it — which is always before the first sound worth hearing.
 */
function ensure(): Ctx | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  try {
    const C =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = enabled ? MASTER : 0;
    // A gentle limiter, so a cheer on top of a bell on top of the coins never clips.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

if (typeof window !== 'undefined') {
  const wake = () => {
    const c = ensure();
    if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', wake, { capture: true, passive: true });
  window.addEventListener('keydown', wake, { capture: true });
}

/** The context, only if sound is on and it is running. Every sound starts by asking. */
function live(): Ctx | null {
  if (!enabled) return null;
  const c = ensure();
  if (!c || !master) return null;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  return c;
}

function noiseBuffer(c: Ctx): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // Pinkish: white noise through a one-pole low-pass, so the crowd is a roar and not a hiss.
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = 0.86 * last + 0.14 * white;
    d[i] = last * 3.2;
  }
  noise = buf;
  return buf;
}

/** A gain envelope: up in `attack`, down to silence by `attack + decay`. */
function env(c: Ctx, at: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(master!);
  return g;
}

function tone(
  c: Ctx,
  type: OscillatorType,
  freq: number,
  at: number,
  peak: number,
  attack: number,
  decay: number,
  glideTo?: number,
): void {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + attack + decay);
  o.connect(env(c, at, peak, attack, decay));
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

function burst(
  c: Ctx,
  at: number,
  peak: number,
  dur: number,
  filter: BiquadFilterType,
  freq: number,
  q = 1,
  sweepTo?: number,
): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  f.Q.value = q;
  src.connect(f);
  f.connect(env(c, at, peak, Math.min(0.01, dur / 4), dur));
  src.start(at, Math.random() * 1.5);
  src.stop(at + dur + 0.1);
}

const jitter = (n: number) => n * (0.92 + Math.random() * 0.16);

// --- one-shots ------------------------------------------------------------------------------

/** A primary button: a short soft tick. */
export function sfxTap(): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime;
  tone(c, 'triangle', 1500, at, 0.05, 0.004, 0.05, 700);
}

/** A bet struck: two or three chips clacking onto the counter. */
export function sfxChips(): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime;
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const t = at + i * jitter(0.055);
    burst(c, t, 0.22, 0.035, 'bandpass', jitter(3800), 3);
    tone(c, 'sine', jitter(2400), t, 0.04, 0.002, 0.05);
  }
}

/** A trade at the Market: the drawer of an old till. */
export function sfxRegister(): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime;
  burst(c, at, 0.18, 0.06, 'highpass', 2500, 0.7);
  tone(c, 'sine', 2093, at + 0.05, 0.09, 0.004, 0.45);
  tone(c, 'sine', 3136, at + 0.05, 0.05, 0.004, 0.35);
}

/** Money coming in: a little shower of coins, more of them for more Bones. */
export function sfxCoins(amount: number): void {
  const c = live();
  if (!c || amount <= 0) return;
  const at = c.currentTime;
  const n = Math.max(3, Math.min(12, Math.round(2 + amount / 600)));
  for (let i = 0; i < n; i++) {
    const t = at + i * jitter(0.07);
    const f = 1800 + Math.random() * 900;
    tone(c, 'triangle', f, t, 0.08, 0.003, 0.16);
    tone(c, 'sine', f * 1.5, t, 0.03, 0.003, 0.1);
  }
}

/** The traps going up: a clank of metal and a thud. */
export function sfxTraps(): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime + 0.02;
  burst(c, at, 0.5, 0.14, 'bandpass', 520, 1.8);
  burst(c, at + 0.015, 0.3, 0.09, 'bandpass', 1700, 4);
  tone(c, 'square', 95, at, 0.18, 0.004, 0.16, 55);
}

/** The hare running: the lure's motor whining up to speed. */
export function sfxHare(): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, at);
  o.frequency.exponentialRampToValueAtTime(330, at + 1.3);
  o.frequency.exponentialRampToValueAtTime(300, at + 2.2);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.06, at + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
  o.connect(f);
  f.connect(g);
  g.connect(master!);
  o.start(at);
  o.stop(at + 2.5);
}

/** The winner home: the judge's bell, struck once. */
export function sfxBell(): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime;
  for (const [ratio, peak, decay] of [
    [1, 0.16, 1.6],
    [2.76, 0.07, 0.9],
    [5.4, 0.035, 0.5],
    [8.93, 0.015, 0.3],
  ] as const) {
    tone(c, 'sine', 740 * ratio, at, peak, 0.003, decay);
  }
}

/** A photo finish: the shutter, twice, and the crowd holding its breath. */
export function sfxShutter(): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime;
  burst(c, at, 0.35, 0.03, 'highpass', 3000, 0.8);
  burst(c, at + 0.11, 0.3, 0.05, 'bandpass', 1400, 2);
  crowd.gasp();
}

/** A card turned up behind a door: a quick whoosh. */
export function sfxCard(): void {
  const c = live();
  if (!c) return;
  burst(c, c.currentTime, 0.16, 0.32, 'bandpass', 300, 1.2, 2600);
}

/** What was behind the door: up for money in, down for money out, a shrug for neither. */
export function sfxSting(mood: 'good' | 'bad' | 'meh'): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime + 0.03;
  if (mood === 'good') {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(c, 'square', f, at + i * 0.07, 0.035, 0.005, 0.22),
    );
  } else if (mood === 'bad') {
    tone(c, 'sawtooth', 311, at, 0.05, 0.01, 0.32, 277);
    tone(c, 'sawtooth', 262, at + 0.34, 0.05, 0.01, 0.6, 196);
  } else {
    tone(c, 'triangle', 440, at, 0.04, 0.005, 0.18);
    tone(c, 'triangle', 392, at + 0.12, 0.04, 0.005, 0.25);
  }
}

/** The season over: a short fanfare, longer and brighter for the stable that won it. */
export function sfxFanfare(won: boolean): void {
  const c = live();
  if (!c) return;
  const at = c.currentTime + 0.05;
  const notes = won ? [392, 523, 659, 784, 659, 1047] : [392, 494, 587, 523];
  const step = won ? 0.13 : 0.16;
  notes.forEach((f, i) => {
    const last = i === notes.length - 1;
    tone(c, 'square', f, at + i * step, 0.04, 0.006, last ? 0.9 : 0.14);
    tone(c, 'triangle', f / 2, at + i * step, 0.05, 0.006, last ? 0.9 : 0.14);
  });
}

// --- the crowd ------------------------------------------------------------------------------

interface CrowdNodes {
  src: AudioBufferSourceNode;
  roar: GainNode;
  paws: GainNode;
  pawLfo: OscillatorNode;
  pawSrc: AudioBufferSourceNode;
}

let nodes: CrowdNodes | null = null;

/**
 * The stands and the paws, for the length of one race. A looped roar whose level the race view sets
 * from how close and how late the race is, and a low drumming of paws whose beat follows the replay
 * speed. Reactions (an "ooh" for a bump, a cheer for a lead change, the swell at the line) sit on top.
 */
export const crowd = {
  start(): void {
    const c = live();
    if (!c || nodes) return;
    const at = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;
    bp.Q.value = 0.6;
    const roar = c.createGain();
    roar.gain.setValueAtTime(0.0001, at);
    roar.gain.exponentialRampToValueAtTime(0.05, at + 0.6);
    src.connect(bp);
    bp.connect(roar);
    roar.connect(master!);
    src.start(at);

    // Paws: low noise, chopped by a fast LFO into a gallop.
    const pawSrc = c.createBufferSource();
    pawSrc.buffer = noiseBuffer(c);
    pawSrc.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const chop = c.createGain();
    chop.gain.value = 0.5;
    const pawLfo = c.createOscillator();
    pawLfo.type = 'square';
    pawLfo.frequency.value = 7;
    const depth = c.createGain();
    depth.gain.value = 0.5;
    pawLfo.connect(depth);
    depth.connect(chop.gain);
    const paws = c.createGain();
    paws.gain.setValueAtTime(0.0001, at);
    paws.gain.exponentialRampToValueAtTime(0.14, at + 0.4);
    pawSrc.connect(lp);
    lp.connect(chop);
    chop.connect(paws);
    paws.connect(master!);
    pawSrc.start(at, 0.7);
    pawLfo.start(at);

    nodes = { src, roar, paws, pawLfo, pawSrc };
  },

  /** 0..1, how loud the stands are; `speed` is the replay's 1× or 2×. */
  level(intensity: number, speed: number): void {
    if (!nodes || !ctx) return;
    const at = ctx.currentTime;
    const k = Math.max(0, Math.min(1, intensity));
    nodes.roar.gain.setTargetAtTime(0.03 + 0.17 * k * k, at, 0.25);
    nodes.pawLfo.frequency.setTargetAtTime(6.5 * speed, at, 0.2);
  },

  /** The field has crossed: the paws stop and the stands let go. */
  finish(): void {
    if (!nodes || !ctx) return;
    const at = ctx.currentTime;
    nodes.paws.gain.setTargetAtTime(0.0001, at, 0.25);
    nodes.roar.gain.cancelScheduledValues(at);
    nodes.roar.gain.setTargetAtTime(0.3, at, 0.05);
    nodes.roar.gain.setTargetAtTime(0.025, at + 0.6, 0.9);
  },

  /** A bump or a slow break: the stands go "ooh". */
  ooh(): void {
    const c = live();
    if (!c) return;
    burst(c, c.currentTime, 0.12, 0.7, 'bandpass', 380, 5, 620);
  },

  /** A lead change or a closer coming: a cheer on top of the roar. */
  cheer(): void {
    const c = live();
    if (!c) return;
    burst(c, c.currentTime, 0.18, 0.9, 'bandpass', 900, 0.8, 1300);
  },

  /** A photo: everyone breathes in. */
  gasp(): void {
    const c = live();
    if (!c || !nodes) return;
    const at = c.currentTime;
    nodes.roar.gain.cancelScheduledValues(at);
    nodes.roar.gain.setTargetAtTime(0.012, at, 0.08);
    nodes.paws.gain.setTargetAtTime(0.0001, at, 0.08);
  },

  /** Gone: faded unless `now`, then torn down. Safe to call twice. */
  stop(now = false): void {
    const n = nodes;
    nodes = null;
    if (!n || !ctx) return;
    const at = ctx.currentTime;
    const tail = now ? 0.05 : 0.5;
    n.roar.gain.cancelScheduledValues(at);
    n.roar.gain.setTargetAtTime(0.0001, at, tail / 3);
    n.paws.gain.setTargetAtTime(0.0001, at, tail / 3);
    const end = at + tail + 0.3;
    try {
      n.src.stop(end);
      n.pawSrc.stop(end);
      n.pawLfo.stop(end);
    } catch {
      // Already stopped.
    }
  },
};
