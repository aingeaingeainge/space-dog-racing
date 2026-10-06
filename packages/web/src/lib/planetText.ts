import { balance, formatBones, type Planet, type Track } from '@sdr/engine';

export function trackText(t: Track): string {
  const bends = t.bends === 'none' ? 'straight' : `${t.bends} bends`;
  const extra = [
    t.hazard !== 1 ? `hazard ×${t.hazard}` : null,
    t.slippery ? 'slippery' : null,
    t.mud ? 'mud' : null,
  ]
    .filter(Boolean)
    .join(', ');
  return `${t.distance} m ${t.length}, ${bends}${extra ? `, ${extra}` : ''}`;
}

/**
 * Phase P: the track in one short sentence, for the Race Office's only line — what about it should
 * change a declaration, and nothing when it is a plain one.
 */
export function trackLine(t: Track): string {
  const bits: string[] = [];
  if (t.length === 'sprint') bits.push('a sprint: front-runners love it');
  else if (t.length === 'staying') bits.push('a long trip: closers love it');
  if (t.bends === 'tight') bits.push('tight bends: the draw matters');
  else if (t.bends === 'none') bits.push('dead straight');
  if (t.mud) bits.push('mud: Mudlarks love it');
  if (t.slippery) bits.push('slippery');
  if (t.hazard !== 1) bits.push('a dangerous surface');
  if (!bits.length) return `${t.distance} m, nothing unusual.`;
  const line = `${t.distance} m, ${bits.join('; ')}.`;
  return line;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Plain-English list of a planet's always-on rules (GDD §12). The engine applies these; this
 * is only how the player finds out about them. Add a rule to PlanetSpecial, add a line here.
 *
 * ⚠️ **Eighteen of these lines went with the systems behind them (BUILD_PLAN_V3 §2.1)** — the banks,
 * the sharks, the staff halls, the ship discounts, the dog-market biases, the muzzles, the cold
 * store and the stewards' swabs. GDD_V3 §12 is explicit about what that costs: the planets used to be
 * told apart by what you could buy there, and what is left is the track, the food band and (from
 * Phase D) **which three Explore doors a planet offers**, which is where §9.1 says planet character
 * lives in v3. Until then eighteen planets are thinner than they were, and that is expected rather
 * than a bug — but it is the thing to feel for in a playtest.
 */
export function specialText(p: Planet): string[] {
  const s = p.special;
  const out: string[] = [];
  if (s.noBetting) out.push('No betting');
  if (s.bettingMargin !== undefined) out.push(`Bookie margin ${pct(s.bettingMargin)}`);
  if (s.maxStakeFraction !== undefined) out.push(`Max stake ${pct(s.maxStakeFraction)} of cash`);
  if (s.maxStakeMultiplier)
    out.push(
      `Stake ceiling ×${s.maxStakeMultiplier}: ${formatBones(balance.maxStake * s.maxStakeMultiplier)} a race`,
    );
  if (s.purseMult) out.push(`Purses ×${s.purseMult}`);
  if (s.winningsTax) out.push(`${pct(s.winningsTax)} tax on winnings`);
  if (s.fitnessOnArrival)
    out.push(`Fitness ${s.fitnessOnArrival > 0 ? '+' : ''}${s.fitnessOnArrival} on arrival`);
  if (s.turnOrderReversed) out.push('Turn order reversed');
  if (s.piratesLikely) out.push('Pirates about');
  return out;
}
