# Speech Events: the Congress console

Status: draft 1, 2026-11-22. Step S6 (scorer) built 2026-11-23: code in `events/congress/`; facts checked in §11.

This file designs the Congressional Debate console in Tabula Speech Events. It takes the Congress parts of [EXPERIENCE.md](EXPERIENCE.md) §4 and the Congress research, and goes into more depth. It covers the roles, the screens, the data, the scoring rules and the build order.

Related files:

- [VENN.md](VENN.md): why Congress cannot share the room screen.
- [MODELS.md](MODELS.md) §4.6: the earlier F6 model.
- [DESIGN.md](DESIGN.md): the visual rules and the shared components.
- [ARCHITECTURE.md](ARCHITECTURE.md): the local-first rule and the store.

## 1. How a Congress chamber runs

| Term | Meaning |
|---|---|
| **Chamber** | One room of students ("legislators"). Best size is 18 to 20. The limit is 30. An in-person district chamber has 8 to 29. An online chamber has 8 to 15. A student is a "Representative" (House) or a "Senator" (Senate). |
| **Session** | At least 3 hours at NSDA (Last Chance used about 2.5 hours). A larger chamber adds 10 minutes for each student past 20. Each session is a fresh start: a new PO election, a new seat chart, precedence and recency reset to zero, and only legislation not yet debated. |
| **Docket** | The list of bills and resolutions. Students caucus to propose the agenda order. Debate on an item never carries into the next session. |
| **PO** | The presiding officer. A student who runs the floor and calls on speakers. |
| **Precedence** | The PO first calls students who have not spoken, then students with fewer speeches. |
| **Recency** | Among equals, the PO calls the student who spoke least recently. A preset recency list from tab breaks ties at the start. It is required at NSDA districts and Nationals. The PO reads it top to bottom for speeches and bottom to top for questions. |
| **Scorer** | An adult judge. Gives points for each speech and ranks a top 8. Two or more for each session; 3 in NSDA elims; 8 in the Nationals final. |
| **Parliamentarian** | An adult judge. Stays with one chamber for all prelim sessions. Keeps the official record and ranks every student. |

**Opening business.** Session 1 starts with the oath. Then the PO election: nominations, candidacy speeches of up to 1:00, and secret ballots until one student has a majority. The lowest candidate drops out after each vote. Last comes a counted vote on the agenda order.

**Judge rotation.** Scorers are assigned for each session through Tabroom and often change. UIL State requires a change. No NSDA rule requiring it was found. Every session gets a new ballot from each scorer.

## 2. Why Congress has its own console

The room model (`events/js/room.js`, `rank.js`) assumes things that are false in Congress.

| Room assumption | Congress fact |
|---|---|
| At most 8 entries (`MAX_ENTRIES = 8`) | Up to 30 legislators |
| Order known ahead | The PO sets the order live, by precedence and recency |
| One performance for each entry | 0 to 4 or more speeches for each student, each with its own points and comment |
| One clock with grace | 3:00 speech, then 1:00 or 2:00 of questions, in 30-second blocks |
| Ranks 1 to N for everyone | A scorer ranks a top 8. The parliamentarian ranks all. |
| A better rank needs a better rating (rank-rating rule) | Ranks need not follow points. "Quality is more important than quantity." |
| One round, then done | Sessions of 3 hours or more. A new ballot each session. The parliamentarian ballot spans all sessions. |
| No side, item or term | Each speech has a docket item, a side and a type. The PO has a term in hours. |

**Reused parts:** the paste parser (`parse.js`), the comment sheet, AI clean-up, `core/points`, `core/ranks` (with a new top-N cap), `core/clock`, Review and copy, and the store.

**Not used:** `room.js`, `MAX_ENTRIES`, the rank-rating rule in `rank.js`.

## 3. Roles

| Role | Who | In which build step | What the app does for this role |
|---|---|---|---|
| **Scorer** | Adult judge, in Judge mode | S6 (first) | Speech log, points and comment for each speech, PO hour scores, top-N rank, Review and copy into Tabroom |
| **Parliamentarian** | Adult judge, in Judge mode | S7 | Official log, precedence and recency lists, election tally, notes, full-chamber rank across sessions |
| **Presiding officer** | Student, in Student mode | S9 (later) | Recognition queue, side alternation, speech and question timer, time calls, motions log |
| **Coach** | Coach mode | After S8 | Each student's speeches across sessions, from imported files |
| **Timekeeper** | Student or adult | Open point | A large-digit timer only (the Speaker view in [ARCHITECTURE.md](ARCHITECTURE.md) §5, not built) |

Tab-room staff are out of scope.

## 4. Screens

All screens use the shared header and round bar. The round bar shows the house pill ("House" or "Senate"), the session number, the room, and the stepper `Setup · Log · Rank · Review`.

### 4.1 Chamber setup (scorer and parliamentarian)

**Input**

1. Paste the chamber list. Codes are required. Names, schools and seats are optional. Up to 30 rows (29 under the district profile).
2. Add the docket titles, one for each line, in agenda order.
3. Pick House or Senate, and the session number.
4. Pick the role: scorer or parliamentarian.
5. Pick a profile. The profile holds `scale`, `poScale`, `reasonBelow`, `poRule`, `topN` and `rankPool` (§7).

**"Check these" lines** (the same pattern as room setup):

- A code appears twice.
- More rows than the profile allows.
- Fewer than 8 rows (below the district minimum; a warning only).
- A row with a name but no code.
- No docket items.

**Session 2 and later.** The chamber, legislators and docket carry over. The judge only confirms the session number and marks absent legislators. Items debated in earlier sessions are grayed out.

### 4.2 Live log (scorer)

This is the main screen. The student is speaking, so every action must be fast.

**Top: the speech card**

- A big **Next speech** button.
- One tap picks the legislator, by seat chart or by search on the code.
- The app fills in the item, the side and the type:
  - The first speech on an item is the authorship (or sponsorship). The writing school's student gets the floor before precedence.
  - The second speech is the first negative.
  - After the first two speeches, the side alternates.
  - The judge can change any of the three with one tap.
- The timer starts at once: 3:00 speech, then the question period. The type sets the question time (2:00 for authorship, sponsorship and first negative; 1:00 for others). Questions show as 30-second blocks.
- After the speech, a line shows the time ("2 min 51").

**Middle: points and comment**

- Both boxes stay open while the student speaks.
- Points use the steppers from `core/points`, with the profile's scale.
- If the points are below `reasonBelow`, the app asks for a specific reason. It does not block the save.
- Two toggles:
  - **Wrong side:** takes off at least 3 points. The speech still counts for precedence.
  - **Not on the floor** (speech on legislation not under debate): gives 0 points. The speech still counts for precedence.
- AI clean-up works on the comment, as in the room.

**Save.** The app saves after each speech. A 3-hour session must not lose data on a reload or a dead battery.

**PO card** (pinned on the side or below):

- Start and stop the PO term. A new PO after a recess starts a new term.
- The app counts full hours from the clock. At each full hour it asks for a PO score, on the PO scale.
- Under NSDA, a part hour gets no score. The app records the part hour with a flag (`partHour: true`) so the rule has a stored result.

**Running view** (below, or a toggle):

| Device | Layout |
|---|---|
| Phone | One block for each legislator, with a row for each speech (number, item, side, points, a check) and "+ Add speech". Like the Hevy workout log. |
| iPad or laptop | A grid: legislators down the side, speeches across. Each cell shows points. Like the Me+ habit grid. |

Both views write the same data. Each legislator line shows the speech count, the points list and the average, to help with the rank.

**Legislator status.** A legislator can be `present`, `absent` or `left`, with a time. Absent legislators are not in the rank pool.

### 4.3 Rank (scorer)

- Slots 1 to top N (8 by default) sit at the top. A tap on a legislator fills the next slot. A tap on a filled slot clears it. Like the Formula 1 slot pattern.
- The pool below is sorted by total points. It shows speech count and PO hours.
- Under the Last Chance profile (`rankPool: 'spokeOrPresided'`), only students who spoke or presided show. The NSDA default shows every present student, because the manual does not limit the pool.
- The step stays **locked until every full PO hour has a score**. A line says why: "Score the PO's 2nd hour first."
- A tie in points between two ranked students gives a warning, not a block.
- The app does **not** apply the rank-rating rule. A student with fewer points can rank higher.

### 4.4 Review and copy (scorer)

- Review follows Tabroom order: the Speeches tab first, then the Ranks tab.
- Each speech block shows the legislator, item, side, type, points and comment. "Copy" copies one block at a time.
- PO hour scores show as their own blocks.
- The rank list copies as one block.
- "Ranks copied" and "Mark submitted" work as on the room ballot ([EXPERIENCE.md](EXPERIENCE.md) §5.3).

### 4.5 Parliamentarian screens

- **Log.** The same log as the scorer, used as the official record: number, legislator, side (S, A or N), type and time. No points under NSDA. A PO term counts as one speech for each hour.
- **Precedence and recency.** Two lists: one for speeches and one for questions. Each list shows the order the PO should follow now, with the reason in words ("0 speeches · never spoken"). The parliamentarian uses it to confirm the PO's calls.
- **Questioners.** The parliamentarian can log who asked each question block, so the question list is right.
- **Election tally.** One sheet for each vote round. Candidates, counts, and a "drop lowest" step. Majority is shown.
- **Notes.** Amendments (germane or not), evidence challenges, protests.
- **Full-chamber rank** on `#/chamber/<id>`. It builds across sessions. The parliamentarian orders every student. In the summary, ranks above 8 count as 9, so the list weighs the same as one scorer ballot. NSDA uses the full order only as the last tiebreak.
- **PO points.** A field for the TFA profile only (0 to 6 for each hour).

### 4.6 Presiding officer queue (later, Student mode)

- A queue built from the preset recency list and the live log.
- Each row: position, code, a reason in words, **Recognize** and **Skip**.
- Sections: Standing now, Recognized, Spoke this session.
- A separate list for questioners, read in reverse order.
- A side line: "Next: Neg" after the first two speeches.
- A time call line after each speech ("That speech was 2 minutes and 15 seconds").
- A log of motions and votes.
- No Mobbin screen sorts by a precedence rule. This sort is our own design.

### 4.7 Coach view (later)

- Each student's speeches across sessions: points, comments, sides, types and ranks.
- Comments grouped by legislation, to plan prep.
- A speech-count balance, to check whether the PO treated the school fairly.
- This view reads imported session files only. It never reads another judge's device.

## 5. Scoring rules

### 5.1 Speech types and times (NSDA 2026-27)

| Speech | Time | Questions after |
|---|---|---|
| Authorship (writing school or district; gets the floor before precedence) or sponsorship (first Aff, by precedence) | 3:00 | 2:00 |
| First negative | 3:00 | 2:00 |
| Every later speech: rebuttal, extension, crystallization | 3:00 | 1:00 |
| Amendment speech (neutral; counts in the student's total) | 3:00 | 1:00 |
| PO candidacy and nomination speeches | up to 1:00 | none; not scored |

- **Rebuttal:** answers named arguments.
- **Extension:** takes an earlier argument further.
- **Crystallization:** a late speech that weighs the main voting issues.
- **Direct questioning** in blocks of 30 seconds or less is required at districts and Nationals. A motion to extend questioning is dilatory (made only to delay) and out of order.
- NSDA has no minimum-cycle rule.

### 5.2 Points

| League | Points for each speech | PO points |
|---|---|---|
| NSDA districts | 1 to 8 | 4 to 8 for each full hour (Officials rule; the merit-points line says 1 to 8, see §11). No score for a part hour. |
| NSDA Last Chance | 1 to 8 | 1 to 8 for each full hour |
| NSDA Nationals | 3 to 9 | 3 to 9 for each full hour |
| UIL | 1 to 6, first 5 speeches of each student only | Up to 6 for each clock hour (the form says 2 to 6). Part hour: not verified. |
| TFA | 0 to 6 (IQTs); 1 to 6 (State) | 0 to 6 for each hour, given by the parliamentarian (IQTs); 1 to 6 at State |
| NCFL, CHSSA | No points: ranks only (§11) | NCFL: none found. CHSSA: the PO is a separate win/loss contest. |

- **Merit points** convert any scale to 1 to 6. That is a different number from the scorer scale. EVENTS.md §6 mixes them up.
- **Criteria:** originality, organization, evidence and logic, delivery, demeanor, and answers to questions. The scorer must **not** judge on agreement with the argument.
- **Last Chance bands:** 3 to 4 mediocre, 5 proficient, 6 excellent, 7 to 8 superior. A score below 5 needs "substantial written comments" with a specific incident.

### 5.3 Fixed penalties

| Case | Effect |
|---|---|
| Wrong-side speech, not caught | Counts for precedence. At least 3 points off (NSDA). TFA: no more than 3 points. |
| Speech on legislation not on the floor | Counts for precedence. 0 points. |

### 5.4 Ranks

- **Scorer:** a top 8 at the end of each session. The NSDA manual allows POs in the rank. Last Chance limits the pool to students who spoke or presided. Ranks can weigh questions, useful motions and listening, not only points.
- **Parliamentarian:** ranks every student at the end of the prelims. Ranks above 8 count as 9.
- **Final ranking** (done by tab, not the app): the lowest total of judge ranks. Tiebreaks: judge preference, reciprocals (sum of 1/rank), drop high and low, then the parliamentarian's rank. Points feed merit points, not advancement.
- **No conferring:** a scorer may check speech counts with the parliamentarian. A scorer may not discuss scores or ranks with anyone. The app shares nothing between judges.

## 6. Data

All records stay on the device in `congress.v1`. They never go into `rooms.v1` ([EXPERIENCE.md](EXPERIENCE.md) §8.1).

**Chamber**

```
id, dayId?, tournament?, house: 'house'|'senate',
profile (frozen copy), role: 'scorer'|'parli',
legislators[{id, code, name?, school?, seat?, status: 'present'|'absent'|'left', statusAt?}],
docket[{id, title, debatedInSession?}],
sessionIds[], parliRank?[legislatorId], createdAt
```

**CongressSession**

```
id, chamberId, number, cardId?, startedAt, endedAt?,
recency[legislatorId], speeches[], poTerms[],
ranks[legislatorId] (at most topN), rankLock: bool,
questions?[{legislatorId, speechId, blockMs}],
elections?[{round, tallies[{legislatorId, votes}], dropped?}],
notes?[{kind: 'amendment'|'evidence'|'protest'|'other', text, at}],
copiedAt?, submittedAt?
```

**Speech**

```
id, legislatorId, itemId,
side: 'aff'|'neg'|'neutral',
type: 'authorship'|'sponsorship'|'firstNeg'|'rebuttal'|'extension'|'crystal'|'amendment',
startedAt, speakMs, questionMs, questionerIds[],
points?, penalty?: 'wrongSide'|'offFloor',
comment, commentSource
```

**POTerm**

```
legislatorId, startedAt, endedAt?,
hourScores[{hour, points}], partHour: bool
```

**Congress profile fields**

| Field | Meaning | Example |
|---|---|---|
| `scale` | Points range for a speech | `{min: 1, max: 8}` |
| `poScale` | Points range for a PO hour | Open fact |
| `reasonBelow` | Ask for a reason below this score | 5 (Last Chance). Open for others. |
| `poRule` | How PO hours score | `'fullHourOnly'` (NSDA), `'parliScores'` (TFA) |
| `topN` | Scorer rank length | 8 |
| `rankPool` | Who can be ranked | `'present'` (NSDA default), `'spokeOrPresided'` (Last Chance) |
| `scoredSpeechCap` | Speeches that get points | 5 (UIL) |
| `scoring` | Points, or ranks only | `'points'`; `'ranksOnly'` (NCFL, CHSSA: no scale, no PO points, `poRule: 'none'`) |
| `maxLegislators` | Chamber limit | 30, or 29 at districts |
| `questionBlockMs` | Question block length | 30000 |

## 7. Profiles to write

| Profile | Values known | Values open |
|---|---|---|
| `nsda-district` | Scale 1 to 8, part hour gets no score, top 8, max 29 | PO scale (1 to 8 or 4 to 8), `reasonBelow` |
| `nsda-last-chance` | Scale 1 to 8, reason below 5, top 8, pool spoke-or-presided | None |
| `nsda-nationals` | Scale 3 to 9, top 8 | `reasonBelow`, PO scale |
| `uil` | Scale 1 to 6, first 5 speeches, parliamentarian ranks all | `reasonBelow`, PO rule |
| `tfa` | Scale 0 to 6, parliamentarian gives PO points 0 to 6 per hour | `reasonBelow` |
| `tfa-state` | Scale 1 to 6, parliamentarian gives PO points 1 to 6 at the end of each hour, top 8, max 20 in a prelim chamber, wrong side no more than 3 | `reasonBelow`, rank pool, wrong-side cap (read from the IQT rules) |
| `ncfl` | Ranks only (no points), PO gets no points, parliamentarian ranks all | Rank length in prelims (8 is written for the Grand Final), chamber limit (goal 18; semis 16 to 20), rank pool |
| `chssa` | Ranks only, top 9 in prelims (unranked = 10), PO is a separate contest | Chamber limit, rank pool |
| `chssa-elim` | Ranks only, semis and finals: 1st to 15th | Rank length (the same section also says unranked past 9 = 10), chamber limit, rank pool |

## 8. Build order

Each step needs green gates (`.claude/gates.json`). Each new test needs a one-line header that says why the behavior matters and what breaks if it regresses.

| Step | Scope | Done when |
|---|---|---|
| **C0 Fact check** | Read the NSDA district officials rule for the PO scale. Settle `reasonBelow` for each profile. Fix EVENTS.md §6 in a separate change. | Each profile in §7 has every value, or a marked default. |
| **C1 Data and store** | `congress.v1` key, Chamber, Session, Speech, POTerm records, profile fields, read-time defaults. `core/ranks` top-N cap. | New tests: records round-trip; `rooms.v1` readers never see Congress records; top-N cap works; old backups load unchanged. |
| **C2 Setup** | Paste of up to 30 codes, docket, house, session, role, profile, "Check these" lines. Session 2 carry-over. | New tests for each "Check these" line. |
| **C3 Live log** | Next speech, auto item, side and type, timer with question blocks, points and comment, penalties, save after each speech. | New tests: side alternation, question time by type, penalties. A 3-hour session test for memory. |
| **C4 PO card** | Terms, full-hour prompts, part-hour flag. | New tests: hour count, part hour gets no score under NSDA. |
| **C5 Rank and Review** | Top-N slots, pool rules, PO lock, tie warning, Review in Tabroom order, copy, submitted tick. | New tests: lock until PO hours are scored; pool rules for each profile; no rank-rating rule. |
| **C6 Parliamentarian** | Official log, precedence and recency lists, questioner log, election tally, notes, full-chamber rank on `#/chamber/<id>`, TFA PO field. | New tests: precedence order; recency reset each session; ranks above 8 count as 9. |
| **C7 Later** | PO queue (Student mode), coach view from imported files, timekeeper view. | After S8. |

In [EXPERIENCE.md](EXPERIENCE.md) §11, C0 to C5 are step S6, and C6 is step S7. The router (S1) and the service worker list must include `events/congress/` before C2 ships.

## 9. Mobbin references

You must sign in to Mobbin to open these links. Take the layout and the interaction, not the brand color. The chrome stays black, white and gray.

| Screen | Reference |
|---|---|
| Speech log, phone blocks | Hevy workout log https://mobbin.com/screens/b7c6155c-8453-4230-9c28-a12218a415d8 |
| Grid on iPad | Me+ habit grid https://mobbin.com/screens/68f3faa7-4603-4dbb-a21b-8b201dbbe2c9 · Miro table https://mobbin.com/screens/3cc382a7-ae87-4d28-a04f-8cecd412cafb |
| Log in session order | Runna laps https://mobbin.com/screens/67f286f2-7497-4576-93ca-2cbe6a12dd90 |
| Fast points entry | Apple Health keypad https://mobbin.com/screens/189a93c5-8cd4-483b-bb6f-488902425ef5 |
| Rank slots | Formula 1 https://mobbin.com/screens/0c73662a-1ee7-49e9-aa1c-0668b71802c9 |
| PO queue | Discord Stage https://mobbin.com/screens/38d31e36-b02e-4790-80cf-83908337bf74 · Teams lobby https://mobbin.com/screens/07e018aa-c11b-4e84-9a76-11e933934e29 · Whereby https://mobbin.com/screens/43a7b4a3-3ad3-471b-9e77-06290c75c8c2 |
| "You are 3rd in precedence" | Waymo https://mobbin.com/screens/dd06088e-6808-4598-a93a-1e8ca4e51ea1 · Equinox+ https://mobbin.com/screens/175f19d0-617d-4275-8409-c0917628b1a4 |
| Session phases | Google Health https://mobbin.com/screens/ccd7535d-7673-4b21-89d4-ac6b792970ad · Peloton https://mobbin.com/screens/ddbad8c8-8a68-4c12-98d5-6475e8e7bb74 |

Note: the Hevy reference in the Mobbin notes shows "Score 1 to 6". Use the profile's scale, not 1 to 6.

## 10. Open questions

1. **District PO scale.** One reading of the manual gives 1 to 8 for each speech and each full hour of presiding. Another gives 4 to 8 for the PO. Owner answer: keep 4 to 8 for each full hour as the default, say "Check your tournament's rule", and let the judge change it (done, §11).
2. **`reasonBelow`** for Nationals, UIL, TFA and districts.
3. **Rank pool at NSDA.** The manual does not limit it. Last Chance does. Owner answer: the default is every student present, shown with "Check your tournament's rule", and the judge can switch to "spoke or presided" (done, §11).
4. **Parliamentarian full rank.** NSDA uses it only as the last tiebreak. Is a 30-row rank UI worth it in C6, or is a top-8 rank plus "unranked" enough?
5. **Scorer rotation.** No NSDA rule found. The design assumes a new ballot each session in all leagues.
6. **NCFL and CHSSA scales and PO rules.** Not verified. Nationals Senate and House elims may use other PO hour rules.
7. **UIL PO rule.** Not checked.
8. **Seat chart input.** Paste, tap on a grid, or both?
9. **Timekeeper view.** Build it with the Speaker view, or leave it out?
10. **Session length test.** What device is the slowest one to test 3 hours and 30 rows on?

## 11. Fact check for S6 (2026-11-23)

Each open fact in §10 was checked against primary sources. A fact that is not confirmed is a profile value marked "not verified" (`unverified` in `events/congress/profiles.js`). The setup screen names those values in plain words. No fact blocked the scorer.

| # | Fact | Finding | Source | State |
|---|---|---|---|---|
| 1 | District PO scale | 4 to 8 for each full hour. A part hour is not scored. The same manual's "District Merit Points" line says 1 to 8 for each complete hour of presiding. The app uses 4 to 8 and marks it. | [NSDA-HS] District Congress Officials 5.3; District Merit Points 3 | Confirmed rule, with a conflict inside the manual. Marked. |
| 2 | District speech points | 1 to 8 for each speech. At most 40 points a day for each student. | [NSDA-HS] District Congress Officials | Confirmed |
| 3 | Nationals points | 3 to 9 for each speech and for each complete PO hour. | [NSDA-HS] National Congressional Debate Procedures | Confirmed |
| 4 | `reasonBelow` | Last Chance: below 5 needs substantial written comments. Nationals: the same text, but only in the 2020 scorer instructions (set to 5, marked). District: no number found (null). UIL: no number; the form asks for comments to justify every rating (null). TFA: none found (null, marked). | [LC-S] p.4; [NAT-2020]; [UIL-EV]; [TFA] | LC confirmed; Nationals partial; others none found |
| 5 | Rank pool at NSDA | The manual says scorers rank their 8 most preferred legislators, "which may include POs". It does not limit the pool. The 2020 Nationals and 2023 Last Chance sheets say a student must have spoken or presided. The district and Nationals profiles keep `present` and mark it. | [NSDA-HS]; [LC-S]; [NAT-2020] | Partial. Marked. |
| 6 | Scorer rotation | Nationals prelims: scorers rotate between sessions and rank in each session they judge. Districts: at least two scorers for each session; no rotation rule. The app makes a new ballot (session) each session in every league. | [NSDA-HS] | Confirmed (Nationals); none at districts |
| 7 | UIL | 1 to 6 for each speech; only the first five speeches in a session are scored. PO: "up to six points per clock hour"; the PO form says 2 to 6. No part-hour rule found. A ballot for every member, even those who did not speak. | [UIL-CR27]; [UIL-PO] | Speech confirmed; PO partial (marked) |
| 8 | TFA | IQTs: 0 to 6 for each speech. The parliamentarian gives 0 to 6 for each PO hour (one line also says "and scorers"). State: 1 to 6 for speeches and PO. A wrong-side speech gets no more than 3 points. | [TFA] | Confirmed; PO rule marked for the wording conflict |
| 9 | NCFL, CHSSA | No speech-point scale in either rulebook. NCFL: top 8 ranks, unranked students get 9, the parliamentarian ranks all. CHSSA: ranks only; the PO is a separate win/loss contest. Profiles `ncfl`, `chssa` (prelims, top 9) and `chssa-elim` (1st to 15th) are ranks only: no points grid and no PO prompt. | [NCFL-BY]; [CHSSA-RR] | Confirmed: ranks only. Rank lengths marked where §9 says. |
| 10 | Times | Speeches up to 3:00. 2:00 of questions after authorship or sponsorship and after the first negative; 1:00 after others. Direct questioning blocks of at most 30 s. | [NSDA-HS] Congress event rules | Confirmed |
| 11 | TFA State | Scorers give 1 to 6 for each speech. The parliamentarian gives the PO 1 to 6 at the end of each hour. Top 8 ranks by the scorers and the parliamentarian. A prelim chamber has no more than 20; semifinals and Super Congress no more than 16. Scorers change each prelim session. State floor debate points to the IQT rules, so the wrong-side cap of 3 is read from there. | [TFA] State Tournament: Congressional Debate (Chambers, Scoring, Semifinal, Super Congress) | Confirmed; wrong-side cap, `reasonBelow` and rank pool marked |

Update after the screen review ([CONGRESS-REVIEW.md](CONGRESS-REVIEW.md)): the app no longer decides rows 1 and 5 for the judge. Setup shows each unverified value as a choice with "Check your tournament's rule": the PO points for each full hour (4 to 8 first, or 1 to 8) and who can be ranked (every present legislator first, or only those who spoke or presided). The chamber keeps the pick. UIL's PO range (2 to 6, or 1 to 6) gets the same choice. Congress shows a "Beta" tag.

Owner-confirmed defaults for rows 1 and 5: the district PO default is 4 to 8 for each full hour, and the NSDA rank pool default is every present legislator. Both show "Check your tournament's rule" and both can be changed at setup.

Still open for the owner: §10 items 4 (parliamentarian full rank, S7), 8 (seat chart), 9 (timekeeper view), 10 (slowest device). The TFA State profile (`tfa-state`) and the rank-only NCFL and CHSSA profiles (`ncfl`, `chssa`, `chssa-elim`) are written (rows 9 and 11).

## Sources

- [LC-S] NSDA 2023 Last Chance Congressional Debate Scorer Instructions: https://s3.amazonaws.com/tabroom-files/tourns/26154/postings/37300/2023RevisedLastChanceScorerInstructions.pdf
- [LC-P] NSDA 2023 Last Chance Parliamentarian Guide: https://s3.amazonaws.com/tabroom-files/tourns/26154/postings/37299/2023RevisedLastChanceParliamentarianInstructions.pdf
- [NSDA-HS] NSDA 2026-27 High School Unified Manual, v2027.1.2: https://docs.google.com/document/d/1hq7-DE6ls2ryVtOttxR4BNpRdP7xUbBr0M3SMYefek8
- NSDA Congressional Debate Guide: https://www.speechanddebate.org/wp-content/uploads/Congressional-Debate-Guide.pdf
- [NSDA-BAL] NSDA Congress ballot (older form, copy): https://newmexicoforensicsclub.readthedocs.io/en/latest/_downloads/ea153451ab597b455a48cfdaa87d7c68/nsda-congressional-debate-ballot.pdf
- NSDA 2020 Nationals scorer instructions: https://www.speechanddebate.org/wp-content/uploads/2020-Revised-Nationals-Scorer-Instructions.doc
- [NYC-G] NYC NSDA district judge guides: https://s3.amazonaws.com/tabroom-files/tourns/37570/postings/69253/NYCNSDAJudgeGuides.pdf
- [UIL-CR] UIL Congress Rules 2024-25: https://uiltexas.org/files/academics/speech/24-25-congress-rules.pdf
- [UIL-SI] UIL State scorer instructions: https://www.uiltexas.org/files/academics/speech/22SCORERInstructions_STATE_.pdf
- [TFA] TFA Constitution and Contest Rules 2026-27: https://docs.google.com/document/d/14F0q0qDvhaVr8bEPhpaCG1sJQJfNOpT_Ycl5wmqC7kg
- [NAT-2020] NSDA 2020 Nationals scorer instructions (same link as above).
- [UIL-CR27] UIL Congress Rules 2026-27 (revised), CONGRESS_RULES_2026_27_Rev.pdf, uiltexas.org.
- [UIL-EV], [UIL-PO] UIL Congress speech and presiding evaluation forms, uiltexas.org (no year printed).
- [NCFL-BY] NCFL Bylaws, updated after the Fall 2025 meeting, for Grand Nationals 2026: ncfl.org.
- [CHSSA-RR] CHSSA Rules and Regulations, posted October 2025: https://www.chssa.org/wp-content/uploads/2025/10/CHSSA.RR_.pdf (Art. XIII, XIV).
- Prior research note: congress-and-panel-research.md (side-session notes, `speech-events/`).
