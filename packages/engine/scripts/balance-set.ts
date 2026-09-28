/**
 * `--set key=value` — override a numeric `balance` key for one harness run (v3 Phase H item 1).
 *
 *   npm run harness -- --seasons 400 --set valueCurve=1.5 --set staffCutMax=0.15
 *   npm run harness -- --game --games 100 --set startCash=5000
 *
 * A **sweep knob, not a rule.** It writes the value into the in-memory `balance` object for this
 * process only; the sheet and `balance.json` are untouched, and nothing it does can reach a game a
 * player plays. Phase G swept its stake ceiling with a scratch script that did the same thing; this is
 * that script, committed, so the next balance phase does not need scratch code to ask "what if".
 *
 * ⚠️ **It must be the first import of `harness.ts`, and that is why it applies itself on import.**
 * Some content reads `balance` once, when its module loads — every trainer's `cut` in
 * `content/staff.ts` is `balance.staffCut…` evaluated at import — so an override written after the
 * engine has loaded would be silently ignored by exactly those rows. ES modules evaluate their
 * imports in order, depth first, so a module imported first runs before any engine module that reads
 * `balance` at load. `parseArgs` in `harness.ts` then only has to step over `--set` and its value.
 *
 * ⚠️ **It refuses what it cannot apply**: a key that is not in `balance`, a key that is not a number
 * (`currencyName`), and a value that is not a finite number. A typo that silently swept nothing would
 * be the v2 habit `parseArgs` already refuses unknown flags to stop.
 */
import { balance } from '../src/content/balance';

export interface BalanceOverride {
  key: string;
  from: number;
  to: number;
}

/** Parse every `--set key=value` in `argv` and write it into `balance`. Throws on a bad one. */
export function applyBalanceOverrides(argv: readonly string[]): BalanceOverride[] {
  const table = balance as unknown as Record<string, unknown>;
  const applied: BalanceOverride[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--set') continue;
    const spec = argv[i + 1] ?? '';
    const eq = spec.indexOf('=');
    if (eq <= 0) throw new Error(`--set wants key=value, got "${spec}".`);
    const key = spec.slice(0, eq).trim();
    const raw = spec.slice(eq + 1).trim();
    if (!Object.prototype.hasOwnProperty.call(table, key))
      throw new Error(`--set ${key}: no such balance key. Keys are the names in balance.json.`);
    const from = table[key];
    if (typeof from !== 'number') throw new Error(`--set ${key}: not a numeric balance key.`);
    const to = Number(raw);
    if (raw === '' || !Number.isFinite(to))
      throw new Error(`--set ${key}=${raw}: the value is not a number.`);
    table[key] = to;
    // Set twice: the last value wins, and the header still names the sheet's value it replaced.
    const earlier = applied.findIndex((o) => o.key === key);
    const original = earlier >= 0 ? applied[earlier]!.from : from;
    if (earlier >= 0) applied.splice(earlier, 1);
    applied.push({ key, from: original, to });
  }
  return applied;
}

/** The overrides this process is running with, applied once, at import (see the ⚠️ above). */
export const BALANCE_OVERRIDES: readonly BalanceOverride[] = applyBalanceOverrides(
  process.argv.slice(2),
);

/** One header line naming every override, or an empty string when there are none. */
export function overridesLine(): string {
  if (!BALANCE_OVERRIDES.length) return '';
  return `⚠️ balance overridden for this run (--set): ${BALANCE_OVERRIDES.map((o) => `${o.key} ${o.from} → ${o.to}`).join(', ')}`;
}
