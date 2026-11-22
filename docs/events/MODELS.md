# Tabula Speech Events: object, data and design models (draft 1)

Status: plan for owner approval, 2026-11-21. No code changed.

This file answers the owner's request of 2026-11-21: "think through the object, data, and design models" for every event family. It builds on [ARCHITECTURE.md](ARCHITECTURE.md) §6 (data), [SHARED-VS-NEW.md](SHARED-VS-NEW.md) §5 (primitives N1–N14) and [DESIGN.md](DESIGN.md) §4 (components). It does not repeat them. The event list and the app split are in [CATALOG.md](CATALOG.md). The build order is in [LANDING.md](LANDING.md).

Three words, used the same way in this file:

- **Object model:** the things the app knows about, and how they relate. For example, "a room holds entries".
- **Data model:** the fields each thing stores, in files and on the device.
- **Design model:** what the judge sees and does on screen.

## 1. The families

An **event family** is a group of events that share one shape on screen and in data. Events inside a family differ only in data (time, checks, prompts). A new family needs new code. A new event inside a family needs only a data file.

| # | Family | Events (high school) | Status | New primitive |
|---|---|---|---|---|
| F1 | **Prepared, solo or pair** | OO, INF, EXP, OSW, DI, HI, DUO, POI, PRO, POE, STO, DEC; state events with the same shape (Duet Acting, Original Advocacy, After-Dinner, Great Speeches, …) | Data done: 12 of the 17 files in `events/defs/` | None past v1 (N1–N5, N7–N13) |
| F2 | **Limited prep, prep outside the room** | USX, IX, COM, MX; UIL Informative and Persuasive Extemp; extemp variants | Data done: 4 files | A drawn-question field; a staggered roster. Later: a cross-ex run (elims), a note-card rule |
| F3 | **Limited prep, prep inside the room** | IMP; CHSSA, IHSA, Kansas Impromptu; Kansas Improvised Duet; Iowa Spontaneous | Data done: 1 file | In-room prep phase (N6). Later: a separate prep cap, a minimum time |
| F4 | **Two runs in one entry** | NSDA Pro Con Challenge | Not started | A run list in the event file |
| F5 | **Other ballot shapes** | Rating-only (Iowa, Kansas festivals); top-N ranks (MIFA); rubric grids (NCFCA, Stoa) | Not started | Rules-profile fields, not new screens (§4.5) |
| F6 | **Congress** | House, Senate, Final Session; scorer and parliamentarian | Not started | A new machine: session, docket, speech log, PO terms, top-N ranks (N14) |
| F7 | **Group events** | Readers Theatre, Ensemble, Choral Reading, One-Act | Not planned | Group entries, long limits |
| — | **Debate events** | Policy, LD, PF, World Schools, Big Questions, Extemp Debate, Parli | **Tabula Debate, not this app** | Format files in `formats/` ([CATALOG.md](CATALOG.md) §3) |

F1 to F3 make up the 17 v1 events. F4 and F5 come with league packs (PLAN.md P3). F6 is Congress (PLAN.md P5, right after v1 by Q13 B; [LANDING.md](LANDING.md) §5).

## 2. Shared objects

The owner asked to name the shared objects. "Shared" has two levels:

- **Shared code** lives in `core/` and both apps load it. It uses generic words only (the banned-word test, ARCHITECTURE.md §8).
- **Shared pattern** means both apps use the same idea, but each app keeps its own record type. Records stay apart because a debate round and a speech room have different shapes. Forcing one record type on both would put debate words into speech code, or the other way round.

| Object | Level | In Tabula Debate | In Speech Events | `core/` module |
|---|---|---|---|---|
| **Versioned definition** (a rules file that never changes once published) | Shared code | Format file (`formats/ld.v1.js`) | Event file (`events/defs/oo.v1.json`), Congress chamber file (§4.6) | `core/defs.js` (new; lifted from `logic/format.js`) |
| **Clock run** (start, stop, runs, wall-clock restore) | Shared code | Speech and prep clocks | Speech, prep, cross-ex and question runs | `core/clock.js` |
| **Limit and grace stage** (under, last stretch, in grace, over grace) | Shared code | Not used today (debate has no grace) | Every timed run | `core/clock.js` |
| **Rank list** (1 to N, no ties, optional top-N cap) | Shared code | Speaker ranks (4 speakers in policy) | Room ranks (4–8); Congress top 8 of up to 30, or the full chamber | `core/ranks.js` |
| **Points range and stepper** | Shared code | Speaker points | Ratings; Congress points per speech and per PO hour | `core/points.js` |
| **Review diff** (field locks, word diff, accept or undo) | Shared code | AI ballot draft | AI comment clean-up, one group per entry | `core/review.js` (the AI client is a separate `core/ai.js`) |
| **Store, backup file** | Shared code | Prefix `policyJudge.*` | Prefix `tabulaEvents.*` | `core/store.js` |
| **Dialog, toast with Undo, keys, palette** | Shared code | Today's `ui.js`, `keys.js` | Same | `core/ui.js`, `core/keys.js` |
| **AI policy gate** | Shared code | `canUse(gate, f)` and the gate helpers in `logic/caps.js` | Same, with `product=events` | `core/policy.js` |
| **Room / round** (the record the judge makes) | Shared pattern | Round | Room (F1–F5), Session (F6) | None |
| **Entry / speaker** | Shared pattern | Two sides, fixed speakers | 4–8 entries, any order; Congress legislators | None |
| **Ballot** | Shared pattern | Winner, points, speaker ranks | Ranks, ratings, comment per entry, reason for rank | None |
| **Rules profile** | Shared pattern | `format.ballot` plus the tournament points range | `events/profiles/*.json` (ARCHITECTURE.md §6.2) | None |
| **Timer face** | Not shared | Policy clock bar | Big digits, stage fill, signal chips (DESIGN.md §4.2) | None |

**Two new shared modules are not in SHARED-VS-NEW.md yet.**

- **`core/defs.js`.** The generic part of the debate format registry in `logic/format.js` (freeze, find by id and version, newest version, never drop an old version) is what event files need too. Only that part moves. The debate-only parts of `logic/format.js` stay in debate, and each app passes in its own `prepare` step (LANDING.md C1). Debate formats, event files and Congress chamber files all load through it. This avoids a second copy in the events loader.
- **`core/points.js`**, split from ranks: a rank list and a points range change for different reasons.

## 3. Object model

```
Event file ─┐                      Chamber file ─┐
Rules profile┤ copied in at setup    Rules profile┤ copied in at setup
            ▼                                    ▼
          Room ── has 1..8 ──> Entry           Session ── has 1..30 ──> Legislator
            │                   │  has 1..n Run   │  has 1..n Legislation (docket)
            │                   │  has Comment    │  has 0..n SpeechRecord ──> Run (speech), Run (questions)
            │                   │  has Checks     │  has 0..n POTerm
            │                   │  has Rank?      │  has Ranks (top N)
            │                   │  has Rating?    │
            ▼                   ▼                 ▼
         Review cards → copy text, print sheet (both)
```

Rules for every family:

1. **Frozen at setup.** A room or session copies its event or chamber file id and version, and a full copy of the rules profile. Later edits never change an old record. This is the debate rule for format files (`docs/architecture/ARCHITECTURE.md` §9).
2. **Runs, not counters.** All time is stored as runs with wall-clock start and stop times. A reload rebuilds the clock. A run has a `kind`: `speech`, `prep`, `cx` (later), `questions` (Congress).
3. **Sticky over grace.** Once a run passes grace, the entry keeps the flag until the judge clears it on purpose (DESIGN.md §4.2).
4. **Codes first.** Entries and legislators are codes by default. Names stay on the device (PLAN.md Q7).
5. **The app never ranks.** AI never ranks, rates or compares (ARCHITECTURE.md §7).

## 4. Family models

Each family lists the object, data and design changes past v1. "v1" means what ARCHITECTURE.md and DESIGN.md already specify.

### 4.1 F1. Prepared, solo or pair (v1, done in data)

- **Object:** Room, Entry, one `speech` run per entry.
- **Data:** the v1 event file fields (ARCHITECTURE.md §6.1). Interp entries may hold `title` and `author` (device only).
- **Design:** v1 screens 1–7. Duo is one entry with two performers: one row, one rank, one comment.
- **Open point:** state duet events where partners face each other (TFA Duet Acting) differ from Duo only in checks. They are data, not code.

### 4.2 F2. Limited prep, prep outside the room

- **Object:** as F1, plus a **drawn question** on each entry. Speakers arrive one at a time, about 7 minutes apart (EVENTS.md §3).
- **Data:**
  - Entry: `question?: string`. The judge types it or the speaker reads it out. It feeds the comment ("You answered the exact question"). It stays on the device. It never goes to hosted AI with a code beside it.
  - Event file, later: `timing.cx` (seconds of cross-ex after the speech, elims only: NSDA Nationals, CHSSA, TFA, OSDA); `material: 'noteCard'` with a card count (UIL one card; the NSDA district pilot). Each field comes with its pack and a schema test.
- **Design:**
  - The roster starts with every entry "Waiting". The next entry to arrive is not always the next in the list. One tap on any row starts that speaker (already in DESIGN.md §4.1).
  - The comment sheet shows a one-line "Question" field at the top.
  - Later: after the speech run stops, a "Questions 3:00" run starts on tap. The roster row shows both times.

### 4.3 F3. Limited prep, prep inside the room

- **Object:** as F1, plus a `prep` run before the `speech` run on the same entry (N6).
- **Data:**
  - v1: `timing.inRoomPrep`, `timing.sharedClock` (NSDA: 7:00 for prep and speech together).
  - Later: `timing.prepMax` (CHSSA 2 minutes prep, then a 5 minute speech; IHSA 2 + 6; Kansas 5 + 5) and `timing.min` (Kansas Improvised Duet, 4:00 minimum). Entry: `topic?: string`.
- **Design:** the two-step bar "Prep → Speech" above the digits (DESIGN.md §4.2). With a separate prep cap, the prep step shows its own count-down and a soft cue at the cap. With a minimum time, the timer card says "Under minimum" until the minimum passes. That is a word, not a color.

### 4.4 F4. Two runs in one entry (Pro Con Challenge)

- **Object:** one entry, two `speech` runs ("Pro" and "Con"), one rank.
- **Data:** event file `runs: [{ id, label, min, max }]` and `timing.total`. The research found the rules unclear on grace for the total (EVENTS.md §4). The file must say which reading it uses, with its source.
- **Design:** the two-step bar again, labelled "Pro" and "Con". One comment, one rank. The roster row shows both times.

### 4.5 F5. Other ballot shapes

These change the Rank and Review screens, not the room.

- **Data (rules profile, P3 fields; ARCHITECTURE.md §6.2 lists them):**
  - `ranks: 'all' | { top: n }`: MIFA ranks the top 3 and puts everyone else at 4.
  - `ranks: 'off'` with a required rating: Iowa IHSSA Division I–IV; Kansas festivals.
  - `rubric: [{ id, label, min, max }]`: NCFCA (5 rows, 1–5), Stoa (10 rows, 1–5).
  - The overtime effects past `noFirst` and `flagOnly`.
- **Design:** the rank board takes a cap. With ranks off, the Rank screen becomes a Rating screen. A rubric shows as a small grid of steppers per entry on the Rank screen. Review cards add the rubric rows.

### 4.6 F6. Congress (Congressional Debate)

Congress is a different machine. One judge scores a whole chamber for a session of about 2 to 3 hours. Students give many short speeches on a list of bills. A student Presiding Officer (PO) runs the room. Details and sources: [CATALOG.md](CATALOG.md) §4 and the research notes.

**Roles the app serves:** the **scorer** (a judge) first, and the **parliamentarian** (an adult who keeps order) second. The two roles hand in different things. NSDA district scorers give points per speech, points per full PO hour and a top-8 rank list. The NSDA parliamentarian gives no points; they rank **every** student in the chamber (at districts, the top 8 of that list count as one judge's ranks, and the full list is the last tiebreak). TFA and UIL also have the parliamentarian rank everyone; TFA has the parliamentarian score the PO. The PO is a student. A PO helper (precedence and recency tracker) is a student tool. It is out of scope for the judge app.

**Object model:**

- **Session:** one chamber, one session. It has legislators, a docket and a speech log.
- **Legislator:** a code, an optional name, an optional seat.
- **Legislation:** a docket item (bill or resolution) with a short title.
- **SpeechRecord:** who spoke, on which item, on which side, which kind (authorship or sponsorship, first negative, other), a `speech` run, a `questions` run, points, a comment.
- **POTerm:** who presided, from when to when, points per full hour.
- **Ranks:** for a scorer, a top-N list (8 at NSDA) over legislators who spoke or presided. For a parliamentarian, a full ranking of the chamber.

**Data model (sketch; field names final only when the first Congress landing writes its schema test):**

```
Chamber file  events/congress/chambers/<id>.v<n>.json   (versioned, frozen, loaded by core/defs.js)
{
  id, version, name, source,
  speech:    { authorship: 180, other: 180 },            // seconds
  questions: { afterAuthorship: 120, afterFirstNeg: 120, other: 60 }, // NSDA 2026-27; direct questioning in 30 s blocks
  roles:     ['scorer', 'parliamentarian']
}

Congress profile  events/congress/profiles/<id>.v<n>.json   (tournament rules; frozen into the session)
{
  id, version, name, source,
  points:    { perSpeech: { min, max }, poPerHour: { min, max } },  // NSDA district 1–8 and 4–8; Nationals 3–9 and 3–9; UIL 1–6; TFA 0–6
  pointsCap?: 5,                                         // UIL scores only each student's first 5 speeches
  ranks:     { scorer: { top: 8 }, parliamentarian: 'all' }
}

Session (device only)
{
  id, createdAt, updatedAt, productLine: 'events', kind: 'congress',
  state: 'setup' | 'judging' | 'ranking' | 'review' | 'done',   // the same lifecycle as a room
  programId?,                                           // "Judging for", as in a room
  chamberId, chamberVersion, profile: { ... },          // frozen at setup
  tournament?, house: 'house' | 'senate' | 'final', sessionNo, role: 'scorer' | 'parliamentarian',
  legislators: [ { id, code, name?, seat? } ],
  docket:      [ { id, title } ],
  speeches:    [ { id, legislatorId, legislationId, side: 'aff' | 'neg',
                   kind: 'authorship' | 'firstNeg' | 'other',
                   runs: [ { kind: 'speech', ... }, { kind: 'questions', ... } ],
                   points?, comment } ],
  poTerms:     [ { legislatorId, startedAt, endedAt?, points: [ perHour ] } ],
  ranks:       [ legislatorId, ... ],                   // scorer: top N; parliamentarian: everyone, in order
  notes, copiedAt?
}
```

**One record envelope for both kinds.** A room record gains `kind: 'room'` when Congress lands (a record with no `kind` is a room, so old rooms still open). Both kinds share `id`, `createdAt`, `updatedAt`, `productLine`, `state` and `programId?`. The Rooms list and the store read only the envelope, so one list shows rooms and sessions together.

The words `aff` and `neg` are allowed here. The banned-word test covers `core/` only.

**Design model:**

- **Session setup:** pick the chamber file and the Congress profile; paste legislator codes (the paste parser, N13); type the docket (or paste it).
- **Session screen:** the legislator list on the left (a sheet on a phone). The center shows the current speech card: legislator, item, side, the speech timer, then a "Questions" timer on tap, a points stepper and a comment box. A small "Item" chip at the top changes the docket item. A "PO" card shows the current PO and the hours so far.
- **Speech log:** a list under the card, newest first. Each row: code, item, side, time, points. Tap to edit.
- **Rank:** the rank board with a cap for a scorer (top 8 of up to 30; NSDA allows 30 at most per chamber), or with no cap for a parliamentarian. The board lists only legislators who spoke or presided, with their speech count and average points beside them, so the scorer can rank from evidence. The rule from the scorer instructions holds: no ranking before PO points are in.
- **Review and copy:** one card per legislator with all speech comments joined, in the order Tabroom's Congress ballot lists them.

### 4.7 Debate events (not this app)

Policy, LD, PF, World Schools, Big Questions, Extemp Debate and parli stay in Tabula Debate as format files. Their records are rounds, not rooms. They share only `core/` code with Speech Events. The split, and why season and day do not move them, is in [CATALOG.md](CATALOG.md) §3.

## 5. Data model rules for growth

1. **A new field comes with the family that needs it, and with a schema test.** The v1 test (`events/events-data.test.mjs`) asserts the exact v1 field list on every file. Today all 17 files are version 1. The first landing that adds a field does this:
   - It keeps the v1 assertion line unchanged for version-1 files.
   - It adds a map from `version` to its key list, and a new test for the v2 key list.
   - It adds a guard that fails on any file whose version has no key list. So no file (a v3, or a typo) can skip the key check.
   - It never removes or loosens a check for v1 files (the owner's test-immutability rule).
   - Its pull request description names this test change for review.
2. **Old versions stay forever.** A field change means a new version file (`oo.v2.json`). Old rooms open with `oo.v1.json`.
3. **Congress files live in their own folder** (`events/congress/`) with their own schema test, so the v1 event schema stays small. Chamber files hold chamber facts only (times, roles). Scales and rank counts are tournament rules, so they live in a Congress profile: one source of truth. Both live under `events/congress/` (`chambers/`, `profiles/`), apart from `events/profiles/`, because the v1 profile test asserts the exact v1 profile fields on every file in that folder. Both kinds of file are listed in `events/published.json`.
4. **Profiles grow by optional fields.** A profile without a P3 field behaves as v1.

## 6. Design model rules for growth

1. **One straight line per family:** set up → judge → rank → review. Congress keeps the same four steps.
2. **New families reuse the components in DESIGN.md §4.** The only new components are the speech log and the PO card (Congress) and the rubric grid (F5).
3. **Rules show where the judge needs them** (DESIGN.md §2): the drawn question on the comment sheet, the minimum time on the timer card, the "no ranking before PO points" rule on the Rank screen.
4. **The phone is first-class** for every family. Congress on a phone uses the list-plus-sheet pattern of the roster.
