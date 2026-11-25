# Format names and the format pick (design note, draft 1)

Status: plan for owner approval, 2026-11-22. No code changed.

This note answers the owner's four questions about debate formats: names, where a judge picks the format, who uses it, and whether LD and PF stay in Tabula Debate. Each decision has at most two options and one recommendation. §6 has the mock text.

## 0. What the code does today (facts)

| Fact | Where |
|---|---|
| **"Lincoln HS" is not a format name.** It is a school. "Lincoln HS Debate" is the test school in the platform fixtures. The "Judging for" drop-down shows each option as "Judging for: Lincoln HS Debate". (Not checked: whether a phone cuts the text short.) | `logic/account.js` `judgingOptions`; `fixtures/platform-v2.json`; `js/judging.js` |
| **The drop-down on the first screen is "Judging for", not Format.** The "Ready for a round" panel has a "Judging for" select (signed-in judges with a school only). It has no format pick. | `index.html` `#start-panel`, `#start-judging` |
| The format pick is a `<select>` in Round setup, with the names "Policy (CX)", "Lincoln-Douglas (LD)", "Public Forum (PF)". | `index.html` `#format-pick`; `js/formatsetup.js` |
| The names come from `name` in each format file. A published format file never changes, so a new name in the file needs a new version (`ld.v2.js`). | `formats/*.v1.js`; ARCHITECTURE.md §9 |
| `level: 'hs'` is in each file. No screen shows it. | `formats/*.v1.js` |
| **No screen outside Round setup names the format.** The header, Flow, clock and ballot show only side words (Aff/Neg or Pro/Con) and speech names. | `index.html` header; `js/formatsetup.js` `renderSideWords` |
| **The format carries over.** "New round" starts the next round in the last round's format, with no word about it. The first round ever is Policy. | `js/core.js` `freshRound`, `startNewRound`, `#new-round` |
| Changing the format on a round with work asks first ("Start a new … round?", button "Clear and start new"). An empty round switches at once. A `?format=ld` link switches an empty round at once, else shows a toast. | `js/formatsetup.js` `switchFormat` |
| Prep minutes are saved per format (Policy keeps the old `prepMin` key). | `js/core.js` `prepMinSaved` |
| Other places that show the name: the History CSV "Format" column (always, every row), the on-screen History table (only when History holds more than one format or an unknown one), the demo intro (`?demo=policy`, `?demo=ld`) ("This is a Lincoln-Douglas (LD) round…"), the print sheet (only for a format this copy does not have), the `?format=` toast. | `logic/decide.js` `formatLabel`; `logic/demo.js`; `js/formatsetup.js` |
| `about.html` still says "high school policy debate" only. The marketing copy says LD and PF are "coming soon", and the planned `/ld/` and `/pf/` pages are not built. | `about.html`; `docs/marketing/COPY.md`; `docs/marketing/SITES.md` §2 |

**So the real risk is not a mid-round switch.** A mid-round switch already needs a "Clear and start new" click. The real risk is the carry-over: a judge does LD on Saturday, then opens the app for a Policy round next week, and the round starts in LD. Nothing on Flow says so until the speech names look wrong.

## 1. Who uses it (journey first)

| User | When they pick a format | What goes wrong today | What they need |
|---|---|---|---|
| **Lay judge** (parent, first tournament, often PF) | Once, minutes before round 1, from a QR code or link | Does not know "CX" or "LD". Does not open Round setup. Gets Policy, the first-run default. | The format named in plain words on the first screen. A link (`?format=pf`) that sets it. |
| **Experienced judge** (one event all year) | Once per season | Nothing, mostly. Carry-over helps. | Carry-over. A visible chip so they can trust it. |
| **Multi-event judge** (LD in round 2, PF in round 4, same day) | Between rounds, under time pressure | Carry-over starts round 4 in LD. The "New round" dialog does not name the format. | The format choice inside "New round". A chip that says what this round is. |
| **Coach** (sends judges a link, judges too) | Before the tournament, for others | Links work only on an empty round. | `?format=` links, and a first screen that confirms what the link set. |
| **Student** (practice, flows rounds, reads Plain decisions) | Once, for their own event | Same carry-over issue as the multi-event judge, but low cost. | Same as the experienced judge. |

**Journey for one round:** open app → "Ready for a round" → (set up teams) → first speech clock starts → flow, prep, ballot → print or copy → "New round". The two moments where a format choice belongs are **before the first clock** and **at "New round"**. After the first clock, the format must not change.

## 2. Decision 1: the naming rule

| Option | Example | For | Against |
|---|---|---|---|
| **A. Full plain name. No abbreviation, no level.** Short form only where space is tight (the chip on a phone). | "Lincoln-Douglas", "Public Forum", "Policy" | Lay judges read it. Likely matches the event names on NSDA and Tabroom pages (not verified for this note). | Experienced judges say "LD"; they still see "LD" on a phone chip. |
| B. Name plus abbreviation (today) | "Lincoln-Douglas (LD)" | One string serves all screens | Longer. "(CX)" confuses lay judges: CX is also cross-examination. |

**Recommendation: A.** The rule:

1. A format's label is its plain event name: **Policy, Lincoln-Douglas, Public Forum**. Later: World Schools, Big Questions, Parliamentary.
2. Add a level word only when two formats share a name, as a suffix: "Policy (college)". High school is the default and gets no word. So `level: 'hs'` never shows.
3. The short form (Policy, LD, PF) shows only in the narrow chip. It comes from each file's `ai.abbr` (LD, PF). Policy is the one exception: its `ai.abbr` is "CX", so its short form is "Policy".
4. **The labels live in `logic/format.js` next to `formatCopy`**, keyed by format id, not in the format files. Labels are copy, not rules, so they change without a new format version. One function gives them: `labelOf(fmt, 'full' | 'short')`. A format with no table entry falls back to its file `name`. A test checks that every format a judge can pick (`FORMAT_IDS`) has a table entry, so the fallback never shows the old "(LD)" names by accident.
5. **The file `name` stays frozen and becomes a fallback only.** A grep shows that only screens read it: `js/formatsetup.js`, `logic/demo.js`, `logic/decide.js` `formatLabel`. tabula-cloud does not read it; the client sends `format` and `formatVersion` only (ARCHITECTURE.md §9). `fixtures/format-baseline.json` pins it, and that pin stays true because the file does not change.
6. **The existing `decide.formatLabel(round)` stays and calls `labelOf`.** It keeps its "id vN" branch for a format this copy does not have (a ballot from a newer Tabula). No second function with the same name.
7. **The History CSV "Format" cell changes** from "Lincoln-Douglas (LD)" to "Lincoln-Douglas". Old exports keep the old text. This is a visible change: the test that pins the cell gets a visible diff, and the History help names the change. (Option: keep the old CSV text for one season. Not recommended, because the screen and the file would then disagree.)

**Also fix "Judging for":** the select already has the label "Judging for", so the options read "Lincoln HS Debate" and "Just me", not "Judging for: Lincoln HS Debate".

## 3. Decision 2: where and how the judge picks the format

| Option | How it works | For | Against |
|---|---|---|---|
| **A. A per-round pick, shown at round start and at "New round". It carries over. A chip always shows it.** | Round setup has three large choices (radio cards, not a drop-down). "Ready for a round" says "Format: Lincoln-Douglas · Change". The "New round" dialog has the same three choices, with the last one picked. The pick locks after the first speech clock. A header chip shows the format at all times. | One source of truth: the round. The choice appears at the two moments that matter. Matches how "Judging for" already works (picked before the first speech, then locked). | One more line on the first screen and in the dialog. |
| B. A default "My event" in Settings, plus a per-round change in Round setup | Settings holds the default for every new round. Round setup can change it for one round. | Fits a judge with one event all year. | Two places hold a format. A multi-event judge must change the default or the round each time. The reset sits in Settings, which a judge between rounds does not open. |

**Recommendation: A.** Details:

- **Carry-over stays.** It is right for most judges. The fix is to make it visible, not to remove it.
- **The reset is "New round".** A new tournament or a different event starts with "New round", and that dialog now asks which format. No hidden setting to reset.
- **Lock after the first speech clock.** One predicate for both locks: `formatLocked(round)` calls `judgingLocked(round)` (`logic/account.js`), so the two locks cannot drift. Before the clock: change freely; if names are typed, it still asks first. After the clock: the choices are shown but disabled, with the line "Set for this round. Start a new round to change it." This removes the "Clear and start new" path from the middle of a round.
- **Radio cards, not a `<select>`.** All three names show at once with one line each, so a judge sees what they did not pick. A closed select can change with arrow keys or a stray scroll.
- **The chip.** A quiet pill in the header, left of the clock chip: "Lincoln-Douglas". Under 480 px: "LD". Pressing it opens Round setup. It never changes the format itself.
- **`?format=` links** keep working. On an empty round the link sets the format and the first screen shows "Format: Public Forum (from your link) · Change".
- Prep per format (`prepMinSaved`) stays as it is.

## 4. Decision 3: do LD and PF stay in Tabula Debate?

| Option | For | Against |
|---|---|---|
| **A. LD and PF stay in Tabula Debate.** Speech Events gets a hand-off card ("Judge this round in Tabula Debate"). | Room shape decides the app: two sides, a resolution, cross-examination, prep, a flow and a win-or-loss ballot. All of that is built and live in Tabula Debate today, including PF since 2026-11-22. Same account in both apps. Already the rule in `docs/events/SEASON.md` §4 and `docs/events/CATALOG.md`. | A judge in a state with one combined season may look on tabulaforensics.com first. |
| B. Move LD and PF to Speech Events | Fits states where LD runs with the spring speech meet (Texas UIL, Oklahoma, Missouri) | Speech Events would need a second copy of the clock, prep, flow, ballot and Round Map. The same LD round would belong to a different app in different states. No league judges LD as a speech event (SEASON.md §3). |

**Recommendation: A.** The word "forensics" changes by state: speech and debate in one season in many states, speech only in some (the owner names Wisconsin and Minnesota; this note did not verify those two). The app split should not follow a word that changes by state. It follows the room. The sites carry the word problem instead. Today SITES.md §2 gives tabulaforensics.com the text "Tabula Speech Events: extemp, oratory, interp, Congress. Coming later." It has no link to debate. Proposed:

- Add a "Judging debate? Tabula Debate" link near the top of tabulaforensics.com.
- Check that tabulaspeech.com (the parent: plans, sign-in, all products) names both apps, so a combined-season judge finds both with one account.
- The Speech Events hand-off card (SEASON.md §4) links to `debate.tabulaspeech.com`. Proposed: add `?format=ld` (or `pf`, `policy-hs`) so the round opens in the right format (the link form is in `docs/growth/BRAND.md`).

**Research that would confirm it:**

1. Read `docs/marketing/SITES.md` §2 and `docs/growth/FORMATS.md` §3 against the hand-off link above, and check that the forensics site copy names debate and links out. (Desk check, one hour.)
2. Verify how Wisconsin (WHSFA, WDCA) and Minnesota (MSHSL) name their speech and debate seasons, from the league sites. (Desk check.)
3. Five short talks with judges or coaches: two from a combined-season state, two from a split-season state, one Texas UIL. Ask: "Where would you look for an LD judging tool?" (One week.)
4. After launch: count `?format=` visits from each marketing site, and hand-off card clicks. (Analytics, no new code beyond the card.)

## 5. What would change (if the owner says yes)

Small and front-end only. No format file changes, no server change.

**Core (answers the owner's questions):**

1. `logic/format.js`: a label table and `labelOf(fmt, 'full' | 'short')` (§2 rules 3 to 6). Every screen read of `fmt.name` moves to it: `js/formatsetup.js` (the picker, the switch question, the `?format=` toast), `logic/demo.js` (demo intro), `logic/decide.js` `formatLabel` (History and CSV).
2. Round setup: radio cards for the format, locked by `formatLocked`.
3. Header: a format chip (opens Round setup).
4. "New round" dialog: the three format choices, last one picked. `ask()` today takes a title, a body and buttons, and returns the button value. It gets one new optional field, a radio group, and returns `{ value, choice }` when that field is used. Callers without it keep the plain return value. `copy-dialogs.test.mjs` gets a new test for the new field.
5. "Ready for a round": a "Format: … · Change" line. This one is for the lay judge, who never opens the dialog in step 4 before round 1. If the owner wants fewer surfaces, drop this step; the chip still shows the format.

**Optional, separate (not format naming, found on the way):**

6. "Judging for": options without the "Judging for: " prefix. This is the "Lincoln HS" text the owner saw.
7. Print sheet: always print "Format: Lincoln-Douglas" in the facts block.
8. `about.html` and its description still say "policy debate" only. The marketing copy ("coming soon") and the planned `/ld/` and `/pf/` pages in tabula-sites should use the same names (Policy, Lincoln-Douglas, Public Forum).

**Tests:** new tests for each change. Where a name changes on screen or in the CSV, the old assertion is changed in a visible diff for review, never deleted. `fixtures/format-baseline.json` does not change.

## 6. Mock text

**Chip (header):** `Policy` · `Lincoln-Douglas` · `Public Forum`. Under 480 px: `Policy` · `LD` · `PF`.
Screen reader name: "Format: Lincoln-Douglas. Opens Round setup."

**Round setup, Format (before the first speech):**

> **Format**
> ( ) **Policy** — Two debaters per side. Eight speeches with cross-ex.
> ( ) **Lincoln-Douglas** — One debater per side. Value and criterion.
> ( ) **Public Forum** — Two debaters per side. A coin flip picks who speaks first.
> Pick the event on your ballot. A round keeps its format.

**Round setup, Format (after the first speech):** the same choices, disabled, with:

> Set for this round. Start a new round to change it.

**"Ready for a round" panel:**

> **Ready for a round**
> Format: **Lincoln-Douglas** · Change
> (from a link: Format: **Public Forum** (from your link) · Change)

**"New round" dialog:**

> **Start a new round?**
> This clears the flow, clocks, docs and any audio not yet transcribed. Saved ballots stay in History.
> Format for the new round: ( ) Policy (•) Lincoln-Douglas ( ) Public Forum
> [Cancel] [Clear and start new]

**Format change before the first speech, with names typed:**

> **Start a new Public Forum round?**
> A round keeps the format it started with. This clears the flow, clocks, docs and any audio not yet transcribed. Saved ballots stay in History.

**`?format=` link on a round with work (toast):**

> This link is for a Public Forum round. This round is Lincoln-Douglas. To switch, start a new round.

**"Judging for" options:** `Lincoln HS Debate` · `Just me`

**Print sheet facts:** `Format: Lincoln-Douglas`
