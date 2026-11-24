# Welcome dialog: final copy recommendation

## 1. Recommended copy

This is Draft A, with the panel's best lines added. "Start judging" opens the round in one click. Setup is a quiet row under that button. The skip page goes away.

**Title:** Welcome to Tabula Debate

**Intro:** Your clock, flow and ballot are ready.

**Primary button (always shown, first, full width):** Start judging
- It has no description.
- It opens Flow in one click and then offers the tour.
- × and Esc do the same thing.

**Setup row 1 (always shown; a quiet row under the button, not an equal card):**
- Label: Add an automatic flow and a draft ballot
- Description: Paste a key from an AI company. You pay that company for what you use.
- Action: it opens Settings and puts the cursor in the key field, as it does today.

**Setup row 2 (shown only when LOCAL_ORIGIN is true; a second quiet row):**
- Label: Use a subscription you have
- Description: Connects to an app you pay for on this computer. Needs one Terminal command.
- Action: it opens Settings at the subscription box, as it does today.

**Skip page:** Delete it. "Start judging" leaves in one click, and nothing is lost. The setup rows are on screen, and Settings keeps a button that shows the welcome again.

**Settings button (#show-welcome):** "Show the first-time setup again" becomes **Show the welcome again**. The id stays the same.

**Tour offer after the welcome:** No change. It stays "New here?" / "A one-minute tour shows where everything is." / [Take the tour] [Not now].

**"AI" count**

| | Before | After |
|---|---|---|
| Page 1, localhost | 7 | 1 |
| Page 1, other hosts | 6 | 1 |
| Skip page | 3 | 0 (the page is deleted) |
| **Whole flow** | **10** | **1** |

The one "AI" sits in the key description. At that point the user is about to give a credential to an outside company. That is a "people check data" moment, which is the only place the house voice keeps the word.

## 2. Runner-up

This is Draft C's before-launch state, with panel fixes. It uses equal setup cards with a footer button.

- **Title:** Welcome to Tabula Debate
- **Intro:** Your clock, flow and ballot are ready. To add an automatic flow and a draft ballot that suggests a winner and points, pick a setup below.
- **Card 1 (always):** Use your own key / Paste a key from an AI company. You pay that company for what you use.
- **Card 2 (localhost only):** Use a subscription you have / Connects to an app you pay for on this computer. Needs one Terminal command.
- **Footer primary button (not a card):** Start judging, with fine print under it: "You can set this up later in Settings."
- **Skip page:** deleted.
- **Settings button:** Show the welcome again.
- **"AI" count:** 1.

**When to prefer it:** choose it if you want the E7 sentence ("suggests a winner and points") on screen at first run. Also choose it if the ui.js change for "one button above quiet rows" must wait, because this layout keeps the current cards plus one footer button.

## 3. Before launch vs after launch

- **Before launch (now):** ship the copy in section 1 as it is. Do not mention a price, the demo or a $2 round. The app has no buy page or plan state yet (hasHostedPlan() is false), so any such line would be false.
- **After launch:** put all new parts behind one switch (for example L.hostedRoundLive()).
  - Add a plain button **Watch a sample round** next to "Start judging". It opens ?demo=policy or ?demo=ld. It asks for no commitment, so add it first.
  - Optional, and your decision: add a row above the key row, **One round for $2** / "Get the automatic flow and draft ballot for one round. No key or setup." It names one price, with no "try" or "free" words. The panel said a price makes the welcome feel like a shop. The point for it is that 13 to 17 year old debaters cannot use their own key, so today the key row is a dead end for them.
  - Show passes (Weekend, Season) only on the buy page, never in this dialog.
  - Paid hosted users never see the welcome, so only people who have not bought see the price.

## 4. Why

- **The free path is named as an action, not as a lack.** "Start without AI" named the core app by what it is missing. Calm apps name the skip by what you do next: Linear "I'll do this later", Chronicle "Start from scratch", Mistral "Not now". Wix's "Set up without Chat" is the counter-example, and it reads as a loss.
- **One click, no confirmation.** No calm example confirms a skip. SPEC §2.1's own browser check says "skip takes one click", and today the skip takes two. Four of the five reader personas (parent, circuit judge, coach, debater) want the flow at once.
- **The help is named by its job, and the intro is true.** The intro no longer says "AI can add a transcript". That was not fully true, because Chrome's free browser transcription needs no key. "Feedback" is gone too, because students read it as "AI grades my speech". "AI flow" and "AI key" are gone. The setup row says "automatic flow" and "draft ballot", which are the approved site terms.
- **The word "help" is not used for the features in the app.** In the app, "Help" already names the ? menu ("Help and tours"). It also named "step-by-step help" in this same dialog. The job names avoid one word with two meanings on one screen.
- **The cost is stated as a fact, not as a defence.** "You pay that company for what you use" answers the real question from parents and coaches ("will it cost money?"). It sits next to the one "AI". The new copy has no "never", "only", "you decide", exclamation mark or emoji. All three panels agreed on the shape. Two panels chose Draft A. The third chose C, with A's button placement as its first fix.

## 5. What changes in code

Change the spec first, as a visible diff (the spec-over-tests rule).

1. **docs/design/SPEC.md §2.1**
   - Replace every "Copy" string with the strings in section 1.
   - Change the title line from "Welcome to Tabula" to "Welcome to Tabula Debate", to match TabulaBrand.NAME.
   - Delete the skip-page lines.
   - Change the Checks:
     - "localhost shows 3 choices; another host shows 2" becomes "localhost shows Start judging plus 2 setup rows; another host shows Start judging plus 1 setup row".
     - "× or Esc means Start without AI" becomes "× or Esc means Start judging".
     - "Skip takes one click" stays, and now it passes.
     - "Nothing Recommended" stays.
2. **js/help.js `openWelcome()`**
   - Use the new strings.
   - Delete the second ask() (the skip page with [Back] / [Start flowing]).
   - "Start judging", × and Esc all call one function. You can rename startWithoutAI() to startJudging().
   - Keep the showSetup() guard and the openWelcome name, because ai-gate CALL_SITES pins them.
   - S.aiSkipped is written but nothing reads it. Drop it or keep it, and say which in the review.
3. **js/ui.js `ask()`**: one small layout change. With variant 'choices', let one primary button render alone above quieter rows. If this must wait, use the runner-up layout.
4. **index.html**: change the #show-welcome text to "Show the welcome again". Keep the id and its data-ai-setup ancestor (ai-gate SETUP_IDS).
5. **New tests.** Do not weaken or edit an existing test. Each new test gets a why-header.
   - Welcome word budget. Why-header idea: "If the welcome fills up with AI again, a first-time judge reads the app as an AI product and the free path as a lesser choice." Assert:
     - at most one "AI" in the welcome strings;
     - no "without AI", "feedback", "AI key", "never", "only" or "can only";
     - no "$" or price before the launch switch;
     - no "free trial" at any time.
   - A truth pin: if the welcome ever describes the draft ballot, the wording must say it "suggests a winner and points" (E7).
   - The localhost-only row appears only when LOCAL_ORIGIN is true.
   - A browser check: "Start judging" goes to Flow in one click.
6. **Guards that stay true with no change:**
   - copy-dialogs (no "I understand", no "Recommended.", no skip-ack).
   - The vendor-name guard (no vendor names in the new copy).
   - ai-gate check 5 (no label contains "Connect AI").
   - ai-words.
   - logic-slice2 and demo (show logic only).
   - L.NO_AI is not copied into the welcome.

## 6. Rest of the app (follow-up sweep)

The welcome is the first surface. For each surface below, run the same E1 test: "does this line need the word AI at all?" Settings can keep "AI" where people paste keys and choose providers.

- **Settings, AI tab:** the h2 "Connect AI"; the select "AI tools (flow, Live Eval, analysis, decision) use"; the h3 "Use your AI subscription"; the card "AI writing and decisions" and "How the AI writes". The user lands here right after the welcome, so without a pass the heavy AI copy just moves one screen later.
- **Tour, last step:** "Connect AI any time with the gear; without AI, the timers, flow and ballot still work." It has the same "without AI" hedge.
- **Tour, Settings step:** "Connect AI" / "Paste a key from any AI provider…"
- **Live updates note (js/help.js about lines 171-185):** it says "AI" 6 times.
- **Decide > Ballot:** "Draft with AI", "What should the AI draft?", "Why the AI chose this", "The AI will not change it."
- **Flow tab:** "AI flow". **Insights:** "Live insights need AI." + "Connect AI". **Settings:** "Live AI flow during speeches".
- **Help menu:** "Watch the AI demo". Review it when the demo goes live.
- **Keep as they are:** the "(uses AI)" and "Uses AI" hints on controls that spend AI. ai-words.test.js pins them, and SPEC 4.5 makes them house policy.

## 7. Revision 2 (2026-11-21, owner approved)

**Owner's words, first:** "Welcome to tabula debate, your clock, flow and ballot are ready, start judging; that's great. the rest is tough."

**Owner's words, then:** "does it have to be one they pay for? if they have round credits, then it's covered and they wont need an api key. i think its still a little long on the 'Want xyz? It needs... set this up in settings'; but directionally, better. shorten the card afterwards using the help/assistance angle"

**What changes.** The two setup rows in section 1 go away. One quiet line takes their place. The top half does not change.

**Title:** Welcome to Tabula Debate (`TabulaBrand.NAME`). No change.

**Intro:** Your clock, flow and ballot are ready. No change.

**Primary button:** Start judging. No change: it is first and alone, and × and Esc do the same thing.

**Help line (one quiet line under the button, the same on every host):**
- Text: Want help with your flow and ballot?
- Link: Set it up
- It is a text link, not a card and not a row.
- Action: it opens Settings at the setup area (the "Connect AI" card with the key field and the subscription box). The cursor goes to the key field.

**Why.**
- A judge can get help in more than one way: their own key, a subscription, or round credits. The welcome does not choose for them. Settings explains each way.
- The welcome names no payment, key, subscription, Terminal or price. So it stays true for a judge with round credits, who pays nothing more and needs no key.
- The localhost-only subscription row goes away from the welcome. Settings still shows the subscription box only on localhost.

**"AI" count:** 1 becomes **0**.

**Settings button (#show-welcome):** still "Show the welcome again".

**Tests.** The old test "the subscription row shows only when LOCAL_ORIGIN is true" now checks one 'setup' entry on both hosts. That diff stays visible. New tests check: zero "AI" and no "pay", "key", "subscription", "Terminal" or "$"; the link opens Settings at the setup area; and the link is a real control that Tab reaches.

## 8. Revision 3 (2026-11-23, owner approved: "Option A: open door")

**What changes.** The app stays open with no sign-in wall. A judge who bought rounds needs a way in, so the welcome gets one more quiet line, **only when the account server said the judge is signed out**. Offline, or on the local helper, it is not known, so the welcome is the same as Revision 2.

**Second line (under the help line):**
- Text: Bought rounds?
- Link: Sign in
- Action: it goes to the sign-in page on the account site (`L.signinUrl`), which sends the judge back to the app.

**Why.** Before this, the app had no Sign in anywhere. A judge who bought rounds could not reach them. "Start judging" stays first and alone. The help line does not change. The top bar and Settings also show Sign in when signed out.

**Note.** "Bought rounds?" names a purchase, which Revision 2 left out. The owner chose this line (Option A, front-door write-up in the shared notes).

**Tests.** The Revision 2 tests do not change: with no signed-out answer, the welcome still shows `['start', 'setup']`. New tests (front-door.test.mjs) check the signed-out line, its banned words (AI, pay, key, subscription, $, free trial) and the Sign in action.
