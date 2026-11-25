# Copy trim audit

Status: **report only.** Written 2026-11-24. No app file changed. The owner picks which cuts to make. Three other sessions edit Speech Events screens now (branches `claude/events-design-*`), so line numbers in `events/` can move. Find each string by its text, not only by its line.

**What this audit looks for:** help lines that say what the screen already shows; parentheticals a label or layout can carry; repeated explanations; two strings for one idea; jargon. **What it keeps:** words that carry a rule a judge must not miss (over grace, top N, ranks lock on submit, what goes on the ballot, what leaves the device).

**How to read the tables:** each table is ranked by how much the cut helps a judge (or a coach) in the middle of the work. "Cut" means remove the string. "Pin" in the Why column means a test or a design rule holds the exact words today, so a change must update that test or rule in the same commit.

Base commit: `8e89d6b` (debate repo).

---

## 1. Speech Events (`events/`)

### 1.1 In the round: timer, roster, comment card

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| E1 | "Rule checks (tap to flag; a flag goes in your private note)" | `events/js/comment-view.js:30` | "Rule checks" | The chips look tappable. The flag already says where it goes in the live message (`comment-view.js:82`). **Done by the design merge** (zones "On the ballot" / "Just for you"). |
| E2 | "Private note (only for you; never on the ballot)" | `events/js/comment-view.js:34` | "Private note" + a small grey pill "Not on ballot" | Keeps the privacy rule. The pill is one glance, not a sentence. **Done by the design merge** (zones "On the ballot" / "Just for you"). |
| E3 | "Comments for A12 (go on the ballot)" | `events/js/comment-view.js:31` | "Ballot comments · A12" | The label says it. The parenthesis goes. **Done by the design merge** (zones "On the ballot" / "Just for you"). |
| E4 | "Reason for rank (whole room)" | `events/js/comment-view.js:36` | "Reason for rank", under a small "Whole room" divider that splits it from the speaker fields | The layout shows it is not per speaker. **Done, changed:** muted "whole room" with no brackets; no divider needed after the design merge. |
| E5 | "Question drawn (stays on this device)" | `events/js/comment-view.js:26` | "Question drawn" | "Stays on this device" shows 4 times in one round (also E6, E7, E20). Say it once, on setup (E20). **Done.** |
| E6 | "(the student's pick; stays on this device)" after the topic label | `events/js/runs-view.js:23` | Cut | Same as E5. The judge knows the student picked the topic. **Done.** |
| E7 | "(optional; stays on this device)" after "Piece" | `events/js/piece-view.js:19` | Cut | Same as E5. See rule W6 for "optional". **Done.** |
| E8 | "No show. Undo it in the roster menu to time this speaker." | `events/js/timer-view.js:48` | "No show" + an "Undo no show" button on the timer card | A button beats directions to another menu. **Done.** |
| E9 | Toast: "Every speaker has spoken or is a no show. Rank the room when you are ready." | `events/js/room-screen.js:155` | "Everyone is done. Rank the room." | Half the words. Same facts. **Done.** |
| E10 | Dialog: "A late entry goes at the end of the roster. You can move it after." | `events/js/room-screen.js:145` | Cut the body | The new row shows at the end. "Move up" is in its menu. **Done.** |
| E11 | Dialog: "The student is in another event now and speaks here later. They stay on the ballot." | `events/js/room-actions.js:40` | "Speaks here later. Stays on the ballot." | Same two facts. **Done.** |
| E12 | Placeholder: "For example: in Room 204 for IX" | `events/js/room-actions.js:40` | "Room 204, IX" | Placeholders are examples already. **Done.** |
| E13 | "Cross-ex (elim round)" | `events/js/cross-ex-view.js:35` | "Cross-ex" | The card shows only in elims. **Done.** |
| E14 | "School of A12 (optional)" | `events/js/cross-ex-view.js:40` | "School" | The field sits on A12's card. Rule W6. **Done.** |
| E15 | "The cross-ex length is not set in these rules. Follow the tab room." | `events/js/cross-ex-view.js:46` | "No set length. Ask the tab room." | Shorter. Same rule. **Done.** |
| E16 | "Panel note (optional, for you only)" | `events/js/round-frame.js:58` | "Panel note" + the same "Not on ballot" pill as E2 | One pattern for every private field. **Done.** |
| E17 | Placeholder: "For example: judges in seats 1 to 3" | `events/js/round-frame.js:58` | "Seats 1–3" | Same as E12. **Done.** |
| E18 | Keyboard sheet: "Type 9 (rooms over 8)", "Type 0 (rooms over 8)" | `events/js/keys.js:17-18` | "Type 9", "Type 0" | The sheet can hide rows that do not apply to this room. **Done, changed:** the key sheet cannot know the room size, so it says "Type 9 in rooms over 8". |

**Keep as is:** "Panel: agree on overtime before you flag." (`round-frame.js:14`, a rule). "Limit 10:00 for prep and speech · grace 0:30" (`timer-view.js:63`, a rule; pin: `events/prep.test.mjs`). "Prep ran out of time while the page was closed…" (`prep.js:110`, rare, and it tells the judge what to do).

### 1.2 Rank and rate

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| E19 | "Best first. Drag the handle, use the arrows, or press Alt+Up and Alt+Down on a row." + "Only the top N get a rank on the ballot. Put the rest in any order." | `events/js/rank-screen.js:210` | "Best first. Only the top N are ranked on the ballot." | The handles and arrows are on screen. The keys live in the keyboard sheet. Keep the top-N rule. **Done.** |
| E21 | "Tap the speakers from best to last. Tap a ranked speaker again to take the rank off." | `events/js/rank-screen.js:209` | "Tap best to last. Tap again to undo." | Same two facts. **Done.** |
| E22 | "The speakers you did not tap keep speaking order after the others." | `events/js/rank-screen.js:180` | "Speakers you did not tap follow in speaking order." | Shorter. **Done.** |
| E23 | "Reason for rank (whole room)" | `events/js/rank-screen.js:213` | "Reason for rank" | On the Rank screen it is clearly for the room. **Done.** |
| E24 | "Ready" + "Every speaker has a rank and a rating." | `events/js/rank-screen.js:70` | "Ready" | The checklist above already lists each item. **Kept:** no checklist shows when the board is ready, so this line is the only one that says what is complete. |
| E25 | "Ready" + "Every speaker is rated." | `events/js/rate-screen.js:45` | "Ready" | Same as E24. **Kept:** same reason as E24. |
| E26 | "These rules have no ranks. Rate each speaker on their own." | `events/js/rate-screen.js:81` | "No ranks. Rate each speaker." | Shorter. Same rule. **Done.** |
| E27 | "Notes for the whole room (optional)" | `events/js/rate-screen.js:84` | "Room notes" | Rule W6. Also fixes W3 ("Notes for the room" in `ballot.js:108`). **Done.** |
| E28 | "A12 went over grace, so it can't be ranked 1st. Clear the over-grace flag on the timer if the time was wrong." | `events/js/rank.js:53` | "A12 went over grace, so it can't be 1st. Time wrong? Clear the flag on the timer." | Keeps the rule and the fix. Pin: `events/rank.test.mjs` and `docs/events/DESIGN.md` §4.6. **Kept:** spec text (DESIGN.md §4.6), pinned by `rank.test.mjs`. |
| E29 | "Every speaker went over grace, so no one can be ranked 1st under these rules. Clear the flag on the timer for any time that was wrong." | `events/js/rank.js:268` | "Everyone went over grace, so no one can be 1st. Time wrong? Clear the flag on the timer." | Same pattern as E28. **Done.** |

**Keep as is:** "Judge the performance, not the person." (`rank-screen.js:206`, `rate-screen.js:80`). The design doc says this wording belongs to the tournament. "Your tab room applies the time penalty. Rank on performance." (`rank.js:26`, a rule; pin: `events/rank.test.mjs`).

### 1.3 Review and copy

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| E30 | "Enter these in the online ballot first. Most sites lock ranks when you submit, but keep comments open." | `events/js/review-screen.js:34` | "Enter ranks first. Ranks lock on submit. Comments stay open." | Keeps the lock rule, in three short facts. **Done.** |
| E31 | "These rules are comments only. There are no ranks to submit. Copy each comment below." | `events/js/review-screen.js:22` | "Comments only. No ranks to submit." | "Copy each comment below" says what the buttons show. **Done.** |
| E32 | Toast: "Ranks copied. Paste them into the online ballot." | `events/js/review-screen.js:135` | "Ranks copied." | The judge knows where to paste. E30 already says it. **Done.** |
| E33 | Toast: "Everything copied as one block." | `events/js/review-screen.js:155` | "All copied." | Matches the "Copy all" button (rule W1). **Done.** |
| E34 | Toast: "This browser blocked copying." (short form) | `events/js/review-screen.js:156` | Use the long form from `review-screen.js:132` | Two strings for one error. The long one says what to do. **Done.** |
| E35 | "AI rewrote your words. Check them before you copy." **and** live message "The clean version is ready. Check it, then choose Use this or Keep mine." | `events/js/cleanup-view.js:48`, `:94` | Keep line 48. Live message: "Clean version ready." | Line 94 repeats line 48 for screen readers. The buttons are named already. **Done.** |

**Keep as is:** the clean-up privacy note (`cleanup-view.js:33`). It says what leaves the device. A shorter form is possible, but the owner should sign off on it, not this audit.

### 1.4 My day, setup, picker

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| E36 | "Comments still open." + "Tabroom keeps comments open until the tournament ends. Finish them before you go." | `events/js/myday-screen.js:84` | "Comments still open. Finish them before you leave." | Keeps the nudge. Drops the vendor name (DESIGN.md rule 9). **Done.** |
| E37 | "No ballots yet today. When you get one, tap Start a round." | `events/js/myday-screen.js:90` | "No ballots yet today." | "Start a round" is the big button below. **Done.** |
| E38 | "No ballot yet. When the tab room sends you one, add it here." | `events/js/myday-screen.js:79` | "No ballot yet." | "I got a ballot" is the button below. **Done.** |
| E39 | "Paste the room from Tabroom or SpeechWire, or type one code per line" | `events/js/setup-screen.js:77` | "Paste the room, or type one code per line" | Vendor names (DESIGN.md rule 9). Matches the error in `room.js:151`. **Done.** |
| E20 | "The text stays on this device. Codes are enough; names are optional." | `events/js/setup-screen.js:79` | "Codes are enough. The text stays on this device." | The one place that says "stays on this device" for the round (see E5–E7). **Done.** |
| E40 | "This room keeps this limit and grace. The app has no rule checks or chips for this event." | `events/js/setup-screen.js:56` | "No rule checks for a custom event." | The limit and grace fields are right above. **Done.** |
| E41 | "Custom event (set the time)" | `events/js/setup-screen.js:69` | "Custom event" | The time fields appear when it is picked. **Done.** |
| E42 | "Event name (optional)", "Flight (optional)", "Tournament (optional)" | `events/js/setup-screen.js:52`, `:72`, `:73`; `events/js/picker-screen.js:61` | Drop "(optional)" | Rule W6. **Done.** |
| E43 | "Time limit (min:sec)", "Grace (seconds)" | `events/js/setup-screen.js:53-54` | "Time limit" with placeholder "7:00"; "Grace" with a "sec" unit after the box | The placeholder and the unit carry the format. **Done, changed:** Grace keeps a muted "sec", so a judge does not type 1 for one minute. |
| E44 | "No event matches. Try another word, or pick Custom event." **and** `No match. Try "history", "new" or an event like "HI".` | `events/js/picker-screen.js:24`; `events/index.html:46` | Picker: "No match. Pick Custom event?" Search: "No match." | Two styles for one empty state. **Done.** |
| E45 | "I submitted in Tabroom" | `events/js/myday-screen.js:56` | "Mark submitted" | Vendor name. The button is a status mark, not a link. **Done.** |

### 1.5 History and settings

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| E46 | "Coach and Student screens come in a later version. For now, the mode only shows the mode menu." (+ the whole Mode block) | `events/js/settings-screen.js:38-41` | Cut the Mode block until those screens ship | A setting that does nothing, with a help line that says so. **Done.** |
| E47 | "The copy and the file hold the rounds shown, with entry codes only. Names and comments go in only when you tick the box." | `events/js/history-screen.js:47` | "Codes only, unless you tick the box." | Keeps the privacy fact. The box label already says "Include names and comments". **Done.** |
| E48 | "No rounds match. Rounds you judge show here." | `events/js/history-screen.js:24` | Two states: "No rounds yet." (empty) and "No rounds match." (filtered) | One string tries to be two states. **Done.** |
| E49 | Toast: "… Paste them into a spreadsheet." | `events/js/history-screen.js:81` | Cut the second sentence | The button says "Copy as TSV". **Done.** |
| E50 | "My day counts down to this time, so you send your ranks to Tabroom on time." | `events/js/settings-screen.js:48` | "My day counts down to this time." | The reason is obvious. Vendor name. **Done.** |
| E51 | "Extemp speakers prep outside after the draw. Between speakers the room shows "Waiting for next speaker" for about this long. Pick what your tournament uses." | `events/js/settings-screen.js:52` | "How long the room shows "Waiting for next speaker" between Extemp speakers." | One sentence says what the number does. **Done.** |
| E52 | "Your rounds stay on this device. A backup is one file you can keep or move to another device." | `events/js/settings-screen.js:61` | "Your rounds stay on this device. A backup lets you keep or move them." | Shorter. **Done.** |
| E53 | "Connected: X. Clean-up on the Review screen uses this key." / "Clean-up on the Review screen can use your own API key. The key stays in this browser." | `events/js/settings-screen.js:29-30` | "Connected: X." / "Use your own AI key for Clean-up. The key stays in this browser." | Drops "on the Review screen". Keeps the privacy fact. **Done.** |
| E54 | "Two students (a pair)" | `events/js/guide.js:51` | "Two students" | The parenthesis says it twice. **Done.** |

### 1.6 Congress (`events/congress/`)

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| E55 | "A and B have the same points. That is fine if you meant it." | `events/congress/views.js:166` | "A and B have the same points." | The note is a warning, not an error. The second sentence is padding. **Done.** |
| E56 | "Tap a legislator to fill the next slot. Tap a slot to clear it." | `events/congress/views.js:169` | "Tap a name to fill the next slot. Tap a slot to clear it." | Plain word for "legislator". **Done.** |
| E57 | "No docket items. Add the bill and resolution titles, one for each line." | `events/congress/chamber.js:25` | "Add bill and resolution titles, one per line." | The empty box shows there are none. **Done.** |
| E58 | "No chambers yet. A Congress chamber you score shows here." | `events/congress/chamber-screen.js:25` | "No chambers yet." | Same pattern as E37. **Done.** |

---

## 2. Debate (repo root: `index.html`, `js/*.js`, `tour.js`)

### 2.1 In the round: flow, transcript, ballot

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| D1 | "Flowing needs a bigger screen. Use a tablet in landscape or a laptop to flow. Your clock and ballot work here." | `index.html:1013` | "Flow on a tablet or laptop. Clock and ballot work here." | Three sentences, one idea. Pin: `slice5-static.test.mjs:85`. **Done.** |
| D2 | Placeholder: "Words from the speech show here while the clock runs. You can type or fix them." | `index.html:1332` | "Speech text shows here. You can edit it." | Long placeholder in the live drawer. Pin: `slice3-static.test.mjs:49`. **Done.** |
| D3 | Flow "?" tip: "Aff columns are blue and Neg columns are red; each column header names its speech. Keep each argument …" | `index.html:1050` | "Aff blue, Neg red. Keep each argument on one line across columns. "Now" is the timed speech. Shaded marks: *, dropped, conc, ext, turn, L/T, O/W." | The headers name the speeches. Keeps the mark key. **Done.** |
| D4 | "No arguments yet. Click "+ Argument" to start, or Draw to let the AI map the round." | `js/insights.js:286` | "No arguments yet. Click + Argument, or Update." | **Also a bug:** no button is named "Draw". A map is saved here, so the button reads "Update" (`runVerb`). **Done** on this branch. |
| D5 | "No map yet. Click "+ Argument" to draw one by hand, or Run to let the AI map the round." | `js/insights.js:278` | "No map yet. Click + Argument, or Run." | Two long strings for one empty state. **Done.** |
| D6 | Toast: "Still working on the last one. Try again when it finishes." | `js/insights.js:185` | "Still working. Try again soon." | A toast should be short. **Done.** |
| D7 | "Live AI flow is off. When on, it uses AI while a speech runs." + link | `js/flow.js:173` | "Live AI flow is off (uses AI)." + link | Keeps the cost fact. Matches the "(uses AI)" tags. **Done.** |
| D8 | "Anything you type is yours. The AI will not change it." | `index.html:1254` | "The AI never changes what you type." | One sentence for the lock rule. See W13. **Done.** |
| D9 | "Reason for decision (RFD), goes to everyone" | `index.html:1265` | "RFD · everyone sees it" | Keeps the privacy fact. No parenthesis (W10). The copy blocks in `logic/` are separate strings. **Done.** |
| D10 | "Tell the AI (optional)" | `index.html:1279` | "Tell the AI" | Rule W6. **Done.** |
| D11 | "Check AI text before you use it. Nothing changes on the ballot until you insert it." | `js/decide.js:223` | "Nothing goes on the ballot until you insert it." | The heading "Review the draft" already says check. Keeps the lock fact. **Done.** |
| D12 | "Connect AI to draft the ballot. The ballot works by hand either way." + "Connect AI" link | `js/decide.js:89` | "Drafting needs AI." + "Connect AI" link | The link says "Connect AI" again. The by-hand ballot is on screen. **Done.** |
| D13 | "Printing is not available in this browser. Use Copy for the tournament ballot instead." | `js/decide.js:578`, `:609` | "This browser cannot print. Use Copy instead." | Copy is on the same bar. **Done.** |
| D14 | "Paste each block into the matching box on your tournament's ballot site." | `index.html:1456` | "Paste each block into the matching box." | The title just above says "Copy for the tournament ballot". **Done.** |
| D15 | "(always included)" next to a checked, locked Ballot box | `index.html:1433` | Cut (and drop its `aria-describedby`) | The locked tick shows it. **Done.** |

**Keep as is:** the "(uses AI)" tags (`index.html:1068`, `:1200`, `:1284`; cost facts; pin: `ai-words.test.js:26-30`). The recording notice (`js/recording.js:86-91`). The remember-key warning (`index.html:1137`). The clock warnings (`js/clock.js:46`, `:256`, `:290`). The "Edited" chip tip (`js/flow.js:216`, `:314`). "New round (clear all)" (`index.html:989`). The headphones rule (`js/settings.js:194`).

### 2.2 Live insights and map

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| D16 | "A read of the round so far, from the transcripts, flows and docs. It is advice for you, not a decision." | `index.html:1072` | "Advice from the transcripts, flows and docs. Not a decision." | Keeps "not a decision" (AI policy). **Done.** |
| D17 | "Weigh the round as a judge with this paradigm would. Each paradigm keeps its own saved answer, so switching is free. …" | `index.html:1094` | "Each paradigm keeps its own answer, so switching is free. "(yours)" is your Settings paradigm." | The "Weigh as" label says the first sentence. **Also a bug:** it says "click Update", but the button says "Run" on a first run. **Done.** |
| D18 | "My own paradigm (paste the full text)" | `index.html:1096` | "My own paradigm" | The placeholder says "Paste your judging paradigm here." **Done.** |
| D19 | "Each row follows one argument across the speeches." | `index.html:1119` | Cut this sentence. Keep the symbol key and "Dropped". | The grid shows it. **Done.** |

### 2.3 Round setup and start screen

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| D20 | "Set up the teams first, or open a round you saved. You can also just start flowing and fill in the names later." | `index.html:1035` | Cut | The three buttons below say each choice. **Done.** |
| D21 | "Or drop files anywhere on the page." | `index.html:1025` | "Or drop files." | Shorter. **Done.** |
| D22 | "After the coin flip, pick the side that gives the first speech. The speech order and flow columns follow it." | `index.html:906` | "Pick after the coin flip." | The label "Speaks first" carries the rest. **Done.** |
| D23 | "A round keeps its format. Picking another one starts a new round." | `index.html:901` | "Changing it starts a new round." | Keeps the warning in half the words. **Done.** |
| D24 | "On the tournament site, select your round on your judge page or in the pairings, copy it, and paste it here. …" | `index.html:927` | "Copy your round from your judge page or the pairings, and paste it here. Tabula reads it in this browser. It does not connect to the tournament site." | Keeps the no-connect promise. **Done.** |
| D25 | "Plain uses short sentences and everyday words, for students and parents. The decision stays the same. This choice is for this round; …" | `index.html:955` | "Plain: short sentences, everyday words. The decision stays the same. Set the default in Settings." | The same words appear 3 times (D26, `tour.js:54`). **Done.** |
| D26 | "Plain uses short sentences … Change it for one round in Round setup." | `index.html:1186` | "Plain: short sentences, everyday words. The decision stays the same. Change it per round in Round." | Repeat of D25. Fixes the place name (W14). **Done.** |
| D27 | "Add speech docs or case files (PDF, Word .docx, or text). Pick the speech each doc belongs to. The AI reads them …" | `index.html:959` | "Add speech docs (PDF, .docx or text) and pick each doc's speech. The AI maps each doc onto that speech's column and fills transcript gaps from it (marked [doc]). Docs stay in this browser until a new round." | Longest help on the setup screen. Keeps the [doc] rule and the privacy fact. **Done.** |
| D28 | " Tabula remembers your choice for new rounds." (added after the times note) | `js/formatsetup.js:76` | Cut | Expected behavior. Keep the NSDA times note. **Done.** |
| D29 | "Most leagues use 25–30. Change it if your tournament uses another range." | `index.html:983` | "Most leagues use 25–30." | The fields are editable. That says the rest. **Done.** |
| D30 | "Everything saves in this browser as you type. A .tab file holds this whole round, with its docs, to keep or move." | `index.html:991` | "Saves in this browser as you type. A .tab file holds this round and its docs." | Filler words. **Done.** |

### 2.4 Settings, account, tour

| # | Now | Where | Proposed | Why |
|---|---|---|---|---|
| D31 | "Everything you do is saved in this browser only. A backup file holds all of it: the round, flows, transcripts, …" | `index.html:1310` | "Everything is saved in this browser only. Download a backup before you clear the browser or switch computers." | The list of eight items adds nothing. **Done.** |
| D32 | "Replaces what is in this browser now. Your current data is downloaded first, just in case." | `index.html:1319` | Cut | The restore dialog says the same just before the action (`js/decide.js:348`). **Done.** |
| D33 | "Used when a key you connected does the transcription. Free browser transcription always uses Chrome's default mic …" | `index.html:1163` | "Only for a connected key. Free browser transcription uses Chrome's default mic and settings, with no level meter." | One very long sentence. **Done, changed:** "the browser's default mic", with no vendor name. |
| D34 | "Paste a key from any provider below. The app works out which one it is and checks that it works." | `index.html:1131` | "Paste a key from any provider. Tabula finds which one and checks it." | Shorter. "Tabula", not "The app". **Done.** |
| D35 | Placeholder: "Paste an API key here (starts with AIza…, sk-…, sk-ant-…, xai-… or sk-or-…)" | `index.html:1133` | "Paste an API key" | The list is cut off in the box. The error (`js/settings.js:73`) lists the prefixes. **Done.** |
| D36 | "AI tools (flow, Live Eval, analysis, decision) use" | `index.html:1141` | "AI uses" | The model picks below repeat the list. **Done.** |
| D37 | "Before AI runs in a round, Tabula asks you. Nothing is used until you say yes." | `index.html:1208` | "Tabula asks first. No round is used until you say yes." | Keeps the consent fact. **Done.** |
| D38 | Dialog: "Your Tabula account has no paradigm yet. This device has one. Copy it to your account, so every device you sign in on uses it. …" | `js/account.js:79` | "Your account has no paradigm yet. Copy this device's paradigm to it, so every device uses it?" | Four sentences in a dialog. The title asks already. **Done.** |
| D39 | "Your paradigm is saved in your Tabula account, so every device you sign in on uses it. …" | `js/account.js:105` | "Saved in your account for every device. Used for "My own paradigm"." | Shorter. **Done.** |
| D40 | Tour steps (`tour.js:14`, `:16`, `:20`, `:21`), each near the 45-word cap | `tour.js:14-21` | 14: "Type the round, teams and debaters. They fill the ballot." 16: "Start and pause the speech clock: ⌘↵ (Ctrl+↵), or Space. Prep clocks are on the right." 20: "Type the ballot, or let the AI draft it. You check each AI field first, and what you type stays yours. Then print or copy it." 21: "Click ? to replay this tour or tour this page. Connect AI with the gear. The clock, flow and ballot work without it." | `tour.test.js:16` checks only a word cap. Keep "Open the transcript from the round bar" (pin: `tour.test.js:72`). **Done.** |

**Word fights in Debate** (feed rules W13–W18 below):

- **Run / Update / Draw** for one button: `index.html:1116` ("Run"), `js/insights.js:286` ("Draw"), `index.html:1094`, `tour.js:30`, `js/insights.js:206` ("Update").
- **Clock vs timers:** "clock, flow and ballot" (`index.html:1211`, `:1215`, `js/help.js:162`) vs "timers, flow and ballot" (`tour.js:21`, `logic/shell.js:45`).
- **Round vs Round setup:** nav "Round" (`js/core.js:150`) vs "in Round setup" (`index.html:1186`, `js/ai.js:23`).
- **Transcribe vs Record:** checkbox "Transcribe" (`index.html:1365`) vs tour "Record the speech" (`tour.js:17`) vs "You chose Record on this device" (`js/recording.js:143`).
- **History vs Saved ballots:** nav "History" (`js/core.js:150`) vs heading "Saved ballots" (`index.html:1300`).
- **One lock rule, five wordings:** "The AI will not change it" (`index.html:1254`, `tour.js:38`, `js/core.js:278`), "will not change this" (`js/decide.js:405`), "AI updates will not overwrite it" (`js/flow.js:216`), "your edits stick" (`tour.js:18`), "stays yours" (`tour.js:20`).
- **Close / Done / Hide:** `index.html:1274`, `:1336`, `:1459`, `:1331`.
- **Print labels:** "Print / PDF" (`index.html:1291`) vs "Print or save as PDF" (`index.html:1429`; pin: `keys.test.js:299`).
- **Docs:** "Round documents" (`index.html:958`) vs "Speech docs" (`index.html:1021`) vs "case files" (`index.html:959`).
- **Turning AI on:** "Connect AI" (`index.html:1057`, `js/decide.js:89`) vs "Turn on AI" / "Turn AI back on" (`index.html:1373`, `js/limits.js:13`).
- **RFD:** "Reason for decision (RFD)" (`index.html:1265`) vs "the RFD" (`tour.js:38`) vs "Reason for decision" in copy blocks (pins: `formats-pf.test.js:125`, `logic-slice4.test.js:219`).
- **Key vs API key:** `index.html:1131` vs `:1133` vs `:1313`.

---

## 3. Other apps

Not covered in this public file.

---

## 4. Word rules for all apps

One word for one idea. When two words fight, the left one wins.

| Rule | Use | Not | Seen in |
|---|---|---|---|
| W1 | **Copy** (button) → **Copied** (button state, with a check) | "Everything copied as one block", "Ranks copied. Paste them…" | Events `review-screen.js:135`, `:155`; DESIGN.md §4.7 |
| W2 | **tab room** for the people; **online ballot** for the site | "Tabroom", "SpeechWire" on screen (DESIGN.md rule 9) | Events `myday-screen.js:56`, `:84`; `setup-screen.js:77`; `settings-screen.js:48` |
| W3 | **Room notes** for the shared, whole-room text | "Notes for the whole room", "Notes for the room" | Events `rate-screen.js:84`; `ballot.js:108` |
| W4 | **Rank** for order; **points** for a number score; **rating** only for a word scale | "place"; "rating" for a number | Events `rank-screen.js:43` ("rating", also shown on number scales) vs `guide.js:72` ("points") |
| W5 | **Speaker** in the room; **entry** only for the code; **student** only outside the round | "legislator", "the student" in round dialogs | Events `room-actions.js:40`; `congress/views.js:169` |
| W6 | Mark nothing **optional**. A field with no star or no error is optional | "(optional)" | 8 times in Events (§1.4 E42, E7, E14, E16, E27) |
| W7 | **Not on ballot** pill for every private field | "(only for you; never on the ballot)", "(optional, for you only)" | Events `comment-view.js:34`; `round-frame.js:58` |
| W8 | Say **stays on this device** once per flow, at its start | the same line on each field | Events E5–E7, E20 |
| W9 | One string per error. The same error gets the same words in every app | "This browser blocked copying." vs the long form | Events `review-screen.js:132` vs `:156`; `congress/session-screen.js:89` |
| W10 | No parenthesis in a label. Use a unit, a placeholder, or a divider | "(min:sec)", "(seconds)", "(whole room)", "(elim round)" | Events §1.4, §1.1 |

| W13 | One lock line in every app: **"The AI never changes what you type."** | "will not change it", "your edits stick", "stays yours" | Debate `index.html:1254`, `tour.js:18`, `tour.js:20`, `js/flow.js:216` |
| W14 | Call a place by its nav name, exactly | "Round setup" when the nav says "Round" | Debate `index.html:1186`, `js/ai.js:23` |
| W16 | **Run** for an AI action, always. Do not rename it after the first run | "Update", "Draw" | Debate `index.html:1094`, `js/insights.js:286`, `tour.js:30` |
| W17 | **Clock**, not timer | "timers" | Debate `tour.js:21`, `logic/shell.js:45` |
| W18 | **Right**, not permission; **AI rules**, not "AI settings"; **Connect AI** for first setup only ("Turn AI back on" is fine after a pause) | mixed | Debate `index.html:1373` |
| W20 | A toast that confirms an action names the result, not the person or the next step: "Copied.", "Sent again.", "Cancelled." | "Ranks copied. Paste them…", "Invite for NAME cancelled." | Events E32 |

## 5. Bugs found on the way

These are not copy taste. They point at a button that does not exist.

1. Debate `js/insights.js:286` says "Draw". The button is "Run" (`index.html:1116`).
2. Debate `index.html:1094`, `tour.js:30` and `js/insights.js:206` say "click Update". On a first run the button says "Run" (`index.html:1091`). **Fixed** in `index.html` and `tour.js`. `js/insights.js:206` was not a bug: that line shows only when a saved result exists, and then the button says "Update".

## 6. Top 10 cuts across all apps

Ranked by help to a judge mid-round.

1. **E1–E3** Comment card labels: drop the three parentheticals; use "Rule checks", "Ballot comments · A12", "Private note" + "Not on ballot" pill.
2. **E19** Rank screen help: "Best first. Only the top N are ranked on the ballot."
3. **E30** Review: "Enter ranks first. Ranks lock on submit. Comments stay open."
4. **E8** Timer no-show line becomes a pill and an "Undo no show" button.
5. **E5–E7, E20** Say "stays on this device" once per round, at setup.
6. **D1** Debate phone note: "Flow on a tablet or laptop. Clock and ballot work here."
7. **D4/D5** Debate map empty states: one line, and fix the "Draw" button name.
8. **E9** End-of-roster toast: "Everyone is done. Rank the room."
9. **E36–E38** My day empty states: one line each.
10. **E46** Cut the Speech Events Mode setting until Coach and Student screens ship.
