# Speech Events: experience design

Status: draft 1, 2026-11-22. Owner accepted the four picks in §12 on 2026-11-22. No code changed.

This file is the final experience design for Tabula Speech Events after steps E1 to E13. It covers the home screens, the router that picks a workspace for each round type, the per-type console, the floater flow, coach practice, and the data that these need.

It starts from the **role-first** design (the top score in review, 90.4). It adds the best parts of the assignment-first and event-type-first designs. Then a fact-check and a completeness critic changed it. Tags show where a part came from:

| Tag | Meaning |
|---|---|
| **[AF]** | From the assignment-first design |
| **[ET]** | From the event-type-first design |
| **[fix]** | Fixes a weak point that the design judges named |
| **[crit]** | Added to fix a must-fix item from the completeness critic |

Related files:

- [VENN.md](VENN.md): what each event shares and what is unique. The families below come from there.
- [CONGRESS.md](CONGRESS.md): the full Congress console.
- [MODELS.md](MODELS.md): the object and family models.
- [DESIGN.md](DESIGN.md): the visual rules and the components (roster, timer, rank board, comment sheet).
- [ARCHITECTURE.md](ARCHITECTURE.md): the local-first rule, the store, and what may reach the server.

## 0. Core idea

- The judge home is a **list of today's ballots**. It is not a catalog of events.
- Each ballot card names a round type. That type selects the workspace.
- Judges, coaches and students open the **same workspace** for a type. Only the frame around it changes.
- Each event type also has a small console page with a Guide, Rules, and its rounds. That page is not the home.

## 1. Information architecture and routes

### 1.1 Modes

- There are three modes: **Judge** (the default), **Coach** and **Student**. A mode is a device setting (`settings.mode`). It is not an account.
- The app asks no first-run question **[AF][fix]**. It opens in Judge mode. The mode switch is in Settings.
- The header shows a mode menu only when a saved mode is Coach or Student. So a parent who judges once never sees it. Settings has no Mode part until the Coach and Student screens ship (copy trim E46, 2026-11-24); the menu then lets a judge left in Coach or Student go back to Judge.
- **Header (all screens):** brand (a link to the home of the current mode), mode menu (hidden by default), History, Settings, and an offline chip. No underline tabs (house rule, [DESIGN.md](DESIGN.md) §1).
- **Round bar (inside a round):** event pill ("HI"), round, flight, room, the stage stepper, and a back arrow. A tap on the event pill opens the console page for that type **[ET]**.

### 1.2 Homes

| Mode | Home | Sections |
|---|---|---|
| Judge | **My day** | Now, Later today, Done (comments open), Done **[AF]**. A Standby card when no ballot is active. |
| Coach | **Team** | A student table first (events, one status word, last active). Below it: Practice sets with counts. |
| Student | **To do** | Assigned to you, My runs, Feedback. |

### 1.3 Routes

The app uses hash routes. `routes.js` grows.

| Route | Screen |
|---|---|
| `#/` | Home of the current mode |
| `#/pick` | Type picker (floater, "Start a round", coach assign, student practice) |
| `#/round/<id>` and `#/round/<id>/<stage>` | **Round-type router.** One route shape for every family, Congress included **[fix]**. |
| `#/chamber/<id>` | Congress chamber overview: sessions and the full-chamber rank |
| `#/type/<eventId>` | Console page for one type: Guide, Rules, Rounds **[ET]** |
| `#/history` | Table of all rounds |
| `#/settings` | Settings |
| `#/coach/student/<sid>`, `#/coach/set/<setId>` | Coach detail pages |
| `#/student/feedback/<roundId>` | One feedback card |

Old routes stay as aliases, so bookmarks and live rooms keep working:

| Old | New |
|---|---|
| `#/room/<id>` | `#/round/<id>/judge` |
| `#/rank/<id>` | `#/round/<id>/rank` |
| `#/review/<id>` | `#/round/<id>/review` |
| `#/new` | `#/pick` |

## 2. The round-type router

### 2.1 Where the family comes from

**Step 1, no schema change [fix].** `data.js` derives `family` from the v1 def:

| v1 def | Family |
|---|---|
| `category: 'limitedPrep'` with `timing.inRoomPrep` | `f3` |
| Other `limitedPrep` | `f2` |
| `publicAddress` or `interp` | `f1` |
| The Custom event | `custom` (uses the room module) |

The v1 defs and the v1 key assertions in `events/events-data.test.mjs` do not change.

**Step 2.** v2 defs carry an explicit `family`. They get a **new** schema test. The v1 test stays as it is. `published.json` lists both versions. Old rooms keep their frozen v1 def.

### 2.2 Registry

```
round -> store key and def.family -> WORKSPACES[family] -> import(module) -> mount
```

- `f1`, `f2`, `f3`, `f4` and `custom` map to **one room module with configs** **[fix]**. This is the shipped `room-screen.js`, with `piece.js`, `question.js` and `prep.js`.
- `congress` and `discussion` are modules of their own.
- LD and XDB rows link out to Tabula Debate. They do not load here.
- The router uses a dynamic `import()`. So the app still needs no build step.
- Congress records live in their own store key, not in `rooms.v1` **[crit]**. Section 8 gives the reason.

### 2.3 Contract

Each workspace module exports these members:

| Member | Job |
|---|---|
| `family` | The registry key |
| `newRound(def, profile, input)` | Makes a round record. Pure (no side effects). `input` holds the paste, the card link and the mode. |
| `stages(round)` | The stepper list, for example `judge, rank, review`. Congress uses `log, rank, review`. |
| `mount(el, env, round, stage)` → `unmount()` | Draws the body only, and cleans up after itself |
| `keys(round, stage)` | Added to the shared keymap |
| `validate(round)` | The "Check these" lines before Rank opens |
| `summary(round)` | `{status, done, total, next}` for the home card and History **[AF]** |
| `rankModel(round)` | Data for the Rank stage, or `null` for critique only |
| `reviewModel(round)` | Cards and blocks for Review, copy and print |

### 2.4 Shared chrome and per-family parts

| Shared (one copy) | Per family |
|---|---|
| Header, round bar, stepper, offline chip | Body layout |
| Store, Undo toast, Esc stack, command palette | Timer variant: single, prep plus speech, two runs, session, typed time |
| Paste parser, comment sheet, tags, checks, private note | Roster row: piece, pair, group, question, topic, runs |
| AI clean-up and its gate | Extra parts: cross-ex chain, PO card |
| Rank, Rate and Rubric screens (the profile layer picks one) | Stage list and lock rules |
| Review, copy, print (`core/sheets`) | History columns |

**The profile layer** (the old F5, see [VENN.md](VENN.md) §3) never selects a workspace. It changes only Rank and Review:

| Profile setting | Effect |
|---|---|
| `ranks: 'off'` | Rank becomes Rate |
| `rubric` | A grid of steppers |
| `critiqueOnly` | Skips Rank |
| `topN` | Caps the rank list |

### 2.5 Room size **[crit]**

- Today `MAX_ENTRIES = 8` in `events/js/room.js`. `createRoom`, `setupError` and `addLate` enforce it.
- Elim finals, some state rounds and Group events can go over 8. The "one room module" plan would carry the cap to all of them.
- **Change:** move the cap into def or profile data, as `maxEntries` with a default of 8.
- Keep the existing test for the default. Add a new test for a def with a larger cap.
- The keymap "1 to 8 picks a speaker" breaks past 8. Add a fallback: type the number, then press Enter.

### 2.6 Mode frame

| Frame | Shows |
|---|---|
| Judge | Tournament, round, flight, level (prelim or elim), panel note, and "Judging for" (later) |
| Practice | "Practice · from Coach · due Fri". No tournament fields. With one entry, Rank is hidden. |

## 3. Per-family workspaces

All room families keep the E1 to E13 layout: the roster on the left (on top on a phone), the timer card, and the comment sheet.

| Family | Roster | Timer | Extra parts | Rank | Status |
|---|---|---|---|---|---|
| **F1 prepared** (OO, INF, EXP, OSW, DI, HI, POI, PRO, POE, STO, DEC, DUO) | Order known. Title and author. Duo has two names. | One run with limit and grace | Piece fields, check flags | 1 to N, no ties | Built |
| **F1r Radio** (data) | Same | A "Type the time" field and a window badge | None | 1 to N | Later, with a league pack |
| **F7 Group** (data) | A group label. Student names optional. Cap past 8. | Timer-off switch for recordings | None | Often Rate | Later |
| **F2 prep outside** (USX, IX, COM, MX) | Any order. A "Waiting for next speaker · about 7 min" state. | One run | Question chip. Cross-ex chain in elims ("Q: speaker X"), with a same-school warning that needs `school?`. | 1 to N | Built (base) |
| **F3 prep inside** (IMP) | Order known | Prep, then Speak, on one 7:00 clock, with a "speech started" mark | Topic field. Split phases as data. | 1 to N | Built (base) |
| **F4 two runs** (PCC) | One entry, two runs | Pro, then Con, under one 10:30 limit | Run cards, topic field (the student's pick), points only if the profile asks | 1 to N | Built (S5): `defs/v2/pcc.v2.json`, `runs.js`, `runs-view.js`, `phase-bar.js` |
| **F8 Discussion** | A table of students. Tap any student at any time. | 60-minute session clock | Contribution marks, comment cards | Rubric grid, 8 criteria | Later |

Notes:

- **Phase bar.** F3, F4 and the F2 cross-ex use it. Done phases get a check. The current phase is filled. A "Next: Speak 5:00" line sits below.
- **PCC has no minimum time for a run.** NSDA mandates none ([VENN.md](VENN.md) §6, item 1). The app shows the split time of each run, with no warning. The grace length is not stated, so the profile holds it.
- **F2 draw gap** (7 or 10 minutes) is a setting, because the gap is not confirmed.
- **Overtime is always a flag.** The app never blocks rank 1 by itself. Under a panel it shows "Panel: agree on overtime before you flag" **[crit]**. UIL disqualification is a flag plus a profile effect. The contest director applies it, not the app.

### 3.1 Students in two events **[crit]**

In speech, a student often has two events in the same round slot. The student runs from one room to the other. The judge then sees the student as late or out of order.

- Add `Entry.crossEntry?: {note, expectedAt?}`.
- Add a status "Cross-entered: speaks later", next to `waiting`. It is **not** a no-show.
- Let `parse.js` read the Tabroom double-entry mark, if Tabroom gives one.
- In Coach mode, one student can have two or more events in the same practice set. The app warns when two items share a due slot.

### 3.2 Elims and panels **[crit]**

Elims change the rules: cross-ex for extemp, other times or grace, a larger room, and 3 or 5 judges. The app does not run panels. But the judge needs to see that a panel exists.

- Add `Round.level: 'prelim'|'elim'` and `Round.panel?: {size, note}`.
- The profile picks the elim variant. A `cx` setting turns on the F2 cross-ex phase in elims only.
- So the F2 cross-ex moves from S9 into the same step as the level field (S4).
- Finals rooms can hold more than 8 entries. Section 2.5 covers this.

## 4. The Congress console

Congress has its own module, `events/congress/`, and its own store key. [CONGRESS.md](CONGRESS.md) has the full design: roles, screens, data, scoring rules and build order.

In short:

- **Scorer (build first):** setup from a paste of up to 30 codes, a live speech log with one tap for each speech, points and comment while the student speaks, a PO card that asks for a score at each full hour, and a top-N rank that stays locked until the PO points are in.
- **Parliamentarian:** the official speech log, precedence and recency lists, an election tally, and a full-chamber rank across sessions.
- **Presiding officer** (a student, Student mode, later): a recognition queue from the preset recency list.
- **Coach:** each student's speeches across sessions, from imported files.

It reuses `parse.js`, the comment sheet, AI clean-up, `core/points`, `core/ranks` (with a new top-N cap), `core/clock`, Review and copy, and the store. It does **not** use `room.js`, `MAX_ENTRIES`, or the rank-rating rule in `rank.js`.

## 5. Floater flow and the type picker

### 5.1 Standby

- A floater is a judge who waits for a late assignment. A floater sees a calm "On standby" card at the top of My day.
- The card says "No ballot yet. When the tab room sends you one, add it here." It shows the time since check-in.
- It sends no alerts. The tab room owns the alerts.
- The card has one button: **I got a ballot**.

### 5.2 Picker (`#/pick`)

1. **Recent** comes first (today's events, then the last 5 used). **Suggested** from the league pack comes next.
2. **All events** comes below, grouped by family: Interp, Public address, Limited prep, Two runs, Congress, Custom. A search field sits on top.
3. Each row shows the name, one plain line for a first-time parent, and gray field chips made from the def:
   - Room events: `RANK · TITLE · TIMER 10:00`
   - Congress: `POINTS/SPEECH · TOP 8`
   - A new event needs no new UI.
4. An "i" link on a row opens the Guide for that type **[ET]**.
5. **Confirm sheet:** room, round (the last number plus one; the judge can change it), **flight (A or B, optional)** **[fix]**, and level (prelim or elim) **[crit]**. Rounds may come in any order.
6. The app makes a ballot card and a round. It opens `#/round/<id>` at once, not a console page **[fix]**.

The target is two taps plus the room. The same picker serves the coach ("Add to practice set") and the student ("Practice"). Only the confirm sheet changes.

**"Start a round"** on My day uses the same path. A card is optional. So a judge who never adds cards is never blocked **[AF]**.

### 5.3 Ballots due in Tabroom **[crit]**

"Ranks copied" is not the same as "submitted in Tabroom". A judge with 3 flights loses track.

- Add `BallotCard.ranksDueAt?`. The default is the end of the last speaker plus 10 minutes. The 10 minutes is a setting.
- The Now card shows a countdown.
- Add a manual tick, "I submitted in Tabroom" (`submittedAt`). It moves the card to Done (comments open).
- At the end of the day, show a "Comments still open" reminder. Tabroom keeps comments open until the tournament ends.

### 5.4 Changes to a card **[crit]**

- Add a `cancelled` status for a cancelled round.
- Add a "Moved to room X" edit.
- BallotCard holds its own `tournament`. A judge can go to two tournaments in one weekend, so the Day record is not enough.

## 6. Coach assigns practice; student does it

### 6.1 Coach

- **Team home:** a table of students, with their events, one status word ("Assigned", "Done", "Feedback sent") and the last date active. A side panel shows one student's practice runs and imported ballots, by event.
- **Assign practice (bulk, across events) [fix]:**
  - One practice set holds one or more **items**.
  - Each item names a type, a prompt (an extemp question set, an IMP topic, a PCC topic, or "bring your piece"), a profile, and the students in that event group.
  - Example: USX questions for 6 students and an HI run-through for 4, in one action.
  - The set has one due date and one practice-judge role (self, peer, parent or coach).
- **Set detail:** counts for each item (Not started, Done, Feedback sent) and a row for each student.
- **Late changes [crit]:** a coach can add a student to an item that was already sent. The app sends that student the same packet. A coach can also mark a student as dropped.

### 6.2 Hand-off with no server copy

[ARCHITECTURE.md](ARCHITECTURE.md) §6.4 puts no names or comments on the server. So the hand-off goes from device to device.

**Coach to student (the assignment).** Three paths:

- a `.tabula-practice` file
- a link with the payload after `#`. The hash fragment is the part of a URL that the browser never sends to the server.
- a copy-paste text block, for school devices that cannot save files

The assignment payload holds **no student names and no comments**. The team packet is the same for every student. Each student types their own name on their own device **[AF]**. The coach device keeps the list of who got what.

**Student to coach (the result) [crit].** The result holds comments about a minor. A hash link that someone pastes into a school chat, an email or a browser sync tool can leak them. So:

- The result goes back **by file or by paste only**, never by link.
- The coach imports it. The app matches it by `setId` and `itemId`, and checks `defVersion`.
- Option for later: encrypt the result with a short code that the coach reads aloud.

### 6.3 Student

- **To do:** cards with the type pill, the due date and Start. A banner says "2 due this week".
- **Start** opens `#/round/<id>` in the practice frame. The roster has one entry.
- **Practice judge intro [crit]:** before the first practice run, a peer or parent sees one screen. It explains the event in plain words (from the type's Guide), what to watch, and how to write a kind, useful comment.
- At the end, **Send to coach** makes the result. It holds the timing, the rank or rating, the comments and the judge role. v1 sends no audio.
- **Feedback card:**
  - the type pill, the time used, and the rank or rating
  - comments split into Strengths and To work on
  - one action: **Practice again**
- **My runs:** all runs. A student can also paste a real ballot to build a ballot history by event **[ET]**.
- **Who sees what:** the "Reason for rank" goes to the whole room. Comments for one entry go only to that student and the coach.

### 6.4 Privacy for minors **[crit]**

Coach and student devices hold names and comments about minors.

| Risk | Rule |
|---|---|
| Comments leak through a link | Results go back by file or paste only (§6.2) |
| Shared or school device | A "Shared device" switch clears student data on exit |
| Data kept forever | A "Delete my data" action in each mode. A prompt on coach devices to clear data after the season. |
| AI sends a minor's comment to a model | The code scrub runs on every AI call in Practice mode. AI clean-up is off by default in Student mode. |
| Names in URLs | Nothing goes in a URL query string. Codes are the default; names are optional. |

FERPA and COPPA review is open. FERPA is the US law for student records. COPPA is the US law for the online data of children under 13. Middle-school leagues have students under 13.

## 7. Per-type judge and management console

This section maps the Tabula Debate console to Speech Events.

| Debate has | Speech Events plan |
|---|---|
| PLACES nav | Header: Home, History, Settings. The stages live in the round bar. |
| History, TSV, CSV | `#/history`: one row per round (date, tournament, round, flight, level, event, entries, state, "comments open"). Filter by type and tournament. A filter for one family adds that family's columns: questions (F2), runs (F4), sessions and speech counts (Congress) **[AF]**. Copy as TSV and download CSV, with **codes only and no comments** unless the judge picks them. |
| Backup and restore | Settings → Data: one file through `core/store` `buildBackup` / `parseBackup` under `tabulaEvents.*`. AI keys are left out unless picked. |
| Room delete | Delete with Undo through the toast |
| Settings | Theme (Mode comes back with the Coach and Student screens); default profile and league pack; defaults for each type (signals, grace); Connect AI (moved from the Review invite; hosted after E14); keyboard sheet; F2 draw gap; ranks-due minutes; Congress scale defaults; Shared device; Ready for offline. |
| Palette | ⌘K through `core/keys` `searchCommands`: "New HI round", "Open R3", "Copy ranks", "Guide: Duo" |

**Type console page `#/type/<eventId>` [ET].** It is one page that scrolls. It is not a second nav system **[fix]**.

- **Guide:** "What this event is", in plain words, for a nervous first-time parent. It lists the checks, with examples of good comments. The same text shows at round setup and from the picker.
- **Rules:** the default profile (scale, grace, overtime effect, signals). It shows the frozen copy and says that a change affects only new rounds.
- **Rounds:** the rounds of this type, grouped as Now, Later today and Done, with a link to the filtered History.
- **Practice** (Coach mode only): the items of this type and their counts.

## 8. Data model changes

All records stay on the device under `tabulaEvents.*`. Names and comments never go to the server. A migration at read time fills in defaults.

### 8.1 Storage keys and migration **[crit]**

- `rooms.v1` holds **room-family rounds only** (F1 to F4, Custom, later F7 and F1r).
- Congress chambers and sessions live in **`congress.v1`** only. Discussion later gets `discussion.v1`.
- The reason: today the code has no migration. Every reader of `rooms.v1` assumes `entries[]`. A Congress session in that array would break the grouping in `rooms.js` and every such reader.
- Write the read-time migration as one function with defaults for each new field.
- Add a **new** test. It loads an old room and an old backup, and checks that each opens with no change.

### 8.2 Round (room families)

The `rooms.v1` key and its shape stay. The record gets wider:

- `family` (derived), `mode: 'tournament'|'practice'`, `level: 'prelim'|'elim'`, `panel? {size, note}`, `dayId?`, `cardId?`, `practice? {setId, itemId}`, `roomLabel?`, `programId?` (never shown in Student mode).
- **Entry** adds `runs?[{side, startedAt, ms}]` (F4), `topic?` (F3, F4), `school?` (F2 cross-ex warning), `groupName?` (F7), `crossEntry? {note, expectedAt?}`.

### 8.3 Day, card and practice records

**Day** (`days.v1`): `id, date, tournament?, leaguePack?, checkInAt?, standby: bool`.

**BallotCard** (`cards.v1`, judge side) **[AF][fix]**. Its name is "card", not "assignment", so it does not clash with coach practice.

- `id, dayId, tournament?, eventKey|null` (null for a floater on standby), `role: 'judge'|'scorer'|'parli', round, flight?, level?, roomLabel?, startsAt?, ranksDueAt?, submittedAt?, roundId?`
- `status: 'standby'|'notStarted'|'judging'|'ranksIn'|'done'|'cancelled'`.
- The judge sees only these words: Not started, Judging, Ranks copied (comments open), Submitted, Done, Cancelled.

**PracticeSet** (`practice.v1`, coach device):
`id, title, dueAt?, judgeRole: 'self'|'peer'|'parent'|'coach', items[{id, eventKey, profileKey, prompt {kind: 'question'|'topic'|'piece'|'none', text|questions[]}, students[{studentId, status, resultId?}]}], createdAt`.

**Student** (`students.v1`, coach device): `id, code, displayName?, events[], note?`.

**PracticePayload** (file, hash or text; no names, no comments): `v, defVersion, setId, itemId, eventKey, profile, prompt, dueAt, from` (the coach's label).

**PracticeResult** (file or text only): `v, defVersion, setId, itemId, studentLabel, roundSnapshot {entries, timing, rank?, rating?, comment}, judgeRole, ranAt`.

Add new schema tests for PracticePayload and PracticeResult. They check `v` and the def key **[crit]**.

### 8.4 Congress

[CONGRESS.md](CONGRESS.md) §6 has the full Chamber, Session, Speech and PO term records.

### 8.5 Rules profile and def

**Rules profile** adds:

- `ranks: 'all'|'topN'|'off'`, `topN?`, `rubric?[{id, label, min, max}]`, `critiqueOnly?`, `maxEntries?`, `elim? {cx, timing}`
- `overtime.effect` adds `directorDq` (UIL: a flag; the director applies it) and `windowLast` (Radio; not verified)
- Congress: see [CONGRESS.md](CONGRESS.md) §6.

**Def v2** adds `family`, `timing.total?`, `timing.prepMax?`, `timing.window?`, `performers {min, max}`, `maxEntries?`, and `fields[]` (the picker chips). There is **no** `timing.minPerRun`, because PCC has no minimum.

**Settings** adds `mode, showModeMenu (retired 2026-11-24: kept so old backups still load; nothing reads it), theme, defaultProfile, leaguePack, recentEvents[], eventDefaults{}, drawGapMin, ranksDueMin, sharedDevice`.

**Server (opt-in, later):** a round summary (event, round, date, count) and an assignment shell with a status only. No codes, no names, no comments.

## 9. Offline **[crit]**

The app must work at a school with no wifi. A route that loads by `import()` can fail cold if the service worker did not cache it.

- Add every `WORKSPACES` module, plus `congress` and `discussion`, to the service worker list (`build-sw.mjs` / `sw-files.js`).
- Add a gate test: each module in the registry is in the service worker list.
- AI clean-up offline: disable the button and show "Clean up needs internet. Your comments are saved."
- Settings shows a "Ready for offline" check.
- Copy and paste work offline. The text-block hand-off for practice works with no network. Files work if the device can save them.

## 10. Mobbin references for each key screen

You must sign in to Mobbin to open these links. Take the layout and the interaction, not the brand color.

| Screen | Reference |
|---|---|
| My day cards and groups | Runna https://mobbin.com/screens/b5a9d114-834e-4b44-9246-a253efd223af · Attio https://mobbin.com/screens/02d405d2-294a-45fe-b1d3-cb5addc69cd1 · Jobber https://mobbin.com/screens/c3fc8f9e-52c4-465b-a55c-b7ac5eeec9a8 |
| Standby empty state | DoorDash https://mobbin.com/screens/7f924d2b-98f4-499a-9e9f-45a8021912f8 · Grab https://mobbin.com/screens/a2a5d8de-302d-47a0-9c99-ec6ccbc0ac54 |
| Picker: suggested, grouped, search, chips | Oura https://mobbin.com/screens/9a43c46c-6c3d-467e-b2e8-f669cc66d548 · Runna https://mobbin.com/screens/9c507a43-9bfa-469f-b737-4c58131ea78f · Ultrahuman https://mobbin.com/screens/6c93dc3d-800c-4025-bb71-1088c20c00d3 · Hevy https://mobbin.com/screens/1da62220-571d-4dc5-964c-24aed2282ed5 |
| Phase bar | Google Health https://mobbin.com/screens/ccd7535d-7673-4b21-89d4-ac6b792970ad · Peloton https://mobbin.com/screens/ddbad8c8-8a68-4c12-98d5-6475e8e7bb74 · Ladder https://mobbin.com/screens/902f3d8a-cb98-4738-a631-2f9d7a176df4 |
| PCC run cards | Runna https://mobbin.com/screens/ea07706a-2073-44c7-8672-f939616ec99d |
| Rubric steppers | Equinox+ https://mobbin.com/screens/359a1e58-2d23-47c2-aac5-226dc11ba371 |
| Congress screens | See [CONGRESS.md](CONGRESS.md) §9 |
| Coach team table and student page | SchoolAI https://mobbin.com/screens/14950322-bbc7-4cea-90ed-66e9909b8468 · Kajabi https://mobbin.com/screens/1227af09-4d68-457a-a7ea-a5596e2c3e4f |
| Assign practice and set counts | ClassDojo https://mobbin.com/flows/3e47c23f-4ccc-480a-81fd-74e661fe45eb · Uxcel https://mobbin.com/flows/33eee57a-a6ff-4852-afc6-95ee2e9200ed · Canva https://mobbin.com/screens/a6c52d6d-1308-49a7-83d4-3542beed7fc2 |
| Student To do | ClassDojo https://mobbin.com/flows/f2574e2a-ba5d-4d49-b9af-f1f2291b5fb2 · Coursera https://mobbin.com/screens/90125678-ffcd-4a5e-8256-3a73434ee7c7 |
| Feedback card and run list | Babbel https://mobbin.com/screens/d8896ff2-ac14-40cd-8439-b9567a989262 · Coursera grades https://mobbin.com/screens/35b8baea-dca0-422b-83ee-01dd411da127 |

The chrome stays black, white and gray, with no stripes and no underline tabs.

## 11. Build order and risks

### 11.1 Build order

Each step needs green gates (`.claude/gates.json`). Each new test needs a one-line header that says why the behavior matters.

| Step | Scope |
|---|---|
| **S1 Router, no new behavior** | Derived `family` in `data.js`, the `WORKSPACES` registry, the room module behind the contract, `#/round/<id>`, old routes as aliases, every registry module in the service worker list (with its gate test). All existing tests stay green. |
| **S2 Console basics** | Header, History with TSV and CSV (codes only), backup and restore, delete with Undo, Settings, palette, read-time migration with its new test. Deferred from S2 Settings: league pack, defaults for each type, draw gap, ranks-due minutes (S3, S4), Congress scale (S6), Shared device (S8). |
| **S3 My day** | Day and BallotCard records, Standby, the picker with chips, flight and level, "Start a round", ranks due and "I submitted", the type page (Guide, Rules, Rounds). |
| **S4 Profile layer and elims** | Ranks off, top N, rubric, critique only, `maxEntries`, `level` and panel note, the F2 cross-ex in elims, cross-entry status. |
| **S5 PCC** | v2 def with a new test, `runs[]`, the phase bar. |
| **S6 Congress scorer**, then **S7 parliamentarian** | After the open Congress facts are checked. See [CONGRESS.md](CONGRESS.md) §8. |
| **S8 Coach and Student** | Practice sets with items, the hand-off paths, To do, feedback, the practice-judge intro, the privacy rules in §6.4. Build after a test with one real team. |
| **S9 Later** | PO queue, Discussion, Radio and Group data, server status sync. |

### 11.2 Risks

1. **Card friction.** If a card takes more than two taps, judges skip My day. Fix: cards are optional, and "Start a round" makes one.
2. **Growth into a tab system.** Cards are the judge's own notes. Do not add pairing or results. The panel field is a note only.
3. **Router refactor.** S1 must not change behavior. The aliases and the existing tests guard it.
4. **Schema gate.** Never edit the v1 key assertions. `family` goes only in v2 defs, under a new test.
5. **Room cap.** Moving `MAX_ENTRIES` into data must keep the default test green.
6. **Congress size.** 30 rows and sessions of 3 hours or more. Save after each speech, and run a memory test.
7. **Privacy drift.** Coach devices hold the names of minors. Section 6.4 sets the rules.
8. **Hand-off friction.** Test the file, link and paste paths with one coach before S8 grows.
9. **Cold offline routes.** The gate test in §9 guards this.

## 12. Decisions for the owner

**Decided 2026-11-22 (owner): picks 1 to 4 are accepted, all option (a).** Item 5 (elim cross-ex in S4) stays as written in the build order.

1. **Where does the type console live?** (a) A page `#/type/<id>`, reached from the round pill, the picker and History. (b) Type tiles on the home. **Pick (a).** Tiles bring back a home that makes a judge browse every event.
2. **Is a ballot card required to judge?** (a) No: "Start a round" makes a card. (b) Yes. **Pick (a).** It keeps a fast path for judges who will not add cards.
3. **Which practice hand-off ships first?** (a) File, hash link and paste for the assignment; file and paste for the result. (b) File only. **Pick (a).** Many school devices cannot save files.
4. **Congress before coach and student?** (a) Congress scorer first (S6, S7), then practice (S8). (b) Practice first. **Pick (a).** Judges are the main users today.
5. **Elim cross-ex earlier?** The critic moves the F2 cross-ex from S9 to S4, with the level field. **Pick yes**, because elim rules depend on it.

## 13. Open points

These critic items and facts are not folded in. Each needs an owner choice or a check.

1. **Timekeeper view.** A student timekeeper is common in Congress and some leagues. Add a "Timer only" variant that uses the Speaker view ([ARCHITECTURE.md](ARCHITECTURE.md) §5, item 4; not built): large digits and signals.
2. **Judge who also coaches.** Two modes on one device. The coach's student list must not show in judge room views. Add an optional conflict flag for each entry ("conflict: tell the tab room"), shown in Review as a reminder only.
3. **Out-of-scope roles.** Name tab-room and league staff in an explicit out-of-scope list. Design the "Judging for" frame (`programId`) or drop it.
4. **Recorded rounds for every family.** Add `delivery: 'live'|'recorded'`. A recorded round turns the timer into "Type the time".
5. **PF and LD practice.** PF just landed in Tabula Debate (commit 54b3719). A coach who assigns PF practice next to HI has no path. Option: a practice item that points to a Tabula Debate format with a hand-off link.
6. **"Paste my judge assignments".** A paste of the judge's full Tabroom day could make many cards at once with `parse.js`. The format is not studied yet.
7. **Middle-school, NCFL and CHSSA variants.** Probably data only. Say so when the league packs are written. NCFL and CHSSA Congress formats need a check.
8. **State-level time changes** for Storytelling, Prose and Poetry. Data only, with a league pack.
9. **Encrypted results.** A short-code encryption for practice results. Decide if file and paste are enough.
10. **FERPA and COPPA review.** Open, before S8 ships.
11. **Facts to check before profiles are written.** PCC grace length; the Radio window; Discussion ranks; the district PO scale; NCFL and CHSSA scales; the `reasonBelow` value for each Congress profile. [VENN.md](VENN.md) §7 lists them all.
12. **EVENTS.md §6 is wrong** about the Congress scorer scale ("1 to 6 per speech"). The real scales are 1 to 8 at districts and 3 to 9 at Nationals. This file does not edit EVENTS.md. Fix it in a separate change.
