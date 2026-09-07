# Playtest notes

Findings from playing the game, written up for the next planning conversation. BUILD_PLAN §8.3:
rule changes go into the GDD decision log *before* the next build session. The filled-in forms
these come from are in `PLAYTEST_CHECKLIST.md`.

## After M1 — two seasons, 7 September 2026 (Jesse)

Both seasons: 1 human + 5 Normal AI, all toggles default, no race animation (that is M2).
Season 1 finished mid-table in 30–45 minutes. Season 2, played through the economy, **won** —
and took over an hour. Nothing broke in either season and every venue was used in both.

### 1. The weekly assignment decision is too easy — *the one to fix*

Asked in both seasons. Season 1: hard only at the Majors, where the purse multiplier made racing
a dog up a class worth the risk. Season 2, with the screens understood: "still obvious — the best
dog to each race picks itself".

This is GDD design pillar 1 ("one good decision per weekend") not landing, and it is the exact
failure BUILD_PLAN §11 warns about. Options to weigh before M4:

- Raise the local dogs' ratings towards the GDD §6.1 figures (35 / 57 / 78) from the M0 compromise
  (28 / 42 / 52). M0 note 1 already flags this as a revisit — the locals were weakened because no
  starting stable could touch the Gold purse, but that also made "race up" a free option.
- Flatten the Bronze → Silver → Gold purse ladder so racing up is a gamble rather than an obvious
  yes at Majors and an obvious no elsewhere.
- Tighten the rating caps, or make the cap bite on fitness as well as rating.

The harness can measure this directly: average Gold field rating by week is already reported, and
it climbs 47 → 58 across a season, which says the stables are all racing up as expected.

### 2. The shady options do not tempt

Supplements were used in season 1 and never caught; they never felt like a decision. The Fixer's
sabotage and steward bribes have not been used at all. GDD pillar 5 wants these "tempting *and*
punishable, never dominant, never useless" — right now they are neither tempting nor punishing.
Jesse's one-line answer to "what would you change first" was: make the shady options tempting.

Levers: the +8 speed for one race, the 400 Bones price, the 15% base catch rate, and what being
caught actually costs.

### 3. Gold purses snowball — GDD §20 Q2 comes due

Player observation ("Gold purses too big — one good Gold dog snowballs the season") and the harness
agree: the champion wins at least one Major Gold in 96% of 50 seasons, and end-worth p90 is about
twice the mean. The GDD's own alternative (Majors ×2.0, Grand Final ×3.5 instead of ×2.5 / ×4) is
the obvious thing to run through the harness in M4, along with the variance of final rank by Major
results.

Season 2 was decided by the Grand Final; season 1 was not, so this is a tendency, not a certainty.

### 4. Pace: an hour once every venue is in use

Season 2 ran over the GDD §3 target of 45–60 minutes, and the time went on working the shops —
six venues × two planet phases × 13 weeks. Nothing is wrong with any single screen; there are
simply a lot of clicks. Watch this in M3 (hub hotspots should shorten the path) and M4 (keyboard
shortcuts, and possibly a "nothing to do here" hint on a venue with no useful stock this week).
Adding the race animation in M2 will push the number up again, so the 2× speed and skip controls
matter.

### 5. Economy work is what separates a winner from mid-table

Same setup, same builder, two seasons: playing the market and the kibble trade turned mid-table
into first place. That is the right shape — the shops are worth the clicks — and it is also why
the assignment decision needs to get harder, because right now the season is won at the Docks and
the Market rather than at the Race Office.

### Not yet measured

Seeds, cash by week, and the prize / trade / betting income split were not recorded. Worth
capturing on the next two seasons so the playthroughs can be compared with the harness directly.
