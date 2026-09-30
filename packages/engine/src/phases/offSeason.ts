import { balance } from '../content/balance';
import { staffRow } from '../content/staff';
import { mulberry32 } from '../rng';
import { dog, log, type Ctx } from '../state';
import type { Id, OffSeasonNotice } from '../types';
import { openOffSeasonDraft } from './draft';

/**
 * The off-season (GDD_V3 §2.2, as V32 rewrote it in v3 Phase N):
 *
 * 1. **Every dog ages a year** — shown, not asked. This is where the age tick lives (§4.3), so a
 *    one-season game has no ageing at all.
 * 2. **The staff notice.** Each trainer has a `staffNoticeChance` of leaving for a better stable.
 *    Public: the table reads it before the draft, so a stable left short is seen to be short.
 * 3. **One round of the draft** (V32), in reverse order of the season's standings, from a fresh board
 *    (`openOffSeasonDraft`): a dog (retiring one), a trainer (letting one go if the staff is full) or
 *    a pass.
 *
 * ⚠️ **Replaced at Phase N:** the retirement window's offer (E4), the candidate offered to a stable
 * left short (E5) and V23's breeder's pick for the last stable. The draft does all three jobs from one
 * public board, and last place picks first rather than being offered a better dog.
 *
 * **The streams (decision D1's pattern), kept for the notice.** When the off-season opens, the game's
 * stream draws one seed per stable, in seating order, and each stable's notices are rolled on its own
 * stream — so a trainer's notice never depends on another stable's. The board and the order are then
 * drawn from the game's stream, after the seeds.
 */
export function openOffSeason(ctx: Ctx): void {
  const { s, rng } = ctx;
  // 1. Every dog ages a year (§4.3). Locals were swept at the jump; every dog left is a stable's.
  for (const p of s.players)
    for (const id of p.dogIds) {
      const d = dog(s, id);
      d.age = Math.min(7, d.age + 1);
    }
  log(s, `The off-season: every dog on the circuit is a year older.`);

  // One seed per stable, seating order, from the game's stream.
  const streams = new Map(
    s.players.map((p) => [p.id, mulberry32(Math.floor(rng.next() * 4294967296))]),
  );
  const notices: Record<Id, OffSeasonNotice> = {};
  const leavers: Id[] = [];
  // 2. The staff notice: one draw for each trainer, on the stable's own stream.
  for (const p of s.players) {
    const r = streams.get(p.id)!;
    const left = p.staff.filter(() => r.chance(balance.staffNoticeChance));
    p.staff = p.staff.filter((id) => !left.includes(id));
    for (const id of left) log(s, `${staffRow(id).name} has left ${p.name} for a better stable.`);
    leavers.push(...left);
    notices[p.id] = { left };
  }
  s.offSeason = { notices };
  // 3. The draft: one round, last on the standings first (V32).
  openOffSeasonDraft(ctx, leavers);
}
