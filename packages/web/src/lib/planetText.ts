import type { Planet, Track } from '@sdr/engine';

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

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Plain-English list of a planet's always-on rules (GDD §12). The engine applies these; this
 * is only how the player finds out about them. Add a rule to PlanetSpecial, add a line here.
 */
export function specialText(p: Planet): string[] {
  const s = p.special;
  const out: string[] = [];
  if (s.bank) out.push('Bank open');
  if (s.shark) out.push('Fat Tony lends here');
  if (s.vet) out.push('Vet for hire');
  if (s.trainer) out.push('Trainer for hire');
  if (s.noBetting) out.push('No betting');
  if (s.bettingMargin !== undefined) out.push(`Bookie margin ${pct(s.bettingMargin)}`);
  if (s.maxStakeFraction !== undefined) out.push(`Max stake ${pct(s.maxStakeFraction)} of cash`);
  if (s.dopingCatch !== undefined)
    out.push(s.dopingCatch === 0 ? 'Supplements legal' : `Stewards catch ${pct(s.dopingCatch)}`);
  if (s.purseMult) out.push(`Purses ×${s.purseMult}`);
  if (s.winningsTax) out.push(`${pct(s.winningsTax)} tax on winnings`);
  if (s.buyerBonus) out.push(`Buyers pay +${pct(s.buyerBonus)}`);
  if (s.dogValueMod) out.push(`Dog prices ×${s.dogValueMod}`);
  if (s.everythingMarkup) out.push(`Everything +${pct(s.everythingMarkup)}`);
  if (s.shipDiscount) out.push(`Ship upgrades −${pct(s.shipDiscount)}`);
  if (s.engineDiscount) out.push(`Engines −${pct(s.engineDiscount)}`);
  if (s.kennelDiscount) out.push(`Kennel modules −${pct(s.kennelDiscount)}`);
  if (s.fitnessOnArrival)
    out.push(`Fitness ${s.fitnessOnArrival > 0 ? '+' : ''}${s.fitnessOnArrival} on arrival`);
  if (s.noUpkeep) out.push('No upkeep this week');
  if (s.turnOrderReversed) out.push('Turn order reversed');
  if (s.foodSpoils) out.push(`Cargo spoils ${pct(s.foodSpoils)} without a cold store`);
  if (s.localsNervy) out.push('Local dogs are Nervy');
  if (s.marketAgeBias === 'old') out.push('Cheap old dogs');
  if (s.marketAgeBias === 'pups') out.push('Pups for sale');
  if (s.marketQualityBonus) out.push('Gold-class dogs for sale');
  if (s.fellOffAShip) out.push('Stolen dogs at 60% of value');
  if (s.muzzles) out.push('Racing muzzles in stock');
  if (s.piratesLikely) out.push('Pirates about');
  return out;
}
