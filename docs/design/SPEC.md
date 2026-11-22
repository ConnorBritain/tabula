# Tabula UI/UX spec (draft for owner approval)

**Status.** This is a draft. Nothing is built yet. I changed no repo file. Because this work was only reading and writing, I ran no gates. This spec merges the five slice drafts into one. A spec check against `docs/design/DECISIONS.md` and the code found some gaps, and this version fixes them. Where the drafts did not agree, I used DECISIONS.md (the owner's answers, called "Q" items, and defaults D1–D3). Where DECISIONS.md is silent, I picked one answer and wrote down why.

**How to read it**
- Each item gets one owner mark: **do now / do later / drop**.
- **[A]** marks a choice I made that DECISIONS.md does not cover. Part 5 lists the 12 that matter most. The smaller [A] marks are accepted unless you flag them.
- A **unit test** is a `node --test` test on a pure function. A pure function takes inputs and returns a value. It does not touch the page or the clock. These functions live in `logic.js`, or in the new `keys.js`.
- A **static test** is a `node --test` test that reads source files as text.
- A **browser check** runs at fixed viewport sizes. The viewport is the part of the window that shows the page, so it is smaller than the screen. All sizes below are `innerWidth × innerHeight` [A: estimates; confirm them once on real devices]:
  - laptop: 1366×768 screen → **1366×650** viewport;
  - iPad landscape: 1180×820 screen → **1180×730**;
  - iPad mini landscape: 1133×744 screen → **1133×670**;
  - small laptop: **1024×650**;
  - wide laptop: **1440×800**;
  - narrow (phone layout, Q17): **375×812** and **744×1133**.
- Each browser check runs in light and dark mode, with a keyboard-only pass and an axe run. Axe is an automatic accessibility checker. Part 6.2 names the tool and the pass rule for each kind of check.
- The repo gates are `node --test` and `node check-publish.mjs` (from `.claude/gates.json`). They do not test the UI. So a UI item is done only when the gates pass, its browser checks pass, and a clean-context reviewer has checked it.
- Every new test starts with a one-line header. The header says why the behaviour matters and what breaks if it regresses.
- `file:line` references were checked against today's code. Line numbers will move as slices land, so each slice must check them again before it starts.

---

## 1. Summary for the owner

1. **Build order follows Q14.** First round safety. It begins with a small shared base (Slice 0) that holds only the parts round safety needs. Then copy and dialogs, then the new look, then Decide and ballot, then shell and reach.
2. **Round safety (Slices 0 and 1).**
   - The clock survives a reload, a crash and a sleeping device.
   - A click on an earlier speech only shows it. The clock and the mic keep going (Q5).
   - Space and ⌘↵ follow Q6.
   - Toasts sit above the drawer.
   - All 7 columns fit at 1366 px, because the left pane becomes a flat overlay below 1440 px (Q4, Q1).
   - A recording notice and a steady "Recording" strip are added (Q19). Tests check that audio is deleted after its text returns.
3. **Copy and dialogs (Slice 2).**
   - A lighter welcome, for free users only (Q11). Paid-plan states for every AI surface are defined, for "do later".
   - Old place names are fixed, and the nav says "History" (Q12; CHANGED 2026-11-20, owner said "1: Rename to History". Old name: "Ballots").
   - Errors say "offline" instead of blaming the key.
   - All 17 native browser pop-ups go. They become one in-app dialog or an Undo toast.
   - Keys are not remembered by default (D1). No paid AI call runs by itself (D2). This now includes Live AI flow.
4. **Look (Slice 3).**
   - One token file.
   - 16 px forms and reading text (D3). 13–14 px in the grid (Q2). No text under 13 px.
   - Only the grid is a raised card (Q1).
   - The transcript lives only in the drawer (Q7).
   - Insights folds to a 32 px edge when no AI is set up (Q8).
   - A Light / Dark / System setting (Q3) and one tooltip style.
5. **Decide and ballot (Slice 4).**
   - One "Draft with AI" panel inside the Ballot (Q9). You review the AI text before it goes in, and the AI never changes your own fields.
   - A points range in Round setup, default 25–30 (Q10).
   - A ranks grid that uses each rank only once.
   - Print / PDF first, then "Copy for the tournament ballot" (Q20).
6. **Shell and reach (Slice 5).**
   - A tidy top bar, with the Expert/Plain switch moved out (Q15).
   - A corner chip shows a running clock when you leave Flow.
   - A ⌘K palette called "Search and commands" (Q13), and a shortcut sheet.
   - A narrow layout for clock, prep and ballot below 820 px (Q17).
   - A study mode to time a first run (Q16).
7. **One rule for each shared part.** One key registry, one dialog, one toast and one tooltip. Each is built once and used by every later slice.
8. **No vendor names in copy.** The only name is `{provider}`, which is the provider of the judge's own key. A static test holds the list of banned names.
9. **What can run in parallel.** Very little (§3.7). Most slices edit the same `index.html` style block, header and `app.js` regions.
10. **What I need from you.**
    - Mark each item do now / do later / drop.
    - Answer the 12 questions in Part 5.
    - Approve the survey and set the time targets in Part 6.3.

---

## 2. Design tokens

All tokens live in one new file, `assets/tokens.css` (item V0). Breakpoints stay as plain numbers in `@media`, because CSS variables do not work there:
- wide: 1180 px
- narrow (phone layout, 5.6): under 820 px (`max-width: 819.98px`) [A, see Q-10]
- left pane inline: 1440 px

Until V0 lands, the earlier slices use today's variable names.

| Group | Token | Light | Dark | Use |
|---|---|---|---|---|
| Surface | `--canvas` | #f4f5f7 | #0f1114 | Page background |
| | `--sunk` | #eef0f3 | #121418 | Hover fill, pressed state, recording strip |
| | `--panel` | #fff | #171a1e | Controls, tiles, round bar, overlays |
| | `--raised` | #fff | #1a1e23 [A] | Flow card only |
| Text | `--text` | #16191d | #e9ecef | Body text, focus ring, primary button |
| | `--text-2` | #3c434c | #c3c9d0 | Labels, tooltip text |
| | `--text-3` | #5f6873 | #8b949e | Muted text, placeholders, "Updating…" |
| Border | `--border` | #e1e4e8 | #262b31 | Dividers only |
| | `--border-ctl` | #7d8690 | #68717b | Control edges and overlay edges (3:1 or more) |
| Side | `--aff` / `--aff-tint` / `--aff-edge` / `--aff-fill` | #0055b8 / #eaf1fb / #b3cdee / =aff | #7fb0ff / #122038 / #24406e / #3b82f6 | Data only. Never white text on dark `--aff-fill` (3.68). |
| | `--neg` / `--neg-tint` / `--neg-edge` / `--neg-fill` | #c8161f / #fdecec / #f4c0c2 / #f2232d | #ff7b74 / #361517 / #5e2426 / #f2232d | Data only. Never white text on `--neg-fill`. |
| Status | `--error` / `--error-tint` | #b93d0a / #fdf0e8 | #ff9a5c / #3a2010 | Errors and over time only |
| | `--caution` / `--caution-tint` | #7a5000 / #fff6dc | #ffd27a / #33290f | Last 30 s, warnings |
| | `--ok` / `--ok-tint` | #1a7a3a / #e8f6ec | #6fd190 / #12291a | Done only. Never for "loading". |
| Accent | `--accent` / `--on-accent` / `--ring` | =text / #fff / =text | =text / #0f1114 / =text | Neutral accent and focus ring |
| Button | `--accent-hover` / `--accent-press` | #3c434c / #000000 | #c3c9d0 / #ffffff | Primary button hover and pressed fill (CHANGED 2026-11-20, docs/design/NO-STRIPES.md §5) |
| | `--danger-fill` / `--on-danger` / `--danger-hover` / `--danger-press` | #b93d0a / #ffffff / #9a3208 / #7f2906 | #ff9a5c / #0f1114 / #ffb382 / #ffc8a3 | The solid danger button. Only the confirm button of a danger dialog. |
| Font | `--font-sans` | ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif | same | Body text |
| | `--font-display` | 'Inter Tight', var(--font-sans) | same | Page titles and the clock |
| | `--font-mono` | ui-monospace, SFMono-Regular, Menlo, Consolas, monospace | same | Flow grid |
| Size | `--fs-1…5` | 13 / 14 / 16 / 20 / 28 px | same | Tiles, tips and captions / UI / reading and forms / heading / page title. There is no 12 px size. |
| | `--fs-grid`, `--lh-grid` | 13 px (14 px when the grid is 840 px wide or more), 20 px | same | Q2 (see Q-9 for touch devices) |
| | `--fs-clock`, `--fs-clock-bar` | clamp(56px,12vw,128px), 34 px | same | Clock |
| | `--fw-*` | 400 / 500 / 600 / 700 / 800 | same | No 550 or 650 |
| | `--lh-read`, `--lh-ui` | 1.5, 1.35 | same | |
| Space | `--s0…s7` | 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 px | same | |
| Radius | `--r-sm/md/lg/xl/pill` | 4 / 6 / 8 / 12 / 999 px | same | |
| Height | `--h-sm/md/lg`, `--hit-min` | 28 / 32 / 40 px, 24 px | same | Touch targets 44 px in the narrow layout |
| Shadow | `--shadow-1` | 0 1px 2px rgb(0 0 0/.06), 0 4px 16px rgb(0 0 0/.06) | .4 / .3 [A] | Flow card only |
| | `--shadow-2`, `--shadow-3`, `--scrim` | 0 6px 18px /.14; 0 20px 50px /.28; rgb(10 12 15/.55) | same | Pop-ups and tips; dialogs; dim layer. Never on a side pane. |
| Layout | `--header-h`, `--rb-h` | 52 px; measured by JS (0 when the round bar is hidden) | same | All gaps above the round bar use `calc(var(--rb-h) + var(--s4))` |
| | `--pane-left-w`, `--pane-right-w`, `--edge-w`, `--col-min` | 290 / 270 / 32 / 96 px | same | |
| Layer | `--z-sticky` 10 · `--z-bar` 20 · `--z-drawer` 30 · `--z-pop` 40 · `--z-dialog` 50 · `--z-tour` 60 · `--z-toast` 70 · `--z-tip` 80 | | | No raw z-index numbers |
| Motion | `--dur-1`, `--dur-2` | .12 s, .2 s | same | All motion is cut under reduced motion |

**Contrast targets.** The V0 test enforces these. Light / dark ratios, computed with the WCAG 2 formula:

| Pair | Light | Dark | Minimum |
|---|---|---|---|
| Aff text on panel | 7.02 | 7.94 | 4.5 |
| Aff text on Aff tint | 6.18 | 7.41 | 4.5 |
| Neg text on panel | 5.85 | 6.93 | 4.5 |
| Neg text on Neg tint | 5.12 | 6.53 | 4.5 |
| `--text-3` on canvas | 5.18 | 6.15 | 4.5 |
| `--error` on panel | 5.62 | 8.34 | 4.5 |
| `--error` on `--error-tint` | 5.04 | 7.19 | 4.5 |
| `--caution` on `--caution-tint` | 6.54 | 10.07 | 4.5 |
| `--border-ctl` on panel | 3.69 | 3.52 | 3.0 |
| `--border-ctl` on canvas | 3.39 | 3.81 | 3.0 |
| Focus ring on panel | 17.63 | 14.72 | 3.0 |
| `--on-accent` on `--accent-hover` | 10.00 | 11.33 | 4.5 |
| `--on-accent` on `--accent-press` | 21.00 | 18.91 | 4.5 |
| `--on-danger` on `--danger-fill` | 5.62 | 9.03 | 4.5 |
| `--on-danger` on `--danger-hover` | 7.41 | 10.83 | 4.5 |
| `--on-danger` on `--danger-press` | 9.45 | 12.64 | 4.5 |
| `--danger-fill` on panel (button shape) | 5.62 | 8.34 | 3.0 |
| `--text-2` on canvas (quiet button) | 9.17 | 11.33 | 4.5 |
| `--text-2` on panel (quiet button) | 10.00 | 10.46 | 4.5 |

**Colour rules**
1. Aff blue and Neg red are for data only. The page frame and the focus ring stay neutral.
2. Orange (`--error`) is only for errors and over time, and (as `--danger-fill`) for the confirm button of a danger dialog. That button always has a verb label, such as "Delete audio" (CHANGED 2026-11-20, owner decision D5).
3. Nothing "live" or "recording" is red.
4. Status colour comes only from the classes `.is-error`, `.is-caution` and `.is-ok`. Inline `.style.color` goes away.
5. Colour never carries meaning alone. A word or an icon always goes with it.
6. Never put white text on `--aff-fill` or `--neg-fill`.
7. Print always uses the light values.
8. No stripes. A stripe is a thin coloured bar used as an accent: a left, right, top or bottom border bar, a one-sided inset box-shadow, a bar under a header or tab, or a `::before` / `::after` bar. Show state with a fill, a full outline on all four sides, or a pill with a word. Allowed: plain 1 px neutral dividers (`--border`, `--border-ctl`), full control borders, full outlines, dots with a word, data bars that show a quantity, link underlines and diff marks. `no-stripes.test.mjs` checks index.html, about.html, docs/library/learn.css and js/*.js (owner rule, 2026-11-20; docs/design/NO-STRIPES.md).

---

## 3. The slices in build order

### 3.0 Slice 0: shared base (the first part of round safety)

Q14 puts round safety first. So Slice 0 holds **only** the shared parts that Slice 1 needs. Later slices extend these parts. They do not rebuild them. Slice 0 is the single owner of the toast, so Slice 1 does not edit the toast code. Part 4 gives the full contracts.

| Part | What Slice 0 builds | Extended later by | Used by |
|---|---|---|---|
| S0.1 | Layer tokens (`--z-*`) as plain variables in today's `:root` | V0 moves them to `tokens.css` | All slices |
| S0.2 | The full toast (Part 4.3). This is item 1.4. | — | 1, 2, 4, 5 |
| S0.3 | The smallest `ask()` dialog: title, body, 1–3 buttons, focus trap, Esc. Enough for the 1.6 notice. | Slice 2 adds `input` and `list` | 1.6, 2, 4, 5 |
| S0.4 | One Esc stack. Esc closes only the top layer. | — | All overlays |
| S0.5 | The key registry in a new pure file `keys.js`, with only the 1.3 and 1.5 entries: Space, ⌘↵ / Ctrl+↵, `[`, ⌘\ / Ctrl+\, Esc | Slice 5 adds `?`, `]`, `\`, ⌘K and the palette commands | 1.3, 1.5, 5.4, 5.5 |

The tooltip behaviour (old S0.6) moves to Slice 3, with the V11 look.

### 3.1 Slice 1: round safety (Q14 step 1)

**Data model change (shared by 1.1 and 1.2)**
- Today `R.cur` means both "the speech on screen" and "the speech the clock times". Slice 1 splits these two.
- `R.cur` becomes the **viewed** speech.
- `R.run = { id, endAt, beeped, rec, savedAt }` is the **running** speech. It is saved with the round. It is `null` when no speech runs.
- A new helper `runSp()` returns the running speech, or `sp()` when nothing runs.
- These parts change from `sp()` to `runSp()`: the clock, `#cur-label`, the Start/Pause text, `pauseSpeech()`, `startRec()`, the 0:00 beep and `timerSpeechFor()` (app.js:183, 199, 219, 226, 230, 361, 1201-1206).

#### 1.1 The clock survives a refresh, a crash or sleep
- **Start.** Set `R.run`, with `endAt = Date.now() + left*1000`, and call `save()` at once.
- **Pause.** Write `R.timeLeft[id]` (clamped at −599 s), set `R.run = null`, and save.
- **Unload.** Remove the auto-pause from `beforeunload` (app.js:2388).
- **Load.** Call `L.restoreRun(run, now, speechLength)`. It returns one of these:
  - `{state:'running', left}` when `−599 ≤ left ≤ speechLength`;
  - `{state:'running', left: speechLength, reason:'clock-moved'}` when `endAt` gives more time than the speech has. This happens when the device clock was moved back. `endAt` is reset from the clamped value.
  - `{state:'paused', left:-599, reason:'over-limit'}` when the clock went more than 9:59 past zero;
  - `{state:'none'}` when there is no run, or the run is broken (a bad `id` or an `endAt` that is not a number).
- **The −9:59 limit while the page is open.** When a running clock reaches −9:59, it pauses by itself at −9:59. One toast shows. This is the same rule as on restore.
- **Sleep.** Time always comes from the wall clock (the real time on the device). A `visibilitychange` listener calls `renderClock()` when the page shows again.
- **Beep.** The 0:00 beep plays once. `beeped` is saved. [A] If the page wakes or reloads more than 5 s after 0:00, there is no late beep.
- **Mic after a restore.** The mic does **not** restart by itself, because browsers need a click first. The 1.6 strip shows "stopped" instead.
- **1.1b Prep.** `R.prepRun = { side, endAt }` is restored the same way, with `L.restorePrep()`. [A] This is included. Mark it "drop" if you want the speech clock only.
- **Both restore as running.** This can happen with a damaged file or a race. A prep start always pauses the speech. So the restore keeps prep running and pauses the speech at its restored time. `L.restoreClocks(run, prepRun, now)` applies this rule.
- **Second tab.** A `storage` event syncs the clock fields (`run`, `prepRun`, `timeLeft`, `prepLeft`, `savedAt`). These fields are always written together, as one unit. The unit with the newer `savedAt` wins. Only one `run` can exist, so if two tabs press Start, the later Start replaces the earlier one. The other tab updates its clock and shows one notice. Flow text is not merged, so the newest write wins.
- **Storage errors.** `L.storageErrorKind(err)` returns `blocked` or `full` (`QuotaExceededError`). The clock still runs in memory. One error toast shows, de-duplicated with `key:'storage'`. Today the toast shows on every keystroke.
- **Copy**
  - "The 2AC clock kept running while the page reloaded."
  - "The 2AC clock ran more than 10 minutes over while Tabula was closed. It is paused at -9:59."
  - "The 2AC clock went 10 minutes over. It is paused at -9:59."
  - "The device clock changed. The 2AC clock is set back to its full time. Check it before you continue."
  - Blocked: "This browser is not saving. A refresh will lose the clock and your flow. To keep a copy, go to Round and use Save round file (.tab)."
  - Full: "This browser's storage for Tabula is full, so new changes are not saved. Delete old saved ballots in History, or go to Round and use Save round file (.tab)."
  - "Tabula is open in another tab. Use one tab per round. The newest change wins."
  - "Aff prep ran out while the page reloaded." / "Neg prep ran out while the page reloaded."
- **Files.** app.js:16-18, 40-44, 183-231, 265-285, 2384-2388; new `storage` and `visibilitychange` listeners; `logic.js` gets `restoreRun`, `restorePrep`, `restoreClocks` and `storageErrorKind`, added in the Slice 1 block of the `api` list (logic.js:1203; see §3.7 rule).
- **Checks**
  - Unit test, `restoreRun`:
    - 3:00 left and a reload 20 s later gives 160 s, running;
    - an `endAt` 2 min in the past gives −120 s;
    - 15 min in the past gives paused at −599;
    - an `endAt` that gives 12 min on an 8 min speech gives 480 s with `reason:'clock-moved'`;
    - `null`, a broken run, or an `id` that is not a speech gives none.
  - Unit test, `restorePrep`.
  - Unit test, `restoreClocks`: both running → prep running, speech paused.
  - Unit test, `storageErrorKind`: `QuotaExceededError` → full; `SecurityError` → blocked.
  - Browser checks:
    - reload during a speech;
    - kill the tab with no `beforeunload` (manual step M2 in 6.2);
    - add 60 s to `Date.now`: there is no late beep;
    - run a clock to −9:59: it pauses with one toast;
    - Start in tab A shows in tab B within 1 s; Start in both tabs leaves one running clock;
    - block storage: only one toast shows; fill storage: the "full" toast shows.

#### 1.2 View only: look back while the clock runs (Q5)
- **Click a tile while a speech runs.** Only `R.cur` changes. The clock, recording, clip upload and live AI flow keep going for `R.run.id`.
- **What follows the viewed speech:** the tile highlight, the transcript label and text, and the transcript you can edit. (V8 later moves the transcript into the drawer, and it must keep this wiring.)
- **What follows the running speech:** the round-bar clock, its label, Start/Pause, the corner chip and the beep. New live text still goes to the running speech (app.js:417, 582).
- **Leave view-only mode** in any of these ways:
  - "Back to 2AC";
  - a click on the running tile;
  - Pause [A, Q-5]: the view returns to the running speech, so "Resume" acts on the speech the judge sees;
  - a prep start.
- **Next speech** goes to the speech after the **running** one [A].
- **Reset** acts on the running speech.
- **Running tile.** It gets the class `.run`, a static "Running" label, and `aria-label="2AC, running"`.
- **Layout.** At 1366 px and on iPad, the label sits in `.rb-speech`. In the narrow layout it takes its own row. The button is at least 32 px tall.
- **Copy**
  - "Viewing 1NC · 2AC running" (CX speeches read "Viewing CX 1A · 2AC running")
  - "Back to 2AC"
  - "Running"
  - Screen-reader message: "Viewing 1NC. 2AC is still running."
- **Files.** app.js:189-215, 224-235, 279-285, 1201-1206; index.html:706 (`#view-chip`, `#view-back`); `logic.js` gets `viewingLabel(viewed, running)`.
- **Checks**
  - Unit test, `viewingLabel`: the 4 cases (1NC viewed with 2AC running; the same speech; nothing running; CX-1A viewed).
  - Browser check: start the 2AC with Transcribe on, then click the 1NC tile. The clock and recording continue, and the live text lands in the 2AC transcript.
  - Browser check: Pause while viewing returns the view to the 2AC.
  - Browser check: a reload while viewing restores both the view and the running clock.

#### 1.3 The Space rule and ⌘↵ / Ctrl+↵ (Q6)
- Part 4.1 gives the whole key rule. This item builds it with `L.clockKeyAction({code,key,meta,ctrl,alt,shift,altGraph,repeat,composing,place,focus,modal,singleKeysOn})`, which returns `'toggle'` or `null`.
- Space matches on `code === 'Space'`. ⌘↵ / Ctrl+↵ matches on `key === 'Enter'`.
- Remove the code that blurs the focused element and steals Space (app.js:239-245).
- **The single-key off switch (5.5) also turns off Space for the clock.** WCAG 2.1.4 (a way to turn off one-key shortcuts) needs this. It changes the Q6 behaviour only for judges who turn the switch off. ⌘↵ / Ctrl+↵ always works.
- **Copy**
  - `#t-start` tooltip on Mac: "Start or pause (Space, or ⌘ Enter while typing)". On other systems: "Start or pause (Space, or Ctrl+Enter while typing)".
  - When single keys are off: "Start or pause (⌘ Enter)" / "Start or pause (Ctrl+Enter)".
  - This is the only version; V11 uses it too.
  - `aria-keyshortcuts="Meta+Enter Control+Enter"`.
  - The ? menu hint line goes away in 5.3. Until 5.3 lands, it reads: "On Flow, Space starts or pauses the clock when no button or box is selected. ⌘ Enter (Ctrl+Enter on Windows and Chromebook) works even while you type. Esc closes a tour or dialog."
- **Files.** app.js:236-248; index.html:366, 708; `keys.js` gets `clockKeyAction`.
- **Checks**
  - Unit test, 11 cases:
    - Space with focus none, on Flow → toggle;
    - Space with focus on a control → null;
    - Space with focus in text → null;
    - Space on Decide → null;
    - Space with a modal open → null;
    - Space with `repeat` → null;
    - Space with `singleKeysOn:false` → null;
    - ⌘↵ with focus in text, on Flow → toggle;
    - Ctrl+↵ with focus in text, on Flow → toggle;
    - ⌘↵ on Round → null;
    - ⌘↵ while composing → null.
  - Keyboard checks:
    - Space on a focused checkbox ticks the box;
    - Space on Next speech moves to the next speech;
    - ⌘↵ in a column toggles the clock and adds no newline.
  - `grep "el.blur()"` finds nothing in the key handler.

#### 1.4 Toasts above the drawer (built in Slice 0 as S0.2)
- Part 4.3 gives the full contract. Slice 0 owns this code. Slice 1 only runs its checks.
- **Files.** app.js:49 (`toast()`), app.js:16-18; index.html:282, 332-333 (CSS), 779 (markup: two live regions); `logic.js` gets `toastMs`.
- **Checks**
  - Unit test, `toastMs`:
    - 20 characters → 4000;
    - 100 characters → 7000;
    - 400 characters → 10000;
    - error → 0;
    - with an action → 10000.
  - Browser check: with the drawer open, `elementFromPoint(toast centre)` returns the toast.
  - Browser check: with a two-row round bar at 1024 px, the toast sits above the bar.
  - Browser check: an error toast stays until ×.
  - Screen-reader check (manual step M3): info is read politely, and an error is read at once.

#### 1.5 Seven columns at 1366 px (Q4, Q18)
- **Columns.** Change `minmax(136px,1fr)` to `minmax(var(--col-min),1fr)`, where `--col-min` is 96 px (index.html:101).
- **Modes**, from `L.leftPaneMode(width, hideLeft)`:

| Width | Mode | How the left pane works |
|---|---|---|
| 1440 px or more | `inline` / `hidden` | Inline. `hideLeft` is remembered. |
| 820–1439 px | `overlay-closed` | A flat overlay on top of the grid. Columns never reflow. `position:fixed` from below the header to `calc(var(--rb-h)+8px)`; left 16 px; width `min(300px,100vw−32px)`; layer `--z-pop`. It follows Q1: a `--panel` fill and a 1 px `--border-ctl` edge, with **no shadow**. It always starts closed on load [A]. |
| Under 820 px | `stacked` | The narrow layout. Part 5.6 covers it. |

- **Open and close.**
  - A "Speeches" button at the start of the Flow tab row opens it. It replaces `#show-left` and has `aria-expanded` and `aria-controls`.
  - The keys `[` and ⌘\ / Ctrl+\ also open it (Part 4.1).
  - It closes with Hide, Esc, the same key again, or a click in the grid. A click in the round bar does **not** close it.
  - A tile click inside the overlay keeps it open.
  - Focus moves to the running tile (or the current tile) when it opens, and goes back when it closes.
  - It is not modal. It has no focus trap.
- **Width maths at 1366 px:**

| Case | Width per column |
|---|---|
| AI set up, Insights 270 px | ≈150 px |
| No AI, 32 px edge (V9) | ≈184 px |
| 1440 px with the pane inline | ≈117 px |
| iPad 1180 px (Insights below the grid) | ≈164 px |
| 1024 px | ≈141 px |

  The overlay never shrinks the columns.
- **Copy**
  - "Speeches"
  - Mac tooltip: "Show speeches ([ or ⌘\)". Other systems: "Show speeches ([ or Ctrl+\)".
- **Files.** index.html:101, 185-201, 270-274, 438-439, 470; a new `@media (min-width:820px) and (max-width:1439.98px)` block; app.js:93-101 (`applyPanes`), 1646-1687 (the tour saves `hideLeft` and must open the overlay at its speech step); `logic.js` gets `leftPaneMode`.
- **Checks**
  - Unit test, `leftPaneMode`:
    - 1366 → overlay-closed;
    - 1180 → overlay-closed;
    - 820 → overlay-closed;
    - 1440 with `hideLeft` false → inline;
    - 1440 with `hideLeft` true → hidden;
    - 819 → stacked;
    - 700 → stacked;
    - 375 → stacked.
  - Browser check at the laptop, iPad, iPad mini, 1024 and wide viewports:
    - `#flow.scrollWidth <= clientWidth`;
    - every `.col` is at least 96 px wide;
    - the page has no sideways scroll;
    - the open overlay has `box-shadow: none`;
    - take a screenshot of each.
  - Keyboard check: `[`, Esc, and Ctrl+\ while typing.
  - Touch check on iPad (manual step M4).

#### 1.6 Recording notice and "Recording" strip (Q19)
- **Notice.** It shows the first time on this device that recording would start: either the first Start with Transcribe on, or ticking Transcribe while a clock runs.
  - The clock starts at once. Only the mic waits for the choice.
  - "Record" saves `S.recConsentAt` and starts the mic.
  - "Don't record" (or Esc) unticks Transcribe and shows a toast.
  - It uses `ask()` (S0.3). Shortcuts are off while it is open.
  - First focus goes to "Don't record" [A, Q-6].
- **Strip.** A full-width row inside the sticky header. It shows on **every** place while the mic is on. Any later header change (4.9, 5.1) must keep this row.
  - Look: `--sunk` background, `--text` text, a steady "●" text character (`aria-hidden`). No red, no orange, no blinking.
  - The sticky panes move down through a CSS variable for the strip height.
  - The blinking REC dot (`#mini-rec`, `.rec-dot`) goes away.
- **States**

| State | Strip |
|---|---|
| Off | Hidden |
| Starting | "Starting microphone…" |
| Recording | "● Recording · 2AC" with [Stop recording]. In the narrow layout, the button reads [Stop]. |
| Stopped by a reload | "Recording stopped when the page reloaded. Words spoken since then were not recorded." with [Resume recording] |
| Mic blocked | The strip hides. An error toast shows, and `#rec-status` keeps its text. |
| Offline, key provider | "● Recording · 2AC · text waits for the internet". Clips wait in the queue. |
| Offline, browser speech service | "● Recording · 2AC · no text while offline". The free browser service needs the internet and keeps no clips, so these words are lost. One error toast shows. |

- **Copy**
  - Title: "Before Tabula records".
  - Body, 4 paragraphs:
    1. "When the speech clock runs, Tabula records from this device's microphone. It turns the speech into text for your flow."
    2. "Audio stays on this device until its text comes back. Then Tabula deletes it."
    3. "To make the text, the audio goes to the speech service you chose in Settings. With the free option, that is your browser's own service."
    4. "Tell the debaters before you record. Follow your tournament's rules."
  - Buttons: "Record" / "Don't record".
  - Footer: "You can change this later in Settings, under Audio."
  - Toast after "Don't record": "Recording is off. Tick Transcribe in the round bar to record."
  - Mic error toast: "The microphone is blocked. Allow it in your browser's site settings, then tick Transcribe again."
  - Offline browser-service toast: "You are offline. Your browser's speech service needs the internet, so words spoken now do not become text. The clock and flow still work."
  - Screen-reader messages: "Recording started for 2AC." / "Recording stopped."
- **Files.** app.js:216-223, 327-333, 359-397; index.html:91-93, the header (it ends at :371); clipqueue.js (read only, for the deletion checks); settings gain `recConsentAt`; `logic.js` gets `needsRecNotice`.
- **Checks**
  - Unit test, `needsRecNotice`.
  - Browser checks:
    - on fresh storage, the clock runs while the notice is open;
    - "Don't record" path: no clip is ever stored;
    - the strip shows on Round, Decide, History and Settings;
    - "Stop recording" turns the OS mic indicator off (manual step M1);
    - after a reload, the "Resume recording" state shows;
    - offline with each engine shows the matching strip text;
    - the strip has no red or orange, and it shows in forced colours (Windows high-contrast mode).
  - **Audio deletion checks (Q19):**
    - after a clip's text returns, the clip queue store is empty;
    - after "Delete audio" (dialog #4), the store is empty;
    - clips queued offline are deleted after their text returns online;
    - after "Stop recording", once the queue drains, the store is empty.
  - The vendor-name static test (6.1) covers the new strings.

### 3.2 Slice 2: copy and dialogs (Q14 step 2)

Slice 2 extends `ask()` with `input` and `list` (Part 4.2).

#### 2.1 Lighter welcome, free users only (Q11)
- **Who sees it.** `shouldShowWelcome({setupDone, hostedPlan})`. `L.hasHostedPlan(gate)` (logic/hosted.js) is true when the round's capabilities record gives hosted access or a school pays for a feature. At app start the welcome waits for the account check, so a paid judge on a new device sees no key welcome. When it is `true`, the welcome never shows, `setupDone` is set, and the "show again" button hides.
- **Look.** A small dialog, `min(440px,100%−32px)`, with a × button.
  - × or Esc means "Start judging" (CHANGED 2026-11-21, owner approved docs/design/WELCOME-COPY.md §1. Old line: × or Esc means "Start without AI", but skips the skip page.)
  - A backdrop click does nothing.
- **Choices.** "Start judging" is the one primary button. It comes first, alone and full width, with no description. The setup rows are quieter rows under it, not equal cards. Nothing is marked "Recommended" (delete `.choice:first-child`).
  - "Use a subscription you have" shows only when `LOCAL_ORIGIN` is true.
  - There is no skip page (CHANGED 2026-11-21: deleted). "Start judging" goes to **Flow** in one click and then offers the tour.
- **Copy**
  - (CHANGED 2026-11-21, owner approved docs/design/WELCOME-COPY.md §1 with "Yes, build it". The whole flow now says "AI" once.)
  - Title: "Welcome to Tabula Debate" (`TabulaBrand.NAME`).
  - Intro: "Your clock, flow and ballot are ready."
  - Primary button: "Start judging" (no description).
  - Setup row: "Add an automatic flow and a draft ballot" + "Paste a key from an AI company. You pay that company for what you use." It opens Settings with the cursor in the key field.
  - Setup row: "Use a subscription you have" + "Connects to an app you pay for on this computer. Needs one Terminal command." (shown only on localhost) It opens Settings at the subscription box.
  - Toast after "Not now" on the tour offer: "You can take the tour any time from the ? menu."
  - Settings button: "Show the welcome again".
- **Files.** index.html:150, 156, 539, 757-778; app.js:1730-1751, 2387; `logic.js`.
- **Checks**
  - Unit test, `shouldShowWelcome`.
  - Static test: no "I understand", no "Recommended." and no `skip-ack` (the old skip checkbox; copy-dialogs.test.mjs keeps it from coming back).
  - Static test, the welcome word budget: at most one "AI"; no "without AI", "feedback", "AI key", "never", "only" or "can only"; no "$" price; no "free trial".
  - Static test: one ask() only (no skip page); "Start judging", × and Esc all go to Flow; the subscription row only on localhost.
  - Browser checks:
    - localhost shows Start judging plus 2 setup rows; another host shows Start judging plus 1 setup row;
    - Esc goes to Flow and the welcome does not show after a reload;
    - "Start judging" takes one click (CHANGED 2026-11-21: the skip page is deleted. Old line: skip takes one click);
    - with a hosted plan in the capabilities record, no welcome shows (welcome-gate.test.js);
    - Tab never leaves the dialog.

#### 2.2 Fix stale place names
- **Rule.** Place names are exactly **Flow, Round, Decide, History, Settings** (CHANGED 2026-11-20, owner said "1: Rename to History". Old name: Ballots). Sub-places use an arrow: "Decide → Analysis".
- Every site at app.js:366, 806-851, 1227, 1295, 1853, 1919, 1947, 1973, 2216; index.html:599; tour.js:50 gets new text (the slice's table holds the exact strings).
- One constant: `NO_AI = "No AI is connected. Connect one in Settings."` It is used at every site. This supersedes the Slice 4 wording.
- "No AI" lines turn `--text-3`, not red. Where a line names Settings, it gets an "Open Settings" text button [A].
- **Checks**
  - Static test: none of `AI + Keys`, `Setup tab`, `Analysis tab`, `Save to log`, `Saved to log` or `in the Log` remain.
  - Static test: "No AI is connected" appears once.

#### 2.3 Offline vs bad-key errors (one classifier)
- `classifyAIError({status,name,message,online})` returns one kind. The rules run in this order:
  1. `online === false` → `offline`;
  2. a `TimeoutError` → `timeout`;
  3. a fetch `TypeError` while online → `noReply`;
  4. 401 or 403 → `keyRejected`;
  5. a 429 about quota → `noCredit`; any other 429, a 408, or a 5xx → `busy`;
  6. 404 → `modelGone`;
  7. a refusal → `refused`; a max-tokens stop → `cutOff`;
  8. a helper fetch failure → `helperDown`;
  9. anything else → `other`.
- `aiErrorText(kind,{provider,status})` returns the text:
  - offline: "You are offline. AI and transcription will start again when the internet is back. Your flow is saved on this device."
  - noReply: "No reply from {provider}. Check your internet. If the internet works, test the key in Settings."
  - timeout: "The AI took too long to answer. Try again."
  - keyRejected: "The {provider} key was rejected. Paste it again in Settings, or make a new key."
  - noCredit: "The {provider} key works, but its account has no credit. Add credit on the provider's site."
  - busy: "The AI service is busy. Wait a moment and try again."
  - modelGone: "That AI model is no longer offered. Tabula will pick another. Try again."
  - refused: "The AI would not answer this request. Decide by hand, or change the input and try again."
  - cutOff: "The AI's reply was cut off. Try again."
  - helperDown: "The helper on this computer is not running. Start it with: node bridge.mjs"
  - other: "The AI did not answer (error {status}). Try again. If it keeps failing, test the key in Settings." (CHANGED 2026-11-20, owner: "people won't know what a "Call" is, nor that it's AI driven." Old text: "The AI call failed (error {status}). …")
- Each feature adds a prefix: "AI flow:", "Live Eval:", "Analysis:", "Ballot draft:", "Transcript:". This text replaces every other error string, including the Slice 4 "Could not reach the AI…" and the V9 offline line.
- Raw provider text goes to `console.warn` only.
- **Offline.** Automatic AI calls pause. When the `online` event fires, they resume, but only for features the judge turned on (D2). A button click shows the offline text and makes no call.
- **Loading** text is `--text-3` with a spinner, never green.
- **Files.** app.js:592-636, 709-716, 804-810, 1316, 1337-1400, 1482, 1794-1802, 1839-1842, 1955-1956, 2206-2213; `logic.js`.
- **Checks**
  - Unit tests, one per kind. They include `online:false` with a 401 (→ offline) and a `TypeError` while online (→ noReply, never keyRejected).
  - Unit test: every output ends with "." and contains none of the names in the vendor list (6.1); a company name can appear only through `{provider}`.
  - Static test: "Claude declined" and "Check the AI key in Settings" are gone.
  - Browser check: go offline during a transcribed speech. A muted offline line shows, and the AI resumes when online.

#### 2.4 One in-app dialog and Undo toasts
- All 17 native `confirm()` / `prompt()` calls go. Part 4.2 gives the `ask()` contract.

| # | app.js line | Becomes |
|---|---|---|
| 1 | 127 | Undo toast: "Prep set to {m} min for each team." |
| 2 | 154 | ask(): "Open {file name}?" / "It replaces the round on screen. Tabula downloads the current round first, so you keep a copy." / Cancel · **Open round** |
| 3 | 174 | ask(), danger: "Start a new round?" / "This clears the flow, clocks, docs and any audio not yet transcribed. Saved ballots stay in History." / Cancel · **Clear and start new**. The palette (5.4) uses the same dialog. |
| 4 | 601 | ask(), danger: "Delete the waiting audio?" / "{n} of audio is not transcribed yet. If you delete it, those words never reach the transcript." / Keep it · **Delete audio** |
| 5, 6 | 860, 861 | ask() with an input: "New sheet" / "Sheet name" / "For example: DA, Cap K, T" / max 40 characters / blank → "Type a name." / Cancel · **Add sheet**. Rename: "Rename sheet" / Cancel · **Save**. If inline naming (B4) ships first, use that instead. |
| 7 | 862 | Undo toast: "Sheet "{name}" deleted." With one sheet left, Delete is disabled with the tooltip "A round needs at least one sheet." |
| 8 | 1503 | ask(), danger: "Remove the {provider} key?" / "Tabula forgets this key on this computer. To use {provider} again, paste the key again." / Cancel · **Remove key** |
| 9 | 1928 | For now: ask() "Replace your Aff and Neg comments?" / "The comment boxes on the Ballot already have text." / Keep mine · **Replace**. **Slice 4 (4.3) then removes it.** |
| 10 | 2163 | Close the node editor first, then an Undo toast: "Removed "{label}" from the map." |
| 11 | 2230 | For now: ask() "Change fields you typed?" / "Your note may need to change fields you typed yourself, for example the winner." / Cancel · Keep my fields · **Let the AI change them**. Cancel makes no AI call. **Slice 4 (4.3) then removes it.** |
| 12 | 2235 | For now: Undo toast "The AI may now change fields you typed." **Slice 4 (4.2) then replaces it with a per-field tag.** |
| 13 + 14 | 2265, 2271 | One ask(), danger: "Restore the backup from {when}?" with the list "Round: {round}", "Saved ballots: {n}", "Documents: {n}", and the keys line (see 2.6). Over 60 MB it adds "This file is large ({n} MB), so it may take a while." Body: "This replaces everything in this browser. Tabula downloads a copy of your current data first." / Cancel · **Restore** |
| 15 | 2351 | ask(): "Save with 1 problem?" / "Save with {n} problems?", listing the `checkBallot` messages / **Fix it** (kind `primary`, so it gets first focus; it focuses the first field with a problem) · Save anyway (kind `plain`). There is no danger button. |
| 16 | 2361 | Action toast: "Saved to History. Your data lives only in this browser." [Download backup] |
| 17 | 2376 | Undo toast: "Saved ballot deleted." The row Delete becomes a small icon button: "Delete saved ballot from {date}". |

- **Why 9, 11 and 12 are interim.** Q14 puts copy and dialogs before Decide. So Slice 2 removes the native pop-ups now, and Slice 4 deletes these three dialogs when the panel lands.
- **Shared undo helpers.** `logic.js` gets `removeAt(list,i) → {list,undo}` and `restoreAt(list,i,item)`.
- **Checks**
  - Static test: the case-sensitive pattern `\b(window\.)?(confirm|prompt|alert)\s*\(` over the JS files finds 0 matches. (It catches `window.confirm(`. It does not match names such as `buildBallotPrompt(`, because there is no word break before "Prompt".)
  - Unit test: `removeAt` then `restoreAt` gives back the same list for the first, middle and last item.
  - Browser check: Cancel on #11 makes no network request.
  - Browser check: Undo within 10 s puts the item back in the same place. After 11 s it stays deleted.
  - Browser check: no dialog opens on top of another dialog.
  - Keyboard check for every `ask()`.

#### 2.5 The nav says "History" (Q12)
- `PLACES` gets `['log','History']` (CHANGED 2026-11-20, owner said "1: Rename to History". Old value: `['log','Ballots']`. "Ballots" beside Decide → Ballot read as the same place). The internal id `log` and the storage key `policyJudge.log.v1` stay, because old backups and the tour depend on them.
- "Save to log" becomes "Save to History". "Saved to log" becomes "Saved to History". The tour step title becomes `title:'History'`. The palette keeps the search words "log", "history" and "ballots".
- The nav landmark is `<nav aria-label="Main">`. Remove the JS label "Sections" (app.js:86).
- Empty state: "No saved ballots yet. Save one from Decide → Ballot." [A]
- **Checks**
  - Static test: `PLACES` has 'History' and not 'Library'. A second static test fails if "Ballots" shows as a place name in index.html, about.html, js/*.js, keys.js or tour.js.
  - The existing tour and backup tests pass unchanged.

#### 2.6 Keys are not remembered by default (D1)
- New installs get `rememberKeys = false`. Today `S.rememberKeys ??= true` (app.js:1275).
- **Upgrade safety.** `resolveRememberKeys(saved, hasStoredKeys)` returns `true` when `saved` is undefined and keys are stored. So no current user loses a key.
- The box moves directly under the paste field.
- **Restore with keys.** When a backup holds keys and Remember is off, the keys go to the "this visit only" store (Q-3), never to `localStorage`. The restore dialog line reads:
  - "API keys: included. Kept for this visit only, because Remember is off." (Remember off)
  - "API keys: included." (Remember on)
  - "API keys: not included. Your current keys stay." (no keys)
- **Second tab.** With Q-3 A, keys live per tab, so a new tab has no key. The second-tab notice (1.1) then adds: "This tab has no AI key. Paste it here too, or turn on Remember this key in Settings."
- **Copy**
  - Label: "Remember this key on this computer".
  - Help line: "Leave this off on a shared computer. When it is on, the key is saved in this browser as plain text."
  - Toast when turned on: "Key saved on this computer."
  - Toast when turned off: "Keys removed from this computer. They work until you close this tab."
  - Provider row: "Ready (this visit only)".
- What "off" means is open question **Q-3** in Part 5.
- **Files.** app.js:1272-1288, 1455, 1508, 2265-2271; index.html:540-561.
- **Checks**
  - Unit test, `resolveRememberKeys`, 4 cases.
  - Browser check, new profile: the key is gone after a reload, or kept for the tab if Q-3 is A.
  - Browser check: a seeded old profile keeps its key.
  - Browser check: unticking removes the `localStorage` entry.
  - Browser check: restore a backup with keys while Remember is off. `localStorage` holds no key afterwards.

#### 2.7 No paid AI call runs by itself (D2)
- `S.autoEval === true` is the only way auto Live Eval runs. Today `S.autoEval !== false` (app.js:1922) treats a missing value as on. Auto ballot fill stays off.
- **Live AI flow also starts off** [A, Q-4]. Today `liveFlow: true` is the default (app.js:291), and it calls the AI every 30 s during a transcribed speech with no click for each call. Consent to record is not consent to paid calls. `S.liveFlow === true` becomes the only way it runs.
- **One-time note**, the first time AI becomes ready: "Live Eval and Live AI flow can update during the round. Each update uses AI, so they stay off until you turn them on. Turn Live Eval on in Decide → Live Eval. Turn Live AI flow on in Settings." [Turn on Live Eval] [Turn on Live AI flow]. It shows once. (CHANGED 2026-11-20, owner: "people won't know what a "Call" is, nor that it's AI driven." Old text: "They are off, because each update is a paid AI call.")
- What happens to current users is open question **Q-2** in Part 5.
- `logic.js` gets `autoEvalDefault` and `liveFlowDefault`.
- **Checks**
  - Unit test: `undefined` → false, for both.
  - Browser check, new profile: 2 transcribed speeches make no Live Eval, Live AI flow or ballot-fill request.

#### 2.8 Paid-plan states (Q11) — recommended mark: do later, when the plan ships
- Q11 says paid-plan users get hosted AI "with no keys or model choices". When `hasHostedPlan(gate)` is true:
  - AI counts as ready. `NO_AI`, the Insights `edge-connect` mode and the draft panel's "No AI" state never show.
  - Settings hides the key paste fields, the provider list and the model pickers. It shows one row: "AI: included with your plan." [A]
  - A new error kind `planNoCredit` gives: "Your plan has no AI credits left this month. The clock, flow and ballot still work." [A]
- Until the plan ships, this item is only a rule for the code paths. No UI is built.

### 3.3 Slice 3: visual system and Flow look (Q14 step 3)

The order inside the slice: V0 → V1–V4 → V5 → V6–V9 → V10 → V11 (with the tooltip behaviour) → V12.

- **V0 Token file.** Create `assets/tokens.css` (Part 2) and link it from index.html, about.html and the learn template (build-learn.mjs:240). Delete the three copied `:root` blocks (index.html:15-39, about.html:15-28, docs/library/learn.css:5-18). A short alias block is allowed while the slice is in progress, and must be gone at the end. The renames reach every `var(--old)` in the style block, in markup inline styles and in app.js inline HTML (for example app.js:808 `var(--danger)`). `--line-2` serves two roles today, so map each use by hand.
  - **Checks:** new `tokens.test.js` (every light token has a dark value; the contrast pairs in Part 2 pass); `grep -nE 'z-index:\s*[0-9]' index.html` finds 0; no old token names are left.
- **V1 Type.** The `body` font becomes `var(--fs-3)/var(--lh-read) var(--font-sans)`. These dense areas set 14 px themselves: nav, tabs, panes, round bar, tables. Tiles use 13 px. Labels are 14 px, weight 500, `--text-2` [A]. Buttons are 14 px. Reading text, form fields and the transcript drawer are 16 px (D3). No text is under 13 px.
  - **Checks:** computed-style check (a Round input is 16 px, `#transcript-big` is 16 px, nav is 14 px, a tile is 13 px); only `var(--fs-…)` sizes remain; a static test finds no `font-size` under 13 px; the 200% zoom check (6.2).
- **V2 Space and size.** Every gap above the round bar uses `--rb-h`, replacing the guesses 64, 76, 92, 132, 140 and 148 px. Use `100dvh` with a `100vh` fallback. Every hit area is at least 24 px (`.tip`, `.aibar button`, `.madd`).
  - **Checks:** a grep finds none of those px values and no raw `box-shadow: 0`; axe finds no target-size failure.
- **V3 Colour roles.** Use the Part 2 values. Add the `:root[data-theme="dark"]` block. Remove all 34 `.style.color` writes.
  - **Checks:** `grep -c '\.style\.color' app.js` is 0; axe finds no contrast failure on any screen.
- **V4 Layers.** Map: header and round bar → `--z-bar`; drawer and shortcut sheet → `--z-drawer`; help menu, tour offer, pane overlay and draft panel overlay → `--z-pop`; dialogs and the palette → `--z-dialog`; tour → `--z-tour`; toast → `--z-toast`; tips → `--z-tip`; sticky grid headers → `--z-sticky`.
- **V5 Controls.**

| State | Look |
|---|---|
| Default | 1 px `--border-ctl`, height 32 px, radius `--r-md` |
| Hover | Border `--text-2`. Buttons get a `--sunk` fill. |
| Focus | 2 px `--ring` outline, offset 2 px |
| Pressed | `--border` fill. A selected segment uses `--accent` with `aria-pressed` or `aria-checked`. |
| Disabled | `--sunk` fill, `--text-3` text, `--border` edge, `not-allowed` cursor. No opacity. |
| Error | 2 px `--error` border, `aria-invalid`, and a line that starts "Error:" tied with `aria-describedby` |
| Read-only | `--sunk` fill |

  Button kinds (CHANGED 2026-11-20, owner decisions D5 and D6; docs/design/NO-STRIPES.md §5). Old line: "Primary button hover is a solid `--text-2` fill."

| Kind | Use | Default | Hover | Pressed |
|---|---|---|---|---|
| Primary `.b.primary` | The one main action in a view or dialog | `--accent` fill, `--on-accent` text | `--accent-hover` fill | `--accent-press` fill |
| Secondary `.b` | Every other action, and Cancel | `--panel` fill, `--text`, 1 px `--border-ctl` | `--sunk` fill, `--text-2` edge | `--border` fill |
| Quiet `.b.quiet` | Low-priority actions in a dense row, menu items, the main and Decide tabs, the toast dismiss (×). Never the only way to do a main task. | No fill, no edge, `--text-2` text | `--sunk` fill, `--text` | `--border` fill |
| Danger `.b.danger` | Only the confirm button of a danger dialog (`ask()` with `kind: 'danger'`) | `--danger-fill` fill, `--on-danger` text | `--danger-hover` fill | `--danger-press` fill |

  A selected tab (`.on`) keeps a `--border` fill and `--text`, also on hover. On a toast the quiet × takes the toast's own text colour, so it reads on the dark info fill. The help menu's link items use the same quiet text colour and weight as its buttons.
  One exemption: `.linkish` is not a quiet button. It is an underlined action inside a sentence (for example "Open a round file (.tab)" on the start panel; CHANGED 2026-11-20, old example: "Connect AI"), and links keep their underline (NO-STRIPES.md §1). The toast's action button (`.toast-act`) keeps its 1 px `currentColor` edge, because it is the toast's one action, not a quiet one.
  Disabled is the same for all kinds (the row above). An inline delete stays a secondary or quiet button with an Undo toast. About and the library use `.btn` (secondary) and `.btn.primary` with the same hover and pressed states. Checkboxes use `accent-color: var(--text)` inside a 24 px hit area.
- **V6 Only the grid is raised (Q1).** `.flow` gets `--raised`, a 1 px border, `--r-lg` and `--shadow-1`. The panes lose their background, border and shadow. The 1.5 overlay stays flat. Tiles keep a `--panel` fill. The current tile gets a 2 px `--text` edge. The header sits flat on the canvas with its bottom line [A]. The round bar stays opaque. Other screens' cards do not change [A]. The always-on legend moves into a `(?)` tip [A].
  - **Check:** screenshots of every row of the 1.5 width table; computed panes and the overlay have `box-shadow: none`.
- **V7 Grid look.** `#tab-flow` gets `container: flow / inline-size`. The grid text is 13 px, and 14 px when the container is 840 px wide or more. Line height is always 20 px, so rows line up across columns. Keep the mono font [A, Q-8]. On touch devices, the rule chosen in **Q-9** applies, so iPad Safari does not zoom when a column gets focus.
  - A 1 px line between columns. No row lines.
  - Sticky tinted headers. These need the shared vertical scroll from Slice A+B.
  - **Current speech:** a 2 px `--text` outline on all four sides (the same look as the current speech tile) and a filled "Now" pill (`--accent` fill, `--on-accent` text, `--r-pill`). No bar under the header. (CHANGED 2026-11-20, owner decision D2. Old text: "a 3 px `--text` bar under its header, a "Now" label, and a 1 px inset `--border-ctl` outline.")
  - **Viewed speech:** an outline "Viewing" pill (a 1 px `--border-ctl` outline, `--text-2` text). It is an outline, not a border, so the header does not grow when the pill shows.
  - The current-column outline is drawn on a layer above the sticky header, so all four sides show. Each column spans two rows of a subgrid, so all seven headers are as tall as the tallest one and the first text line starts at the same height in every column.
  - A "Type here" placeholder, in the current column only [A].
  - Each textarea gets `aria-label="{speech} column, sheet {name}"`.
  - **Checks:** every column has the same font size and line height; line 40 sits at the same height in two columns; "Now" shows only on the running column; on iPad, a tap in a column does not change `visualViewport.scale`; zoom is not locked.
- **V8 Transcript in the drawer only (Q7).** Remove the left-pane transcript (index.html:441-446, 202-207). Rewire the 1.2 view-only label and text to the drawer, so the drawer shows the **viewed** speech's transcript and live text still goes to the running speech. Move the `(?)` and its problem dot into the drawer header. The dot also shows on the round-bar Transcript button [A]. The drawer is `min(42dvh,420px)` with 16 px text. Esc closes it through the Esc stack (it replaces app.js:768).
  - **Copy:** left pane `aria-label="Speeches and docs"`; Hide button `aria-label="Hide the speeches pane"`; placeholder "Words from the speech show here while the clock runs. You can type or fix them."; tour.js:25 title "Speeches and docs", body "Pick a speech and add its docs. Open the transcript from the round bar. Hide this pane for more room."
  - **Checks:** a grep finds no `#transcript`, `tr-label` or `transcript-block`; a tour test checks that no step targets a removed element; the 1.2 browser check passes again with the drawer.
- **V9 Insights folds (Q8).** `L.insightsMode({aiReady, hideRight})` returns one of three modes:
  - `edge-connect`: no AI. This wins over `hideRight`. A 32 px strip with a vertical, outlined small "Connect AI" button (`.b.small`). At 1180 px and below, it is a compact card centred under the grid: the reason "Live insights need AI." and the same button, on `--sunk` with a 1 px `--border` on all four sides and `--r-md`, as wide as its words. No rule above it. The whole card (`#ins-cta`) is hidden in every other mode. (CHANGED 2026-11-20, owner request: the lone underlined link under a full-width line was not elegant. Old text: "A 32 px strip with vertical 'Connect AI' text. At 1180 px and below, it is one line under the grid.")
  - `edge-show`: a strip with an "Insights" button.
  - `open`: the 270 px flat pane.

  States inside `open`:
  - waiting: before the round has something to read (`L.insightsReady`: the round is started, and a speech clock has run or there is flow text, a transcript or a mapped doc), only the quiet line "Insights start after the first speech." No Update button, and no Live Eval runs, from a click or the auto path. (CHANGED 2026-11-20, owner: "how can you drive updates when the round hasn't been started or set up?")
  - empty: "No read of the round yet." with [Update with AI]; (CHANGED 2026-11-20, owner: "people won't know what a "Call" is, nor that it's AI driven." Old text: "[Update (one AI call)]")
  - loading: "Updating…";
  - error: the `aiErrorText` with [Try again];
  - offline: the offline text, with Update disabled.

  It switches with no reload when AI connects. The Connect AI button gets `aria-label="Connect AI in Settings to get live insights"` (CHANGED 2026-11-20: it was a link). tour.js:28 must open the pane, or skip its step in `edge-connect`.
  - **Checks:** unit tests for 4 input sets; at 1366 px with no key, about 184 px per column.
- **V10 Theme (Q3).** `S.theme` is `'system' | 'light' | 'dark'`, with System by default. `L.resolveTheme(setting, prefersDark)` returns the theme.
  - A new `assets/theme-boot.js` file runs in `<head>` before the stylesheet, so there is no flash on load. It must be a file, because the security rule only allows scripts from this site (`script-src 'self'`). It loads in all three page types.
  - Light and dark logos are swapped with CSS (index.html:239, 352, 460; about.html:68; build-learn.mjs:247).
  - Mermaid (the map drawing library) follows the theme (app.js:2090). If a map is open when the theme changes, it re-renders at once with the new theme.
  - Print is always light (index.html:340-346).
  - A new "Appearance" card in Settings. Legend "Theme", options "System", "Light", "Dark", as native radio buttons. Help line: "System follows your device setting."
  - **Checks:** unit test, 6 cases; the no-flash check (6.2); System follows a device change live; an open map changes theme live; print preview from dark mode is light.
- **V11 Tooltips (behaviour and look).** Part 4.4 gives the behaviour rules. This slice builds them (the old S0.6) with the look. The look: `--panel` fill, `--text-2` text, 13 px, 1 px `--border`, `--r-md`, `--shadow-2`, max width 260 px. Merge `.hover-tip` and `.tip-pop` into one module. Replace every `title` used as a tooltip with `data-tip`.
  - Transcript button tip: "Show or hide the transcript".
  - Speech tile tip: "{label} · {Aff|Neg}{ · has transcript}".
  - **Checks:** a static test finds no `title="` on any element in index.html except `<iframe>` (an iframe needs a title for accessibility) and SVG `<title>` elements; unit test of `tipDelay` (sheet tab 1000 ms, others 500 ms).
- **V12 Global rules.** A global `prefers-reduced-motion` block. A `forced-colors` block: Aff and Neg headers, tiles and map cards show the word "Aff" or "Neg" in a small pill (1 px `CanvasText` edge on all sides, `--r-pill`, `--fs-1`), and the current column gets a `Highlight` outline. The "Now" pill keeps a filled look (`CanvasText` fill, `Canvas` text), so it still differs from the outline "Viewing" pill. (CHANGED 2026-11-20, owner decision D3. Old text: "Aff and Neg get real 3 px borders in `CanvasText`".) Remove inline `style=""` from the touched markup. A ratchet test stores today's counts (93 in index.html, 46 in app.js). The test fails if a count goes up, and the stored number is lowered when a count goes down.
- **New files:** `assets/tokens.css`, `assets/theme-boot.js`, `tokens.test.js`. **Changed:** index.html, app.js, logic.js (`insightsMode`, `resolveTheme`, `tipDelay`), tour.js, about.html, learn.css, build-learn.mjs.

### 3.4 Slice 4: Decide and ballot

- **4.0 Three tabs.** The subnav becomes "Live Eval · Analysis · Ballot". Remove `#tab-draft`. A saved `'draft'` tab opens `'ballot'`. The open tab gets `aria-current="page"`.
  - **Files:** index.html:374, 605-626; app.js:65-86, 1266, 1765-1819; tour.js:17, 37.
- **4.1 Ballot first.** At 1280 px and wider, the ballot is a left column, at most about 760 px wide, and the panel opens on the right, about 400 px wide.
  - **Below 1280 px** (iPad, 1024 px) [A]: the panel opens as a flat overlay from the right, `min(400px,100vw−32px)` wide, layer `--z-pop`, with a 1 px `--border-ctl` edge. The ballot does not reflow under it. Esc or [Close] closes it.
  - **Narrow layout:** the panel is a full-screen sheet with [Done].
  - Order: title row with [Draft with AI] → Winner → points and ranks → RFD → Aff and Neg comments → ballot check.
  - A sticky action bar sits at `bottom: var(--rb-h)`, layer `--z-bar`, `role="toolbar"`. Its buttons, in order: **Print / PDF** (primary) · **Copy for the tournament ballot** · **Save to History**.
  - Save status: "Saved in this browser · {time}" / "Not saved: this browser is blocking storage" / "Not saved: this browser's storage is full".
  - The one-row CSV and Sheets exports move to History [A].
  - Ctrl/⌘+P opens the 4.10 dialog.
  - **Check:** at the laptop (1366×650) and iPad (1180×730) viewports, Winner, all 4 speaker rows and the top of the RFD box show with no scroll.
- **4.2 "Yours" fields.** Each field group has one state, from `fieldState()`: `empty`, `ai` (in the new `R.ballot.aiFilled` set) or `yours` (in `R.ballot.touched`). An edit moves the field to `yours`.
  - The "Yours" tag is a button with a lock icon. Activating it unlocks the field and shows an Undo toast. There is no confirm dialog.
  - The "AI draft" tag is plain.
  - The points and ranks tag sits once per speaker row.
  - This has no outside example. Test it in the 5-judge round.
  - **Copy:** "Yours", "AI draft"; tip "The AI will not change this. Click to let it."; toast "The AI may now change {field}." [Undo]; line under the title "Anything you type is yours. The AI will not change it."
- **4.3 The "Draft with AI" panel (Q9).**
  - Contents, top to bottom:
    1. the line "Writing style: {Expert/Plain}. Change it in Round setup." (see 4.9 for which setting applies);
    2. the picker "What should the AI draft?", with Winner · Points and ranks · Reason for decision · Aff comments · Neg comments (empty and AI fields are checked; yours are unchecked);
    3. "Use Live Eval feedback for the comments";
    4. "Tell the AI (optional)";
    5. [Draft] with the hint "Uses AI"; (CHANGED 2026-11-20, owner: "people won't know what a "Call" is, nor that it's AI driven." Old text: "One AI call")
    6. the link "Copy the prompt instead";
    7. "Refill after each speech" (off, D2);
    8. a fold, "Why the AI chose this".
  - States:

| State | Text |
|---|---|
| No AI | "Connect AI to draft the ballot. The ballot works by hand either way." [Connect AI]. Only the prompt link works. |
| Empty round | "Nothing to draft from yet. The AI needs at least one speech, flow or doc." (`roundHasContent`) |
| Nothing picked | "Pick at least one thing to draft." |
| Offline | `aiErrorText('offline')` with the "Ballot draft:" prefix. Draft is disabled. The local helper is not blocked [A]. |
| Loading | "Drafting… usually 20–60 seconds", and Draft turns into [Stop] |
| Stopped | "Stopped. Nothing on the ballot changed." |
| Error, refusal, cut off | `aiErrorText`, plus [Try again] |

  - Keys: Esc closes the panel and does not stop a call. ⌘↵ in the note box runs Draft. The panel opens from its button or from the palette ("Draft with AI"). It has no direct shortcut (see 4.1 rules).
  - This removes the `#fill-redo` / `#fill-unlock` / `#fill-undo` code and the interim dialogs 9, 11 and 12 from Slice 2.
  - `buildBallotPrompt` gets `opts.redraft`, `opts.range` and `liveEvalFeedback`.
  - `ai.notes` moves into the note box once. `ai.evidence` stays in the prompt with no UI [A].
- **4.4 Review before insert.** A draft writes nothing at first. It shows one card per field:
  - an empty or AI field: "Insert this", checked;
  - a "Yours" field: a word diff using `<del>` and `<ins>` with hidden "removed:" and "added:" prefixes, and the choice "Keep mine" (selected) / "Use AI text";
  - winner and points: a compact before → after table.
  - Each card has [Redo this]. The review says "Redo uses AI." (CHANGED 2026-11-20, owner: "people won't know what a "Call" is, nor that it's AI driven." Old text: "at one AI call")
  - Footer: "Insert selected", "Discard draft", and "Accept all" (it never flips "Keep mine").
  - An AI point outside the range is never inserted: "The AI gave {n}, which is outside {min}–{max}. Set this one by hand."
  - **The ballot changes while a review waits:**
    - the judge edits a field: its card shows "Changed since the draft", its diff is rebuilt against the new text, and its choice resets to "Keep mine";
    - a new speech ends: the review header shows "A speech ended after this draft." with [Redo all] (it uses AI);
    - auto refill (4.6) does not run while a review waits.
  - A waiting review survives a reload, and the button then reads "Draft ready".
  - In the narrow layout, one card at a time: "3 of 5: Neg comments".
  - Inserted fields become "Yours".
  - Header: "Review the draft" / "Check AI text before you use it. Nothing changes on the ballot until you insert it."
  - `logic.js` gets `wordDiff`, `reviewFromDraft`, `staleReviewCards`, and `applyBallotDraft` with `opts.only` and `opts.range`.
- **4.5 Stop and Undo.** `callAI` gets a `signal`, combined with its timeouts through `AbortSignal.any`. A fallback ignores late replies [A: check support].
  - After an insert or an auto refill: toast "AI text added to {n} fields." [Undo] → "Ballot put back."
  - The panel keeps the link "Undo the last insert" until the next edit.
  - The old "Undo last fill" button goes.
- **4.6 Auto refill.** It is off (D2). When on, it writes only empty and AI fields. A change to a field with a value goes to review. It never touches "Yours". It does not run on an empty round, offline, with no AI, or while a review waits.
- **4.7 Points range (Q10).** The Round "Times" card becomes "Times and points". Add "Speaker points range" with "Lowest" (25) and "Highest" (30), whole numbers from 0 to 100 [A].
  - Help line: "Most leagues use 25–30. Change it if your tournament uses another range."
  - Errors: "The lowest score must be less than the highest." / "Use a number from 0 to 100."
  - **Data:** `R.ptsRange` only. There is no Settings control, because Q10 puts the setting in Round setup. "New round" copies the range from the round it replaces. The first round ever uses 25–30.
  - It drives the table header "Points ({min}–{max})", the input limits, `checkBallot({minPts,maxPts})`, and one prompt line when the range is not 25–30: "This tournament uses {min}–{max}. Map the scale above onto that range."
  - **Points already entered** outside a newly changed range stay as typed. `checkBallot` flags each one: "1A has 24.5, outside 25–30."
  - **Saved ballots** store their own `ptsRange`. Old saved ballots without one are shown with no range check.
- **4.8 Points and ranks controls.** Points: a 16 px input with − and + buttons (32 px, step 0.1). Ranks: a 4×4 radio grid with headers "1 (best)", "2", "3", "4".
  - Picking a used rank moves it: "Rank {r} moved from {a} to {b}." The narrow-layout rank `select` (5.6c) uses the same rule and message, through one `L.moveRank()`.
  - A new check rule: "Give {speaker} a rank."
  - "Ballot looks complete." shows only with no problems. The box is `role="status"`, throttled to once a second.
  - Each input is named, for example "1A points" and "1A, rank 2".
- **4.9 Expert / Plain moves (Q15).** Remove it from the top bar (index.html:357) and the "Reading level" card.
  - **One rule for which setting applies:** `reading = R.reading ?? S.reading`. Settings holds the device default, labelled "Default for new rounds". Round setup holds this round's choice. Changing it in Round setup sets `R.reading`.
  - The row is "How the AI writes" (Expert / Plain) in both places.
  - Help line: "Plain uses short sentences and everyday words, for students and parents. The decision stays the same."
  - The Settings card is renamed "AI writing and decisions".
  - The paradigm lives in Settings. Analysis shows "Weigh as" with "(yours)" [A].
  - "Tabula rasa" becomes "Blank slate (tabula rasa)".
  - tour.js:52 changes.
  - It must keep the 1.6 recording strip row in the header.
  - **Slice 5 (5.1) depends on this item. It does not repeat it.**
- **4.10 Print / PDF (Q20, first).** A dialog, "Print or save as PDF", with these choices: Ballot (always on), "Include the flow", "Include transcripts", "Include AI notes (Live Eval and analysis)", Portrait / Landscape (Landscape when the flow is included).
  - Help line: "To get a PDF, choose "Save as PDF" in the print window."
  - It builds `#print-sheet` from `printModel()`, so long text prints in full, and removes it after printing.
  - Error toast: "Printing is not available in this browser. Use Copy for the tournament ballot instead."
  - Saved ballots in History use the same dialog.
- **4.11 Copy for the tournament ballot (Q20, second).** A sheet with 4 blocks from `tournamentBlocks()`: Decision, Reason for decision, Aff comments, Neg comments.
  - Each block has a Copy button that turns into "✓ Copied" for 2 s, and a polite message "{Block} copied."
  - An empty block shows "Nothing written yet".
  - On failure, the text is selected and a line reads "Press Ctrl+C (⌘C on Mac) to copy."
  - Hint: "Paste each block into the matching box on your tournament's ballot site."
  - Warning: "This ballot has {n} problems. Fix them first, or copy anyway."
  - `copy()` returns true or false. Callers give the feedback.
- **4.12 Save to History.** Problems use dialog #15 from 2.4. Saved: the #16 toast. Repeat: "Already in History." Blocked storage: "Not saved: this browser is blocking storage. Use Print / PDF to keep a copy." Full storage: "Not saved: this browser's storage is full. Delete old saved ballots, or use Print / PDF to keep a copy."
- **4.13 Live Eval look.**
  - Verbs: **Run** when nothing is saved, **Update** when something is.
  - "Update after each speech" is off (D2).
  - States use classes, not inline colour. Empty round (`L.insightsReady` is false): "Insights start after the first speech.", the same line as Insights, and Run is off. (CHANGED 2026-11-20, owner: "how can you drive updates when the round hasn't been started or set up?" Old text: "Nothing to read yet. Start the 1AC first.") No AI: `NO_AI` with [Connect AI]. Out of date: "Out of date: 1AR and 2NR happened since."
  - A paired summary bar: "Aff ahead on 3 · Even 1 · Neg ahead on 2", with `role="img"`.
  - Labels "Did well:" and "To work on:". No red "Fix:".
  - "Copy feedback to ballot" becomes "Use this feedback on the ballot". It opens the panel with the feedback option checked.
- **4.14 Analysis look.** A new "Round at a glance" card:
  - "Prep used": "Aff used {m:ss} of {m:ss}", from `prepUsed()`;
  - "Key moments" from `keyMoments()` (only dropped and conceded nodes);
  - empty texts "No prep used yet." and "Key moments show here after you run the Round Map.".

  Run / Update on all three tools. The impact table becomes cards under 1100 px.
- **4.15 Narrow-layout ballot (Q17).** Part 5.6c covers it. It is built here, because it uses these parts.

### 3.5 Slice 5: shell and reach

- **5.1 Top bar.** From left to right: brand (it links to Flow; change `data-tab-link="setup"`) · nav "Flow · Round · Decide · History" · spacer · corner chip · offline note · ? · gear. Below this row, the 1.6 recording strip row stays.
  - The gear keeps `aria-label="Settings"`, the tooltip "Settings", and no `title`.
  - One row, 52 px. `flex-wrap` stays only in the narrow layout.
  - The offline note says "Offline", with the tip "No internet. Timers, flow and ballot still work. AI waits until you are back online." It is `role="status"` and says "Back online" when the network returns.
  - **Files:** index.html:44, 350-371; app.js:86, 599.
  - **Checks:** header row height is 52 px; no `[data-read]` in the header; the recording strip still shows while the mic is on; going offline and back.
- **5.2 Corner chip.** It shows off Flow while a speech or prep clock runs. The round bar shows only on Flow (open question **Q-1**). `chipText()` gives the text:

| State | Text |
|---|---|
| Running | "1AR · 2:41", with a side-colour dot |
| Last 30 s | the same text, in `--caution` |
| Over time | "1AR · 0:12 over", in `--error` |
| Prep | "Aff prep · 3:10" |
| Paused | hidden |
| Viewing | still shows the running speech |

  - It does **not** repeat "● Recording", because the 1.6 strip already shows on every place.
  - A click goes to Flow and focuses `#t-start`.
  - Tip: "Back to Flow · ends at 10:42".
  - Its name updates at most every 15 s. One message plays when it appears: "1AR clock still running".
  - CSS: `body[data-place="flow"]` scopes the round bar and its padding. `--rb-h` is 0 off Flow.
  - **Checks:** unit test of `chipText`; browser checks (start a speech then open Decide; click the chip; reload on Decide; reduced motion).
- **5.3 ? menu.** Items: Take the full tour · Tour this page · ─ · **Search and commands** ⌘K (Ctrl+K on Windows and ChromeOS) · **Keyboard shortcuts** ? · ─ · Debate library ↗ · About Tabula Debate ↗ (CHANGED 2026-11-20, owner request for the product name. Old text: "About Tabula ↗").
  - Remove the hint `<p>`.
  - Real menu keys: ↑ and ↓ wrap, Home and End jump, Esc returns focus to ?, and Tab closes the menu.
  - The "Search and commands" and "Keyboard shortcuts" items ship in the same change as 5.4 and 5.5, so no menu item does nothing.
- **5.4 Palette (Q13).** ⌘K / Ctrl+K works on every screen, also while typing. It does not open while the tour, the welcome or an `ask()` dialog is open.
  - Size: 560 px wide, 96 px from the top, layer `--z-dialog`, with a scrim. It is modal. It sits above the speeches overlay, the drawer and the shortcut sheet, and these stay open under it. The list is at most `min(360px,40dvh)` on iPad. In the narrow layout it opens from ? only.
  - Search placeholder: "Search commands, sheets and speeches". Footer: "↑↓ to move · ↵ to run · Esc to close". No match: "No match. Try "sheet", "prep" or a speech like "2AC"."
  - Esc first clears the search, then closes the palette. Focus and the caret go back to where they were.
  - Groups, with exact labels:
    - **Go to:** Go to Flow, Go to Round setup, Go to Live Eval, Go to Analysis, Go to Ballot, Go to History, Go to Settings, Open Debate library, Open About Tabula Debate (CHANGED 2026-11-20, owner request for the product name. Old label: "Open About Tabula").
    - **Clock and speeches:** Start or pause clock, Next speech, Previous speech, Go to speech: 1AC…2AR (CX rows as "CX of 1A"), Reset speech clock, Start/Stop Aff prep, Start/Stop Neg prep ("· pauses the 2AC" when a speech runs), Show/Hide transcript.
    - **Sheets:** Go to sheet: {name}, Next sheet, Previous sheet, New sheet, Rename, Duplicate and Delete sheet: {current}, Switch to My flow / AI flow.
    - **Panes:** Show/Hide speeches pane, Show/Hide insights, Focus mode.
    - **Round:** New round (dialog #3), Save round file (.tab), Open round file.
    - **Ballot:** Draft with AI (it only opens the panel; no AI call), Print or save as PDF, Copy for the tournament ballot, Save to History.
    - **Undo:** "Undo: {what}", shown only while an Undo toast shows. This is the keyboard path to Undo.
    - **Help:** Keyboard shortcuts, Take the full tour, Tour this page.
  - A Flow command run from another place first goes to Flow (note "· goes to Flow").
  - Disabled rows show their reason, for example "· already at 2AR" and "· the last sheet cannot be deleted".
  - AI rows show "· needs internet" when offline.
  - Theme and reading level are not in the palette.
  - ARIA: the combobox pattern, with `aria-activedescendant` and a polite result count.
  - `keys.js` holds `COMMANDS` and `searchCommands()`. Its order: prefix match, then word match, then alias, then fuzzy match.
- **5.5 Shortcut sheet.** It opens with `?` (when nothing has focus), from the menu, or from the palette.
  - A non-modal right panel, 360 px, layer `--z-drawer`. It can be open with the transcript drawer. Esc closes whichever of the two opened last (the Esc stack is in open order). In the narrow layout it is full screen with [Done].
  - Title: "Keyboard shortcuts". Search placeholder: "Search shortcuts". No match: "No shortcut matches. Try the palette: ⌘K."
  - It is built from the registry (Part 4.1).
  - Footer switch: "Single-key shortcuts (Space, [, ], \, ?)", on by default. Help line: "Turn off if you use voice control or the keys get in your way. ⌘ Enter still starts and pauses the clock." This meets WCAG 2.1.4. The switch is also in Settings.
  - tour.js:13 body: "Start and pause the speech clock here. On Flow, press ⌘↵ (Ctrl+↵ on Windows) any time, or Space when nothing is selected. Prep clocks for each team sit on the right."
- **5.6 Narrow layout (Q17).** It applies under 820 px (`max-width: 819.98px`) [A, Q-10]. This covers phones, phones in landscape and iPad mini portrait (744 px). Q17 keeps the flow grid on tablet and laptop only, and Q18 does not require these widths for the grid.
  - **a. Header.** Row 1 (48 px): brand mark, chip, offline dot, ?, gear. Row 2 (40 px): four equal nav buttons. The recording strip sits under row 2.
  - **b. Flow becomes the clock view.** The grid, panes and round bar are hidden. The view shows, top to bottom:
    1. "1NC · Neg · 1N · 8 min";
    2. a large clock with "Running" / "Paused" / "Over time";
    3. a 56 px [Start / Pause / Resume] button;
    4. [Previous] [Next speech] [Reset] (Reset gives an Undo toast);
    5. two prep cards, "Aff prep" / "Neg prep" with Start/Stop (aria-label "Start Aff prep"), and the line "Pauses the 1NC" when a speech runs;
    6. the 4×3 speech grid, with view-only taps;
    7. the Transcribe switch and the strip;
    8. "Flowing needs a bigger screen. Use a tablet in landscape or a laptop to flow. Your clock and ballot work here."

    The clock renders into both places through one `renderClockInto(el)`.
  - **c. Ballot.** One column: "Aff wins" / "Neg wins" cards, one card per speaker (points stepper and a rank **select** that uses `L.moveRank()`), RFD, comments. A sticky bar: [Print / PDF] [Copy for tournament] [Save] (full `aria-label`s). Example check line: "Ranks: 2 of 4 set."
  - **d. Other screens** must not break. No sideways scroll.
  - **Files:** index.html:275-284, 335-339; app.js:189-210, 269-279, 2315.
  - **Checks:** browser checks at 375×812 and 744×1133.
- **5.7 Success measure (Q16).** Part 6.3. The study mode hooks into the Slice 1 Start code (app.js:183-231) and the boot code, so it lands after Slice 1.

### 3.6 Files touched per slice

| Slice | index.html | app.js | Other |
|---|---|---|---|
| 0 | `:root` layer variables, dialog and toast CSS (148-156, 332-333), toast markup (779) | 16-18, 49, 236-248, 752-766 | new `keys.js` (first entries) |
| 1 | 91-93, 101, 185-201, 252-283, 366, 438-470, 706-708, header | 16-44, 93-101, 183-287, 327-397, 1201-1206, 1646-1687, 2384-2388 | logic.js (Slice 1 block), keys.js (`clockKeyAction`) |
| 2 | 150-156, 539-561, 599, 664, 757-778 | 65, 127-179, 366, 592-851, 860-862, 1227, 1272-1400, 1482-1514, 1730-1751, 1794-1973, 2160-2378, 2387; `ask()` input and list | logic.js (Slice 2 block), tour.js:50/56 |
| 3 | the whole style block (15-346), 352, 438-473, 535-588, 701-711 | 93-101, 723-768, 880-915 (tooltips), 1865-1880, 2090, every `.style.color`, every inline `var(--old)` | tokens.css, theme-boot.js, about.html, learn.css, build-learn.mjs, tour.js:25/28 |
| 4 | 340-346, 357, 374, 403-427, 483-532, 588-669 | 28-55, 65-86, 117-121, 1248-1268, 1354-1400, 1756-2028, 2189-2390 | logic.js (Slice 4 block), tour.js:17/37/52 |
| 5 | 44, 259-284, 335-371, ~740, 782-786 | 65-87, 198-210, 236-248, 269-287, 599, 1719-1728, 2315 | keys.js (more entries, `COMMANDS`), tour.js:13 |

### 3.7 What can be built in parallel

| Pair | Safe? | Shared ground |
|---|---|---|
| 0 and anything | No | Every slice depends on Slice 0 |
| 1 and 2 | No | app.js:366, the header markup, Q14 order |
| 2 and 3 (V0 included) | No | V0 renames every `var(--old)` across the style block, markup and app.js inline HTML (for example app.js:808 `var(--danger)`). Slice 2 edits index.html 150–156 and 539–561 and app.js 592–851, and its copy uses `--text-3` and `--error`, which exist only after V0. Q14 also puts copy before the look. |
| 3 and 4 | Logic only | Both edit the index.html style block (print 340-346 with V10) and app.js 1865-1880 (Insights verb). Pure `logic.js` functions and their tests (4.2, 4.7, 4.8) can go in parallel, under the export rule below. |
| 4 and 5 (any part) | No | 5.5 adds a Settings switch where 4.7 and 4.9 also edit Settings; 5.4/5.5 read `keys.js` and the palette lists Slice 4 commands; 5.3 needs 5.4 and 5.5; `showTab()` (app.js:65-86); the header (4.9 removes :357, 5.1 rebuilds it); narrow CSS; ballot rows at app.js:2315 |
| 1.5 and 3 V6 | No | `applyPanes()` (app.js:93-101) and the workspace CSS (185-201) |
| 1.2 and 3 V8 | No (in order) | V8 removes `tr-label` and must rewire the 1.2 view-only transcript to the drawer |
| 1.6, 4.9 and 5.1 | No (in order) | All three edit the header (index.html:350–371). Each later one keeps the strip row. |

**Rules for shared files**
- `logic.js`: each slice adds its exports in its own labelled block in the `api` list (logic.js:1203). Each slice puts its new tests in its own file, `logic-slice{N}.test.js`, so `logic.test.js` gets no new lines.
- `tour.js`: Slices 2, 3, 4 and 5 edit different lines. Each slice runs `tour.test.js` before it merges.

**Hot spots that need one owner at a time:** the `index.html` style block, the header (index.html:350–371), `app.js:65-101` (`PLACES`, `showTab`, `applyPanes`), `app.js:236-248` (keydown), and `app.js:1354-1400` (`callAI`).

---

## 4. Cross-slice rules

### 4.1 Keyboard map (one registry, S0.5)
- `keys.js` is a pure UMD file. UMD means one file that works in both the browser and Node.
- It holds the registry entries `{id, label, group, scope, keys:{mac,other}, single, palette, when}`, plus `matchKey(event, context)` and `searchCommands()`.
- The key handler, the palette (5.4) and the shortcut sheet (5.5) all read it.
- On Windows and ChromeOS, ⌘ becomes Ctrl.

| Key | Scope | Works while typing | Action |
|---|---|---|---|
| Space | Flow; nothing has focus; no dialog, tour, welcome or node editor; no modifier; not `repeat`; not composing | No | Start or pause the clock (the running speech while viewing). Everywhere else, Space does its native job. |
| ⌘↵ / Ctrl+↵ | Flow, including the start screen; no dialog | Yes | Start or pause the clock. `preventDefault`. Off Flow it does nothing (Q6). |
| ⌘K / Ctrl+K | Everywhere, except over the tour, welcome or `ask()` | Yes | Open or close the palette |
| ? | Nothing has focus | No | Open or close the shortcut sheet |
| [ | Flow, not typing | No | Speeches pane (an overlay below 1440 px) |
| ⌘\ / Ctrl+\ | Flow | Yes | Speeches pane |
| ] | Flow, not typing | No | Insights open / edge (does nothing in `edge-connect`) |
| \ | Flow, not typing | No | Focus mode (hide both panes) |
| ⌘P / Ctrl+P | Ballot | Yes | The Print / PDF dialog |
| ⌘↵ in the panel | Draft panel / review | Yes | Draft / Insert selected (no clash, because this is not Flow) |
| Esc | Everywhere | Yes | Close the top layer only (S0.4) |

**Commands with no direct key** [A]. Next / previous sheet, New sheet, Draft with AI and Undo have no key. They run from the palette (⌘K) and from their buttons. The reason: the keys tried before do not work in real browsers.
- Ctrl+PageDown / Ctrl+PageUp switch browser tabs in Chrome on Windows, Linux and ChromeOS.
- Ctrl+Alt+letter is the same as AltGr on many European keyboard layouts, so it types characters there.

**Rules for the registry**
- No two entries in one scope share a key. A unit test checks this.
- **Reserved keys.** A unit test fails if any entry uses one of these: Ctrl+Alt+any key; Ctrl+PageUp/PageDown; Ctrl+Tab; Ctrl+digit; Ctrl+T, W, N, L, H, J, D; Option+letter or Option+digit on Mac (these type characters).
- **How keys match.**
  - Space matches on `event.code === 'Space'`.
  - Single-character keys (`[`, `]`, `\`, `?`) match on `event.key`, the character the layout produces. So they work on any layout that can type the character. Shift is allowed when the layout needs it (for example `?`). AltGr is allowed (`getModifierState('AltGraph')`). Ctrl, ⌘ and plain Alt are not allowed.
  - Modifier entries (⌘K, ⌘\, ⌘P, ⌘↵) match on `event.key` with the modifier. On a layout where `\` needs AltGr (for example German), ⌘\ / Ctrl+\ cannot be typed. `[` and the "Speeches" button still work there.
- Single-key entries (Space, [, ], \, ?) obey the off switch in 5.5. Modifier keys always work.
- Composing (typing through an input method, for example for Chinese or Japanese) and key repeat never trigger an action.
- The jump-to-column key from Slice B is not set yet. Slice B must pick a key that passes the reserved-keys test, and the sheet follows the registry.
- Every key also has a visible button for touch.

### 4.2 Dialog component: `ask(opts) → Promise<value|null>` (S0.3, extended in Slice 2)
- **Options:** `title`, `body`, `list` (Slice 2), `input {label, value, placeholder, maxLength}` (Slice 2), 1–3 `buttons {label, value, kind: primary|danger|plain}`, and `cancelValue`.
- Esc, × and a backdrop click resolve with `cancelValue`. The welcome screen is the one exception: its backdrop does nothing.
- **Focus.** It goes to the input if there is one. Otherwise it goes to Cancel when a danger button exists, or to the `primary` button, or to the button named by an optional `focus` option (the 1.6 notice uses this, see Q-6). Focus is trapped, the page behind is `inert`, and focus returns to the opener on close.
- **Keys.** Enter activates the focused button. In an input, Enter means primary. Esc closes one layer. Tab cycles inside.
- **ARIA.** `role="alertdialog"` with a danger button, otherwise `role="dialog"`. Also `aria-modal`, `aria-labelledby` and `aria-describedby`.
- **Layout.** `min(420px,100%−32px)`, about 20 vh from the top (10 vh on iPad with an input). Buttons go right-aligned: Cancel, extra, primary. In the narrow layout they stack, with the primary on top.
- **States.** The primary is disabled while a required input is empty (`aria-disabled`). An inline error goes under the input.
- Only one dialog at a time. A second call waits.
- Shortcuts are off while a dialog is open. The welcome and the recording notice use this component.

### 4.3 Toast rules (S0.2)
- **Call:** `toast(msg, {kind:'info'|'error', action:{label,run}, key})`. The 52 existing calls stay as info toasts.
- **Time:** `toastMs(text, kind, hasAction)`:
  - info: `min(10000, max(4000, 1000 + 60×characters))`;
  - with an action (Undo or Download): **10000**;
  - error: 0, so it stays until closed.
- The timer pauses on hover or focus. After the pointer or focus leaves, at least 2 s remain (WCAG 2.2.1, adjustable timing).
- **Dedupe:** the same `key` or the same text restarts the timer instead of adding a copy. At most 3 toasts; the newest sits at the bottom.
- **Undo:** only one Undo waits at a time. A new one makes the old one final. After Undo, a toast says "Restored." (or a message for that feature). The button's name is "Undo: {what}". Keyboard users reach it with Tab or through the palette row "Undo: {what}".
- **Look:**
  - info: `--accent` fill, `--on-accent` text;
  - error: `--panel` fill, a 1 px `--border-ctl` edge, and a "!" icon in `--error` (CHANGED 2026-11-20 at the owner's request: no coloured left stripes anywhere);
  - × button: `aria-label="Dismiss message"`;
  - 150 ms fade (none under reduced motion).
- **Place:** bottom centre at `calc(var(--rb-h)+12px)`. With the drawer open, it adds `min(42dvh,420px)+20px`. Width `min(560px,100vw−32px)`. Narrow layout: 16 px from each side. Layer `--z-toast`. The container is `pointer-events:none`, and each toast is `auto`. Hidden in print.
- **Speech:** two permanent live regions, `#toasts-polite` (`role="status"`) and `#toasts-alert` (`role="alert"`).
- A toast never takes focus. Esc does not close toasts.

### 4.4 Tooltip rules (built in Slice 3, V11)
- **Label tip (`data-tip`):** it shows after 0.5 s, or 1 s on sheet tabs. It shows at once on keyboard focus. It hides on mouse-out, blur, scroll, a key press or Esc.
- **Help bubble (`(?)`):** it opens on a 0.5 s hover or a click. A click pins it. A second click, a click outside or Esc closes it.
- **Position:** below the target. It flips above when it would cross `innerHeight − --rb-h`. It stays 8 px inside the viewport. Layer `--z-tip`.
- The pointer can move onto a tip (WCAG 1.4.13). Esc closes a tip without moving focus or closing the layer under it.
- **Touch:** a help bubble opens on tap. A label tip shows on a 500 ms long press [A]. Every control has a visible name or an `aria-label`, so no one needs a tip.
- A disabled control gets its tip from a wrapper, so the reason is still readable.
- No `title` is used as a tooltip. `aria-describedby` points to a tip only when the tip adds words to the name.

### 4.5 Copy rules
- Use plain short sentences.
- Place names: Flow, Round, Decide, History, Settings.
- The verb pair is Run / Update. The AI hint is "Uses AI" (or "(uses AI)" after a checkbox; "(uses AI while a speech runs)" for Live AI flow). Users see rounds, not calls, so no hint counts calls. (CHANGED 2026-11-20, owner: "people won't know what a "Call" is, nor that it's AI driven." Old text: "The cost hint is "One AI call".")
- The status next to Transcribe in the round bar is one short word (`L.recStatus`, one ladder for the word, its tone and the full sentence): Ready, Recording, Off, Upload paused, Retrying, Catching up, Finishing, Check mic, Mic blocked, Mic lost, Offline, Key needed, Not transcribing. Clips held after an error say "Upload paused", not "Paused", so the word does not read like the paused clock. The full sentence is its tip and is read by screen readers. Both status spans take keyboard focus (`tabindex="0"`). (CHANGED 2026-11-20, owner: the long line "trails off next to transcribe ... Can it just say "Ready"".)
- No model or company names in copy. The only exception is `{provider}`, which names the provider of the judge's own key. The provider picker in Settings reads its names from providers.js and is the only other place names appear. A static test holds the banned list (6.1).
- Errors come only from `aiErrorText`.
- Copy never relies on colour alone.
- No stripes (colour rule 8 in Part 2). A state is a word, a fill, a full outline or a pill, never a coloured bar on one side.

---

## 5. Open questions for you (12)

- **Q-1. Round bar off Flow.** Should the round bar hide on Round, Decide, History and Settings, with the corner chip shown instead?
  - ★ Yes. It frees 76 px.
  - The cost: off Flow, prep is one click further away (or in the palette).
- **Q-2. Current users and the D2 defaults.** Many saved `autoEval` and `liveFlow` values of `true` came from the old defaults, not from a choice.
  - ★ A: turn both off once for everyone, with the one-time note (2.7).
  - B: keep what each user has saved.
- **Q-3. "Key not remembered" and a refresh during a round (D1 with Q14).**
  - ★ A: keep the key in `sessionStorage`. It survives a refresh and is gone when the tab closes. A new tab needs the key again (2.6).
  - B: memory only. The key must be pasted again after every refresh.
- **Q-4. Live AI flow default.** D2 says no paid AI call runs by itself. Live AI flow calls the AI every 30 s during a transcribed speech.
  - ★ Start it off, with the one-time note (2.7). This follows D2.
  - Or widen D2 on purpose, so that ticking Transcribe also turns on Live AI flow.
- **Q-5. Pause while viewing an earlier speech.**
  - ★ The view goes back to the running speech.
  - Or it stays on the viewed speech (today's behaviour).
- **Q-6. Recording notice focus.** Which button gets focus first?
  - ★ "Don't record". It is safer around minors. The clock still starts either way.
  - Or "Record".
- **Q-7. The long written decision.** Q9 removes the Decision draft tab.
  - ★ Drop the long streamed text. Keep the "Why the AI chose this" fold.
  - Or add a "Full written decision" fold at one more AI call.
- **Q-8. Grid font and line marks.**
  - ★ Keep mono (about 10 characters per line at 96 px). Marks for dropped, conceded and extended lines are typed shorthand with light styling. No data-model change.
  - Or a sans font, and per-line marks (these need line IDs).
- **Q-9. iPad zoom on the grid (Q2 vs Q18).** iPad Safari zooms the page when a text field under 16 px gets focus. With 13–14 px grid text, every tap in a column pans the 7-column grid. Each fix bends Q2 or D3 a little.
  - ★ A: on touch devices only (`pointer: coarse`), the grid text is 16 px. About 8 characters fit per line at 96 px. Laptops keep 13–14 px.
  - B: keep 13–14 px and draw the text at 16 px scaled down with a CSS transform. It looks the same, but it is fragile (caret, selection and line height).
  - C: accept the zoom.
- **Q-10. Widths from 560 to 819 px.** Q17 keeps the grid on tablet and laptop, and Q18 sets iPad landscape as the smallest grid device. Between phone width and 820 px (iPad mini portrait, a phone in landscape), no layout was defined.
  - ★ Use the narrow clock-and-ballot layout (5.6) for everything under 820 px.
  - Or show the grid with the overlay pane down to 560 px.
- **Q-11. A tool for the browser checks.** The gates are `node --test` and `node check-publish.mjs`. The repo has no browser test tool.
  - ★ Add Playwright and `@axe-core/playwright` as dev-only tools, run by a separate `npm run ui-check`. It is not part of publishing, and it does not change the existing gates.
  - Or keep all browser checks as a written manual checklist.
- **Q-12. Time targets for the first-run test (Q16).** The pass line needs a number.
  - ★ A median of 60 s or less from first view to the first 1AC Start (free path). The paid path (30 s or less) is measured when the paid plan ships.
  - Or set other numbers.

Smaller [A] choices stay marked inline and go ahead unless you flag them. Examples: prep restore (1.1b), ⌘\ while typing, the commands with no direct key (4.1), the 1280 px break for the draft panel (4.1), the paradigm living in Settings, and the paid-plan copy (2.8).

---

## 6. Test plan

### 6.1 Unit tests to add (`node --test`; each with a one-line why/consequence header; no existing assertion changes)

| File | Functions |
|---|---|
| logic-slice1.test.js (new) | `restoreRun` (including future `endAt`), `restorePrep`, `restoreClocks`, `storageErrorKind`, `viewingLabel`, `toastMs`, `leftPaneMode` (including 700 and 819), `needsRecNotice` |
| logic-slice2.test.js (new) | `shouldShowWelcome`, `classifyAIError` (one per kind), `aiErrorText`, `removeAt`/`restoreAt`, `resolveRememberKeys`, `autoEvalDefault`, `liveFlowDefault` |
| logic-slice3.test.js (new) | `insightsMode`, `resolveTheme`, `tipDelay` |
| logic-slice4.test.js (new) | `fieldState`, the touched/aiFilled move, `roundHasContent`, `buildBallotPrompt` (redraft, range, feedback), `applyBallotDraft` (only, range), `wordDiff`, `reviewFromDraft`, `staleReviewCards`, snapshot deep copy, `checkBallot` (range, out-of-range points, missing ranks), `moveRank`, `printModel`, `tournamentBlocks`, `prepUsed`, `keyMoments` |
| keys.test.js (new) | `clockKeyAction` (11 cases); registry: every entry has a label, a group and both key sets; no key clash in a scope; no reserved key (4.1); `event.key` matching with Shift and AltGr; palette ↔ registry links; `matchKey` with single-key off; `searchCommands` ("2ac", "timer", "log", "", "zzz"); disabled rules ("Delete sheet" with one sheet, "Next speech" at 2AR); `chipText`; `studyResult` |
| tokens.test.js (new) | Dark values exist; all contrast pairs in Part 2 pass |
| copy-dialogs.test.mjs (new, static) | No match for `\b(window\.)?(confirm|prompt|alert)\s*\(`; no stale place names; no "I understand", "Recommended." or "Claude declined"; `PLACES` says History; one `NO_AI` string; no `title="` in index.html except on `<iframe>` and SVG `<title>`; no `font-size` under 13 px; **vendor names:** none of a fixed list (Anthropic, Claude, OpenAI, ChatGPT, GPT, Codex, Google, Gemini, Groq, Mistral, Deepgram, AssemblyAI, Whisper, Tabroom, plus every provider name in providers.js) in app.js, tour.js or index.html text, except inside providers.js and the Settings provider picker |
| inline-style.test.mjs (new, static) | Ratchet: inline `style=""` count in index.html ≤ 93 and in app.js ≤ 46 |
| tour.test.js | No step targets a removed element (`#tab-draft`, the left-pane transcript, `#reading-card`) |

The existing tests that must pass unchanged: logic.test.js:29-55, 119-121, 383-384, 605-631, 656-674, and tour.test.js.

### 6.2 Browser checks
- **Tool** (if Q-11 is ★): Playwright drives Chromium and WebKit at the viewports in "How to read it". It uses `page.emulateMedia()` for `colorScheme`, `forcedColors` and `reducedMotion`. Axe runs through `@axe-core/playwright`.
- **Pass rules for each kind of check:**
  - Axe: zero violations for the WCAG 2.2 A and AA rules on Flow, Round, Ballot, History and Settings.
  - No flash: the first-paint background of `<html>` equals `--canvas` for the chosen theme.
  - 200% zoom (viewport 683×325 at device scale 2): no sideways page scroll, and no text container has `scrollWidth > clientWidth`.
  - No sideways scroll: `document.documentElement.scrollWidth <= innerWidth`.
  - Screenshots: saved per viewport and theme for a human reviewer; they are evidence, not a pass rule.
- **Must-pass list.** This is the short form of the per-item checks above:
  1. Clock: survives a reload and a killed tab; correct after sleep; stops at −9:59; syncs to a second tab; one storage toast.
  2. View only: clock and recording continue; live text goes to the running speech; Pause returns the view.
  3. Keys: Space works natively on controls; ⌘↵ works in a column with no newline; nothing happens off Flow; ⌘K from a textarea restores the caret.
  4. Toasts: visible over the drawer and over a two-row round bar; errors stay; Undo restores within 10 s.
  5. Seven columns: no sideways scroll; every column at least 96 px at the laptop, iPad, iPad mini and 1024 viewports.
  6. Recording: notice before the first mic; strip on every place; OS mic indicator off after Stop; "Resume" after a reload; clip store empty after text returns and after "Delete audio".
  7. Dialogs: no native pop-up anywhere; Cancel on any AI dialog sends no request.
  8. Ballot: above the fold at 1366×650 and 1180×730; the draft review never overwrites "Yours"; a field edited during review shows "Changed since the draft"; Stop cancels the request; dark-mode print is light and prints in full; the copy blocks paste correctly.
  9. Theme: no flash; System follows the device live.
  10. Narrow layout: no sideways scroll on any screen at 375×812 and 744×1133; touch targets at least 44 px; form text 16 px; the clock view and the ballot bar work.
  11. Offline: muted offline text; no AI calls; only features the judge turned on resume on reconnect.
- **Manual steps** (they cannot be automated):
  - **M1. Mic indicator.** On macOS Chrome, start a transcribed speech. Check that the orange mic dot shows in the menu bar. Click "Stop recording". Expected: the dot goes away within 2 s.
  - **M2. Killed tab.** Start a speech with 3:00 left. Open Chrome's task manager (Shift+Esc on Windows and ChromeOS; Window → Task Manager on Mac) and end the tab's process. Wait 20 s, then reopen Tabula. Expected: the clock shows about 2:40 and runs, and the "kept running" toast shows.
  - **M3. Screen readers.** Use VoiceOver with Safari on macOS, and NVDA with Chrome on Windows. Trigger an info toast, an error toast, the 1.2 view-only message and the 1.6 recording messages. Expected: info is read after the current speech, and an error is read at once.
  - **M4. iPad touch.** On an iPad in landscape: tap "Speeches", tap a tile, tap the grid. Expected: the overlay opens, stays open on the tile tap, and closes on the grid tap. Tap in a column. Expected: the page does not zoom (with the Q-9 choice).
- **Per step:** report `node --test` and `node check-publish.mjs` with their output. Then a clean-context reviewer checks spec fidelity.

### 6.3 The 5-judge test (Q16)
- **Measure 1: time to start.**
  - The timer starts when a fresh browser profile first shows Tabula.
  - It stops at the first 1AC Start, by any method.
  - On test day, only the free path (with the welcome) is measured. The paid path (no welcome) is measured when the paid plan ships.
  - A facilitator stopwatch is the main record.
  - An optional `?study=1` mode keeps two local time marks and shows "Study: 0:47 to start" with [Copy result]. It sends nothing over the network. It never turns on by itself.
  - Target: you set it before test day (Q-12). ★ A median of 60 s or less (free). No judge needs help to start the clock.
- **Measure 2: the test round.**
  - Who: 5 volunteers, with 2 or more parent or lay judges and 1 or more who has never used a flowing app.
  - Devices: a 1366×768 Chromebook, an iPad in landscape, and a phone (clock and ballot only).
  - Each judge flows the same 12-speech practice round, then fills and exports the ballot.
  - The facilitator notes: help requests, accidental pauses, whether the judge found ⌘K or the sheet unaided, and any lost work.
  - This round also tests the unproven "Yours" tag (4.2).
- **Survey.** Questions 1–7 use a 1–5 scale from "Strongly disagree" to "Strongly agree".
  1. "I could start the round without help."
  2. "I always knew if the clock was running."
  3. "I could see all seven columns of the flow at once." (laptop or iPad only)
  4. "I found what I needed without the mouse." (keyboard users only)
  5. "The ballot was easy to finish and send to the tournament."
  6. "I trusted that my work was saved."
  7. "The app felt calm during the round."
  8. (Open text) "What, if anything, slowed you down?"
  9. (Open text) "What would make you use Tabula at your next tournament?"
  - Questions 3 and 4 apply to only some judges. With 5 judges, their medians mean little, so they are reported as raw answers, not medians.
- **Pass line [A].**
  - The time target you set in Q-12 is met.
  - No judge loses work or clock time.
  - Questions 1, 2, 5 and 6 each have a median of 4 or more.
  - Any problem that 2 or more judges name becomes a new spec item.
- The survey form and the facilitator sheet must exist, and be approved by you, before test day.

---

**Sources:**
- /Users/dahlia/Code/debate/docs/design/DECISIONS.md
- /Users/dahlia/Code/debate/docs/design/UX-RESEARCH.md
- the five slice drafts (round safety, copy and dialogs, visual system, Decide and ballot, shell and reach)
- the spec check against DECISIONS.md and the code (app.js, index.html, clipqueue.js, .claude/gates.json)

The files this spec will touch are in /Users/dahlia/Code/debate: index.html, app.js, logic.js, tour.js, about.html, docs/library/learn.css, build-learn.mjs. The new files will be assets/tokens.css, assets/theme-boot.js, keys.js, and the new test files listed in 6.1.

---

## 7. Owner answers to Part 5 (2026-11-20)

| # | Answer |
|---|---|
| Q-1 | Hide the round bar off Flow; show the corner chip instead. |
| Q-2 | Turn `autoEval` and `liveFlow` off once for all current users, with the one-time note. |
| Q-3 | A key that is not remembered stays in `sessionStorage` for this tab (survives a refresh, gone when the tab closes). |
| Q-4 | Live AI flow starts off (follows D2), with the one-time note. |
| Q-5 | Pausing while viewing an earlier speech returns the view to the running speech. |
| Q-6 | **"Record" gets focus first** in the recording notice (owner's choice; not the draft's recommendation). |
| Q-7 | Drop the long streamed decision; keep the "Why the AI chose this" fold. |
| Q-8 | Mono grid font; dropped / conceded / extended marks are typed shorthand with light styling. No data-model change. |
| Q-9 | Grid text is 16 px on touch devices (`pointer: coarse`); laptops keep 13–14 px. |
| Q-10 | Everything under 820 px uses the narrow clock-and-ballot layout. |
| Q-11 | Browser checks are a manual checklist for now (run in the browser pane); add Playwright later, when disk space allows. |
| Q-12 | Pass line: a median of 60 s or less from first view to the first 1AC Start on the free path. Paid path (30 s) measured when paid plans ship. |
