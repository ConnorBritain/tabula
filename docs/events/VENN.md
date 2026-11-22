# Speech events: what is shared and what is unique

Status: draft 1, 2026-11-22, for owner review. No code changed.

This file maps every speech event against the parts the app must have. It shows which parts all events share, which parts some events share, and which parts only one event has. A fact-check against the NSDA 2026-27 High School Unified Manual changed some cells. Section 6 lists each change.

Read this file with [MODELS.md](MODELS.md) (the families) and [EXPERIENCE.md](EXPERIENCE.md) (the screens). [CONGRESS.md](CONGRESS.md) has the Congress details.

## 1. Key

| Mark | Meaning |
|---|---|
| **Y** | The event always has this, under NSDA rules or the main league. |
| **opt** | Some leagues have it, some rounds have it (for example elims), or a rules profile turns it on. |
| **-** | The event does not have it. |
| **?** | Not verified. Treat it as unsure. |

Column codes:

| Code | Event |
|---|---|
| OO, INF | Original Oratory, Informative Speaking |
| DI, HI, DUO, POI | Dramatic, Humorous, Duo, Program Oral Interp |
| PRO, POE, STO | Prose, Poetry, Storytelling |
| OSW, DEC, EXP | Original Spoken Word, Declamation, Expository |
| USX, IX, COM, MX | U.S. Extemp, International Extemp, Extemp Commentary, Mixed Extemp |
| IMP | Impromptu |
| PCC | Pro Con Challenge |
| CON | Congressional Debate |
| RAD | Radio (IHSA Radio Speaking, Iowa Radio News) |
| GRP | Group interp (Readers Theatre, Ensemble, and others) |
| DSC | MSHSL Discussion |
| LD | Lincoln-Douglas, when a speech judge judges it (shown for contrast only) |

## 2. Capability matrix

| Capability | OO | INF | DI | HI | DUO | POI | PRO | POE | STO | OSW | DEC | EXP | USX | IX | COM | MX | IMP | PCC | CON | RAD | GRP | DSC | LD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Entries (roster) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Speaking order known ahead | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | - | Y | Y | - | Y |
| One clock per entry | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | - | opt | opt | - | - |
| Grace | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | opt | - | - ? | opt | - | - |
| Time signals | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | - | - | opt | - | opt |
| Prep inside the room | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | opt | - | - | opt | - | Y |
| Prep outside the room, after a draw | - | - | - | - | - | - | - | - | opt | - | - | - | Y | Y | Y | Y | - | - | - | Y | - | - ? | - |
| Drawn question or topic | - | - | - | - | - | - | - | - | opt | - | - | - | Y | Y | Y | Y | Y | - | - | opt | - | Y | - |
| Title, author, piece | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | opt | - | - | - | - | - | - | - | - | Y | - | - |
| Two or more performers | - | - | - | - | Y | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | - | - |
| Rank, no ties | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | opt | opt | opt ? | - |
| Rating scale | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | Y | opt | opt | Y | Y |
| Rank-rating rule | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | - | opt | - | - | - |
| Comments per entry | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Reason for rank | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | opt | Y | opt | opt | - |
| Rule checks (flags) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | opt | - | - |
| Cross-ex or questions | - | - | - | - | - | - | - | - | - | - | - | - | opt | opt | - | - | - | - | Y | - | - | - | Y |
| Two or more runs per entry | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | Y | - | - | - | Y |
| Points for each speech | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | - | - | - | - |
| Precedence and recency queue | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | - | - | - | - |
| Presiding officer (PO) role | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | - | - | - | - |
| Chamber and docket | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | - | - | - | - |
| More than one session | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Y | - | - | - | - |
| Panel of judges | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | Y | opt | opt | opt | opt |
| Rating only | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | - | - | opt | opt | opt | - |
| Critique only | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | opt | - | - | opt | opt | - | - |

### 2.1 Notes on the cells

**Grace and overtime**

- NSDA grace is 30 seconds for every timed event in the main list. The manual says "all must agree": every judge on a panel must agree before overtime has an effect.
- The app holds one judge's ballot only. So over-grace is **always a flag**. The app never blocks rank 1 by itself. It shows the line "Panel must agree on overtime" next to the flag. This one rule applies everywhere in this file.
- UIL Prose and Poetry: overtime can mean disqualification. The **contest director** applies it, not the judge. The judge still ranks the speaker. In the final round of the UIL State Meet, overtime means last place, not disqualification. The app stores a flag and a profile effect. It never disqualifies a speaker by itself.
- UIL Extemp has no grace. The speaker may only finish the current sentence.
- Radio: IHSA may use a time window of 4:50 to 5:05, with "ranked last" outside it. This is **not verified**. Check the Radio Speaking section of the IHSA terms and conditions.
- PCC: the rule calls 10:30 "a hard limit". It also says a student past the grace period may not be ranked 1st. It never states how long the grace is. "30 seconds" is a guess from the other events.

**One clock per entry**

- IMP: one 7:00 clock covers prep and speech. The judge marks "speech started". Some leagues split the time into two phases (2+5, 2+6 or 5+5).
- PCC: one 10:30 limit covers both speeches. A recorded entry can put its prep time inside the limit. So it is one clock with a split into two runs. NSDA mandates **no minimum time** for a run. The "3 to 5 minutes" for each speech is a description, not a rule.
- Radio: a timekeeper often gives the time to the judge. The app needs a "type the time" mode.
- Group: a recorded entry has no live timer.
- DSC: one 60-minute session clock for the whole table. Students have no turns. So it has no clock for each entry.

**Time signals.** No NSDA rule requires signals. The rules say only "Judges who choose to time...". So every cell is "opt". Judge guides use them most in extemp (OSDA) and impromptu (WASDL).

**Drawn question or topic**

- IMP: the topic comes from the judge's envelope. The speaker draws 3 and keeps 1.
- PCC: nothing is drawn. The student picks a topic from the tournament's CX, LD or PF topic, or one bill from the Congress docket. Pro and Con use the same topic. Each entry still needs a topic field.
- STO: only Minnesota draws (3 stories, keep 1, 30 minutes ahead). This comes from prior notes and is not verified again.
- Radio: a news packet, plus a "flash" item in Iowa.
- DSC: the table gets a task in the session. No source shows prep outside the room, so that cell is "- ?".

**Rank, no ties, for Congress.** A scorer ranks a top 8. The NSDA manual says scorers rank "their 8 most preferred legislators (which may include POs)". The rule "rank only students who spoke or presided" comes from the Last Chance scorer instructions. It is a league rule, not an NSDA rule for all tournaments. The parliamentarian ranks every student. NSDA uses that full order as a tiebreak only.

**Rule checks.** These are flags for officials. They never change the rank.

**Cross-ex for USX and IX.** Only in elims: Nationals semis and finals, and optional at district finals. It uses a chain order. COM and MX have no cross-ex.

**Rating only.** Iowa IHSSA and Kansas festivals use this. UIL does **not**. UIL ranks with no ties, gives an oral critique, and does not show the ranks. For Group, it is not confirmed which ballot IHSA Performance in the Round and MIFA Multiple Interp use. So the Group cells are "opt".

**LD.** The ballot is win or loss plus speaker points (out of 30). It has a reason for decision, not a reason for rank. LD belongs in Tabula Debate.

**DEC.** It is not an NSDA high school event. NSDA Middle School, CHSSA, OSDA, NCFL (grades 9 and 10 only) and IHSA (Oratorical Declamation) offer it. This is believed right but not checked against primary sources in this pass.

## 3. Families

The families in [MODELS.md](MODELS.md) §1 stay, with three changes:

1. **F5 is not a family of events.** Rating only, top-N ranks, rubrics, critique only and panels are settings in a rules profile. They can apply to any event in F1 to F4. F5 becomes the **ballot profile layer**. It sits across the families and has no events of its own.
2. **F7 Group and Radio become data variants of F1.**
3. **Discussion becomes a new family, F8.** LD and Extemp Debate (XDB) leave this app.

| Family | Events | Variants |
|---|---|---|
| **F1 Prepared, solo or pair** | OO, INF, EXP, OSW, DI, HI, DUO, POI, PRO, POE, STO, DEC | F1a original speech: OO, INF, EXP, OSW. F1b interp with a piece: DI, HI, POI, PRO, POE, STO, DEC. F1c pair: DUO. |
| **F1r Radio** (F1 variant) | IHSA Radio Speaking, Iowa Radio News Announcing | Time window (not verified), typed-in time, audio-only prompts, prep outside the room with a packet |
| **F7 Group** (F1 variant, data only) | Readers Theatre, Choral Reading, Ensemble, Group Mime, Group Improv, One-Act, Musical Theatre, Performance in the Round, Multiple Interp, Iowa group Radio Broadcasting | Performer range as a setting for each event, group label, long limits, timer off for recordings, often rating only |
| **F2 Limited prep, prep outside the room** | USX, IX, COM, MX, UIL Informative and Persuasive Extemp | F2x: USX and IX in elims, with a cross-ex chain |
| **F3 Limited prep, prep inside the room** | IMP, plus the CHSSA, IHSA, Kansas and Michigan variants | One combined clock, or split phases |
| **F4 Two runs in one entry** | PCC | None |
| **Ballot profile layer** (was F5) | No events of its own | Rating only, top N, rubric, critique only, panel note, overtime effects |
| **F6 Congress** | House, Senate, Final Session | Scorer and parliamentarian roles. See [CONGRESS.md](CONGRESS.md). |
| **F8 Discussion** (new) | MSHSL Discussion | None |
| **Out of scope** (Tabula Debate) | LD, PF, Big Questions, XDB | A spar run as a ranked event could be a Custom event later |

## 4. The Venn in words

### 4.1 Core: every event in this app (F1 to F4, F6, F8)

- A list of entries (a roster).
- Comments for each entry.
- One judge's ballot. The tab room, not the judge, combines the ballots of a panel.
- Some way to rank or rate. The rules profile sets which way.
- Review and copy, offline storage, and AI clean-up of comments.

### 4.2 Shared by most events (every family except F6 and F8)

- One entry speaks at a time, in an order known ahead.
- Rule-check flags.
- Late-arrival and no-show states.
- Reorder at any time, for students entered in two events.
- A reason for rank, when the profile uses ranks.

These items are common, but **the profile decides them**. They are not in every event:

| Item | Where it does not apply |
|---|---|
| A speech clock with grace | Radio (window, not verified), UIL (no grace), recorded Group entries (no live timer), PCC (grace length not stated) |
| Ranks 1 to N with no ties | Group and Iowa Radio often use ratings. Iowa and Kansas festivals can use rating only. |

### 4.3 Shared by subsets

- **F1b, F1c and F7 have a piece:** a title and an author.
  - POI needs several sources, each with a genre.
  - DEC needs the original speaker, the date and the occasion.
  - POE can hold several poems.
- **OO, INF and OSW have a quote limit.** At most 150 quoted words. EXP does **not** have this rule. EXP instead bans a made-up topic and bans reuse of parts of the student's own OO or INF.
- **F1c and F7 have more than one performer in one entry.** F1c has 2 names. F7 has a range that each event sets (for example 3 or more for Performance in the Round), or a group name with no student names.
- **F2, F3 and F1r have a topic for each entry.** It is drawn or handed out. Prep is outside the room in F2 and F1r, and inside the room in F3.
- **F2 has a staggered roster.** Speakers arrive about every 7 minutes (6 for COM, 12 with cross-ex). Some tournaments may use 10. So the gap is a setting. The screen shows a "waiting for next speaker" state.
- **IMP and recorded PCC put prep on the same clock as the speech.** Group Improv has 2 minutes of prep, then 5:00. That looks like two separate phases, not one clock. This is not certain.
- **F2x, F6 and LD have questions.**
- **F4, F6 and LD have more than one run for each entry.**
- **Interp source rules apply to DI, HI, DUO, POI, PRO and POE.** The intro must name the author and title.
- **The no-props rule applies to DI, HI, DUO and STO.**
- **USX, IX, COM and MX all cite sources.** A citations checklist fits all four.
- **The profile layer can apply to F1, F2, F3, F1r and F7:** rating only, critique only, top-N ranks and rubrics.

### 4.4 Unique to one event

| Event | What only it has |
|---|---|
| OO | Flag for an untrue or invented story |
| INF | A set-up phase before the timer starts. Flag for a banned visual aid. |
| DUO | Flags for eye contact and touching. A comment on the balance of the two parts. |
| POI | Several sources with genres. Flags for "manuscript let go" and "words shown". |
| PRO and POE | UIL literary category (A or B). POE can hold several poems. |
| STO | Chair-rule flag ("with restraint"). Minnesota story draw (not verified). |
| OSW | The intro is permitted but not required. In a recorded round, walk time counts. |
| DEC | Fields for the original speaker, date and occasion. Comment helpers steer away from critique of the content. |
| EXP | Flags for notes and aids (the aid rule differs by league). Flag for a made-up topic. |
| USX and IX | Cross-ex chain in elims, with a same-school warning (this needs a school field) |
| COM | Seated delivery behind a table or desk |
| MX | A pool of mixed U.S. and world questions (not verified) |
| IMP | The judge's topic envelope. One 7:00 clock for prep and speech. |
| PCC | Pro and Con runs inside one 10:30 limit, with a topic the student picks from 4 sources |
| Congress | Speech log, docket, side and speech type, points for each speech, PO hours, precedence and recency, top-8 ranks, sessions, full-chamber rank by the parliamentarian |
| Radio | Time window. Time typed in by the judge. Audio-only prompts. |
| Group | Group label. Recorded entry with no timer. |
| Discussion | A table view where any student can speak at any time. Eight rating criteria. No turns. |

## 5. Shared room screen or a screen of its own

### 5.1 Share the room screen, with differences in data only

| Family | What changes |
|---|---|
| F1, all variants | Built today |
| F1r Radio | Data, plus a small "type the time" mode on the timer |
| F7 Group | Data, plus a roster row that allows a group name with no student names. The room cap must grow past 8 for some groups. |
| F2 | Built today. The cross-ex chain is later: one small part ("Q: speaker X", a cross-ex run, a same-school warning). |
| F3 | Built today. Split prep phases are data. |
| F4 PCC | Data: `runs`, `timing.total`, a topic field. It reuses the phase bar from IMP. No minimum for each run. |
| Profile layer | Changes the Rank and Review screens only. With ranks off, Rank becomes a Rate screen. A rubric becomes a grid of steppers. The room screen does not change. |

### 5.2 Need a screen of their own

**F6 Congress.** Every assumption of the room model breaks. Read [CONGRESS.md](CONGRESS.md) §2 for the full list. In short:

- A chamber holds up to 30 students (8 to 29 at an in-person district, 8 to 15 online). The app caps a room at 8 (`MAX_ENTRIES = 8` in `events/js/room.js`).
- The PO sets the speaking order live. No one knows it ahead.
- A student gives 0 to 4 or more speeches. Each speech has its own points and comment.
- The PO gets points for each full hour, on a scale of its own.
- Ranks need not follow points. So the rank-rating rule in `rank.js` is wrong for Congress.
- An NSDA session is at least 3 hours. A scorer hands in a new ballot each session.

**F8 Discussion.** The room screen assumes one speaker at a time. Discussion needs a table view where the judge taps any student at any time. It can reuse the session clock, the comment cards and the rubric grid from the profile layer.

**LD and XDB** belong in Tabula Debate. A future hub sends these rounds to the debate app.

## 6. Changes from the fact-check

| # | Was | Now | Source |
|---|---|---|---|
| 1 | PCC has a 3:00 minimum for each run | No minimum is mandated. "3 to 5 minutes" is a description. | [HS] PCC rules 2, 3 |
| 2 | PCC one clock per entry: "-" | Y: one 10:30 limit, split into two runs | [HS] PCC rule 3 |
| 3 | PCC drawn topic: "opt" | "-": the student picks from 4 sources | [HS] PCC rule 1 |
| 4 | PCC rating scale: Y, points out of 100 | "opt". Points out of 100 appear only on a sample comment sheet. | [HS] PCC rule 2 |
| 5 | EXP has the 150-word quote limit | Only OO, INF and OSW have it | [HS] EXP rules 1 to 3; OO 5, INF 6, OSW 2 |
| 6 | A Congress session runs 2 to 3 hours | At least 3 hours at NSDA. 2.5 hours was Last Chance only. | [HS] Congress rule 1 |
| 7 | DSC one clock per entry: Y | "-": one session clock, no turns | [MN-DISC] |
| 8 | LD reason for rank: Y | "-": LD has a reason for decision | [HS] |
| 9 | Signals: Y for USX, IX, COM, MX, IMP | "opt" everywhere | [HS] extemp 7, COM 6, IMP 7 |
| 10 | UIL overtime means disqualification | The director applies it. The judge still ranks. State final: last place. | [UIL-PP], [UIL-PR], [UIL-FAQ] |
| 11 | Over-grace may not be ranked 1st (NSDA) | Always a flag. The app never blocks rank 1, because the panel must agree. | [HS] grace sentence |
| 12 | GRP rating only and rating scale: Y | "opt": not confirmed | Research gap |
| 13 | Clock with grace and ranks shared by most | Marked as set by the profile | Internal |
| 14 | Group Improv prep on the same clock | Probably two phases. Not certain. | Research |
| 15 | Row "Two performers" | "Two or more performers" | Internal |
| 16 | Radio window and "ranked last" | Not verified | [IHSA-TC] |
| 17 | PCC grace 30 seconds | Grace length not stated | [HS] PCC rule 3 |
| 18 | Congress up to 30 | Ceiling 30. District in person 8 to 29, online 8 to 15. | [HS] Congress 1.2, District rule 2 |
| 19 | PO scored per full hour | Yes, on a scale of its own. See open fact 2. | [HS] District officials |
| 20 | Scorer ranks only students who spoke or presided | A Last Chance rule, not NSDA-wide | [LC-S] |
| 21 | Parliamentarian ranks every student | Yes, but NSDA uses the order as a tiebreak only | [HS] Tabulating Ranks |
| 22 | Scorer scale unsure | Districts 1 to 8, Nationals 3 to 9. Merit points convert to 1 to 6. EVENTS.md §6 ("1 to 6 per speech") is wrong. | [HS] Points Entry 15 |
| 23 | DSC prep outside the room: "opt" | "- ?": no source | Research |
| 24 | Group range 2 to 15 | A setting for each event. Lower bound is 3 for some events. | Research |
| 25 | Interp source check and no props unique to DI and HI | Shared by more interp events | [HS] Interp rules |
| 26 | Citations checklist unique to USX and IX | COM and MX cite too | [HS] COM rule 3 |

The fact-check confirmed these, with no change:

- NSDA times and grace: 10:00 + 0:30 for OO, INF, DI, HI, DUO, POI. 7:00 + 0:30 for USX and IX. 5:00 + 0:30 for COM, PRO, POE, STO, OSW, EXP. IMP 7:00 + 0:30, with prep inside the 7:00.
- IMP: the judge's envelope, draw 3 and keep 1, the others wait outside, no electronic devices.
- COM: seated, with a draw 20 minutes before the round.
- STO: the chair rule, no reused stories, no added material.
- OSW: intro optional, 150-word quote limit.
- Congress speech times, 30-second question blocks, preset recency, the penalties, and the parliamentarian who stays for all prelims. See [CONGRESS.md](CONGRESS.md) §5.
- UIL extemp: no grace.

## 7. Open facts

1. **Radio window.** Is the IHSA window 4:50 to 5:05, and does a speaker outside it rank last?
2. **District PO scale.** One line of the manual gives 1 to 8 for each speech and each full hour of presiding. Another reading gives 4 to 8 for the PO. Read District Congress Officials, scorers rule 1, before the profile is written.
3. **PCC grace length.** The rule does not say.
4. **Mixed Extemp question pool.** Only a 2015 guide and the event name say "mixed".
5. **Extemp draw gap.** 7 or 10 minutes. Keep it as a setting.
6. **Congress scorer rotation.** No NSDA rule found. UIL State requires it.
7. **NCFL and CHSSA Congress scales.** Not verified.
8. **Discussion ranks.** Do MSHSL judges rank as well as rate?
9. **Iowa All-State critique only.** From a secondary source only.
10. **NSDA sample ballots.** The PDFs were not read.
11. **CHSSA extemp** (finals cross-ex, laptops). From prior notes.
12. **"Open" cross-ex.** NSDA and TFA use the term but do not define it.
13. **IHSA Performance in the Round and MIFA Multiple Interp.** Rank or rating?
14. **League facts for MN, Iowa, KS, UIL, MIFA, AFA, NFA.** Partly from prior notes.
15. **LD cells.** Not checked against the debate app's format data.

## Sources

- [HS] NSDA 2026-27 High School Unified Manual, v2027.1.2: https://docs.google.com/document/d/1hq7-DE6ls2ryVtOttxR4BNpRdP7xUbBr0M3SMYefek8
- NSDA Pro Con Challenge sample ballot (not read): https://www.speechanddebate.org/wp-content/uploads/Sample-Ballot-Pro-Con-Challenge-Blank.pdf
- [LC-S] NSDA 2023 Last Chance Congress scorer instructions: https://s3.amazonaws.com/tabroom-files/tourns/26154/postings/37300/2023RevisedLastChanceScorerInstructions.pdf
- [UIL-FAQ] UIL new coach questions: https://uiltexas.org/speech/new-coach-info/new-coach-frequently-asked-questions
- [UIL-PP] UIL Prose instructions: https://www.uiltexas.org/files/academics/speech/4._ProseInstructions_25.pdf
- [UIL-PR] UIL Prose and Poetry rules: https://www.uiltexas.org/files/academics/speech/ProsePoetryRulesProcedures.pdf
- [IHSA-TC] IHSA speech terms and conditions 2026-27: https://ihsa-assets-prod.nyc3.digitaloceanspaces.com/documents/speech/2026-27/t-and-cs.pdf
- [IHSA-MIN] IHSA speech advisory minutes, April 2024: https://ihsa.org/documents/adv%20minutes/23-24/SPEECH-ADVntg-Apr-10-24.pdf
- [MN-DISC] MSHSL Discussion critique guidelines: https://legacy.mshsl.org/sites/default/files/2023-06/spe_discussioncritiqueguidelines.pdf
- Prior research notes (side-session notes, `speech-events/`): events-research.md, ballot-judging-research.md, congress-and-panel-research.md.
