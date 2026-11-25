# Using a round: ask first or automatic (2026-11-22)

Owner request (2026-11-22): some judges want to click to use a round's AI; others want their AI settings honored the
moment a round starts. Rounds left must be clear, "like how Claude/ChatGPT keep usage amounts clean and clear".

## Who this is for
- Only judges who pay for hosted AI with their own rounds. Per feature: `L.selfPays(gate, f)` (hosted, and the payer
  is not the school). The pill and the card show when some feature is (`L.selfPaidHosted`).
- Not for a judge with their own key (no rounds are used), and not when a school pays (the school's policy decides).

## How a round is charged today (server, round budget)
- The first hosted call of a round reserves one round. The first real AI answer (not doc mapping) commits it.
- The server round state is `open` before the commit and `active` (then `idle`, `free`, `closed`) after it.
- After the commit, all AI in that round is covered, up to the limits (Terms §6.4).

## 1. The setting: "When a round starts" (Settings, "AI rounds" card)
Two choices, as radio rows with one help line each (Mobbin cue: Fresha "Transfer authorisation").
- **Ask me first** (default): "Tabula asks first. No round is used until you say yes."
- **Use AI automatically**: "Your AI settings run on their own. Each round with AI uses 1 round."
- Stored on the device: `S.aiRoundMode` = `'ask'` | `'auto'`.

## 2. The question (only with "Ask me first")
- When: the first hosted AI call of a round whose server state is none or `open`.
- Not asked again in that round after an answer. The answer is kept with the round (`R.aiConsent` = `'yes'` | `'no'`),
  so a reload of the same round does not ask again. A new round, or a round opened from a file, starts with none.
- The server state counts only if it is for this round (`thisRound()` checks `R.id`), so an old round's "active"
  never skips the question. An answer given after the round changed is dropped.
- Look: the shared dialog `ask()` (Mobbin cue: Vapi "your new balance will be ..." shows the balance after).
  - Title: "Use 1 round of AI?"
  - Body: "This round uses 1 of your 5 rounds. You will have 4 left." and "The clock, flow and ballot are free either way."
  - With an unknown balance: "This round uses 1 of your rounds."
  - Buttons: **Not this round** (plain) and **Use a round** (primary). Esc or × means "Not this round".
- After the first "Use a round" on this device, one toast offers **Always use AI automatically** (it sets the setting).
  It shows once (`S.autoOfferShown`).
- "Not this round": no AI call goes out in that round. The bottom bar shows "AI is off for this round." with a
  **Turn on AI** button, which sets `R.aiConsent = 'yes'`.
- No rounds left: no question. The call goes to the server, which refuses with the existing "Buy rounds" message.
- Several AI calls at once (for example, live flow and Live Eval) share one question.

## 3. Rounds left, always clear
- Source: `roundsLeft` on `GET /api/v1/ai/round/limits` (tabula-cloud branch `claude/limits-rounds-left`). Null means
  unknown: the app then shows no number, never 0.
- **Top bar pill** (Mobbin cue: Railway "23 days or $4.88 left"): "5 rounds left". A click opens Settings.
  At 0 it reads "No rounds left" and the click opens the Buy rounds page.
- **Settings, "AI rounds" card** (Mobbin cues: Ferndesk and Stitch usage blocks): the big number, a "Buy rounds" link,
  and the setting.
- Refreshed at app start, at each round boundary, and after the round's AI starts (when the state becomes `active`).

## 4. Rules that keep it fair
- The clock, flow, prep timers and ballot never ask and never cost anything.
- Only the first AI use in a round can ask.
- The question never names a price in money, only rounds.

## Code
- Rules and words: `logic/limits.js` (consentStep, consentAsk, roundsLeftText, consentLine) and `logic/hosted.js`
  (selfPays, selfPaidHosted). Page: `js/consent.js`. The check runs in `js/ai.js` callHosted, before the request.

## Changes from the first proposal (2026-11-22)
- "Don't ask again" is not a checkbox in the question. After the first "Use a round", one toast offers
  "Always use AI automatically", and the setting is always in Settings.
- Rounds left show in a top bar pill and the Settings card, not on the Round card.
- No separate warning at 1 left: the pill says "1 round left" and the question says "your last round".
- No "AI on" chip: the bottom bar shows the round's AI time left once AI runs (the existing round line).

## Not in this change
- A server-side "do not start a round without consent" flag. The app gate is enough because the app is the only
  client that starts a round; a script calling the API directly is the person spending their own rounds.
