import { useEffect, useRef } from 'react';
import { spriteAt } from '../race-view/sprites';
import { STABLE_COLOURS } from './ui';

/**
 * Phase S: the Title's opening shot — six runners and the hare down the back straight, the camera
 * running with them, under the nameplate. Purely decoration: it reads no game state and rolls no
 * game numbers. The dogs are the race view's own run cycles (race-view/sprites.ts), tinted in the
 * first six stable colours, and their stride is taken from distance run exactly as on race day.
 *
 * Who leads drifts on slow sine waves, so the order changes every few seconds without anything
 * random in it. With reduced motion asked for, it is one still frame of the same picture.
 */
const RUNNERS = 6;
/** Pixels a metre: a dog is drawn 2.8 m × 1.2 m, as on race day. */
const PX = 30;
/** Metres a second the pack runs at; the rails scroll past at this speed. */
const PACE = 17;
/** Seconds into the loop the still frame is taken from. */
const STILL_AT = 7.3;

export function TitleParade() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    const size = () => {
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      w = canvas.clientWidth || 800;
      h = canvas.clientHeight || 130;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const draw = (t: number): boolean => {
      ctx.clearRect(0, 0, w, h);
      const run = t * PACE; // metres the camera has travelled
      const top = 14;
      const bottom = h - 10;

      // The racing surface: soot, lit from above.
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, '#3a2c22');
      g.addColorStop(0.5, '#4a3828');
      g.addColorStop(1, '#2b2019');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, w, bottom - top);
      // Grit: short streaks that scroll with the ground.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let i = 0; i < 70; i++) {
        const gx = ((((i * 97.3 - run * PX) % (w + 40)) + w + 40) % (w + 40)) - 20;
        const gy = top + 8 + ((i * 37) % (bottom - top - 14));
        ctx.fillRect(gx, gy, 10 + (i % 4) * 4, 2);
      }
      // The rails: hazard-banded, scrolling.
      for (const y of [top, bottom]) {
        ctx.fillStyle = '#0c0b11';
        ctx.fillRect(0, y - 4, w, 8);
        const band = 26;
        const off = (((run * PX) % (band * 2)) + band * 2) % (band * 2);
        for (let x = -off; x < w; x += band * 2) {
          ctx.fillStyle = '#f4c542';
          ctx.fillRect(x, y - 2, band, 4);
          ctx.fillStyle = '#efe7d4';
          ctx.fillRect(x + band, y - 2, band, 4);
        }
      }

      // The pack: each runner sits a little ahead or behind the camera on a slow wave.
      // Clear of both rails: a sprite is 36 px tall and drawn about its middle.
      const lane = (bottom - top - 44) / (RUNNERS - 1);
      const lead = w * 0.62;
      // A phone has less straight to show; the pack closes up rather than running off the left edge.
      const spread = Math.min(1.6, w / 520);
      const dogs: { x: number; y: number; i: number; d: number }[] = [];
      for (let i = 0; i < RUNNERS; i++) {
        const sway = Math.sin(t * (0.31 + i * 0.07) + i * 1.9) * 2.6 + Math.sin(t * 0.13 + i) * 1.4;
        const back = 1.6 + i * 1.15 + sway; // metres behind the hare's reach
        const d = run - back;
        dogs.push({ x: lead - back * PX * spread, y: top + 21 + i * lane, i, d });
      }
      // The hare, just out of reach.
      const hx = lead + 2.4 * PX;
      const hy = top + 21 + lane * 0.6;
      ctx.fillStyle = 'rgba(244, 197, 66, 0.25)';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 34, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4c542';
      ctx.strokeStyle = '#0c0b11';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      let ready = true;
      for (const dog of dogs) {
        const colour = STABLE_COLOURS[dog.i % STABLE_COLOURS.length]!;
        const sprite = spriteAt(dog.i, colour, dog.d);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(dog.x - 4, dog.y + 12, 40, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (sprite) ctx.drawImage(sprite, dog.x - 1.4 * PX, dog.y - 0.6 * PX, 2.8 * PX, 1.2 * PX);
        else {
          ready = false;
          ctx.fillStyle = colour;
          ctx.beginPath();
          ctx.ellipse(dog.x, dog.y, 1.3 * PX, 0.45 * PX, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return ready;
    };

    let raf = 0;
    let timer = 0;
    if (still) {
      // One frame — redrawn until the run cycles have arrived, then left alone.
      const settle = (tries: number) => {
        if (!draw(STILL_AT) && tries > 0) timer = window.setTimeout(() => settle(tries - 1), 150);
      };
      settle(30);
    } else {
      const t0 = performance.now();
      const loop = (now: number) => {
        draw((now - t0) / 1000 + STILL_AT);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const onResize = () => {
      size();
      if (still) draw(STILL_AT);
    };
    globalThis.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      globalThis.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="title-parade" aria-hidden="true" />;
}
