# V3 Phase T prompt: the weekend at once, and three staff (22 October 2026)

There was no phase prompt written ahead of this session. Jesse's whole request, in Cowork with the
repo folder connected:

> I'm thinking the turn based part of the game is slowing it down too much, as this is mostly aiming to
> be a multiplayer game. Therefore I would like you to change it so each person plays their turn
> simultaneously. Make the necessary changes. So no more shared market.
>
> I also think we should have a staff member for each of the 3 aspects of the game. Dog trainer, Trade
> Advisor, and Gambling Advisor. Each player has one of each.
>
> Go ahead and make the changes

## The four questions asked first, and Jesse's answers

His standing instruction is to be asked before a rule the GDD does not cover is invented, so the
session asked the four the request left open before building. He took the recommended answer each time:

| Question | Answer |
|---|---|
| With everyone at once, how should declarations work? | **Hidden, revealed at lock** (over a live public board in any order) |
| The drafts pick from one shared board — leave them in turn order? | **Keep the drafts in order** |
| How should the three staff be paid? | **Each takes a cut of their own side** (Trainer: purses; Trade Advisor: trading profit; Gambling Advisor: winnings) |
| How do stables get their three staff at the start? | **Draft one of each role** (over dealing them) |

## The reading the session took

- **A rule change, deliberately**: goldens, `STATE_VERSION`, `SAVE_VERSION` and `PROTOCOL_VERSION` all
  move, and pushing ends live rooms (CLAUDE.md).
- **The advisors' bonuses are Claude's call inside Jesse's** (GDD_V3 T3), built from the two trainer
  bonuses that already belonged to those sides (next week's prices, a race-day tip) plus a few new ones,
  and priced by measurement rather than by guess.
- Built as before: in a clone in the container, then fast-forwarded into Jesse's folder; he pushes.
