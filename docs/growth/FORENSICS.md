# Tabula Forensics: speech events and Congress

Status: draft for the owner, 2026-11-20. Planning only. No app code changed.

Related: [FORMATS.md](FORMATS.md) (debate formats), [BRAND.md](BRAND.md) (brand, accounts, repo).

**Name note:** "Forensics" is the working name in this file. The owner agrees it confuses people outside the activity. **Owner decision (2026-11-20): the public name is "Tabula Speech Events".** Its marketing site is tabulaforensics.com; its app will run on a tabulaspeech.com subdomain.

**Not legal advice. Rules change each season.** Main source: the NSDA High School Unified Manual, 2026-27 ([M] below). "Unverified" means I found no primary source.

## 1. Summary

- **What it is:** a judge and coach tool for speech events (extemp, oratory, interp, impromptu) and Congressional Debate.
- **The judge's real job in speech:** time 4–7 speakers, write comments for each, and rank them 1–7 with no ties. In Congress: score every speech for 3+ hours, track the presiding officer, and rank a top 8.
- **What Tabula Forensics does:** a room timer with grace-period flags, a fast comment sheet per competitor, a drag-to-rank board that blocks ties, and copy boxes for the online ballot. For Congress: a scoring grid and a top-8 helper. AI only cleans up the judge's own notes into kind, clear comments.
- **Code shared with Tabula Debate:** about 35–45% (estimate). The shell, clock engine, storage, AI client, keys, dialogs and export carry over. The flow grid, debate AI prompts and speech docs do not.
- **When:** after LD and PF (FORMATS.md). It is a new app, not a format file.

## 2. The events

| Event | Time limit | Prep and rules |
|---|---|---|
| US and International Extemp | 7 min + 30 s grace | Draw 3 questions, pick 1, 30 min prep. Speakers draw 7 min apart. No notes in the speech. Internet research in prep is allowed; talking to others is not. Cross-ex of 2 min in Nationals semis and finals. |
| Original Oratory | 10 min + 30 s | Memorized. No visual aids. |
| Informative | 10 min + 30 s | Memorized. Aids allowed, no electronics in the speech. |
| Dramatic, Humorous, Duo Interp | 10 min + 30 s | Memorized. |
| Program Oral Interp (POI) | 10 min + 30 s | Manuscript required. |
| Prose, Poetry (supplemental) | 5 min + 30 s | Manuscript. |
| Impromptu (supplemental) | 7 min total for prep and speech, + 30 s | Draw 3 topics, pick 1. No notes. |
| Congressional Debate | Speeches 3 min; questions 2 min after authorship and first negative, 1 min after others; 30 s per questioner | Session ≥ 3 h, ideal 18–20 students, max 30. Elected presiding officer (PO). Parliamentarian ranks everyone at the end. |

**Rules that shape the product** [M]:
- **Over grace means no 1st place.** A speaker past the limit plus 30 s cannot be ranked 1st.
- **Room size:** 4–7 entries, ideal 6.
- **Ranks:** 1 to 7, best to worst, **no ties**. NSDA district ballots need no points. Many invitationals add rating points (unverified as a general rule).
- **Ballot text:** must carry NSDA bias-awareness wording.
- **Congress points: two scales in the same manual.** Event rules say 1–6 per speech, averaged across the panel, with at least −3 for a speech on the wrong side. District rules say 1–8 per speech and 4–8 per hour of presiding, max 40 points per student per day. **The app must support both.**
- **Congress ranks:** each scorer ranks a top 8; the PO can be in it. Many tournaments give everyone else a tied 9.
- **Time signals:** not set in the manual. Hand or card signals are local custom.

College (AFA, NFA): similar events, mostly 10 min; separate national tournaments (unverified, thin sources).

## 3. What Tabula Forensics would do

### For judges (the first release)

1. **Room setup in one screen.** Event, round, entries (codes only, like "A12"), speaking order. Paste from the Tabroom or SpeechWire assignment.
2. **Room timer.** One tap per speaker. Shows time used and the event's limit. Big, calm time signals on screen for the speaker if the judge wants (phone held up, or laptop turned). **Flags "over grace"** and blocks rank 1 for that entry.
3. **Comment sheet per entry.** Short notes while they speak. Quick tags ("strong open", "pace", "blocking", "sources cited", "answered the question"). Event-specific prompts (extemp: answered the question, sources; interp: characters, cut, blocking; oratory: structure, appeal).
4. **Rank board.** Drag entries into order 1–7. No ties allowed. Optional rating points per tournament.
5. **"Clean up my comments" (AI, optional).** Turns the judge's own notes into kind, specific, readable comments. It does not rank and does not invent praise or faults. The judge edits and approves.
6. **Copy for the online ballot.** One box per entry for Tabroom or SpeechWire. Print / PDF for paper ballots.
7. **Offline first.** Speech rooms often have weak Wi-Fi. Everything but AI works offline.

### For Congress judges and scorers

1. **Scoring grid:** students down the side, speeches across. One tap enters a score on the tournament's scale (1–6 or 1–8). A note box per speech.
2. **PO hours** scored on their own row.
3. **Top-8 helper:** sorts by the judge's own scores as a starting point. The judge must confirm the order. Rank 9 for the rest if the tournament says so.
4. **Session timer** for speech and question blocks.

### For coaches (second release)

1. **Ballot box:** paste or photo-import comments from each tournament. See them by student and by event over the season. AI can sum up repeat themes (for example, "4 judges said pace").
2. **Practice timer** with grace flags, for team practice.
3. **Piece list:** each student's pieces, event and cut length. No script storage at first (copyright and size).
4. **Extemp practice:** draw a practice question, run the 30-minute prep clock, record a practice speech, get a transcript and a time-use report. Facts, not grades (same rule as the student edition).

### What it should not do

- **No AI ranking or "who won".** Judges decide. This matches the student edition rule: no live judging help in a round.
- **No recording in a competitive round by default.** Interp pieces use copyrighted texts, and speakers are minors. Recording is for practice only, with consent.
- **No extemp article filing at first.** Prepd and Extemp Genie already do this (about $25–35 a year). Link to them instead.
- **No tab system.** Tabroom and SpeechWire run tournaments. Tabula helps the judge in the room.

## 4. Shared code with Tabula Debate

Estimate from today's files (5,956 lines in the main app files).

| Part | Share? | Note |
|---|---|---|
| `ui.js`, `providers.js`, `keys.js`, `tour.js`, `tap.js` (~640 lines) | ✓ as is | Dialogs, AI providers, keys, tours |
| `clipqueue.js` (~160 lines) | ✓ for practice recording | Not used in competitive rounds |
| Clock engine, refresh-safe timer state | ✓ with a new face | One speaker at a time, grace flags |
| Storage, export/import, print, theme tokens, keyboard map, toasts | ✓ | Today inside `app.js` and `logic.js`; must move to a shared core first |
| Plans, credits, account, backup | ✓ | Same account and wallet (BRAND.md §5) |
| Flow grid, sheets, speech docs, SpeechDrop | ✗ | Debate only |
| Debate AI prompts (flow, Live Eval, ballot) | ✗ | New prompts: comment clean-up, coach summaries |
| Debate Library | ◐ | Pages on judging basics and bias apply; a Speech Library needs new pages per event |
| Rank board, comment sheet, Congress grid | new | New code |

**Overall: about 35–45% shared, 55–65% new** (estimate). The shared part is real only after the shared core is pulled out of `app.js` (BRAND.md §6). That refactor is the cost of a second app.

## 5. Market

| Figure | Value | How solid |
|---|---|---|
| NSDA Nationals 2025 | 7,089 students from 1,562 schools; 956 entered supplemental events only | Solid |
| NSDA members | 100,000–140,000 students, ~3,900–5,200 coaches (NSDA's own figures conflict) | Medium |
| Schools with programs | ~4,000 of ~25,000 US high schools (NSDA) | Medium |
| Speech vs. debate share | Not found | Gap |
| Entries per event | Not found; may be in the 2025 Nationals Tournament Book | Gap |

Reading this: speech events share the same schools, coaches and tournament days as debate. A coach who runs both is the best first buyer. Many speech judges are parents and community members with no training. They need a simple tool more than debate flow judges do.

**Rivals:** Tabroom and SpeechWire e-ballots (the official ballot, not a room helper). Prepd and Extemp Genie (extemp files). I found no strong room helper for speech judges. That gap is the opening.

## 6. Go-to-market for Forensics (after LD and PF)

1. **Start with coaches who run both debate and speech.** They already know Tabula.
2. **Lead with Congress scorers and extemp judges.** Congress scoring is the most painful by hand. Extemp judges care about time.
3. **Prove first:** 10 speech judges at one tournament. A judge finishes a 6-entry room's comments and ranks at least 30% faster than on paper. 4 of 5 say they would use it again.

## 7. Open questions for the owner

- **Q1.** Do you agree Forensics waits until LD and PF ship?
- **Q2.** Should judges be allowed to show the time signal to the speaker on their screen, or is that against local custom at your tournaments?
- **Q3.** Is "clean up my comments" acceptable as the only AI in a competitive speech round?
- **Q4.** Should Congress tools include a presiding-officer helper (speaker order and question order)? The PO is a student, so the student edition rules apply. It is a procedure aid, not coaching. Your call.
- **Q5.** Should the coach ballot box accept photos of paper ballots (needs AI reading, costs credits)?
- **Q6.** Do you know a speech coach who would test a beta?

## Sources

- NSDA High School Unified Manual 2026-27: https://docs.google.com/document/d/1hq7-DE6ls2ryVtOttxR4BNpRdP7xUbBr0M3SMYefek8 (linked from https://www.speechanddebate.org/high-school-unified-manual/)
- Extemp internet pilot: https://www.speechanddebate.org/wp-content/uploads/Pilot-Internet-Rules-2020.pdf; state adoption example: https://sites.google.com/inspeechanddebate.org/issda/rules
- Time signal custom (one tournament guide): https://s3.amazonaws.com/tabroom-files/tourns/25604/postings/35993/SpeechEventsJudgeGuide.pdf
- Congress scoring examples: https://www.speechwire.com/files/19894-Judge%20Guide%20for%20Congress%20&%20Impromptu.pdf, https://s3.amazonaws.com/tabroom-files/tourns/37570/postings/69253/NYCNSDAJudgeGuides.pdf
- NSDA judge training: https://speechanddebate.org/learn/courses/level-1-intro-to-judging-speech
- SpeechWire e-ballots: https://speechwire.com/p-features.php
- Tabroom: https://www.tabroom.com/index/about.mhtml
- Joy of Tournaments / Stoa: https://www.stoausa.org/post/software-update-news
- Extemp apps: https://apps.apple.com/us/app/id949527116, https://medium.com/prepd/prepare-for-success-with-prepd-3da968572b89
- Market: https://www.speechanddebate.org/community-impact-report-2025/, https://www.speechanddebate.org/wp-content/uploads/2025_NSDA_OnePager.pdf
- NFHS (no speech participant count): https://nfhs.org/stories/record-participation-numbers-indicate-importance-of-high-school-sports-in-students-lives
- College events (unverified): https://www.pacificu.edu/directory/student-affairs/clubs-organizations/speech-debate/events
- Code line counts: `wc -l` on the repo files, 2026-11-20.
