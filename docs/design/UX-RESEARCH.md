# Tabula UI/UX research: findings, patterns and decisions

This document has seven parts. It uses short sentences. It explains a technical word the first time it appears.

**Sources**
- Five Mobbin research passes. Mobbin is a library of real app screens. Three passes gave results: live sessions, onboarding, and calm visual systems. Two passes (flow grid, forms) did not run.
- Four read-only code audits: Flow, the other screens, the shell, and the design system.

**Evidence labels.** Each claim that uses a number has one of these labels:
- **[Checked]**: re-checked in the code for this revision. The command or line is given.
- **[Calc]**: calculated. The inputs are given.
- **[Unverified]**: from one audit only, or a guess. Check it before you build.

**Line numbers.** Line numbers come from the audits. Two audits sometimes give different line numbers for the same rule. One example: the audits put the flow grid at index.html:121, but it is at index.html:101 today [Checked]. Step 1 of Section 7 checks every line number again before the spec.

**Evidence gap (important).** The flow-grid and forms Mobbin passes did not run. So the screen that matters most, the flow grid, has no outside patterns in this document. Sections 2 and 3.1 are **partial** for these topics:
- how arguments link across columns (arrows, extensions),
- how to mark a drop or a concession,
- moving between sheets,
- shorthand and abbreviation entry,
- cell editing compared with one textarea per column.

The grid pass must run again before the Flow spec is final.

---

## 1. Summary: the 10 biggest opportunities

| Rank | Opportunity | Screen |
|---|---|---|
| 1 | The running clock must survive a page refresh, a crash or a sleeping device. Today it is in memory only and is lost. | Flow |
| 2 | When a judge clicks a speech tile to look back, the clock must not pause and recording must not stop. | Flow |
| 3 | All 7 flow columns must fit at 1366 px wide and on iPad. Use one shared vertical scroll so that the lines stay level across columns. | Flow |
| 4 | Toasts must show above the transcript drawer and the round bar. Important messages must stay long enough to read. | All screens |
| 5 | Decide with the owner how Space works. Today Space starts the clock on every screen, on purpose. This blocks Space on focused buttons and checkboxes (a WCAG problem). Add start/pause, speech and transcript shortcuts that work while the judge types, and a shortcut sheet under "?". | All screens |
| 6 | Make the start screen truly empty: New round and Open round only. Remove the forced welcome modal. | Flow, first run |
| 7 | Show the Ballot form above the fold. Merge or reorder the three AI features that all write to the ballot. | Decide |
| 8 | Fix the old place names ("AI + Keys", "Setup tab", "Log") and the error copy that blames the AI key when the device is offline. | All screens |
| 9 | Replace the 17 native browser dialogs (17 `confirm()` and `prompt()` calls, listed in 3.5 #2) with one calm in-app dialog and with undo toasts. | All screens |
| 10 | Tighten the design tokens. Input borders must be easy to see. Use one tooltip style. Use one shared token file. | Design system |

---

## 2. Patterns worth borrowing (from Mobbin)

Each pattern names the example apps and the Tabula screen it applies to.

**Note on sources.** The quoted app text below (for example VEED, Waking Up, Fireflies) comes from the Mobbin passes. The passes did not save screen links. So the reader cannot check the quotes yet. Each quote is **[Unverified]** until a Mobbin link is added.

**Note on touch.** Most patterns here help keyboard users. Section 3.6 covers judges on a phone or an iPad with no keyboard.

### 2.1 The round bar and the clock

**One bottom bar in three groups: tools, live state, prep.**
- Examples: Descript, Pitch, Dialpad, Riverside.
- Tabula: Flow, round bar. Put the speech chip and the Transcript button on the left. Put the speech clock in the center. Put Aff prep and Neg prep on the right. Use one strong color for one action only.

**"Elapsed / limit" in one string, with the end time on hover.**
- Examples: VEED (`00:09 / 60:00`), Waking Up ("Timer finishes at 4:12 PM").
- Tabula: round bar clock. Show `3:12 / 8:00` with tabular digits. "Tabular digits" means every digit has the same width, so the numbers do not move. On a 0.5 s hover, show "Ends at 10:42". In the last 30 s, change the color calmly. Do not flash.

**The clock is the control.**
- Example: Descript, where the time pill is also the Stop button.
- Tabula: a click on the clock starts or pauses it. The clock shows its state in words: "Running", "Paused", "Prep: Aff". This is also the main control for touch users.

**Position as text and a segmented track.**
- Examples: Pitch ("2 / 29"), Manus ("4 (Next page)"), timespent (one segment per step).
- Tabula: round bar and the 4x3 speech grid. Show "Speech 5 of 12 · next: 2NC (8:00)". Add a thin track with one segment per speech.

### 2.2 Live state and transcript

**A two-part toggle that opens the transcript drawer, plus "catch up".**
- Examples: Fireflies (Notes | Transcript, "Catch up (last 1 min)"), Loom (highlighted current line, one-click collapse), Slack (Captions tab).
- Tabula: Flow, Transcript drawer. The drawer scrolls by itself and highlights the current line. Add a "Last 30 seconds" jump for a judge who missed a line.

**A small live strip and an honest freshness note.**
- Examples: Grain ("● Recording" strip, "last updated 10 secs ago"), Dialpad ("Transcribing" chip).
- Tabula: top bar and drawer footer. Show "● 1NC" in the top bar. In the drawer footer, show "Transcript updated 8 s ago" or "Offline: saving here".

**A corner chip that follows the user.**
- Examples: Notion ("You're transcribing… 0:13"), FotMob live pill.
- Tabula: Round, Decide, Library. When a speech runs and the judge leaves Flow, show a small chip such as `1AR · 2:41`. A click on the chip returns to Flow.

**Do not use red for "live".** In Tabula, red means Neg. Use a neutral dot or a slow, calm pulse.

**Recording indicator.** The app can record minors in a classroom. The live strip must always show while the mic records. See 3.1 #34 and Q19.

### 2.3 Calm shell and layout

**One raised "paper" card on a quiet page.**
- Examples: Linear, Luma, incident.io.
- Tabula: Flow. The top bar, the speeches pane and the Insights pane sit on the page color with no borders. Only the flow grid is a raised card with a thin 1 px line.

**Side panes that hide with one key or one icon.**
- Examples: Linear, incident.io (right-pane toggle), Subframe ("Show/hide all panels").
- Tabula: Flow. `[` hides the left pane. `]` hides Insights. `\` hides both (focus mode). Each also has an icon button for touch. The app remembers the state.

**Grouped bands with counts and no row lines.**
- Example: Linear issue list.
- Tabula: Library (group by tournament or date), Decide > Analysis (group by sheet).

**Muted data colors.**
- Examples: Mintlify, Stripe, Luma (dark mode).
- Tabula: Decide > Live Eval and Analysis. Only Aff blue and Neg red are strong colors. All other colors come from the grey scale.

### 2.4 Keyboard and help

**Command palette.** A command palette is a search box that runs any command (opened with Cmd+K).
- Examples: incident.io, Searchable, Luma.
- Tabula: all screens. Items such as "Go to sheet: DA", "Start Aff prep", "Open Ballot". Each item has one plain line that says what it does. List it in the "?" menu.

**Searchable shortcut sheet, grouped by context.**
- Examples: Mercury (its grid shortcuts are close to a flow grid), Subframe, Circle, Shopify.
- Tabula: "?" menu and the `?` key. Groups: Flow grid, Clock and speeches, Sheets, Decide.

**Help menu: start cards on top, links with key hints below.**
- Example: Graphite.
- Tabula: "?" menu. Cards: "Take the 2-minute tour", "First-time judge guide", "Debate library". Links: Keyboard shortcuts, About, Send feedback.

**Small corner tour card that ends at "?".**
- Examples: Google AI Studio, FLORA ("Help & Resources", "7 of 7").
- Tabula: tour.js. A small card with a neutral border, at most 2 lines, "3 of 6", Back, Next and Skip. No yellow. The last step points at "?".

### 2.5 Start screen and settings

**Empty start screen: two buttons, a drop area, one hint.**
- Examples: Jitter, Sketch, Spellbook, AirOps, Zoho.
- Tabula: Flow start screen and empty Library. "New round" and "Open round". Below them, a dashed area: "or drop a saved round file here". One hint: "Press N for a new round" (hide the hint on touch devices). Recent rounds go below for returning judges.

**Settings as a calm document.**
- Example: Linear settings.
- Tabula: gear Settings. Each section has a heading and one plain line. Rows show the label on the left and the control on the right. Changes save by themselves, and a neutral "Saved" toast confirms.

**AI provider list with plain-text status.**
- Examples: Braintrust, Vercel (A–Z, same logo size), Retool.
- Tabula: Settings > AI keys. One row per provider, sorted A–Z. Status in words: "Not set", "Ready", "Key rejected". No "recommended" badge. This supports the owner's "no model favoritism" rule.

**Key paste box with help and a test button.**
- Examples: Bolt.new ("Where can I find my API key?"), Braintrust ("Test key"), Cursor (masked key `crsr_…03d7`).
- Tabula: AI key editor. Show the expected key start in the placeholder. Add "Where do I get this key?". Add "Test key", and show the result under the field, not in a toast. After save, show only a masked key such as `sk-…3fa9`.

### 2.6 Decide

**Paired bars in two team colors, and a log with times.**
- Examples: Apple Sports (stat bars), NBA and theScore (play-by-play), Otter (talk time per speaker).
- Tabula: Decide > Live Eval and Analysis. Show prep used per side as paired bars. Show key moments as "2:14 · 1NC · dropped T". Each item links to its flow cell and its transcript line.

**Things to avoid:** bright gradient AI panels, "Ask AI" pills that compete with the work, upgrade banners, and solid red record buttons.

---

## 3. Screen-by-screen findings

P0 = breaks a round or loses work. P1 = high friction or a missing state. P2 = polish. "To check" = a possible problem with no proof yet.

### 3.1 Flow

**P0**
1. **A refresh, crash or sleep during a speech loses the running clock.** [Checked] `startSpeech()` keeps `running = { endAt }` in memory only (app.js:219). `R.timeLeft` is saved only in `pauseSpeech()` (app.js:226). After a reload, the clock goes back to the last pause. Tab reloads and spotty Wi-Fi make this likely in a classroom. Fix: save `endAt` (a wall-clock time) when the clock starts, and restore it on load. Related states to cover:
   - storage full or blocked (private mode, school policy),
   - a second Tabula tab open on the same round,
   - the device sleeps during a speech (the timer must use wall-clock time, not count ticks).
2. **A click on a speech tile pauses the clock and stops recording.** [Checked] `selectSpeech()` calls `pauseSpeech()`, which calls `stopRec()` (app.js:211-213, 224-230). Nothing warns the judge.
3. **The 7 columns do not fit at 1366 px.** [Calc] The grid is `repeat(7, minmax(136px, 1fr))` (index.html:101), so 7 × 136 = 952 px minimum. The workspace is `290px | 1fr | 270px` with 12 px gaps (index.html:185). At 1366 px: 1366 − 290 − 270 − 24 = 782 px before page padding, so about 750 px. The 1AR, 2NR and 2AR columns go off-screen. [Unverified] A measured screenshot at 1366×768 is still needed.
4. **Lines stop being level.** Each column is its own textarea with its own scroll (index.html:127, app.js:787) [Unverified line numbers]. The legend asks judges to keep lines level (index.html:473). The sticky headers do not stick (index.html:121-124).
5. **Reset deletes the elapsed time at once, with no confirm and no undo** (app.js:234).
6. **Toasts hide behind the drawer and the round bar.** [Checked] Toasts have no z-index. The drawer is z 7 and the round bar is z 6.
7. **Space and shortcuts.** [Checked] Space is the only clock key. It does nothing in a textarea (app.js:236-248). There are no shortcuts for speech, column, transcript or prep. The Space rule for buttons is deliberate. See 3.5 #17 and Q6.

**P1**
8. The offline error blames the AI key, and the text runs together: "Failed to fetch Check the AI key…" (app.js:806). Flow has no offline indicator.
9. Old place names: "AI + Keys" (app.js:366, 807, 808, 820 and more; index.html:774), "Setup tab" (app.js:823), "Analysis tab" (index.html:599).
10. A choice to not use AI shows in orange error color (app.js:807-808).
11. The start screen hides only the center pane. The left pane, the Insights pane and the full round bar stay visible (index.html:259).
12. "Open a round file" is a `<label>`, so Tab cannot reach it (index.html:465, 435).
13. A prep "Start" pauses the speech (app.js:281). Three buttons say "Start", and the prep buttons have no `aria-label`.
14. The body leaves a fixed 76 px under the round bar. When the bar wraps (821–1180 px), it covers content (index.html:297). `--rb-h` already exists (app.js:771).
15. No column is highlighted for the current speech, and Start does not move the caret there (app.js:781-788).
16. There is no Previous speech button. At 2AR, Next does nothing (index.html:686, app.js:235).
17. The left pane is too full at 768 px height. Docs are open by default (index.html:448). The transcript also shows in the drawer.
18. Insights takes 270 px when no AI is set up (app.js:1871-1873). It does not re-render when the reading level changes (app.js:1262-1268).

**P2**
19. The flow tab row mixes four control types in one style, so two or three black "selected" pills show at once (app.js:784-785, 836-841).
20. Sheet add, rename and delete use `prompt()` and `confirm()` (app.js:860-862).
21. The AI flow toolbar wraps to 2–3 rows. "Updated never." is noise (app.js:836-841).
22. The "AI has a newer version" bar is yellow (index.html:181, app.js:847).
23. The AI flow keeps its own sheet index, which is not saved (app.js:798, 856).
24. Three tooltip styles and delays (app.js:195, 893-917, 756).
25. The speech-tile dot has no role, so screen readers ignore it (app.js:195).
26. Doc upload shows the raw browser file input (index.html:451). The docs summary lists every file name (app.js:1040).
27. The rule for which speech a doc maps to is hidden (app.js:1202-1206).
28. SpeechDrop "Add selected" is a black primary button that competes with Start (app.js:1108).
29. The status shows three times in the round bar. The record dot blinks orange forever (app.js:310-333, 398, 805; index.html:110).
30. The legend under the grid always shows (index.html:473).
31. My-flow textareas have no `aria-label` (app.js:787).
32. The Expert/Plain switch sits in the top bar (index.html:356). See Q20.

**To check**
33. Every keystroke saves the whole round with `JSON.stringify` (app.js:47, 870, 415). This **may** slow typing late in a round. No profile exists. Profile a full 12-speech round on a low-end Chromebook before you change it.

**Gap (no finding yet)**
34. **Recording consent.** The app can record audio of minors in a classroom. There is no disclosure text, no rule on how long audio stays, and no clear "recording now" state beyond the blinking dot. See Q19.

### 3.2 Round

1. **P1.** There is no way forward. Round has no "Start flowing" button (app.js:779). The first button in the action row is "New round (clear all)", styled like Save (index.html:429-434).
2. **P1.** The form is too wide (up to about 1300 px) and too long. Five cards push Save/Open below the fold at 768 px (index.html:55).
3. **P1.** The Reading level card repeats the top-bar switch. Its paragraph has five sentences (index.html:403-407). "Feynman style" is jargon for parents.
4. **P1.** Labels are not tied to their fields (index.html:381-396, 591). A click on a label does nothing, and screen readers do not read the field name.
5. **P0 (copy).** The docs card names one AI vendor: "Claude reads them…" (index.html:410).

### 3.3 Decide

1. **P0.** The Ballot is below the fold at 1366x768. The AI filler card (about 260 px) sits above it (index.html:629-643).
2. **P0.** Three AI features write the same ballot fields: Decision draft (index.html:623, app.js:1808-1819), Live Eval "Copy feedback to ballot" (app.js:1926-1933), and the Ballot filler (app.js:2191). The subnav puts Ballot before Decision draft (index.html:374).
3. **P0.** Copied feedback is not marked "touched". The auto filler can overwrite it 25 s later, and it saves no undo (app.js:1931, 2190, 2197).
4. **P0 (copy).** "Claude declined this request" is shown to users (app.js:1794).
5. **P1.** Action verbs differ: Update now, Weigh, Refresh, Run, Draw, Fill, Generate (index.html:516, 526; app.js:2008, 2023).
6. **P1.** The paradigm is set in two places (index.html:591-599, 500-508).
7. **P1.** The "Fix:" label uses Neg red (app.js:1899).
8. **P1.** "Updating…" shows in green, which reads as "done" (app.js:1851, 1971, 2214).
9. **P1.** Decision draft repeats the docs input (index.html:612).
10. **P1.** The Decision draft status has no live region, and its errors are grey (index.html:616, app.js:1803).
11. **P1.** AI buttons work on an empty round, so the user pays for an empty call (app.js:1830, 1946, 2191).
12. **P1.** Auto Live Eval is on by default and makes one paid call per speech. Auto ballot fill is off (app.js:1922). Section 6 proposes a default change.
13. **P1.** In the ballot filler dialog, Cancel does not cancel (app.js:2230).
14. **P2.** Points are fixed at 25–30 (logic.js:163). With 0–3 ranks filled, the app still says "Ballot looks complete" (logic.js:181, app.js:2333).
15. **P2.** The subnav has no `aria-current` (app.js:77). The 7-column impact table crowds on narrow screens (app.js:2012).

### 3.4 Library

1. **P1.** "Library" means two things: the nav place and the "Debate library" in "?" (app.js:65, index.html:363).
2. **P1.** "Log" is still used: "Save to log", "Saved to log", "Saved ballots in the Log" (index.html:664, app.js:2357, 174).
3. **P1.** A dead end. There are 9 columns and no RFD. A saved ballot cannot be opened (logic.js:212).
4. **P1.** Each row has a full-size Delete with only a native confirm and no undo (app.js:2372-2377).
5. **P1.** When the list is empty, "Copy all for Google Sheets" stays primary and copies only the header (index.html:676, app.js:2379).
6. **P1.** After "Save to log", a native confirm offers a backup. It can follow a second confirm (app.js:2351, 2361).
7. **P1. After the ballot.** The judge must get the decision out of the app. This review does not cover print, PDF, or copying into the tournament's ballot system (for example Tabroom). Review this flow with the grid pass. See Q22.
8. **P2.** The round bar takes 76 px here, where no clock is needed.

### 3.5 Shell and Settings

1. **P0.** [Checked] Toasts last 1.8 s (app.js:49) whatever their length. Errors and successes look the same. There is no dismiss. Example: "this browser is NOT saving" (app.js:18).
2. **P1.** [Checked] 17 native dialog calls. Command: `grep -nE '(^|[^.a-zA-Z])(confirm|prompt)\(' app.js`. Lines: 127, 154, 174, 601, 860, 861, 862, 1503, 1928, 2163, 2230, 2235, 2265, 2271, 2351, 2361, 2376. One opens on top of the node editor (app.js:2163).
3. **P1.** The tour describes a control that does not exist: Brief/Standard/Detailed (tour.js:21).
4. **P1.** The tour starts on Round, not Flow (tour.js:11-12). The brand link still says `setup` (index.html:351).
5. **P1.** On first run, a forced welcome modal opens. It has no close button and Esc does not work (app.js:2387, 1751). It marks "Connect an AI key" as "Recommended" (index.html:762). "Skip" needs an "I understand" box (index.html:774).
6. **P1.** On the hosted site, the subscription choice leads to disabled buttons (index.html:763, app.js:1531). `#sub-box.open` does nothing (app.js:1745).
7. **P1.** Three tooltip systems: 1000 ms with a loud dark fill, 500 ms panel style, and native `title` (app.js:895, 913, 750-766; index.html:297, 212).
8. **P1.** The "?" menu uses `role="menu"` but has no arrow keys. Tab leaves it open (index.html:360-367, app.js:1719-1728).
9. **P1.** Help items sit outside "?": "Show the welcome screen" in Settings (index.html:539), and About in the footer (index.html:699).
10. **P1.** API keys are saved by default (app.js:1275). The opt-out box sits below the paste box (index.html:559). This is a risk on shared classroom computers. Section 6 proposes a default change.
11. **P2.** All 5 provider cards always show with "Not set up" pills (app.js:1438-1452). The model picker shows raw model IDs (app.js:1412-1416).
12. **P2.** The mic help names vendors and is long (index.html:574). The misc card is titled "Settings" inside Settings (index.html:588). "Tabula rasa" clashes with the brand name (index.html:595).
13. **P2.** In dark mode, printing uses the dark Aff/Neg colors on white paper (index.html:340-345).
14. **P2.** Many separate Escape handlers. One Esc can close two layers (app.js:765, 768, 1709, 1728, 1751, 2170).
15. **P2.** The nav label is "Places" in the markup and "Sections" in JS (index.html:355, app.js:86).
16. **P3.** About shows a placeholder: "Screenshot … goes here" (about.html:90). About links can open a second Tabula tab and cause the "updated in another tab" toast (about.html:72-83, app.js:937).
17. **Owner decision: Space.** [Checked] The Space handler (app.js:236-248) is deliberate. Its comment says Space "must start or pause the clock, not 'click' again", even on a just-clicked button or the Transcribe checkbox. It then blurs the focused element. This protects a judge who clicks a button and then presses Space for the clock. It also breaks WCAG 2.1.1: keyboard users cannot press a focused button or checkbox with Space. The owner must choose. See Q6.

### 3.6 Contexts this review does not cover yet

These are gaps. They need their own pass.
1. **Phone width (375 px).** No audit checked the 4x3 speech grid, the round bar or the flow grid at phone width.
2. **iPad with no keyboard.** Keyboard-first shortcuts do not help a touch-only judge. Each shortcut needs a visible touch control. The flow grid needs a touch editing check.
3. **Chromebooks and school laptops.** Many are 1366×768 or smaller, and slow. The minimum supported device is not defined. See Q18.
4. **Learn and About pages.** They have token findings only (Section 4). They have no UX review.

**What already works well:** the token rule (orange for errors), the tour (focus trap, arrow keys, `inert`), the small tour offer, short sheet tabs with full names on hover, the 4x3 speech grid, the drawer button in the round bar, and key paste with provider detection.

---

## 4. Design system

### 4.1 Current state: inconsistencies

**Color** [Checked] (index.html:16-37)
- `--accent`, `--ring` and `--ink` all have the value #16191d. Three names, one color. The names are fine as aliases (they are for different jobs). The fault is that they are three separate literals, so they can drift.
- In light mode, `--aff-fill` is the same as `--aff` (#0055b8). This is acceptable on purpose (see 4.2), but today nothing says so.
- `--sunk` (#f8f9fa) is lighter than `--bg` (#f4f5f7) in light mode but darker in dark mode, so the surface order flips.
- `--warn` (amber) and `--danger` (orange) look alike. The clock's "low" and "over" states are hard to tell apart (index.html:85).
- 34 `.style.color` writes and 52 inline styles in app.js, and 101 inline styles in index.html. [Unverified] Counts from one audit. Suggested command: `grep -c '\.style\.color' app.js` and `grep -c 'style="' index.html`.

**Missing or wrong tokens**
- `--fs-xl` is not defined (index.html:236).
- The `--s5` fallback is 32px, but `--s5` is 24px (index.html:234).
- `--h-ctl-lg` is never used.

**Type** [Unverified] Counts from one audit. Suggested command: `grep -oE 'font-size:[^;]+' index.html app.js | sort | uniq -c`.
- 15 font sizes, and 6 of them are not in the scale.
- Body text is 14px in the app, 16px in About and 17px in Learn.
- Weights 550 and 650 render correctly only on variable system fonts.
- The mono font stack is defined twice, differently.

**Space, radius, shadow, layers**
- About 30 raw px values are outside the spacing scale. [Unverified]
- Layout values 64, 76, 92, 132, 140 and 148px are guesses at the round-bar height. `--rb-h` is measured but used once.
- `100vh` on mobile. `dvh` is better, because mobile browser bars change the page height.
- 8 shadows with no token. 11 rgba values with 8 alphas. [Unverified]
- z-index [Checked]: header 5, round bar 6, drawer 7, overlay 20, tip-pop 20, tour offer 25, help menu 30, tour 40, hover tip 50, toast none.

**Theming and files**
- No `:root[data-theme="dark"]` block. The `:not([data-theme="light"])` guard is dead code.
- about.html and learn.css copy the tokens by hand. The copies have already drifted.
- Breakpoints 1180, 820, 640 (app), 520 (Learn), none (About).

### 4.2 Proposed tightened token set

Put it in one shared file, `assets/tokens.css`. Link it from index.html, about.html and learn.css. It keeps Aff blue, Neg red, orange errors and a **neutral** focus ring.

Contrast values below are [Calc]. Method: WCAG 2 relative-luminance formula, run in a short Python script on the hex pairs shown.

```css
:root{
 /* surfaces: canvas < sunk < panel < raised */
 --canvas:#f4f5f7; --sunk:#eef0f3; --panel:#fff; --raised:#fff;
 /* text */
 --text:#16191d; --text-2:#3c434c;
 --text-3:#5f6873;      /* replaces --muted: 5.65:1 on #fff, 5.18:1 on #f4f5f7 */
 /* borders */
 --border:#e1e4e8;      /* dividers only (1.28:1 on #fff; not for controls) */
 --border-ctl:#7d8690;  /* control edges: 3.69:1 on #fff, 3.39:1 on #f4f5f7, 3.24:1 on #eef0f3 */
 /* sides */
 --aff:#0055b8; --aff-tint:#eaf1fb; --aff-edge:#b3cdee;
 --aff-fill:var(--aff); /* same value in light mode on purpose: #0055b8 already works as text and fill. Dark mode gives it its own value. */
 --neg:#c8161f; --neg-fill:#f2232d; --neg-tint:#fdecec; --neg-edge:#f4c0c2;  /* never white text on --neg-fill */
 /* status */
 --error:#b93d0a; --error-tint:#fdf0e8; --caution:#7a5000; --caution-tint:#fff6dc; --ok:#1a7a3a; --ok-tint:#e8f6ec;
 /* neutral action and focus (aliases on purpose, one literal) */
 --accent:var(--text); --on-accent:#fff; --ring:var(--text);
 /* type */
 --fs-1:12px; --fs-2:13px; --fs-3:14px; --fs-4:16px; --fs-5:20px; --fs-6:28px; --fs-clock:clamp(56px,12vw,128px);
 --fw-reg:400; --fw-med:500; --fw-semi:600; --fw-bold:700; --fw-black:800;
 --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
 /* space and radius */
 --s0:2px; --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
 --r-sm:4px; --r-md:6px; --r-lg:8px; --r-xl:12px; --r-pill:999px;
 /* controls */
 --h-sm:28px; --h-md:32px; --h-lg:40px; --hit-min:24px;
 /* elevation */
 --shadow-1:0 1px 2px rgb(0 0 0/.06),0 4px 16px rgb(0 0 0/.06);
 --shadow-2:0 6px 18px rgb(0 0 0/.14);
 --shadow-3:0 20px 50px rgb(0 0 0/.28);
 --scrim:rgb(10 12 15/.55);
 /* layers */
 --z-sticky:10; --z-bar:20; --z-drawer:30; --z-pop:40; --z-dialog:50; --z-tour:60; --z-toast:70; --z-tip:80;
 /* layout and motion */
 --header-h:52px;   /* --rb-h stays measured by JS */
 --dur-1:.12s; --dur-2:.2s;
}
/* Breakpoints (CSS variables do not work in @media): wide 1180, tablet 820, phone 560 */
```

**Dark mode**
- Keep the current dark values, including `--ring` = `--text` (#e9ecef, neutral).
- `--text-3` = #8b949e (5.68:1 on panel #171a1e).
- `--border-ctl` = #68717b (3.52:1 on panel #171a1e, 3.81:1 on canvas #0f1114).
- `--canvas` = #0f1114 and `--sunk` = #121418, so the panel stays the highest surface.
- `--aff-fill` = #3b82f6 (today's dark value).
- `--neg-fill`: keep #f2232d. It is already 4.20:1 on panel #171a1e, so no change is needed.
- Put the values under both the `prefers-color-scheme: dark` media query and `:root[data-theme="dark"]`.

**Usage rules**
1. Side colors are for data only. The shell stays neutral. The focus ring is neutral.
2. Status colors come only from classes (`.is-error`, `.is-caution`, `.is-ok`). Remove the `.style.color` writes.
3. Replace inline styles with component classes.
4. Every control is at least 24 px tall.
5. Add one global reduced-motion rule.
6. Add a forced-colors rule so that Aff/Neg cards keep a visible edge. Forced colors is a Windows high-contrast mode.
7. Body text size: see Q2. The flow grid and dense panes stay at 13–14 px. Inter Tight is only for page titles and the clock.
8. One tooltip: about 500 ms delay, panel style, weight 400. It shows above the element when it is near the bottom edge.

---

## 5. Accessibility issues, ranked

WCAG is the web accessibility standard. "AA" is its usual target level. Contrast values are [Calc] with the method from 4.2.

1. **Space takes over buttons and checkboxes on every screen.** [Checked] Keyboard users cannot press a focused button or checkbox with Space (app.js:236-248). This is a deliberate design choice (see 3.5 #17). The owner decides the fix in Q6.
2. **Input and button borders are 1.49:1 against the panel.** Pair: `--line-2` #cfd4da on `--panel` #fff (index.html:61, 66). WCAG 1.4.11 needs 3:1 for control edges.
3. **21 inputs have no accessible name.** [Unverified count] Their labels have no `for` and do not wrap the input (index.html:381-398, 591). Ballot points and ranks have no per-row label (app.js:2315-2316). Suggested check: an axe or Lighthouse accessibility run on each screen, which lists unnamed fields.
4. **Toasts are hidden and too short.** [Checked] No z-index; 1.8 s (app.js:49).
5. **The welcome and node-editor dialogs do not trap focus.** They set `aria-modal`, but Tab reaches the page behind them (index.html:723, 757). The tour does this right (app.js:1648).
6. **"Open a round file" cannot be reached with Tab** (index.html:465, 435).
7. **Muted text fails AA in light mode.** `--muted` #6a737d on `--bg` #f4f5f7 is 4.41:1 (`.app-foot`, index.html:311). On `--line-2` #cfd4da it is 3.23:1. AA needs 4.5:1 for normal text.
8. **Hit targets under 24 px:** `.tip` 16 px (index.html:209), `.aibar button` 22 px (166), `.madd` 22 px (169).
9. **The "?" menu says it is a menu but has no arrow keys,** and Tab leaves it open (index.html:360, app.js:1719-1728).
10. **Selected states use class only.** Sheet tabs (app.js:895) and the Decide subnav (app.js:77) have no `aria-selected` or `aria-current`.
11. **The speech-tile dot label is ignored,** because the element has no role (app.js:195).
12. **My-flow textareas have no label** (app.js:787).
13. **Color alone carries meaning.** "Fix:" in Neg red (app.js:1899). Side bars are box-shadows, which forced-colors mode removes (index.html:81, 138).
14. **Motion:** only `.rec-dot` respects reduced motion (index.html:93). No global rule.
15. **11 live regions** can talk over each other during a round. The clock is correctly `aria-live="off"` (index.html:706).
16. **Double labels:** buttons have both `title` and `aria-label` (index.html:359, 369).

---

## 6. Grill-me questions for the owner

### 6.0 Defaults we will apply unless you object

These follow from your stated values or from safety rules. We will do them and tell you. Say no if you disagree.
- **D1. API keys are not saved by default.** A "Remember on this device" box sits next to the paste field, off by default. Reason: shared classroom computers. Cost: a judge pastes the key again next time.
- **D2. No paid AI call runs by itself.** Auto Live Eval and auto ballot fill start off. The app says once that they exist. Reason: no cost without consent. Cost: fewer judges find the feature.
- **D3. Forms and reading text use 16 px.** Reason: WCAG and readability research favor 16 px for body text, and many judges are parents. The flow grid size is still your choice (Q2).

### 6.1 Questions

Each question offers options. ★ marks the recommended option. Options are not in a fixed order. Each option states one gain and one cost.

#### Overall feel

**Q1. Which Flow layout do you prefer?** (We will attach two mock screenshots, one per option, before we ask.)
- A. Every pane is its own card, as today. *Gain: panes look equal and their edges are clear. Cost: more lines on screen.*
- B ★. Only the flow grid is a raised card. The side panes sit on the page color. *Gain: the grid is the clear focus. Cost: side pane edges are softer.*
- C. No cards: flat, with thin lines only. *Gain: fewest shapes on screen. Cost: pane edges are hardest to see.*

**Q2. What text size do you want in the flow grid and dense panes?** (Forms use 16 px, see D3.)
- A. 16 px. *Gain: easiest to read. Cost: about 15% fewer words per column line.*
- B ★. 13–14 px. *Gain: more words per column. Cost: harder for tired eyes.*
- C. 14 px with a text-size control in Settings. *Gain: the judge chooses. Cost: one more setting to build and test.*

**Q3. Should the app offer a manual Light/Dark/System theme choice?**
- A. No. Follow the device only, and remove the dead code. *Gain: less to build. Cost: the judge cannot override the device.*
- B ★. Yes, in Settings, with System as the default. *Gain: judges in dark rooms can choose. Cost: the code needs the dark-theme block.*

#### Flow workspace

**Q4. How should 7 columns fit on a 1366 px laptop?** (We will attach a mock with real flow text for each option.)
- A. Keep all panes, and scroll sideways to the current speech by itself. *Gain: side panes stay open. Cost: the judge cannot see all columns at once.*
- B. Show a window of 4 columns around the current speech. *Gain: wide columns. Cost: early columns are out of view in rebuttals.*
- C ★. Hide the left pane by default under 1440 px, and let columns shrink to about 96 px. *Gain: all 7 columns fit. Cost: speeches and transcript need one key or click. At 13 px, a 96 px column holds about 12 characters per line [Calc, estimate], so shorthand is needed.*

**Q5. When a judge clicks an earlier speech while the clock runs, what should happen?**
- A. Ask "Pause the 2AC?" each time. *Gain: the judge decides each time. Cost: one extra click during a fast round.*
- B ★. Show that speech for viewing only. The clock and recording keep running. A label says "Viewing 1NC · 2AC running". *Gain: no lost time. Cost: a new "viewing" state to learn.*

**Q6. How should Space work?** Today Space starts or pauses the clock on every screen, even when a button or checkbox has focus. This is on purpose (app.js:239-241). It breaks the WCAG rule that Space presses a focused button.
- A. Keep today's rule. *Gain: Space always controls the clock. Cost: fails WCAG 2.1.1; keyboard users cannot press buttons with Space.*
- B ★. Space controls the clock only on Flow, and only when no button, checkbox or text field has focus. Add Ctrl+Enter (Cmd+Enter on Mac) as a clock key that works everywhere on Flow, also while typing. *Gain: passes WCAG and works while typing. Cost: after a judge clicks a button, Space presses that button, not the clock.*
- C. Like B, but use a function key such as F2 instead of Ctrl+Enter. *Gain: no clash with text. Cost: hard to find on many laptops and Chromebooks.*

**Q7. Where should the transcript live?**
- A. In both places, as today. *Gain: always visible. Cost: the content shows twice and the left pane is crowded.*
- B. Only in the left pane, and remove the drawer. *Gain: always visible. Cost: no quick drawer from the round bar.*
- C ★. Only in the drawer from the round bar. Remove it from the left pane. *Gain: one place and more room in the left pane. Cost: one more click to see it.*

**Q8. What should the Insights pane do when no AI is set up?**
- A. Stay open with the "Connect AI" text, as today. *Gain: AI is easy to find. Cost: 270 px of width.*
- B ★. Fold to a thin edge with one "Connect AI" link. *Gain: the flow gets 270 px back. Cost: AI is less visible.*

#### Decide and ballot

**Q9. How should the three AI ballot features combine?**
- A. Keep all three, and reorder to Live Eval → Analysis → Decision draft → Ballot. *Gain: small change. Cost: three features still write the same fields.*
- B ★. One "Draft with AI" panel inside the Ballot. Remove Decision draft as a separate tab. *Gain: one path. Cost: a larger change.*
- C. Keep only the Ballot filler, and remove Decision draft and "Copy feedback". *Gain: simplest. Cost: loses the full RFD draft.*

**Q10. Should the ballot points range be a setting?**
- A ★. Yes, in Round, with 25–30 as the default. *Gain: fits leagues with other ranges. Cost: one more field.*
- B. Keep 25–30 fixed. *Gain: simpler. Cost: wrong for leagues with other ranges.*

#### Shell, settings and help

**Q11. What should a first-time judge see first?**
- A. The welcome modal, but with a close button and no "I understand" box. *Gain: AI setup is more visible. Cost: one more screen before the round.*
- B ★. The empty start screen (New round / Open round). AI is a quiet link there. *Gain: the judge starts a round fastest. Cost: fewer judges set up AI.*

**Q12. What should the top-nav "Library" be called?**
- A. Keep "Library", and rename the help item to "Learn debate". *Gain: the nav stays the same. Cost: "Library" is vague for saved ballots.*
- B ★. "Ballots". Keep "Debate library" in "?". *Gain: no name clash. Cost: a new word for current users.*
- C. "Saved". *Gain: short. Cost: less clear about what is saved.*

**Q13. Do you want a Cmd+K command palette?**
- A. No. Only the shortcut sheet. *Gain: less to build. Cost: some places still need the mouse.*
- B ★. Yes, and list it in "?" as "Search and commands". *Gain: fast for experts. Cost: more to build and test.*

#### Scope and priorities

**Q14. What order should the work go in?**
- A. Tokens and visual system first, then fixes on the new base. *Gain: one clean base for every later change. Cost: round-breaking bugs stay longer.*
- B. One screen at a time, all levels of fix per screen. *Gain: each screen is finished when it ships. Cost: shared parts (toasts, Space) get touched on each screen.*
- C ★. First the round-safety fixes (clock survival, viewing state, Space, toasts, 1366 fit). Then copy and dialogs. Then visual polish and tokens. *Gain: fixes what can break a round first. Cost: the new look comes later.*

#### New questions

**Q15. Where should the Expert/Plain switch go?** (Today it sits in the top bar.)
- A. Keep it in the top bar. *Gain: one click to change. Cost: top-bar clutter.*
- B ★. Move it to Settings and Round setup. *Gain: a calmer top bar. Cost: harder to change during a round.*

**Q16. How will we measure success?**
- A ★. Time for a first-time judge to start a round, plus a 5-judge test round with a short survey. *Gain: real evidence. Cost: needs volunteer judges.*
- B. Owner review of screenshots only. *Gain: fast. Cost: no user evidence.*

**Q17. Do you want a phone layout?**
- A ★. Yes for the clock, prep and ballot. The flow grid stays tablet and laptop only. *Gain: a judge can time and submit from a phone. Cost: one more layout to test.*
- B. No. Tablet and laptop only. *Gain: less to build. Cost: phone users get a broken layout.*

**Q18. What is the minimum supported device?**
- A ★. A 1366×768 Chromebook and an iPad in landscape. *Gain: covers most school laptops. Cost: tight layouts.*
- B. 1280×720. *Gain: covers older laptops. Cost: even less room for 7 columns.*

**Q19. How should the app handle recording consent?** The app can record minors.
- A ★. Show a plain disclosure before the first recording, keep a visible "Recording" strip while the mic is on, and delete audio after transcription by default. *Gain: clear and safe. Cost: one more step at first use.*
- B. Keep today's behavior and add a short note in About. *Gain: no new step. Cost: risk with schools and parents.*

**Q20. Where should the decision go after the ballot?**
- A ★. Print and PDF first, then "Copy for the tournament ballot". *Gain: works with any tournament. Cost: copy-paste remains.*
- B. Copy only. *Gain: less to build. Cost: no paper or PDF copy.*

---

## 7. Proposed next steps

### Step 1: Check, then spec
- Check every line number in Section 3 against the current code. The audits sometimes disagree (see the note at the top).
- Resolve each [Unverified] item: run the suggested command, take the screenshot, or run the profile.
- Run the flow-grid and forms Mobbin passes again. Add screen links for all quoted app text.
- Write one short spec from this document and your answers to Section 6.
- The spec lists each change, the screen, the file:line evidence, and the test that proves it.
- Each test gets a one-line header that says why the behavior matters and what breaks if it regresses.

### Step 2: Approval
- You review the spec.
- You mark each item: do now, do later, or drop.
- Nothing is built before your approval.

### Step 3: Build plan

**Slice 0 (do first, alone): shared base.** Other slices depend on it.
- `assets/tokens.css` and the layer (z-index) tokens.
- One toast component (z-index, time by length, error style, dismiss, undo action).
- One `ask()` dialog with focus trap and Esc, to replace `confirm()` and `prompt()`.
- One tooltip component.
- One Esc stack.
- One keyboard-shortcut registry, so that Space and the new keys run only on the right screen.

**Slice A+B (after Slice 0, one slice, in order): Flow.** These items all edit the Flow render code in app.js (about 2400 lines). So they run in one slice, one change after the other, not in parallel.
1. Round safety: save and restore the running clock (refresh, crash, sleep, second tab, storage blocked).
2. View a speech without stopping the clock.
3. Shared vertical scroll and the 1366 px fit.
4. Previous button, current-column highlight, prep labels, Reset undo.
5. Body padding from `--rb-h`.
6. Truly empty start screen and the keyboard-reachable Open button.
7. Pane toggles (`[`, `]`, `\`) with touch buttons.
8. Transcript drawer as the one transcript view, with "Last 30 seconds".
9. Flow tab row clean-up, Insights fold, offline indicator.
10. Save debounce only if the profile in Step 1 shows a problem.

**Slices that can run in parallel with Slice A+B.** They touch other screens. Each slice must still rebase on Flow changes in app.js.
- **Slice C: Round screen.** "Start flowing" button, narrower form, label `for` fixes. Move "New round" away from Save. Points range setting, if approved.
- **Slice D: Decide.** Ballot above the fold. AI feature merge or reorder, per your answer. Touched-field fix and undo for auto fills. One verb pair, empty-round guard, status colors.
- **Slice E: Library.** Rename, if approved. Row detail with RFD, undo delete, disabled export when empty. Backup offer as a toast. Print/PDF, if approved.
- **Slice F: Shell, Settings and help.** "?" menu redesign, shortcut sheet, and command palette if approved. Tour starts on Flow and ends at "?". Fix the wrong tour step. First-run change. Provider list A–Z with plain status. Key paste box. Remember-key default. Recording disclosure.

**Slice G: Copy pass (last, after Slice A+B).** Old place names, vendor names in copy, offline error text, mic help, "Tabula rasa" label, About placeholder. It runs last because it edits strings in the same Flow code.

### Step 4: Gates and review for each slice
- Run the repo gates in `/Users/dahlia/Code/debate/.claude/gates.json`: `node --test` and `node check-publish.mjs`. Report each command and its result.
- These gates do not test the UI. So each slice also needs a **browser check** with screenshots:
  - sizes: 1366×768, iPad landscape and portrait, 375 px phone (for screens in Q17),
  - light and dark mode,
  - keyboard-only pass (Tab, Space, Enter, Esc),
  - an axe or Lighthouse accessibility run.
  Use a script where possible, or a written checklist. Attach the screenshots to the slice report. "The gates pass" alone does not prove a UI item is done.
- A clean-context reviewer checks spec fidelity before the slice is called done.
