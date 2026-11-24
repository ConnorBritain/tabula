# Tabula Speech Events: league rule packs (phase P3, draft 1)

Checked 2026-11-23 against each league's own current document. Every fact names its source key (list at the end). A fact we could not confirm in a primary source says **not verified**. All rules are summarized in our own words; no rule text is copied.

Draft profile files: `events/profiles/v2/<id>.v1.json`. They are **not** in `events/published.json` yet. The coordinator publishes them after S4 (the profile layer) merges. Event-time changes (for example UIL Prose 7:00) need def v2 files; those are not in this draft (see §15).

## 1. How the profiles hold each league

Profile fields come from [EXPERIENCE.md](EXPERIENCE.md) §8.5 and [ARCHITECTURE.md](ARCHITECTURE.md) §6.2.

| Profile id | Ranks | Rating | Rubric | Grace | `overtime.effect` | `maxEntries` | Elim cross-ex |
|---|---|---|---|---|---|---|---|
| `chssa` | all | none | none | 30 | `flagOnly` (tab room) | default | on |
| `uil` | all | none | none | 0 | `directorDq` (contest director) | 8 | off |
| `tfa` | all | none | none | 30 | `noFirst` (judge) | 8 | on |
| `ihsa` | all | none | none | 30 | `flagOnly` (tab room) | default | off |
| `kshsaa-championship` | all | none | none | 15 | `noFirst` (judge, with timekeeper) | 7 | off |
| `kshsaa-festival` | off | Division I-IV | none | 15 | `noTopRating` (judge) | default | off |
| `mshsl` | all | none | none | 0 | `flagOnly` (Rules Committee) | 8 | off |
| `osda` | all | none | none | 30 | `judgeChoice` | 7 | on |
| `mifa` | top 3 | 75-100, no ties | none | 0 | `judgeChoice` | 7 | off |
| `ihssa` | off | Division I-IV | none | 0 | `disqualified` (judge gives IV) | default | off |
| `ncfl` | all | none | none | 30 | `noFirst` (judge) | 7 | off |
| `ncfca` | all | none | 5 rows, 1-5 | 15 | `flagOnly` (software) | default | off |
| `ncfca-interp` | all | none | 5 rows, 1-5 | 15 | `flagOnly` (software) | default | off |
| `stoa` | all | none | none (not verified) | 14 | `flagOnly` (tournament staff) | default | off |

**Field notes for S4 and the coordinator:**

- `elim: { cx: true }` follows the S4 example file. It turns on the extemp cross-ex in every elim. CHSSA and TFA hold it in finals only; OSDA in all State break rounds. The cross-ex length (2 or 3 min) is not a profile field.
- Three effect names, used by four profiles, come from ARCHITECTURE.md §6.2 and are not in §8.5: `judgeChoice` (OSDA, MIFA), `noTopRating` (Kansas festival), `disqualified` (Iowa). S4's `rank.js` reads an unknown effect as "show the over-time pill only", which is safe. `events/league-drafts.test.mjs` accepts them; S4's `profile-layer.test.mjs` does not check `effect`. Before publishing, the coordinator either adds them to §8.5 or maps them to `flagOnly`.
- S4's v2 test needs "not verified" in every `v2/` source and every `v2/` file in `published.json`. Every draft names its open items, so the first holds; the second holds once the coordinator publishes.
- Rules no field can hold yet: Kansas "past 30 s, lowest rank"; IHSA "one rank per full 30 s"; MIFA "best entry gets 100"; IHSA and Iowa Radio time windows (`windowLast`, later); NCFL "no rank worse than 5" (the tab room does it, so `ranks: 'all'` is right for the judge).
- `noFirst` with grace 0 is never used. "No grace" leagues use `flagOnly`, `directorDq` or `disqualified`.

## 2. CHSSA (California)

Source: [CHSSA-27] Rules and Regulations 2026-27, effective 2026-10-07. Compared with the 2025-26 edition: the speech articles are the same except for a new "artistic plagiarism" rule (copying a recorded past performance can cost a warning, a rank or disqualification, p. 44).

- **Grace and overtime:** 30 s. More than 30 s over: the tab room drops the entry one rank. Applies to spontaneous, original and interp events. [CHSSA-27] Art. IX §1.A.2.d p. 37, §2.A.2.a p. 40, §3.A.3.a p. 44
- **Waiver:** in interp finals an official timer may waive overtime caused by audience reaction; the Tournament Director may extend this to semis. [CHSSA-27] Art. IX §3.A.3.b p. 44
- **Timer:** the judge keeps official time; signals are needed only on a panel. A phone stopwatch in airplane mode is allowed. [CHSSA-27] p. 37
- **Minimum time:** none. [CHSSA-27] pp. 39, 40, 44
- **Ranks:** the tab room counts any rank past 5 as 5; semifinal and final ranks count double. A judge-marked violation can lower one entry's rank, so tied ranks can result. [CHSSA-27] Art. X pp. 48-50
- **Ties on a judge's ballot:** not verified (no rule found).
- **Section size:** not verified (about 7 is our inference from entry numbers).
- **Rating, rubric:** none. [CHSSA-27] Art. IX-X
- **Events that differ from NSDA:**
  - Extemp: draw 3, 30 min prep, 7:00, laptops allowed, no phones, no notes while speaking. **Finals add a 2-min cross-ex.** [CHSSA-27] pp. 37-39
  - Impromptu: draw 3 from the judge, 2 min prep with paper notes, 5:00. [CHSSA-27] p. 39
  - Original Advocacy: 10:00, must argue for a named law or rule and who carries it out; at most 150 quoted words. Original Prose/Poetry: 10:00, same quote rule. [CHSSA-27] pp. 40-45
  - Declamation: a real, published speech by someone else; the intro names author, title, occasion, place and date. [CHSSA-27] pp. 40-45
  - Interp: up to 150 added words; no props; a missing title or author costs up to 1 rank. Duo: eye contact costs up to 1 rank; touching costs 1 rank (last place if on purpose). [CHSSA-27] pp. 40-45

## 3. UIL (Texas)

Sources: [UIL] Constitution and Contest Rules 2026-27 (117th ed.); [UIL-PJ] judge procedures 2025; [UIL-RS] multiple-judge ranking sheet (2021-22, newest posted).

- **Grace and overtime (Prose, Poetry):** 7:00 including intro, no grace. Any overtime: disqualified from the round. **Only the contest director applies it**; the judge still ranks. In the State Meet final round: last place instead. [UIL] §1006(g) p. 85, §1007(g) p. 86; [UIL-PJ]
  - Profile: `directorDq`, a flag only. The app never removes the entry.
- **Extemp time:** 7:00; the speaker may finish only the sentence in progress. [UIL] §1004(d), §1005(d) pp. 84-85
- **Minimum time:** none. [UIL] §1004-1007
- **Ranks:** every contestant, no ties, no points. [UIL-PJ] Ranking rules live in the judge procedures, not in [UIL] §1003.
- **Section size:** at most 8; prelims when 9 or more enter. [UIL] §1003(b)(1) p. 84
- **Panels:** majority "or better", then lowest sum, then judges' preference, then reciprocals, then judges' preference again, then the sum of all the contestant's ballots, then a blind draw. [UIL-RS]
- **Rating, rubric:** none. The judge sheet lists questions to think about, with no scores. [UIL-PJ]
- **Events that differ from NSDA:**
  - Informative and Persuasive Extemp: draw 5, keep 1, 30 min prep, one 3x5 card (more is a disqualification), laptops offline, no phones or smartwatches. **No cross-ex.** [UIL] §1004-1005
  - Prose and Poetry: binder manuscript; each round uses literary category A or B; reading outside it is a disqualification. [UIL] §1006-1007
  - The 2026-27 Prose and Poetry Handbook: **not verified** (not found online).
  - After the round: a group oral critique, and judges do not reveal ranks. [UIL-PJ]
  - Entry limit: two speech events, one from each group; not Prose with Poetry, not both extemps. **not verified** this pass (earlier research note cites [UIL] §1000)

## 4. TFA (Texas Forensic Association)

Source: [TFA] Constitution and Contest Rules, 2026-27 season, amended October 2026 (Competition Events Guide, IQT Standing Rules, State Ops Manual).

- **Grace and overtime:** 30 s in every speech and interp event. Past grace: the judge may not rank the speaker 1st. Other penalties are up to the judge, who may allow for audience reaction. [TFA] Events Guide, Time Limit rule in each event
- **Minimum time:** none. [TFA] Events Guide
- **Ranks:** at State, judges rank through 6th or 7th; the tab room counts 6 and 7 as 5. [TFA] State Ops, Composite Rerank
- **Ties on a judge's ballot:** not verified.
- **Section size:** at most 8. [TFA] IQT Standing Rule 7
- **Tiebreaks:** total ranks, then judges' preference, then reciprocals. [TFA] Speech and Interpretation Tabulation
- **Rating, rubric:** none in speech. [TFA]
- **Events that differ from NSDA:**
  - Extemp: draw 3, 30 min prep, 7:00. One note card in IQT prelims only; none in IQT elims or at State (breaking this means last place). **Finals: open cross-ex of up to 3 min** (required at State). [TFA] Events Guide
  - Duet Acting: 2 performers, 10:00, memorized, two chairs; no off-stage focus rule; at most 100 transition words. [TFA]
  - Interp transitions: at most 100 words. POI needs a manuscript. [TFA]
  - State consolation events (for students who do not break): Prose (even years) or Poetry (odd years, so Poetry in 2027), 7:00 from a folder; Impromptu, draw 3, **1 min prep**, 5:00. All 30 s grace. [TFA] State Ops, Consolation Events

## 5. IHSA (Illinois)

Sources: [IHSA-TC] 2026-27 Speech State Series Terms and Conditions; [IHSA-SM] 2026-27 Speech IE School Manual (event summaries from p. 16).

- **Grace and overtime:** 8:00 limit; up to 8:30.00 is legal. From 8:30.01, each judge's rank drops one place per full 30 s over. Both timers must agree. **The tab room applies it; judges ignore time.** The drop can go past the section size. State final rounds: no penalty until a full minute over. [IHSA-TC] VIII-E-2 to E-4 p. 7
- **Minimum time:** only Radio, a 4:50-5:05 window with no grace; outside it, last on every ballot. [IHSA-TC] VIII-E p. 7; [IHSA-SM] p. 23
- **Ranks:** every entrant, no ties; the tab room caps ranks at the smallest section. [IHSA-TC] VI-F, VII-D, XI-B
- **Section size:** no maximum stated, so a limit is **not verified**; two prelim sections when 8 or more enter. [IHSA-TC]
- **Rating, rubric:** none; the critique form has "major basis for ranking", comments and a rank. [IHSA-SM] pp. 52-53
- **Events that differ from NSDA:**
  - Most events 8:00: Dramatic and Humorous Duet Acting, DI, HI, Prose, Poetry, Oratorical Declamation, OO, Original Comedy, Special Occasion, Informative. [IHSA-SM] pp. 16-24
  - Extemp: 7:00, 30 min prep; draw 3 of 6, pick 1 within 1 min; prep notes of any size allowed. [IHSA-SM]
  - Impromptu: 2 min prep in the room, then 6:00; everyone in a section picks from the same 3 topics; one notecard. [IHSA-SM]
  - Radio Speaking: 45 min prep with a news packet and a required commercial; speaker in another room, judges hear audio. [IHSA-SM] p. 23
  - Performance in the Round: 3 or more performers, 15:00, 16-ft circle, 30 s set-up and 30 s take-down; no other event for those students. (Group event: later.) [IHSA-SM]
  - Duets: at most 2 characters, a table and 2 chairs. Prose: less than half dialogue. Original events: at most 150 quoted words. At most 2 events per student. [IHSA-TC] III-G; [IHSA-SM]

## 6. KSHSAA (Kansas)

Source: [KS] 2026-27 Debate, Speech and Drama Manual.

- **Championship overtime:** 15 s grace. More than 15 s over: no rank 1. More than 30 s over: lowest rank (several over-time speakers share the bottom, ordered by quality). The judge applies it after an official timekeeper reports; with no timekeeper, no penalty. [KS] pp. 41, 47-48
  - Pilot in 6A, 5A and 1A: the judge keeps time and may give extra signals. The manual says "may" on p. 41 and "should" on p. 48.
- **Festival overtime:** more than 15 s over: no Division I rating. [KS] pp. 36, 38-39
- **Minimum time:** Improvised Duet Acting 4:00 (max 7:00); under 4:00 means no rank 1 (championship) or no Division I (festival). [KS] pp. 38-39, 47-48, 52
- **Ranks (championship):** sections of 5 to 7; in a section of more than 5, no rank worse than 5th. [KS] pp. 43-44
- **Ties on a judge's ballot:** not verified.
- **Ratings (festival):** Division I to IV only, no plus or minus; no ranks. [KS] pp. 35, 37-38
- **Rubric:** not verified (the ballots page did not load; the manual names no scored grid).
- **Events that differ from NSDA:**
  - 7:00: Informative (memorized, no aids), Prose, Poetry, Extemp. 5:00: Impromptu. 10:00: OO, Duet Acting, Duo, Solo Acting (the Kansas HI/DI), Informative 10 (aids allowed, 150 quoted words). [KS] pp. 49-58
  - POI: in the event rules and the festival time table, **not** in the championship time table. [KS]
  - Extemp: Foreign and Domestic, draw 3, 30 min prep, one 4x6 card. [KS]
  - Impromptu: draw 3, 5 min prep including the draw, no notes in the speech. [KS]
  - Improvised Duet Acting: draw characters, situation and place; 30 min prep; a table and 2 chairs. [KS]
  - Prose and Poetry: printed manuscript or tablet; memorized intro. [KS]
  - At most 3 events, only one draw event (Impromptu does not count). [KS] p. 41

## 7. MSHSL (Minnesota)

Sources: [MN] 2026-2027 Speech Rules and Policies (Sept 17, 2026); [MN-JI] judge instructions (2023); [MN-B] ballot (2022).

- **Grace and overtime:** none; the speaker may finish the sentence (one closing sentence in Extemp and Storytelling). A time violation drops one rank in that round, never below the last rank in the room; a violator loses a tie to a non-violator. **The Rules Committee decides; the judge only reports.** [MN] I-F-6 p. 3, V-E p. 14; [MN-JI] item 9
- **Minimum time:** none; Informative gets up to 2 min set-up before timing. [MN] p. 10
- **Ranks:** everyone; prelim ranks capped at the smallest room. State final: 8 entries, 5 judges, 1-8 with no ties. [MN] pp. 14-16; [MN-B]
- **Ties on a prelim ballot:** not verified (no rule found).
  - The final placement rule says to total "all three" final ranks though there are 5 judges. This is an error inside [MN].
- **Rating, rubric:** none scored. Discussion has five guide questions. [MN] Event Guide p. 17
- **Events that differ from NSDA:** [MN] pp. 2, 5-13
  - 10:00: Creative Expression (at most 20% outside material), Duo, HI, Serious Drama, Prose, Poetry, Great Speeches (at least 25% own words), Informative and OO (at most 10% quotation).
  - Extemp Speaking: 7:00, draw 3, keep 1, 30 min ahead; one side of one 3x5 card.
  - Extemp Reading: 7:00, same draw of cuttings, read from the cutting.
  - Storytelling: 7:00, a list of 15 stories, same draw, no notes.
  - Discussion: up to 8, 60 min (a different ballot; not planned).
  - Scripts optional. One category per student.

## 8. OSDA (Ohio)

Sources: [OSDA-TOM] Tournament Operations Manual (Sep 2026); [OSDA-CEM] Competitive Events Manual (Aug 2026); [OSDA-JH] 2026-27 Speech Judge Handbook.

- **Grace and overtime:** 30 s in all events; any penalty is up to the judge. One judge per section keeps official time (two in finals). [OSDA-TOM] p. 29 §VI-E, p. 39 §F3, F6
- **Minimum time:** none. [OSDA-TOM] p. 39; [OSDA-JH] p. 3
- **Second run:** a second, separately timed run of the speech gets the worst rank in the round. A restart is allowed, but the clock keeps running. [OSDA-TOM] p. 29, p. 38; [OSDA-JH] p. 5
- **Ranks:** every entry, no ties. Sections: at most 7 at districts, 5 to 7 at State; the tab room converts ranks to the smallest section. [OSDA-TOM] pp. 9, 29, 46
- **Panels at State:** 2 judges in prelims, 3 in quarters and semis, 7 in the final (best and worst dropped). [OSDA-TOM] pp. 46-48
- **Rating:** none; judges write a reason for rank. [OSDA-JH] pp. 5, 9
- **Rubric:** criteria are listed, not scored. [OSDA-CEM]
- **Signals:** the TOM says give signals when a student asks. The judge handbook says this on its event pages but "extemp only" on p. 5 (a conflict inside the handbook). [OSDA-TOM] p. 39; [OSDA-JH]
- **Events that differ from NSDA:**
  - Extemp: draw 3, 30 min prep, 7:00, no notes, finger signals. **Cross-ex in every State break round:** each speaker questions the next, 2 min each, up to 30 s more to finish an answer; draws 12 min apart. [OSDA-CEM] pp. 21-22
  - Declamation: 10:00, memorized, a speech by someone else. [OSDA-CEM] p. 42
  - State supplemental: Prose 5:00 with manuscript; Prepared Commentary 5:00, seated at a table, no notes. [OSDA-CEM] pp. 63, 65
  - POI: 200 words from each genre is a guideline ("should"), not a hard rule. [OSDA-CEM] p. 58
  - Double entry at districts, not at State. [OSDA-TOM] p. 20

## 9. MIFA (Michigan)

Sources: [MIFA] Speech Activities 2026-2027 (no exact date in the document); [MIFA-B] event ballots.

- **Overtime:** all limits are suggestions; any penalty is optional and up to the judge. No grace defined. [MIFA] Timing
- **Minimum time:** not enforced (the low end of each range is a suggestion). [MIFA] Timing
- **Ranks:** each judge ranks 1, 2 and 3; everyone else gets 4. [MIFA] Contestant evaluation
- **Score:** each judge also gives a whole-number percentage, 75 to 100, no two the same; **the best entry must get 100**. 75-79 is for special cases (unfinished, bad conduct). [MIFA] Contestant evaluation
- **Section size:** at most 7 (5 in Multiple). [MIFA] Section size
- **Ties:** advancing ties go to total percentage; finals go total ranks, judges' preference, final percentage, then all-round percentage. [MIFA]
- **Rubric:** none scored. [MIFA-B]
- **Events that differ from NSDA:** [MIFA] Timing; [MIFA-B]
  - The document has no exact date (season verified, date **not verified**).
  - 5-8 min: DI, Poetry, POI, Prose, Storytelling, Informative, Oratory, Sales. Duo 7-10. Extemp and Duo Commentary **4-7**. Impromptu 0-6 including prep (clock starts at the prompt). Multiple Interpretation 3-5 performers, 10-15 (group: later).
  - Broadcasting: 5:00 with a 1-min editorial; news copy prepared ahead; only the editorial story is handed out, with 15 min to work it in.
  - Duo Commentary: 2 speakers, draw 3 of 10, 30 min prep, seated, digital notes allowed.
  - Sales: a real product, one easel or monitor, 2 min set-up.
  - Storytelling: no manuscript or notes. No HI event.
  - Extemp: 30 min prep; the number of topics drawn is **not verified**.
  - One event per tournament (except the interp pentathlon). [MIFA] Overview

## 10. IHSSA (Iowa)

Sources: [IA-BL] IHSSA By-Laws 2026 (pages dated 8/23 to 8/26); [IA-ART] per-event articles; [IA-AM] 2025-27 amendments.

- **Overtime:** no grace. A separate timer calls STOP; a speaker who does not stop at once, even mid-sentence, gets **Division IV**. Judges may not ask for exact times. [IA-BL] Art. III §6 p. 15, Art. VI §5 p. 20
  - The rule is in By-Laws Art. III, not Constitution Art. III (the earlier note had this wrong).
- **Redo:** a speaker stopped by mistake may perform the whole piece again; after a disruption an officer may arrange a new performance. [IA-BL] Art. III §6; Art. IV Q2 p. 17
- **Minimum time:** Radio News 4:00-5:00; under 4:00 is an automatic Division IV. No other individual event has a minimum. [IA-ART] Art. XVI §5 p. 37
- **Ranks:** none. Judges rate only. [IA-BL] Art. V §10 p. 19
- **Ratings:** Division I (Excellent), II (Good), III (Fair), IV (rule violation). "Comments only" needs State Office approval. [IA-BL] Art. VII §1 p. 20
- **State, 3 judges:** I for 1-1-1, 1-1-2, 1-1-3; II for 1-2-2, 1-2-3, 2-2-2, 2-2-3; III for 1-3-3, 2-3-3, 3-3-3. Two or more "Outstanding" nominations make All-State. [IA-BL] Art. VII §4 pp. 21-22
- **Rubric:** comment sheets list criteria but give one rating only. [IA-ART] comment sheets
- **Section size:** Radio at most 10; a general limit is **not verified**.
- **Events that differ from NSDA:**
  - Spontaneous Speaking: draw 3, 3 min prep in the room, 5:00, note cards allowed. [IA-ART] Art. XV p. 35
  - Storytelling: 5:00, seated on a stool, no notes or props. [IA-ART] Art. XVIII p. 41
  - Radio News: 30 min prep from wire copy, full commercial, a cold "flash" item in the first 4 min, judges listen by loudspeaker. [IA-ART] Art. XVI pp. 37-38
  - Acting 8:00, Poetry and Prose 6:00, Literary Program 8:00, OO 8:00, Expository 6:00, Reviewing 8:00, After-Dinner 5:00, Improvisation 5:00 with 3 min prep: **not verified** against the 2026 articles (they match IHSSA's own 2023 event descriptions).
  - Acting: 3 entries per school. Videocasting added in 2026. [IA-AM]
  - Large-group events (Choral Reading, Ensemble Acting, One-Act and others): limits **not verified**; group events come later.

## 11. NCFL (Grand Nationals)

Source: [NCFL] By-Laws for Grand Nationals 2026 (updated after the Fall 2025 Executive Committee). ncfl.org still lists it as the latest edition; no 2027 edition is posted. **2027 rules: not verified.**

- **Grace and overtime:** 30 s in all events. Past grace: no rank 1, and no other penalty. Each judge applies it; no judge may disqualify. [NCFL] Art. II §D.7a, §D.8i p. 14
- **Timer:** timekeepers when local conditions allow; each contestant gets the signals they ask for. [NCFL] §D.7b p. 14
- **Minimum time:** none in any event. [NCFL] §C.1a-f pp. 4-8
- **Ranks:** sections of at most 7; no judge gives a rank worse than 5. 4 prelims with 2-3 judges; elims 3 judges, final 5. Two-way ties go to judges' preference, three or more to reciprocals. [NCFL] §C.2a-c p. 8
- **Ties on a judge's ballot:** not verified.
- **Rating, rubric:** none. [NCFL] §C.2
- **Events that differ from NSDA:** [NCFL] §C.1a-f pp. 4-8; §D.1 p. 13
  - Oratorical Declamation: 10:00, freshmen and sophomores only.
  - Dramatic Performance: 10:00, memorized; intro and transitions at most 1 min.
  - Oral Interpretation: one prose and one poetry program, binder only, no walking, 10:00, intro at most 1 min. A speaker who does not look like they read from the binder may not be ranked 1st. How programs alternate by round: **not verified**.
  - Original Oratory: 10:00, at most 150 quoted words. Duo: 10:00, no contact (disqualification).
  - Extemp: 7:00, draw 3, keep 1, 30 min prep, no notes. **No cross-ex.**
  - Notes in a memorized event: last place. Props or costume: disqualified. No double entry.

## 12. NCFCA

Sources: [NCFCA-timer] head judge timer instructions (updated Aug 29, 2026); [NCFCA-ev] event rules pages (read Nov 2026; no date shown); [NCFCA-prep] judge prep (Dec 2025); [NCFCA-rub] sample ballots and rubrics (Aug 2026); [NCFCA-sum] 2026-27 rule and ballot changes (Jul 27, 2026).

- **Overtime:** no true grace. If the time the judge enters is more than 15 s over the limit, the tab software takes 2 ranks after the ballot is submitted. [NCFCA-timer] §1
- **Timer:** the competitor runs a count-up timer and shows the judge the final time. Apologetics and Impromptu run a prep countdown; the competitor draws after starting it. [NCFCA-ev] §D
- **Minimum time:** none. [NCFCA-ev]
- **Ranks:** everyone, first to last. Only ranks decide placing; the ballot can suggest ranks from the scores. [NCFCA-prep]
- **Ties, section size:** not verified.
- **Rubric:** 5 rows, each 1-5 (Beginning to Excellent). [NCFCA-rub]
  - Platform and limited prep (`ncfca`): content; organization and citations; vocal delivery; physical delivery; impact.
  - Interp (`ncfca-interp`): content and literary merit; organization and citations; characterization; blocking; impact.
  - That Duo, Biblical Thematic, Digital Presentation and ADS use these same rows: **not verified** (we read the Persuasive, Extemp, Apologetics and Open Interp samples).
- **Penalties:** minor timing issues 2 ranks; other violations 4 or 8 ranks; script use 4 ranks (disqualification at Regional and National Championships). [NCFCA-ev] Penalties
- **Events that differ from NSDA:** [NCFCA-ev] §C-D; [NCFCA-sum]
  - Apologetics: 6:00, 4 min prep, pick 1 of 2 prompts, prepared cards up to 5x6 plus a Bible.
  - Extemp: 7:00, 20 min prep, 1 of 2 topics, one 3x5 card. Impromptu: 5:00, 2 min prep, 1 of 2 topics.
  - 7:00: Persuasive, After Dinner Speaking, Open Interp. 10:00: Informative, Digital Presentation (slides; Works Cited slide counts), Duo, Biblical Thematic.
  - At most 350 quoted words in Persuasive, Informative, ADS and Digital Presentation.
  - No Mars Hill, no cross-ex, no two-run event.

## 13. Stoa

Sources: [STOA-PR] Persuasive Rules (rev 2025-07-14); [STOA-JR] Judging Reminders (rev 2025-08-06); [STOA-desc] stoausa.org event descriptions; [STOA-RB] an unofficial 2026-27 rulebook copy (not linked from stoausa.org). Stoa's official 2026-27 rules sit behind a member login. **Everything from [STOA-RB] is not verified.**

- **Overtime:** 15 s or more over costs 1 rank; the 14 s grace is for a slow timer, not extra time. The timer faces the competitor and counts up. [STOA-PR] rules 8-10
- **Who applies it:** the judge ranks as if there were no penalty; tournament staff add penalties and re-rank. [STOA-JR]
- **Ranks:** an exact rank 1-8 on the tab ballot; usually 3 judges. [STOA-JR] The comment ballot shows only 1st-4th, then "5th and below" (not verified, [STOA-RB]).
- **Minimum time:** none stated (not verified).
- **Rubric (not verified, [STOA-RB]):** each row 1-5. Extemp, Apologetics and Mars Hill: 10 rows (analysis, rhetoric, impact, organization, language, vocal, physical, facial, appearance, manner). Original Oratory: 9 rows. Impromptu: 9 rows. Persuasive and interp rows: not read. The `stoa` profile holds **no** rubric until an official copy is read.
- **Events that differ from NSDA (not verified unless marked):** Apologetics 6:00, 4 min prep; Mars Hill 6:00, 4 min prep, own resource binder, one 4x6 card; Impromptu 5:00 with 2 min prep (prep verified, [STOA-desc]); Extemp 7:00, 30 min prep; OO, Expository 10:00; Persuasive 10:00 (verified, [STOA-PR]); Literary Interp 10:00; Duo 10:00; Open Interp 6:00; Storytelling 8:00; Slam Poetry 5:00.
- **Penalties:** quotes at most 30% in Persuasive; script or notes 2 ranks (both verified for Persuasive, [STOA-PR]); missing author or title in interp 1 rank (not verified).

## 14. Which leagues are fully sourced

| League | Status |
|---|---|
| CHSSA, UIL, TFA, IHSA, MSHSL, OSDA, MIFA | Profile fields all sourced. Small gaps: judge-ballot ties (CHSSA, TFA, MSHSL prelims), UIL 2026-27 Prose and Poetry Handbook and entry limit, IHSA section size, OSDA signal rule, MIFA extemp draw count and document date. |
| KSHSAA | Sourced. Gaps: ballot ties; festival comment sheet; "lowest rank past 30 s" has no field. |
| IHSSA | Ratings and overtime sourced. Gap: most event times not re-read in the 2026 articles. |
| NCFL | Sourced from the 2026 bylaws; the 2027 bylaws are not posted. |
| NCFCA | Overtime and rubric sourced. Gaps: ties, section size, rubric rows for 6 of 10 events. |
| Stoa | Overtime and tab ranks from 2025-26 official papers only. 2026-27 rules and all rubrics not verified. |

## 15. Not in this draft

- **Def v2 files** for league event times (UIL Prose 7:00, Kansas Prose 7:00, IHSA 8:00, Iowa 6:00, CHSSA Impromptu 2 + 5, NCFCA Apologetics, TFA Duet Acting and others). They need the def v2 fields (`timing.prepMax`, minimum time) and a separate step.
- **Radio windows, group events, Discussion, video events.** Later or not planned (EVENTS.md §5.2).
- **A shareable profile link.** Separate P3 step.

## Sources

- [CHSSA-27] CHSSA Rules and Regulations 2026-27: https://chssa.org/wp-content/uploads/2026/11/2026-27.RandR_.pdf
- [UIL] UIL Constitution and Contest Rules 2026-27: https://www.uiltexas.org/files/policy/2026-2027-UIL-Constitution.pdf
- [UIL-PJ] UIL judge procedures 2025: https://www.uiltexas.org/files/academics/speech/4._PoetryInstructions_25.pdf ; https://www.uiltexas.org/files/academics/speech/4._Persuasive_Judge_Procedures_25.pdf
- [UIL-RS] UIL multiple-judge ranking sheet: https://www.uiltexas.org/files/academics/speech/MultipleJudgeRankingSheet_21_22_Interactive_copy.pdf
- [TFA] TFA Constitution and Contest Rules 2026-27: https://docs.google.com/document/d/14F0q0qDvhaVr8bEPhpaCG1sJQJfNOpT_Ycl5wmqC7kg
- [IHSA-TC] IHSA 2026-27 Speech Terms and Conditions: https://ihsa-assets-prod.nyc3.digitaloceanspaces.com/documents/speech/2026-27/t-and-cs.pdf
- [IHSA-SM] IHSA 2026-27 Speech IE School Manual: https://ihsa-assets-prod.nyc3.digitaloceanspaces.com/documents/speech/2026-27/school-manual.pdf
- [KS] KSHSAA 2026-27 Debate, Speech and Drama Manual: https://www.kshsaa.org/Publications/debatespeechdrama.pdf
- [MN] MSHSL 2026-2027 Speech Rules and Policies: https://www.mshsl.org/sites/default/files/2026-09/2026-2027-speech-rules-and-policies-sept-17_2026.pdf
- [MN-JI] MSHSL judge instructions: https://www.mshsl.org/sites/default/files/2023-06/Speech%20Instructions%20for%20Judges.pdf
- [MN-B] MSHSL ballot: https://www.mshsl.org/sites/default/files/2022-03/SPBallot.pdf
- [OSDA-CEM] OSDA Competitive Events Manual (Aug 2026): https://drive.google.com/open?id=1r1yC7PSc9BG6MriHN-JTO5UW4Jo-2mUQ
- [OSDA-TOM] OSDA Tournament Operations Manual (Sep 2026): https://drive.google.com/open?id=1WmITzKgDqUR72z8cWiWVULRcVE4T20g3
- [OSDA-JH] OSDA 2026-27 Speech Judge Handbook: https://drive.google.com/file/d/1lDqR55uPAwtJs_GYOCjcjJrQex7pXJc3/view
- [MIFA] MIFA Speech Activities 2026-2027: https://docs.google.com/document/d/1PKQ_fh8tky46PY4eEmOlN_4XHMlmBvJO2KWpVz0cVBU
- [MIFA-B] MIFA ballots: https://www.themifa.org/ie-resources.html
- [IA-BL] IHSSA By-Laws 2026: https://www.ihssa.org/UserDocs/pages/bylaws_2026.pdf
- [IA-ART] IHSSA event articles: https://www.ihssa.org/ihssa-constitution/
- [IA-AM] IHSSA 2025-27 amendments: https://www.ihssa.org/UserDocs/pages/_2025-2027_ihssa_constitutional_amendments_full_including_2026.pdf
- [NCFL] NCFL By-Laws for 2026: https://www.ncfl.org/uploads/7/3/2/8/7328308/ncfl_bylaws_2025_after_fall_meeting2025_for_ncfl2026.pdf
- [NCFCA-timer] https://ncfca.org/rules/head-judge-instructions-for-timer-issues/
- [NCFCA-ev] https://ncfca.org/compete/speech/apologetics/rules (and the sibling event pages)
- [NCFCA-prep] https://ncfca.org/judge/speech/judge-prep/
- [NCFCA-rub] https://ncfca.org/resources/ballots-samples-all-events/
- [NCFCA-sum] https://ncfca.org/wp-content/uploads/NCFCA-Summary-of-Rule-and-Ballot-Changes-for-the-2026-2027-Season.pdf
- [STOA-PR] Stoa Persuasive Rules (rev 2025-07-14): https://www.stoausa.org/_files/ugd/559d9d_34eb4938e493488f94e1c2bdc553be87.pdf
- [STOA-JR] Stoa Judging Reminders (rev 2025-08-06), linked from https://www.stoausa.org/speech-resources
- [STOA-desc] https://www.stoausa.org/event-descriptions
- [STOA-RB] https://stoa-rulebook.netlify.app (unofficial; not verified)
