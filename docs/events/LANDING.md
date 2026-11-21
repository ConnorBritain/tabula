# Tabula Speech Events: shared core and landing plan (draft 1)

Status: plan for owner approval, 2026-11-21. No code changed. **No step below starts until the owner approves this plan.**

This file answers two parts of the owner's request of 2026-11-21:

- "Figure out how we can meaningfully build out the remaining shared core that's necessary" (§2, §3).
- "Then we can start atomically landing the different event types" (§4).

It builds on [SHARED-VS-NEW.md](SHARED-VS-NEW.md) §2, §4 and §7, on PLAN.md P1, and on [MODELS.md](MODELS.md). **The two owner choices in §5 are decided: Q12 B and Q13 B (owner, 2026-11-21).** PLAN.md P1, R2, Q8 and the phase table now match.

## 1. Where things stand (2026-11-21)

- **The debate format refactor is done and merged** (`4548d46`, merge `10054b9`). Policy is a format file (`formats/policy-hs.v1.js`). LD is a format file (`formats/ld.v1.js`). Follow-up LD fixes are merged too (`636337b`, `815bd4d`, `16cc662`).
- **Most pure logic is already format-driven.** `logic/rules.js` reads `R.` 0 times and `SPEECHES` 0 times. `restoreRun` takes the format as an argument. One leftover: `logic/round.js` still defines and exports a deprecated `SPEECHES` alias fed from the policy format (line 13). C4 and C6 (§3) must not depend on it.
- **The page code still reads globals.** Counted on 2026-11-21: `R.` appears 103 times in `js/clock.js`, 91 in `js/decide.js`, 39 in `js/core.js`, 23 in `js/recording.js`, 21 in `js/ai.js`. The storage prefix `policyJudge` is in 7 files: `js/clock.js`, `js/core.js`, `js/docs.js`, `js/decide.js`, `logic/files.js`, `logic/caps.js`, `assets/theme-boot.js` (SHARED-VS-NEW.md §4 said 4; it grew).
- **No real ES module yet.** `app.js` has a `type="module"` tag, but it imports nothing and reads the classic-script globals. The other page files are classic scripts with `defer`. The `node --test` suite loads `logic/` with `require`. So the owner's module choice (PLAN.md Q10: native ES modules) starts from zero. C0 (§3) is the real first step.
- **The AI gate exists as pure code.** `logic/caps.js` holds `canUse(gate, f)`, `gateFor`, `payerOf`, `setupAllowed`, `showSetupFor`, `offTokens` and the feature keys (platform phase 1B). It is the base for `core/policy.js`.
- **PF has not started.** FORMATS.md targets PF for the 2027-28 season start (September 2027).
- **Speech Events has data, tests and a prototype only.** 17 event files and 3 profiles in `events/`, listed in `events/published.json`; a schema test (`events/events-data.test.mjs`); a guard that the debate build does not ship `events/` (`events/not-shipped.test.mjs`); and the throwaway prototype for the 5-judge lay test ([PROTOTYPE-TEST.md](PROTOTYPE-TEST.md)).

## 2. What remains of the `core/` lift

Status of each coupling in SHARED-VS-NEW.md §4 (the delta only):

| # | Coupling | Status 2026-11-21 |
|---|---|---|
| 1 | One shared global scope | **Open.** |
| 2 | Debate speech list and Aff/Neg in the clock | **Half done.** `logic/rules.js` takes the format. `js/clock.js` still reads `R` and side names. |
| 3 | The clock calls debate features directly | **Open.** |
| 4 | The `policyJudge.*` storage prefix | **Open.** 7 files (§1). |
| 5 | Debate round shape in shared code | **Open.** `freshRound`, the AI anonymizer, the policy `SPEECHES` alias. |
| 6 | Save and AI-change call debate renderers | **Open.** |
| 7 | Debate DOM IDs in `ui.js` and `js/core.js` | **Open.** |
| 8 | The `PolicyLogic` namespace; `rules.js` needs `round.js` | **Half done.** `rules.js` reads `format.js`, not `SPEECHES`. The namespace stays. |

**New since SHARED-VS-NEW.md: how a classic script reaches an ES module.** Debate's `logic/` files are classic scripts that set globals, and the tests `require` them. A `core/` ES module cannot be read by a classic script at parse time. C0 must pick one bridge and prove it:

- **(a) Dual-export file:** each `core/` file is plain code that works as an ES module and also sets one namespaced global. Smallest change; a little duplication at the bottom of each file.
- **(b) Convert as you go:** each debate file that uses a `core/` module becomes an ES module in the same step. Clean, but every step touches more files.

C0's done-when names the chosen bridge. This is an engineering call inside the owner's Q10 answer, not a new owner question.

**Chosen in C0 (2026-11-21): (a), the dual-export file.** How it works:
- Each `core/` file is an ES module. Its last line also sets `globalThis.TabulaCore.<name>`.
- `core/package.json` (`"type": "module"`) tells Node that `core/` holds ES modules. Classic files read a module with `require('../core/<name>.js')` (Node 22.12 or newer). The hosted build leaves `core/package.json` out.
- `index.html` loads each `core/` file with `type="module"` before the classic scripts. Every classic script after it loads with `defer`, so the browser runs it after the module, in page order. Only the three head scripts (`theme-boot.js`, `logic/caps.js` and `caps-boot.js`) still run at once.
- `core-words.test.mjs` checks the banned words, that `import`, `require()` and `globalThis.TabulaCore` give the same functions, the load order, and that `bridge.mjs` and `build-app.mjs` include `core/`.
- First user: `logic/format.js` takes `deepFreeze` from `core/defs.js`.

## 3. Core step plan

**The C-steps are a dependency graph, not one queue.** Each step is one small change, one module at a time. Each ends with **every debate gate green** (`node --test`, `node check-publish.mjs`), the debate browser checks passing, and **no visible change** in debate. Each adds `core/` tests and extends the banned-word test. No deploy between Thursday noon and Saturday night in season (PLAN.md R1).

| Step | `core/` module | Source today | Done when |
|---|---|---|---|
| **C0** | The `core/` folder, the banned-word test (ARCHITECTURE.md §8), and the classic-to-module bridge (§2) | — | The banned-word test fails on a planted word; one debate classic script and the tests both call one `core/` function through the chosen bridge |
| **C1** | `core/defs.js`: generic registry only: freeze, find by id and version, newest version, never drop. Each app injects its own `prepare` hook and its own fallback | The generic part of `logic/format.js` (lines 11–60 mix it with debate-only code: `minutes`, `flowSpeeches`, `speakerIds`, `OLD_ROUND`, `FORMAT_IDS`, `formatFromSearch`, which stay in debate) | Debate formats load through it with a debate `prepare`; a new test loads the 17 JSON event files through it with an events `prepare` |
| **C2** | `core/store.js`: storage and backup with a prefix argument | `js/core.js` `store`, `download`; `logic/files.js` `buildBackup`, `parseBackup` | Debate keeps `policyJudge.*`; a test proves a second prefix never reads or writes debate keys |
| **C3** | `core/ui.js`: `toast`, `ask`, `escLayer`, `modalDialog`, with no debate DOM IDs | `ui.js` | `BEHIND` and `#flow-tabs` move to debate code; debate dialogs unchanged |
| **C4** | `core/tokens.css` without `--aff` / `--neg` | `assets/tokens.css` | `tokens.test.js` contrast pairs unchanged; `no-stripes.test.mjs` covers `core/` |
| **C5** | `core/keys.js`: key registry and palette engine, commands and scopes passed in | `keys.js`, `js/palette.js` | Debate commands stay in debate; key tests pass |
| **C6** | `core/clock.js`, pure part: runs, restore, limit and grace stages, sticky over grace, run `kind` | `logic/rules.js` `restoreRun` and helpers; `js/clock.js` math | Debate restore tests pass through it unchanged; new tests for grace, over grace and a shared prep-plus-speech limit |
| **C7** | `core/clock.js`, driver part: start, stop, tick, with `onTick`, `onStart`, `onStop` hooks | `js/clock.js` (calls to `studyStart`, `wantRec`, `scheduleFlow` become hooks) | `js/clock.js` is a thin debate adapter; second-tab sync and refresh restore still pass |
| **C8** | `core/ranks.js`: move-rank for N ids, with an optional top-N cap or a full ranking | `logic/decide.js` `moveRank` | Debate rank tests pass through it; new tests for N = 8, a top-8 cap of 30, and a full ranking of 30 |
| **C9** | `core/points.js`: points range, range error, stepper | `logic/round.js` `ptsRange`, `rangeError`; `logic/decide.js` `stepPoints` | Debate points tests pass through it |
| **C10** | `core/sheets.js`: copy sheet and print sheet shells, fed by a model | `js/decide.js` `openCopySheet`, `openPrintDialog`, `buildPrintSheet` | Debate copy and print output identical in tests |
| **C11** | `core/policy.js` with a `product` argument | `logic/caps.js` (`canUse`, `gateFor`, `payerOf`, `setupAllowed`, `showSetupFor`, `offTokens`) | Debate gate tests pass; a test asks for `product=events` |
| **C12** | `core/review.js`: the pure review diff over field groups | `logic/decide.js` review functions | Debate ballot-draft tests pass; a test runs one "comment" group per entry |
| **C13** | `core/ai.js`: providers, hosted client, key store; anonymizer passed in | `providers.js`; `js/ai.js` `callAI` and key store | Debate AI tests pass; no debate round shape inside |
| Later | `core/recording.js` | `js/recording.js`, `clipqueue.js` | Practice only (PLAN.md P4) |

**Done so far:** C0 (`db966d8`), C1 (`8efa054`: `core/defs.js` registry) and C2 (`core/store.js`: storage limited to its key prefixes, backup files with an `app` check, file download; debate uses `policyJudge.` and `tabula.`).

**Minimal chains** (what each first events step waits for):

- **Events shell (E1):** C0 → C1, C2, C3, C4. All low-risk.
- **Roster screen (E3):** + C5.
- **Timer (E4):** + C6 → C7. The riskiest pair. They come after the shell, so the folder, the test and the bridge are proven first.
- **Rank and ratings (E6, E7):** + C8, C9.
- **Review and copy (E8):** + C10.
- **AI clean-up (E13, E14):** + C11, C12, C13. Last, because the app is complete without AI.

**Estimate (judgment, not measured):** C0–C10 about 2 to 3 weeks of focused work, as SHARED-VS-NEW.md §7 says. C11–C13 about 1 more week.

## 4. Atomic landing plan for event families

Each landing is one small change, tested on its own, on a preview host (not public) until v1 is ready.

**Family names.** MODELS.md §1 defines F1 as all prepared events. This plan lands F1 in two parts: **F1a, public address** (OO, INF, EXP, OSW: one speaker, no title or author) and **F1b, interp** (DI, HI, DUO, POI, PRO, POE, STO, DEC).

### 4.0 Before any code

| Step | What | Needs | Done when |
|---|---|---|---|
| **E0** | Run the 5-judge lay test with the prototype ([PROTOTYPE-TEST.md](PROTOTYPE-TEST.md)) | Nothing; it can run now | Results written up. The room, rank and review design is confirmed or changed **before** E3–E8 build it |

### 4.1 v1 (PLAN.md P2), in order

F1a goes first. It needs the fewest parts, so it proves the whole line (set up → judge → rank → review) first.

| Step | What lands | Events on | Needs | Done when (besides all gates green) |
|---|---|---|---|---|
| **E1** | `events/` page shell, `tabulaEvents.*` store, event loader, empty Rooms list | none | C0–C4 | Loads all 17 files through `core/defs.js`; `not-shipped.test.mjs` still passes |
| **E2** | Service worker | none | E1 | Opens with the network off (browser check) |
| **E3** | Paste parser (N13), pure | none | E1 | Tests on real Tabroom and SpeechWire room text; unclear lines go to "Check these" |
| **E4** | Room setup and roster: room and entry model (N1), roster (N7), number keys | F1a | C5 (paste from E3, or type codes by hand) | Late arrival and no-show with Undo; screen test |
| **E5** | Timer: limit, grace, sticky over grace (N4), signal chips (N5), ±10 s, Set time | F1a | C6, C7 | A reload mid-speech resumes the right time; a correction never clears over grace by itself |
| **E6** | Comment sheet: notes, tags, rule checks, private note, reason for rank (N10, N11) | F1a | E4 | Autosave survives a reload; a flag never reaches the student comment unless the judge writes it |
| **E7** | Rank board 1–N with the profile's overtime effect (N8, N3), and ratings (N9) with the invitational profile | F1a | C8, C9 | Over-grace entry cannot sit at rank 1 under `noFirst`; `flagOnly` shows the note; points range, word scale, no-ties and rank-rating rule tests |
| **E8** | Review and copy, two stages, with ratings on the cards; print (N12) | F1a | C10 | Ranks and ratings copy first; each comment copies on its own; print sheet test |
| **E9** | F1b interp: title and author fields; Duo as one entry with two performers | F1b | E8 | Screen tests: title and author on the review card; one Duo row, one rank, one comment |
| **E10** | F2: drawn-question field, any entry starts in any order | USX, IX, COM, MX | E8 | Screen test: any entry starts in any order; the question shows on the review card |
| **E11** | F3: prep phase on a shared limit (N6) | IMP | E8 | The shared 7:00 covers prep and speech; both runs restore after a reload |
| **E12** | Custom event form | Custom | E8 | A Custom room saves its own limit and grace and reopens with them |
| **E13** | AI clean-up with the judge's own key | all | C11–C13 | With AI off the button is gone, not greyed; the judge must accept the word diff |
| **E14** | Hosted AI clean-up (`events.cleanup`) | all | E13; cloud task and round rule (PLAN.md Q2) | Hosted path tests; scrubbing of codes and typed names |

After E14, v1 is complete. PLAN.md P2's "done when" applies: 10 judges at one real tournament, all gates green, axe and keyboard pass.

E9 to E12 are independent once E8 is in. They touch different files, so they can land in any order or in parallel sessions.

### 4.2 League packs (PLAN.md P3)

**One primitive per landing, then one pack per landing.** A pack is data plus a schema test, reviewed against its 2026-27 rulebook.

| Step | Primitive first | Then packs that need it |
|---|---|---|
| L1 | none (data only) | NSDA-like packs: NCFL, TFA, OSDA |
| L2 | `timing.min`, `timing.prepMax` (F3) | CHSSA (Impromptu 2 + 5), IHSA, Kansas |
| L3 | Overtime effects past `noFirst` (`dropRanks`, `lastPlace`, `disqualified`, `noTopRating`, `judgeChoice`) | CHSSA, IHSA, UIL, MSHSL, IHSSA, NCFCA |
| L4 | Note-card rule (F2) | UIL Informative and Persuasive Extemp |
| L5 | Cross-ex run (F2, elims) | NSDA Nationals extemp elims, CHSSA, TFA, OSDA |
| L6 | Two runs in one entry (F4) | NSDA Pro Con Challenge |
| L7 | Rating-only and top-N ranks (F5) | IHSSA (Iowa), Kansas festivals, MIFA |
| L8 | Rubric grid (F5) | NCFCA, Stoa |

How a new field enters the data without breaking the frozen v1 files is in MODELS.md §5.

### 4.3 Congress (PLAN.md P5, right after v1 by Q13 B)

| Step | What lands | Needs | Done when |
|---|---|---|---|
| K1 | Chamber file schema and the NSDA chamber file in `events/congress/chambers/`; a Congress profile in `events/congress/profiles/`; both listed in `events/published.json` under new keys (for example `congressChambers`, `congressProfiles`) | C1 | New schema tests; new "ever published still exists" and "on disk is listed" tests for the new keys; source and season named; `not-shipped.test.mjs` still passes |
| K2 | Session setup: legislators through the paste parser (E3), docket, house, role | E3 | Paste test with a real Congress chamber list |
| K3 | Speech log with a speech run and a questions run per speech | C6, C7 | Reload mid-speech resumes; the log edits with Undo |
| K4 | Points per speech and comments | C9 | Scale from the Congress profile; out-of-range blocked |
| K5 | PO terms and points per full hour | C9 | Hours counted from runs |
| K6 | Rank board: top-N for a scorer, full chamber for a parliamentarian, with speech count and average points beside each name | C8 | Top 8 of 30; only those who spoke or presided; ranks blocked until PO points are in |
| K7 | Review and copy in Tabroom's Congress ballot order | C10 | Copy test |

A parliamentarian view past K6 (for example TFA, where the parliamentarian scores the PO) is outside this plan. It is decided after a scorer beta.

## 5. Owner choices

**Decided 2026-11-21 (owner): "Q12 B and Q13 B, go ahead".** The new order: the `core/` lift now; then PF and Speech Events side by side; Congress right after v1. The options are kept below as the record of the choice.

### Q12. When does the `core/` lift start?

Context: the reason to wait (PLAN.md R2: "the lift delays LD and PF") was half about LD. LD is merged. The speech season peaks January to April (districts and state; see [SEASON.md](SEASON.md)). PF targets September 2027.

- **A. Keep the order.** PF is next. The `core/` lift starts after PF ships (target: September 2027). Speech Events v1 lands after that. PF code is written on today's globals. The lift then moves it into the module layout.
- **B. Lift `core/` now. Then build PF and Speech Events side by side.** The core steps run first (about 2–3 weeks, a guess). Then PF and the Speech Events landings run in parallel, in separate sessions. They touch different folders (`formats/` and `js/` for PF; `events/` for Speech Events). PF is built once, on `core/`. The cost: PF starts about 2–3 weeks later. The lift's risk to the live debate app (R1) also moves into the 2026-27 season.
- **Dates are a guess.** v1 is 15 landings after the lift (E0–E14), and PLAN.md P2 needs a 10-judge test at a real tournament. Under B, a spring 2027 pilot is a stretch goal, not a promise. Under A, the first real speech tournament is late fall 2027 at the earliest.
- **Decided: B.** The format refactor already removed the main reason to wait. PF built once on `core/` avoids a second move of the PF code. B keeps a chance at the 2027 spring season; A gives it up. The R1 safeguards apply either way: one module at a time, all gates, no in-season weekend deploys.

### Q13. Where does Congress go?

Context: PLAN.md Q8 put Congress in P5, after league packs (P3) and coach tools (P4). The owner listed Congress first in the request of 2026-11-21. Congress runs at NSDA districts and Nationals, and at many invitationals and state meets ([SEASON.md](SEASON.md) §3). It is the most painful event to score by hand (`docs/growth/FORENSICS.md` §6). Custom events already cover most league events in v1.

- **A. Keep Congress in P5** (after P3 and P4).
- **B. Move Congress to right after v1** (before league packs). K1–K7 need only core steps and the paste parser that v1 already lands.
- **Decided: B.** It reaches more judges sooner than the packs do, and the packs' events already work through the Custom form.

## 6. What this plan does not change

- No change to PLAN.md §5 decisions Q1–Q11 except what Q12 B and Q13 B changed: P1 and R2 (Q12), Q8 and the phase table (Q13).
- No change to `tabula-cloud`. The cloud items for Speech Events (the `events.cleanup` task, the Q2 round rule) stay with the cloud session (PLAN.md §5 follow-ups).
- The owner approved this plan on 2026-11-21. App code starts with C0.
