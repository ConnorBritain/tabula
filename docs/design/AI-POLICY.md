# AI policy: program controls that turn AI off (draft 1)

Date: 2026-11-20. Status: owner decisions made (§8). No app code is changed by this doc.

A school program can decide that some of its people do not get the AI tools. Then Tabula is a flow tool for them, and it must look complete.

Related: `docs/STUDENT-EDITION.md` (§1e judging tools, §5a coach controls, §10 coach edition), `docs/design/SPEC.md` (§2.8 paid-plan states, V9 Insights, §4.5 copy), `docs/design/DECISIONS.md` (Q8, Q11, D2), `docs/architecture/ARCHITECTURE.md` (§1 the rule, §3.2 sign-in, §4 hosted AI, §5 accounts).

---

## 0. The rules in one screen

1. **A policy can only remove a feature. It never adds one.** No admin can turn on a tool that the edition or a tournament rule forbids.
2. **Removed means gone.** No greyed-out button, no lock badge, no "ask your admin", no empty hole. The app looks as if the feature was never made.
3. **The round never needs the server.** The clock, flow and ballot work offline with any policy. A policy only ever turns AI off, so a missing or old policy never blocks the clock, flow or ballot.
4. **One check in the code:** `can(feature)`. Every AI control renders only if it returns true.
5. **No credits are spent for a feature that is off.** The server checks this too, not only the app.

---

## 1. Roles and who sets the policy

| Role | Who | Can set policy? | Is covered by a policy? |
|---|---|---|---|
| **Program admin** | Head coach or the person who owns the program | Yes, for every role in the program | Their own coach policy (they set it) |
| **Coach** | Assistant coach | Only if the admin gives them "can edit AI policy" | Yes (coach role) |
| **Student** | A debater in the program | No | **Yes. This is the main use.** |
| **Program judge** | A parent, alum or student judge that the program brings, on the program's seats or credit pool | No | Only for the program's pool (see 1a) |
| **Hired judge** | A judge a tournament hires, not a program member | No | **No** |
| **Solo user** | Anyone with no program (free, own key, or own paid plan) | Their own settings only | **No** |

### 1a. Judges (decided, §8 item 1)

**Do not let a program turn off a judge's own AI. Let it decide only whether its credit pool pays for judge AI.**

Why:
- Judges are adults who judge for a tournament, not for the program. The tournament's rules govern how they judge, not the school that brought them.
- The judge app's AI is the core product for judges. A program that blocks it makes the judge's tool worse in other programs' rounds too.
- A hired judge has no tie to the program at all.
- The real cost question is money: "Does our pool pay for parent judges' AI?" That is a fair program choice.

So for program judges:
- **Pool pays: on or off** (default on, if the program has a pool).
- When it is off, the judge's app acts like a solo user's app: their own key or their own plan still works. If they have neither, they see the normal free-user invite to connect AI (Q8). That invite is fine here, because the judge *can* have the feature.

**One exception: student judges.** A student who judges a novice round is still a student. See 1b.

### 1b. One person, two roles

**The policy follows the round, not the person.** Each round is opened in one role. That role's policy applies to that round.

- Today the role maps to the app host (ARCHITECTURE §3.2, §3.8): `student.tabulaspeech.com` is the student role, `debate.tabulaspeech.com` is the judge or coach role. Each host has its own session, so the role is never in doubt.
- **A coach who also judges:** the judge host, coach policy (the admin's choice for coaches).
- **A student who also judges** (common at novice tournaments): the judge host, but the account is a student account. The student policy applies, unless the admin turns on **"Student judges may use judge AI"** (default: off). This switch applies **only to judge-host rounds the student judges**, never to the student's own debate rounds on the student host. There the student is a judge, not a debater, so STUDENT-EDITION §1e (which keeps judging tools away from a student *about their own round*) is not crossed.
- **A person in two programs** (for example a coach at two schools): inside a round opened for program A, A's policy applies. In their own rounds, their own plan applies.
- **When the app cannot tell** (signed out, or a round with no program): the app uses the account-wide policy if the account is **managed** (see 2c), else no policy.

---

## 2. The policy model

### 2a. What can be switched

One master switch per role, plus per-feature switches under "More choices".

| Feature key | What it covers | Notes |
|---|---|---|
| `transcription` | Hosted transcription **and** browser transcription, the Record button, the transcript drawer | Also covers the free browser engine. The concern is recording minors and tournament rules, not only cost. |
| `aiFlow` | AI flow view, Live AI flow, doc-to-flow mapping | |
| `liveEval` | Live Eval tab, the Insights pane and edge | Never on for students (§4). |
| `analysis` | Analysis tab, AI-made Round Map | Judge and coach roles only. Never on for students. |
| `ballotDraft` | Draft with AI panel, ballot filler, decision draft | Judge and coach roles only. |
| `evidenceHelp` | AI search of the evidence locker, AI help with docs | Student edition locker; never writes cards. |
| `practiceAI` | Student practice tools: Socratic questions, drills, and the post-closure "What did I drop?" review. In Speech Events: extemp practice questions | Student edition in debate. **This is the one switch for the post-mortem.** Speech Events widens it to coach practice too (events phase P4; `docs/events/ARCHITECTURE.md` §7). It is still one key: a policy that turns it off turns off both. |
| `coachSummary` | Coach ballot summary in Speech Events: repeat themes across a student's past ballots ("4 judges said pace") | Coach role only. Speech Events phase P4. Never ranks or compares students (`docs/events/ARCHITECTURE.md` §7 rule 1). |
| `libraryAI` | Any later AI in the Debate Library | None exists today. See 2e. |

**`recording` is a separate setting, not an AI feature key.** Recording is keeping audio. `transcription` is turning speech into text. In Speech Events, recording is for practice only, with consent. Competitive rooms never record in v1 (`docs/events/PLAN.md` Q3). The platform holds it as a per-role setting (`off` / `practice` / `on`; `tabula-cloud/docs/platform/MODEL.md` §6). Like the keys above, a policy can only turn it down, never past what the product allows.

The new keys follow §0 rule 1: a policy only removes. No admin can turn on `coachSummary`, `practiceAI` or `recording` where the edition or a product rule forbids it.

The master switch **"AI tools: off"** sets all of these to off. "Flow only" is the name the admin sees for it.

`aiSetup` (key paste, model pickers, subscription buttons, welcome AI steps) is **not** a switch. The app derives it: it shows only if at least one AI feature is allowed **and** the user brings their own key (SPEC §2.8: paid users never see it).

### 2b. Defaults

- **Students: no default. The admin must pick** "Flow only" or "Flow + AI clerk" when the program is made. Until the pick is saved, students are in Flow only (fail closed). A school should make this choice on purpose. A default either way would surprise half the schools.
  - "Flow + AI clerk" uses the student-edition defaults (STUDENT-EDITION §5a): AI clerk tools on in practice, off in tournament mode; transcription off in tournament mode.
- **Coaches:** all on.
- **Program judges:** pool pays: on.
- **Student judges may use judge AI:** off.

### 2c. Managed and linked accounts

- **Managed account:** made through the school (students 13 to 17 can only get an account this way or with parent consent; ARCHITECTURE §5). The policy applies to **every round** on that account.
- **Linked account:** a person's own account (for example an 18-year-old senior with their own plan) that joins a program. The policy applies to **program rounds only**. Their own rounds use their own plan.

### 2d. How the policy reaches the app

1. The server **resolves** one feature set per user and role. It is the intersection (AND) of the layers in §4: edition, tournament profile (later), program policy for the role, plan or key.
2. The app gets it with the session, as a small record:
   `{ features: ["aiFlow", ...], programId, role, policyVersion, issuedAt, expiresAt }`. No names.
3. The app caches it in its own origin storage, under the account, for offline use.
4. The app re-reads it at sign-in, at app start, and at the start of each round when online.
5. `expiresAt`: **14 days**. A program can see when its change reaches every device.
6. The app never sends a feature set to the server as proof. The server always checks its own copy (§5). So the record needs no signature: editing the cache only changes what one device shows, and own-key calls are an honest limit anyway (§5).

**Local-first fit:** with no policy, the app is today's app. A policy only removes. So the clock, flow and ballot never wait for it.

### 2e. Debate Library AI

The Library lives on `tabuladebate.com`. It has no account and cannot read the sign-in cookie (ARCHITECTURE §3.5). So it can never know a program's policy.

**Rule: any Library AI is built on the app hosts** (`debate.` or `student.tabulaspeech.com`), where `can('libraryAI')` works. Never on `tabuladebate.com`.

---

## 3. "No taunting": testable UI rules

### 3a. Two questions, two functions

- `can(feature)`: **is this user allowed this feature?** If false, the control is **removed**. Nothing hints at it.
- `ready(feature)`: **is it set up?** If allowed but not set up (a free user with no key), the app may show the normal "Connect AI" invite (Q8). This is not a taunt: the user can have it.

`ready()` is today's `aiReady()` (app.js, about line 1633). `can()` is new and comes first: `ready(f)` is only asked when `can(f)` is true.

**One source of truth.** The resolved feature set (§2d) is the only input. The existing gates become views of it, so they cannot drift:
- `L.hasHostedPlan()` (a stub today, SPEC §2.8) reads the plan field of the same record.
- `aiSetup` (§2a) is derived from it, not stored.
- Pure functions get the answer as a parameter, never read globals: for example `L.insightsMode({allowed: can('liveEval'), aiReady, hideRight})`.

### 3b. Requirements

- **R1. Not rendered, not disabled.** When `can(f)` is false, no control for `f` is visible or reachable: it is never built, or it carries the `hidden` attribute (out of the layout and the accessibility tree). Never `disabled`, never a lock icon, never a tooltip.
- **R2. No holes.** The layout closes the gap. Panes, tabs, cards and menu rows reflow as if the feature never existed.
- **R3. No words about it.** No help text, tour step, palette entry, toast, error or empty state names a removed feature. No "ask your admin", no "managed by your school" next to a missing tool.
- **R4. No calls.** With `can(f)` false, no code path for `f` starts a network call, even from a timer or an old setting (for example `S.autoEval` saved as true).
- **R5. Complete look.** With all AI off, a screenshot of every screen at 1366×768 and iPad landscape passes a design review: no empty card, no lonely divider, no single-tab tab bar.
- **R6. Allowed notices.** Settings → Account may say "Managed by {program}". The one-time key notice in §6c is the only other one. Neither names a feature.

### 3c. Entry points and where each must check

Line numbers are from 2026-11-20 and move while Slice 4 is built. IDs come first.

| Entry point | DOM ids (index.html) | Code that must check | Feature |
|---|---|---|---|
| Settings key paste, Connect, provider list | `#conn-card`, `#key-paste`, `#key-connect`, `#prov-list` | `renderConnections` (~1806), `connectKey` (~1841) | `aiSetup` |
| Remember key | `#remember-keys`, `#remember-help` | goes with `#conn-card` | `aiSetup` |
| Engine selects | `#ai-engine`, `#tr-engine` | `renderConnections` via `P.engineOptions` | `aiSetup` |
| Model pickers | `.model-pick select[data-model-pick]` | `modelPicker` (~1784) | `aiSetup` |
| Subscription buttons and helper | `#sub-box`, `.sub-btn[data-sub]`, `#sub-body` | `checkHelper` (~1909), `renderSubscriptions` (~1923) | `aiSetup` |
| Key backup option | `#backup-keys` | `downloadBackup` (~2734) | `aiSetup` |
| Settings gear label | `#settings-btn` aria "Settings: AI, keys…" | static label | `aiSetup` (label text changes) |
| Welcome screen and "show again" | built by `ask()`; `#show-welcome` | `openWelcome` (~2140), `L.shouldShowWelcome` | `aiSetup`. With no AI allowed, no welcome. |
| One-time "Live updates are off" note | built by `ask()` | `maybeD2Note` (~2171), `L.needsD2Note` | `liveEval` or `aiFlow` |
| Insights pane and thin edge | `#insights`, `#ins-connect`, `#ins-show`, `#ins-update` | `applyPanes` (~127), `L.insightsMode` (logic.js ~1519), `renderInsights` (~2298) | `liveEval`. Needs a 4th mode `none`: no edge; the grid takes the width. |
| Decide → Live Eval | `#tab-eval`, `#auto-eval`, `#eval-go`, `#eval-body` | `runEval` (~2260), `renderEval` (~2333), `scheduleEval` (~2255) | `liveEval` |
| Decide → Analysis, Round Map AI | `#tab-analysis`, `#lens-go`, `#impact-go`, `#map-go` | `runTool` (~2397), `renderAnalysis` (~2437) | `analysis`. Hand-made map parts (`#map-add`, node editor) stay. |
| Draft with AI panel (Slice 4) | new panel inside Ballot | `L.draftPanelState` (logic.js ~1653) and its render | `ballotDraft` |
| Ballot filler, decision draft | `#filler-card`, `#auto-ballot`, `#fill-go`, `#tab-draft`, `#ai-go` | `runBallotFill` (~2662), `renderFiller` (~2681), `#ai-go` handler (~2192) | `ballotDraft` |
| AI flow view, Live AI flow | `#flow-tabs [data-view="ai"]`, `#ai-flow-status`, `#live-flow` | `viewToggle` (~1107), `renderAIFlow` (~1143), `scheduleFlow` (~988) | `aiFlow` |
| Doc → flow mapping | `[data-act="map-docs"]`, doc copy "AI reads them" | `mapDocsNow` (~1132), `reflowForDocs` (~1363) | `aiFlow`. Docs themselves stay. |
| Transcription toggle and drawer | `#rec-on`, `#rb-meter`, `#tr-toggle`, `#tr-drawer`, `#rec-strip`, `#mini-rec`, `#audio-card` | `wantRec` (~552), `startRec` (~654), `showDrawer` (~1050), `renderAudio` (~1961) | `transcription` |
| Reading level | `.seg[data-read]`, `#reading-card` | `renderReadLevel` (~1590) | any AI. Copy says "How the AI writes". |
| Tour steps | tour.js `TOURS` (main, flow, decide, settings) | `tourStart` (~2036) | each step gets a `feature` field |
| Command palette (Slice 5) | not built yet | keys.js registry `palette` entries | each entry gets a `feature` field |
| Help copy, ? menu, About | `#help-menu`, `about.html` | help text blocks | each AI paragraph gets a `feature` tag |
| "One AI call" hints, cost toasts | `#auto-eval`, `#auto-ballot`, `#live-flow`, Insights Update, toasts | go with their parent control | parent's feature |
| AI errors | `L.NO_AI`, `noAiHtml` (~1640), `L.aiErrorText` | `callAI` (~1726) | never shown when `can()` is false |

**Call sites, as a second wall (R4):** `callAI` (~1726), the direct stream in `#ai-go` (`getClaude` ~1652), `transcribeRequest` (~955), the `/models` fetches in `modelFor` and `connectKey`, and the helper path `/api/ai`. Each one checks `can(f)` and returns at once with no UI if false.

### 3d. How the code does it

1. **Mark every static AI control** in index.html with `data-ai="<feature>"` (for example `<section id="tab-eval" data-ai="liveEval">`).
2. **One function, `applyCapabilities(root)`,** sets `hidden` on every `[data-ai]` node whose feature is not allowed, and clears it on the others. It runs before first paint (from the boot script) and again when the policy changes at a round boundary (§6a). Because it hides and does not delete, a feature that comes back at a boundary needs no rebuild.
3. **Markup built in JS** (`renderConnections`, `renderEval`, `renderInsights`, the welcome, and so on) calls `can(f)` in the builder and does not build the part. Re-renders through `aiChanged()` then stay correct. Rule: static markup uses `data-ai`; built markup uses `can()` in the builder. Never both on one node.
4. **Lists get a `feature` field:** tour steps, palette entries, help blocks, settings cards. Pure filters in logic.js (`L.visibleTourSteps(features)`, `L.paletteCommands(features)`) drop them.
5. **Layouts use auto tracks,** so a hidden pane takes no room. `L.insightsMode` returns `none` when its `allowed` input is false.
6. **Tab bars:** if a tab bar would have one tab left (Decide with only Ballot), the bar itself goes and the one view shows alone.

### 3e. The static test

New file `ai-gate.test.mjs`, built like `slice3-static.test.mjs` (reads files as text, `node:test`). It uses fixed lists, not word guesses, so it gives no false alarms. It fails if:

1. **Any id in the AI id list has no `data-ai`** on itself or an ancestor in index.html. The list is the ids in the 3c table, kept in the test file. A new AI control must be added to the list (the review of each slice checks this).
2. **Any `data-ai` value is not a known feature key.**
3. **Any call site in 3c does not call `can('<right key>')`** before its fetch or its start (for example `runEval` must call `can('liveEval')`).
4. **Any tour step, palette entry or help block that targets an id in the AI id list** has no `feature` field.

**The test must be able to fail.** It has a negative case: a small fixture HTML with one untagged AI id must make check 1 fail. And because build step 1 ships `can()` returning true for all, the browser check below runs with `?ai=off`, so the hidden path is really used.

Plus unit tests on the pure parts: `L.insightsMode` returns `none`; tour and palette filters with an empty feature set return no AI items; the resolver (§2d) is an AND and can never add a feature.

Plus a browser check (the DOM test; no new packages): with `?ai=off`, no id from the AI id list is visible, and at 1366×768 the flow grid has the full width (no 32 px edge), Decide has no empty tab, and Settings has no empty card.

---

## 4. Fit with the student and coach editions

**The feature set is an intersection of these layers.** Each layer can only remove, so the strictest always wins and the order cannot change the result. Listed from hardest to softest:

1. **Edition rules** (STUDENT-EDITION §1e, §4c). Hard product rules. Live judging tools are never in the student edition. "What did I drop?" only after round closure. No admin can change these.
2. **Tournament mode and tournament profile.** A tournament can turn off more (for example NCFL: no transcription).
3. **Program policy** for the role.
4. **Plan and credits, or own key.**
5. **The user's own settings** (for example Live AI flow off).

- For students in their own debate rounds, `liveEval`, `analysis` and `ballotDraft` are always off, whatever the program says. (A student who judges someone else's round is covered by §1b.) The admin screen does not show those rows for students at all (the same no-taunt rule, for admins).
- `practiceAI` covers the post-mortem. Closure still locks it until the round is closed; the policy can only remove it.
- STUDENT-EDITION §5a coach controls (modes, transcription in tournament mode, AI clerk in tournament mode, hosted AI pool) become rows of this one policy. Same switches, one screen.
- **Coach edition:** a coach running a practice round or review for a student uses the coach's device and the coach policy. The tools a student cannot have stay on the coach's screen, with a person leading the talk (STUDENT-EDITION §1e).

---

## 5. Billing and credits

- **The server enforces the policy.** The hosted AI path (ARCHITECTURE §4, step 2) adds a check: is `f` allowed for this user and role under the current policy? If not, it answers `403 policyOff` **before** the meter reserves anything. No credit is spent.
- **Pool credits are never reserved** for users whose AI is off.
- **Own-key calls** never touch the server, so the server cannot block them. The app blocks them with `can()` (R4). Honest limit: a changed copy of the open-source app could skip that. The same limit is in STUDENT-EDITION §7. The program rule and the tournament rule still apply to the person.
- **Plans:**
  - A "Flow only" program spends no credits on those users. Seat pricing for Flow-only users is a later question (§8, Later).
  - Turning AI off costs nothing to run. **The AI policy is also in the free school space** (owner decision). A school should never have to pay to make the app *less* able. This **amends** STUDENT-EDITION §10g, which lists only join code, track assignments and badges for the free space (decided, §8 item 4).
  - A linked user's own plan (for example a Pass) is not charged in program rounds where AI is off. What happens to unused personal credits follows the plan's normal rules (private business plan).

---

## 6. Edge cases

### 6a. Policy change mid-round

- **The app applies a change at the next round boundary,** not mid-round. Panes do not jump while a judge flows or a student speaks.
- **The server applies "off" at once** for hosted calls, so no credit is spent from the moment the admin saves.
- **What the user sees if a hosted call is refused mid-round:** the AI part stops quietly. It shows its last result, with no error and no new run. At the round boundary it is removed.
- **"On" changes** also wait for the boundary, so a tool does not appear mid-speech.

### 6b. Offline with a cached policy

- The app uses the cache. The round runs as normal.
- **Expiry is checked only at app start and round start,** never mid-round. A cache that ages out during a round changes nothing until the next round.
- **Cache expired and offline at that check:** a managed account uses **Flow only** until it can check again (fail closed for students). AI cannot run offline anyway, so the user loses nothing.
- **No cache and no network** (a new device): managed accounts start in Flow only. Solo users are not affected.

### 6c. Own-key user joins a program that bans AI

- **The key is never deleted by Tabula.** It belongs to the user.
- **While the policy applies** (every round on a managed account; program rounds on a linked account), the app does not load the key into memory, does not show it, and makes no call with it. Settings has no key card.
- **At join, once:** "Your saved key is paused in {program} rounds. It stays on this device. [Remove it] [Keep it]". Then never again. It names no feature; it is about the user's own property (decided, §8 item 3).
- **When they leave the program**, or in their own rounds on a linked account, the key works again.
- Keys are not remembered by default (D1), so most keys are gone at the end of the tab anyway.

### 6d. Shared computers

- The policy follows the **signed-in account**, never the device.
- **Sign-out** clears the cached policy, the in-memory key, and the session. The next person starts clean.
- **School Chromebooks:** a device policy that works when signed out is possible later (§8, Later).
- Honest limit: on an unmanaged shared computer, a student who signs out is a solo free user. The policy governs accounts, not machines.

### 6e. Audit

- Server table `policy_events`: `program_id`, actor account ID, time, role, feature, old value, new value, `policyVersion`. No student names, no content.
- **Admins and coaches** of the program can read the log: who changed what, and when.
- **Students** can see their own current feature set only through the app itself. They see no log.
- Kept for the program's retention period (120 days after the season, STUDENT-EDITION §10i), then deleted. It holds no student data, so a longer period is possible if schools ask.
- Each resolved feature set carries `policyVersion`, so a support question ("Why did AI vanish on Tuesday?") maps to one log line.

---

## 7. Build order

1. **Now, no server:** add `can()` that returns true for all, `data-ai` marks, `applyCapabilities`, the `none` Insights mode, and `ai-gate.test.mjs`. A dev switch (`?ai=off`) proves the Flow-only look. This is safe and useful alone: it is also the base for the paid-plan states (SPEC §2.8).
2. **With accounts:** the signed feature set, the cache, the server `policyOff` check.
3. **With coach step 3** (programs and join codes): the admin screen and the audit log.
4. **With the student edition:** the edition rules as the first layer.

Step 1 changes app files. Slice 4 owns them now, so it waits.

---

## 8. Decisions (owner, 2026-11-20)

1. **Judges: DECIDED — a program decides only whether its pool pays for judge AI.** It never turns off a judge's own key or own plan (§1a).
2. **Student default: DECIDED — the admin must pick** "Flow only" or "Flow + AI clerk" at setup. Until then, students are in Flow only (§2b).
3. **Own-key notice: DECIDED — one quiet notice** with "Remove it / Keep it", shown once at join (§6c).
4. **Free school space: DECIDED — the AI policy is in the free school space too** (§5). STUDENT-EDITION §10g is amended to match.
5. **Mid-round change: DECIDED — the app waits for the round boundary.** The server stops hosted calls at once (§6a).
6. **Student judges: DECIDED — "Student judges may use judge AI" is off by default** (§1b).

**Later (not needed now):**
- Seat price for Flow-only users: free, or lower.
- A school Chromebook device policy through Chrome's Managed Configuration API, so AI stays off even when signed out.
