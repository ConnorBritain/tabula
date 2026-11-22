# Tabula Speech Events: architecture (draft 1)

Status: plan for owner approval, 2026-11-20. No code is built. Nothing in Cloudflare, Stripe or DNS changed.

Related files in this folder: [EVENTS.md](EVENTS.md) (which events, their rules), [SHARED-VS-NEW.md](SHARED-VS-NEW.md) (reuse and new parts), [DESIGN.md](DESIGN.md) (look and components), [PLAN.md](PLAN.md) (phases, risks, questions).

Base documents: `docs/growth/FORENSICS.md` (first scope), `docs/growth/BRAND.md` (names, domains, marks), `docs/architecture/ARCHITECTURE.md` §10 (the app's place in the stack), `docs/design/AI-POLICY.md` (AI off switches), and the cloud plan in `~/Code/tabula-cloud/docs/`.

## 1. What the app is

**Tabula Speech Events is a judge's room tool for individual speech events.** One judge, one room, 4 to 8 speakers. The judge times each speaker, writes comments for each, and ranks them all with no ties. Then the judge copies the result into the tournament's online ballot (Tabroom, SpeechWire or Joy of Tournaments), or prints it.

It is **not** a tab system. Tabroom and SpeechWire run the tournament. Tabula helps the person in the room.

Who it is for, in order:

1. **Lay judges** (parents, community members). They are most speech judges. They need a calm, simple tool that tells them the rules as they go.
2. **Experienced judges and coaches** who judge many rooms in a weekend and want speed.
3. **Coaches and students in practice** (phase P4): a practice timer, recording and transcripts, and a ballot box of past comments.

The one-line promise: **"Time it, note it, rank it, copy it. Kindly."**

## 2. The rule we keep

The same rule as Tabula Debate (`docs/architecture/ARCHITECTURE.md` §1):

**The room never needs the server.** The timer, the comments, the ranks, the review and the copy work with Wi-Fi off. Speech rooms are often in old school buildings with weak Wi-Fi. A server only adds things: hosted AI, the account, the school's AI policy.

Three tests for every feature:

1. Does a room still finish if the server is down? It must.
2. Does it store a student name, a comment, audio or a transcript on the server? It must not.
3. Can a free user with no account use it? If it does not need a server by its nature, yes.

## 3. Where it lives

| Part | Address | Note |
|---|---|---|
| The app (PWA) | **`events.tabulaspeech.com`** (recommended; see PLAN.md Q1) | Fixed forever from its first public day. Browser storage belongs to one address. |
| Marketing and learning pages | `tabulaforensics.com` | A "coming later" page now. Judge guides per event later. |
| Account, sign-in, plans | `tabulaspeech.com` | The same account and wallet as Tabula Debate. |
| Hosted API | `/api/v1/` on the app's own host | Same Worker as debate. The Worker will serve `events.` once it is added to the host and return-URL lists (planned in `docs/architecture/ARCHITECTURE.md` §3.2). |
| Code | Same public repo, new `events/` folder, shared `core/` folder | See §8. |

Why its own subdomain and not a mode in the debate app:

- It is a different machine: no flow grid, no sides, many speakers, a rank ballot.
- Judges who judge both debate and speech sign in once (the cookie is on `tabulaspeech.com`), so a second host costs them nothing on accounts.
- The cost: an own-key user types the AI key once per app. Paid users never see keys.

Why `events.` and not `forensics.`: the public name is "Tabula Speech Events" (owner decision). Parents do not know the word "forensics". `docs/architecture/ARCHITECTURE.md` §3.2 already reserves `events.` in the return-URL list and the domain map.

## 4. How it sits beside Tabula Debate

```
                    tabulaspeech.com  (account, plans, sign-in, badges, /v/:id)
                           │  one session cookie, Domain=tabulaspeech.com
          ┌────────────────┼──────────────────┬──────────────────────┐
debate.tabulaspeech.com  events.tabulaspeech.com   student.tabulaspeech.com (later)
  Tabula Debate app        Tabula Speech Events      student edition
          │                      │
          └──── both load ───────┘
               core/  (clock engine, storage, export, dialogs, toasts,
                       keys, AI client, policy gate, tokens; recording in P4)

   Same Worker on every app host:  /api/v1/auth  ai/:task  stt  billing  coach
   Same D1:  users, memberships, programs, program_policy, ledger, usage
```

- **One account, one wallet.** Rounds bought in Tabula Debate spend in Speech Events. Every debit carries `productLine: 'events'` (`docs/architecture/ARCHITECTURE.md` §9), so revenue splits by line.
- **One program, both products.** A school's program has `product` = `debate`, `speech` or `both` (cloud plan `ACCOUNTS-AND-ROLES.md` §2). A judge invited by a speech program lands on the account page and sees "Open Speech Events".
- **One AI policy.** The same `can(feature)` gate and the same resolved feature set. Speech Events adds two feature keys (§7).
- **Separate device storage.** Each app keeps its own rooms or rounds, settings and keys on its own origin. Nothing is shared through the browser.

## 5. Screens

Seven screens in v1. The flow is a straight line: set up, judge, rank, review.

| # | Screen | What the judge does | Notes |
|---|---|---|---|
| 1 | **Rooms** (home) | Sees today's rooms and past rooms. Starts a new room. | A list grouped by tournament day. Each row: event, round, entries, state (set up, judging, ranked, copied). |
| 2 | **Room setup** | Picks the event, round and flight. Adds entries by code, in speaking order. | Paste from the Tabroom or SpeechWire assignment text. One screen. The event sets the time limit, grace and checks. |
| 3 | **Room** (the main screen) | Taps a speaker, starts the timer, writes notes, adds quick tags, marks the time. Moves to the next speaker. | Roster on the side (or top on a phone); the current speaker's timer and comment sheet in the center. |
| 4 | **Speaker view** | Turns the screen to the speaker to show time signals. | Full screen, huge numbers or signal card. Optional; off by default (PLAN.md Q4). |
| 5 | **Rank** | Puts the speakers in order 1 to N. Adds ratings if the tournament uses them. | Drag, or tap a rank. No ties possible. An over-grace speaker cannot sit at rank 1 (where that rule applies). |
| 6 | **Review and copy** | First copies the **ranks and ratings** (the tournament wants these about 5–10 minutes after the last speaker). Then reads each speaker's card (comments, reason for rank) and copies each into the online ballot. Prints. | Two stages, because Tabroom and SpeechWire lock ranks on submit but keep comments open until the tournament ends. "Clean up my comments" (AI, optional) lives here, one speaker at a time, with review before it goes in. |
| 7 | **Settings** | AI, account, theme, tournament rules profile. | From the shared shell. |

Phase P4 adds **Practice** (coach and student timer, recording, transcript, time-use report) and the **Ballot box** (past comments by student and event). Phase P5 adds the **Congress grid**; it comes right after v1, before P3 and P4 (PLAN.md Q13 B). See PLAN.md.

## 6. Data

All room data is stored on the device (IndexedDB through the shared storage module). The server stores none of it. The one exception in transit is the text of a hosted clean-up call (§6.4), which is processed and not stored.

### 6.1 Event definitions (data files, shipped with the app)

One file per event: `events/defs/<id>.json`, versioned like debate format files (`docs/architecture/ARCHITECTURE.md` §9). Old versions are kept forever, so an old room opens with the rules it was judged under.

**v1 fields only.** Following the debate rule (`docs/architecture/ARCHITECTURE.md` §9: build the schema from what exists, add a field when the next format needs it), v1 has only the fields the 17 v1 events use. Later fields are listed below the table as a reference, not built.

| Field | Holds | Example (Original Oratory) |
|---|---|---|
| `id`, `version`, `name`, `short` | Identity | `oo`, 1, "Original Oratory", "OO" |
| `category` | `publicAddress`, `interp`, `limitedPrep` | `publicAddress` |
| `performers` | 1 or 2 (Duo) | 1 |
| `timing.limit` | Seconds | 600 |
| `timing.inRoomPrep` | true for impromptu: prep happens in the room, timed by the judge | false |
| `timing.sharedClock` | true if prep and speech share one limit (NSDA impromptu: 7 min total) | false |
| `material` | `memorized`, `manuscript`, `noNotes` | `memorized` |
| `checks` | Rule check ids (EVENTS.md §7) | `quoteLimit`, `noVisualAids` |
| `prompts`, `tags` | Comment prompts and quick-tag chips | structure, evidence; "clear thesis" |
| `source` | Rule source and season | "NSDA Unified Manual 2026-27" |

Grace is not an event field in v1: every v1 event uses the rules profile's grace (30 s for NSDA).

**Added later, only when a pack needs them (P3 and after):** `timing.min` (Kansas Improvised Duet 4:00), `cx` (extemp cross-ex in elims), a second run (Pro Con Challenge), `timing.window` (radio, IHSA 4:50–5:05), group `performers` ranges, rubric criteria. Each comes with a schema test.

Adding an event is a data file and a review, not new code. This is why the v1 event list in EVENTS.md can be long. **A "Custom event" form** lets a judge set the limit and grace for any local event not in the list.

### 6.2 Tournament rules profile (data, chosen per room)

Rules that change by tournament, not by event:

**v1 fields only:**

| Field | Values | Default |
|---|---|---|
| `rating` | `none`, a points range (min, max, step), or a word scale given best first in the tournament's own order (states disagree: Utah puts "Superior" on top; Missouri puts "Excellent" above it) | `none` |
| `ratingNoTies` | No two entries may share a rating (many invitationals ask this) | off |
| `rankRatingRule` | off, or "a better rank needs an equal or higher rating" | off |
| `overtime.grace` | Seconds | 30 |
| `overtime.effect` | `noFirst` (NSDA: the judge may not rank an over-grace speaker 1st) or `flagOnly` (the tab room applies any penalty; the app shows the flag and a note) | `noFirst` |
| `biasNote` | Text of the tournament's reminder, pasted by the judge or coach; our own short neutral line if empty (PLAN.md Q5) | our line |

Ranks always run 1 to N for the room (truncation is the tab room's job). Every room has comments per speaker plus a reason for rank. In every case the app records the time and an "over time" flag, because Tabroom has an overtime box.

**Added in P3 with league packs, as reference only:** other overtime effects (`dropRanks(n)`, `dropRankPer30s`, `lastPlace`, `disqualified`, `noTopRating`, `judgeChoice`), who applies them, the NSDA panel-must-agree reminder, top-N rank caps (MIFA), signal styles. League rules: [EVENTS.md](EVENTS.md) §5.1.

Presets: **NSDA district**, **NSDA-style invitational**, **Custom**. A coach can share a profile as a short link (phase P3). Exact preset values come from EVENTS.md.

### 6.3 A room (the record the judge makes)

```
Room {
  id, createdAt, updatedAt,
  productLine: 'events',
  eventId, eventVersion,              // rules frozen at setup
  profile: { ...rules profile },      // copied in, so later edits do not change old rooms
  tournament?, round, flight?, roomLabel?,
  programId?,                         // "Judging for" (AI policy and pool), never shown to students
  state: 'setup' | 'judging' | 'ranking' | 'review' | 'done',
  entries: [ Entry ],
  reasonForRank?: string,
  copiedAt?
}

Entry {
  id, code,                           // "A12": the default; names are optional
  name?, title?, author?,             // optional, device only
  order,                              // speaking order
  status: 'waiting' | 'speaking' | 'done' | 'noShow',
  timing: { startedAt?, runs: [...], usedMs, prepMs?, overLimit, overGrace },
  notes: string,                      // the judge's own words, as typed
  tags: [tagId],
  checks: { [checkId]: 'ok' | 'flag', note? },
  comment: string,                    // the text that goes on the ballot
  commentSource: 'judge' | 'judgeEditedAi',
  rank?, rating?
}
```

- **Codes first.** The app asks only for entry codes by default. Names, piece titles and authors are optional and stay on the device. Online ballots already show codes.
- **The clock state is refresh-safe.** It is stored as start times, not a running count, using the debate clock engine (spec 1.1). A sleep or reload resumes the right time.
- **Undo for every destructive action** (remove an entry, clear a rank), through the shared toast.
- **Export and import** as a file, like debate. One file can hold many rooms.

### 6.4 What may reach the server

| Data | Server? | Why |
|---|---|---|
| Account, membership, program, AI policy | Yes | Already in D1. |
| Usage per AI call: room ID (a random ID with no tournament name in it), task, tokens, credits | Yes | Billing. No text, no codes, no names. |
| The text for "Clean up my comments" | **Processed, never stored.** It passes through our Worker to an AI provider (logging off) and back. | Hosted AI path, same as debate (`docs/architecture/ARCHITECTURE.md` §4). Before the call, the app replaces codes with "Speaker 1..N" and also scrubs any name, title or author the judge typed in setup for that room. Free text can still hold a name the judge typed only in the notes; the clean-up screen says so. For middle school events, hosted clean-up is off by default (own key or none), pending the legal read in PLAN.md Q7. |
| Room summary (event, round, date, entry count) | Opt-in later | Matches the debate "round summaries" decision (`ACCOUNTS-AND-ROLES.md` §7.1). No codes, no names, no comments. |
| Stored comments, names, codes, audio, transcripts | **Never stored** | Minors. Same promise as debate. |

## 7. AI in Speech Events

AI is **optional and small**. The app is complete without it.

| Feature | Policy key | What it does | Where |
|---|---|---|---|
| Clean up my comments | `ballotDraft` (reused) | Turns the judge's own notes and tags into clear, kind, specific comments for the student. Never adds praise or faults the judge did not write. Never ranks. The judge sees the draft beside the notes and accepts, edits or drops it. | Review screen, per speaker |
| Practice transcription | `transcription` (reused) | Transcript of a practice speech. | Practice only (phase P4) |
| Coach ballot summary | `coachSummary` (new; must be added to `docs/design/AI-POLICY.md` §2a before P4) | Repeat themes across a student's past ballots ("4 judges said pace"). | Ballot box (phase P4) |
| Extemp practice questions | `practiceAI` (AI-POLICY.md defines it for the student edition only; P4 must either widen it to coach practice there or add an events key) | Draws practice questions. | Practice only (phase P4) |

Hard rules, in the code and in the server prompt templates:

1. **No AI ranking, rating or "who won".** No prompt may ask for a rank or a comparison between speakers.
2. **No AI in the room while a speaker speaks.** Clean-up runs on the Review screen, after ranking.
3. **No recording in competitive rooms in v1.** Recording is for practice only, with consent (PLAN.md Q3).
4. **Policy removes, never adds** (`docs/design/AI-POLICY.md` §0). With AI off, the Review screen simply has no AI button, and no hole.

Prompt templates are written fresh for Speech Events. No debate prompt is reused (license note in `docs/architecture/ARCHITECTURE.md` §8). **One source, no drift:** the templates live in `events/prompts/` and the event files in `events/defs/`. The server copy is generated from those files at deploy, as debate does for format files (`docs/architecture/ARCHITECTURE.md` §9). The client sends `task`, `eventId` and `eventVersion`, never prompt text. A drift test compares the two copies. An unknown version gets "Reload the app".

## 8. Code layout

Same public AGPL repo. No build step.

```
core/        shared by debate, events and (later) student. Generic words only (see the test below).
  clock.js        engine: runs, pause, resume, refresh-safe restore
  storage.js      IndexedDB wrapper, export and import files
  ui.js           ask() dialog, toasts with Undo, tooltips
  keys.js         keyboard registry, palette entries
  providers.js    AI providers, own-key client
  hosted.js       hosted AI client (/api/v1/ai), meter messages
  policy.js       can(feature), ready(feature), applyCapabilities()
  ranks.js        move-rank and ranking state for N items, full or top-N (debate ranks use it too)
  points.js       points range, range error, stepper (step C9)
  review.js       AI review diff: field locks, word diff, accept or undo
  recording.js    mic, clip queue, transcription: lifted in P4 only, when practice needs it
  tokens.css      design tokens
debate/      today's app
events/
  index.html
  js/        rooms, setup, room, timer-face, signals, comments, rank, review, practice (phase P4)
  defs/      event definitions, all versions
  profiles/  tournament rule presets
  prompts/   own-key prompt templates
```

- **Order of work** (from `docs/architecture/ARCHITECTURE.md` §10.3): pull out `core/` only when `events/` starts. Use the seams the debate format refactor makes.
- **A static test** checks `core/` against an explicit banned-word list. Debate words: `aff`, `neg`, `flow`, debate speech IDs (`1AC`, `2NR` and so on). Events words: `room`, `entry`. Generic words such as `rank`, `points`, `feature` are allowed, because both products use them.
- **How `core/` loads, with no build step:** this is decided in P0 (PLAN.md Q10). Today the app is classic scripts sharing globals.
- **Moving today's app into `debate/`** changes the live host's paths, `check-publish.mjs` and the `learn/` links. It is optional: `core/` can be lifted while the debate app stays at the repo root. PLAN.md R1 covers it.
- **The no-stripes test** and the tokens test also run on `events/`.

## 9. Accounts, billing and programs

- **Sign-in, wallet, plans:** shared. New on the server for v1: the `productLine` field, the AI task `events.cleanup`, and the round rule chosen in PLAN.md Q2. Q2's pick needs a cloud change: a new commit trigger (the first hosted clean-up call, since rooms have no recorded speech; today a round commits at the first recorded speech, `tabula-cloud/docs/PLAN.md`), and, for option A, a day-window and room cap in the meter.
- **What one "round" means in Speech Events** is a pricing choice. Clean-up of a 6-speaker room is a small text job, far cheaper than a recorded debate round. See PLAN.md Q2.
- **Programs:** the private program pricing plan already has a Speech Events add-on (details stay private). The judge's "Judging for" picker (cloud plan step 3) is reused in Room setup.
- **Plan rules live on the platform, not in the app.** The shared school and admin platform (design in `~/Code/tabula-cloud/docs/platform/`, owned by another session) serves one capabilities API with `product = "events"`. The app reads it and never decides plan rules itself. Speech Events asked that platform for: shared rules profiles per program (P3), a default league pack per program, a separate `recording` key (practice only, with consent), the task names above, and a round model that can hold a day-window (Q2). The platform has accepted all of these (`tabula-cloud/docs/platform/MODEL.md` §4, §6). The app reads `GET /api/v1/me/capabilities?v=2&product=events` (`CONTRACTS.md` §2, §5). The platform maps `programs.product = "speech"` to API product `events`.
- **Hired judges and solo judges** use their own account or none. A school's policy never covers them (`docs/design/AI-POLICY.md` §1a).

## 10. Offline, install and devices

- **Service worker** from day one, so the app opens with no network. (Debate adds one in its own plan step 8; Speech Events should not ship without one.)
- **Devices:** laptop, iPad and phone. The phone layout is a first-class target, because many lay judges only have a phone.
- **Keep the screen awake** while a room is open (Screen Wake Lock API, where the browser supports it).
- **Battery and quiet:** no sounds by default. An optional soft vibration on phones at each signal.

## 11. Security

The same rules as every `*.tabulaspeech.com` host (`docs/architecture/ARCHITECTURE.md` §3.2):

- No third-party scripts, embeds or analytics.
- `script-src 'self'` CSP.
- CSRF: `Origin` equals the host, plus the `X-Tabula: 1` header.
- Keys are not remembered by default.

## 12. What this plan does not cover

- Tournament running, pairing or tab (Tabroom and SpeechWire do this).
- A link to Tabroom's API. Tabroom has no public judge-side API we could confirm. Copy and paste is the v1 path.
- Script or piece storage (copyright and size).
- Extemp article filing (Prepd and Extemp Genie already do it).

## Sources

- Base plans: `docs/growth/FORENSICS.md`, `docs/growth/BRAND.md`, `docs/architecture/ARCHITECTURE.md`, `docs/design/AI-POLICY.md`, `~/Code/tabula-cloud/docs/ACCOUNTS-AND-ROLES.md`, `~/Code/tabula-cloud/docs/PLAN.md`.
- Event rules: see EVENTS.md.
- Screen Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
