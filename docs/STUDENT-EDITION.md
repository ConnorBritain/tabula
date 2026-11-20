# Tabula Student Edition: design doc (draft 1)

Date: 2026-11-19. Status: proposal. No app code is changed by this doc.

The judge app helps a judge flow and decide a round. The Student Edition helps a **debater** with the clerical work of debate: flowing, filing, and sending docs. It does **not** debate for them.

One line: **the AI is a clerk and a practice partner. It is never a second partner in the round.**

---

## 1. Principles

### 1a. What the AI may do

- **Flow.** It writes down what each speaker said, in the right column, next to the right argument.
- **Transcribe.** It turns speech into text.
- **Organize.** It sorts flows, tags, and files. It shows what is answered and what is not, as a fact, with no advice.
- **File.** It puts cards and docs in the evidence locker, and sends a speech doc to SpeechDrop when the debater clicks Send.

### 1b. What the AI may not do

- **Write arguments.** No blocks, no analytics, no rebuttal text, no cards cut by AI.
- **Pick strategy.** No "go for T", no "kick the CP", no "extend this".
- **Coach in a round.** In a competitive round, no hints, no ranked lists of drops, no "you should".

### 1c. The test for every feature

Ask one question: **"Does this do a thing a good clerk does, or a thing a debater does?"**

- A clerk writes down, sorts, finds, and sends.
- A debater picks, argues, answers, and decides.

If a feature does what a debater does, it is **practice-only** (with Socratic questions, not answers) or it is **not built**.

### 1d. Why

- Debate teaches logic, listening, and quick thought. If the AI does that part, the student learns less.
- Rules (see §4) forbid help from non-competitors during a round. An AI that suggests strategy is that kind of help.
- Judges and opponents must trust the tool. A clear line makes that trust possible.

---

## 2. Modes

There are two modes. The mode shows on every screen.

### 2a. Tournament mode

For any round that counts.

**On:**
- Flow (manual, keyboard first, same as the judge app).
- Live transcription into the flow, **only** where the tournament allows it (see §4; NCFL 2026 bans it).
- Timers and prep clocks.
- Evidence locker: search your own files, build a speech doc, mark the speech, send to SpeechDrop.
- **No-audio mode**: flow and docs with the microphone off. This works at every tournament.

**Off (locked, not just hidden):**
- Every AI feature that makes text the debater could say: strategy, suggestions, "what did I drop?", Live Eval, ballot guesses, analysis, Socratic prompts.
- Chat or messages to anyone. Tabula has no chat, and it adds none.
- Any network call except: the transcription provider (if on), SpeechDrop, and file sync of the debater's own locker.

**The badge.**
- A large, fixed badge: **"TOURNAMENT MODE: flow and files only"**, with the start time.
- Tap the badge to see a one-screen list of what is on and what is locked. A judge or opponent can read it in 10 seconds.
- The badge shows a short code (for example `T-4K9P`). The same code is in the round log. Two people can match it.
- To leave tournament mode mid-round, the debater must end the round. The log records it.

**The round log.**
- A plain list with times: mode on, round start, transcription on/off, each doc sent, each AI call (type only, for example "flow pass"), mode off.
- **No speech text, no flow content, no names** in the log. Only events.
- The log stays on the device. The debater can export it as a file. A coach or a tournament can ask for it.
- The log is signed with a hash chain (each line includes a hash of the line before it). Any edit breaks the chain. This shows tampering. It does not prove the app was not changed; see §7.
- Honest limit: a local app cannot prove what a student did on another device. The log is a trust aid, not a lock.

### 2b. Practice mode

For drills, practice rounds, and review after a round. All of it is off in tournament mode.

- **Drills.** Flow drills from a recorded or practice speech: the app compares the student's flow with its own flow and shows what the student missed. Speed drills. Line-by-line drills.
- **Feedback on recorded speeches.** Speed (words per minute), clarity (words the transcriber could not catch), time use per argument. Facts, not grades.
- **"What did I drop?" review, after the round.** The app lists arguments with no answer on the flow. It shows them as facts with a pointer to the flow cell. It does **not** say which drop mattered or what to say.
- **Socratic questions instead of answers.** For a drop, the app asks: "What is the warrant of this argument?", "Which of your cards answers it?", "Why does this matter for the ballot?". The student writes the answer. The app never writes the answer for them.
- **Redo a speech.** The student re-gives a rebuttal. The app flows it and shows which arguments are now answered.

Practice mode never writes a block, a card, or a speech.

---

## 3. Evidence workflow

### 3a. Evidence locker

- The locker holds the student's own files: Word docs, PDFs, and cut cards.
- The app reads tags and cites from Verbatim-style Word docs (heading levels as pockets, hats, blocks, tags).
- **AI may:** index files, find cards by words in the tag or cite, find duplicates, show where a card was used before.
- **AI may not:** write tags, cut cards, summarize a card into a new claim, or rank cards for a speech.
- Search is plain text first. AI search (find by meaning) is an option, and it searches only the student's own files.
- Storage: on the device (IndexedDB), as in the judge app. Cloud sync is a paid add-on (§6).

### 3b. Build a speech doc

- The student drags cards and blocks into a new doc, in order.
- The app keeps Verbatim formatting so the doc opens cleanly in Word.
- The app checks clerical things only: a card with no cite, an empty block, a missing heading.

### 3c. Mark the speech

- Each doc gets a speech tag: 1AC, 1NC, 2AC, 2NC, 1NR, 1AR, 2NR, 2AR, or CX.
- The file name follows one pattern, for example `2AC — Round 3 — Aff.docx`. No student names in the file name by default.
- This is the same speech mapping the judge app uses, so a judge on Tabula sees the doc on the right speech.

### 3d. Send to SpeechDrop

- Today Tabula **lists** a room's files through the local helper (`bridge.mjs`).
- Upload is new. **SpeechDrop** (github.com/yunyu/SpeechDrop, MIT licence) has **no official API**.
  - An upload would have to copy its web form flow: load the room page, read the CSRF token (a one-time code the server puts in the form to block forged posts), then post the file.
  - That can break when SpeechDrop changes its page. It also puts load on a free service that one person runs.
- **Rule: talk to the SpeechDrop maintainer before building upload.** Ask for permission, rate limits, and if they want a small upload endpoint. Offer to help build it (MIT).
- Until then, the fallback is safe and simple: **"Open SpeechDrop room" + "Copy file to clipboard / Show in Finder"**. The student drops the file by hand.
- Upload, when built, sends only on a click. It never sends by itself. It shows the room code and file name before sending. Each send goes in the round log.
- Other share paths to consider later: email chain (draft only, the student sends), Tabroom file share, a USB/flash drive export.

---

## 4. Rules research

**Not legal advice. Rules change every season. Check each tournament's invitation.** All sources were seen 2026-11-19. I could not open the official 2026-27 NSDA manual or the 2026 NCFL bylaws; some rules below come from tournament-posted copies. Each row says what I saw.

### 4a. What the rules say

| Body | Topic | What the rule says (summary) | Source (seen 2026-11-19) |
|---|---|---|---|
| NSDA | Devices and internet | Internet-enabled devices are allowed at Nationals. Students may retrieve files, exchange evidence, and research. They may **not** use the internet to get help from non-competitors (coaches, other students), inside or outside the round. Partner talk is not limited. Qualifiers set their own rules. | 2024-25 High School Unified Manual (Tabroom copy) |
| NSDA | Outside help, penalty | Using a device in a round to get information for advantage from non-competitors means disqualification and loss of all rounds and points in that event. | Unified Manual (as summarized in search results) |
| NSDA | AI in debate | AI may guide research to articles and sources. AI is **not** a citable source. The original source of any quoted or paraphrased evidence must be available if asked. Original-speech events ban quoting or paraphrasing AI text. | 2025-26 Unified Manual p. 141, tournament copy for 2026 Nationals; 2023 Board ruling |
| NSDA | AI ban proposal | In Nov 2025 the Rules Committee reviewed a member proposal to ban AI use in debate and Congress. I did not find the outcome. | 2025 November Competition Rules Minutes |
| NSDA | Recording | No audio or video recording of rounds at Nationals without the Association's written consent. | 2025-26 Unified Manual (Tabroom copy) |
| NCFL | Devices | Computers allowed in Policy, LD, PF, Extemp, Congress. No connection to anyone except the competitors and judges in the room. | NCFL By-laws 2022 (full text); 2026 Nationals WiFi page |
| NCFL | Recording and AI transcription | **2026 Nationals bans audio, video, and photo recording in rounds. The ban covers AI tools, apps, or devices used to record or transcribe a round.** Quoting an AI tool requires saying so. | 2026 NCFL Nationals "WiFi & Technology" page |
| CHSSA (California) | AI | Generative AI should not be cited as a source. | CHSSA Rules and Regulations 2025-26 |
| CHSAA (Colorado) | AI | Uses NSDA wording: no AI text in original-speech events. | CHSAA S&D Handbook 2024-25 (newest found) |
| UHSAA (Utah) | Devices | Students follow the NSDA Unified Manual rules on devices and internet. | UHSAA Handbook 2026-27 |
| ASDA | AI | AI tools allowed in scripted events and debate, but AI content must be cited aloud and in writing. Banned in limited-prep events. | ASDA 2025-26 Handbook |
| UIL (Texas) | Devices, AI | UIL has a "Computers in Debate" guide (2024-25) and an AI statement (2025). I saw titles only, not the text. | UIL files (titles only) |
| Idaho, Nebraska, Iowa | Recording, AI | From BUSINESS-PLAN.md §10: Idaho says judges may not record; Nebraska NSAA asks judges not to use AI for final decisions; an Iowa state rulebook needs all-party permission to record. | BUSINESS-PLAN.md §10, §13; search result for Iowa |
| TFA (Texas), OSAA (Oregon) | — | Not found. Check before any Texas or Oregon launch. | — |

### 4b. What this means

1. **Help from outside the round is the core ban.** An AI that suggests what to say acts like a coach in the round. Under NSDA wording that risks disqualification. So strategy features are **never** on in tournament mode.
2. **Recording and transcription are the risk zone.** NCFL 2026 bans AI transcription outright. NSDA Nationals needs written consent to record. Many states need all-party consent to record. So transcription is **off by default** in tournament mode, and No-audio mode is always there.
3. **Flowing on a laptop and file exchange are normal and allowed** almost everywhere.
4. **AI is not evidence.** The locker must never let an AI summary pass as a card.

### 4c. Feature map

Allowed = fine in a competitive round where devices are allowed. Practice-only = locked in tournament mode. Not allowed = never built.

| Feature | Status | Why |
|---|---|---|
| Manual flow, timers, prep clocks | **Allowed** | Same as paper or Excel flow. |
| Evidence locker search (own files, text search) | **Allowed** | Retrieving own files is allowed (NSDA). |
| Build speech doc, mark speech | **Allowed** | Clerical. |
| Send doc to SpeechDrop / share with the room | **Allowed** | Exchange with in-room people is allowed (NSDA, NCFL). |
| AI flow from the student's typed notes (cleanup, column placement) | **Allowed, with care** | Clerical. It must not add content. Off if a tournament bans AI tools. |
| Live transcription into the flow | **Allowed only where the tournament permits; off by default** | NCFL 2026 bans it. NSDA Nationals needs written consent. State consent laws apply. |
| AI search of locker by meaning | **Allowed, with care** | Retrieval of own files. Off if the tournament bans AI tools. |
| "What did I drop?" list | **Practice-only** | In a round, a list of drops is coaching. |
| Socratic questions | **Practice-only** | Same reason. |
| Speech feedback (speed, clarity, time use) | **Practice-only** | Needs recording. Coaching. |
| Flow drills vs. AI flow | **Practice-only** | Training tool. |
| Live Eval, ballot guess, "who is winning" | **Practice-only** (for coach-run practice rounds) | Coaching. |
| AI-written blocks, analytics, rebuttals | **Not allowed** | Writes arguments. Against §1 and NSDA original-work rules. |
| AI-cut cards or AI summaries used as evidence | **Not allowed** | AI is not a citable source (NSDA, CHSSA). |
| Strategy suggestions ("go for X") | **Not allowed** | Picks strategy. |
| Chat, messages, or remote coach view during a round | **Not allowed** | Help from non-competitors (NSDA, NCFL). |

---

## 5. Coach and program controls, consent, privacy

### 5a. Coach controls (Program plan)

- A coach links students with a Program code (same code system as Programs in BUSINESS-PLAN.md §2b).
- Per student or per team, the coach sets:
  - Which modes are open: Tournament only, or Tournament + Practice.
  - Is live transcription allowed in tournament mode? (Default: no.)
  - Are AI clerk features (AI flow cleanup, AI search) allowed in tournament mode? (Default: no.)
  - Is hosted AI on, and how many credits from the pool?
- The coach can view **round logs** (events only) a student chooses to share. The coach **cannot** see flows, transcripts, or audio unless the student shares a file.
- A coach can set a **tournament profile** for a given tournament (for example "NCFL 2027: transcription off, AI tools off"). Students load it with one tap.

### 5b. Consent for recording minors

- Most debaters are 14 to 18. Recording a minor's voice needs more care than recording a judge.
- Before any recording, in any mode:
  1. The app asks: "Did everyone in the room agree to be recorded?" It shows a one-line script to read aloud.
  2. A visible "transcribing" light shows while the mic is on.
  3. The app logs "consent given" with a time, on the device only.
- For students under 18 using hosted AI or recording features: **school or parent consent through a Program code** (same rule as BUSINESS-PLAN.md §12 Q7).
- Under 13: not allowed (COPPA). No marketing to middle-school students until a COPPA review.
- All-party consent states (CA, FL, IL, MD, MA, MT, NV, NH, PA, WA and others): the app shows a stronger warning there. No-audio mode is always one tap away.
- Audio stays on the device only until it is transcribed, then the app deletes it (same rule as BUSINESS-PLAN.md §6b).

### 5c. Privacy

- **Names stay out of AI prompts.** Use the judge app's anonymize step (`L.anonymize` / `L.deanonymize` in `logic.js`): debater names become 1A/2A/1N/2N, team names become "the Aff team"/"the Neg team", and names go back in on the device.
- Extend it to the locker: school names and author-of-file fields are stripped from text sent to AI.
- The server keeps only account, ledger, and usage counts. No audio, no transcripts, no flows, no locker files, no student names (BUSINESS-PLAN.md §10 row 11).
- FERPA and state student-privacy laws: have the SDPC National DPA ready before any school signs a Program (BUSINESS-PLAN.md §10 row 7).
- No training on student data. No ads. No sale of data.
- Voiceprints (telling speakers apart): not in the Student Edition. Biometric law risk (BUSINESS-PLAN.md §10 row 15).

---

## 6. Fit with the business plan

The business plan says: **Free is the whole app; paid plans sell hosted AI with no key.** The Student Edition keeps that rule.

| Feature | Free | Free + own key | Pass (18+ only) | Program (coach code) |
|---|---|---|---|---|
| Tournament mode, badge, round log | ✓ | ✓ | ✓ | ✓ |
| Manual flow, timers, No-audio mode | ✓ | ✓ | ✓ | ✓ |
| Evidence locker (on device), text search, build doc, mark speech | ✓ | ✓ | ✓ | ✓ |
| SpeechDrop: open room, list files, copy/drop file | ✓ | ✓ | ✓ | ✓ |
| SpeechDrop upload (after maintainer talk) | ✓ | ✓ | ✓ | ✓ |
| Browser transcription (Chrome) | ✓ | ✓ | ✓ | ✓ |
| AI flow cleanup, AI locker search | – | ✓ | credits | pool |
| Practice: drills, feedback, drop review, Socratic questions | – | ✓ | credits | pool |
| Hosted transcription | – | own key | credits | pool |
| Encrypted locker sync between devices | – | – | yearly | ✓ |
| Coach controls, tournament profiles, shared logs | – | – | – | ✓ |
| Consent for under-18 hosted AI | – | – | – | ✓ (school consent) |

Notes:
- **Students under 18 cannot buy a Pass** (Stripe and ToS need 18+). So the Program plan is the main paid path for students. This makes the Student Edition a strong reason for a school to buy a Program.
- **Free + own key** is open to students 13+, as in the judge app. Many students will not have a key. That is an equity issue; see §7.
- A Program could be priced with a student seat count. Open question (§9).
- Costs: practice features use the same cheap models as the judge app. A practice drill should cost less than one judge round (~107 credits). Measure before pricing.

---

## 7. Risks and answers

| Risk | What could happen | How the design answers it |
|---|---|---|
| **Cheating perception** | Opponents or judges think the student gets AI help in the round. A tournament bans the app. | Hard lock on all coaching features in tournament mode. Visible badge with a code. Tamper-evident round log. Public "what is on, what is locked" page. Tournament profiles that match each tournament's rules. Reach out to NSDA and NCFL before launch. |
| **Real cheating** | A student uses a second device, a changed copy of the app, or a BYOK key with another tool. | Be honest: no local app can stop this. The log helps, but it is not proof. The answer is the same as for any laptop: tournament rules and judges. Tabula does not add any new channel for outside help (no chat, no remote view). AGPL code is open, so anyone can check what tournament mode does. |
| **Unequal access** | Rich programs get AI practice; others do not. | Everything needed in a tournament is free. Paid features are practice only. UDL / Title I discount at 50% (BUSINESS-PLAN.md §2b). Works on Chromebooks and offline. No-audio mode needs no paid service. |
| **Skill loss** | Students stop learning to flow. | Flow is manual by default. Transcription is an aid, off by default in tournaments. Flow drills compare the student's flow to the AI's, so the student practices flowing. Coaches can turn transcription off. |
| **Rule change mid-season** | NSDA adopts the Nov 2025 AI-ban proposal, or a league bans AI tools. | Tournament profiles let a coach turn AI tools off in one tap. Manual flow, locker, and doc sending need no AI and keep working. |
| **Recording minors without consent** | Legal and trust harm. | Transcription off by default in tournaments. Consent step and visible light. Audio deleted after transcription. Under-18 hosted use only through a Program with school consent. |
| **SpeechDrop breakage or harm** | Upload breaks when the site changes; load hurts a free community tool. | Talk to the maintainer first. Manual drop fallback. Upload only on click, with rate limits. |
| **Privacy leaks** | Student names or school data reach AI providers. | Anonymize step in every prompt. No content on the server. DPA. |

---

## 8. Recommended MVP

**The smallest useful debater feature set: a free, honest tournament tool.** Build nothing that needs a rule ruling or a SpeechDrop deal first.

1. **Student mode switch** in the existing app (same code base, a "Debater" role next to "Judge").
2. **Tournament mode** with:
   - Manual keyboard-first flow and timers (already in the judge app).
   - The badge, the lock on all AI coaching features, and the "what is on" sheet.
   - The round log (events only, hash chain, export).
   - No-audio mode on by default. Browser transcription opt-in, with the consent step.
3. **Evidence locker v1**: import Word/PDF files, text search, build a speech doc, mark the speech, Verbatim-style export.
4. **SpeechDrop v1**: open the room and list files (already works through `bridge.mjs`), plus "copy file / show in Finder" for a manual drop. **No upload yet.**
5. **One practice feature: the "What did I drop?" review after the round**, with Socratic questions only. BYOK only at first.

Not in the MVP: SpeechDrop upload, coach controls, hosted AI for students, speech feedback, drills, locker sync.

Why this order: the MVP is free, so it fits the business plan. It shows tournaments the strict line before any AI practice ships. It reuses the judge app's flow, docs, speech mapping, and anonymize step.

Done check for the MVP (when built): in tournament mode, no AI coaching call can be made (a test proves the locked list); the log chain verifies; a doc exports and opens in Word; flow and locker work with Wi-Fi off.

---

## 9. Open questions for the owner

1. **One app or two?** A "Debater" role in the same app, or a separate Student app? *Recommendation:* same app, a role switch. Less code, one PWA.
2. **Contact NSDA and NCFL before launch?** Ask them to review tournament mode and the badge. *Recommendation:* yes, before any public student launch.
3. **Contact the SpeechDrop maintainer now?** Ask about upload and a small endpoint. *Recommendation:* yes, now. Upload waits for the answer.
4. **Live transcription in tournament mode at all?** It is the most useful aid and the biggest rule risk (NCFL 2026 bans it). *Recommendation:* allow it only when the debater turns it on, with the consent step, and only where the tournament allows it. Default off.
5. **AI flow cleanup in tournament mode?** It is clerical, but it is an "AI tool", and some rules ban AI tools in the room. *Recommendation:* off by default; a coach or tournament profile may turn it on.
6. **Program pricing for students:** add student seats to the $149/$349 Programs, or a separate student Program? *Recommendation:* same Programs; students draw from the same pool. Measure first.
7. **Should a judge on Tabula see an opponent's tournament-mode badge code** (for example, through the SpeechDrop room)? It would raise trust, but it needs a server or shared room data. *Recommendation:* not in MVP.
8. **Age floor for the free Student Edition:** 13+ as in the judge app? *Recommendation:* yes, 13+, with no hosted AI under 18 except through a Program.
9. **Who checks rules each season?** The rules table (§4) will go stale. *Recommendation:* review it every August with the yearly provider-tier check.

---

## 10. Sources

All seen 2026-11-19 through web search. Items marked *(copy)* are tournament-posted copies, not the official site. Items marked *(title only)* were not read in full.

- NSDA High School Unified Manual 2024-25 *(copy)*: https://s3.amazonaws.com/tabroom-files/tourns/34243/postings/59702/HighSchoolUnifiedManual202425.pdf
- NSDA Unified Manual 2023-24 (official): https://www.speechanddebate.org/wp-content/uploads/High-School-Unified-Manual-2023-2024-1.pdf
- NSDA AI rules for 2026 Nationals, Unified Manual p. 141 *(copy)*: https://s3.amazonaws.com/tabroom-files/tourns/38456/postings/67841/AIinDebate.pdf
- NSDA 2025 November Competition Rules Minutes: https://www.speechanddebate.org/wp-content/uploads/2025-November-Competition-Rules-Minutes.pdf
- NSDA 2023 September Competition Rules Minutes: https://www.speechanddebate.org/wp-content/uploads/2023-September-Competition-Rules-Minutes.pdf
- NSDA F25 Board Minutes: https://www.speechanddebate.org/wp-content/uploads/F25-Board-Minutes.pdf
- NCFL By-laws 2022: https://www.ncfl.org/uploads/7/3/2/8/7328308/ncflbylaws_2022__1.pdf
- NCFL By-laws page: https://www.ncfl.org/bylaws.html
- NCFL 2026 Nationals, WiFi & Technology: https://www.ncflnationals.org/wifi.html
- CHSSA Rules and Regulations 2025-26: https://chssa.org/wp-content/uploads/2025/09/2025-26.RandR_.pdf
- CHSAA Speech & Debate Handbook 2024-25: https://s3.amazonaws.com/chsaanow.com/documents/2024/8/26/24_25_S_D_Handbook.pdf
- UHSAA Handbook 2026-27, Speech/Debate: https://www.uhsaa.org/Publications/Handbook/ActivitiesSections/SpeechDebate.pdf
- ASDA 2025-26 Handbook: https://www.americanspeech.org/wp-content/uploads/2025/12/2025-2026-Handbook-with-Addendum.pdf
- UIL Computers in Debate 2024-25 *(title only)*: https://uiltexas.org/files/academics/speech/24-25_Computers_in_Debate_FINAL.pdf
- UIL AI Statement 2025 *(title only)*: https://www.uiltexas.org/files/academics/speech/AI_Statement_Final_2025.pdf
- Idaho debate rules 2026 *(title only)*: https://idhsaa.org/asset/DEBATE/Debate%20Rules%202026.pdf
- News Tribune, "AI changes the game, challenges ethics in speech and debate", 2026-05-12: https://www.newstribune.com/news/2026/may/12/ai-changes-the-game-challenges-ethics-in-speech/
- TFA constitution page (rule text not found): https://texasforensicassociation.com/?p=592
- SpeechDrop source (MIT): https://github.com/yunyu/SpeechDrop (no-API and CSRF notes come from the task brief; not re-checked here)
- Tabula: BUSINESS-PLAN.md §2, §6b, §10, §12; `logic.js` anonymize/deanonymize.
