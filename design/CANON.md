# Which documents are canonical

**This repository is the source of truth for Space Dog Racing.** Copies of these documents exist in
the claude.ai Project of the same name, and those copies are **mirrors**. Edits are made here and
pushed to the Project afterwards. If a mirror and this repo disagree, the repo is right.

Read this file first. Every design document carries a status header saying the same thing, so a
document read out of context can still tell you what it is.

---

## The documents

| Document | Status | What to do with it |
|---|---|---|
| `design/CANON.md` | **CURRENT** | This file. Which documents are current, and which way the sync runs. |
| `design/GDD_V3.md` | **CURRENT** | The rules. Build from this. |
| `design/BUILD_PLAN_V3.md` | **CURRENT** | The phases, the delete list, the acceptance criteria, the builder prompts. |
| `design/ONLINE_PLAN.md` | **CURRENT** | Online multiplayer, planned at `v3k`: the room, what each browser sees, the engine and web changes, cost, and build phases L1–L4. Replaces `BUILD_PLAN.md` §6b.9 and Prompt M6. Mirrored from `v3k`. |
| `design/BUILD_PLAN.md` §§1–5 | **CURRENT** | Architecture, tech stack, repo layout, the data model. Not restated in V3 — this is still the reference. |
| `design/BUILD_PLAN.md` §6 onward | historical | v1's milestones and v2's five phases, complete through tag `v2e`. §7a's harness methodology still applies. |
| `design/GDD.md` | historical | v2, shipped at `v2e`. **Do not build from it.** Kept because its measurements and its decision log (D1–D53) are the record of *why* the game works as it does, and GDD_V3 cites it throughout. |
| `claude/*_NOTES.md`, `claude/*_PROMPT.md` | historical, write-once | The build log, one pair per session. **Write-once from the moment the file lands in this repo**, not from the moment it was drafted — see below. |
| `design/PLAYTEST_CHECKLIST.md` | **CURRENT** (its top section) | The playtest sheet. At `v3j` it is one evening, with every open 🎲 row mapped to a game. Mirrored to the Project from `v3j`, so it can be read on a phone at the table. |
| `design/space_dog_racing_economy.xlsx` | **CURRENT** | The source of truth for *numbers*. `packages/engine/src/content/balance.json` is generated from it — never hand-edit the JSON. |

⚠️ **v2's documents are marked historical but are still referenced.** GDD_V3 leans on v2's measured
findings by name throughout (the fitness curve, the race constants, the trap-draw work, the reasons
the Fixer's wage failed). Do not archive or delete them — a builder who cannot follow those
references will re-derive a decision that has already been paid for.

---

## The rule, in one line

> **Edit in the repo. Sync to the Project. Never the other way round.**

### Why the split exists

The repo is what a builder reads — Claude Code, in the working tree, with the code in front of it.
The Project is what a *chat* session reads when there is no repo attached: planning conversations,
design arguments, questions on a phone. Both need the same documents; only one of them can be the
one that is edited.

### How to sync

There is no automatic link. After changing a design document here, ask a Cowork session with this
folder connected to *sync the project docs from the repo*, and it will read these files and write
them back to the Project. Update the `last synced` date in the status header when you do.

### What can actually drift

Only the markdown documents in `design/` — this file, the four above it, `PLAYTEST_CHECKLIST.md` since `v3j` and `ONLINE_PLAN.md` since `v3k`. Everything in `claude/`
is a write-once record of a session that has already happened; the spreadsheet has no Project copy
at all; and `CLAUDE.md` is deliberately **not** mirrored, because it is read by a builder standing
in the working tree and a Project copy would be drift surface for no benefit.

### ⚠️ Write-once starts when the file lands here, and `V3_PHASE_A_PROMPT.md` is the reason that is spelled out

A phase prompt is written *before* the phase, so it can be wrong about how the phase will be built —
and `claude/V3_PHASE_A_PROMPT.md` was. It told the builder it was Claude Code standing in the working
tree and must not clone or produce a bundle; Jesse chose not to switch to Claude Code, and Phase A was
built in Cowork from a clone, handing back a bundle. **The repo's copy is the corrected one. The
claude.ai Project holds the earlier draft, and it is superseded.**

The general rule, so this does not need deciding again: a prompt or a set of notes is frozen at the
commit that adds it, because that is when it becomes the record. Correcting a draft *before* it is
committed is writing the record, not editing it. After that commit, nothing touches it — a later
correction goes in the next phase's notes.

---

## Version history

| Version | Tag | Documents |
|---|---|---|
| v1 | `m4` | `design/GDD.md` 0.1, `design/BUILD_PLAN.md` §6 |
| v2 | `v2a` … `v2e` | `design/GDD.md` 0.2–0.7, `design/BUILD_PLAN.md` §6b |
| **v3** | `v3a`, `v3b`, `v3c`, `v3c2`, `v3d1`, `v3d2`, `v3e1`, `v3e2`, `v3f1`, `v3f2`, `v3g`, `v3h`, `v3i`, `v3j`, `v3k`, `v3l1`, `v3l2`, `v3l3` | **`design/GDD_V3.md` 3.0, `design/BUILD_PLAN_V3.md`**, and from `v3k` **`design/ONLINE_PLAN.md`** |

Last reviewed and **synced to the claude.ai Project: 30 September 2026**, at `v3l3` (Phase L3: the web online, behind the build variable `VITE_ROOMS_URL` — the lobby, the store on a socket, `screenFor` online with no pass screens, the waiting line and the nudge, the stand-in button, reconnecting, and Play again across rooms; `npm run online-table-walk` and `npm run browser-walk` against `wrangler dev`. `ONLINE_PLAN.md` §2.4, §2.6, §5.1 and §10 updated; GDD_V3 gained L3a–L3c; BUILD_PLAN_V3's L outline marks L3 done. Nothing under `packages/engine` changed, hotseat reads byte for byte as at `v3l2`, and no rule, golden or save version moved. Before that, `v3l2`, Phase L2: the room — `packages/server`, a routing Worker and the `Room` Durable Object, the protocol types, `npm run online-walk` against `wrangler dev`; not a root workspace, so the Pages build is unchanged. `ONLINE_PLAN.md` §2.2, §5.3, §5.5 and §10 updated; GDD_V3 gained L2a and L2b; BUILD_PLAN_V3's L outline marks L2 done. Nothing under `packages/engine` or `packages/web` changed, and no rule, golden or save version moved. Before that, `v3l1`, Phase L1: the engine's half of online play — `viewFor`, `rumoursFor`, the off-season in any order, `PROTOCOL_VERSION`. `ONLINE_PLAN.md` §3.1, §4 and §10 updated; GDD_V3 gained L1a and L1b; BUILD_PLAN_V3's L outline marks L1 done. No rule, golden or save version moved. Before that, `v3k`: online planned, `ONLINE_PLAN.md` new, GDD_V3 V24–V28, BUILD_PLAN.md §6b.9 and Prompt M6 superseded). The Project mirrors match this repo for `CANON.md`, `GDD_V3.md`, `BUILD_PLAN_V3.md`, `BUILD_PLAN.md`, `GDD.md`, `PLAYTEST_CHECKLIST.md` and, from `v3k`, `ONLINE_PLAN.md`. `design/ASSET_LIST.md` is not mirrored: it is a working list for the art, read in the repo.
