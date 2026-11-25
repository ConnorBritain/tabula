# Tabula Speech Events: design (draft 1)

Status: plan for owner approval, 2026-11-20. No code changed.

This file has two parts:

1. **The shared design philosophy** with Tabula Debate (what stays the same).
2. **The new components** Speech Events needs, each backed by real app references from Mobbin.

Mobbin links need a signed-in Mobbin account. The full reference list (32 searches, about 60 screens) is in the shared notes folder: `side-session-notes/local_8e1f7a27-…/speech-events/mobbin-references.md`. Mobbin had no screens for some apps we asked about (SpeedGrader, Gradescope, Google Classroom, ClassDojo, Keynote presenter view, Toastmasters timers, Speeko, Grammarly, Gmail, Apple Writing Tools). Where that happened, the closest real pattern is used.

Related: `docs/design/SPEC.md` Part 2 (tokens), `docs/design/NO-STRIPES.md`, `docs/design/AI-POLICY.md` §3, [SHARED-VS-NEW.md](SHARED-VS-NEW.md) §5 (primitives N1–N14).

## 1. Shared philosophy (same as Tabula Debate)

These rules come over unchanged. They are already tested in debate.

1. **Calm, neutral chrome.** Black, white and gray. Buttons and menus never use a brand color.
2. **Color only for data and status.** Status colors are `--error` (errors and over time), `--caution` (warnings, the last stretch), `--ok` (done). Color never carries meaning alone: a word or icon always goes with it.
3. **No stripes.** No left, right, top or bottom accent bars, no bar under a tab, no one-sided inset shadow. Show state with a fill, a full outline, or a pill with a word. The `no-stripes.test.mjs` test runs on `events/` too.
4. **Nothing "live" is red.** A running timer is not red.
5. **16 px forms and reading text.** No text under 13 px. The clock uses `--font-display`.
6. **One dialog, one toast, one tooltip.** Every destructive action has Undo in a toast.
7. **Removed means gone** for AI (`docs/design/AI-POLICY.md` §3). With AI off, no greyed button, no lock, no hole.
8. **Offline first.** No spinner blocks the room.
9. **Plain copy.** Short words. Name the action ("Copy comment", "Start", "Next speaker"). No vendor names.
10. **Keyboard first on laptop, touch first on phone.** One key registry.

## 2. What is different in feel

- **Debate is dense; Speech Events is roomy.** A debate judge flows 7 columns. A speech judge watches a person and writes a paragraph. So: fewer controls on screen, bigger type for the timer, bigger writing box.
- **The judge's eyes are on the speaker.** The timer must be readable in a glance from a hand-held phone or a laptop at arm's length. Every main action is one tap or one key.
- **Lay judges are first.** The rules of the event show where the judge needs them (time limit on the timer, rule checks on the comment sheet, the over-grace rule on the Rank screen), not in a help page.
- **The writing is for a teenager.** The comment box nudges toward kind, specific, useful feedback (§4.4).

## 3. Color for Speech Events

- **The two Speech Events greens stay in the mark** (logo, app icon, marketing): deep `#1e7a55` and light `#5ec796`, locked by the owner on 2026-11-23 (they replace the earlier sage drafts).
- **One exception, the app header (owner decision OD3 A, 2026-11-24, `docs/design/EVENTS-DESIGN-REVIEW.md` §4):** the green Speech Events mark sits next to "Tabula Speech Events" in the header bar, and nowhere else in the chrome. It is a mark only: it never changes with state, it is never a button, pill, outline or fill, and it carries no meaning. Every other part of the chrome stays black, white and gray (a brand color never carries meaning inside an app).
- **No side colors.** Speech has no Aff and Neg, so `--aff` and `--neg` are not loaded in `events/`.
- **Rust stays out of the app** (it is too close to `--error`).
- **Timer stage colors use the existing status tokens only:**

| Stage | Fill of the timer card | Word on the card |
|---|---|---|
| Ready | `--panel` | "Ready" |
| Speaking, before the last minute | `--panel` | "Speaking" |
| Last minute (or the event's last signal) | `--panel`, with a full 2 px `--text` outline | "1 minute left" |
| Past the limit, inside grace | `--caution-tint` | "Grace +0:12" |
| Past grace | `--error-tint` | "Over grace +0:41" |
| Stopped | `--sunk` | "Done 9:47" |

No new color tokens are needed. That keeps the WCAG contrast pairs already tested in `tokens.test.js`.

## 4. New components

Each component lists the decision, why, and the Mobbin references behind it.

### 4.1 Roster (primitive N7)

**Decision:** a plain list, one row per entry, in speaking order. Each row: the code ("A12"), an optional name, time used, and one status pill **in words**: "Waiting", "Speaking" (solid `--text` fill, `--on-accent` text), "Done" (gray full outline), "No show". The current row gets a `--sunk` fill, not a bar.

- **Laptop and iPad:** the roster is a left pane (about 260 px). The selected entry fills the main pane.
- **Phone:** the roster is a row of code pills across the top (scrolls sideways), plus a "Roster" sheet with the full rows.
- **Late arrivals:** drag a row, or use "Move up / Move down" in the row menu. Row menu also has "Mark no show" and "Remove" (with Undo).
- **Keyboard:** number keys 1–8 pick an entry.
- **Time shape (D3-A, owner decision 2026-11-23; built 2026-11-24):** under the name, each row with time shows a mini time track: the same zones as the timer's signal track (speech, grace, over), the speaker's time as a fill and a dot. An over-grace row also says "Over grace" in a pill. The time stays as text, so colour never carries the meaning alone. The rank board rows show the same track. A speaking row shows no time (the timer shows it). Extemp and impromptu rows show the first words of the question or topic.

References:
- Luma guest check-in: status pill per row with counts per status. https://mobbin.com/screens/e02a3aa3-e02c-4019-82cf-163fa8b1eafd
- GoPro Quik queue: text status per row ("Waiting", "Complete"), a "2/4" header. https://mobbin.com/screens/d9d1710a-5585-42da-ae77-c4811a8ed7b0
- Meetup attendee list: row menu with "Mark as no show". https://mobbin.com/screens/8694a5dc-5a53-4188-a8a3-d51d8b461c9a
- SchoolAI teacher view: click a student to open a right panel. https://mobbin.com/screens/2b147162-dcec-40bf-8f1b-42864f4ccba2

### 4.2 Timer face and time signals (primitives N4, N5, N6)

**Decision:** very large digits with one word label above them. The stage shows as a fill of the whole timer card plus a word (§3 table). Before the limit, the timer counts **down** ("2:14 left"). After the limit, it counts **up** with a plus sign ("+0:12"). One big Start / Stop button. "Space" starts and stops (the debate Space rule).

- **Signal plan:** the event file and the rules profile set the signal points (for example 5, 4, 3, 2, 1 min, 30 s, 0, grace end). At each point, the judge's screen shows the signal for 3 seconds in a small chip ("Show 2"), so the judge knows to raise a card or fingers. Optional soft vibration on phones.
- **Correct the time:** "−10 s / +10 s" buttons and a "Set time" field, for a late start. A correction never clears a sticky "over grace" flag by itself; the judge must tap "Clear over grace" and confirm.
- **Signal track (D2-A, owner decision 2026-11-23; built 2026-11-24):** under the digits, one bordered data bar: speech (neutral), grace (caution tint), over (error tint), a 1 px tick at each signal point with short labels (whole minutes and 0), and an outlined "now" dot.
- **In-room prep (impromptu):** the track starts with a prep piece, and the phase row "Prep" then "Speech" sits inside the track's box (one phase control). The judge taps "Speech started". Both share one limit when the event says so. Pro Con Challenge uses the same track with a Pro piece and a Con piece.
- **Phone (OD1 A, 2026-11-24):** when the big card scrolls away, a compact bar pins to the top: stage word, time, mini track, the main button and, after a stop, "Next speaker". It is a second render of the same timer state: no second clock, and Space stays the one start and stop key.

**Speaker view** (off by default): a full-screen view with only the stage word and the time, in the largest size that fits. No speaker code, no comments. Tap anywhere or press Esc to leave. On a laptop, this view can open in a second window.

References:
- Oura full-screen timer: small label, very large digits, nothing else. https://mobbin.com/screens/d4f18703-69ba-4cce-bdb3-48c0c037a326
- Runbuds: the whole screen fill is the signal. https://mobbin.com/screens/a2dcc17c-0b53-43d2-8128-752904a1182b
- (Not Boring) Timer: counts up after zero with a plus sign. https://mobbin.com/screens/a0d8fa10-b009-4a06-8e74-497f04a1162b
- Gymshark rest timer: "−10s / +10s" adjust buttons. https://mobbin.com/screens/f4cdbd47-9666-4c67-ae63-c75f2094254d
- Canva presenter view: elapsed time with pause and reset in a presenter frame. https://mobbin.com/screens/e97c42f8-7216-4207-b545-366a98bbb90b

### 4.3 Comment sheet (primitive N10)

**Decision:** one large 16 px writing box for the judge's notes, with two chip groups under the timer: **"Strengths"** and **"To work on"**. A chip tap inserts a short sentence at the cursor that the judge can edit. Chips come from the event file (interp: characters, blocking, cut, intro; oratory: thesis, structure, evidence, appeal; extemp: answered the question, sources, analysis, organization). A small **rule checks** row shows only the checks for this event ("Manuscript used", "Quote limit", "Props"), each a two-state pill: "OK" or "Flag".

- The box autosaves. No Save button.
- A separate one-line **"Private note"** field (never copied to the ballot) for the judge's own memory ("blue jacket, 3rd speaker").

References:
- Skillshare review: two chip groups, "What did you like?" and "What could be improved?", then a free box. https://mobbin.com/screens/4451a1df-fd23-444e-a754-5ed798ec42bd
- Tabby: chips above a text box; selected chip gets a solid fill. https://mobbin.com/screens/7b8fd721-ac7f-47c6-b226-af05beedfe54
- Waymo: chips with a full outline when selected. https://mobbin.com/screens/7c6ac66b-81b0-469a-97b2-39099ad26f39
- Grain scorecard: one row per criterion with a note under each. https://mobbin.com/screens/935c8872-3616-4fff-aec9-89d327f23b7c

### 4.4 Critique helper for students (primitive N11)

**Decision:** on the Review screen, each comment box shows a short, quiet checklist under it, in words, with no score: "Names one strength", "Names one thing to work on", "Says why this rank". It ticks itself from simple text checks. It never blocks copying.

A one-line reminder on the Rank screen, from the rules profile: "Judge the performance, not the person." The exact bias-awareness wording is the tournament's, not ours.

References:
- Uxcel review page: a feedback box with a character count and a "Review tips" link. https://mobbin.com/screens/80f84b05-ec88-4f77-a653-4ff007d3a5d1
- Skillshare (above): the strengths / to-work-on split that the checklist mirrors.

### 4.5 Rank board (primitive N8)

**Decision:** a drag list that **always shows the live rank number** in front of each entry ("1", "2", …). Moving one entry shifts the others, so a tie cannot happen. Three ways to move, for access:

1. Drag (handle on the right).
2. "Tap in order" mode: tap entries one by one; each gets the next number.
3. Up and down buttons on each row (and Alt+Up / Alt+Down on the keyboard).

The start order is the speaking order, with a "Start from my notes" option off (no AI ranking, ever).

**Over-grace rule (NSDA):** an over-grace entry cannot sit at rank 1. If the judge drags it there, the move is refused: the entry returns to where it was, and a message says "A12 went over grace, so it can't be ranked 1st. Clear the over-grace flag on the timer if the time was wrong." Nothing moves silently. On a panel, a reminder says all judges must agree the speaker went over grace. The row shows an "Over grace" pill in words. Other profiles apply their own rule the same way.

References:
- Beli "Reorder list": rank number in front of each name, drag handle. https://mobbin.com/screens/322011ec-1219-4c51-b66c-49bbe6acba54
- Babbel tap-to-rank: each tap gives the next number badge. https://mobbin.com/screens/d78ed7b6-b6e0-456a-a2ff-2ef666665178
- Tally ranking question: up and down arrows per option. https://mobbin.com/screens/2c5daa88-ad4a-4fa5-a45a-861246eb9a2b
- Canva "Edit order": numbered circle per card; dragged card has a full outline (no stripe). https://mobbin.com/screens/64e94064-1c3a-4f2f-a65c-33d4544c0cf4

### 4.6 Rating entry (primitive N9)

**Decision:**

- **Short scales (1–5, or word scales):** a row of buttons; the chosen one has a solid `--text` fill. Words at the ends where they help.
- **Wide ranges (for example 70–100):** a number field with − and + buttons (the debate `stepPoints` stepper). Typing works. Out-of-range input shows an inline error in words.
- **No sliders.** They are slow to set to an exact number and poor on touch.
- If the profile's rank-rating rule is on, a row whose rating breaks rank order shows "Rating is higher than a better-ranked speaker" and a "Fix" button.

References:
- Superpower: rows of 1–5 square buttons, solid black when chosen. https://mobbin.com/screens/7b9efdc7-e1fd-4f28-9665-4a9761bd3db8
- 15Five: 1–5 boxes with a word under each value. https://mobbin.com/screens/9e2a6d7a-a14d-494e-a6ab-5b303a104b47
- BlaBlaCar: one big number with − and + buttons. https://mobbin.com/screens/2c5f10b6-da65-4ef6-9c22-92f09e8820ed
- GetYourGuide: compact steppers; minus goes gray at the limit. https://mobbin.com/screens/1653767b-9211-471d-b467-70b69def73c6

### 4.7 Review and copy (primitive N12)

**Two stages.** Tabroom and SpeechWire lock ranks when the judge submits, but keep comments open to edit until the tournament ends. The tab room wants ranks fast. So the Review screen starts with a compact **"Ranks to submit"** block: one line per entry (code, rank, rating, "Over time" yes or no) and one "Copy ranks" button. The comment cards come below, and the judge can finish them after the ranks are in. The room's state shows "Ranks sent, comments open" until all comments are copied.

**Decision for the comment cards:** one card per entry, in the order the online ballot lists them (speaking order by default; rank order as an option). Each card: code, rank, rating, comment, and a **"Copy comment"** button that turns into "Copied" with a check. An "Edit" pill on each card opens the comment. At the top: a checklist in words ("6 of 6 ranked", "6 of 6 comments", "Reason for rank written") and "Copy all" (one block, for paper or email). "Print / PDF" uses the shared print sheet.

References:
- Fresha pay-run summary: one row per person under a top row of totals. https://mobbin.com/screens/8cb51590-8635-4e42-9f3d-b4450fadad45
- Cash App "Confirm your info": an "Edit" pill on each row, one primary button. https://mobbin.com/screens/72e44691-f3f0-415d-bfb1-6cab65a4ceb8
- Rows: "Copy" outline buttons with a "Copied" confirmation. https://mobbin.com/screens/11032f4e-5466-4e22-af72-585743b8c3d6
- Deel "Review payroll package": a status pill and one primary action. https://mobbin.com/screens/b40eabc2-7df4-4356-8ed6-e60687aedaca

### 4.8 Room setup from pasted text (primitive N13)

**Decision:** a big text area ("Paste the room from Tabroom or SpeechWire, or type one code per line") and a **live preview** with one row per entry. Lines the parser is not sure about go under **"Check these"**. Parsing runs on the device. Then "Start room".

References:
- DoorDash "Type or copy a list": big text area with example lines. https://mobbin.com/screens/70b36167-34b3-4548-98df-d5ec91c0a070
- Clay import: input on the left, live preview table on the right. https://mobbin.com/screens/332d89e8-25a0-4228-98b7-9cd0ef69d512
- Attio import: unclear rows grouped under "Needs review". https://mobbin.com/screens/743c9394-4846-4d21-a8ab-c9ac8729ce60
- Splitwise: review each person with "Edit" and remove before adding. https://mobbin.com/screens/4c5c6d89-a7d8-4196-b15c-0db60d371788

### 4.9 "Clean up my comments" (AI, optional)

**Decision:** runs only on a tap, one entry at a time, on the Review screen. Two modes in a segmented control: **"Spelling only"** and **"Full clean-up"**. The judge's text shows above the result. Changes show as inline strike-through (removed) and plain marks (added), using the debate `wordDiff`. Buttons: **"Use this"**, **"Keep mine"**, **"Try again"**. Undo in a toast. One quiet line: "AI rewrote your words. Check them before you copy." With AI off by policy, none of this exists (§1 rule 7).

References:
- Telegram AI Editor: "Original" above "Result", one Apply button. https://mobbin.com/screens/a03c10da-4563-4593-80b5-88f14678944c
- X Proofread: deleted words struck through, "Insert" and regenerate. https://mobbin.com/screens/77285694-53ac-4a67-bb93-255832d50be2
- GoFundMe suggestions: "Enhanced" / "Spell check only" segmented control, "Use this story". https://mobbin.com/screens/ee4b5ef1-a4b8-4497-a9d2-5985d893abe1
- Square AI draft: a note that the text is AI-made and should be checked. https://mobbin.com/screens/4b0e8cdc-3203-4446-ad26-3931a11beca8

## 5. Screen layouts (summary)

| Screen | Laptop / iPad | Phone |
|---|---|---|
| Room | Left: roster. Center top: timer card. Center below: chips, rule checks, notes box. | Top: code pills. Timer card. Notes box below. Chips in a scroll row. |
| Rank | One list, full width, max 640 px. Ratings in a column on the right. | Same list; rating opens under the row. |
| Review | Cards in one column, max 720 px. | Same. |
| Speaker view | Full screen (or a second window). | Full screen, landscape if turned. |

## 6. Checks before build

- Axe and keyboard pass on every screen, light and dark (`docs/design/SPEC.md` §6.2 sizes).
- A 5-judge test with lay judges on a real 6-speaker practice room (the debate 5-judge test, SPEC §6.3, adapted).
- Screenshot review with AI off: no empty card, no lonely divider (AI-POLICY R5).
