# Tabula Speech Events: plan (draft 1)

Status: the Speech Events beta code is on main. The hosting config is ready (see [DEPLOY.md](DEPLOY.md)). It is not live yet. What each release holds is in [RELEASE-NOTES.md](RELEASE-NOTES.md).

Read in this order: this file, then [ARCHITECTURE.md](ARCHITECTURE.md), [EVENTS.md](EVENTS.md), [SHARED-VS-NEW.md](SHARED-VS-NEW.md), [DESIGN.md](DESIGN.md).

**Added 2026-11-21 (catalog and core plan, for owner approval):** [CATALOG.md](CATALOG.md) (the full event panel and which app owns each event), [SEASON.md](SEASON.md) (fall versus spring, Friday versus Saturday, the LD question), [MODELS.md](MODELS.md) (object, data and design models per event family, shared objects), [LANDING.md](LANDING.md) (the rest of the `core/` lift, the atomic landing order, and two open owner choices, Q12 and Q13). Q12 and Q13 (LANDING.md §5) were decided 2026-11-21 (owner: "Q12 B and Q13 B, go ahead"). Q12 B changed P1 and R2; Q13 B changed Q8 and P5. Those rows below now say so.

## 1. The plan in one screen

- **What:** a room tool for speech judges. Time each speaker, write comments, rank with no ties, copy to Tabroom or SpeechWire. Offline first. AI only cleans up the judge's own words, on request.
- **Where:** `events.tabulaspeech.com`, same account and wallet as Tabula Debate.
- **Events:** events are data files. v1 ships 17 events (NSDA main, NSDA supplemental speech, two middle school events) plus a Custom event form. State and league packs come next.
- **Shared with debate:** about 35–45% of the code (clock engine, storage, export, dialogs, toasts, keys, AI client, print and copy sheets, review-diff, tokens, the no-stripes test). Accounts, billing and AI policy are shared on the server.
- **New:** the room and entry model, event and rules-profile files, grace and over-time state, time signals, in-room prep, the roster, the rank board, ratings, the comment sheet, student-facing critique help, review and copy cards, a paste parser.
- **The real cost:** lifting a `core/` folder out of the debate app first, using the seams the debate format refactor makes for LD.
- **Order (owner, 2026-11-21, Q12 B):** LD is done. The `core/` lift runs now. Then PF and Speech Events are built side by side, both on `core/`. Congress comes right after v1 (Q13 B).

## 2. Phases

| Phase | What ships | Done when | Depends on |
|---|---|---|---|
| **P0. Decide** | Owner answers §5, including the module mechanism (Q10). Short legal read on Q2, Q5, Q6, Q7. | Answers written into this file. | — |
| **P1. Shared core** | Debate format refactor (done with LD). Then, now and before PF (Q12 B), `core/` lifted from the seams: clock (pure + driver with hooks), storage with a prefix, backup, dialogs, toasts, keys registry, AI client, key store, print and copy sheets, review-diff, ranks and stepper for N entries, tokens without side colors. Recording waits for P4. `can()` / `ready()` in `core/policy.js`. | Debate passes every gate (`node --test`, `node check-publish.mjs`) and its browser checks, with no visible change. A static test proves `core/` uses no word from the banned list (ARCHITECTURE.md §8). | Debate format refactor |
| **P2. v1 judge app** | `events/` on `events.tabulaspeech.com`. Screens 1–7 (ARCHITECTURE.md §5). 17 events + Custom. Presets: NSDA district, NSDA-style invitational, Custom. Two-stage review (ranks first, then comments). Print / PDF. Export / import. Service worker. Own-key "Clean up my comments". Hosted clean-up through the Worker (`events.cleanup`, `productLine: 'events'`). | 10 judges at one real tournament (from `docs/growth/FORENSICS.md` §6): a 6-entry room's ranks and comments at least 30% faster than paper, and 4 of 5 say they would use it again. All gates green. Axe and keyboard pass. 5-judge lay test. | P1; cloud: sign-in on the new host, the `events.cleanup` task, the Q2 round rule (new commit trigger) |
| **P5. Congress** (moved by Q13 B: right after P2, before P3) | Scoring grid (1–6 and 1–8 scales), PO hours, top-8 helper, session timer. Steps K1–K7 in LANDING.md §4.3. | 3 Congress scorers at one tournament. | P2 |
| **P3. Leagues** | League packs as data: CHSSA, TFA, UIL, IHSA, KSHSAA, MSHSL, OSDA, MIFA, IHSSA, NCFL, NCFCA, Stoa. New: minimum time, extemp cross-ex run, Pro Con Challenge (two runs), rating-only ballots, top-N ranks with unique percentages, rubric grids. Shareable rules profile link from a coach. | Each pack reviewed against its 2026-27 rulebook; a schema test per file. | P2 |
| **P4. Practice and coach** | Practice timer for teams; recording and transcripts with consent (practice only); time-use report; ballot box (paste past comments, see by student and event); coach summary (AI, policy key `coachSummary`); extemp practice questions. | Coach beta with 3 programs. | P2; program accounts (cloud plan steps 1–4) |
| Later | Radio window, group events. | — | Demand |

## 3. The v1 cut

**In v1:**

1. Rooms list, room setup (paste or type codes), room screen, speaker view (off by default), rank board, review and copy, settings.
2. Events: OO, INF, USX, IX, DI, HI, DUO, POI, COM, PRO, POE, EXP, IMP, STO, OSW, DEC (MS), MX (MS), and Custom.
3. Timer with grace, sticky over-grace flag, signal chips, ±10 s and set time, in-room prep for impromptu.
4. Ranks 1–N, no ties, the NSDA "no rank 1 past grace" rule, the over-time flag for tab-room leagues.
5. Ratings: none, points range (with optional no-ties and rank-agreement rules), or a word scale in the tournament's order.
6. Comment sheet: notes, Strengths and To-work-on chips, rule checks, a private note. Reason for rank.
7. Critique help checklist (strength, thing to work on, why this rank).
8. Two-stage review: copy ranks first, then comments. Copy all. Print / PDF.
9. AI clean-up (own key or hosted), per entry, with review. Removed entirely when policy is off.
10. Offline, installable, export and import, Undo on every destructive action.

**Not in v1:** recording in competitive rooms, AI ranking of any kind, Congress, league packs (Custom covers them), extemp CX, rubrics, radio, group events, a Tabroom API link, script storage, extemp article files.

## 4. Risks

| # | Risk | How likely | Answer |
|---|---|---|---|
| R1 | The `core/` lift breaks the live debate app. | Medium | Do it behind the full debate test suite and browser checks. One module at a time. No visible change allowed. Keep the debate app at the repo root (no move into `debate/`) unless a real need shows up: a move changes live paths, `check-publish.mjs` and `learn/` links. No deploys Thursday noon to Saturday night in season. |
| R2 | The lift delays PF. | Medium | LD is done. The lift uses the format refactor's seams and lifts only what Speech Events needs (SHARED-VS-NEW.md §2). PF starts about 2–3 weeks later (a guess) and is built once, on `core/` (Q12 B). |
| R3 | Lay judges stay with paper. | Medium | Phone-first layout, no account needed, one-screen setup, the 5-judge lay test before beta. Coaches hand out a QR code at judge check-in. |
| R4 | Rules change every season. | High | Versioned event and pack files; old versions kept forever. A yearly review each August against the new manuals. Every file names its source and season. |
| R5 | Tabroom or SpeechWire change their room text, so paste breaks. | Medium | The parser falls back to one code per line. Unclear lines go under "Check these". |
| R6 | Comments about minors sit on a shared school laptop, or pass through hosted clean-up. | Medium | Codes by default; names optional. "Clear this device" in settings. An optional auto-delete of rooms after N days. Export file is the judge's own. Hosted clean-up scrubs codes and typed names and titles, and is off by default for middle school events. |
| R7 | AI clean-up changes meaning, or adds a harsh or biased line about a student. | Low–Medium | The prompt may only rephrase the judge's words, never add judgments; it is told to drop comments on looks, voice type or identity. The judge sees a word diff and must accept. No auto-run. |
| R8 | Showing time to the speaker breaks local custom. | Low | Speaker view is off by default; the judge turns it on. |
| R9 | NSDA names, rules text or the bias statement used in a way NSDA objects to. | Low | Use event names only as plain descriptions, no NSDA logo, a "not affiliated" line, no copied rules text. See Q6. |
| R10 | Districts ask for a data privacy agreement before use. | Medium (once schools buy) | Prepare answers for the SDPC national agreement; the honest answer is "room data is stored only on the device; text sent for hosted clean-up is processed by an AI provider and not stored". See Q7. |
| R11 | Hosted clean-up costs are tiny per call, so round pricing feels wrong. | High | See Q2. |

## 5. Owner questions (all decided 2026-11-20: option A)

Each has at most 2 options and my pick. **Q2, Q5, Q6 and Q7 touch legal or business ground**; my pick is a default, and a lawyer should confirm before P2 ships.

**Q1. App address.** Fixed forever once public. (Same open question as `docs/architecture/ARCHITECTURE.md` §12 Q2 and `docs/growth/BRAND.md` Q4; one answer closes all three.)
- A. `events.tabulaspeech.com` (matches "Tabula Speech Events"; the architecture already reserves it).
- B. `forensics.tabulaspeech.com` (coach word; parents do not know it).
- **Decided 2026-11-20 (owner): A.** Confirmed 2026-11-24 (owner): keep `events.tabulaspeech.com` as the one app address, and add `forensics.tabulaspeech.com` as a redirect to it, so coaches who type the coach word still land in the app. The redirect is part of launch; it needs the owner's yes before any DNS or Cloudflare change.

**Q2. What a "round" buys in Speech Events.** Clean-up of a 6-speaker room is a small text job. A judge often judges 4–6 rooms a day.
- A. **One round covers one tournament day of rooms** (up to a cap, for example 8 rooms or 12 hours from the first AI call), for hosted clean-up. Same $2 single round and the same passes. This needs an exception to the live Terms limit on hosted AI per round (3 hours, 20 minutes idle; `tabula-cloud/docs/PLAN.md`), because a judging day is longer.
- B. One round per room (simple, but a 6-room day costs as much as 6 recorded debate rounds for far less AI).
- **Decided 2026-11-20 (owner): A.** It is fair and easy to say: "A round is your judging day."
- **Business and legal note:** either option changes published terms. Today a round is defined around a recorded debate speech (reserve at start, commit at the first recorded speech; `tabula-cloud/docs/PLAN.md`), round counts are public (`docs/marketing/LEGAL-FACTS.md`), and BRAND.md §5 says no separate speech pass at first. Speech Events rooms have no recorded speech, so the commit rule needs a new trigger (for example the first hosted clean-up). The Terms and refund pages need a lawyer-checked update before hosted AI opens in Speech Events.

**Q3. Recording in competitive rooms.**
- A. Never in v1. Recording and transcripts are for practice only, with consent (P4). NSDA Nationals has banned recording without written consent (seen in the 2023-24 manual; unverified for 2026-27); some tournaments ban it; interp texts are copyrighted; speakers are minors.
- B. Allow it behind a consent toggle the judge confirms.
- **Decided 2026-11-20 (owner): A.**

**Q4. Speaker view (time signals on the judge's screen, turned to the speaker).** No rule found that bans it; NSDA says speakers should time themselves.
- A. Ship it, off by default; the judge turns it on.
- B. Leave it out.
- **Decided 2026-11-20 (owner): A.**

**Q5. The bias-awareness reminder.** NSDA district ballots must show NSDA's statement.
- A. The app shows our own short, neutral reminder ("Judge the performance, not the person"). The judge can paste the tournament's exact wording into the rules profile. We never ship NSDA's text.
- B. Ship NSDA's statement word for word in the NSDA preset.
- **Decided 2026-11-20 (owner): A.** It avoids copying rules text and stays correct when NSDA updates the wording. (Legal: confirm.)

**Q6. Using NSDA event names and "NSDA" in preset names.**
- A. Use plain event names (Original Oratory, Duo Interpretation) and call presets "NSDA district rules" in plain text, with a "Tabula is not affiliated with the NSDA" line and no NSDA logo.
- B. Ask NSDA for written permission first.
- **Decided 2026-11-20 (owner): A,** with a short trademark read by a lawyer (it can join the "Tabula" trademark search in BRAND.md Q5).

**Q7. Student privacy (minors, some under 13 in middle school).** Judges are adults; students have no accounts in v1. Room data is stored only on the judge's device. Hosted clean-up sends comment text through our Worker to an AI provider, where it is processed and not stored.
- A. Codes by default, names optional and device-only; no student data stored on the server; hosted clean-up scrubs codes and typed names, and is off by default for middle school events (some students are under 13); a lawyer read on COPPA, FERPA and state laws (for example California SOPIPA) and a ready answer for the SDPC data privacy agreement before school marketing.
- B. Codes only, with no name field at all.
- **Decided 2026-11-20 (owner): A.** Names help a judge remember who was who. They stay on the device, unless the judge types one into the notes before a hosted clean-up (the screen warns about this).

**Q8. Congress.**
- A. Phase 5, as its own grid inside the Speech Events app.
- B. Drop it.
- **Decided 2026-11-20 (owner): A.** Congress scoring is the most painful by hand (FORENSICS.md §6), but it is a different machine, so it waits.
- **Changed 2026-11-21 (owner, Q13 B):** still its own grid in the Speech Events app, but it comes right after v1, before league packs.

**Q9. Phase order after v1.**
- A. League packs (P3) before practice and coach tools (P4).
- B. Practice and coach tools first.
- **Decided 2026-11-20 (owner): A.** Packs are mostly data and widen the market to every state. Coach tools need program accounts first.

**Q10. How shared `core/` code loads, with no build step.** Today the app is classic scripts that share globals.
- A. Native ES modules (`<script type="module">`, `import` from `/core/…`). Clean seams, testable with `node --test`, works in every browser judges use. Costs more in the lift, because every debate file changes how it loads.
- B. Classic scripts with one namespace per module (`window.TabulaCore.clock`). Smallest change from today, but globals stay and the coupling is harder to test.
- **Decided 2026-11-20 (owner): A.** The lift touches these files anyway; doing it once with modules avoids a second migration.

**Q11. Middle school Prose and Poetry (7:00; high school is 5:00).** The v1 event fields have no level field.
- A. v1 is high school only. Middle school judges use the Custom rules to set 7:00 for the room.
- B. Add `pro-ms` and `poe-ms` files at 7:00 (19 events).
- **Decided 2026-11-21 (owner): A.**

**Q12. When the `core/` lift starts.** Options and reasons in LANDING.md §5.
- **Decided 2026-11-21 (owner): B.** Lift `core/` now. Then PF and Speech Events are built side by side, both on `core/`. This changes P1 and R2.

**Q13. Where Congress goes.** Options and reasons in LANDING.md §5.
- **Decided 2026-11-21 (owner): B.** Congress (P5) comes right after v1, before league packs (P3). This changes Q8 and the phase table.

**Follow-ups outside this folder (this session may not edit them):**
- `tabula-cloud/docs/PLAN.md`: the cloud session must add the Speech Events round rule (commit trigger, day-window, the time-limit exception) once Q2 is answered.
- `docs/design/AI-POLICY.md` §2a: add `coachSummary`, and widen or split `practiceAI`, before P4.
- `docs/architecture/ARCHITECTURE.md` §10: event files live at `events/defs/<id>.json` (not `events/<id>.json`); the move of today's app into `debate/` is optional.

## 6. Answers to the owner's questions in the request

| The owner asked | Where |
|---|---|
| What it will look like architecturally | ARCHITECTURE.md (host, screens, data, AI, code layout) |
| Which events make the cut for the full forensics set | EVENTS.md §1, §3, §4 (v1), §5 (phase P3 packs), §6 (Congress) |
| What is shared with the underlying engine | SHARED-VS-NEW.md §2 |
| What must be built on its own | SHARED-VS-NEW.md §5 (primitives N1–N14) |
| Shared design philosophy vs new primitives | DESIGN.md §1–§3 (shared), §4 (new, with Mobbin references) |

## 7. How this plan was made

- Base documents in the repo and in `tabula-cloud` were read first (listed in ARCHITECTURE.md).
- Four research helpers ran in parallel and left full notes in the shared notes folder (`speech-events/`):
  - league and event rules from 2026-27 rulebooks (`events-research.md`);
  - ballots, signals, critiques and privacy flags (`ballot-judging-research.md`);
  - 32 Mobbin searches for every unclear UI choice (`mobbin-references.md`);
  - a read-only reuse audit of the debate code (summarized in SHARED-VS-NEW.md).
- No other session was needed: the research was bounded and fed straight into these files.
- Research gaps: no comment character limits found for Tabroom or SpeechWire; no judge-side Joy of Tournaments ballot found; Reddit and coach forums could not be reached; Stoa, NCFL and NFA rule copies are not this season's.
