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
| `design/BUILD_PLAN.md` §§1–5 | **CURRENT** | Architecture, tech stack, repo layout, the data model. Not restated in V3 — this is still the reference. |
| `design/BUILD_PLAN.md` §6 onward | historical | v1's milestones and v2's five phases, complete through tag `v2e`. §7a's harness methodology still applies. |
| `design/GDD.md` | historical | v2, shipped at `v2e`. **Do not build from it.** Kept because its measurements and its decision log (D1–D53) are the record of *why* the game works as it does, and GDD_V3 cites it throughout. |
| `claude/*_NOTES.md`, `claude/*_PROMPT.md` | historical, write-once | The build log, one pair per session. Never edited after a phase ends, so these cannot drift. |
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

Only the markdown documents in `design/` — this file and the four above it. Everything in `claude/`
is a write-once record of a session that has already happened; the spreadsheet has no Project copy
at all; and `CLAUDE.md` is deliberately **not** mirrored, because it is read by a builder standing
in the working tree and a Project copy would be drift surface for no benefit.

---

## Version history

| Version | Tag | Documents |
|---|---|---|
| v1 | `m4` | `design/GDD.md` 0.1, `design/BUILD_PLAN.md` §6 |
| v2 | `v2a` … `v2e` | `design/GDD.md` 0.2–0.7, `design/BUILD_PLAN.md` §6b |
| **v3** | *unbuilt* | **`design/GDD_V3.md` 3.0, `design/BUILD_PLAN_V3.md`** |

Last reviewed: 16 September 2026.
