# Tabula Speech Events: what is shared, what is new (draft 1)

Status: plan for owner approval, 2026-11-20. No code changed.

This file answers two questions:

1. What does Speech Events take from the Tabula Debate engine?
2. What new parts ("primitives") must be built?

A **primitive** here means a basic building block that other features stand on. For example, the clock engine is a primitive. The extemp timer is a feature built on it.

Source: a read-only audit of the debate code on 2026-11-20 (file and line numbers below are from that day and will move). Related: [ARCHITECTURE.md](ARCHITECTURE.md) §8 (code layout), `docs/architecture/ARCHITECTURE.md` §10.

## 1. Summary

- About **8,900 lines** of debate app code today (`js/` 3,861, root modules 1,312, `logic/` 2,197, `index.html` 1,358, tokens 191; tests left out).
- About **40% is product-neutral** (about 47% if Speech Events reuses recording for practice).
- This audit supersedes the count in `docs/architecture/ARCHITECTURE.md` §10.2 (about 6,060 lines, about 43%). That count was made before `app.js` was split into `js/` and `logic/`, and it left out `logic/` (2,197 lines). The share is close; the total grew.
- But **only about 11% can be reused unchanged** today: `providers.js`, `clipqueue.js`, `tap.js`, most of `ui.js`, most of `tokens.css`. The rest needs a small change first, mostly to stop it reading the debate globals `R` and `S`.
- **Planning number: 35–45% shared.**
- **The cost of a second app is the `core/` refactor.** It must come before `events/` code. The seams it needs come from the debate format refactor, which LD needs anyway.

## 2. Shared: the list the owner asked for

| Part | Shared? | Today's code | Change needed for `core/` |
|---|---|---|---|
| **Clock engine** | Yes, with a new face | `js/clock.js` (292); restore rules in `logic/rules.js` :17–50 | Pass in the speaker list and limits. Today it reads `L.SPEECHES` and `R` on almost every line (`js/clock.js` :11–15, `logic/rules.js` :13). Add `grace` and an "over grace" flag to `restoreRun`. Split into a pure part and a thin driver with `onTick` / `onStart` / `onStop` hooks. The clock calls debate code directly today (`studyStart`, `wantRec`, `scheduleFlow`, `clock.js` :118–135); those become hooks. |
| **Refresh-safe timer state** | Yes, as is in spirit | Wall-clock `endAt`, `clockUnitIsNewer`, second-tab sync (`clock.js` :265) | Same change as above. |
| **Recording and transcription** | Yes, **practice only; lifted in P4, not P1** | `js/recording.js` (493; ~380 neutral), `clipqueue.js`, `logic/audio.js` | It writes `R.transcripts` and calls `scheduleFlow` (:341). Make the sink a callback. `TRANSCRIBE_HINT` becomes a per-product input. |
| **Ballot drafting (AI review flow)** | Yes, the review mechanics | `logic/decide.js`: `fieldState`, `markFields`, `wordDiff`, `reviewFromDraft`, `applyReview` | Make it generic over field groups. Today it is tied to the 4 debate speakers and `DRAFT_GROUPS` (:15–22). Speech Events uses one group per entry ("comment"). The debate prompt (`BALLOT_SYSTEM`) is not reused. |
| **Ranks without ties** | Yes, generalized | `L.moveRank` (`logic/decide.js` :208), `applyRank` (`js/decide.js` :448), "Rank moved" toast | Make N a parameter. Today it loops over 4 speakers. |
| **Points stepper and range** | Yes | `stepPoints` (:217), `ptsRange` and `rangeError` (`logic/round.js` :239–252) | Reuse as "rating points". |
| **Copy for the tournament ballot** | Yes, the sheet | `openCopySheet` (`js/decide.js` :537) | Feed it a new events model instead of `L.tournamentBlocks(R)`. |
| **Print / PDF** | Yes, the sheet | `openPrintDialog` (:568), `buildPrintSheet` (:589) | Feed it a new events print model. |
| **Accounts and sign-in** | Yes, server side | Server Worker | Add `events.tabulaspeech.com` to the return-URL list (already planned). |
| **Rounds billing** | Yes, server side | Server meter and ledger | New task names (`events.cleanup`). A rule for what one "round" is in Speech Events. `productLine: 'events'` on each debit. |
| **AI policy** | Yes, design reused; code not built yet | Stubs only: `aiCommandsAllowed()` (`palette.js` :10), `hasHostedPlan(gate)` (now real, `logic/hosted.js`), `aiReady` (`ai.js` :66) | Build `can()` / `ready()` once, in `core/policy.js`, for both apps (`docs/design/AI-POLICY.md` §7 step 1). |
| **AI provider client and key store** | Yes | `providers.js` (as is), `js/ai.js` `callAI` (:167), key store (:41–66) | Inject the anonymizer (today it reads `R.aff` / `R.neg`, :154). |
| **Design tokens** | Yes | `assets/tokens.css` (124) | Move `--aff` / `--neg` out to the debate CSS. Add events data tokens (DESIGN.md §3). |
| **The no-stripes rule** | Yes, as a test | `no-stripes.test.mjs` (244), `test-sources.js` | Add `events/` files to the sources list. |
| **Dialogs, toasts, tooltips** | Yes | `ui.js`: `toast` (:17), `ask` (:97), `escLayer`, `modalDialog` | Remove debate DOM IDs (`BEHIND` :16, `#flow-tabs` :271). |
| **Keyboard registry and palette** | Yes, the engine | `keys.js` :14–120, :263–288; `js/palette.js` | Commands and scopes passed in. Debate `COMMANDS` stay in debate. |
| **Tours** | Yes, the runner | `tour.js`, `js/help.js` | New tour text. |
| **Storage, export, import, backup** | Yes | `js/core.js` `store` (:16), `download` (:118); `logic/files.js` `buildBackup` / `parseBackup` (:74–170) | The storage prefix `policyJudge.*` becomes a parameter (`core.js` :13, `files.js` :134). Speech Events uses its own prefix (`tabulaEvents.*`). |
| **Settings shell** (connections, audio, theme, offline note, keys sheet) | Yes | `js/settings.js`, `js/shell.js`, `index.html` `#tab-ai` (:1014) | `aiChanged` calls debate renderers (`settings.js` :66); make it an event. |
| **Saved records log** (list, delete with Undo, CSV) | Yes | `js/decide.js` :498–639 | Swap the columns. |

## 3. Not shared (debate only)

Flow grid, sheets, speech docs, SpeechDrop, live AI flow, Live Eval, Insights, analysis, Round Map, the debate ballot body, prep timers for Aff and Neg, debate prompts (`logic/prompts.js`, 591), `logic/flow.js`.

## 4. Coupling that blocks a clean `core/`

From the audit, in order of cost:

1. **One shared global scope.** Classic scripts with no imports, so `R` (round) and `S` (settings) are read everywhere (for example `R.` appears 102 times in `clock.js`).
2. **Debate speech list and Aff/Neg in the clock** (`js/clock.js` :11–15, :200–230; `logic/rules.js` :13, :35).
3. **The clock calls debate features directly** (`clock.js` :118–135).
4. **The `policyJudge.*` storage prefix** in four files.
5. **Debate round shape** in shared code (`freshRound`, `core.js` :72; anonymize, `ai.js` :154).
6. **Save and AI-change call debate renderers** (`core.js` :98–104, `settings.js` :66).
7. **Debate DOM IDs** inside `ui.js` and `core.js`.
8. **The `PolicyLogic` namespace**, and `logic/rules.js` depends on `logic/round.js` `SPEECHES`.

The fix for all of them is the same pattern: **pass state and hooks in; never read a global.** The debate format refactor (`docs/architecture/ARCHITECTURE.md` §9) already needs this for LD. So do that refactor first, then lift `core/`.

## 5. New primitives

These do not exist in debate in any form.

| # | Primitive | What it is | Why it is new | Used by |
|---|---|---|---|---|
| N1 | **Room and entry model** | A room with 4–8 entries, a speaking order, and a status per entry (waiting, speaking, done, no-show). Entries can arrive late and speak out of order (cross-entered students). | Debate has two fixed sides and a fixed speech order. | Every screen |
| N2 | **Event definition schema** | `events/defs/<id>.json`: limit, in-room prep, shared clock, material, checks, prompts, tags (ARCHITECTURE.md §6.1). Versioned. Grace comes from the rules profile; a minimum time is added in P3. | Debate format files have sides and a flow. This has neither. | Setup, timer, comments |
| N3 | **Tournament rules profile** | v1: rating scale, rating no-ties, rank-rating rule, grace, over-grace effect (no rank 1 or flag only), bias note (ARCHITECTURE.md §6.2). P3 adds other league effects, rank caps and signal styles. | Debate has a points range only. | Rank, review |
| N4 | **Grace and over-time state** | Under limit, last-minute, in grace, over grace. "Over grace" is sticky: once true it stays on the entry, even if the timer is corrected later (with a visible manual override). | Debate pauses at −599 s and beeps once. No grace. | Timer, rank |
| N5 | **Time signals** | A count-down signal plan (for example cards at 5, 4, 3, 2, 1, 30 s, then grace). Shown to the judge, and optionally to the speaker in the Speaker view. Optional soft vibration. | Debate has one beep at 0:00. | Timer, Speaker view |
| N6 | **In-room prep phase** | For impromptu: a prep run and a speech run that share one limit, with a "speech started" tap. | Debate prep is per team, outside a speech. | Impromptu, some state events |
| N7 | **Multi-speaker roster** | The side list of entries with status, current speaker, time used, and quick switch. Keyboard: number keys pick an entry. | Debate shows speeches, not people. | Room |
| N8 | **Rank board, 1 to N** | Drag, or tap a rank, or use up and down buttons. No ties by design: moving one entry shifts the others. The over-grace rule blocks rank 1 (or applies the profile's rule) and says why. | Debate ranks 4 fixed speakers in a radio grid. | Rank |
| N9 | **Ratings** | A rating per entry on the profile's scale (points range, 1–5, or word scale). Optional check that ratings agree with ranks. | Debate points exist, but there is no rank-rating rule and no word scale. | Rank |
| N10 | **Comment sheet per entry** | Free notes, quick tags that insert text, event prompts, rule checks (flag or ok). Autosaves. | Debate writes one ballot with two feedback fields. | Room, review |
| N11 | **Critique for students** | The ballot text per entry, written for a teenager to read: specific, kind, tied to the rank. A "reason for rank" field. Guardrails in the UI (a short checklist) and in the AI prompt (no comments on looks, voice type, identity). | Debate feedback goes to debaters too, but there is no student-facing guardrail. | Review |
| N12 | **Review and copy cards** | One card per entry with rank, rating, comment and a Copy button, in the order the online ballot lists them. | The copy sheet exists; the per-entry model is new. | Review |
| N13 | **Paste parser for assignments** | Turns pasted Tabroom or SpeechWire room text into entries (codes, order, maybe titles). Falls back to one code per line. | Debate has no roster. | Setup |
| N14 | **Congress grid** (phase P5) | Students by speeches, score per speech on 1–6 or 1–8, PO hours, top-8 helper. | Nothing like it in debate. | Congress |

## 6. Shared design philosophy vs new design

Covered in [DESIGN.md](DESIGN.md). In short:

- **Same:** neutral chrome, color for data and status only, no stripes, 16 px forms, one dialog and one toast, "removed means gone" for AI, offline first, plain copy.
- **New:** the roster, the rank board, signal cards, the comment sheet with tags, the review cards, and the two sage data tints.

## 7. What this means for the build order

1. **Debate format refactor** (already planned before LD). It makes the seams and unblocks LD.
2. **Lift `core/`** from the seams, with debate still passing all its tests. This is the riskiest step. It touches the live debate app.
3. **Build `events/` on `core/`.**

Estimate for step 2 (my judgment, not measured): about 2 to 3 weeks of focused work for one developer, plus a full debate regression pass. The estimate depends on how `core/` loads with no build step.

Timing: steps 2 and 3 run **after LD and PF ship**, keeping the owner's order. The format refactor (step 1) is what unblocks LD; the folder lift does not.
