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

---

## After M4 — one season against the balance pass, 9 September 2026 (Jesse)

Written up 11 September, in the v2 design session. **These findings were given in chat on 9
September and never made it into this file**, which BUILD_PLAN §8.3 asks for and which both M4
session notes flagged as outstanding. They are recorded here verbatim in substance so the trail is
complete; they are also what the v2 rethink was built from.

Setup: 1 human against **3 Hard and 3 Normal**, all toggles default, with the M2 race view on.
Jesse **won comfortably**, by selling the stable down, taking a bank loan, buying one very good
dog, dominating Gold with it, then putting the winnings into a very large hold and making more
money trading kibble.

### R1. One-dog concentration beats a balanced stable, and beats Hard

This is M1 finding 3 and GDD §20 Q2 again, but sharper: it is not only that Gold snowballs, it is
that **liquidating into a single asset is the dominant line**, and that a human playing it beats a
difficulty measured at 35% richer than Normal.

The harness could not simulate it — it has no concentrating agent — but the supporting numbers are
that Hard buys 3.4 dogs a season and Normal 2.0, so neither AI concentrates, and the champion won
a Major Gold in 83.3% of 800 mixed seasons.

Any fix has to not simply re-flatten the purse ladder M4 session 1 had just tuned.

### R2. Fitness never bites

Jesse pointed straight at the item already queued in `claude/M4_NOTES.md`. −12 fitness a race
against +15 a week means a dog racing every weekend *gains* 3 a week; mean fitness at declaration
is 96 and **0%** of declarations land under the 60 threshold. *"Still felt like the best decision
was to enter as many races as I could… I think adjustments to fitness will help."* That is not a
misread — it is correct play against these numbers.

Session 1 measured a candidate fix at −18 a race / +10 a week: autopilot-right falls 59% → 47%
without touching a purse, but it costs about 35% of the economy and starts producing
bankruptcies.

> **Postscript, 11 September: the diagnosis was right and the direction of the fix was backwards.**
> Fitness is not a weak lever, it is a violent one — at equal ratings a dog at 90 wins 13.0%, at 80
> 7.0%, at 70 3.0%, at 60 1.3%. Its whole usable range is 85–100, which is *why* nothing ever
> reached the threshold. See GDD §5.2 and decision D13.

### R3. The kibble trade is a net cost to every AI and a profit to a human

New information, and the most surprising thing in the playtest. Across 800 mixed seasons, mean
trade income is **Easy −3,990, Normal −3,584, Hard −3,334** — every difficulty *loses* three to
four thousand a season on kibble, because they buy it to eat and never work the spread. Jesse made
money at it with a big hold.

Session 1 separately measured Hard *losing seven points of head-to-head* when it bought ship
upgrades, and concluded GDD §8's "every purchase pays back within ~5 weeks" is not true of the
ship. Both can be true at once: the hold only pays if you can time two markets, which no AI does.

> **Postscript, 11 September: it was worse than that.** Carrying kibble to the next planet loses
> **9.5 Bones a unit on an average leg**, measured over 72,000 legs — the trade was a losing game
> and every stable was forced to play it. Knowing only *next week's planet* turns the same trade
> into **+23.6 a unit on the 40% of legs worth acting on**, which is why the v2 answer is to hide
> the circuit and sell the map rather than to re-price the kibble. See GDD §9 and decision D5.

### Confirmation, no action

**The assignment decision improved, exactly as session 1's purse change predicted** —
autopilot-right 59% → 19%, and in play, *"was improved over last games with the purse changes —
was running my 2nd best dog in bronze when I could"*. This is the one thing in the playtest that
says a change worked.

### What Jesse said about what to do next

*"Will need to rethink a lot of mechanics, but can do that later once everything is built."* That
conversation happened on 11 September and became GDD 0.2 and BUILD_PLAN §6b.
