# Speech Events: design review of the Congress screens

Status: review done, fixes in the same change. Congress now shows a "Beta" tag.

This file covers the Congress scorer screens that the earlier screen review left out (`docs/design/EVENTS-DESIGN-REVIEW.md` §2.15 says the session screens were not shot). It has:

1. How we checked (§1).
2. The findings, as one table (§2).
3. The open rule facts and what the app does with them now (§3).
4. What is left for later (§4).
5. The accessibility and keyboard pass (§5).

Rules this review keeps: calm grey chrome, color only for data and status, a word with every color, no stripes (`docs/events/DESIGN.md` §1). The beta tag is a plain outlined pill in words, with no color.

## 1. Method

- The app ran from a local static server at the repo root, opened at `/events/`, and was driven with Playwright and Chromium.
- Sizes: phone 390 × 844 and laptop 1280 × 800. Light and dark for each. Screenshots at device scale 1, kept out of the repo.
- Path: New chamber (paste of 29 codes, 5 docket items, NSDA district rules) → Log → open a speech → Next speech picker → timer → Rank (locked, then filled) → PO hour scores → Review → chamber overview → chamber list.
- Long session: the saved session was set to 3 hours 5 minutes in, with 45 speeches across 29 legislators, one PO term that ran the whole time (hour 1 scored, hours 2 and 3 due), one absent and one left.
- Checked on each screen: lay-judge clarity, wrong or confusing numbers, tap targets, long chambers, data-loss risks, copy correctness, keyboard basics, sideways scroll (page width against the viewport), and page errors.
- No page errors or console errors at any size. No sideways scroll before the fixes. One fix added a 1 px overflow on the phone Rank screen; it was caught on the second pass and fixed (row F15).
- A 30-row chamber cannot start under NSDA district: the profile allows 29 and setup says "Remove 1." That is the rule working, so the long test used 29.

## 2. Findings

Severity: **High** means a judge can hand in a wrong ballot or lose work. **Medium** means a lay judge is likely to be confused or slowed down. **Low** means polish.

| # | Screen | Problem | Severity | Fix | State |
|---|---|---|---|---|---|
| F1 | Setup, PO card, Rank | The district PO range (4 to 8, or 1 to 8) and the NSDA rank pool are not settled in the sources. The app named them as "Not verified", but the judge could not change them, so the app decided them quietly. | High | Setup shows a box: "Not settled in the rules we found. Check your tournament's rule." with a choice for "PO points for each full hour" and "Who can be ranked". The rules' value comes first. The chamber keeps the pick. The overview lists what was set. The PO card and Rank repeat "Check your tournament's rule." | Fixed |
| F2 | Overview, Rank | Status (present, absent, left) lives on the chamber. Marking a student absent before session 2 also took them out of session 1's rank pool, which emptied a slot on a ballot already handed in. | High | A session is handed in once its ranks are copied or it is marked submitted; then it keeps a copy of its statuses. Before a status change on the overview, every earlier session and a handed-in latest session take that copy too, as does starting a new session. Taking back "submitted" keeps the copy if the ranks were copied or a status changed since. Rank, the grid, the speaker picker, the PO list and the session summary read the copy. A latest session that is not handed in still follows the chamber, so a student who leaves mid-session drops out of it. The overview note says this. One limit: if a judge marks someone absent before copying the ranks of the open session, that session follows the change (it is still in progress). | Fixed |
| F3 | Log picker | Typing "1" and pressing Enter gave the floor to the first of many codes that contain a 1. The wrong student got the speech. | High | Enter takes only an exact code, or the only match. Otherwise it says "More than one code matches." A help line under the box says so. | Fixed |
| F4 | Rank, Review | A speech with no points looked like 0 points ("1 · 0" on the grid, "0 points" on Rank). Review copied "No points" with no warning, so a ballot could go in with a missing score. | High | Rank and Review name each speech with no points ("6 speeches have no points yet: 184 (speech 1), …"), with "Back to Log". The grid and the Rank pool say "1 not scored". This is a warning, not a block. A speech past the scored-speech cap, a "Not on the floor" speech (0 points by rule) and the live speech are not listed. | Fixed |
| F5 | Log grid | The numbers on each row ("2 · 11 · avg 5.5") had no words. A lay judge could not tell the count from the total. | Medium | Each row reads "2 speeches · 11 points · avg 5.5". The heading says "tap a box to open that speech". | Fixed |
| F6 | Rank | A tie in points printed one line for each pair. Six tied students gave 15 yellow lines that pushed the pool off a phone screen. | Medium | One line for each group: "100, 115, 139, 154, 163 and 178 have the same points." The help line already says "Points do not limit the order." | Fixed |
| F7 | Review | Each speech card printed its title line twice (card head, then the same line in the text). A 46-speech Review was about 9,700 px tall on a laptop. | Medium | The card shows the title once, then the time and comment. Copy still puts the title line first, then the notes. | Fixed |
| F8 | Overview | "Start session 2" was the one big button while session 1 was still open. One stray tap made a new ballot mid-session. | Medium | Until the latest session is marked submitted, the primary is "Open session N"; "Start session N+1" is a plain button beside it. | Fixed |
| F9 | Log | "Next item" marks the bill as debated for the whole chamber with one tap, with no way back. | Medium | A toast with Undo opens that item again and puts it back under debate. Other docket items are left alone. | Fixed |
| F10 | PO card | "End term" by mistake restarts the PO's hour count on the next term. No way back. | Medium | A toast with Undo opens the term again and keeps any hour score given since. If a new term has started, it says it cannot undo. | Fixed |
| F11 | Log grid | The speech boxes were 36 px, under the 44 px tap target, on a screen the judge taps all session. | Medium | Boxes are 44 px. | Fixed |
| F12 | Picker | "175 · 1": the small number had no meaning on screen. | Low | Help line: "Fewest speeches first. The small number is how many times each one has spoken." Each button's spoken name says "1 speech". | Fixed |
| F13 | All Congress screens | Nothing told the judge that Congress scoring is new. | Medium | A small "Beta" tag on the Congress row of the event picker, the chamber list, New chamber, the chamber overview and the session bar. The list, New chamber and Review add: "Congress scoring is new. Check the totals before you hand in your ballot." | Fixed |
| F14 | Setup note | "Not verified … Check with the tab room." A lay judge may not know who the tab room is. | Low | "Check your tournament's rule." | Fixed |
| F15 | Rank, phone | After F4, a long stats line ("2 speeches · 6 points · 1 not scored · PO 7, 6, 6") did not wrap and pushed the page 1 px wide. | Low | The stats on a pool row wrap. | Fixed |
| F16 | Log, laptop | Under "Next speech" the left column is empty while the PO card is tall. | Low | Not changed. A layout pass with the sticky timer work (`docs/design/EVENTS-DESIGN-REVIEW.md` §2.4) can use the space. | Open |
| F17 | Log grid | The PO's hour scores do not show on the PO's own grid row (they show on Rank). | Low | Not changed. | Open |
| F18 | Log, phone | In a 3-hour session the page is long: the grid starts under the PO card. Rank and Review are one tap away in the step bar, so this is not a data risk. | Low | Not changed. | Open |
| F19 | Keyboard | Every control is a real button, link or select, so Tab and Enter work. The picker search takes Enter (F3). There are no Congress shortcut keys (`workspace.js keys()`), so a laptop judge has no one-key "Next speech". | Low | Not changed. Shortcuts belong in the shared key registry, outside these files. | Open |

What works well and should stay:

- The PO lock on Rank ("Score the PO's 2nd hour first (184).") is clear and has a way back.
- The timer card, the 30-second question blocks and the "Speech removed. Undo" toast.
- Each action saves the whole Congress value at once, so a reload in hour 3 kept every speech in the test.
- The setup preview and its "Check these" lines (for example "30 legislators. NSDA district allows 29. Remove 1.").

## 3. Open rule facts: what the app does now

The defaults are 4 to 8 for each full hour for the district PO, and every present legislator for the NSDA rank pool. The app shows that value first, says "Check your tournament's rule", and lets the judge change it at setup. The chamber keeps the pick for every session.

| Fact | Rules' value in the app | Other reading | What the judge sees |
|---|---|---|---|
| NSDA district PO points for each full hour | 4 to 8 (District Congress Officials) | 1 to 8 (the same manual's merit-points line) | Setup: "PO points for each full hour: 4 to 8 / 1 to 8". The PO card buttons follow the pick and say "Check your tournament's rule." |
| NSDA rank pool (district and Nationals; also TFA State, NCFL and CHSSA, where it is marked) | Every present legislator | Only those who spoke or presided (the Last Chance and older Nationals scorer sheets) | Setup: "Who can be ranked". Rank lists the pool it uses and says "Check your tournament's rule." |
| UIL PO points | 2 to 6 (the PO form) | 1 to 6 (the speech scale; the rules say "up to six") | The same PO choice as NSDA district. |

A profile where the source is clear (for example Last Chance: PO 1 to 8, spoke-or-presided) shows no choice.

## 4. Later

- F16 to F19 above.
- A second pass on a slow phone for a 3-hour session (CONGRESS.md §10 item 10).
- The parliamentarian screens (CONGRESS.md §4.5) are not built, so they are not reviewed.

## 5. Accessibility

An automated check with axe, then a walk with the keyboard only. Fixes are in the same change.

### 5.1 Method

- axe-core **4.10.2** (exact version), installed in a scratch folder outside the repo. It is not a dependency and the app never loads it.
- The repo root ran on a local static server; Playwright drove the Chromium that is already on the machine and opened `/events/`. Playwright's clock moved time forward for the timer and the PO hour.
- The script, kept outside the repo, walks one chamber and injects axe at each stop: list → New chamber (empty, then filled with the NSDA district rules, so the PO range and "Who can be ranked" choices with "Check your tournament's rule." show) → Log (empty) → speaker picker → speech card (timer, questions, ended and scored) → 3 speeches → PO chooser → Rank with the PO lock → PO hour due → hour scored → "Next item" toast with Undo → "PO term ended" toast with Undo → Rank (empty, then top 8) → Review → Review after Copy ranks and Mark submitted (toast with Undo) → chamber overview → list. Then a 30-row chamber (NSDA Last Chance allows 30): Log and Rank.
- 22 screen states, each in light and dark, on a phone (390 × 844) and a laptop (1366 × 768): 88 axe runs. axe's default rules; every impact recorded.
- Congress has no dialogs of its own. Its pop-ups are the shared toasts with Undo, which were checked as part of each screen.

### 5.2 axe results

| Impact | Before | After | Where |
|---|---|---|---|
| Critical | 0 | 0 | |
| Serious | 0 | 0 | Color contrast passed in light and dark on every screen. |
| Moderate | 1 rule | 1 rule | `region`: the toast text sits outside a page landmark. The toast box is shared page markup, not Congress (A5). |
| Minor | 1 rule | 0 | `aria-allowed-role`: the speaker picker and the PO chooser put `role="listitem"` on buttons (A1, fixed). |

No page errors. No sideways scroll on the phone with 30 legislators on Rank.

### 5.3 Keyboard walk

One chamber, keyboard only, on a laptop in light and dark: setup → 3 speeches (picker by typing the code and pressing Enter) → PO term and its first hour score → Next item → Rank top 8 → Review → Copy ranks.

- Order: the back link and step bar, then the page title, then the page from top to bottom. On Log: Next item, Next speech (or the speech card), the PO card, then the chamber grid.
- After each action the focus lands on the next useful control: a pick goes to "Start questions", that goes to "End speech", that goes to the comment box, "Done" goes back to "Next speech", a rank goes to the same pool row, Copy stays on its button.
- Every stop showed a focus ring in light and dark.
- No trap: Tab leaves the page after the last control, and the Undo toast can be reached.
- Esc: see A4. The shared Esc stack (open shared dialogs) still wins over Congress.

Keys that work now:

| Key | Where | What it does |
|---|---|---|
| Tab, Shift+Tab | everywhere | Next or last control |
| Enter, Space | any button | Press it |
| Enter | speaker search | Gives the floor to the exact code, or the only match. With more than one match it says "More than one code matches." |
| Esc | speaker search | Closes the picker, like Cancel; the focus goes back to "Next speech" |
| Arrow keys | Chamber (House or Senate), the selects | Change the choice |

### 5.4 Fixes

| # | Problem | Fix | Test |
|---|---|---|---|
| A1 | The speaker picker and the PO chooser buttons had `role="listitem"`, so a screen reader heard a list row, not a button (axe minor). | Real lists: each button sits in its own list item. | `congress-a11y.test.mjs` |
| A2 | Review's buttons were all named "Copy", so a screen-reader judge could not tell which speech they were copying. | Each button's name is "Copy" plus the card title, for example "Copy 101 · Bill · Aff · Authorship · 6 points". The title is still written once on the page. | `congress-a11y.test.mjs` |
| A3 | After a PO hour score, and when a full PO hour came up, the focus jumped to the page title, so the judge had to Tab through the log again. When the control to focus was gone, the focus went nowhere. | A score puts the focus on that hour's "Change" button; "Change" puts it on the hour's first score button. The hour redraw keeps the focus on the same control (or the page title if that control has no place in the redraw). A focus target that is gone falls back to the page title. | `congress-a11y.test.mjs` |
| A4 | Esc did nothing in the speaker picker. | Esc in the speaker search closes the picker. | `congress-a11y.test.mjs` |

### 5.5 Open

- A5. The toast box is outside a page landmark (axe moderate `region`). It is shared page markup (`events/index.html`), so a change there belongs to the shared screens, not to Congress.
- A6. The toast's Undo is the last Tab stop on the page. In a 30-row chamber that is far from "Next item" or "End term". Esc does not close a toast. Both are shared toast behaviour.
- A7. Esc does not close the PO chooser or the speech card. Not changed: the speech card holds the comment box, and Esc there needs a rule for unsaved text.
- A8. Shortcut keys a laptop judge would want, which need the shared key registry (not added here): Next speech, Start questions, End speech, points by number keys, Done, Undo for the last toast, Next item. Same as F19.
- A9. Screen reader on real devices (VoiceOver on iPhone and Mac, TalkBack on Android, NVDA on Windows): waiting for real-device testers.
