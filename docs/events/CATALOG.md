# Tabula Speech Events: the full event panel (draft 1)

Status: plan for owner approval, 2026-11-21. No code changed.

This file answers the owner's request of 2026-11-21 for "a full panel of what sort of events there are". It lists every high school competitive event a judge may meet, and for each one: its category, which app owns it, whether `events/defs/` has it, and what new primitive it needs. It builds on [EVENTS.md](EVENTS.md) (rules of the 17 v1 events and the league packs) and does not repeat those rules.

**Not legal advice. Rules change each season. Each tournament's invitation wins.** All rule text is summarized in our own words.

Research behind this file (shared notes folder, `speech-events/`): `events-research.md` and `ballot-judging-research.md` (2026-11-20), `congress-and-panel-research.md` and `season-rhythm-research.md` (2026-11-21). Main source: the NSDA 2026-27 High School Unified Manual v2027.1.2 [NSDA-HS].

How to read the columns:

- **App:** **SE** = Tabula Speech Events. **TD** = Tabula Debate. The rule for the split is in [SEASON.md](SEASON.md) §4: an event goes to the app whose room shape it has.
- **Family:** the event families in [MODELS.md](MODELS.md) §1 (F1 prepared, F2 limited prep outside, F3 limited prep inside, F4 two runs, F5 other ballot shapes, F6 Congress, F7 group).
- **In defs:** **Yes** = a file is in `events/defs/` today. **Pack** = a league pack file later (PLAN.md P3). **Custom** = works now through the Custom event form. **—** = not in this app.
- **New primitive:** what code it needs past v1. "None" means data only.

## 1. Short answer

- **The owner's list is all covered.** Congress, LD, FX and DX (US and International Extemp), Impromptu, Oratory, Humorous and Dramatic Interp, Poetry and Prose each have a row below. Every speech event on the list already has a data file. Congress and LD do not, for different reasons: Congress needs its own grid (MODELS.md §4.6), and LD is a debate format that Tabula Debate already has (`formats/ld.v1.js`).
- **The events the owner was "missing"** are mostly these: Informative, Program Oral Interp (POI), Duo, Expository, Extemp Commentary, Storytelling, Original Spoken Word Poetry, Declamation, Pro Con Challenge, Extemp Debate, Big Questions, World Schools, Public Forum and Policy at NSDA; plus state events such as Duet Acting, Original Advocacy, Radio, Original Comedy, After-Dinner Speaking and the group events.
- **Counts (rows in this file):**
  - §2 has 18 NSDA speech events. 17 have data files today.
  - §3 has 8 debate events for Tabula Debate.
  - §4 has Congress: chambers, roles and league variants.
  - §5 has 35 rows of state and league events. Same-shape events share a row. About half are data only. The rest need a pack primitive (LANDING.md §4.2), need group entries, or are out of scope.
- **NSDA has no consolation events in 2026-27.** Students cut early from a main event at Nationals may enter supplemental events instead [NSDA-HS].

## 2. NSDA speech events (Speech Events app)

| Event | Short | Category | App | In defs | Family | New primitive | Notes |
|---|---|---|---|---|---|---|---|
| Original Oratory | OO | Public address | SE | Yes | F1 | None | Main event |
| Informative | INF | Public address | SE | Yes | F1 | None | Main event |
| United States Extemp ("DX") | USX | Limited prep | SE | Yes | F2 | Drawn-question field (E10); later cross-ex in elims | Main event |
| International Extemp ("FX") | IX | Limited prep | SE | Yes | F2 | Same as USX | Main event |
| Dramatic Interp | DI | Interp | SE | Yes | F1 | None | Main event |
| Humorous Interp | HI | Interp | SE | Yes | F1 | None | Main event |
| Duo Interp | DUO | Interp | SE | Yes | F1 | None (two performers, one entry) | Main event |
| Program Oral Interp | POI | Interp | SE | Yes | F1 | None | Main event |
| Extemp Commentary | COM | Limited prep | SE | Yes | F2 | Drawn-question field | Supplemental, pattern A |
| Original Spoken Word Poetry | OSW | Public address | SE | Yes | F1 | None | Supplemental, pattern A |
| Prose | PRO | Interp | SE | Yes | F1 | None | Supplemental, pattern A |
| Expository | EXP | Public address | SE | Yes | F1 | None | Supplemental, pattern A |
| Impromptu | IMP | Limited prep | SE | Yes | F3 | In-room prep phase (N6, v1) | Supplemental, pattern B |
| Poetry | POE | Interp | SE | Yes | F1 | None | Supplemental, pattern B |
| Storytelling | STO | Interp | SE | Yes | F1 | None | Supplemental, pattern B |
| Declamation (middle school manual) | DEC | Interp / public address | SE | Yes | F1 | None | Also CHSSA, OSDA; NCFL Oratorical Declamation |
| Mixed Extemp (middle school manual) | MX | Limited prep | SE | Yes | F2 | Drawn-question field | v1 file kept; see PLAN.md Q11 note in §7 |
| Pro Con Challenge | PCC | Public address | SE | Pack | F4 | Two runs in one entry | Not confirmed at Nationals 2027 |

## 3. Debate events (Tabula Debate app)

These have two sides and a flow. They stay in Tabula Debate, whatever day or season they run ([SEASON.md](SEASON.md) §3–§4). Source: [NSDA-HS] unless noted.

| Event | Category | App | Tabula Debate status | Ballot shape | New code in Tabula Debate |
|---|---|---|---|---|---|
| Policy (CX) | Team debate, 2 v 2 | TD | **Live** (`formats/policy-hs.v1.js`) | Win or loss, speaker points, speaker ranks | — |
| Lincoln-Douglas (LD) | Solo debate, 1 v 1 | TD | **Merged on main** (`formats/ld.v1.js`) | Win or loss, speaker points | — |
| Public Forum (PF) | Team debate, 2 v 2 | TD | Next in the owner's order | Win or loss (points at Nationals not confirmed) | Coin-flip order, crossfire rows (FORMATS.md §4) |
| World Schools (WSD) | Team debate, 3 speakers of 3–5 | TD | Not planned yet | Per-speaker scores for style, content and strategy (60–80 per speech, 30–40 for the reply, unverified for 2027); higher team total wins | Points of information, reply speech, prepared and impromptu motions |
| Big Questions (BQ) | Solo or pair debate | TD | Not planned yet | Win or loss, speaker points | Question periods; one topic a year |
| Extemp Debate (XDB) | Solo debate, 1 v 1 | TD | Not planned yet | Win or loss only, no comments | Short speeches; nearly data only |
| Parliamentary (CHSSA, Oregon OSAA, NPDA-style) | Team debate | TD | Later (FORMATS.md) | Win or loss, speaker points | Points of information |
| Spontaneous Argumentation (SPAR) | Solo debate | TD | Not planned | Varies by tournament | Custom format |

Congress is debate in content but a speech room in shape. It is in §4.

## 4. Congress (Speech Events app)

| Event | Category | App | In defs | Family | New primitive | Notes |
|---|---|---|---|---|---|---|
| Congress, House | Congress | SE | — (chamber file later) | F6 | Congress grid (N14; MODELS.md §4.6) | NSDA main event |
| Congress, Senate | Congress | SE | — | F6 | Same | NSDA main event |
| Congress, Final Session (Nationals) | Congress | SE | — | F6 | Same | At Nationals: 8 scorers; the manual now says "Final Session", not "Super Session" [NSDA-HS] |
| Presiding Officer (PO) | Role inside Congress | SE (scored by the judge) | — | F6 | PO terms and points per hour | The PO is a student. A PO helper (precedence, recency) is out of scope |
| Parliamentarian | Role inside Congress | SE | — | F6 | Full-chamber ranking | An adult; ranks everyone at NSDA, TFA and UIL |
| UIL Congress ("Super Congress" at state) | Congress | SE | — | F6 | 1–6 points on each student's first 5 speeches | 2024-25 rules; no newer copy found |
| TFA Congress | Congress | SE | — | F6 | 0–6 points | 2026-27 |
| NCFL Student Congress | Congress | SE | — | F6 | Point scale not confirmed | |

**What a Congress judge does** [NSDA-HS], from the research:

- A session lasts at least 3 hours. 18–20 students is best; 30 is the most.
- Every speech is 3 minutes. The authorship or sponsorship speech and the first negative get 2 minutes of questions. Every other speech gets 1 minute. NSDA districts and Nationals use direct questioning (30-second blocks).
- **NSDA district scorer:** 1–8 points per speech, 4–8 points per full hour of presiding, a top-8 rank list at the end of each session. At least 2 scorers per session. Ranks lock until PO points are in (on Tabroom).
- **NSDA Nationals scorer:** 3–9 points per speech and per full PO hour; top 8.
- **NSDA parliamentarian:** no points; ranks the whole chamber. At districts the top 8 of that list count as one judge's ranks.

## 5. State and league events

Most reuse an NSDA shape with different data. Rules per league: EVENTS.md §5 and the research file. Shapes merged where they match.

| Event | Leagues | Category | App | In defs | Family | New primitive |
|---|---|---|---|---|---|---|
| Duet Acting (Dramatic, Humorous) | TFA, IHSA, KSHSAA | Interp | SE | Pack / Custom | F1 | None |
| Solo Acting (Humorous, Serious) | KSHSAA | Interp | SE | Pack / Custom | F1 | None (HI/DI with Kansas times) |
| Dramatic Performance | NCFL | Interp | SE | Pack / Custom | F1 | None |
| Oral Interpretation (prose and poetry programme) | NCFL | Interp | SE | Pack / Custom | F1 | None |
| Oratorical Declamation | NCFL (grades 9–10), IHSA | Interp / public address | SE | Pack / Custom | F1 | None |
| Original Advocacy | CHSSA | Public address | SE | Pack / Custom | F1 | None |
| Original Prose/Poetry | CHSSA | Public address | SE | Pack / Custom | F1 | None |
| Creative Expression | MSHSL | Public address | SE | Pack / Custom | F1 | None |
| Great Speeches | MSHSL | Public address | SE | Pack / Custom | F1 | None |
| Public Address | IHSSA | Public address | SE | Pack / Custom | F1 | None |
| Original Comedy, Special Occasion Speaking | IHSA | Public address | SE | Pack / Custom | F1 | None |
| After-Dinner Speaking | IHSSA | Public address | SE | Pack / Custom | F1 | None |
| Reviewing, Literary Program, Acting | IHSSA | Public address / interp | SE | Pack / Custom | F1 | None |
| Sales | MIFA | Public address | SE | Pack / Custom | F1 | None |
| Prose Reading, Poetry Reading | IHSA | Interp | SE | Pack / Custom | F1 | None |
| Prose and Poetry Interpretation (7:00, categories A/B) | UIL | Interp | SE | Pack | F1 | Overtime effect `disqualified` (L3) |
| Storytelling (drawn story, 30 min ahead) | MSHSL | Interp | SE | Pack / Custom | F2 | Drawn-item field |
| Informative and Persuasive Extemp | UIL | Limited prep | SE | Pack | F2 | Note-card rule (L4) |
| Extemp Speaking (one card), Extemp Reading | MSHSL | Limited prep | SE | Pack / Custom | F2 | Note-card rule (L4) |
| Prepared Commentary | OSDA | Public address | SE | Pack / Custom | F1 | None (seated check) |
| Duo Commentary | MIFA | Limited prep | SE | Pack / Custom | F2 | None (two performers) |
| Impromptu variants (2 + 5, 2 + 6, 5 + 5, prep and speech together) | CHSSA, IHSA, KSHSAA, MIFA | Limited prep | SE | Pack | F3 | Separate prep cap `timing.prepMax` (L2) |
| Improvised Duet Acting (4:00 minimum) | KSHSAA | Limited prep | SE | Pack | F3 | Minimum time `timing.min` (L2) |
| Spontaneous Speaking, Improvisation | IHSSA | Limited prep | SE | Pack | F3 | `timing.prepMax` (L2) |
| Apologetics, Mars Hill Impromptu | NCFCA, Stoa | Limited prep | SE | Pack | F3 | Rubric (L8) |
| Persuasive and other NCFCA / Stoa events | NCFCA, Stoa | Mixed | SE | Pack | F1–F3 | Rubric grid (L8) |
| Any event in a rating-only league | IHSSA, Kansas festivals | — | SE | Pack | F5 | Rating-only ballot (L7) |
| Any event with top-3 ranks | MIFA | — | SE | Pack | F5 | Top-N ranks (L7) |
| Radio Speaking, Radio News, Broadcasting | IHSA, IHSSA, MIFA | Public address | SE | Later | — | Time window; audio from another room |
| Performance in the Round, Multiple Interp | IHSA, MIFA | Group interp | SE | Not planned | F7 | Group entries |
| Readers Theatre, Choral Reading, Ensemble Acting, One-Act, group mime and improv | IHSSA, KSHSAA festivals | Group interp | SE | Not planned | F7 | Group entries, long limits |
| Solo Musical Theatre | IHSSA | Interp | SE | Custom | F1 | None |
| Discussion | MSHSL | Group task | — | Not planned | — | A different ballot |
| Videocasting, Short Film, TV Newscasting | IHSSA | Video | — | Not planned | — | Judged from a file |
| Mock Trial, Model UN | many | Other activities | — | Out of scope | — | — |

College events (AFA, NFA) fit the same primitives as a league pack. They are not a target (EVENTS.md §5.3).

## 6. Gaps against the owner's list

| The owner named | Covered? | Where it lives |
|---|---|---|
| Congress | **Not built.** Model ready (MODELS.md §4.6); steps K1–K8 (LANDING.md §4.3). | Speech Events |
| LD ("a Friday event during the spring") | Built in Tabula Debate. The spring part holds only in Texas UIL, Oklahoma and Missouri; the speech-event part holds nowhere (SEASON.md §3). | Tabula Debate |
| FX and DX | Data done (`ix`, `usx`). | Speech Events |
| Impromptu | Data done (`imp`). | Speech Events |
| Oration | Data done (`oo`). | Speech Events |
| Humorous and Dramatic Interp | Data done (`hi`, `di`). | Speech Events |
| Poetry, Prose | Data done (`poe`, `pro`), high school limits (PLAN.md Q11). | Speech Events |
| "Others that I'm missing" | §2–§5 above. | Both apps |

## 7. Notes and open points

- **Mixed Extemp and Declamation come from the NSDA middle school manual.** After PLAN.md Q11 (v1 is high school only), the files stay: Declamation is also a high school event in CHSSA, OSDA, IHSA and NCFL. Mixed Extemp stays as a v1 file because it is a plain extemp shape and costs nothing. If the owner wants v1 strictly high school by source, Mixed Extemp can leave the v1 list; that is a one-line data change, listed here for the owner, not decided.
- **World Schools and Big Questions** are real NSDA events that a debate judge meets at districts and Nationals. They belong in Tabula Debate's format list, after PF. This file only records them.
- **Could not verify:** NCFL Congress point scale; CHSSA Congress scoring; UIL Congress rules newer than 2024-25; a 2027 World Schools manual; whether PF gets speaker points at Nationals; whether Pro Con Challenge runs at Nationals 2027.

## 8. Sources

Keys as in EVENTS.md §8, plus:

- [NSDA-HS] NSDA 2026-27 High School Unified Manual v2027.1.2: https://www.speechanddebate.org/high-school-unified-manual/
- NSDA Nationals: https://www.speechanddebate.org/nationals/ and the 2026 livestream archive: https://www.speechanddebate.org/nationals-2026-livestream-archive/
- NSDA World Schools manual (2023): https://www.speechanddebate.org/wp-content/uploads/USWSDI-Manual-2023.pdf
- UIL Congress rules 2024-25: https://uiltexas.org/files/academics/speech/24-25-congress-rules.pdf ; UIL debate: https://www.uiltexas.org/speech/debate
- TFA state debate rules: https://s3.amazonaws.com/tabroom-files/tourns/39577/postings/69883/11ArticleXI_TheStateTournamentDebateRules.pdf
- NCFL events: https://www.ncfl.org/events.html ; NCFL Congress manual (2022): https://www.ncfl.org/uploads/7/3/2/8/7328308/ncflcongressmanual_2022_.pdf
- Oregon OSAA parliamentary rules: https://osaa.org/docs/spe/ParliamentaryDebateRules.pdf
- SPAR example rules: https://s3.amazonaws.com/tabroom-files/tourns/26276/postings/35804/ClaremontSPARRules.pdf
- State and league speech rules: EVENTS.md §8.
