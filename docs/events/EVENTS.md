# Tabula Speech Events: which events make the cut (draft 1)

Status: plan for owner approval, 2026-11-20. No code changed.

**Not legal advice. Rules change each season. Each tournament's invitation wins.** All rule text is summarized in plain words; nothing is copied from rulebooks. "Unverified" means no primary source confirmed it.

Full research with every source key: shared notes folder, `speech-events/events-research.md` (league rules) and `speech-events/ballot-judging-research.md` (ballots, signals, critiques). Main source: the NSDA 2026-27 High School Unified Manual, v2027.1.2 [NSDA-HS].

## 1. Short answer

- **Events are data, not code.** Almost every event is "one or two performers, one timer, one ranked ballot". What changes is the time limit, the grace rule, the material rule and the checks. Each of those is a field in an event file ([ARCHITECTURE.md](ARCHITECTURE.md) §6.1).
- **So the v1 cut is about primitives, not events.** v1 ships every event that fits the core primitives. Events that need a new primitive wait.
- **v1 (17 events + Custom):** the 8 NSDA main events, 7 NSDA supplemental speech events, NSDA middle school Declamation and Mixed Extemp, and a **Custom event** form for any local event.
- **Phase P3 (see PLAN.md):** state and league packs (California CHSSA, Texas UIL and TFA, Illinois, Kansas, Minnesota, Ohio, Michigan, Iowa, NCFL, NCFCA, Stoa) as preset files, plus extemp cross-ex, Pro Con Challenge, and rating-only ballots.
- **Later or never:** Radio (audio-only window), large-group events, Discussion, Extemp Debate (it is a debate), Congress (phase P5, its own grid).

## 2. Rules every event shares (what the ballot holds)

From the ballot research ([Tabroom judge guides](https://www.speechanddebate.org/wp-content/uploads/Judging-with-Online-Ballots-on-Tabroom.pdf), [SpeechWire e-ballot guide](https://www.speechwire.com/files/10220-eballots-speech-judges.pdf)):

| Ballot part | What it is | App field |
|---|---|---|
| Entry code (sometimes name), title or topic | Who spoke and what | `code`, `title` |
| Rank | 1 to N, no ties, no skipped ranks | `rank` |
| Rating or points | Optional; scale set by the tournament (70–100, 90–100, 1–100, 1–25, 1–30, I–IV, word scales) | `rating` |
| Overtime box | A flag; on Tabroom the tab room applies the penalty | `timing.overGrace` (and `overLimit`) |
| No-show box | The entry did not come | `status: noShow` |
| Comment per entry | Written for the student | `comment` |
| Reason for rank | One box for the room on Tabroom; some leagues use a sheet | `reasonForRank` |

**Rule checks are an app feature, not a ballot field.** Tabroom and SpeechWire ballots have no rule-violation box other than overtime; rule issues go into the comment and the rank. The app's rule checks (§7) help the judge notice and remember; in leagues where officials decide penalties, the judge reports to the tab room.

**Timing of the ballot.** Tabroom and SpeechWire lock ranks on submit and keep comments open until the tournament ends. Tournaments want ranks about 5–10 minutes after the last speaker. The app's Review screen is built for this two-stage flow ([DESIGN.md](DESIGN.md) §4.7).

**Ranks.** NSDA district prelims: 4–7 entries (6 ideal), rank all, no ties, no points needed. When section sizes differ, ranks are truncated to the smaller size. NSDA Nationals supplemental prelims truncate ranks above 6 to 6 [NSDA-HS]. The app always ranks 1–N; truncation is the tab room's job, so the app does not do it.

**Over time (NSDA).** 30 s grace for every event. Past grace, the speaker cannot be ranked 1st. No other set penalty. On a panel, all judges must agree the speaker went past grace. No minimum time [NSDA-HS].

**Time signals (NSDA).** Not set by the rules. Competitors should be ready to time themselves; a missing signal cannot be protested at Nationals [NSDA-HS]. The usual custom is fingers counting down by the minute, a bent finger or "C" at 30 s, a fist at time (unverified as a rule; common in judge guides).

**Bias reminder.** NSDA district ballots must carry a short bias-awareness statement; online rounds add a note to disregard video and home setting [NSDA-HS]. The app shows the tournament's own wording if the judge pastes it, and a short neutral reminder otherwise (PLAN.md Q5).

**AI-written material (2026-27).** NSDA bans AI-written text in original speeches and AI-written material in interp [NSDA-HS]. This becomes a check for original events ("Possible AI-written text: flag"). The judge only flags.

## 3. NSDA main events (all v1)

All: 30 s grace, then no rank 1. Ballot: rank (+ optional rating), comment, reason for rank. Source [NSDA-HS].

| Event | Short | Category | Limit | Prep | Material | Performers | Checks the judge watches | Comment prompts | v1 |
|---|---|---|---|---|---|---|---|---|---|
| Original Oratory | OO | Public address | 10:00 | None | Memorized | 1 | No visual aids; ≤150 quoted words; no AI text | Thesis, structure, evidence, appeal, delivery | **Yes** |
| Informative | INF | Public address | 10:00 | None | Memorized | 1 | Aids allowed but no electronics, animals, helpers, costumes; ≤150 quoted words, cited aloud | Clarity, sources, aids, organization | **Yes** |
| US Extemp | USX | Limited prep | 7:00 | Draw 3, keep 1, 30 min (outside the room; speakers arrive 7 min apart) | No notes (a district pilot allows one 4×6 card; not at Nationals) | 1 | Answered the question asked; sources cited | Answered the question, analysis, sources, organization | **Yes** (CX in elims: phase P3) |
| International Extemp | IX | Limited prep | 7:00 | Same as USX | No notes | 1 | Same as USX | Same as USX | **Yes** |
| Dramatic Interp | DI | Interp | 10:00 | None | Memorized | 1 | Title and author named; no objects or costumes; one published source; no AI material | Characters, emotional truth, cut, blocking, intro | **Yes** |
| Humorous Interp | HI | Interp | 10:00 | None | Memorized | 1 | Same as DI | Characters, timing, pops, cut, intro | **Yes** |
| Duo Interp | DUO | Interp | 10:00 | None | Memorized | 2 (one entry) | Same as DI; off-stage focus (except intro); balanced parts | Partnership, focus, characters, cut | **Yes** |
| Program Oral Interp | POI | Interp | 10:00 | None | Manuscript in a binder | 1 | ≥2 pieces from ≥2 genres; titles and authors named; script held as the only prop | Program argument, transitions, characters, binder use | **Yes** |

Extemp note: prep is not timed by the judge. Extemp speakers arrive one at a time, so the roster must let the judge start any entry as it arrives.

## 4. NSDA supplemental and middle school events

All: 30 s grace, then no rank 1 (except where noted). Supplemental prelims use one judge [NSDA-HS], [NSDA-MS].

| Event | Short | Category | Limit | Prep | Material | Checks | v1 |
|---|---|---|---|---|---|---|---|
| Extemp Commentary | COM | Limited prep | 5:00 | Draw 3, 20 min, outside the room | No notes; delivered seated | Seated delivery | **Yes** |
| Prose | PRO | Interp | 5:00 (MS: 7:00) | None | Manuscript in a folder | No plays; title and author | **Yes** |
| Poetry | POE | Interp | 5:00 (MS: 7:00) | None | Manuscript | Title and author | **Yes** |
| Expository | EXP | Public address | 5:00 | None | Memorized; no cards or aids | No reused OO or INF material | **Yes** |
| Impromptu | IMP | Limited prep | **7:00 total, prep and speech together** | Draw 3, keep 1, **in the room** | No notes | Others wait outside | **Yes** (needs the in-room prep phase, primitive N6) |
| Storytelling | STO | Interp | 5:00 | None | Told from memory | One published story; a still chair allowed | **Yes** |
| Original Spoken Word Poetry | OSW | Public address | 5:00 | None | Memorized | Original; ≤150 quoted words | **Yes** |
| Declamation (MS) | DEC | Interp / public address | 10:00 | None | Memorized | A real public speech by someone else; intro gives title, author, date | **Yes** |
| Mixed Extemp (MS) | MX | Limited prep | 7:00 | Draw, prep outside | No notes (pilot: one 4×6 card) | Answered the question | **Yes** |
| Pro Con Challenge | PCC | Public address | Two 3–5 min speeches, 10:30 total | Uses a debate topic or Congress bill | Read from a script | Both sides argued | P3 (two runs in one entry; the rules call 10:30 hard yet also attach grace: unclear) |
| Extemp Debate | XDB | Debate (1 v 1) | 2-min speeches, 1-min CX | 30 min before | Notes allowed | Win or loss; no comments | **No** (it is a debate; fits Tabula Debate formats later) |

Note: NSDA no longer lists separate "consolation" events in the 2026-27 manual. HS Declamation is gone from NSDA (it lives in the MS manual, CHSSA, OSDA, NCFL).

## 5. State and league events

Most state events reuse an NSDA shape with a different time, grace or penalty. They ship as **league packs** (data files) in phase P3. The **Custom event** form covers any of them in v1.

### 5.1 Overtime rules differ by league

This is the most product-shaping fact in the research. The rules profile ([ARCHITECTURE.md](ARCHITECTURE.md) §6.2) must express each row.

| League | Grace | Effect past the limit | Who applies it |
|---|---|---|---|
| NSDA (HS, MS), NCFL, TFA | 30 s | No rank 1 | Judge |
| CHSSA (California) | 30 s | Drop one rank | Tab room |
| Kansas championship | 15 s | Past 15 s no rank 1; past 30 s lowest rank (official timekeeper) | Judge, with timekeeper |
| Kansas festivals | 15 s | No Division I rating | Judge |
| IHSA (Illinois) | 30 s | One rank lower per full 30 s over; judges ignore time | Tab room |
| UIL (Texas) prose, poetry | None | Disqualified from the round (state final: last place) | Contest director |
| MSHSL (Minnesota) | None (finish sentence) | Drop one rank | Rules Committee |
| IHSSA (Iowa) | None | Division IV | Judge |
| OSDA (Ohio), MIFA (Michigan) | 30 s / none | Judge's choice | Judge |
| NCFCA | 15 s | Minus 2 ranks, applied by software | Software |
| Stoa | — | 15 s or more: minus 1 rank (unofficial source) | Not stated |
| College (AFA, NFA) | None | Judge's choice | Judge |

**What the app does:** it always records the time and the over-limit and over-grace flags. It **enforces** a rule only when the judge applies it (NSDA "no rank 1"). When the tab room applies it, the app shows the flag and a note ("Your tab room applies the time penalty. Rank on performance.").

### 5.2 Event shapes in other leagues (phase P3 packs)

| Pattern | Examples | New need? | Phase |
|---|---|---|---|
| Same as an NSDA event, other time | UIL Prose and Poetry 7:00; Kansas Prose and Poetry 7:00; IHSA most events 8:00; Iowa Poetry and Prose 6:00; CHSSA Impromptu 2 + 5 | No (data) | P3 |
| Duet acting (partners may face each other, chairs or table) | TFA Duet Acting; IHSA Dramatic and Humorous Duet Acting; Kansas Duet Acting | No (data; Duo with other checks) | P3 |
| Original public address | CHSSA Original Advocacy (must name a law and who carries it out); CHSSA Original Prose/Poetry; IHSA Original Comedy, Special Occasion; Iowa After-Dinner Speaking; NCFCA Persuasive | No (data) | P3 |
| Speech by someone else | CHSSA Declamation; IHSA Oratorical Declamation; MN Great Speeches (adds analysis); Iowa Public Address; NCFL Oratorical Declamation | No (data) | P3 |
| Draw events with in-room prep | IHSA Impromptu (2 + 6, same topics for all); Kansas Impromptu (5 + 5); Kansas Improvised Duet Acting (min 4:00, max 7:00); Iowa Spontaneous, Improvisation; NCFCA Apologetics; Stoa Mars Hill | In-room prep phase (v1 primitive); **minimum time** field | P3 |
| Extemp variants | UIL Informative and Persuasive Extemp (draw 5, one 3×5 card); MN Extemp Reading; MIFA Duo Commentary (2 speakers, seated) | No (data) | P3 |
| Extemp cross-ex in elims | NSDA Nationals semis and finals (2 min); CHSSA, TFA (up to 3), OSDA finals | A CX run after the speech | P3 |
| Rating-only ballots | Iowa IHSSA (Division I–IV, no ranks); Kansas festivals (I–IV) | Rank board off; rating required | P3 |
| Top-N ranks plus unique percentage | MIFA (rank top 3, everyone else 4; unique 75–100, best gets 100) | `rankCount` cap + `ratingNoTies` + "best gets max" rule | P3 |
| Rubric scores plus rank | NCFCA (5 categories, 1–5 each); Stoa (10 criteria, 1–5) | A rubric grid per entry | P3 |
| Competitor keeps time | NCFCA | Judge timer optional | P3 |
| Radio / broadcast (audio only, strict window) | IHSA Radio Speaking (4:50–5:05 window; outside = last); Iowa Radio News; MIFA Broadcasting | **Time window** field; judge often hears audio from another room | Later |
| Group events (3–15 performers) | IHSA Performance in the Round; MIFA Multiple Interp; Iowa large group (Choral Reading, Ensemble Acting, Readers Theatre, One-Act) | Group entries; long limits (15–35 min) | Later |
| Group task | MN Discussion (up to 8, 60 min, separate critique sheet) | A different ballot | Not planned |
| Video events | Iowa Videocasting, Short Film | Judged from a file | Not planned |

### 5.3 College (not a target for v1)

AFA National Speech Tournament and NFA: prepared events run 10:00, interp holds a manuscript, limited prep runs 7:00, no automatic overtime penalty. Ballots: ranks 1–5 plus points 1–25 (AFA) or 1–30 with no ties (NFA). These fit the same primitives as a league pack [AFA], [NFA].

## 6. Congress (phase P5)

Congressional Debate is not an individual speech event in shape. It needs its own grid (primitive N14 in [SHARED-VS-NEW.md](SHARED-VS-NEW.md)). NSDA uses two point scales in the same manual: 1–6 per speech (event rules) and 1–8 per speech plus 4–8 per hour of presiding (district rules). Each scorer ranks a top 8. See `docs/growth/FORENSICS.md` §2 and the ballot research §6.

## 7. Rule checks the app knows (v1 list)

Each event file picks from this list. A check is a two-state pill: "OK" or "Flag". A flag adds a line to the private note, never to the student comment unless the judge writes it.

| Check id | Plain label | Events |
|---|---|---|
| `titleAuthor` | "Named the title and author" | DI, HI, DUO, POI, PRO, POE, STO, DEC |
| `noProps` | "No props or costume" | DI, HI, DUO, EXP, OO |
| `noVisualAids` | "No visual aids" | OO |
| `aidsOk` | "Aids within the rules" | INF |
| `manuscript` | "Read from the binder" | POI, PRO, POE |
| `memorized` | "Spoke from memory" | OO, INF, DI, HI, DUO, EXP, OSW, STO, DEC |
| `noNotes` | "No notes" | USX, IX, COM, IMP, MX |
| `quoteLimit` | "Quoting looked within the limit" | OO, INF, OSW |
| `answeredQuestion` | "Answered the question drawn" | USX, IX, COM, MX |
| `offStageFocus` | "Off-stage focus" | DUO |
| `seated` | "Delivered seated" | COM |
| `noAiText` | "No sign of AI-written text" | OO, INF, EXP, OSW, interp |

## 8. Sources

Keys as in the research file. Main ones:

- [NSDA-HS] NSDA 2026-27 High School Unified Manual v2027.1.2: https://www.speechanddebate.org/high-school-unified-manual/
- [NSDA-MS] NSDA 2026-27 Middle School Unified Manual: https://speechanddebate.org/middle-school-unified-manual
- [CHSSA] CHSSA Rules and Regulations 2025-26: https://chssa.org/wp-content/uploads/2025/09/2025-26.RandR_.pdf
- [UIL] UIL Constitution and Contest Rules 2026-27: https://www.uiltexas.org/files/policy/2026-2027-UIL-Constitution.pdf
- [TFA] TFA Constitution 2026-27: https://texasforensicassociation.com/new-coach-information/
- [KS] KSHSAA 2026-27 Debate, Speech and Drama Manual: https://www.kshsaa.org/Publications/debatespeechdrama.pdf
- [IHSA-TC] IHSA 2026-27 Speech Terms and Conditions: https://ihsa-assets-prod.nyc3.digitaloceanspaces.com/documents/speech/2026-27/t-and-cs.pdf
- [MN] MSHSL 2026-27 Speech Rules: https://www.mshsl.org/sites/default/files/2026-09/2026-2027-speech-rules-and-policies-sept-17_2026.pdf
- [IA-CON] IHSSA constitution 2026: https://www.ihssa.org/UserDocs/pages/constitution_2026.pdf
- [OSDA] OSDA manuals (Aug and Sep 2026), linked in the research file
- [MIFA] MIFA Speech Activities 2026-27: https://www.themifa.org/ie-resources.html
- [NCFCA] https://ncfca.org/rules/speech-general-rules/ and https://ncfca.org/rules/head-judge-instructions-for-timer-issues/
- [STOA] https://www.stoausa.org/event-descriptions (rules from an unofficial host: unverified)
- [NCFL] NCFL bylaws for 2026: https://www.ncfl.org/
- [AFA] AFA-NST charter: https://sites.google.com/site/afanietnew2/products-services/afa-niet-charter
- [NFA] NFA bylaws (2023): https://nationalforensicassociation.org/wp-content/uploads/2026/02/nfa-bylaws-january-2023.pdf
- Ballots: https://www.speechanddebate.org/wp-content/uploads/Judging-with-Online-Ballots-on-Tabroom.pdf, https://www.speechwire.com/files/10220-eballots-speech-judges.pdf

Known conflicts (details in the research file §9): Pro Con Challenge grace wording; OSDA signal rules; MIFA Storytelling notes; NCFCA Persuasive length (7:00 now); Stoa rules from an unofficial host; NCFL and NFA rule copies not this year's.
