# UI/UX decisions (owner, 2026-11-19)

Answers to the grill-me questions in `UX-RESEARCH.md` §6. The spec and the build follow these.

| # | Topic | Decision |
|---|---|---|
| Q14 | Order of work | **Round safety first** (clock survives refresh, view-only look-back, Space rule, toasts above the drawer, 7 columns at 1366 px), then copy and dialogs, then the new look and tokens. |
| Q1 | Flow layout | **Only the flow grid is a raised card.** Side panes sit flat on the page color. |
| Q4 | 7 columns at 1366 px | **Left pane hidden by default below 1440 px**; columns shrink to about 96 px; one key or click opens the pane. |
| Q2 | Grid text size | **13–14 px** in the flow grid and dense panes. Forms and reading text use 16 px (default D3). |
| Q5 | Clicking an earlier speech while the clock runs | **View only.** The clock and recording keep going. Label: "Viewing 1NC · 2AC running". |
| Q6 | Space key | **Space starts/pauses the clock only on Flow, when nothing is focused.** **Cmd+Enter / Ctrl+Enter** works everywhere on Flow, also while typing. |
| Q7 | Transcript | **Drawer only** (from the round bar). Removed from the left pane. |
| Q8 | Insights pane with no AI | **Folds to a thin edge** with one quiet "Connect AI" button; under 1180 px, a compact card with the reason "Live insights need AI." (CHANGED 2026-11-20, owner request. Old text: "with one 'Connect AI' link.") |
| Q9 | AI ballot features | **One "Draft with AI" panel inside the Ballot.** Decision draft is no longer its own tab. |
| Q10 | Speaker points range | **A setting in Round setup**, default 25–30. |
| Q11 | First-time screen | **A lighter welcome screen, for free (bring-your-own-key) users only.** Paid-plan users skip it: hosted AI with credits just works, with no keys or model choices. All welcome copy, including the skip page, becomes short, clean and plain. |
| Q12 | Top-nav name for saved ballots | **"Ballots".** "Debate library" stays under ?. |
| Q13 | Command palette | **Yes, Cmd+K**, listed under ? as "Search and commands". |
| Q15 | Expert / Plain switch | **Moves to Settings and Round setup.** Out of the top bar. |
| Q3 | Theme | **Light / Dark / System choice in Settings**, System by default. |
| Q17 | Phone layout | **Yes for clock, prep and ballot.** The flow grid stays tablet and laptop only. |
| Q18 | Smallest supported device | **1366×768 and iPad landscape.** |
| Q19 | Recording consent | **A plain notice before the first recording, a visible "Recording" strip while the mic is on**, and audio deleted after transcription (already true since B1). |
| Q20 | After the ballot | **Print / PDF first, then "Copy for the tournament ballot".** |
| Q16 | How we measure success | **Time for a first-time judge to start a round, plus a test round with 5 volunteer judges and a short survey.** |

## Defaults to apply unless the owner objects (§6.0)

- **D1.** API keys are not remembered by default ("Remember on this device" box, off). Note: today the default is on.
- **D2.** No paid AI call runs by itself: auto Live Eval and auto ballot fill start off.
- **D3.** Forms and reading text use 16 px.

## Already decided elsewhere

- Everything help-related sits under the ? menu (tours, Debate library, About, and now "Search and commands").
- Hover tips: small and calm; about 0.5 s for help bubbles, 1 s for sheet-tab names.
- No model or company is favored in copy.
- Short sheet tabs (T, DA, CP, K) with full names on long hover. 4×3 speech grid. Flow first in the nav.

## Spec answers (2026-11-20)

See `SPEC.md` §7 for the 12 spec answers (round bar off Flow, old defaults off once, key kept per tab, Live AI flow off, Record focused first, mono grid, 16 px grid on touch, narrow layout under 820 px, manual browser checks, 60 s first-run target).
