# Tabula — plan

A free judging tool for high school policy debate, by Pattern Engine LLC.
This plan covers: saving the data you have now, the brand, a UI/UX redesign, live in-room audio, the About page, open source, and paid round packs.

---

## 0. Do first: save your data (no risk, about 30 minutes)

Your rounds live in **your Chrome**, not in the server. The server only hands Chrome the page. So the data is safe as long as Chrome keeps its site data for `localhost:8765`.

To protect it and move it later:
- **Export everything** (Settings): one `.json` file with all rounds, flows, transcripts, ballots, analysis, settings and docs. Keys are left out unless you tick "include keys".
- **Import**: loads that file into any copy of Tabula (a new port, a hosted site, a friend's laptop).
- **Auto-backup**: after each saved ballot, the app offers to download a backup.
- Keep the **Log** as the long-term record. Today it only keeps ballot rows. It should keep whole rounds.

Also: the logo files you sent go into `assets/` (black mark, white mark, black and white wordmark).

---

## 1. Brand: Tabula

- **Mark**: the clipboard flow sheet between a blue and a red speech bubble. It already says "Aff vs Neg, judged on a flow". Use it as the app icon and favicon.
- **Wordmark**: heavy italic sans. Black on light, white on dark (both files exist).
- **Colors from the logo**: Aff blue about `#0055B8`, Neg red about `#F2232D`. These become the Aff/Neg tokens. Everything else stays neutral gray, so color always means a side.
- **Color decisions (step 2, as built)**:
  - Side colors: Aff `#0055B8`. Neg uses the logo red `#F2232D` for bars and fills, and a deeper `#C8161F` for small text, so it stays readable (WCAG AA).
  - Errors and overtime use **orange**, never red, because red always means Neg.
  - Small extra colors: green for "done/ready" and amber for "check this". Everything else is gray.
  - Focus outlines and links are neutral, not blue.
- **Font (as built)**: Inter Tight (SIL Open Font License), self-hosted in `assets/fonts/`, so it works offline and no font request leaves the computer.
- **Type**:
  - One display face close to the wordmark, used only for the app name, screen titles and big numbers (clock, points). Candidates: General Sans, Satoshi, Outfit (all free; self-hosted, so it works offline).
  - The body text stays the system UI font, for speed and legibility.

---

## 2. Lenses for the UI/UX review

Each lens is a question we ask of every screen.

1. **The judge's three moments.** Before the round (set up), during it (time, flow, listen), after it (decide, write, submit). Does each screen serve one moment?
2. **Mid-round speed.** Can the judge do the common thing in one action, without looking away from the speaker for long? Keyboard first: Space for the clock, number keys for speeches, a key for "new flow line".
3. **Glanceability.** From 1 m away: which speech, how much time, is it recording, is the AI working?
4. **Trust and control.** Is it always clear what the AI wrote, what the judge wrote, and which one wins? Can every AI action be undone?
5. **States.** Empty, loading, error, offline, no AI, half a round done. Does every screen say what is going on and what to do next?
6. **Density with calm.** Dense where judges need it (the flow); quiet everywhere else. One primary action per screen.
7. **AI-slop check** (from ui-magic):
   - No decorative tab underlines.
   - No ALL-CAPS tracked labels on every card.
   - No pills where plain text works.
   - No dashed boxes except for drop zones and the "No answer" spot.
   - No emoji check marks.
   - Real copy instead of filler.
8. **Accessibility.** Contrast, focus, screen-reader names, reduced motion, readable at 200% zoom.
9. **Devices.** A laptop in a classroom, an iPad, a phone used as a timer.
10. **Trust for coaches and parents.** Plain language, a clear privacy story (student names and voices are involved), easy feedback for Tabroom.

---

## 3. New layout (proposal)

Today there are 8 equal tabs in one row. Proposal: **4 places, plus a round bar that is always there.**

| Place | Holds today's | When |
|---|---|---|
| **Round** | Setup, round docs, reading level | Before |
| **Flow** (the main workspace) | Timer + transcript, Flow, Round Map | During |
| **Decide** | Live Eval, Analysis, Ballot, decision draft | After (and peeks during) |
| **Library** | Log, past rounds, export/import | Any time |
| **Settings** (gear) | AI + Keys, audio, preferences, About | Rarely |

**Flow workspace, three panes** (the pattern from Gemini Notebook):
- **Left, Sources**: the speech list with the transcript for the selected speech, and docs. It collapses.
- **Center, the flow**: My flow or AI flow, with sheets and Brief / Standard / Detailed.
- **Right, Insights**: a slim panel with the Live Eval leaning, "listen for next", and the map. It collapses.

**Round bar** (fixed at the bottom; the floating record control from Voicenotes):
- Current speech and big clock, Start/Pause.
- Record dot, level meter, "last text 4 s ago".
- Aff prep / Neg prep.
- "AI working…" indicator.
- It is visible in every place, so the judge never has to leave the flow to run the clock.

**Nav style**:
- On wide screens, a short left rail with icons and labels.
- On narrow screens, a top bar with 4 items.
- The selected item gets a solid quiet background, not an underline.

---

**As built (step 3) and decisions:**
- The 4 places stay in the **top bar at every width**. With only 4 items, a left rail would take space away from the flow, which needs all the width it can get. Selected = solid quiet background, no underline.
- **Settings** is the gear at the top right.
- The **Insights** pane holds the Live Eval leaning and "listen for next". The Round Map stays in Decide → Analysis, because a map is too cramped in a 270 px pane. Revisit after real use.
- The round bar shows the speech, the clock, Start/Reset/Next, Transcribe with "last text N s ago", Aff/Neg prep, and the AI status.
- **Deferred to step 4:** the audio level meter in the round bar, and an "Audio" group in Settings.
- **Deferred to step 6:** an "About" entry in Settings. (Built in the ? help menu and the app footer instead.)
- **Deferred to step 7:** past rounds in the Library.

## 4. Live rounds in the room (not Zoom)

- **Audio mode** setting:
  - **In the room**: echo cancelling and noise filter ON, to remove the room hum.
  - **Zoom / speakers**: filters OFF, as now.
- **Pick the microphone** (laptop mic, USB mic, AirPods), and remember it.
- **Live level meter** and a 5-second **mic test** before the round.
- Guidance for the laptop's position.
- If quality drops (no text for 30 s), say so in the round bar.
- Later: tell speakers apart (1A vs 2N in CX) with a diarizing model, where the provider has one.

---

## 5. About page

`about.html`, linked from the bottom of every screen ("About · Made by Pattern Engine LLC").

Sections:
1. **What Tabula is**: one sentence and a screenshot.
2. **Who it is for**: judges (lay to experienced), coaches, programs.
3. **How it works**: timer → flow → decide; works with or without AI.
4. **Privacy**: data stays in your browser; AI calls go only to the provider you pick; no audio is stored.
5. **About Connor**: 7 years of debate, political work, years as a software developer, built during real rounds to keep serving the next generation. A link to your judging paradigm.
6. **Open source**: link to https://github.com/TabulaSpeech/tabula.
7. **Support**: "Buy me a coffee" button.
8. Footer: © Pattern Engine LLC.

---

## 6. Open source and paid round packs

**Free forever**: the app, with your own key, a subscription, or no AI.

**Round packs** (later, for judges who do not want keys):
- A small hosted backend (for example a Cloudflare Worker) holds Tabula's own AI keys.
- Payments through Stripe. Credits are counted per round.
- We measure the real cost per round first.
- **Needed before charging**:
  - Accounts and login.
  - Terms and a privacy policy. These rounds involve **minors' names and voices**, so data handling must be careful: no audio kept, short retention, school-friendly terms.
  - Refunds and support.

**License choice** (your call):
- **MIT**: simplest. Anyone, including a competitor, may host it.
- **AGPL**: anyone who hosts a changed copy must share their code. This protects a hosted Tabula.

---

## 6b. Getting Tabula to people (homepage, install, tour, docs)

**Browser app or download?** Recommendation: **a browser app that can be installed** (a "PWA").
- Why browser first:
  - Many schools give judges **Chromebooks or iPads**, where downloaded apps are blocked.
  - A link is the easiest thing to share in a team group chat.
  - Updates reach everyone at once.
- Why "installable":
  - Chrome and Edge show an **Install Tabula** button.
  - It then opens in its own window with a dock or taskbar icon, and works offline for the non-AI parts. It feels like a downloaded app.
- Hosting: a free static host (Cloudflare Pages or GitHub Pages) on a domain such as `tabula.<domain>`. No server is needed for keys, browser transcription, or no-AI use.
- A **real desktop app** (for example Tauri, a small Mac/Windows wrapper) only matters for one thing: bundling the subscription helper, so Claude/ChatGPT subscriptions work without Terminal. Later and optional.

**Homepage** (marketing):
- Hero: the mark, "Judge the round, not the paperwork", an "Open Tabula" button and an "Install" hint.
- Screenshots of the flow workspace, Live Eval, ballot filler and Round Map (taken from the new layout).
- "Works with or without AI", "Your data stays on your computer", "Free and open source".
- For coaches and programs: how to share it with judges.
- Links: Docs, About, GitHub, Buy Me a Coffee.

**Guided tour** (inside the app):
- On first open, after the welcome screen, a short tour: 6–8 steps.
- Each step highlights one real part of the screen with a short note: Round setup, docs, start the clock, record, flow, AI flow, Decide, ballot.
- "Next / Back / Skip", and progress dots.
- A **?** button in the top bar replays it any time. Small "learn this" tours per place (for example, "How the ballot filler works").
- Built in-house (no extra library), using the same tokens, keyboard-friendly and screen-reader-labelled.

**Help docs** (Mintlify, or plain Markdown pages in the repo first):
- Getting started (5 minutes).
- Connect AI (one page per provider, with screenshots of where to click).
- Judging a round: before, during, after.
- In-room vs Zoom audio.
- Ballot filler and Tabroom.
- Reading levels, paradigms, Round Map.
- Backup and restore. Privacy. FAQ and troubleshooting ("not transcribing", "AI flow failed").
- Every page has screenshots, captured from the real app with test data, so they stay accurate.

## 7. Build order

1. Export / import / auto-backup, plus the logo assets. *(protect the data)*
2. Brand pass: name, icon, logo colors, display font, removal of the slop tells.
3. New layout: 4 places, round bar, three-pane Flow workspace.
4. In-room audio: audio mode, mic picker, level meter, mic test.
5. Guided tour + **?** help button.
6. About page, footer, Buy Me a Coffee.
7. Full-round Library (save whole rounds, reopen them).
8. Make it installable (PWA: manifest, offline cache, install button).
9. Homepage with screenshots. First task: move the fonts and color tokens into `assets/tokens.css`, and use it from the homepage, About, docs, then the app.
10. Help docs with screenshots (Markdown in the repo first, then Mintlify).
11. Publish to GitHub and a free static host (after the license choice). Gate: `node check-publish.mjs` must pass (no TODO or `href="#"` left).
12. Optional desktop wrapper for the subscription helper.
13. Hosted round packs (separate project: backend, payments, policies).

Each step: tests, a browser check in light and dark mode at laptop and phone width, and the two reviewer agents.

---

## 8. What I need from you

- **Your bio**: years and schools in debate, events, what political work to mention, your current work. Plus a link to your paradigm.
- Your **Buy Me a Coffee** link (or I leave a placeholder).
- **License**: MIT or AGPL.
- **A photo** for the About page (optional).
- **Round-pack price** idea, when we get there.

---

## 9. Accounts in the app (roles plan step 3, built 2026-11-20)

The roles plan is in the server's spec.

- **Judging for**: a signed-in judge who belongs to a school picks "Judging for: <school>" or "Just me" in Round setup or on the start screen. The device remembers the last choice. The choice locks when the first speech clock runs. Signed out, or with no school: no picker. Code: `js/judging.js`, `logic/account.js`.
- **Paradigm**: signed in, the account paradigm is the one source. Settings → Your paradigm edits and saves it (`PUT /api/v1/me/profile`). The Analysis box shows it read-only. Signed out, the paradigm on this device works as before. On the first sign-in, the app offers once to copy the device paradigm up. Code: `js/account.js`.
- Only the profile (name, paradigm, schools) goes to the server. Round content never does.
- **Not done**: the app has no hosted AI caller yet, so nothing sends `programId` today. The round stores it (`R.programId`). The hosted caller must build each body with `L.hostedAiBody(R, call)`; a test fails if page code calls `/api/v1/ai/` without it.

## 10. The AI gate (platform phase 1B, built 2026-11-20)

Spec: the server's API spec and `docs/design/AI-POLICY.md` §3 and §6.

- One check, `can(feature)` (`js/caps.js`, rules in `logic/caps.js`). The record comes from `GET /api/v1/me/capabilities?v=2&product=debate[&programId=…]` at app start, sign-in, and when "Judging for" changes before the first speech. New rounds reload the page, so they start there too. The gate never changes mid-round.
- With no record, a "Just me" round is today's app. A school round as coach, admin or student, or a managed account, hides all AI until a record arrives. A judge keeps their own AI.
- Removed parts carry `data-ai="<feature>"` (or `data-ai-setup` for Connect AI surfaces). CSS hides them from `<html data-ai-off>`. `assets/caps-boot.js` writes that before the first paint. CSS, not the `hidden` attribute, because many of these nodes already use `hidden` for their own open or closed state.
- Every AI call site calls `can()` before its first fetch. `ai-gate.test.mjs` checks this, with a negative case for each check.
- Dev switches: `?ai=off` (Flow-only look) and `?caps=<fixture>` (a record from `fixtures/platform-v2.json`, which the hosted build does not ship).
- `fixtures/platform-v2.json` is a subset of the server's capability contract (the public description is in `docs/contract/`). Copy it again when the contract changes. Its records expire 14 days after it was made, so `?caps=` shows old fixtures as expired; the tests use a fixed time.
- Choice made here: the key settings (`#conn-card`) show while own AI is allowed, also after a key is in, so a judge can test or remove it. Only the Connect AI invites hide once the device is ready.
- `#ins-cta` carries both `data-ai="liveEval"` and `data-ai-setup="invite"` (CSS before the first paint), and `applyPanes` also hides it by the Insights mode.
- Known gap: the app has no hosted AI caller yet. When the school pays (`payer: program`) and the device has no own key, the AI controls show but have no engine. Insights then folds away instead of offering Connect AI. The hosted caller closes this.
- Open questions for the server spec: the spec says `applyCapabilities` sets `hidden` (here: CSS from `data-ai-off`), and that `showSetup()` hides the key card once the device is ready (here: only the invites hide; the key card stays so a judge can manage the key).
- The "Judging for" help line now says "rules and credits", not "AI rules and credits", so it names no AI to a role whose AI is hidden.
