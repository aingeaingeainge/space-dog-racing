# Space Dog Racing — Game Design Document

**Working title:** Space Dog Racing (alternatives to consider: *Kennels of the Void*, *Mutt Circuit*, *Greyhounds & Gravity*, *Bad Dogs, Good Odds*)
**Version:** 0.1 — 7 September 2026
**Author:** Jesse Colbert, with Claude (Fable 5.1) as design partner
**Status:** Design locked enough to start building. Anything marked ⚖️ is a tunable lever that lives in `space_dog_racing_economy.xlsx`; anything marked ❓ is an open decision.

---

## 1. Vision

A 45–60 minute, 13-week season of managing a stable of greyhounds on the grimy underground dog-racing circuit of a cartoon future. You hop planet to planet in a rattly transport ship, pick which of your dogs run in which of the weekend's three races, watch the races play out top-down, pocket the prize money, and spend it on better dogs, dodgy upgrades, a trainer with a past, and a hold full of dog food you're hoping to flog at the next planet. Whoever's stable is worth the most after the Grand Final wins.

**Tone:** Gazillionaire's pastel absurdity crossed with Death Rally's soot and neon. Gritty but cartoonish: dogs get injured, "supplements" exist, stewards can be bribed, loan sharks have names — but nothing dies on screen and the humour is always dark rather than cruel.

**References**
- *Gazillionaire* (1994): planet-hopping trading loop, quirky commodities, random events with choices, hotseat multiplayer, hand-drawn cartoon look, toggleable complexity.
- *Death Rally* (1996): career progression through tiers, garage/black market screens, loan shark, bribing a mechanic to sabotage the leader, top-down race view, criminal-underground humour.
- *Greyhound Manager 2*: the serious end of dog-sim — stats, grading, trap draws, fitness/rest cycles, and the lesson that gambling is how kennels really pay the bills.

## 2. Design pillars

1. **One good decision per weekend.** The dog-to-race assignment is the heart. Everything else (market, food, betting) feeds into making that decision richer, not replacing it.
2. **A season you finish.** Thirteen weekends, always. Fixed length is what stops this becoming Gazillionaire's "slow lottery ticket" that nobody completes.
3. **Readable luck.** Races are random, but every stat and every event visibly nudges the odds. Players should always be able to say *why* a dog won.
4. **Everyone can see the scoreboard.** Cash, net worth, every dog's rating — all public. Tension comes from the visible gap, not hidden information.
5. **Grimy choices with real teeth.** The shady options (doping, throwing a race, loan sharks) must be tempting *and* punishable. Never dominant, never useless.
6. **Multiplayer-ready from line one.** The rules engine is a pure, deterministic function of (state, action, seed). Online play is plumbing added later, not a rewrite.

## 3. Players and session

- 3–8 stables per season. Single player = 1 human + 2–7 AI at Easy / Normal / Hard. Online (later): any mix.
- Target session: 45–60 minutes. Budget per weekend ≈ 3.5 minutes: 90 s planet phase, 75 s watching three races (skippable, 2× speed), 30 s results/leaderboard. Majors may run longer.
- Save/resume at any weekend boundary (single JSON blob — the whole game state is serialisable by design).

## 4. Season structure

### 4.1 The calendar

13 race weekends. Weeks **4, 7, 10 and 13** are **Majors** (golf-style), with the week 13 Major doubling as the **Grand Final**.

- The **Grand Final is always week 13 at Collar Prime** (*The Galactic Collar*). The other three Major venues (Cosmodrome, Ossuary, Blackreach) are shuffled into weeks 4, 7 and 10.
- 9 regular weekends drawn without replacement from a pool of 14 regular planets, random order.
- The full calendar is visible from week 1 so players can plan (buy food where it's cheap for the expensive planet in three weeks; hold the sprinter back for the short track).

### 4.2 Weekend turn structure

Each weekend follows the same phases. In single player, phases 3 and 6 run sequentially in turn order (AI is instant); the engine is written so both can run simultaneously online with contested purchases resolved by turn order.

1. **Arrival & turn order.** Score = `shipSpeed × 10 − cargoUnits ÷ 5 + d10`. Highest goes first. Turn order is shown with the reason ("Jesse arrives 2nd — heavy cargo").
2. **Event phase.** Each player draws one random event (some planet-specific). Events with choices pause for the player.
3. **Planet phase (pre-race).** In turn order: visit the Market (dogs, gear), Kennels (training focus, supplements), Docks (ship upgrades, food trading), Saloon (staff for hire, loan shark, rumours), Bookie (place bets on today's races, once declarations are visible), Race Office (declare dogs).
4. **Declarations lock.** Every player assigns up to one dog to each of Bronze, Silver and Gold, subject to rating caps. Empty traps are filled with local dogs. Declarations are public; bookies then open.
5. **Race day.** Bronze, Silver, Gold are simulated and shown in order. Prize money paid, bets settled, ratings/form/fitness/injuries updated.
6. **Planet phase (post-race).** Same venues; typically sell a dog, buy food for the next leg, re-borrow.
7. **End turn → Jump.** Weekly costs charged (upkeep, wages, fuel, food eaten). Training applied. Fitness recovers. Age ticks at week 7 (mid-season) for flavour.

### 4.3 Season end and scoring

After week 13's post-race phase, **Net Worth** is computed for every stable:

```
netWorth = cash
         + Σ dogValue(rating, age, injuryStatus)
         + shipValue (purchase prices × 0.7)
         + cargoUnits × localFoodPrice
         − outstanding loans (principal + one week's interest)
```

Highest net worth wins. Tie-break: most Gold wins, then most Majors. A season summary shows a worth-over-time chart for all stables and "moments" (biggest upset, most expensive dog, best bet).

## 5. Dogs

### 5.1 Stats (all 1–99, visible)

| Stat | Race effect |
|---|---|
| **Speed** | Top speed on the straights. Biggest single factor. |
| **Acceleration** | How fast the dog reaches top speed; dominates short (sprint) tracks. |
| **Stamina** | How late in the race the dog starts to fade; dominates long (staying) tracks. |
| **Trap** | Reaction out of the boxes and early positioning; reduces bend interference. |

Rating (see 5.3) weights: `0.40 speed + 0.20 accel + 0.25 stamina + 0.15 trap`, then adjusted by results.

### 5.2 Condition

- **Fitness 0–100.** −12 per race run, +15 per week (+25 with a Vet). Below 60, all stats are scaled by `0.8 + 0.2 × fitness/100`. Racing a dog three weekends running is a real trade-off.
- **Form −10…+10.** Momentum from recent results, shown as arrows. Small speed bonus/penalty. Decays 2/week toward 0.
- **Age 1–7 (seasons).** Age 1–2: +1 to a random stat every 2 weeks (growth). Age 3–4: peak. Age 5+: −1 to a random stat every 2 weeks. Value multiplier by age: 1.15 / 1.10 / 1.00 / 0.85 / 0.65 / 0.45 / 0.30. Age ticks once per season (week 7).
- **Injury.** Base 4% per race, ×2 if fitness < 50, ×2 with the *Fragile* trait, ×1.5 on hazardous tracks. Duration 1–3 weeks (Vet halves, rounding down, min 1). Injured dogs cannot be declared; value ×0.7 while injured.

### 5.3 Rating and grades

Every dog has a public **Rating 0–99**, initialised from stats and updated Elo-style after each race:

```
expectedPlace = 1 + (n−1) / (1 + 10^((rating − fieldAvgRating) / 15))
ratingDelta   = (expectedPlace − actualPlace) × 1.6        ⚖️
form         += (expectedPlace − actualPlace), clamped ±10
```

Rating drives eligibility, market value and bookie odds.

**Class caps** ⚖️ — a dog may always race *up*, never *down*:

| Class | Eligible ratings | Standard purse (1st / 2nd / 3rd) |
|---|---|---|
| Bronze | ≤ 45 | 1,800 / 900 / 450 |
| Silver | ≤ 70 | 3,400 / 1,700 / 850 |
| Gold | any | 5,800 / 2,900 / 1,450 |

Majors multiply purses ×2.0; the Grand Final ×3.5. So the puzzle each week: a 44-rated dog is a Bronze favourite (≈30% of a 3,150 purse) or a Silver outsider (≈8% of 5,950). A 72 must run Gold. A stable whose dogs have all outgrown Bronze simply leaves that trap to the locals — and can bet on it.

### 5.4 Traits

Each dog has 1–2 quirks, shown as icons with tooltips. Examples (initial set of ~16):

*Railer* (+3% speed on tight-bend tracks) · *Wide runner* (always drawn outside; −bump risk) · *Slow starter* (−Trap, +Stamina late) · *Mudlark* (+5% on Mudhaven-type tracks) · *Fragile* (injury ×2) · *Iron* (injury ×0.5) · *Showboat* (+3% at Majors) · *Glutton* (eats 2 food) · *Nervy* (−5% when drawn trap 1 or 8) · *Sprinter* (+ on ≤400 m) · *Stayer* (+ on ≥550 m) · *Cheap date* (upkeep half) · *Prima donna* (form swings ×2) · *Bounces back* (fitness +5/week) · *Old soul* (ages a season later) · *Bad blood* (−2 form for every other dog in kennel with a lower rating — a diva).

### 5.5 Names and looks

Procedurally generated names from grimy/absurd word lists: *Bin Juice*, *Duchess of Rust*, *Comrade Fluff*, *Sir Reginald Vomit*, *Mild Peril*, *Three-Legged Lightning* (has four). Portraits: greyhound silhouettes with alien flourishes — extra eyes, antennae, chrome legs, translucent skin — colour-coded per stable with a saddle-cloth number.

### 5.6 Starting stable

3 dogs, ratings ≈ 38–48, mixed ages 2–4, 4 kennel slots (5th slot purchasable). 6,000 Bones cash. Basic ship (speed 2, 20 cargo units).

## 6. Races

### 6.1 Race parameters

Each planet has one track: **distance** (Sprint 350 m / Standard 480 m / Staying 600 m), **bend tightness** (affects interference and the Railer trait), **surface hazard** (injury multiplier), and a visual theme. 8 traps. Fields shorter than 8 are filled with local dogs whose ratings are drawn around the class midpoint (Bronze ~30, Silver ~46, Gold ~58; Majors +5). ⚖️ These are the M4 figures: strong enough that racing a dog up a class is a gamble, weak enough that a starting stable can still win a Gold. The first draft said 35 / 57 / 78, which was measured and rejected — see §19.

### 6.2 Simulation (deterministic, tick-based)

Runs entirely in the engine from a seed. Every tick (0.1 s) emits each dog's distance along the track, which the renderer replays. Reference implementation: `economy_sim.py` (`run_race`) — the real engine ports this with the tunables below.

```
break       = trap/100 × 3 m × U(0.6, 1.4)            // head start out of the boxes
topSpeed    = (13 + 6 × speed/100 + 0.05 × form + 0.40 × luck) × fitnessScale
              luck ~ N(0, 1.5) drawn once per dog per race
fadeStart   = 0.45 + 0.45 × stamina/100                 // fraction of distance
if progress > fadeStart:
   topSpeed *= 1 − 0.35 × (progress − fadeStart)/(1 − fadeStart)
accel       = 4 + 6 × accel/100  (m/s²)
v(t+1)      = min(topSpeed, v + accel × 0.1) + N(0, 0.35)
bends       : dogs within 0.6 m of each other on a bend have a 10% chance of a bump (−15% v for 0.5 s); Trap stat and Wide runner reduce it
```

Calibration target (from the Monte Carlo): vs seven rating-50 dogs, a rating-55 dog wins ≈24%, rating-65 ≈59%, rating-45 ≈6%. ⚖️ The engine should add slightly more race-day noise than the Python model so upsets stay frequent enough for betting to feel alive — aim for the 65 to win ~50%.

### 6.3 Race presentation

Top-down track with the pack tracked by a camera, dog sprites with saddle-cloth numbers, a lure ahead of the field, position ticker down the side, commentary bar with generated lines ("Bin Juice is off like a scalded cat!"). Photo-finish freeze when the gap is < 0.3 m. Skippable with results reveal; 1×/2×/skip.

## 7. Economy

Currency: **Bones** (₿ is taken; use a small bone glyph or just "B"). All defaults live in the spreadsheet; key ones repeated here.

### 7.1 Income
- **Prize money** — the main engine. Majors are ~52% of the season's prize money ⚖️ — still top-heavy, at ×2.0 / ×3.5 since the M4 pass (§19, §20 Q2). Note the multiplier is not what decides a season: lowering it alone moved neither when the leader was settled nor how often the Grand Final changed it.
- **Food trading** — buy low (40) sell high (140); typical realised margin ≈ 45/unit. With a 20-unit hold that's ~700–900/week — a 15–25% supplement, never the main game.
- **Betting** — zero-EV on paper (15% house margin), positive only with an edge.
- **Selling dogs** — at 80% of value. Buying a pup, training it and selling at a Major venue (where buyers pay +15%) is a legitimate side hustle.

### 7.2 Costs (weekly)
Kennel upkeep 150/dog · food 1 unit/dog (2 for *Glutton*) · fuel 250 base, +5 per cargo unit over 20 · Trainer 400 · Vet 300. An average 4-dog stable with a trainer spends ≈1,600/week ≈ 30% of its prize income — a bad fortnight hurts, a bad month is dangerous.

### 7.3 Dog valuation
`value = (400 + 2.2 × rating²) × ageFactor × injuryFactor`. Rating 45 ≈ 4.9k, 60 ≈ 8.3k, 80 ≈ 14.5k, 95 ≈ 20.3k at age 3. Market asking price = value × planetModifier × U(0.85, 1.15); selling gets 80% of value. The quadratic curve means elite dogs are prizes in themselves — the net-worth race is partly about who owns the two best dogs on the circuit at week 13.

### 7.4 Loans
- **Bank** (Port Slobber, Cosmodrome only): up to 5,000 at 3%/week, repaid any time.
- **Loan shark — "Fat Tony Nebula"** (Lagrange Lows, Hushmarket, Neon Snout, and randomly by event): up to 15,000 at 10%/week. Miss a payment (cash < interest at week end) and Tony repossesses your highest-value dog. Outstanding debt counts against net worth at season end, so a week-12 borrow to buy a Gold dog is a real gamble, not a free lunch.

## 8. Marketplace and upgrades

Every planet has a market whose stock is rolled on arrival and shared between all players (turn order = first look). Stock refreshes partially after the races.

**Dogs:** 2–4 for sale, quality skewed by planet (Rustgut sells cheap old dogs; Vatgrown sells pups with high growth; Major venues sell expensive Gold-class dogs). Each shows full stats, rating, age, traits, asking price.

**Staff (one of each, hired per week, quit-able):**
- Trainer — assign a training focus (one stat, one dog): +1 stat/week. Named trainers with a quirk (e.g. "Gristle McGraw: +2/week but 5% chance/week a dog gets *Nervy*").
- Vet — halves injury duration, +10 fitness recovery.
- Fixer (rare, Lagrange Lows) — unlocks sabotage and steward bribes. **Not built yet, and not hireable until it is** (§19, 8 Sept 2026): the actions in §13 do not exist, so hiring one was a wage bill for nothing.

**Ship (Docks):** Engine tier (speed 1→5, ~3k per tier), Cargo hold (+20 units, 2.5k), Kennel module (5th dog slot, 2k), Cold store (food never spoils — see events, 1.5k).

**Kennel items:** Track-day pass (+3 to one stat, 800) · Racing muzzle (+2 Trap, 600) · "Supplement" (+12 speed for one race ⚖️, 400; 15% chance the stewards catch it: purse forfeited, rating −5, 1-week ban; 0% on Vatgrown, 30% at Cosmodrome, 40% at Old Wembley).

**Upgrade payback rule** ⚖️: every purchase should pay back within ~5 weeks (see *Upgrades* sheet). Anything that doesn't gets a resale value or a price cut.

## 9. Food trading

Dog food is the single trade commodity (crates of *Space Kibble*). Each planet posts a buy price and a sell price (spread ~10%) drawn from its band; prices drift ±15% week to week and react to events (shortage ×2, glut ×0.5). Your dogs eat from your hold first; with no food aboard you pay the local price ×1.5 on arrival. Cargo slows your ship (turn order) and raises fuel. A **Cold store** upgrade prevents the "spoiled cargo" event. The whole 13-week price forecast is *not* shown — only the current planet and rumours from the Saloon ("Kibble's scarce on Rustgut this month").

## 10. Betting

Bookies open after declarations lock. Bets: **Win** and **Place** (top 3), any race, any dog, including your own. Odds = `(1 − margin) / p`, where p is the bookie's estimate from ratings (a logistic model calibrated against the race sim). Margin 15% (10% on Neon Snout; no betting on Holy Bark). Max stake per race 50% of cash.

The grimy angle: you know things the bookie doesn't — your dog is at 40 fitness, you fed it a supplement, or you've entered your best dog in Gold *knowing* you'll get nothing and backed a rival. Throwing a race carries no formal penalty; it just costs you the purse and the dog's rating. Doping and sabotage do carry penalties.

## 11. Events

One random event per player per weekend, drawn from a weighted deck of ~40 cards (weights adjust for planet). Roughly 60% flavour-with-a-nudge, 30% meaningful choice, 10% big swings. Oregon-Trail style choices with visible odds where possible. Sample deck:

- **Stowaway pup** — a rating-25 age-1 dog with a random trait has hidden in your hold. Keep (needs a slot) or hand to the pound (+300).
- **Customs shakedown** — pay 10% of cargo value or lose 30% of cargo.
- **Sponsor: Glorbo's Meat Paste** — +1,500 now; your dogs wear a hideous logo (cosmetic) and *Glutton* ×1 for two weeks.
- **Kennel cough** — a random dog −20 fitness; with a Vet, −5.
- **Talent scout** — an AI stable offers 120% of value for your best dog. Accept?
- **Solar flare** — all ships delayed; turn order rerolled.
- **Dodgy steward** — pay 800 to have your Gold runner's rival drawn trap 8 (*Nervy* rivals suffer).
- **Tip-off** — you learn a named local dog is "not trying" this week (its odds are wrong).
- **Fat Tony calls in a favour** — if you owe him: race a specific dog in Gold or lose it.
- **Kibble glut / shortage** — planet food price halves/doubles until you leave.
- **Fan club** — a dog with 3+ wins gets a fan club: +200/week while it keeps winning.
- **Pirates!** — lose 50% cargo, or fight: 60% keep everything, 40% lose cargo and 1 engine tier.
- **Wormhole shortcut** — arrive first next week regardless.
- **Retirement offer** — a stud farm offers 150% of value for any dog age 5+.
- **Local derby** — an extra 4th exhibition race this weekend, small purse, no rating change (good for testing pups).
- **Rival's trainer poached** — if you have a trainer, an AI stable tries to hire them away; match the wage +100 or lose them.

Planet events (always-on modifiers listed in §12) stack with random events.

## 12. Planets

Four **Major venues** and fourteen **regular** planets. Each has: name, one-line vibe, track (distance / bends / hazard), food price band, market bias, special rule, visual theme.

### Major venues
| Planet | Vibe | Track | Special |
|---|---|---|---|
| **Cosmodrome** — *The Cosmodrome Classic* | Retro-futurist imperial capital; brass, banners, propaganda posters of dogs | Standard 480, wide bends | Bank available; strict stewards (doping catch 30%); buyers pay +15% for dogs |
| **Ossuary** — *The Bonemeal Cup* | Graveyard planet; racing in a cathedral of ribs | Staying 600, tight bends, hazard ×1.5 | Loan shark present; *Stayer* dogs shine; dog values +10% (collectors) |
| **Blackreach** — *The Void Derby* | Deep-space station orbiting a black hole; time is weird | Sprint 350, no bends (straight!) | Turn order reversed (heavy ships fall in first); *Sprinter* paradise |
| **Collar Prime** — *The Galactic Collar* | Neon megacity; the sport's Vegas | Standard 480, medium | Always the week-13 Grand Final (purse ×4); betting margin 10%, max stake 100% |

### Regular pool
| Planet | Vibe | Track | Food | Special |
|---|---|---|---|---|
| **Kibbleton Prime** | Endless kibble farms; folksy | Standard, wide | Cheapest (40–60) | Best place to load cargo; dull market |
| **Rustgut** | Mining colony, orange dust, everyone coughing | Standard, tight | Dear (110–140) | Cheap knackered dogs (age 5+); sell food here |
| **Neon Snout** | Casino moon | Standard | Dear | Betting margin 10%, forecast bets; everything else +20% |
| **The Drift** | Orbital scrapyard | Sprint 350, ring track | Mid | Ship upgrades −30%; *Pirates!* event more likely |
| **Mudhaven** | Swamp world, fog, glowing insects | Staying 600, hazard ×1.5 | Mid | *Mudlark* +5%; injury ×1.5; Vet for hire |
| **Glassfall** | Ice planet, aurora | Sprint 350, slippery | Mid-dear | Acceleration matters more; food spoils (−20%) without Cold store |
| **Port Slobber** | Sleazy spaceport | Standard | Mid | All staff types for hire; 10% tax on winnings; bank |
| **Vatgrown** | Bio-lab; clone pups in jars | Standard | Cheap | Supplements legal (0% catch); sells age-1 pups with growth |
| **Old Wembley** | Nostalgia dome rebuilding Earth tracks | Standard, classic | Mid | Doping catch 40%; traditionalist crowd; purse +20% |
| **Hushmarket** | Black-market bazaar | Standard, tight | Dear | "Fell-off-a-ship" dogs at 60% value, 20% chance the real owner turns up in 3 weeks; loan shark |
| **Sunbleach** | Desert, twin suns | Standard, hazard ×1.2 | Dear | Fitness −5 for all dogs on arrival; cheap kennel modules |
| **Tinkertown** | Robot-run workshop planet | Sprint 350 | Mid | Engine upgrades −40%; racing muzzles |
| **Holy Bark** | Monastery world; monks who worship the Good Boy | Staying 600, serene | Cheap | No betting; no upkeep this week; +5 fitness all dogs |
| **Lagrange Lows** | Floating slum station | Standard, tight | Dear | Fixer for hire (sabotage/bribes — §13, not built yet); loan shark; local dogs are *Nervy* |

## 13. Shady options

- **Supplement** — see §8. Public if caught (leaderboard shows a syringe icon for the season).
- **Sabotage** (via Fixer, 1,200) — target a rival dog in one race: −15 fitness for that race. 25% detection → 3,000 fine, 2-week Fixer ban, and the rival is told who did it.
- **Steward bribe** (via Fixer, 800) — choose your dog's trap draw.
- **Throwing a race** — no mechanic needed; declare and bet accordingly.

All shady options are off in the "Clean Sport" toggle in season setup (Gazillionaire-style complexity toggles: *Clean Sport*, *No Betting*, *No Trading*, *Casual events only*).

## 14. AI stables

AI plays by the same rules with no stat bonuses. Difficulty changes decision quality only:

- **Easy** — near-random declarations respecting caps; never bets; buys food only when out; never hires staff; sells dogs only when broke.
- **Normal** — declares to maximise `Σ P(win) × purse` (P from the bookie model); keeps a trainer; trades food when spread > 40; bets small on favourites; buys a dog when cash > 2× value of the best available and it beats its worst dog.
- **Hard** — as Normal, plus: looks ahead to Major weeks (holds fitness), targets the highest-value dog it can afford by week 10 for net-worth weight, sells ageing dogs before they decline, uses supplements on Vatgrown, exploits Blackreach turn-order reversal, and occasionally throws a Bronze race to bet on Silver.

Each AI stable has a name, a colour, a portrait and a one-line personality that flavours its event choices ("Baroness Vex never borrows"; "Two-Fingers Grady always takes the shady option").

## 15. Screens

1. **Title / New season** — players (human/AI, difficulty, names, colours), toggles, seed (shareable).
2. **Galaxy map** — the 13-stop route with Majors starred; current position; ship stats; food price rumours.
3. **Planet hub** — a full-screen painted backdrop with hotspots: Market, Kennels, Docks, Saloon, Bookie, Race Office. Planet special rules on a signpost.
4. **Stable** — your dogs as cards: portrait, stats bars, rating, fitness, form arrows, age, traits, value, training focus.
5. **Market** — dogs for sale (compare with yours), items, staff.
6. **Docks** — ship upgrades, food buy/sell with hold gauge and price history.
7. **Race Office / Declarations** — three race cards showing every declared dog so far, the locals, and your eligible dogs to drag in.
8. **Bookie** — the three race cards with odds; stake slider.
9. **Race view** — top-down track; results overlay; payouts.
10. **Leaderboard** — every stable: cash, dogs value, ship, debt, net worth, trend sparkline; Gold wins; syringe icons.
11. **Season end** — podium, worth chart, moments, "Play again with same seed".

## 16. Art bible

**Look:** digitally painted, chunky black outlines, saturated grime. Gazillionaire's flat pastel cartooning for characters and UI frames; Death Rally's sooty oranges, oil-slick purples and neon signage for environments. Everything looks slightly held together with tape.

**Palette:** base UI charcoal `#1B1A22` and rust `#6B3A22`; accents acid green `#9BE84B`, hazard yellow `#F4C542`, hot pink `#F04E98`, cyan `#3FD6E0`. Each planet overrides two accent hues. Stable colours: 8 high-contrast saddle-cloth colours (red, blue, white, black, orange, striped, green, yellow-black — the real greyhound trap colours, which is a nice wink).

**Type:** a chunky rounded display face for headings (e.g. *Bungee*, *Titan One*), a clean mono for numbers (*Space Mono*).

**Assets (generated to the style guide):**
- 18 planet hub backdrops, 1920×1080, with six hotspot regions left uncluttered.
- 18 track top-downs, 2048×2048, track path as a separate SVG spline for the sim to follow.
- Dog portrait set: 12 base bodies × 6 palettes × 8 alien accessory overlays (compose in code).
- Dog run cycles: 1 sprite sheet per base body, 8 frames, 4 directions (top-down needs rotation only; use one direction and rotate).
- 12 AI stable-owner portraits; 6 trainer/vet/fixer portraits; Fat Tony Nebula.
- UI kit: riveted metal panels, neon button states, ticket-stub cards for races, betting slip.
- 40 event illustration cards, 800×500.

**Prompt template (for whichever image model is used):**
> "1990s PC-game digital painting, chunky black outlines, flat cel shading, grimy retro-future dog racing track on [planet vibe], [two accent colours], slightly grubby, comedic, no text, no humans, 16:9" — with a locked negative list (no photorealism, no text, no watermarks) and a fixed seed range per planet for consistency.

## 17. Audio (minimal, later)

Lo-fi synthwave loop per planet family, crowd murmur, box-open clang, a bark palette, cash-register for purses, a sad trombone for repossession. Sound effects off by default in the browser until first click (autoplay rules).

## 18. Multiplayer notes (for M5)

- Engine is `reduce(state, action, rng) → state'`; the server owns the seed and the authoritative state; clients send actions; races are replayed from the tick log the server sends.
- Phases 3 and 6 become simultaneous with a 90 s timer; contested market purchases resolve by turn order at the tick the actions arrive.
- Lobby: host picks player count, fills empties with AI, shares a code. Reconnect by replaying the action log.
- Play-by-email/async variant (Gazillionaire Deluxe did this) is nearly free once the action log exists: each player takes their turn whenever.

## 19. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-09-07 | Medium dog depth (4 stats + fitness/form/age/traits) | Readable races; enough texture for training and buying |
| 2026-09-07 | Class eligibility by rating caps, racing up always allowed | Preserves the assignment puzzle; matches real graded racing |
| 2026-09-07 | 45–60 minute season, no endless mode | Avoid Gazillionaire's never-finished problem |
| 2026-09-07 | Shuffled circuit with 4 Majors at weeks 4/7/10/13 | Replay variety plus golf-style tent-poles |
| 2026-09-07 | Grand Final always at Collar Prime | Tradition; a fixed finale to build toward |
| 2026-09-07 | Hotseat multiplayer in v1 | Nearly free given the pure engine; rehearsal for online play |
| 2026-09-07 | Everything visible (cash, worth, ratings) | Board-game tension, smarter betting |
| 2026-09-07 | Betting on any race including your own | On-theme; the main "edge" mechanic |
| 2026-09-07 | Gritty but cartoonish tone | Death Rally humour without cruelty |
| 2026-09-07 | Top-down race view | Matches Death Rally; each planet gets a track |
| 2026-09-07 | AI-generated art to a style bible | Only realistic pipeline for 18 planets |
| 2026-09-07 | TypeScript + React + Canvas, pure deterministic engine, Cloudflare Pages hosting (Workers + Durable Objects for M5) | Multiplayer-ready without a server on day one; same account for site and game server later |
| 2026-09-08 | Local dogs 30 / 46 / 58 (not M0's 28 / 42 / 52, and not §6.1's original 35 / 57 / 78), with Bronze and Silver purses raised to 1,800 and 3,400 to pay for it | PLAYTEST_NOTES finding 1. The autopilot plan — best dog to the biggest race — was the optimal one 59% of weeks and cost only 2.6% when it was not; it is now right 19% of weeks and costs 10.9%. 35 / 57 / 78 was measured and rejected: no stable wins a Gold at all, every dog is forced into its lowest class and mean end worth collapses from 47k to 17k |
| 2026-09-08 | Majors ×2.0 and the Grand Final ×3.5 (closes §20 Q2) | Adopted **with** the locals change, not instead of it. On today's numbers the multiplier alone moved nothing measurable: the season was already settled by week 6.5 of 13, the Grand Final still changed the result 13% of the time, and the rank gap between Major winners and everyone else was unchanged. With finding 1 fixed it is worth having — the leader is not settled until week 7.6 and the Grand Final flips 18% |
| 2026-09-08 | Supplement +12 speed (was +8), price, catch rate and penalties unchanged | PLAYTEST_NOTES finding 2. Measured against the race sim rather than the bookie's rating model: at +8 it was worth feeding in 10% of real declarations and 0% under a strict steward, which is a trap rather than a choice. At +12 it pays in about a third, and the punishment — a forfeited purse — still scales with the size of the race |
| 2026-09-08 | The Fixer is not hireable until §13 exists | Sabotage and the steward bribe were never built: there is no action for either, and nothing read `staff.fixer` except the weekly 350 wage. Charging for a service the game does not provide is a trap, not a difficulty |

## 20. Open questions ❓

1. ~~Grand Final venue~~ — decided: always Collar Prime.
2. ~~Major purse share~~ — decided 2026-09-08: ×2.0 / ×3.5, alongside the local-dog change. Measured; on its own the multiplier changes nothing (§19).
3. Should dogs be *retired* (removed, small stud payment) automatically at age 7, or just decay? Default: decay, player chooses.
4. Reputation as a visible stat affecting sponsors/steward suspicion — v1 or v2? Default: v2.
5. ~~Hotseat in v1~~ — decided: yes.
6. Does the human ever see the *exact* bookie probability, or only odds? Default: odds only; Hard AI uses probabilities.
