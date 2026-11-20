# No stripes, and a button system

Status: proposal for the owner. Nothing in this file is built yet.
Date: 2026-11-20.
Scope: `index.html`, `assets/tokens.css`, `app.js`, `ui.js`, `about.html`, `docs/library/learn.css`.

## 1. The rule

A **stripe** is a thin coloured bar that is used as an accent. Examples: a left or right border bar, a top or bottom bar, an inset box-shadow bar, a bar under a header or tab, or a `::before` / `::after` bar.

The owner says a stripe is a sign of AI-made UI. Remove all stripes.

These things are **not** stripes, and they stay:

- A plain 1 px neutral divider (`--border` or `--border-ctl`) between rows, columns, or bars.
- A control border (a full 1 px edge on a button, field, card, or dialog).
- A full outline on all four sides (for example the 2 px `--text` edge on the current speech tile).
- A dot with a word next to it.
- A data bar that shows a quantity (the Live Eval tally bar, the mic level meter).
- A text underline that is a link, or a text mark in a diff ("added" text).

Line numbers below come from the files on 2026-11-20. Another build is editing these files now, so the numbers can move. Search by the selector.

## 2. Audit

### 2.1 Real stripes (remove)

| # | File:line | Component | What it shows | In spec? |
|---|---|---|---|---|
| S1 | index.html:106 `.flow .col.is-current h3 { box-shadow: inset 0 -3px 0 var(--text) }` | Flow grid, current speech column: a 3 px `--text` bar under the column header | Current (the running speech, else the one on screen) | Yes. SPEC V7: "a 3 px `--text` bar under its header". |
| S2 | index.html:594 `@media (forced-colors)` `.flow .col.aff h3, .mapsheet .mh.aff, .sp.aff, .mcard.aff { border-top: 3px solid CanvasText }` | Aff column headers, Aff round-map headers, Aff speech tiles, Aff map cards, in Windows high contrast only | Side (Aff) | Yes. SPEC V12. |
| S3 | index.html:595 same, `.neg`, `border-top: 3px dashed CanvasText` | Neg headers, tiles and map cards, in Windows high contrast only | Side (Neg) | Yes. SPEC V12. |
| S4 | about.html:41 `.who div { box-shadow: inset 3px 0 0 var(--border-ctl) }` | About page, "Who it is for" blocks: a 3 px grey left bar | Nothing. Decoration only. | No. |
| S5 | about.html:42 `.who div:nth-child(1) { box-shadow: inset 3px 0 0 var(--aff-fill) }` | "Judges" block: a 3 px blue left bar | Nothing. It also breaks the rule "Aff blue is data only". | No. |
| S6 | about.html:43 `.who div:nth-child(2) { box-shadow: inset 3px 0 0 var(--neg-fill) }` | "Coaches" block: a 3 px red left bar | Nothing. It also breaks the rule "Neg red is data only". | No. |

Total: 6 real stripe rules. S1 is the only one a judge sees in normal use. S2 and S3 show only in Windows high contrast. S4 to S6 are on the About page.

### 2.2 Borderline accents (text marks on the flow grid)

These are not bars under a header or tab. But they are coloured underlines used as accents, so the owner may want them gone too.

| # | File:line | Component | What it shows | Note |
|---|---|---|---|---|
| B1 | index.html:121 `.flow-hl .fm-drop { background: var(--caution-tint); text-decoration: underline dashed var(--caution) }` | Flow mark layer: a dashed orange-brown underline under a dropped argument | Status: dropped | The underline is the only thing that makes "dropped" look different from "conceded" (B2 uses the same tint). The typed mark in the textarea also carries the meaning. |
| B2 | index.html:125 `.flow-hl .fm-weigh { text-decoration: underline var(--border-ctl) }` | Flow mark layer: a grey underline under a weighing line | Status: weighing | Neutral colour. Low risk. |

### 2.3 Checked and kept (not stripes)

**1 px neutral dividers.** All stay.

- index.html:22 header bottom line (SPEC V6). index.html:100-101 column lines. index.html:102 line under each column header. index.html:129-131 table header and row lines. index.html:147 line between segments. index.html:151, 153 round-map grid lines. index.html:185 AI bar bottom line. index.html:200 sub-nav line. index.html:232, 316, 322 Insights edge line. index.html:294 round bar top line. index.html:332 Settings sub-section line. index.html:364 help menu separator. index.html:420 recording strip top line (a full-width banner row with a fill, not an accent bar). index.html:586 ballot bar top line in the narrow layout.
- about.html:31 section lines, about.html:46 footer line.
- learn.css:27 `h2` top line, learn.css:40 `blockquote.plain` bottom line, learn.css:44-46 table lines, learn.css:57 footer line, learn.css:91 quiz question line.
- In forced colors: index.html:598 recording strip line, index.html:602 tally segment gaps.

**Full outlines and control borders.** All stay. They are on all four sides.

- index.html:44 invalid field, 2 px `--error` (SPEC V5).
- index.html:76 current speech tile, 2 px `--text` (SPEC V6).
- index.html:105 current column, 1 px inset `--border-ctl` on all sides (SPEC V7).
- index.html:124 `.fm-turn`, 1 px inset outline on all sides.
- index.html:160 dropped map card, 2 px dashed `--caution`. index.html:162 ghost map card, 2 px dashed.
- index.html:427 running tile, dashed `--text` edge. index.html:462 chosen winner card, 2 px `--text`.
- index.html:596, 601 forced-colors `Highlight` outlines.
- learn.css:126 print certificate frame (3 px double border on all sides, print only).

**Dots, data bars, text marks.** All stay.

- index.html:222 `.sp-dot` (has a transcript, with `aria-label`). index.html:247 `.tip.warn::after` (problem dot; the words are in the tip and the round bar).
- index.html:347-352 mic meter. index.html:545-547 Live Eval tally bar. index.html:371-374 tour step dots (the active one is a 16 px pill; "Step n of m" text is next to it).
- index.html:193, 235 link underlines. index.html:522-523 review diff: struck-out removed text and underlined added text (SPEC 4.4 needs a mark that is not colour).
- index.html:509 `.draft-panel::after` fade at the scroll edge. index.html:119 `.flow-hl::after` spacer. index.html:563 table-card labels.

**Already fixed.** The error toast (index.html:387) and the speech tiles (index.html:75) lost their left stripes in Slice 4. `no-stripes.test.mjs` guards those two cases. learn.css:35 already has a plain bordered quote.

**app.js, ui.js, tour.js.** No inline style builds a stripe. Inline styles there are margins, widths, and grid columns only. Two comments name the bar: app.js:1139 ("gets a bar under its header") and logic.js:1577 ("the column with the bar and outline"). Change their words when S1 changes.

**tokens.css.** No stripe rules. It holds values only.

## 3. Research (Mobbin)

I looked at web screens in Mobbin for each signal. No app below uses a coloured side or under bar for these signals. The pattern is the same everywhere: **a fill, a full outline, or a badge, with a word or an icon.**

| Signal | What good apps do | Apps and screens |
|---|---|---|
| Current column in a grid | The column header cell gets a tinted fill. The selected cell gets a full outline. No bar. | Canva Sheets: [column E selected](https://mobbin.com/screens/4ab3434e-801c-4c34-b18c-94d3cc959f68) |
| Current item in a list or set | A tinted fill on the whole item, often with a number badge. Or a full outline plus a word badge. | Canva course: [current lesson](https://mobbin.com/screens/a7cd3c76-aba0-430c-bf40-6c90051f71dc). SchoolAI: [current level is a filled block, done level has "Complete" pill](https://mobbin.com/screens/97444c26-8d32-4c21-bdb8-fc94317e3c06). Upwork: [highlighted plan, full outline plus "Popular" badge](https://mobbin.com/screens/502cf8d4-d0d6-44de-a377-ab4c5ea4fb91) |
| Active nav item | A neutral grey fill behind the item. Text gets darker. | Attio: [sidebar "Home"](https://mobbin.com/screens/e108013b-c098-4c42-b56f-f263b5f165d7). Base44: [sidebar "Plugins"](https://mobbin.com/screens/03025a56-218d-481b-8ebd-ec40f8685b0c). Microsoft Copilot: [settings nav, dark](https://mobbin.com/screens/18c204dd-b62a-452a-a0d8-9b335b7a73ef) |
| Selected chip or segment | Filled pill (black or tint), or tint plus a full 1 px outline in the same hue. | Voicenotes: [filter "All" filled black](https://mobbin.com/screens/d3769275-2a36-476d-8d07-f95e5fbef2fd). Braintrust: [selected stack chip, tint plus outline; segment with raised fill](https://mobbin.com/screens/5528ccac-6193-49d8-926a-ae7f5ae2d32d). Monarch: [selected choices, tint plus outline](https://mobbin.com/screens/2e2a46cd-7ee4-4501-810d-0a28419ca998). Productboard: [health segment "On track"](https://mobbin.com/screens/ead7966b-2b6c-4cbc-87a5-46da767d68b4) |
| Live or running item | A small pill with a dot and a word or a timer: "● REC 4:03", "Recording", "Transcribing". | Descript: ["REC 4:03" pill](https://mobbin.com/screens/051f13d2-9464-4ff1-8778-60377364a195). Contra: [dot plus timer pill](https://mobbin.com/screens/82c7b80c-c3e5-4fe1-8bdd-3789ba5df30f). Canva: ["Recording" badge](https://mobbin.com/screens/ec3936a0-a9e9-4d41-9837-257decc1cae2). Voicenotes: ["Recording in progress" plus "Transcribing"](https://mobbin.com/screens/d3769275-2a36-476d-8d07-f95e5fbef2fd) |
| Status on toasts and banners | A neutral or dark toast with a status icon and words. Or a light tint with a full 1 px edge. | incident.io: [dark toast, check icon](https://mobbin.com/screens/95aaf7c9-36d3-465e-b68a-93b28830884f). VEED: [white toasts, green check icon](https://mobbin.com/screens/7e2ca76e-cb4b-450c-835e-edcc82743228). Spellbook: [tint plus full edge](https://mobbin.com/screens/e8fb514e-3595-4d82-ad83-43e3fa63a6ee) |
| Group or category headers | Icon plus label plus count. A neutral full-width fill band for a group row. Filled badges on cards. | Plane: [status groups](https://mobbin.com/screens/17ebd9cd-d91f-4d73-8a4f-b312b03c294c). incident.io: [board columns, "Critical" filled badge](https://mobbin.com/screens/be22fc87-f147-4aa1-81f6-5f213d007715). hilos: [board columns](https://mobbin.com/screens/43913a72-1e2f-4fba-8518-c63556c92e43). Productboard: [grouped table](https://mobbin.com/screens/7f56f9b0-9cfc-4a34-9c11-4644c60e85d7) |
| Cards in a set (About page) | Plain cards with one border and the same fill. No colour per card. | Base44: [skill cards](https://mobbin.com/screens/03025a56-218d-481b-8ebd-ec40f8685b0c). Descript: [learn cards](https://mobbin.com/screens/d72579f2-f1af-4ce5-b6b5-88aa345f7286) |
| Buttons | One solid dark primary. Secondary is white with a 1 px edge, or a light grey fill. Quiet actions are text only. Danger is solid red on the final confirm only, or a soft red tint. In dark mode the primary inverts (light fill, dark text). | Square: [black primary, grey secondary](https://mobbin.com/screens/9fbad6f3-3efb-468e-8369-57d843cc467e). Productboard: [Cancel outlined, Delete solid red](https://mobbin.com/screens/87e3de05-3be4-416b-8783-8ad1cddd6e41). Dropbox Dash: [Cancel grey fill, Delete solid, "Clear history" text-only](https://mobbin.com/screens/0a91ed69-5bdf-44dc-97a9-26cebfca233b). Gumloop: [soft danger, tint with red text](https://mobbin.com/screens/2090e43e-1ee4-498f-8166-3e8ca80bc593). SoundCloud: [dark mode, white primary, text-only Cancel](https://mobbin.com/screens/b6ee4eec-96c1-485f-ae4f-286ab9d246b3) |

A fair note: some of these apps (Productboard, Canva) still use an underline under their top-level tabs. Tabula already uses fills for its tabs (`nav button.on`, `.subnav button.on`, `.flowtabs button.on`), so Tabula needs no change there.

## 4. Replacements

Rules that every replacement follows:

- Aff blue and Neg red are data colours only.
- Colour never carries meaning alone. A word or an icon goes with it.
- No text under 13 px (`--fs-1`).
- WCAG AA contrast in light and dark. Ratios below are from the token values in `assets/tokens.css`.
- Tokens only. No raw values in the app.

### S1. Current speech column: 3 px bar under the header

**Replacement.** Remove the bar. Make the "Now" label a filled pill. Make the column outline stronger.

- `.col-mark` for "Now": a pill. Fill `--accent`, text `--on-accent`, `--fs-1`, `--fw-3`, padding `0 var(--s2)`, radius `--r-pill`. Contrast: light 17.63:1, dark 15.95:1.
- `.col-mark` for "Viewing": an outline pill. Fill none, 1 px `--border-ctl`, text `--text-2`, same size. Contrast: text on `--aff-tint` or `--neg-tint` is above 9:1 in both modes; the `--border-ctl` edge is 3.39:1 or more against the light surfaces and 3.52:1 or more in dark.
- The header keeps its side tint (`--aff-tint` / `--neg-tint`) and side text colour. Those are data.
- Column outline: change `inset 0 0 0 1px var(--border-ctl)` to `inset 0 0 0 2px var(--text)`. This matches the current speech tile (2 px `--text`, SPEC V6), so "current" has one look in the app. Owner decision D2 picks this or keeps 1 px.
- JS: `markFlowColumns()` sets a class on the mark (for example `is-now` / `is-viewing`) next to the text it sets now. The word stays, so screen readers and high contrast keep the meaning.

**Why it is better.** The word "Now" becomes the strongest thing in the header, so the signal is a word, not a line. A filled pill is the pattern that Descript, Contra and Canva use for "live". A full outline on all four sides reads as "this whole column", where the bar only marked the header.

**Tokens.** `--accent`, `--on-accent`, `--border-ctl`, `--text-2`, `--text`, `--r-pill`, `--fs-1`, `--fw-3`, `--s2`.

**Also change.** SPEC V7 "Current speech" line. Comments at app.js:1139 and logic.js:1577.

### S2, S3. Forced colors: 3 px top borders for Aff and Neg

In Windows high contrast, the tints and side colours are gone. The browser paints every colour as a system colour. So something must carry the side.

**Replacement (recommended).** Show the side as a word in forced colors only. Inside `@media (forced-colors: active)`:

- `.flow .col.aff h3::after, .mapsheet .mh.aff::after { content: "Aff"; }` and the same for Neg. Style it as a small pill: 1 px `CanvasText` border on all sides, `--r-pill`, `--fs-1`.
- For `.sp.aff` / `.sp.neg` tiles, the same "Aff" / "Neg" word after the label.
- `.mcard.aff` / `.mcard.neg`: the same word.

**Why it is better.** A word is clearer than "solid line means Aff, dashed line means Neg". The user does not have to learn a code. It also removes the last stripe.

**Fallback.** If the owner prefers no new content, keep S2 and S3. They are in spec, they show only in high contrast, and a normal user never sees them. This is allowed by the brief, because in that mode nothing else carries the side today. Owner decision D3.

**Tokens.** System colours `CanvasText` (required in forced colors), `--r-pill`, `--fs-1`.

**Also change.** SPEC V12 text.

### S4, S5, S6. About page "Who it is for" blocks

**Replacement.** Remove the three inset bars. Give each block the same plain card as `.step` on the same page: fill `--panel`, 1 px `--border`, radius `--r-xl`, padding `--s4`. The bold title stays. No colour per block.

**Why it is better.** The bars meant nothing. Two of them used Aff blue and Neg red for audiences, which breaks the "data only" rule and suggests that judges are "Aff". Plain equal cards are the pattern in Base44 and Descript.

**Tokens.** `--panel`, `--border`, `--r-xl`, `--s4`. (about.html still has raw px values such as `12px` and `14px`. Change these to tokens at the same time.)

### B1. Dropped mark: dashed underline

**Replacement.** Change the underline to a full 1 px dashed outline on the span: `box-shadow` cannot be dashed, so use `outline: 1px dashed var(--caution); outline-offset: -1px` on the span. Keep the `--caution-tint` fill.

**Why it is better.** It matches the dropped map card (`.mcard.dropped`, a full dashed `--caution` edge), so "dropped" has one look in the app. It is still different from "conceded" (fill only). The typed mark in the text stays, so colour does not carry the meaning alone.

**Tokens.** `--caution`, `--caution-tint`. Contrast of `--caution` on `--caution-tint`: light 6.54:1, dark 10.07:1.

**Note.** Test this in the grid. An outline on an inline span that wraps can draw odd corners. `box-decoration-break: clone` is already set on these spans and helps.

### B2. Weighing mark: grey underline

**Replacement.** A full 1 px dotted outline in `--border-ctl` on the span. `.fm-turn` keeps its solid 1 px outline, so turn is solid and weigh is dotted.

**Why it is better.** All flow marks then use fills and full outlines only. No underlines are left as accents.

**Tokens.** `--border-ctl`.

B1 and B2 are optional. Owner decision D4.

### Guard

Extend `no-stripes.test.mjs` (in the build that makes these changes, not now):

- Scan index.html, about.html and learn.css, not only index.html.
- Fail on any `box-shadow: inset` where only one offset is set (for example `inset 0 -3px 0`, `inset 3px 0 0`).
- Fail on `border-left`, `border-right`, `border-top` or `border-bottom` wider than 1 px, outside the forced-colors block (or everywhere, if the owner picks the word option in D3).
- Allow full outlines (`inset 0 0 0 Npx`) and 1 px dividers.

Each test needs a one-line header that says why the rule matters, as the repo does now.

## 5. Button system

### 5.1 What is there now

- `button.b` (index.html:51-57) is the secondary button: `--panel` fill, 1 px `--border-ctl`, `--text`. Hover `--sunk` and `--text-2` edge. Pressed `--border` fill. This is good.
- `button.b.primary` is `--accent` fill. Hover is `--text-2`. There is no pressed state.
- `button.b.danger` (index.html:405) is an outline: `--error` text and edge on `--panel`. It looks like a secondary button with a coloured edge. In the four danger dialogs (app.js:319, 960, 1993, 3041) it does not look like the final, strong choice.
- There is no quiet (text-only) button class. Many places build one by hand: `nav button`, `.subnav button`, `.help-menu button`, `.ins-edge-btn`, `.toast-x`, `.linkish`.
- about.html and learn.css have `.btn` and `.btn.primary` with no hover or pressed state.

### 5.2 Proposal

Four kinds. One look per kind on all three page types.

| Kind | Use | Default | Hover | Pressed | Focus |
|---|---|---|---|---|---|
| **Primary** `.b.primary` | The one main action in a view or dialog: Start / Pause, Print / PDF, Save, Continue. At most one per view. | Fill `--accent`, text `--on-accent`, edge `--accent` | Fill `--accent-hover` | Fill `--accent-press` | 2 px `--ring`, offset 2 px |
| **Secondary** `.b` | Every other action, and Cancel in dialogs. | Fill `--panel`, text `--text`, 1 px `--border-ctl` | Fill `--sunk`, edge `--text-2` | Fill `--border` | same |
| **Quiet** `.b.quiet` (new) | Low-priority actions in a dense row: Rename, Hide, Dismiss, "Show transcript", menu items. Never the only way to do a main task. | No fill, no edge, text `--text-2` | Fill `--sunk`, text `--text` | Fill `--border`, text `--text` | same |
| **Danger** `.b.danger` | Only the confirm button in a danger `ask()` dialog: "Clear and start new", "Delete audio", "Remove key", "Restore". | Fill `--danger-fill`, text `--on-danger`, edge `--danger-fill` | Fill `--danger-hover` | Fill `--danger-press` | same |

Shared rules:

- Disabled is the same for all kinds (SPEC V5): `--sunk` fill, `--text-3` text, `--border` edge, `not-allowed` cursor. No opacity.
- Size: `--h-md` (32 px), 44 px in the narrow layout. Text `--fs-2`, `--fw-3`. Radius `--r-md`.
- Selected toggles (segments, sheet tabs) keep `--accent` fill with `aria-pressed` (SPEC V5). They are not buttons of a kind above.
- An inline delete (for example a saved-ballot row) stays a secondary or quiet icon button with a trash icon and an Undo toast. Only the dialog confirm gets the solid danger fill. This is what Productboard and Dropbox Dash do.
- A quiet button must still look like a button at rest: it has a clear verb label or an icon, and a 24 px or larger hit area. Do not hide it until hover.
- about.html and learn.css: `.btn` uses the secondary values, `.btn.primary` the primary values, both with the hover and pressed states above.

### 5.3 New tokens

Add to `assets/tokens.css` in all four blocks (light, dark by `data-theme`, dark by media query, print). `tokens.test.js` checks that the two dark blocks are equal.

| Token | Light | Dark | Note |
|---|---|---|---|
| `--accent-hover` | `#3c434c` (= `--text-2`) | `#c3c9d0` (= `--text-2`) | Same as today's hover. A token makes it one name in every file. |
| `--accent-press` | `#000000` | `#ffffff` | Pressed goes one step further from the canvas. |
| `--danger-fill` | `#b93d0a` (= `--error`) | `#ff9a5c` (= `--error`) | Same hue as errors. Red stays Neg only. |
| `--on-danger` | `#ffffff` | `#0f1114` | Like `--on-accent`, the text flips in dark mode. |
| `--danger-hover` | `#9a3208` | `#ffb382` | |
| `--danger-press` | `#7f2906` | `#ffc8a3` | |

No new tokens are needed for secondary or quiet. They use `--panel`, `--sunk`, `--border`, `--border-ctl`, `--text`, `--text-2`.

### 5.4 Contrast (WCAG 2.x ratio)

Text needs 4.5:1. Control edges and fills that show a control need 3:1.

| Pair | Light | Dark |
|---|---|---|
| Primary text on `--accent` | 17.63 | 15.95 |
| Primary text on `--accent-hover` | 10.00 | 11.33 |
| Primary text on `--accent-press` | 21.00 | 18.91 |
| Secondary text on `--panel` | 17.63 | 14.72 |
| Secondary text on `--sunk` (hover) | 15.45 | 15.55 |
| Secondary text on `--border` (pressed) | 13.82 | 12.03 |
| `--border-ctl` edge on `--panel` | 3.69 | 3.52 |
| `--border-ctl` edge on `--canvas` | 3.39 | 3.81 |
| Quiet text `--text-2` on `--canvas` | 9.17 | 11.33 |
| Quiet text `--text-2` on `--panel` | 10.00 | 10.46 |
| Danger text `--on-danger` on `--danger-fill` | 5.62 | 9.03 |
| Danger text on `--danger-hover` | 7.41 | 10.83 |
| Danger text on `--danger-press` | 9.45 | 12.64 |
| `--danger-fill` against `--panel` (the button shape) | 5.62 | 8.34 |

All pass AA. The danger fill also passes 3:1 as a shape, so the button reads as a button without its edge.

### 5.5 Rule change this needs

tokens.css and SPEC say "Orange is only for errors and over time". The danger button would add a third use: "and the confirm button of a destructive dialog". The danger button always has a verb label ("Delete audio"), so colour does not carry the meaning alone. Owner decision D5.

## 6. Decisions for the owner

**Owner answer (2026-11-20): "Yes, apply all."** All recommended choices are approved: D1 remove all six stripes; D2 2 px `--text` outline on the current column; D3 "Aff"/"Neg" word in high-contrast mode; D4 flow-mark underlines become outlines; D5 solid danger button, with the colour-rule change; D6 shared quiet button; D7 update SPEC V5, V7, V12 and Part 2, and add the no-stripe rule. Applied after Slice 5.


1. **D1. Approve the stripe list.** Six real stripes (S1 to S6) go. Dividers, full outlines, dots and data bars stay.
2. **D2. Current column outline.** (a) 2 px `--text` on all sides, the same as the current tile (recommended). (b) Keep the 1 px `--border-ctl` outline, and let the filled "Now" pill do the work.
3. **D3. High contrast.** (a) Replace the 3 px top borders with an "Aff" / "Neg" word in forced colors only (recommended). (b) Keep the borders, because only high-contrast users see them.
4. **D4. Flow marks B1 and B2.** Change the two underlines to full outlines (dashed for dropped, dotted for weighing), or leave them as text marks.
5. **D5. Danger button.** Approve a solid `--danger-fill` button for dialog confirms only, and the one-line change to the "orange is only for errors" rule. The other choice is a soft danger (`--error-tint` fill, `--error` text: 5.04:1 light, 7.19:1 dark).
6. **D6. Quiet button.** Approve a shared `.b.quiet` class, so the six hand-made text buttons get one look.
7. **D7. Spec edits.** When approved, update SPEC V7 (current speech), V12 (forced colors), V5 (button kinds and pressed primary), Part 2 (new tokens), and add the no-stripe rule to Part 2 so later builds see it.
