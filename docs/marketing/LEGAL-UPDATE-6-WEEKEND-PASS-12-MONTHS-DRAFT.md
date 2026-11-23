# Legal update 6 (draft 1): Weekend Pass lasts 12 months, plus expiry reminders

2026-11-23. Draft for the owner and the lawyer. Not live.

## Why

- Owner decision, typed in the pricing chat on 2026-11-23: "Yes, both picks". The approved plan is in `private/pricing/WEEKENDER-NO-WINDOW.md` (private: it has prices).
- The owner says the lawyer recommended this change.
- The new rule:
  - The Weekend Pass (name kept) loses its 4-day window. Its Rounds expire 12 months after purchase, like every Round Pack.
  - Our server emails a reminder before one-time Rounds expire: about 30 days before, 7 days before, and on the last day.
  - The reminders are service messages only: what expires and when, plus a link to the account page. No buy link and no upsell.
  - The Camp Pass keeps its 30-day window (update 4, not live yet).
  - The Circuit (16 Rounds) price changes. The Terms name no prices, so there is no text change for this.

## Publish gate

1. The lawyer approves this text, including the questions at the end.
2. The owner types yes in the marketing chat.
3. The server rule is live first, or on the same day:
   - Weekend Pass Rounds expire 12 months after purchase.
   - Weekend Pass Rounds are spent in the same group as pack Rounds (§6.5 below).
   - Weekend Passes already sold, with Rounds not yet expired, get the 12-month date and move to the "pack" spend group.
   - Window starts held in each user's Durable Object (`lot_starts`) are cleared or skipped, so no later flush puts back a 4-day date.
   - Rounds that already expired under the 4-day rule are given back by hand before publish, if any exist (goodwill; see L5).
4. The Terms, the Refund Policy, the Privacy Policy and the Plans page go live on the same day. The Plans page loses "Use within 4 days from your first round." Use the publish date in the Terms and Refund Policy headers. Change the Privacy Policy date only if P1 ships.
5. **The reminder sentences (T4, R4, P1) go live only when the reminder emails are live.** If the emails ship later, publish this update without T4, R4 and P1, then add them in a later update.

## Terms of Service (`sites/speech/pages/terms.html`)

**T1. §6.1, the Weekend Pass item (replace)**
- Before: "**Weekend Pass.** A one-time purchase of a set number of Rounds to use in 4 days. The 4 days start when the first Round from the pass is committed (see 6.3). A Weekend Pass does not renew."
- After: "**Weekend Pass.** A one-time purchase of a set number of Rounds, sized for one tournament weekend. Rounds that you do not use stay in your balance until they expire (see 6.6). A Weekend Pass does not renew."

**T2. §6.5, first sentence (replace)**
- Before: "We use your Rounds in this order: first Weekend Pass Rounds, then Subscription Rounds, then Single Round and Round Pack Rounds."
- After: "We use your Rounds in this order: first Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds."
- Keep the rest of §6.5 ("Inside each group, we use the Rounds that expire soonest first. …").
- Reason: with no window, a Weekend Pass is a pack. The pricing plan moves it into the server's "pack" spend group (`catalog.ts`, group `"pack"`). This text must match the server's real order: check it in code before publish.

**T3. §6.6, first two list items (replace both with one item)**
- Before: "Single Round and Round Pack Rounds expire 12 months after the date of purchase." and "Weekend Pass Rounds expire 4 days after the first Round from the pass is committed. If you never commit a Round from the pass, its Rounds expire 12 months after the date of purchase."
- After: "Single Round, Round Pack and Weekend Pass Rounds expire 12 months after the date of purchase. This also applies to unexpired Rounds from Weekend Passes bought before [publish date]."

**T4. §6.6, new paragraph after the list (only when the emails are live)**
- Add: "Before Single Round, Round Pack and Weekend Pass Rounds expire, we email the address on your Account about 30 days before, about 7 days before, and on the last day. We send these emails only while Rounds from that purchase are still unused. If an email does not reach you, the expiry date in this section does not change."

Nothing else in the Terms changes. "Weekend Pass" stays in §2, the renewal paragraph, "No refunds" and the prohibited uses list. Those lines name the plan, not the window.

## Refund Policy (`sites/speech/pages/refunds.html`)

**R1. §1, list (replace two items with one)**
- Before: "Single Rounds and Round Packs;" and "Weekend Passes, including Rounds that you did not use in the 4 days;"
- After: "Single Rounds, Round Packs and Weekend Passes;"

**R2. §4 "Expiry" (replace the first two sentences)**
- Before: "Single Round and Round Pack Rounds expire 12 months after purchase. Weekend Pass Rounds expire 4 days after the first Round from the pass is committed."
- After: "Single Round, Round Pack and Weekend Pass Rounds expire 12 months after purchase."

**R3. §4 "Order" (replace the first sentence)**
- Before: "We use Weekend Pass Rounds first, then Subscription Rounds, then Single Round and Round Pack Rounds."
- After: "We use Subscription Rounds first, then Single Round, Round Pack and Weekend Pass Rounds."

**R4. §5 (only when the emails are live)**
- Heading. Before: "5. Renewal reminders". After: "5. Reminders". The table of contents entry changes too.
- In short. Before: "You get an email before each yearly renewal." After: "You get an email before each yearly renewal, and before your one-time Rounds expire."
- Add after the first paragraph: "Before Single Round, Round Pack and Weekend Pass Rounds expire, we email the address on your Account about 30 days before, about 7 days before, and on the last day. We send these emails only while Rounds from that purchase are still unused. Terms Section 6.6 gives the full rule."

## Privacy Policy (`sites/speech/pages/privacy.html`)

**P1. §9 "How we use data" (only when the emails are live)**
- Before: "send service messages, such as sign-in emails, receipts, renewal reminders and notices of changes to our terms or this policy;"
- After: "send service messages, such as sign-in emails, receipts, renewal reminders, reminders before your Rounds expire, and notices of changes to our terms or this policy;"

## If update 4 (Camp Pass) is live first

Then the T2 and R3 "Before" quotes are update 4's texts. Use these instead:

- **T2.** Before: update 4's §6.5 sentence ("first Weekend Pass Rounds and Rounds from a Camp Pass that has started, …"). After: "We use your Rounds in this order: first Rounds from a Camp Pass that has started, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds, then Rounds from a Camp Pass that has not started."
- **R1.** Keep update 4's Camp Pass item after the new "Single Rounds, Round Packs and Weekend Passes;" item.
- **R2.** Keep update 4's Camp Pass sentence after the new 12-month sentence.
- **R3.** Before: update 4's Order sentence. After: "We use Rounds from a started Camp Pass first, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds. We use Rounds from a Camp Pass that has not started last."
- **T4 and R4.** Add: "Before Camp Pass Rounds expire, we email the address on your Account about 7 days before and on the last day." Use it only if the server sends Camp Pass reminders.

## Plans page (marketing)

- Replace "Use within 4 days from your first round." on the Weekend Pass card with "Rounds last 12 months."
- Do not change the page header ("Packs and single rounds expire 12 months after purchase."). The Camp Pass keeps its 30-day window.

## Check after publish

- "4 days" gives 0 hits on the live Terms, Refund Policy and Plans page.
- All After texts above are on the live pages.

## Other drafts and records to change (no text goes live from this list)

- **Update 4, Camp Pass** (`LEGAL-UPDATE-4-CAMP-PASS-FINAL.md`). If update 6 is live first, use these texts instead. The lawyer must see them, because they differ from his approved text.
  - §6.5: "We use your Rounds in this order: first Rounds from a Camp Pass that has started, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds, then Rounds from a Camp Pass that has not started. Inside each group, we use the Rounds that expire soonest first. A Camp Pass starts when its first Round is committed (see 6.1)."
  - §6.1 and §6.6: add the Camp Pass items after the Weekend Pass item, as approved.
  - Refunds §1: add "Camp Passes, including Rounds that expired before you used them;" after "Single Rounds, Round Packs and Weekend Passes;".
  - Refunds §4 "Expiry": add "Camp Pass Rounds expire 30 days after the first Round from the pass is committed." after the 12-month sentence.
  - Refunds §4 "Order": "We use Rounds from a started Camp Pass first, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds. We use Rounds from a Camp Pass that has not started last."
  - Reminders: the plan sends Camp Pass reminders at 7 days and on the last day. When update 4 goes live, add the Camp Pass to T4 and R4.
  - Remove the line "The live Weekend Pass refund line stays as it is." The line is gone.
- **Update 5 Part B** (`LEGAL-UPDATE-5-DRAFT.md`, §6.6 setup item). Change "A Weekend Pass or Camp Pass keeps its own rule: its days start when its first Round is committed." to "A Camp Pass keeps its own rule: its 30 days start when its first Round is committed." Same change in `docs/design/BUY-FIRST-SPEC.md` step 4.
- **Update 5 notes.** "our server sends no reminder" is still true for renewals (Link sends those). It is not true for expiry reminders. Add a note there, so no one reads it as "we send no email at all".
- **`LEGAL-FACTS.md`** on the publish day:
  - "Round expiry" row: Single Round, Round Pack and Weekend Pass: 12 months; reminders at about 30 days, 7 days and the last day.
  - "Spend order" row: Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds.
  - Other rows in that file are already out of date (statement descriptor, trial). They are not part of this update.
- **Lawyer brief** (`private/legal/BUY-FIRST-LAWYER-BRIEF.md`): tell the lawyer that the Weekend Pass window is gone. The Weekend Pass parts of the A-answers change.

## Questions for the lawyer

- **L1. State expiry laws.** Our emails will say "your Rounds expire". Do state laws on prepaid expiry apply to Rounds? Examples: Cal. Civ. Code 1749.5, and the federal CARD Act rules for gift cards. Our view: Rounds are a service credit, not a gift card or stored value. Rounds have no cash value, and §4 of the Refund Policy says so. Please confirm.
- **L2. A missed email.** T4 says that a missed email does not change the expiry date. Is that enough? Or must we say "we try to email"?
- **L3. Teen users.** Users aged 13 to 17 get only service emails. Is a reminder email to a teen fine with no parent copy? (Arkansas, Vermont and other state rules on known minors: see `private/legal/MINORS-AI-SUMMARY.md`.)
- **L4. Notice of change.** The Terms promise 30 days' notice for material changes. This change only helps users: a longer life and new reminders. Can it take effect on the publish day? The spend-order change (T2) uses Subscription Rounds first. Is that a material change for anyone?
- **L5. Old passes.** T3 gives Weekend Passes bought before the publish date the 12-month rule. Rounds that already expired under the 4-day rule come back as goodwill, by hand. Is any text needed for that?
