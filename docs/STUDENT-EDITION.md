# Tabula Student Edition: design doc (draft 1)

Date: 2026-11-19. Status: proposal. No app code is changed by this doc.

The judge app helps a judge flow and decide a round. The Student Edition helps a **debater** with the clerical work of debate: flowing, filing, and sending docs. It does **not** debate for them.

One line: **the AI is a clerk and a practice partner. It is never a second partner in the round.**

---

## 1. Principles

### 1a. What the AI may do

- **Flow.** It writes down what each speaker said, in the right column, next to the right argument.
- **Transcribe.** It turns speech into text.
- **Organize.** It sorts flows, tags, and files. It does not mark which arguments are answered or dropped (see 1e).
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

### 1e. Judging tools stay out of the student version (owner decision)

Anything that helps a judge decide is **never a live marker in the student version**: not during a round, in any mode. It belongs to the judge and coach versions.

**One exception: the post-mortem, after the round is closed** (owner decision). Once the round is over *and* closure is confirmed (the judge's feedback is submitted, or the student marks the round closed and confirms the decision is in), the student can open a post-mortem: a "What did I drop?" review and a look back at the round's key moments. It is a review for learning, never a hint while the round can still change. It stays locked until closure, and it never appears in tournament mode before closure.

- **Out during a round:** Live Eval, "who is winning", where the student stands, lists of drops or unanswered arguments, what could win or lose the round, ballot guesses, decision drafts, impact calculus.
- **Out at all times:** proactive evidence recommendations ("use this card here").
- **After closure (post-mortem only):** the drop review and a look back at key moments, as facts with pointers to the flow, plus Socratic questions. The judge's own feedback sits next to it.
- **Why:** these tools do the judging and the strategic reading of the round. That reading is the skill debate teaches.
- **Coaches may still use them** with a student, in the coach version, for a coach-run practice round or a review. A person leads that talk; the app does not hand the student the answers.
- **In instead: evidence playbooks** (see 3e). The student saves combinations of their own evidence that worked, names them, and pulls them up later. The student picks; the app only stores and finds.

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
- **Socratic questions about the student's own arguments.** The student picks one of their own arguments or cards; the app asks: "What is the warrant?", "What is the strongest answer to it?", "Why does it matter?". The student writes the answer. The app never writes the answer, and never points out drops or what the student missed in the round (see 1e).
- **Redo a speech.** The student re-gives a rebuttal. The app flows it next to the first version, so the student can compare. It does not judge which version is better.
- **Post-mortem after the round closes** (see 1e): a "What did I drop?" review and key moments, shown next to the judge's feedback, with Socratic questions. Locked until the round is closed and the decision is in. No Live Eval while a round is open. A coach can lead the same review in the coach version.

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

### 3e. Evidence playbooks (templates)

- A **playbook** is a saved set of the student's own evidence: a named group of cards and blocks in a chosen order, for example "Answers to States CP" or "1NC vs. healthcare affs".
- The student builds it by hand, or saves the cards from a speech doc that worked as a new playbook.
- Pull one up to start a speech doc fast. Edit it, rename it, keep versions.
- **The student picks every card.** The app stores, searches and copies; it never suggests which playbook or card to use.
- Coaches can share a team playbook in the coach version; the student copies it into their own locker.

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
| Idaho, Nebraska, Iowa | Recording, AI | From the judge app's earlier rules research: Idaho says judges may not record; Nebraska NSAA asks judges not to use AI for final decisions; an Iowa state rulebook needs all-party permission to record. | Earlier judge-app research (not re-checked); search result for Iowa |
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
| "What did I drop?" list | **Post-mortem only: after round closure is confirmed** | Judging tool (§1e). While the round is open it would be coaching. |
| Socratic questions on the student's own arguments | **Practice-only** | Coaching, but the student does the thinking. |
| Evidence playbooks (student-made) | **Allowed** | The student's own prepared evidence, like a tub of files. |
| Speech feedback (speed, clarity, time use) | **Practice-only** | Needs recording. Coaching. |
| Flow drills vs. AI flow | **Practice-only** | Training tool. |
| Live Eval, ballot guess, "who is winning", proactive evidence picks | **Not in the student version** (judge and coach versions only) | Judging tools (§1e). |
| AI-written blocks, analytics, rebuttals | **Not allowed** | Writes arguments. Against §1 and NSDA original-work rules. |
| AI-cut cards or AI summaries used as evidence | **Not allowed** | AI is not a citable source (NSDA, CHSSA). |
| Strategy suggestions ("go for X") | **Not allowed** | Picks strategy. |
| Chat, messages, or remote coach view during a round | **Not allowed** | Help from non-competitors (NSDA, NCFL). |

---

## 5. Coach and program controls, consent, privacy

### 5a. Coach controls (Program plan)

- A coach links students with a Program code (the same code system the judge app's Program plan will use).
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
- For students under 18 using recording features: **school or parent consent through a Program code** (the same rule the judge app uses for student judges).
- Hosted AI: students aged 13 and over may use it on their own account, with or without a school.
- Under 13: not allowed (COPPA). No marketing to middle-school students for now.
- All-party consent states (CA, FL, IL, MD, MA, MT, NV, NH, PA, WA and others): the app shows a stronger warning there. No-audio mode is always one tap away.
- Audio stays on the device only until it is transcribed, then the app deletes it (the same rule as the judge app).

### 5c. Privacy

- **Names stay out of AI prompts.** Use the judge app's anonymize step (`L.anonymize` / `L.deanonymize` in `logic.js`): debater names become 1A/2A/1N/2N, team names become "the Aff team"/"the Neg team", and names go back in on the device.
- Extend it to the locker: school names and author-of-file fields are stripped from text sent to AI.
- The server keeps only account, ledger, and usage counts. No audio, no transcripts, no flows, no locker files. No student names in usage rows, AI prompts or logs. Full field list: §10e and `docs/library/TRACKS.md` §5.5 and §6.4.
- FERPA and state student-privacy laws: have the SDPC National DPA ready before any school signs a Program.
- No training on student data. No ads. No sale of data.
- Voiceprints (telling speakers apart): not in the Student Edition. Biometric law risk (IL BIPA, TX CUBI, WA).

---

## 6. Fit with the business plan

The product rule is: **Free is the whole app; paid plans sell hosted AI with no key.** The Student Edition keeps that rule. Prices and plan details live in the private business plan, not in this public doc.

| Feature | Free | Free + own key | Pass (18+ only) | Program (coach code) |
|---|---|---|---|---|
| Tournament mode, badge, round log | ✓ | ✓ | ✓ | ✓ |
| Manual flow, timers, No-audio mode | ✓ | ✓ | ✓ | ✓ |
| Evidence locker (on device), text search, build doc, mark speech | ✓ | ✓ | ✓ | ✓ |
| SpeechDrop: open room, list files, copy/drop file | ✓ | ✓ | ✓ | ✓ |
| SpeechDrop upload (after maintainer talk) | ✓ | ✓ | ✓ | ✓ |
| Browser transcription (Chrome) | ✓ | ✓ | ✓ | ✓ |
| AI flow cleanup, AI locker search | – | ✓ | credits | pool |
| Practice: drills, feedback, Socratic questions, post-mortem after closure | – | ✓ | credits | pool |
| Evidence playbooks | ✓ | ✓ | ✓ | ✓ |
| Hosted transcription | – | own key | credits | pool |
| Encrypted locker sync between devices | – | – | yearly | ✓ |
| Coach controls, tournament profiles, shared logs | – | – | – | ✓ |
| Hosted AI for students 13 to 17 through the school | – | – | – | ✓ |

Notes:
- **Students under 18 cannot buy a Pass** (Stripe and ToS need 18+).
- **Students aged 13 to 17** may also use hosted AI on their own account, with or without a school (§9 item 8).
- **Free + own key** is open to students 13+, as in the judge app. Many students will not have a key. That is an equity issue; see §7.
- Costs: practice features use the same cheap models as the judge app. A practice drill should cost less than one judged round. Measure before pricing.

---

## 7. Risks and answers

| Risk | What could happen | How the design answers it |
|---|---|---|
| **Cheating perception** | Opponents or judges think the student gets AI help in the round. A tournament bans the app. | Hard lock on all coaching features in tournament mode. Visible badge with a code. Tamper-evident round log. Public "what is on, what is locked" page. Tournament profiles that match each tournament's rules. Reach out to NSDA and NCFL before launch. |
| **Real cheating** | A student uses a second device, a changed copy of the app, or a BYOK key with another tool. | Be honest: no local app can stop this. The log helps, but it is not proof. The answer is the same as for any laptop: tournament rules and judges. Tabula does not add any new channel for outside help (no chat, no remote view). AGPL code is open, so anyone can check what tournament mode does. |
| **Unequal access** | Rich programs get AI practice; others do not. | Everything needed in a tournament is free. Paid features are practice only. A discount for UDL and Title I programs. Works on Chromebooks and offline. No-audio mode needs no paid service. |
| **Skill loss** | Students stop learning to flow. | Flow is manual by default. Transcription is an aid, off by default in tournaments. Flow drills compare the student's flow to the AI's, so the student practices flowing. Coaches can turn transcription off. |
| **Rule change mid-season** | NSDA adopts the Nov 2025 AI-ban proposal, or a league bans AI tools. | Tournament profiles let a coach turn AI tools off in one tap. Manual flow, locker, and doc sending need no AI and keep working. |
| **Recording minors without consent** | Legal and trust harm. | Transcription off by default in tournaments. Consent step and visible light. Audio deleted after transcription. No accounts under 13. |
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
5. **Evidence playbooks v1**: save, name and reuse sets of the student's own cards; save a speech doc as a playbook. No AI.
6. **Post-mortem v1**: after the student confirms the round is closed and the decision is in, a "What did I drop?" list with pointers to the flow, next to the judge's feedback. BYOK only at first.
7. **Badge check for judges** (owner decision, §9 item 7). A judge on Tabula sees that a debater in the round is in tournament mode, with the same badge code and start time.
   - **DECIDED (owner): a tiny server.** The student's app posts only `{badge code, mode, start time, end time}`. No names, no school, no content, no account. The judge's app looks up the code the student shows. Entries are deleted 24 hours after the round.
   - It must handle peak Saturdays and must never block a round: if the server is down, the badge still shows on the student's screen, and the judge app says "cannot check right now".
   - Rejected: a signed receipt file in the SpeechDrop room. It needs no server, but it depends on SpeechDrop and a manual drop.
   - Honest limit: this shows the mode is on in this app on this device. It cannot prove the student uses no other device (§7).

Not in the MVP: SpeechDrop upload, accounts, coach controls, hosted AI for students, speech feedback, drills, locker sync.

Why this order: the MVP is free, so it fits the business plan. The only server part is the badge check, and it stores no personal data. It shows tournaments the strict line before any AI practice ships. It reuses the judge app's flow, docs, speech mapping, and anonymize step.

Done check for the MVP (when built): in tournament mode, no AI coaching call can be made (a test proves the locked list); the log chain verifies; a doc exports and opens in Word; flow and locker work with Wi-Fi off.

---

## 9. Decisions (owner)

1. **One app or two: DECIDED — same app, a role switch.** A "Debater" role next to "Judge". One PWA.
2. **NSDA and NCFL review: DECIDED — yes, before any public student launch.** Ask them to review tournament mode, the badge, and the badge check (item 7).
3. **SpeechDrop email: DECIDED — send it when upload work starts.** The draft is ready. Upload waits for the maintainer's answer. The manual drop works until then.
4. **Live transcription in tournament mode: DECIDED — opt-in, off by default.** Only when the debater turns it on, after the consent step, and only where the tournament allows it.
5. **AI flow cleanup in tournament mode: DECIDED — off by default.** A coach or tournament profile may turn it on.
6. **Pricing for students:** kept out of this public doc. Measure student use before any new plan.
7. **Judge sees the badge code: DECIDED — yes, in the MVP.** See MVP item 7 (§8). It is built as a tiny server that stores no personal data and deletes entries after 24 hours.
8. **Age floor: DECIDED — 13+.** Students aged 13 to 17 may use hosted AI on their own account, with or without a school. No accounts under 13.
9. **Rules check: DECIDED — the owner reviews §4 every August**, with the yearly provider-tier check.

---

## 10. Coach edition and connected roles

The Student Edition is a teaching tool. Teaching happens between people: a coach and a student, a judge and a student. This section says what to build and what **not** to digitize.

### 10a. Guiding rule

- **The tool serves the human relationships** (coach and student, judge and student). It never replaces them.
- **People make the judgments.** The app does not grade, rank, or decide. A coach or a judge does.
- **The app keeps as little data as it can.**
- **Students own their record.** They can see it, export it, and delete it.

### 10b. Right and fruitful (build these)

- **Judge feedback that stays with the student over time.** Ballots and RFDs (the judge's "reason for decision") go into the student's own record on the device. The student can read them again before the next tournament.
- **Coach practice rounds.** A coach runs a practice round in the judge app and gives the student the feedback file.
- **Evidence organization.** The locker from §3.
- **Case review that asks the student questions.** Socratic questions (§2b) on a case the student wrote. The app asks; the student answers.

### 10c. Harmful to digitize (do not build these)

- **AI that writes cases or blocks.** (Same as §1b.)
- **Coaching during a real round.** No live coach view, no messages, no hints. (Same as §4c.)
- **Rankings or tracking dashboards that watch kids.** No leaderboards, no "least active student" lists, no time-on-app counts, no activity feeds about a student.
- **Streaks and points that gamify practice.** No streaks, badges for logins, or point totals. Practice is for learning, not for a score. One exception (owner decision): a **completion badge** for finishing a Debate Library track is allowed. It means only "finished this track". Student badges are private; an adult judge may share theirs. Streaks, points, levels, login badges and leaderboards stay banned. See `docs/library/TRACKS.md`.
- **Anything that replaces the talk between coach and student.** The app does not write the coach's feedback, and it does not send automatic "you are behind" messages.
- **Keeping students' voices stored.** Audio is deleted after transcription (§5b). No audio goes to a coach or a server.

A quick test for a new coach feature: **"Would a good coach do this with a notebook and a conversation?"** If yes, the app may make it easier. If it only exists because software can count things, do not build it.

### 10d. The three roles

| Role | Has | Can see |
|---|---|---|
| **Student** | Their flows, locker, practice results, judge feedback | Only their own data |
| **Coach** | The judge app for practice rounds; a join code for Debate Library tracks (`docs/library/TRACKS.md` §6) | Practice rounds they run; what a student shares; "done or not done" for a track the coach assigned |
| **Judge** | The judge app (unchanged) | Their own rounds only |

A judge never sees a student's record.

### 10e. What needs accounts and a server

Everything in §1 to §9 can run on the device. Join codes and school spaces cannot. They need accounts and a server.

**Privacy rules for the server:**
- **Data minimization.** Store only what the feature needs. For Debate Library tracks, `docs/library/TRACKS.md` §5.5 (adult judge accounts) and §6.4 (students) list the fields (birth year, last sign-in, badges, consent records). **No audio. No full transcripts by default. No locker files.** No device or activity tracking.
- **Names.** The server needs a display name for coaches to know their students. AI prompts still never get names (§5c).
- **FERPA.** When a school uses a Program or a free school space (`docs/library/TRACKS.md` §6), student records are education records. Sign the SDPC National DPA. The school controls the school's data. Tabula acts as a "school official" under the DPA.
- **COPPA.** No accounts under 13. Students 13 to 17 join a school space only with school consent, or with parent consent.
- **State student-privacy laws** (SOPIPA, NY Ed Law 2-d, IL SOPPA, and others): no ads, no sale, no profiling, no training on student data. List every subprocessor.
- **Consent.** Recording still needs the consent step in §5b.
- **Retention and deletion.** Free school-space data is deleted 120 days after the season ends (a parent-consent library account is deleted 12 months after its last sign-in; a school-path student whose space ends has 30 days to add parent consent, or the account is deleted; see `docs/library/TRACKS.md` §6), with reminders 30 days before, 7 days before, and on the day (§10i). Anything the student exported stays theirs. A student can delete any item at any time. A school can delete its whole space. Backups expire on a fixed schedule.
- **Student export.** One click exports the student's whole record (feedback, flows they saved, badges) as plain files. The student keeps it after they graduate or change schools.
- **Encryption.** In transit always. At rest on the server.

### 10f. Open source and private parts

- The app stays **open source (AGPL)**. The Student, Coach, and Judge roles in the app are all in the public repo.
- The **server and billing may live in a private repo.** That is the owner's decided stance.
- The app must still work fully with no server. All connected features are add-ons.
- Publish the server's data rules (what it stores, how long, who can see it) in the public repo, so schools and families can check them.

### 10g. Fit with the Program plan

- Coach features live in the **Program** plan (the paid plan for schools and clubs). No prices or plan details are in this public doc.
- One exception (owner decision): a **free school space** for Debate Library tracks. It has only a join code, track assignments, "done or not done", completion badges, and the AI policy switches (amended, `docs/design/AI-POLICY.md` §8: turning AI off is free). See `docs/library/TRACKS.md` §6.
- **Free:** a student's own record on the device, and export.
- Keep a path for programs with no money (a discount or free seats for UDL and Title I programs), so connected roles do not become a rich-school feature.

### 10h. Coach MVP (smallest first)

Build in this order. Each step is useful alone.

1. **Coach practice round.** A coach runs a practice round in the judge app and saves the RFD and comments to a file the coach gives the student. No server. (Uses the existing judge app.)
2. **Student record on the device.** The student imports that file and any judge feedback file into a "My feedback" list. Export works. No server.
3. **Accounts and school join codes.** The first server step. Only membership: no content yet. One school-space entity serves both the paid Program and the free school space (a free-tier flag; `docs/library/TRACKS.md` §6). Narrow Debate Library track assignment comes after this step.

### 10i. Decisions (owner)

1. **Retention after the season: DECIDED — 120 days after the season ends** (about one debate season), then delete. The app sends reminders 30 days before, 7 days before, and on the day of deletion, each with an export link.
2. **Coach view of tournament round logs: DECIDED — only if the student shares them.** Never automatic.
3. **Parents: DECIDED — no parent dashboard.** Parents ask the student or the school for an export. Exception: for a free Debate Library account made with parent consent (`docs/library/TRACKS.md` §6.1), the consenting parent gets a light account for data rights only: see what is stored, export, delete, withdraw consent. It shows no progress and sends no alerts except the retention reminders, so it is not a parent dashboard.

---

## 11. Sources

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
- Tabula: the private business plan (tiers, privacy checklist); `logic.js` anonymize/deanonymize.
