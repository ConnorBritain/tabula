# Tabula Programs: product spec and data model (draft 1)

Date: 2026-11-21. Status: proposal for owner review. No app code is changed by this doc. No prices are in this doc.

**Tabula Programs** is the third product line, for coaches, teachers and school admins. The owner approved the direction on 2026-11-21. It holds the records of a speech and debate program: students, seasons, tournaments, practice rounds, results, attendance, goals, feedback and learning plans. It makes the reports that coaches must give to schools and leagues. It can turn a photo of a paper ballot into a record, and a coach checks every field before the record is saved. Premium **teaching kits** (slides, videos, worksheets) are a separate paid part.

One line: **Programs keeps the notebook a good coach already keeps, so the coach has more time to coach.**

This doc covers:

- §1 Principles and limits
- §2 Who uses it, and what each role can see and do
- §3 The records
- §4 Data model (tables and fields)
- §5 Reports
- §6 Ballot photo to record
- §7 Main screens
- §8 How Programs extends the team plans and the school space
- §9 Student data: laws, least data, retention
- §10 Tabroom: what we do and do not do
- §11 Teaching kits
- §12 First pilot: one policy team
- §13 Build order
- §14 Risks
- §15 Open questions for the owner

Words in this doc:

| Word | Meaning |
|---|---|
| **Program** | One school's (or one club's) speech and debate program. It is the same entity as the school space in `docs/STUDENT-EDITION.md` §10h step 3. |
| **Team space** | A squad inside a program, for example "Policy varsity" or "Novice LD". |
| **Season** | One school year of competition, from a start date to an end date the program sets. Default: August 1 to July 31. |
| **Entry** | One competitor unit at one tournament: a policy partnership, an LD debater, or a speech entry. |
| **Help** | In the app's words, any automated part (for example "ballot reading help"). This doc uses "AI" only in the rules and data sections (§6, §9), where people check data and rules. |

---

## 1. Principles and limits

### 1a. Principles

1. **People make the judgments.** The app stores, counts and sorts. It does not grade, rank or decide. A coach or a teacher writes every piece of feedback (`docs/STUDENT-EDITION.md` §10a).
2. **The notebook test.** A new feature must pass the test in `docs/STUDENT-EDITION.md` §10d: "Would a good coach do this with a notebook and a conversation?" If a feature exists only because software can count things, we do not build it.
3. **Least data.** Store only the fields a coach needs for coaching and for the reports in §5. No demographics. No grades. No discipline records. No health data. No audio. No device or activity tracking.
4. **The school controls the data.** Program data is an education record. The school admin can see what is stored, export it and delete it (§9).
5. **A coach checks every automated field.** Ballot reading help (§6) fills fields. Nothing goes into a record until a coach checks it and saves it.
6. **No ranking of students against each other for students to see.** A coach can sort a table. A student never sees a list that ranks them against teammates (`docs/STUDENT-EDITION.md` §10d).
7. **No nagging.** No streaks, no points, no "you are behind" messages, no automatic messages to parents (`docs/library/TRACKS.md` §6.2). One due-date notice for an assignment is the limit.
8. **Start small.** The first pilot is one policy team (§12). Each build step is useful alone (§13).
9. **The round never needs the server.** Programs is an add-on. The clock, flow and ballot in Tabula Debate keep working with no account and no network (`docs/design/AI-POLICY.md` §0 rule 3).

### 1b. What Programs is not

- **Not a tab system.** Tabroom, SpeechWire and similar sites run tournaments: entries, pairings, tab, official results. Programs does not do these things (§10).
- **Not a grade book.** Programs does not give class grades. A teacher may export completion data to a grade book, and the teacher decides the grade.
- **Not a parent portal.** No parent dashboard (`docs/STUDENT-EDITION.md` §10i item 5). Parents ask the student or the school for an export.
- **Not a live coaching tool.** No coach view of a student's live competitive round, no messages during a round (`docs/STUDENT-EDITION.md` §4c).
- **Not a recruiting or scouting tool.** Programs does not keep files on other schools' students.

---

## 2. Who uses it, and what each role can see and do

### 2a. Roles

| Role | Who | How they get the role |
|---|---|---|
| **School admin** | Activities director, principal, district privacy officer | The program admin invites them by email. Or the school admin opens the program first and invites the head coach. An adult account (18+). |
| **Program admin (head coach)** | The person who owns the program | The buyer, or the person who opens the free school space (`docs/marketing/PROGRAMS-PAGE.md` §5a). An adult account. |
| **Coach** | Assistant coach | The program admin invites them. An adult account. |
| **Teacher** | A teacher of a speech or debate class, who may not coach a team | The program admin or school admin invites them. An adult account. |
| **Student** | A debater or speaker, 13 or older | Joins with a join code (`docs/STUDENT-EDITION.md` §10d), with school consent. |
| **Program judge** | Parent, alum, hired judge | Unchanged from `docs/design/AI-POLICY.md` §1a. Judges get no access to Programs records. |

One person can have more than one role (for example a coach who also teaches the speech class). The app shows the union of what those roles allow. A student account can never hold an adult role.

### 2b. What each role can see

✓ = can see. ◐ = can see a part (see the note). – = cannot see.

| Record | School admin | Program admin | Coach | Teacher | Student |
|---|---|---|---|---|---|
| Roster (names, graduation year, team spaces) | ✓ | ✓ | ✓ (their team spaces) | ◐ students in their class sections | ◐ own row; first names of their team space |
| Seasons, tournaments, practice calendar | ✓ | ✓ | ✓ | ◐ their sections' events | ✓ their team space's calendar |
| Results (win/loss, speaker points, ranks) | ◐ totals and counts only (note 1) | ✓ | ✓ (their team spaces) | – (note 2) | ◐ own entries only (note 3) |
| Attendance | ◐ counts per student (note 1) | ✓ | ✓ (their team spaces) | ✓ (their sections) | ◐ own attendance only |
| Season goals and progress | ◐ count met / not met | ✓ | ✓ (their team spaces) | ✓ (their sections) | ◐ own goals only |
| Feedback notes | – (note 4) | ✓ | ✓ notes they wrote, and notes shared with all coaches | ✓ notes they wrote | ◐ notes marked "shared with student" |
| Learning plans | – | ✓ | ✓ (their team spaces) | ✓ (their sections) | ◐ own plan only |
| Ballot photos | – | ✓ until checked | ✓ until checked | – | – |
| Audit log | ✓ | ✓ | – | – | – |
| Data controls (export, delete, retention) | ✓ | ✓ (not delete-program, note 5) | – | – | ◐ export of own record |

Notes:

1. **School admin views are summaries.** The school admin console (§7.10) shows counts and totals: number of students, tournaments attended, rounds, wins and losses for the program, attendance rates. It shows names where a report needs them (for example a travel roster). It does not show feedback text.
2. A teacher who is not also a coach does not see competition results. If the teacher needs them, the program admin gives them the coach role.
3. A student sees results for entries they were part of. In a policy partnership, both partners see the entry's record, both partners' speaker points and the judges' decisions, the same as on the ballot itself.
4. **Feedback is a coaching note.** Under FERPA, the school can get it. The school admin gets it only through a full data export (§9d), and every full export goes into the audit log. There is no screen for an admin to browse coaching notes. This keeps the talk between coach and student honest.
5. Only the school admin can delete the whole program, when a school admin exists. If no school admin exists, the program admin can.

### 2c. What each role can do

| Action | School admin | Program admin | Coach | Teacher | Student |
|---|---|---|---|---|---|
| Sign the data agreement and the school consent for students | ✓ | ◐ only if the school allows (§9b) | – | – | – |
| Invite and remove coaches and teachers | ✓ | ✓ | – | – | – |
| Add and remove students, make join codes | – | ✓ | ✓ (their team spaces) | ✓ (their sections) | – |
| Make seasons and team spaces | – | ✓ | – | – | – |
| Add tournaments and enter results | – | ✓ | ✓ | – | ◐ suggest a result for own entry (note 1) |
| Log practice rounds and attendance | – | ✓ | ✓ | ✓ (class sessions) | – |
| Set season goals | – | ✓ | ✓ | ✓ | ◐ add a personal goal (note 2) |
| Write feedback, make learning plans | – | ✓ | ✓ | ✓ | – |
| Mark a learning-plan item done | – | ✓ | ✓ | ✓ | ✓ own items |
| Upload a ballot photo and check it | – | ✓ | ✓ | – | – (note 3) |
| Make reports | ✓ summary reports | ✓ | ✓ | ✓ class reports | – |
| Set the AI policy | – | ✓ | ◐ if allowed (`docs/design/AI-POLICY.md` §1) | – | – |
| Set retention and data rules (§9e) | ✓ | ✓ until a school admin exists | – | – | – |
| Export own record | ✓ | ✓ | ✓ | ✓ | ✓ |

Notes:

1. **Student suggestions.** A student can paste their own result (for example from their Tabroom results page) as a suggestion. A coach accepts or edits it. A suggestion is not part of the record until a coach accepts it.
2. **Personal goals.** A student can add a goal for themself ("Read 3 Library lessons on theory"). Only the student and their coaches see it. A coach cannot delete a student's personal goal; a coach can hide it from their own view.
3. Students do not upload ballot photos in the first version. Ballots often show other students' names. Coaches are adults under the data agreement (§6c).

---

## 3. The records

### 3a. Students (roster)

A roster row is a **record about a student**. It is separate from a **student account**. A coach can keep a roster row for a student who has no account yet. The row links to the account when the student joins with the code.

Fields on a roster row: display name (first name and last initial by default), graduation year, team spaces, events (for example Policy, LD, Informative), status (active, inactive, graduated), optional school student ID (off by default; on only if the school's reports need it, §15 Q9).

Not stored: birth date, address, phone, parent details, gender, race, disability, income, grades, photos.

### 3b. Seasons

A season has a name ("2026-27"), a start date and an end date. All other records belong to a season. A new season copies the roster and team spaces, not the records. Last season stays readable until its retention date (§9e).

### 3c. Tournaments

A tournament record has: name, start and end dates, city and state, level (local, state, national circuit, league, online), the events the program entered, and an optional link to the tournament's public page. It can also have the travel list (§5) and a free-text logistics note.

A tournament has **entries**. An entry has: event, division (novice, JV, open/varsity), entry code as the tournament showed it (for example "Lincoln AB"), the students in it, and the entry's **results**.

### 3d. Results

For debate events, one result row per round:

- Round label ("R1" to "R6", "Doubles", "Octas", and so on), and whether it is prelim or elim.
- Side (Aff/Neg, or Pro/Con).
- Opponent entry code (text only, as the tournament printed it, §9c).
- Decision for each judge: win or loss (a panel has more than one).
- Speaker points for each student in the entry, on the format's scale (policy and LD: 0 to 30 in steps of 0.1 or 0.5; the format file sets the scale, `docs/architecture/ARCHITECTURE.md` §9).
- Speaker rank in the round, where the ballot has one.
- Judge name: optional, off by default (§15 Q7).
- Source: typed, pasted, or from a ballot photo (§6). Who checked it and when.

For the entry as a whole: prelim record (for example 4–2), break or no break, elim result, speaker awards and team awards (place and title, typed by the coach).

For speech events (later, with Speech Events): rank and rating per round, final place. The data model in §4 has room for them, but the pilot does not use them.

### 3e. Practice rounds

A practice round has: date, format, the students on each side, who judged (coach, teacher, alum, other student), the decision (optional; many practice rounds have no decision), speaker points (optional), and links to feedback notes.

A coach can make a practice round from a round saved in Tabula Debate: the judge app exports the round's RFD and comments as a file (`docs/STUDENT-EDITION.md` §10h step 1). Programs imports the RFD and comments only. It does not import flows, transcripts or audio.

### 3f. Attendance

Attendance is for **practice sessions** and **class sessions**. A session has a date, a type (practice, class, meeting, tournament day) and a list of students with a mark: present, absent, excused. The coach takes it with one tap per student. Tournament attendance comes from the tournament's entries and travel list. A coach does not mark it again.

No reasons for absence are stored, only "excused" (§9a).

### 3g. Season goals

A goal belongs to a season and to one student, one team space, or the whole program. It has a **measure** and a **target**. The app counts progress from the records. Measures in the first version:

| Measure | Counted from |
|---|---|
| Tournaments attended | Entries the student was in |
| Practice rounds | Practice rounds the student was in |
| Practice sessions attended | Attendance marks "present" |
| Library lessons done | Learning-plan items of type "Library lesson" marked done |
| Learning-plan items done | All learning-plan items marked done |
| Rounds with feedback | Practice rounds with at least one feedback note shared with the student |
| Custom | A coach marks it met or not met by hand ("Give a speech to the school board") |

Example: the default program goal "4 tournaments and 10 practice rounds" is two goals with one name: tournaments attended ≥ 4, practice rounds ≥ 10.

Rules:

- Progress shows as a plain count: "3 of 4 tournaments". No bar that turns red, no percent, no comparison with teammates.
- **Win/loss and speaker points are never goal measures.** A student controls effort and practice. A student does not control the judge. A coach can still write "break at a state tournament" as a custom goal, if the coach and student agree.
- The app sends no messages about goals. The student sees their goals on their own page.
- Goals can count toward school reports (for example letter criteria, §5).

### 3h. Feedback

A feedback note has: author (coach or teacher), student or entry, date, what it is about (a practice round, a tournament round, a speech, or general), the text, and visibility:

- **Coaches only** (default for notes on a tournament round with a ballot photo, because those notes can quote the judge).
- **Shared with student.**
- **Private to me** (the author only).

The coach writes the text. The app does not write or rewrite feedback. A coach can attach the judge's written RFD from a checked ballot, as a quote marked "Judge's words".

Judge feedback that reaches a student through the encrypted judge feedback inbox (`docs/STUDENT-EDITION.md` §10d, §10h step 5) stays the student's. It enters Programs only if the student shares it with their coach.

### 3i. Improvement and learning plans

A learning plan belongs to one student and one season. A coach or teacher makes it, often after feedback ("Your 2AR drops too much. Do these three things."). It has a short goal line in the coach's words and a list of **items**. Item types:

| Item type | What it links to |
|---|---|
| **Library lesson** | A free Debate Library lesson by its ID (the file name, for example `how-to-flow`) and its version. Opens at `tabuladebate.com/learn/`. |
| **Library track** | A Library track by its ID from `docs/library/tracks.json` (for example `novice`). Done means the track is done (`docs/library/TRACKS.md` §6.2). |
| **Drill** | An assignment in Tabula Debate practice mode (`docs/STUDENT-EDITION.md` §10d), for example "Redo your 1AR from Round 3". |
| **Kit item** | A slide set, video or worksheet from a teaching kit the program has a licence for (§11). |
| **Practice round** | "Do a practice round on the Neg against the States CP." |
| **Custom** | A free-text task. |

Each item has a status: not started, done. A student marks their own items done. A coach can add a note. There is no score, no time spent, no count of tries (`docs/library/TRACKS.md` §6.2).

A plan can be copied to more students as a starting point. Each copy is then the student's own.

---

## 4. Data model

The server is one Cloudflare Worker with D1 (SQLite) (`docs/architecture/ARCHITECTURE.md` §1). Programs adds tables to the coach part (`coach/*`). Rules for every table:

- Every row carries `program_id`. One shared query helper always filters by it (`docs/architecture/ARCHITECTURE.md` §7).
- IDs are random (not counters). Times are UTC.
- Every row that holds student data carries `season_id`, so retention can delete by season (§9e).
- Writes go into `audit_log` (who, what table, what row, what action, when). The audit log holds no field values.

### 4a. Tables that exist or are already planned

| Table | Status | Programs uses it for |
|---|---|---|
| `users`, `identities` | Planned (`docs/architecture/ARCHITECTURE.md` §5) | Accounts for every role. Birth year for students (`docs/library/TRACKS.md` §6.4). |
| `programs` | Planned (`docs/STUDENT-EDITION.md` §10h step 3) | The program. Gains the fields below. |
| `memberships` | Planned | Role in a program. Gains the roles `school_admin` and `teacher`. |
| `team_spaces` | Planned | Squads. Programs adds `kind`: `team` or `class_section`. |
| `join_codes` | Planned | Unchanged. |
| `consents` | Planned (`docs/library/TRACKS.md` §6.4) | School consent and parent consent records. |
| `assignments` | Planned (`docs/STUDENT-EDITION.md` §10h step 4) | Drill items in learning plans point here. |
| `ai_policy` | Planned (`docs/design/AI-POLICY.md` §2) | Also covers ballot reading help (§6). |
| `ledger`, `usage` | Planned | Ballot reading uses rounds from the team pool (§15 Q5). |

### 4b. New and changed tables

**`programs`** (changed: new fields)

| Field | Type | Note |
|---|---|---|
| `id`, `name`, `created_at` | | Existing plan |
| `tier` | text | `free_space`, `team_plan`. Existing plan (free-tier flag). |
| `modules` | text (JSON list) | Which Programs parts are on: `records`, `ballot_reading`, `reports`, `kits`. |
| `school_name`, `school_state` | text | For reports and for state-law rules (§9). |
| `level` | text | `middle`, `high`, `college`, `club`. |
| `retention_seasons` | integer | How many past seasons to keep while the program renews (§9e). |
| `data_agreement_id` | text | Points to the signed data agreement record. |

**`seasons`**

| Field | Type | Note |
|---|---|---|
| `id`, `program_id` | | |
| `name` | text | "2026-27" |
| `starts_on`, `ends_on` | date | Default August 1 to July 31 |
| `delete_after` | date | `ends_on` + retention (§9e). Set by the server. |

**`students`** (roster rows; a record about a student, not an account)

| Field | Type | Note |
|---|---|---|
| `id`, `program_id` | | |
| `user_id` | text, null | Links to the student's account after they join. Null until then. |
| `display_name` | text | First name and last initial by default. |
| `grad_year` | integer | For grade and letter reports. |
| `school_student_id` | text, null | Off by default (§15 Q9). |
| `status` | text | `active`, `inactive`, `graduated`, `left`. |
| `left_on` | date, null | Starts the leaver retention clock (§9e). |

**`student_seasons`** (a student's membership in one season)

| Field | Type | Note |
|---|---|---|
| `student_id`, `season_id`, `program_id` | | |
| `team_space_ids` | text (JSON list) | |
| `events` | text (JSON list) | Format IDs, for example `policy-hs`, `ld` |

**`tournaments`**

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id` | | |
| `name` | text | |
| `starts_on`, `ends_on` | date | |
| `city`, `state` | text | |
| `level` | text | `local`, `league`, `state`, `circuit`, `national`, `online` |
| `public_url` | text, null | The tournament's public page. No login data. |
| `note` | text, null | Logistics only. The screen says "Do not put student health or family details here." |

**`entries`**

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id`, `tournament_id` | | |
| `format_id` | text | From the formats files, for example `policy-hs.v1` |
| `division` | text | `novice`, `jv`, `open`, or custom |
| `entry_code` | text | As the tournament printed it |
| `student_ids` | text (JSON list) | 1 or 2 for debate; more for group events later |
| `prelim_wins`, `prelim_losses` | integer | Computed from `rounds`; stored for speed |
| `broke` | boolean, null | |
| `elim_result` | text, null | For example "Lost in quarters" |
| `awards` | text (JSON list) | `{kind: team|speaker, place, title, student_id?}` |
| `status` | text | `planned`, `entered`, `dropped`, `done` |

**`rounds`** (one competitive round of one entry)

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id`, `entry_id` | | |
| `label` | text | "R1", "Octas" |
| `stage` | text | `prelim`, `elim` |
| `side` | text | `aff`, `neg`, `pro`, `con`, null |
| `opponent_code` | text, null | Entry code only, no names (§9c) |
| `source` | text | `typed`, `pasted`, `ballot_photo`, `student_suggestion` |
| `checked_by`, `checked_at` | | The coach who saved it. Required for every source. |

**`ballots`** (one judge's decision in one round; a panel has more than one)

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id`, `round_id` | | |
| `decision` | text | `win`, `loss`, `bye`, `forfeit` (for this program's entry) |
| `judge_label` | text | "Judge 1" by default. A name only if the program turns it on (§15 Q7). |
| `rfd_text` | text, null | The judge's written reason, if the coach keeps it. |

**`speaker_scores`**

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id`, `ballot_id`, `student_id` | | |
| `points` | decimal | Checked against the format's scale |
| `rank` | integer, null | Rank in the round, if the ballot has one |
| `rating` | integer, null | For speech events later |

**`practice_rounds`**

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id` | | |
| `held_on` | date | |
| `format_id` | text | |
| `sides` | text (JSON) | `{aff: [student_id…], neg: [student_id…]}`. A side can be "Coach" or "Other team" with no ID. |
| `judged_by` | text | `coach`, `teacher`, `alum`, `student`, `other`; plus `user_id` if a member |
| `decision` | text, null | |
| `points` | text (JSON), null | `{student_id: points}` |
| `source` | text | `typed`, `judge_app_file`, `ballot_photo` |

**`sessions`** and **`attendance`**

| Table | Fields |
|---|---|
| `sessions` | `id`, `program_id`, `season_id`, `team_space_id`, `held_on`, `kind` (`practice`, `class`, `meeting`) |
| `attendance` | `session_id`, `student_id`, `program_id`, `season_id`, `mark` (`present`, `absent`, `excused`) |

**`goals`**

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id` | | |
| `scope` | text | `program`, `team_space`, `student` |
| `scope_id` | text, null | |
| `name` | text | "4 tournaments and 10 practice rounds" |
| `measure` | text | One of the measures in §3g |
| `target` | integer | |
| `set_by` | text | `coach` or `student` (personal goal) |
| `met_manual` | boolean, null | For `custom` only |

Progress is not stored. The server counts it when a screen or report asks.

**`feedback_notes`**

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id` | | |
| `author_id` | text | A coach or teacher |
| `student_id` or `entry_id` | text | |
| `about_kind`, `about_id` | text, null | `practice_round`, `round`, `session`, or null |
| `body` | text | |
| `visibility` | text | `coaches`, `student`, `private` |
| `judge_quote` | boolean | True when the body quotes a judge's RFD |

**`learning_plans`** and **`plan_items`**

| Table | Fields |
|---|---|
| `learning_plans` | `id`, `program_id`, `season_id`, `student_id`, `title`, `goal_line`, `made_by` |
| `plan_items` | `id`, `plan_id`, `program_id`, `season_id`, `kind` (`library_lesson`, `library_track`, `drill`, `kit_item`, `practice_round`, `custom`), `ref` (lesson ID, track ID, assignment ID or kit item ID), `ref_version`, `title`, `due_on` (null), `status` (`not_started`, `done`), `done_on` |

**`ballot_scans`** (§6)

| Field | Type | Note |
|---|---|---|
| `id`, `program_id`, `season_id` | | |
| `uploaded_by` | text | A coach |
| `image_key` | text, null | Key of the encrypted image in R2. Null after deletion. |
| `status` | text | `uploaded`, `read`, `checked`, `discarded`, `expired` |
| `fields` | text (JSON) | The proposed fields, each with a "not sure" flag |
| `result_round_id` | text, null | The round row made from it, after the check |
| `image_deleted_at` | time, null | |

**`kit_licences`** (§11)

| Field | Type | Note |
|---|---|---|
| `program_id`, `kit_id`, `starts_on`, `ends_on`, `seats` | | No student data |

**`audit_log`**

| Field | Note |
|---|---|
| `id`, `program_id`, `actor_id`, `action`, `table_name`, `row_id`, `at` | No field values. Kept for the data agreement's audit period (§15 Q10). |

### 4c. What the server does not store

- Ballot images after the check, or after 7 days (§6).
- Opponent students' names, judges' names (unless turned on), other schools' data beyond entry codes.
- Flows, transcripts, audio, speech docs, locker files (`docs/STUDENT-EDITION.md` §10e).
- Demographics, grades, discipline, health, reasons for absence.
- Time on page, clicks, device data.

### 4d. API shape (public contract)

The routes go under `/api/v1/coach/` on the Programs host (§8c). The shapes are public in the repo (`docs/architecture/ARCHITECTURE.md` §8). First routes, for the pilot:

```
GET/POST        /coach/programs/:pid/seasons
GET/POST/PATCH  /coach/programs/:pid/students
GET/POST/PATCH  /coach/programs/:pid/tournaments          (+ /:tid/entries, /entries/:eid/rounds)
POST            /coach/programs/:pid/rounds/paste         body: pasted text → proposed rows, nothing saved
GET/POST        /coach/programs/:pid/practice-rounds
POST            /coach/programs/:pid/sessions/:sid/attendance
GET/POST/PATCH  /coach/programs/:pid/goals                 GET returns counted progress
GET/POST/PATCH  /coach/programs/:pid/feedback
GET/POST/PATCH  /coach/programs/:pid/plans                 (+ /:plan/items)
POST            /coach/programs/:pid/ballot-scans          (behind the ballot_reading flag)
GET             /coach/programs/:pid/reports/:kind?season=&format=csv|pdf
GET             /coach/programs/:pid/export                full export (logged)
GET             /me/season                                 student: own record only
```

---

## 5. Reports

Coaches give reports to their school, their district and their leagues. Most coaches make them by hand from paper and spreadsheets today. Programs makes each report from the records. **The coach checks every report before sending it.** The app never sends a report by itself.

Each report is a PDF and a CSV. A report is made when asked and is not stored. The report shows the date and time it was made.

| # | Report | Who asks for it | Contents | First version? |
|---|---|---|---|---|
| R1 | **Season summary** | Activities director, principal, school board | Number of students, tournaments, rounds; program win/loss; awards list; attendance rate; goals met. | Pilot |
| R2 | **Travel roster** | Activities director, bus or travel office, chaperones | For one tournament: students, events, dates, city, coaches and chaperones. No health or contact data (the school has those). | Pilot |
| R3 | **Student season record** | The student, a college application, the coach's letter of recommendation | One student's tournaments, results, awards, attendance count, goals met. The student can get this one from their own page too. | Pilot |
| R4 | **Letter and award check** | Activities director (varsity letters, team awards) | Per student: the counts the school's letter rule uses (for example tournaments, rounds, practice attendance) and met / not met. The program admin types the rule as goals. | After pilot |
| R5 | **Eligibility and participation list** | State activities association or league | Students who competed, with events and dates, in the league's column order. Each league has a template. | After pilot, one league at a time |
| R6 | **Attendance report** | Activities director, stipend or club-hours rules | Sessions held and attendance per student, for a date range. | Pilot |
| R7 | **Class completion** | Teacher, for their grade book | Per student in a class section: learning-plan items done, Library lessons done, kit worksheets done. The teacher decides the grade. | After pilot |
| R8 | **Grant and funding report** | Title I, Urban Debate League, booster club, grant givers | Counts only: students served, tournaments, rounds, practice hours, awards. No names. | After pilot |
| R9 | **Honor society points helper** | The coach, for the honor society's own points system | A list of each student's tournaments and rounds in the order the coach types them into that system. Programs does not send anything to it. | Later (§15 Q11) |

Rules:

- Reports for people outside the program (R1, R5, R8) default to counts. Names appear only where the report needs them (R2, R5).
- No report ranks students against each other, except an awards list that repeats what a tournament announced.
- A league template (R5) is a data file, like a format file. A coach can ask for a new league template. We add league templates one at a time, after a coach in that league checks it.

---

## 6. Ballot photo to record

### 6a. The flow

Many local, league and novice tournaments still use paper ballots. Coaches also write practice ballots on paper. The flow:

1. A coach takes a photo of a ballot in the Programs app (phone camera), or uploads a scan. Several photos at once are fine (a weekend's ballots).
2. The app shows "Reading the ballot…". **Ballot reading help** proposes the fields: tournament, round, side, decision, speaker points, ranks, opponent code, and the RFD text if the coach wants it.
3. The **check screen** shows the photo next to the fields. Each field the help is not sure about has a "Check this" mark and is empty, not guessed. The coach matches each speaker to a roster student (the app suggests a match from the entry; it never makes a new student).
4. The coach fixes what is wrong and taps **Save to record**. Only then does the round row exist.
5. On save, the server deletes the image. If no one saves or discards it, the server deletes it after 7 days.

Rules:

- **No automatic save.** Every field is checked by a coach. The saved row records `checked_by` and `checked_at`.
- The help does not judge the round or comment on it. It copies what the paper says.
- Speaker points outside the format's scale are refused on save ("29.9 is in range; 39.0 is not").
- The coach can always type the record by hand with no photo. The photo path is a shortcut, not the only path.
- Ballot reading is a program setting, **off by default**. The school admin can turn it off at any time (§9b).

### 6b. What the help reads and what it drops

The help returns only these fields: tournament name, round, side, decision, speaker points and ranks next to the speaker positions, the program's own students' names (only to match the roster), opponent entry code, judge name (only if the program keeps judge names), and the RFD text (only if the coach asked for it). It drops everything else, including opponent students' names, judge contact details and any notes about people.

### 6c. AI and data rules for ballot photos

This is the one place where Programs sends student names to an AI provider, because the names are on the paper. The rule in `docs/STUDENT-EDITION.md` §5c ("names stay out of AI prompts") cannot hold for an image. So:

- The photo goes to one listed AI provider (a subprocessor in the data agreement) with a no-retention, no-training contract. The provider is named on the Trust page and in the data agreement. Copy does not favor one AI company; the list of subprocessors is factual.
- The server sends the image and a fixed prompt that asks only for the fields in §6b. The server does not send the roster to the provider. Roster matching happens on our server after the reply.
- The image is stored in R2, encrypted, for at most 7 days (§6a step 5). It is not in backups.
- Only coaches upload. Students do not (§2c note 3).
- The school admin sees this rule in plain words before the program turns ballot reading on, and can say no.
- **Alternative we considered:** read the image on the device and send only text with names replaced. Handwriting recognition on the device is not good enough today for scores in small boxes. We can test it again before a wide launch (§15 Q4).

This needs owner approval and the legal review (§15 Q4).

---

## 7. Main screens

The Programs app is a web app on its own host (§8c). It works on a phone and on a laptop. Every screen meets the accessibility rules in `docs/design/SPEC.md` (keyboard, contrast, no font under 13 px) and the "no stripes" rule (`docs/design/NO-STRIPES.md`).

### 7.1 Program home (coach and program admin)

- Season picker at the top.
- **This week:** next tournament (date, entries, travel roster button), practice sessions, ballots waiting for a check.
- **Season at a glance:** tournaments done and planned, rounds, practice rounds, attendance rate, goals met. Plain numbers, no charts that rank students.
- Quick buttons: **Take attendance**, **Log a practice round**, **Add a ballot photo**, **Add results**.

### 7.2 Roster

- A table: name, grad year, team spaces, events, status, account linked or not.
- **Add students** (type, paste a list, or make a join code).
- A coach can sort by any column. The sort is for the coach's view only.

### 7.3 Student page (coach view)

Tabs: **Record** (tournaments and results), **Practice** (practice rounds and attendance), **Goals**, **Feedback**, **Plan**. One button: **Write feedback**. One button: **Student season record (PDF)**.

### 7.4 Tournaments

- A list by date, with status (planned, entered, done).
- **Tournament page:** details, entries, travel roster, results per entry.
- **Add results:** three ways, side by side: type in a grid (one row per round), paste text (the app proposes rows, nothing is saved until the coach checks), or ballot photos (§6).
- Student suggestions (§2c note 1) appear here with **Accept** and **Edit**.

### 7.5 Practice log

- A list of practice rounds by date.
- **Log a practice round:** date, format, sides (pick students), judge, decision and points (optional), feedback note (optional). Under one minute on a phone.
- **Import from the judge app:** pick the round file the judge app exported.

### 7.6 Attendance

- Pick a session (or make one for today). One tap per student cycles present → absent → excused. Everyone starts as present, because that is the usual case and needs the fewest taps.
- Works with weak Wi-Fi: marks queue on the device and send when the network is back.

### 7.7 Ballot inbox

- Photos waiting, with status. The check screen from §6a.
- A clear line on each photo: "Deleted after you save, or in N days."

### 7.8 Goals

- Program and team goals at the top. Then a table: student, goal, count ("3 of 4"). A coach can sort it. No red, no percent.
- **Set a goal:** pick scope, measure, target. Templates: "4 tournaments and 10 practice rounds", "Attend 80% of practices" (a count of sessions, shown as "N of M"), "Finish the Novice track".

### 7.9 Feedback and plans

- **Write feedback:** pick the student or entry, the round (optional), visibility, text. The coach's words only.
- **Make a plan:** goal line, then add items. A search box finds Library lessons and tracks by title. Kit items appear only if the program has a licence.
- **Reports** live on their own screen (§5) with a season picker and a "Preview, then download" step.

### 7.10 School admin console

The school admin's whole view. It extends the existing program admin screen (`docs/marketing/PROGRAMS-PAGE.md` §4b, "admin screen") with a school-level page:

- **Program summary:** R1 numbers for the season.
- **People:** coaches and teachers, with roles. Invite or remove.
- **Data:** what is stored (the field list from §4, in plain words), the data agreement, the subprocessor list, retention settings (§9e), the ballot reading switch, the audit log.
- **Export everything** and **Delete the program** (with a typed confirmation and a 30-day undo).
- **Paperwork:** the same packet as `docs/marketing/PROGRAMS-PAGE.md` §2 item 7.

A school admin can hold more than one program (for example the middle school and the high school). The console lists them.

### 7.11 Student view ("My season")

On the student host (§8c). It shows only the student's own data:

- **My record:** tournaments and results for entries they were in.
- **My practice:** practice rounds and attendance.
- **My goals:** coach goals and personal goals, as counts.
- **My feedback:** notes shared with them, and judge feedback they received.
- **My plan:** items with links. Tap **Done** on an item.
- **Suggest a result:** paste a result for a coach to check.
- **Export my record** (`docs/STUDENT-EDITION.md` §10e).

No teammate rankings, no team leaderboard, no badges for logging in.

### 7.12 Teacher view

Like the coach view, but by **class section** instead of team space: roster, attendance, learning plans, feedback, kit items, class completion report (R7). No tournament results unless the teacher is also a coach.

---

## 8. How Programs extends the team plans and the school space

### 8a. One program entity

Programs is not a new account system or a new program object. It adds modules to the program that `docs/STUDENT-EDITION.md` §10h step 3 already plans:

| Today's plan | What Programs adds |
|---|---|
| **Free school space** (`docs/library/TRACKS.md` §6): join code, track assignments, done or not done, badges, AI policy switches | Nothing is taken away. Optional: the roster and attendance (§15 Q2). |
| **Team plans: Whole Team and Seats** (`docs/marketing/PROGRAMS-PAGE.md` §4a): coach tools (roster, assignments, feedback inbox, Library tracks), hosted AI pool | Records: seasons, tournaments, results, practice rounds, attendance, goals, feedback notes, learning plans, reports. Ballot reading uses the team pool. |
| **Program admin screen** (`docs/marketing/PROGRAMS-PAGE.md` §4b) | The school admin role and console (§7.10). Retention settings. Audit log. |
| **AI policy** (`docs/design/AI-POLICY.md`) | One new switch: "Ballot reading help" (program level, default off). It follows the same rules: a policy only removes a feature. |
| **Coach MVP steps** (`docs/STUDENT-EDITION.md` §10h) | Steps 1 to 5 stay. Programs adds the records steps after step 3 (§13). `docs/STUDENT-EDITION.md` §10h says "Not in the coach MVP: team results lists … Tabroom import". That stays true for the coach MVP. Programs makes them a separate line, built after the MVP's step 3. |

### 8b. Plans and prices

No prices are in this doc. The pricing question is open (§15 Q1). Two options:

- **Option 1 (recommended):** records, goals, feedback, plans and reports are part of the coach tools in Whole Team and Seats. Ballot reading uses rounds from the team pool. Teaching kits are a separate paid licence (§11). This keeps one plan for schools to buy.
- **Option 2:** Programs is an add-on to a team plan.

### 8c. Hosts

`docs/architecture/ARCHITECTURE.md` §2.2 plans a `coach` host for coach and school spaces. Recommendation:

- Coach, teacher and school admin screens: **`programs.tabulaspeech.com`** (instead of `coach`, so the name matches the product line).
- Student screens ("My season"): **`student.tabulaspeech.com`**, so a student device never gets an adult session (`docs/library/TRACKS.md` §6.2, `docs/architecture/ARCHITECTURE.md` §3.2).
- Sales page: **`tabulaspeech.com/programs`**. That path is the team plans page today (`docs/marketing/PROGRAMS-PAGE.md`). The Programs line becomes a section of the same page, not a second page (§15 Q3).

### 8d. Link to Tabula Debate

- A practice round judged in Tabula Debate can go to Programs as a file (§3e). Later, a signed-in coach can send it with one tap.
- A student's tournament result can come from their own Tabula Debate round log only if the student shares it (`docs/STUDENT-EDITION.md` §10i item 4).
- The judge app does not change. Nothing in Programs is needed for a round.

### 8e. Link to the Library

- Learning-plan items point to Library lessons and tracks by ID and version. The Library stays free and public (CC BY-SA, `docs/library/LICENSE.md`).
- When a Library lesson changes version, a plan item keeps its old version number and shows "Updated since this was assigned". A coach can update it.
- Library progress for a student comes only from track assignments and plan items, as "done" or "not done" (`docs/library/TRACKS.md` §6.2).

---

## 9. Student data: laws, least data, retention

### 9a. Least data

Every field in §4 has a reason: a coaching need or a report in §5. A field with no reason is not added. The "not stored" list in §4c is part of the public data rules.

### 9b. Laws and agreements

| Rule | What Programs does |
|---|---|
| **FERPA** | Program records are education records. The school controls them. Tabula acts as a "school official" under the data agreement (`docs/STUDENT-EDITION.md` §10e). The school admin signs, or the program admin signs only if the school says they may. |
| **COPPA** (under 13) | No student accounts under 13 (`docs/library/TRACKS.md` §6.1). See §9f for middle school. |
| **State student-privacy laws** (for example CA SOPIPA, NY Education Law 2-d, IL SOPPA) | No ads, no sale, no profiling, no training AI on student data. List every subprocessor. Some states need a signed state addendum; the custom quote path handles it (`docs/marketing/PROGRAMS-PAGE.md` §5d). |
| **Data agreement** | The SDPC National DPA, ready before any school signs (`docs/STUDENT-EDITION.md` §5c). The pilot uses it too. |
| **Age-appropriate design rules** | Highest privacy by default for students. No public student pages. No nudges (`docs/library/TRACKS.md` §6.3). |

### 9c. Other people's data

Ballots and results name people outside the program: opponents and judges.

- **Opponents:** only the entry code, as printed. No opponent student names are stored. Ballot reading drops them (§6b).
- **Judges:** "Judge 1" by default. A program can turn on judge names for its own coaches (§15 Q7). Judge names never show to students in Programs, unless the judge chose to send feedback with their name (`docs/STUDENT-EDITION.md` §10i item 2).

### 9d. Access and export

- **Student:** export their own record at any time, as plain files (`docs/STUDENT-EDITION.md` §10e). The export is the student's copy. It does not give the student control of the school's record.
- **Corrections:** a student or parent asks the school (FERPA). In the app, a student can flag a result as wrong; the flag goes to the coach.
- **School admin:** full export (every table for the program, as CSV in a zip). Every full export goes into the audit log.
- **Deletion:** the school admin can delete one student's records or the whole program. A deleted program has a 30-day undo, then the data is gone, and backups expire on a fixed schedule.

### 9e. Retention

The decided rule stays: program data is deleted 120 days after the season ends **unless the program renews** (`docs/marketing/PROGRAMS-PAGE.md` §5c, `docs/STUDENT-EDITION.md` §10i item 3). Reminders go 30 days before, 7 days before and on the day, each with an export link.

Programs adds two rules for a program that renews:

1. **Past seasons.** A renewing program keeps past seasons up to `retention_seasons` (proposed default: 4, so a coach can see a student's whole high-school record). The school admin can set it lower, down to 1 (current season only). Each season past the limit is deleted 120 days after its end, with the same reminders.
2. **Students who leave or graduate.** A student who leaves or graduates keeps their records in the program until the end of the current season plus 120 days. Then their rows are deleted, unless the school admin chose to keep them for a set time (for example for letter records). The student gets the export link before deletion.

**Kept after deletion:** counts with no names (for example "2026-27: 14 students, 9 tournaments, 212 rounds"), so a program keeps its history. The audit log follows the data agreement's period.

### 9f. Middle school and college

- **Middle school (under 13):** no student accounts. Two paths, for owner decision (§15 Q8):
  - (a) Coach-only records for under-13 students, with no student login, under the school's consent and the data agreement. Display name is first name and last initial. The student gets nothing from the app directly. The coach prints the student season record.
  - (b) No under-13 records until a COPPA review.
  - Recommendation: (b) for the pilot, (a) after the review.
- **College:** students are adults. FERPA still applies when the college is the customer. Debaters may also hold their own accounts. College is not in the pilot.

---

## 10. Tabroom: what we do and do not do

Note: the task named `docs/research/TABROOM.md`. That file is not on any branch on 2026-11-21. This section uses the Tabroom notes in the other docs (`docs/events/ARCHITECTURE.md` §1, §8; `docs/growth/FORMATS.md`; `docs/STUDENT-EDITION.md` §10d). Check this section again when `TABROOM.md` lands.

Tabroom runs tournaments. Many coaches use it for entries and see results there. Programs **does not compete with it**:

| Tabroom does | Programs does |
|---|---|
| Entries, judges, pairings, tab, official results | Nothing of this |
| A results page for each competitor and school, per tournament | Keeps a program's own record across all tournaments, including the many that are not on Tabroom, and practice rounds, attendance, goals, feedback and plans |
| Online ballots | Paper ballots and practice ballots to records (§6) |

How results get from Tabroom into Programs:

- **Paste.** A coach or student copies their own results text from a Tabroom results page and pastes it. The parser proposes rows. A coach checks them. The parser falls back to "one round per line" and puts unclear lines under "Check these" (the same pattern as `docs/events/PLAN.md` R5).
- **No scraping, no Tabroom passwords, no automated pulls** in the first version. We do not log in to Tabroom as the coach.
- **Later:** if Tabroom offers a public, permitted export or API for a school's own results, we can use it, with Tabroom's permission. That is a partnership question (§15 Q12).

The app's words never put Tabroom down. The vendor-name test in `docs/design/SPEC.md` (`copy-dialogs.test.mjs`) covers the judge app. The Programs app gets the same rule: Tabroom is named only in the paste help text.

---

## 11. Teaching kits

- A **teaching kit** is a premium set of slides, videos and worksheets for one unit (for example "Intro to policy debate, 3 weeks" or "Informative speaking unit"). It is **new content**, made for classroom teachers and coaches.
- Kits are **separate and paid**, by a licence per program per season (`kit_licences`). No prices here.
- **The Library stays free** (CC BY-SA). A kit can link to Library lessons. A kit does not copy a Library lesson behind a paywall. A Library lesson never moves into a kit.
- Kit content has its own licence (all rights reserved, for licensed programs). It is not in the public repo.
- In Programs, kit items appear in learning plans (§3i) and in the teacher view (§7.12). A worksheet "done" is a status, like any plan item. Worksheet answers are not stored in the first version.
- Kits are not in the pilot. They need content first. The pilot tests learning plans with free Library lessons only.

---

## 12. First pilot: one policy team

### 12a. Shape

| Item | Pilot |
|---|---|
| Program | One high school policy debate team, with 1 or 2 coaches and about 8 to 20 students. |
| Time | The second half of the 2026-27 season: January to the end of the team's season. |
| Plan | Free for the pilot, under a written pilot agreement and the SDPC National DPA, signed by the school. |
| School admin | The school's activities director or privacy officer signs and gets the console (data page, export, delete). |
| Students | 13 and older, with school consent. Student accounts are optional: a coach can keep records with no student accounts. |
| Format | Policy (`policy-hs.v1`) only. |

### 12b. In the pilot

1. Roster, one season, team spaces.
2. Tournaments, entries and results: typed grid and paste. Student suggestions.
3. Practice rounds, including import from a judge app file.
4. Attendance for practice sessions.
5. Season goals with the first measures (§3g), and the "4 tournaments and 10 practice rounds" template.
6. Feedback notes with the three visibility levels.
7. Learning plans with Library lessons, Library tracks and custom items.
8. Reports R1, R2, R3 and R6.
9. School admin console: data page, export, delete, audit log.
10. "My season" for students who join.
11. **Ballot photo to record, behind a flag:** on only if the owner approves §6c, the school admin agrees, and the coach turns it on. Coach uploads only.

### 12c. Not in the pilot

Speech events, LD or PF, middle school, college, teaching kits, league templates (R5), letter check (R4), grant report (R8), honor society helper (R9), class sections and the teacher view, any Tabroom link beyond paste, multi-school admin.

### 12d. What we measure

We ask the coaches. We do not track clicks.

| Question | How |
|---|---|
| Minutes per week the coach spends on records, before and during the pilot | A short form every 2 weeks |
| Minutes to make the season summary for the activities director | Timed once, by the coach |
| Ballot reading: fields the coach had to fix, per ballot | Counted on the check screen (a count per scan, no content) |
| Did students use "My season"? Did they find it useful? | A short student survey with school consent, at the end |
| Did the school admin find the data page clear? | One interview |
| Anything that felt like surveillance or ranking | Open question in every form |

### 12e. Pass, change or stop

- **Pass:** coaches save time each week, the summary takes under 10 minutes, and no one reports a feeling of surveillance. Then plan a second pilot with a speech program and a middle school.
- **Change:** a part is not used or feels wrong. Cut it or fix it before more pilots.
- **Stop:** the school admin or coaches find the data rules unclear or wrong, or ballot reading makes more errors than typing. Fix first.

---

## 13. Build order

Each step is useful alone. Steps 1 to 3 are the coach MVP steps that already exist (`docs/STUDENT-EDITION.md` §10h).

| Step | What | Depends on |
|---|---|---|
| 0 | Accounts (planned, `docs/architecture/ARCHITECTURE.md` §5) | — |
| 1 | Programs, memberships, join codes (coach MVP step 3) | 0 |
| 2 | School admin role, data page, export, delete, audit log | 1, signed DPA text |
| 3 | Seasons, roster, tournaments, entries, results (typed and pasted) | 1 |
| 4 | Practice rounds, attendance | 3 |
| 5 | Goals (counted), feedback notes, learning plans with Library links | 3, 4 |
| 6 | Reports R1, R2, R3, R6 | 3, 4, 5 |
| 7 | "My season" on the student host | 3, 5, student accounts (`docs/library/TRACKS.md` §6) |
| 8 | Ballot photo to record (behind a flag) | 3, owner decision §15 Q4, legal review |
| — | **Pilot runs on steps 1 to 7, plus 8 if approved** | |
| 9 | Teacher view and class sections; R7 | Pilot feedback |
| 10 | Teaching kits | Content, licence terms |
| 11 | Speech events results, league templates, R4, R5, R8 | Speech Events app formats |

---

## 14. Risks

| Risk | What could go wrong | Answer |
|---|---|---|
| **Student data** | A leak or misuse of minors' records. | Least data (§9a). DPA. Encryption at rest and in transit. Program-scoped queries (§4). Audit log. Public data rules. Legal review before the pilot. |
| **Ballot photos** | Photos show names of other schools' students; a provider keeps them. | Coach upload only, off by default, 7-day maximum, no-retention provider contract, fields dropped (§6). Owner and school admin must approve. |
| **Surveillance feeling** | Goals and attendance feel like tracking. Students feel ranked. | No rankings for students, no nags, no percent, no red (§1a, §3g). Ask about it in every pilot form (§12d). |
| **Tabroom overlap** | Coaches see it as a second Tabroom, or Tabroom sees us as a rival. | We do not run tournaments (§10). Paste only. Talk to Tabroom before any deeper link. |
| **Scope** | Programs grows into a school information system. | The notebook test (§1a). The "not" list (§1b). The pilot list (§12c). New fields need a report or coaching reason. |
| **Errors in records** | A wrong result goes into a college letter or a league list. | A coach checks every automated field and every report. Students can flag errors. |
| **Two sources of truth** | A student's record in Programs and on Tabroom disagree. | The tournament's result is the official one. The app says so on the student season record. |
| **Money gap** | Only rich programs get records. | The Title I / UDL discount applies (`docs/marketing/PROGRAMS-PAGE.md` §3b). Ask whether the roster and attendance go in the free school space (§15 Q2). |

---

## 15. Open questions for the owner

1. **Q1. Pricing shape.** Are records, goals, feedback, plans and reports part of the Whole Team and Seats coach tools (recommended), or a separate add-on? Do teaching kits sell per program, per teacher, or per kit?
2. **Q2. Free school space.** Do the roster and attendance go into the free school space, or only into paid plans? (Recommended: roster yes, because the free space needs a roster for track assignments; attendance and results paid.)
3. **Q3. Domain and sales page.** Use `programs.tabulaspeech.com` for the app (instead of the planned `coach` host) and keep `tabulaspeech.com/programs` as one sales page for team plans and the Programs line? Or give the Programs line its own page?
4. **Q4. Ballot photos and AI.** Do you approve sending ballot images, with names on them, to one listed AI provider under a no-retention contract (§6c)? This is an exception to "names never reach AI". If not, the pilot ships with typed and pasted results only, and we test on-device reading later.
5. **Q5. Ballot reading cost.** Does ballot reading use rounds from the team pool (and how many per ballot), or is it included in the plan?
6. **Q6. Past seasons.** Is 4 seasons the right default for `retention_seasons` while a program renews? Can the school set it higher?
7. **Q7. Judge names.** May a program keep judge names on results for its own coaches (coaches use this to learn judges' preferences)? Recommended: yes, off by default, coaches only, never shown to students.
8. **Q8. Middle school.** For under-13 students: coach-only records with no student login after a COPPA review (path a), or no records at all for now (path b)? Recommended: (b) for the pilot.
9. **Q9. School student ID.** Do we allow an optional school student ID field for schools whose reports need it, or never store it?
10. **Q10. Audit log period.** How long do we keep the audit log? The DPA may set it. Proposed: 3 years, the same as consent records (`docs/library/TRACKS.md` §6.4).
11. **Q11. Honor society points.** Do we build the points helper list (R9), and should we ask the honor society first?
12. **Q12. Tabroom.** May we contact Tabroom's team about a permitted export of a school's own results, before we build any link beyond paste?
13. **Q13. Goals on win/loss.** This spec bans win/loss and speaker points as goal measures (§3g). Do you agree, or should a coach be able to set them?
14. **Q14. Student suggestions.** Can students suggest results (§2c note 1), or only coaches enter them?
15. **Q15. Pilot school.** Do you have a policy team in mind? The pilot needs a school that will sign the DPA and a pilot agreement by mid-December to start in January.
16. **Q16. Teacher role in the first year.** Is the teacher view (class sections, R7) needed before teaching kits exist, or does it ship with the kits?
17. **Q17. Missing research doc.** `docs/research/TABROOM.md` was named as a source but does not exist yet. Should a session write it, and should §10 wait for it?
