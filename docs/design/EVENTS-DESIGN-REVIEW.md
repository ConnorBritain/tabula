# Tabula Speech Events: design review of every screen

Status: plan for owner approval, 2026-11-24. No app code changed.

Not yet reviewed: the Congress session screens (log, PO hours, rank, review), phone light theme for 13 of 23 screens, and a keyboard and screen-reader walk. §6 gives the reasons.

The owner asked for a pass over every event and every screen, with Mobbin, to add visual interest, clarity and clear UI/UX fixes above the baseline. This file gives:

1. What we checked and how (§1).
2. One section per screen: the problem today, the change, Mobbin references, effort, and risk to a judge in the middle of a round (§2).
3. A ranked top-10 list across the app (§3).
4. The owner decisions, at most 2 options each, with a pick (§4).
5. Bugs found on the way, for the events owner (§5).

Rules that this plan keeps (no option breaks them, except OD3, which needs a change to DESIGN.md §3 and BRAND.md §7 and is marked so):

- Calm grey chrome. Color only for data and status. A word always goes with a color (`docs/events/DESIGN.md` §1).
- No stripes and no underline tabs (`docs/design/NO-STRIPES.md`). A data bar is a full bordered track, never a one-sided accent.
- Brand colors are locked (memory `brand-color-families`): cool grey container, Speech Events green `#1e7a55` / `#5ec796`, no cream.
- Already decided on 2026-11-23, not asked again here: **D2 = A** (signal track under the timer digits) and **D3 = A** (mini time track on each roster and rank row), from `docs/design/EVENTS-VISUAL-DEPTH.md` (branch `claude/awesome-cori-679017`). That file is only on that branch. In short: D2-A is one horizontal data bar under the digits (speech segment neutral, grace segment caution tint, over segment error tint, ticks at the event's signal points, a "now" dot); D3-A is the same track at small size on each roster and rank row, with the final time marked and the pill in words. This plan places them in the ranked list and joins them with the other moves.
- Mobbin: take layout and behavior only, never another brand's look. Links need a signed-in Mobbin account.

## 1. Method

- App at GitHub `main` `7bd18af` (S1 to S6 built), served locally from this worktree.
- Seeded one realistic day ("Glenbrook Speech Invitational") with 8 rounds that cover every family and every ballot shape:

| Round | Event and family | Rules profile (ballot shape) | State |
|---|---|---|---|
| `r-hi` | HI, F1 prepared | NSDA district (rank all) | Round 2, 2 of 6 done, C33 next; also shot in Grace and Over grace |
| `r-hidone` | HI, F1 | NSDA district (rank all) | Round 1, all done, ranked, B47 over grace |
| `r-usx` | USX, F2 extemp | elim-large (elim, cross-ex, panel of 3) | Semis, 3 of 7 done |
| `r-imp` | IMP, F3 impromptu | top-three (top N) | 4 of 5 done, I19 speaking |
| `r-pcc` | PCC, F4 two runs | NSDA invitational | Not started |
| `r-oo` | OO, F1 | rate-only (rate) | All rated, copied |
| `r-di` | DI, F1 | rubric-five (rubric) | Rubric half filled |
| `r-poi` | POI, F1 | comments-only | 2 of 3 done |

- Shots: laptop (1280 × 800) and phone (390 wide, full page). Dark: all 23 screens at both widths. Light laptop: 23 screens. Light phone: 10 of 23 screens only (hi-room, hi-room-grace, hi-room-over, hi-rank, hi-review, imp-room, myday, picker, setup, usx-room). The local server stalled and the run was not repeated, so PCC, rate, rubric, comments-only, History, type page, Settings, palette and the Congress screens have no light phone shot. Files are in [`events-review/`](events-review/), named `<screen>-<laptop|phone>-<dark|light>.jpg`. Phone shots were later scaled down to save space. Nothing in this review depends on a light-only shot.
- Some "wrong today" items come from the seeded state, not from a single shot. They are marked *(seed state)*.
- Mobbin: new searches on 2026-11-24 for each problem below, plus the references already in `docs/events/DESIGN.md` §4, `docs/events/EXPERIENCE.md` §10 and `EVENTS-VISUAL-DEPTH.md` §6.

**Effort:** S = up to 1 day, M = 2 to 4 days, L = a week or more (each with tests and the two reviewers).
**Risk mid-round:** what can go wrong for a judge who has the round open when the change ships. Low = layout only. Med = a control moves. High = a control changes how it works.

## 2. Screen by screen

### 2.1 My day (home) `#/`

Shots: [myday-laptop-dark](events-review/myday-laptop-dark.jpg), [myday-phone-dark](events-review/myday-phone-dark.jpg), [palette over My day](events-review/palette-laptop-dark.jpg).

What is wrong today:

- Every card has the same weight. With 8 rounds, "Now 8" is a wall of equal cards. The judge cannot see which round is next.
- Each card has 4 buttons in a row (Open, I submitted in Tabroom, Change room, Cancel round). Change room and Cancel round are already quiet text buttons, but "Cancel round" still sits in the same row as "Open". It is easy to tap by mistake on a phone. *(Seen on every card in the shot.)*
- "Room Room 214": the app adds "Room " in front of a label that the judge typed as "Room 214" (`myday-screen.js` line 34).
- "Ranks due in 1:39" is bold monospace. It looks like code, and "1:39" can read as 1 hour 39 or 1 minute 39.
- The event pill ("HI") is the only thing that tells two cards apart. Round number and flight are small.

Change:

1. **An "Up next" card** at the top: the round that is judging now, or else the next not-started round. Bigger title ("HI · Round 2 · Flight A"), room, the roster count ("2 of 6 done") and one primary button ("Open" or "Continue"). Other cards become compact rows (pill, round, room, one status pill).
2. **Move rare actions into a "⋯" menu** on each card: Change room, Cancel round. Keep "Open" and "I submitted in Tabroom" visible, with today's rule for the second (`myday-screen.js` shows it while judging and after ranks are in). No behavior change.
3. **Ranks due as a status pill in words**: "Ranks due in 2 min", turning to the `--caution` pill at 2 minutes and `--error` pill after the time ("Ranks 3 min late"). Same font as the rest.
4. Show "Room 214" as typed. Add "Room" only when the label is a bare number.

Mobbin:
- Zocdoc "Up next" single card above the list: https://mobbin.com/screens/14e7f095-1b94-4e03-96e3-1b3fec5c9aa5
- Todoist row "⋯" menu with the destructive item last and in its own group: https://mobbin.com/screens/44f33505-7150-46ba-9113-f8442bea3d87
- Meetup event menu with "Cancel event" inside the menu, not on the page: https://mobbin.com/screens/0d1e5138-a9af-4ece-a43c-ad3632810291
- Runna "Today's workouts" (already in EXPERIENCE.md §10): https://mobbin.com/screens/20751c4f-c638-4561-8220-00beafe536e7

Effort M. Risk mid-round Low (the card still opens the same round).

### 2.2 Picker `#/pick` and confirm sheet

Shots: [picker-laptop-dark](events-review/picker-laptop-dark.jpg), [picker-phone-dark](events-review/picker-phone-dark.jpg).

What is wrong today:

- Good base: search, Recent first, one plain line per event, field chips.
- The "i" button is an italic letter with no label. A first-time parent does not know it opens the Guide.
- Chips are all-caps monospace ("RANK · TITLE · TIMER 10:00"). They read as code, not as facts.
- Every row is a tall card. All 18 events need a long scroll on a phone, with no family headings in view once the judge scrolls.

Change:

1. Replace "i" with a small text button "Guide".
2. Chips in normal case, normal font, grey pills: `Rank` `Title` `10:00`. The time chip shows the limit the way the timer does.
3. Family headings ("Interp", "Public address", "Limited prep", "Two runs", "Congress") stay pinned while their group scrolls. Rows get 25% shorter.

Mobbin:
- Hevy exercise list with grouped headings and compact rows (EXPERIENCE.md §10): https://mobbin.com/screens/1da62220-571d-4dc5-964c-24aed2282ed5
- Oura "suggested, then all" (EXPERIENCE.md §10): https://mobbin.com/screens/9a43c46c-6c3d-467e-b2e8-f669cc66d548

Effort S. Risk Low.

### 2.3 New room (setup) `#/new/<event>`

Shots: [setup-laptop-dark](events-review/setup-laptop-dark.jpg), [setup-phone-dark](events-review/setup-phone-dark.jpg).

What is wrong today:

- The Event select runs past its column and sits under the Rules select (laptop width). This is a layout bug.
- The paste box is large, but the parsed preview is below the fold. DESIGN.md §4.8 asks for a live preview beside the box, with "Check these" lines.
- Nine fields in one column before the paste box. Level, judges and panel note are rare; they push the main task down.

Change:

1. Fix the Event field width.
2. Laptop: paste box on the left, live preview on the right (one row per entry: order, code, name, title). Lines the parser is not sure of go under "Check these (2)". Phone: preview under the box, with a count line "6 entries found · 1 to check".
3. Put Level, Judges in the room and Panel note under a "Elim or panel?" disclosure, open when the card says elim.

Mobbin:
- Contra: form on the left, live preview on the right: https://mobbin.com/screens/2fe5831c-a21f-4c49-ad47-9bd947f8b2a5
- Aboard "Previewing data", a short preview list with "+2 more": https://mobbin.com/screens/d3f159d5-908b-4f15-bff8-1202d0795407
- Cloaked "Review & import" with "Needs review 1" count: https://mobbin.com/screens/6bda4a8f-7556-4cec-800a-cba28fff6f3c
- Attio "Needs review" group (DESIGN.md §4.8): https://mobbin.com/screens/9b9c9701-3db8-4109-ac3c-130715702e1f

Effort M. Risk Low (setup is before the round).

### 2.4 Room, F1 prepared (HI, OO, DI, POI and others) `#/round/<id>/judge`

Shots: [hi-room-laptop-dark](events-review/hi-room-laptop-dark.jpg), [grace](events-review/hi-room-grace-laptop-dark.jpg), [over grace](events-review/hi-room-over-laptop-dark.jpg), [hi-room-phone-dark](events-review/hi-room-phone-dark.jpg), [poi-room-laptop-dark](events-review/poi-room-laptop-dark.jpg).

What is good: the grace and over-grace fills are strong and clear. The roster is easy to scan. Chips write real sentences.

What is wrong today:

- **Phone: the page is wider than the screen.** At capture, the full-page shot came out 408 CSS px wide on a 390 px viewport (816 px at 2× before the shots were scaled down). Chips, the comment box and the private note run off the right edge, so the page slides sideways under the judge's thumb.
- **Phone: the timer leaves the screen while the judge writes.** The comment box starts about 1,200 px down (most of two phone screens). When the judge types, the time and the stage are gone. A judge who writes during the speech (most of them) cannot see a signal point coming.
- **The piece fields (Title, Author) sit above the timer** for every speaker. They take the top of the card on every entry, but the judge fills them once, at the intro.
- **The timer card is flat for the first 9 minutes**: big digits on a blank card. The signal plan is invisible (this is D2, decided A).
- **Roster rows look the same for 9:56 and 11:01.** B07 went over grace, but the row only says "Done" (this is D3, decided A).
- The current name truncates ("Ava Bro…") when the row shows a time and the "Speaking" pill.
- "Next speaker" is at the very bottom of a long phone page.

Change:

1. **Fix the phone overflow** (chip rows wrap or scroll inside their own row; text areas `max-width: 100%`).
2. **Sticky compact timer on phone and narrow laptop.** When the big timer card scrolls out of view, a slim bar pins to the top: stage word, time, a thin signal track, and Start/Stop. It uses the same fill as the card (grace = caution tint, over = error tint). Owner decision OD1.
   - Acceptance rule: the bar is a second render of the state `timer-view.js` already has. It draws from `timerFace()` and its buttons send the same `data-tact` actions. It adds no driver, no tick, no key binding (Space stays the one `startStop` entry in `keys.js`) and no timing code.
   - IMP: the bar's button follows the current phase (prep or speech), the same as the big card's button.
   - Speaker view (DESIGN.md §4.2) is a different thing: it is full screen, for the speaker, with no controls. The bar is for the judge, in the page, with one control.
   - Test cases: F1, IMP (prep then speech), PCC (Pro then Con).
3. **Piece fields collapse to one line** once filled: "Office Hours · K. Wu · Edit". Empty fields stay open, but sit under the timer, not above it.
4. **Signal track under the digits** (D2-A, decided): speech segment, grace segment (caution tint), over segment (error tint), ticks at the event's signal points with short labels, a "now" dot.
5. **Mini time track on each roster row** (D3-A, decided): the speaker's final time on the same track shape, plus the existing pill in words. Over-grace rows show "Done · Over grace".
6. Let the roster row drop the time while "Speaking" (the timer already shows it), so the name does not truncate.
7. Phone: "Next speaker" also sits in the sticky bar after Stop.

Mobbin:
- Jomo live bar: label, big time, a thin progress track under it: https://mobbin.com/screens/ac22e3c9-5974-4d31-b371-4da5b9da5848
- Ladder compact bar with a segmented track and the time: https://mobbin.com/screens/5e2ec85e-10da-4556-9588-28342da7c884
- Tiimo compact bar: stage word, time, "+1" and pause: https://mobbin.com/screens/08174296-6797-414b-ac9d-fad2e80ce106
- Signal-track references (decided): Strava splits https://mobbin.com/screens/f8747488-3929-468c-a75f-cb9cd86fe90c · Life Reset track labels https://mobbin.com/screens/3ceb4f7b-4cba-4e1e-adcd-8b6e096673ac

Effort: overflow fix S; sticky bar M; piece collapse S; signal track M; row track M. Risk mid-round: overflow and piece collapse Low; sticky bar Med (a second Start/Stop appears; it must call the same driver and the same Space key).

### 2.5 Room, F2 extemp (USX, IX) with elim cross-ex and panel

Shots: [usx-room-laptop-dark](events-review/usx-room-laptop-dark.jpg), [usx-room-phone-dark](events-review/usx-room-phone-dark.jpg).

What is wrong today:

- The **question drawn** is the most useful fact about an extemp speech, but it is not visible at the top of the card, and the roster rows do not show it *(seed state: the first three speakers have a question; the laptop shot shows none of them in the roster)*. To compare speakers at rank time, the judge must open each one.
- The elim line is plain grey text: "Elim · Panel of 3 · 3 judges Panel: agree on overtime before you flag." It repeats "3" twice and runs two sentences together.
- The cross-ex block (phase pills, asker, school, a second clock) is open before the speech starts. It doubles the controls on screen during the 7-minute speech.

Change:

1. Question field directly under the speaker code, above the timer. Once filled, it shows as a quote line. Roster rows show the first words of the question under the name, through `question.js` `questionOf` and the same short-text helper as §2.8.
2. Elim facts as a row of pills: `Elim` `Panel of 3`, and one line under them: "Agree on overtime with the panel before you flag."
3. Cross-ex block stays closed until the speech stops ("Next: Cross-ex" then opens it), using the phase bar.

Mobbin:
- Phase bar (EXPERIENCE.md §10): Ladder https://mobbin.com/screens/902f3d8a-cb98-4738-a631-2f9d7a176df4 · Peloton https://mobbin.com/screens/ddbad8c8-8a68-4c12-98d5-6475e8e7bb74

Effort S. Risk Med (the question field moves; it must keep its value and its key).

### 2.6 Room, F3 impromptu (IMP)

Shots: [imp-room-laptop-dark](events-review/imp-room-laptop-dark.jpg), [imp-room-phone-dark](events-review/imp-room-phone-dark.jpg).

What is wrong today:

- "Prep" and "Speech" pills sit above the digits, but nothing shows how the 7:00 was split. A judge cannot see "used 2:10 to prep".
- The topic is not visible above the fold.

Change:

1. The D2 signal track starts with a prep segment (see the track ownership rule under §2.7). When "Speech" starts, the prep part freezes and gets a label ("Prep 2:10"). This merges the prep pills and the phase bar into one control (as EVENTS-VISUAL-DEPTH.md §8 move 1 says).
2. Topic as a quote line under the code, like the extemp question.

Mobbin: same phase-bar and track references as 2.4 and 2.5.

Effort S (on top of the D2 track). Risk Low.

### 2.7 Room, F4 Pro Con Challenge (PCC)

Shot: [pcc-room-laptop-dark](events-review/pcc-room-laptop-dark.jpg).

What is wrong today:

- The two runs show **three times**: the "Pro / Con" pills above the clock, the "Next: Pro…" line, and the Pro and Con run cards under the buttons.
- An empty Topic field and its help text push the 10:30 clock down.

Change:

1. One control: the D2 track with two segments, "Pro" and "Con", on one 10:30 limit. Run cards below keep the split times. Remove the pills; keep the "Next" line as the label under the track.
2. Topic field collapses to a one-line input with a short placeholder ("The student's topic"); the long help text goes into the Guide.

**Track ownership (applies to 2.4 to 2.7 and the 2.5 cross-ex).** One model, one renderer. The phases stay in the model that `phase-bar.js` already reads (`phases`, `current`). The track is one new pure view module (for example `signal-track.js`) that `timer-view.js` calls; it reads that model plus `signalPoints()`. When the track ships, it replaces the pill renderer in `phase-bar.js` for IMP, PCC and the F2 cross-ex, so there are never two phase controls on one screen. No logic goes into `room-screen.js`.

Mobbin: Runna run cards (EXPERIENCE.md §10): https://mobbin.com/screens/ea07706a-2073-44c7-8672-f939616ec99d

Effort S. Risk Med (PCC is new; judges have not learned it yet, so the risk is small in practice).

### 2.8 Rank (rank all, top N) `#/round/<id>/rank`

Shots: [hi-rank-laptop-dark](events-review/hi-rank-laptop-dark.jpg), [hi-rank-phone-dark](events-review/hi-rank-phone-dark.jpg), [imp-rank-top3-laptop-dark](events-review/imp-rank-top3-laptop-dark.jpg).

What is good: big rank numbers, three ways to move, a clear "Over grace" pill, "Ready" check, "Review and copy" on the phone.

What is wrong today:

- **Top N** shows "Not in top 3" as a pill on every lower row. The cut is not a place on the board.
- The over-grace rule shows only as row text ("Can't be ranked 1st.").
- Rows show the time as text only (D3).
- Nothing on the row reminds the judge what they wrote. The judge must go back to the room to remember who was who.
- The heading uses the short code ("Rank · HI · 1 · Flight A") while the room uses the full name.

Change:

1. **A labelled cut line** under rank N: "Top 3 get a rank. The rest are not ranked on the ballot." Remove the per-row "Not in top 3" pill.
2. When any entry is over grace, a quiet labelled line under rank 1: "Rank 1 needs a speaker inside grace." (EVENTS-VISUAL-DEPTH.md §8 move 3.)
3. D3 mini track on each row.
4. One line of the judge's comment (the first sentence, grey) under the name, and the piece title for F1. Tap opens the full comment in a sheet. The first-sentence cut lives in one pure helper (next to `comments.js`), used by the rank rows and the roster; the screens do not copy it.

Mobbin:
- Duolingo "Promotion zone" labelled divider in a ranked list: https://mobbin.com/screens/5966689f-bae2-476e-8afd-57402080775b
- Apple Sports table with a thin divider after the qualifying places: https://mobbin.com/screens/04b91d44-700e-43d8-a464-eb98a1a5733c
- Speak "Top 60% advance" line above the list: https://mobbin.com/screens/c62861ac-1d0a-41a6-a11c-9db644c4e1b6
- Beli reorder list (DESIGN.md §4.5): https://mobbin.com/screens/322011ec-1219-4c51-b66c-49bbe6acba54

Effort S (cut lines, comment line); M with the row track. Risk Low (the move rules do not change).

### 2.9 Rate and rubric `#/round/<id>/rank` with `ranks: 'off'`

Shots: [oo-rate-laptop-dark](events-review/oo-rate-laptop-dark.jpg), [di-rubric-laptop-dark](events-review/di-rubric-laptop-dark.jpg).

What is wrong today:

- **A 1-to-5 rating uses a − / number / + stepper.** DESIGN.md §4.6 says short scales use a row of buttons, and only wide ranges (70 to 100) use a stepper. It takes up to 4 taps to go from 1 to 5.
- The rubric is very tall: 5 steppers stacked per speaker, with an empty left half. Four speakers fill three screens.
- "Total – of 25" until every part is set. "Overall" is a part, but the total says "of 25", so it is not clear whether Overall counts.

Change:

1. **Short scales (1 to 5, or word scales, as DESIGN.md §4.6 says): a row of buttons**, chosen one filled solid `--text`. Words at the ends where the profile gives them. Wide ranges keep the stepper. The change lives in `score-view.js` only, which already has word buttons and the stepper.
2. **Rubric as a compact grid**: one row per criterion, the button row on the right, the speaker's code, name and time in a column on the left (on a phone, above the grid). Total live as "16 of 25 so far (4 of 5 parts)".
3. Say which parts count in the total, from the profile.

Mobbin:
- 15Five 1 to 5 boxes with a word under each (DESIGN.md §4.6): https://mobbin.com/screens/9e2a6d7a-a14d-494e-a6ab-5b303a104b47
- OKX one-row 1 to 7 segmented scale: https://mobbin.com/screens/017b750e-eb44-4bca-a63b-64b3d083a2dd
- Upwork: several criteria, one compact row each, "Total score" under them: https://mobbin.com/screens/e223b30b-8a67-4b63-bb14-ad750fdff69c
- Zoom survey 0 to 10 button row: https://mobbin.com/screens/4f6c4408-9ced-4b6c-ac2c-dc26bbdb7ca3

Effort S. Risk Med (a control changes how it works; keep the number keys and arrow keys working the same).

### 2.10 Review and copy `#/round/<id>/review`

Shots: [hi-review-laptop-dark](events-review/hi-review-laptop-dark.jpg), [oo-review-laptop-dark](events-review/oo-review-laptop-dark.jpg), [poi-review-laptop-dark](events-review/poi-review-laptop-dark.jpg).

What is good: two stages (ranks first, then comments), a checklist header, "Copy comment" per card.

What is wrong today:

- The ranks table spreads 3 short columns over 720 px. "Over time: Yes" is plain text, the same as "No".
- "Copy ranks" sits under the table; "Copy all" and "Print / PDF" float at the right. Three copy actions, three places.
- **Comments only** (POI): the page still shows "1. Ranks" with a sentence that there are none, a "Rank order" toggle, and the "Says why this rank" check on each card. None of these apply.
- The critique checklist leaves "Names one thing to work on" open for "Make the cutting tell a clearer, complete story." (also noted in EVENTS-VISUAL-DEPTH.md §3; still open).

Change:

1. **The ranks block as a ballot preview**: a narrow card shaped like the online ballot (code, rank, and "Over time" as an `Over grace` pill only when true). "Copy ranks" in the card's header. The state pill ("Ranks not sent" → "Ranks copied") sits in the same header.
2. "Copy all" and "Print / PDF" go in one toolbar row with the state checklist.
3. Comments only: hide the Ranks section, the order toggle, and the rank check.
4. Events owner: check the critique rule for "to work on" phrasing (§5).

Mobbin:
- Klaviyo review list with per-item status (EVENTS-VISUAL-DEPTH.md §6): https://mobbin.com/screens/02359910-64f7-4f23-8280-f1bf18c8e95f
- Airbnb submit page with a preview card: https://mobbin.com/screens/b580aefb-dca5-4149-b855-1df9efcfe603
- Rows with "Copy" then "Copied" (DESIGN.md §4.7): https://mobbin.com/screens/11032f4e-5466-4e22-af72-585743b8c3d6

Effort S. Risk Low.

### 2.11 History `#/history`

Shot: [history-laptop-dark](events-review/history-laptop-dark.jpg).

What is wrong today:

- "Delete" is bold text on every row, at the same weight as the links. It is the loudest word in the table.
- State is plain text ("Judging", "Ranking", "Copied"). The "Comments open" column is empty on every row.
- Round and event are underlined links; the row itself is not a target.

Change:

1. Whole row opens the round. "Delete" moves into a "⋯" row menu (Undo toast stays).
2. State as the same pills My day uses. Drop the "Comments open" column; show "Comments open" as a second pill only when true.

Mobbin: Todoist row menu (2.1); Cloaked table with status pills per row: https://mobbin.com/screens/6bda4a8f-7556-4cec-800a-cba28fff6f3c

Effort S. Risk Low.

### 2.12 Type page (Guide and Rules) `#/type/<event>`

Shot: [type-hi-laptop-dark](events-review/type-hi-laptop-dark.jpg).

What is good: plain-word guide, the facts table, rule checks, questions for comments.

What is wrong today: the "HI" pill floats alone at the far right of the title. The page is a long single card; the Rules card starts below the fold. There is no "Start a round" from here.

Change: put the pill before the title (as in the room). Add one primary button "Start an HI round". Show the time as the D2 track at small size in the facts table (limit, grace), so the guide and the timer look the same.

Effort S. Risk Low.

### 2.13 Command palette (⌘K)

Shot: [palette-laptop-dark](events-review/palette-laptop-dark.jpg).

What is wrong today: the groups repeat ("Go to", "New", "Go to", "New"), because the Congress rows were added after the first groups (`palette.js` lines 18 to 24). Open rounds sit far below the event rows.

Change: group rows once, in a fixed order: Rounds today (with room and state on the right), Go to, New, Guide. Rounds today first, because "Open HI R2" is the common task mid-day.

Mobbin: Amie palette grouped by "Today / Tomorrow" with the time at the right of each row: https://mobbin.com/screens/04ef10fc-96d8-4911-8702-668de1e06021

Effort S. Risk Low.

### 2.14 Settings `#/settings`

Shots: [settings-laptop-dark](events-review/settings-laptop-dark.jpg), [settings-phone-dark](events-review/settings-phone-dark.jpg).

No major problem found. One long page; a short jump list at the top ("Ranks due · Extemp draw gap · Data · AI") would help on a phone. Effort S. Risk Low. Not in the top 10.

### 2.15 Congress: chambers and new chamber `#/chamber`, `#/chamber/new`

Shots: [chamber-list-laptop-dark](events-review/chamber-list-laptop-dark.jpg), [chamber-new-laptop-dark](events-review/chamber-new-laptop-dark.jpg).

What is wrong today:

- On "New Congress chamber", the House and Senate radios sit above their labels, not beside them. "Role" has a label but no control; the next line reads "Scorer(parliamentarian tools come later)" with no space.
- The picker already has a Congress section that links to a new chamber (`picker-screen.js`). A Congress path from My day was not checked in this pass.

Change:

1. Use a two-option segmented control for House / Senate. Show Role as a fixed line: "Role: Scorer (parliamentarian tools come later)".
2. Check that My day reaches Congress; add a path if it does not.

The session screens (log, PO hours, rank, review) were not shot: the chamber needs a paste and a docket through its own form, and the local server stalled first. A follow-up pass should cover them.

Effort S. Risk Low.

## 3. Top 10, ranked

Ranked by value to a judge at a tournament, then by effort. "Decided" means the owner already chose it.

| # | Change | Screens | Why it matters | Effort | Risk mid-round |
|---|---|---|---|---|---|
| 1 | **Fix the phone room**: no sideways scroll, piece fields collapse under the timer, sticky compact timer bar (OD1) | Room, all families | Most judges hold a phone. Today the page slides sideways and the time leaves the screen while they write. | S + M | Med |
| 2 | **Signal track on the timer** (D2-A, decided), with the prep segment for IMP and Pro/Con segments for PCC that replace the extra pills | Room F1–F4 | Makes the event's own rules visible for all 10 minutes; merges three PCC controls into one | M | Low |
| 3 | **Mini time track on roster and rank rows** (D3-A, decided) | Room roster, Rank | An over-grace speech stops looking the same as a 7:30 speech | M | Low |
| 4 | **My day: "Up next" card, quiet rows, rare actions in "⋯", ranks-due pill in words**; fix "Room Room" (OD2) | My day | The home must answer "which room now?" in one glance; "Cancel round" stops sitting next to "Open" | M | Low |
| 5 | **Rate and rubric as button rows**, compact rubric grid, live total | Rate, Rubric | Follows our own spec (DESIGN.md §4.6); 1 tap instead of up to 4; rubric fits one screen per 2 speakers | S | Med |
| 6 | **Rules as places on the rank board**: top-N cut line, "Rank 1 needs a speaker inside grace" line, one comment line per row | Rank | The rule is seen before a refused move, and the judge remembers who was who without going back | S | Low |
| 7 | **Review as a ballot preview**; one copy toolbar; comments-only hides rank parts | Review | The step the tab room waits on; fewer wrong copies | S | Low |
| 8 | **Extemp and impromptu: question or topic as a quote line on top and in the roster**; elim facts as pills; cross-ex opens after the speech | Room F2, F3 | The question is what extemp judges compare at rank time | S | Med |
| 9 | **Setup: live preview beside the paste**, fix the Event field overlap, rare fields under a disclosure | New room | Faster, safer setup; shows parse mistakes before the round starts | M | Low |
| 10 | **Paper cuts**: palette grouping, History row menu and pills, picker "Guide" button and chips, Congress setup layout | Palette, History, Picker, Congress | Each is small; together they remove the "unfinished" feel | S | Low |

Suggested build order: 1 (overflow fix first, as a bug), then 5, 6, 7 and 10 as one small step (all S, low risk), then 2 and 3 together (they share the track code and its tests), then 4, 8, 9.

Mockups (brief step 4, optional) were not made in this pass. If the owner wants them, the top 3 (sticky phone timer, signal track, My day "Up next") are the ones to draw.

## 4. Owner decisions

### OD1. How the phone room keeps the time on screen while the judge writes

- **A. A sticky compact bar (recommended).** When the big timer scrolls away, a slim bar pins to the top: stage word, time, thin signal track, Start/Stop. Same colors and words as the big card. Pattern: Jomo, Ladder and Tiimo live bars (§2.4).
- B. Keep the timer in the page, and open the comment box as a full-height sheet over the lower half. The timer stays in view above the sheet, but the judge loses the chips and rule checks while writing.

Pick **A**. It keeps every part of the room where it is and adds one control that judges already know from phone timers. Risk: a second Start/Stop must share the same driver and the Space key; test both.

### OD2. How My day shows many rounds

- **A. One "Up next" card, the rest as compact rows (recommended).** The next or current round gets a large card with one primary button. Others are one-line rows with a status pill and a "⋯" menu. Pattern: Zocdoc "Up next" (§2.1).
- B. Keep equal cards, and only move Change room and Cancel round into "⋯".

Pick **A**. With 3 flights and 2 events, B still leaves a wall of 6 equal cards. A answers "which room now?" at a glance.

### OD3. The Speech Events mark in the app header (a brand rule change)

This decision changes a stated rule. DESIGN.md §3 and BRAND.md §7 say the brand tints stay in the mark, logo, icon and marketing, and that no product color is used for app chrome. Option A puts the mark in the app header. If the owner picks A, both files need an edit first.

- **A. The green Speech Events mark next to "Tabula Speech Events" in the header, and nowhere else in the chrome (recommended).** It uses the locked green (`brand-color-families`) as a mark only. Buttons, menus and pills stay grey (DESIGN.md §1, §3).
- B. Keep the text-only header (or a grey mark).

Pick **A**. It is the cheapest visual lift in the app, it matches the Debate header which shows its own mark, and the mark carries no state, so color still never carries meaning. Cost: an edit to DESIGN.md §3 and BRAND.md §7 to allow the mark in the header and nowhere else in the chrome.

## 5. Bugs and spec gaps found on the way (for the events owner)

These are not design choices. Each needs a fix and a test with a WHY header.

1. **Phone room is wider than the screen** (the full-page capture was 408 CSS px wide on a 390 px viewport; not measured with `scrollWidth`). See `hi-room-phone-dark.jpg`: chips and text areas cut off at the right.
2. **Setup Event select overlaps the Rules select** at laptop width (`setup-laptop-dark.jpg`).
3. **"Room Room 214"** on My day cards (`myday-screen.js` line 34 adds "Room " to a typed label).
4. **Palette groups repeat** ("Go to", "New" twice), because `palette.js` adds the Congress rows between other groups and does not sort by group.
5. **Rate screen uses a stepper for a 1 to 5 scale**, against DESIGN.md §4.6 ("Short scales: a row of buttons").
6. **Comments-only review** still shows the Ranks section, the "Rank order" toggle and the "Says why this rank" check.
7. **Congress setup layout**: radio buttons above their labels; "Role" with no control; missing space in "Scorer(parliamentarian".
8. **Critique check** leaves "Names one thing to work on" open for a "Make the … clearer" sentence (still open from EVENTS-VISUAL-DEPTH.md §3).
9. To check, not confirmed as a bug: on My day, the OO round with `state: 'done'` (copied) showed "Judging" in "Now". The seed set the card status by hand, so this may be the seed. Write a failing test first: `cardStatus(card, round)` (`cards.js` line 102) with a copied round and a card that says `judging`.

## 6. Not covered in this pass

- Congress session screens (log, PO hours, rank, review). Reason in §2.15.
- Light theme on the phone for about half the screens (the local server stalled). Dark and light laptop shots were enough to judge contrast.
- Keyboard and screen-reader walk. The changes above keep the existing keys; each build step must run the axe and keyboard checks in DESIGN.md §6.
