/**
 * Hard's ablation switches (BUILD_PLAN §7a), in a module of their own since Phase D2 so a card's
 * `hardChoice` (content/deck) can read them without importing the AI and making a cycle.
 */
/**
 * Harness-only ablation switches for the two Phase D changes tried on Hard (BUILD_PLAN §7a).
 *
 * ⚠️ **Both are off, and both are off because they were measured rather than because nobody got to
 * them.** §14 has asked for the first since M4 and the Phase D brief names the second; the numbers
 * are in `claude/V2_PHASE_D_NOTES.md` and repeated here so the next session does not re-try them:
 *
 *   Hard's betting, 300 seasons          beats Normal   mean     p10     bet income
 *   flat fraction of cash (kept)            58.3%      41,109   9,390        +867
 *   quarter-Kelly on the measured edge       56.7%      37,915  11,061        −178
 *
 *   Hard's third slot, 200 seasons        beats Normal   mean     p10    fixes
 *   trainer + vet (kept)                     58.8%      41,663   8,919    0.0
 *   trainer + vet + fixer, working him       49.3%      33,973   7,460    0.8
 *
 * The second of those is D30's question re-asked with §13 in the game — is a Fixer the first third
 * hire a racing stable can profitably make? — and the answer is a flat no, by **9.5 points**. It is
 * the same arithmetic that stopped the crook's own road paying, seen from the other side: a fixer's
 * value is per job and his wage is per week, and a stable that already earns well from purses has
 * the most to lose by spending a slot on a man it uses twice.
 *
 * The Kelly result is the more interesting of the two and the reason is worth keeping: Kelly
 * stakes *more* as the price shortens, so it moves money off the long shots — which is where
 * `effectiveRating` finds its edge, because a fed dog that has not had the results yet is exactly
 * a dog the book has long — and onto short ones, where Hard's own estimate is least likely to beat
 * the book's. Sizing a bet by an edge you have measured is right; sizing it by an edge you have
 * *estimated* is only right where the estimate is good, and Hard's is good in one corner of the
 * board.
 */
export const HARD_KNOBS = {
  /** Stake in proportion to the measured edge rather than a flat fraction of cash. */
  sizeBetsByEdge: false,
  /**
   * ⚠️ **Phase E's four, and the answer they gave: none of them is a bad decision.**
   *
   * The record said the only thing that has ever moved Hard is removing a bad decision, so these
   * switch off decisions Hard makes and Normal does not, one at a time, at the standing table
   * (easy, normal ×3, hard ×2), 800 seasons, same seeds:
   *
   *   as built (one ruler each)        58.0%   mean 40,997   p10  9,783
   *     rates its dogs like Normal     57.8%        40,509        9,511
   *     one ruler: stats on both sides 57.8%        40,920        9,649
   *     does not hold for a Major      55.9%        40,362        9,873
   *     never throws the cheap race    57.9%        41,493        9,572
   *     does not sell before the tick  56.1%        40,271        9,261
   *     works §13 per job              53.6%        37,670       10,461
   *
   * Two of them are load-bearing — holding the best dog out the week before a Major is worth 2.1
   * points and selling before the age tick 1.9 — and the rest are inside the standard error. So
   * the phase's contribution to the most-missed number in the project is a **negative result**:
   * there is no bad decision left in Hard to take away, and whatever is keeping it off 63–68% is
   * not on this list (E-D49).
   */
  /** Rate our own dogs by their stats rather than their public rating when filling the card. */
  ratesByStats: true,
  /**
   * Rate the *rivals'* declared dogs by the same ruler.
   *
   * Off, Hard compares a generous estimate of itself against a plain one of the field — which is
   * what it did from M4 to Phase D, because `expectedField` never took a ruler. Every race it
   * priced therefore over-estimated its own chance, which is arithmetic with two rulers rather
   * than an edge over the bookie.
   *
   * ⚠️ **On, it is worth nothing measurable, and it is kept anyway.** Three Hard against three
   * Normal it reads +2.5 points; at the standing table it reads −0.2, which is noise, with the
   * mean and p10 also inside the error. Those two tables disagreeing is itself the finding
   * (E-D49): a head-to-head is a property of the table it is played at, and an ablation run at a
   * different one answers a different question from BUILD_PLAN's acceptance row. The repair stays
   * because comparing two different rulers is a defect whether or not fixing it moves a
   * head-to-head — but nobody should record it as a gain.
   */
  sameRuler: true,
  /** Sit the best dog out the week before a Major rather than arrive at it tired. */
  holdsForMajor: true,
  /** Now and then leave the cheap race to the locals and put the money over the counter. */
  throwsCheapRace: true,
  /**
   * ⚠️ **Phase D2's five — Hard's first new behaviour since Phase A.** Each switches one piece off,
   * for `--hardD2`'s ablation; the numbers are in `claude/V3_PHASE_D2_NOTES.md`.
   *
   * Reads the declarations board (GDD_V3 §7.3) when it fills the card: the hot pace (C12–C13) makes a
   * lone front-runner and a closer in a crowd worth a little more than their ratings, and Hard counts
   * the front-runners already declared — and the ones the locals will probably bring.
   */
  readsFieldEntries: true,
  /** Prices every runner on the field's shape at the bookie, which the book never does (§5.6). */
  readsFieldBets: true,
  /** Prices a trainer on what it actually earns and trades, and hires on a thinner margin. */
  hiresBetter: true,
  /** Nobbles the leader's dog when it is not leading, rather than the best-rated dog on offer. */
  nobblesBetter: true,
  /** Buys a box on medium bends as well as tight ones. */
  buysBoxesWider: true,
};
