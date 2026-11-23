# Legal update 6 (draft 2): Weekend Pass lasts 12 months, plus expiry reminders

2026-11-23. Draft for the owner and the lawyer. Not live.

**Status (2026-11-23):** the owner sent draft 2 to the lawyer. The owner reports that the lawyer is good with it and asked for no change to this update (his two changes were for the Camp Pass, update 4 draft 3). Still needed to publish: the server change, then the owner's yes in the marketing chat.

Draft 2 (2026-11-23) adds the owner's answers to L1 to L5 (see "Owner decisions" at the end): no "gift" wording and a stronger §6.7, "we try to email" with send records, effect on the publish day, and no text for old passes.

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
   - On the publish day, confirm that no customer holds a Weekend Pass sold under the 4-day rule. The owner says no one holds Rounds yet (2026-11-23). If someone does, the server moves those passes to the 12-month date and the "pack" group, clears `lot_starts`, and we send that person a short service email.
4. The Terms, the Refund Policy, the Privacy Policy and the Plans page go live on the same day. The Plans page loses "Use within 4 days from your first round." Use the publish date in the Terms and Refund Policy headers. Change the Privacy Policy date only if P1 ships.
5. **Send records.** Before T4 and R4 go live, the server keeps a record of each reminder: the time, the address, the purchase, the email type, the mail provider's message ID and the provider's result. If a send fails, the server tries again and records each try. Keep the records for at least 2 years after the Rounds expire (L2 asks the lawyer to confirm the period). These records are our evidence that we tried in good faith.
6. **The reminder sentences (T4, R4, P1) go live only when the reminder emails are live.** If the emails ship later, publish this update without T4, R4 and P1, then add them in a later update.

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
- After: "Single Round, Round Pack and Weekend Pass Rounds expire 12 months after the date of purchase."

**T4. §6.6, new paragraph after the list (only when the emails are live)**
- Add: "Before Single Round, Round Pack and Weekend Pass Rounds expire, we try to email the address on your Account about 30 days before, about 7 days before, and on the last day. If a send fails, we try again. We send these emails only while Rounds from that purchase are still unused. If an email does not reach you, the expiry date in this section does not change."

**T5. §6.7 "What Rounds are", second sentence (replace)**
- Before: "They are not money, a deposit, a stored-value instrument (an account or card that holds money to spend later) or property."
- After: "They are not money, a deposit, a gift card, a gift certificate, a stored-value instrument (an account or card that holds money to spend later) or property."
- Reason: the owner wants the strongest case for a 12-month expiry (L1). Update 5 Part B must also change the next sentence ("cannot be … transferred …"), so that it allows the send step.

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
- Add after the first paragraph: "Before Single Round, Round Pack and Weekend Pass Rounds expire, we try to email the address on your Account about 30 days before, about 7 days before, and on the last day. If a send fails, we try again. We send these emails only while Rounds from that purchase are still unused. Terms Section 6.6 gives the full rule."

## Privacy Policy (`sites/speech/pages/privacy.html`)

**P1. §9 "How we use data" (only when the emails are live)**
- Before: "send service messages, such as sign-in emails, receipts, renewal reminders and notices of changes to our terms or this policy;"
- After: "send service messages, such as sign-in emails, receipts, renewal reminders, reminders before your Rounds expire, and notices of changes to our terms or this policy;"

## If update 4 (Camp Pass) is live first

> Replaced 2026-11-23: the Camp Pass rules changed. Use `LEGAL-UPDATE-4-CAMP-PASS-DRAFT-2.md`, which requires update 6 to go live first.

Then the T2 and R3 "Before" quotes are update 4's texts. Use these instead:

- **T2.** Before: update 4's §6.5 sentence ("first Weekend Pass Rounds and Rounds from a Camp Pass that has started, …"). After: "We use your Rounds in this order: first Rounds from a Camp Pass that has started, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds, then Rounds from a Camp Pass that has not started."
- **R1.** Keep update 4's Camp Pass item after the new "Single Rounds, Round Packs and Weekend Passes;" item.
- **R2.** Keep update 4's Camp Pass sentence after the new 12-month sentence.
- **R3.** Before: update 4's Order sentence. After: "We use Rounds from a started Camp Pass first, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds. We use Rounds from a Camp Pass that has not started last."
- **T4 and R4.** Add: "Before Camp Pass Rounds expire, we try to email the address on your Account about 7 days before and on the last day." Use it only if the server sends Camp Pass reminders.

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

## Owner decisions (2026-11-23) and what the lawyer still confirms

- **L1. Gift card laws.** Keep the 12-month expiry.
  - We never call Rounds a "gift", a "gift card" or a "gift certificate", in the product, the legal pages or marketing. Moving Rounds to another person is "send" (the word in update 5 Part B and the teen-rounds design). The rule is in `LEGAL-FACTS.md`, "Words for Rounds".
  - T5 adds "a gift card, a gift certificate" to the list of things Rounds are not.
  - Fallback: if the lawyer sees real gift-card risk, we follow the CARD Act rules (no expiry sooner than 5 years, with the required disclosures). The lawyer says which purchases it covers: sent purchases only, or all.
  - Lawyer confirms: Cal. Civ. Code 1749.5, Washington law, the CARD Act, *Hollis v. Audible* (W.D. Wash. 2025), and California's cash-out rule for small balances (see `docs/design/TEEN-ROUNDS-AND-GIFTS.md` §11 item 3).
- **L2. A missed email.** "We try to email", and "if a send fails, we try again" (T4, R4). Gate item 5 keeps a record of each try. Lawyer confirms the wording and how long to keep the records.
- **L3. Teen users.** Send the reminder to the teen only. No parent copy, because that means collecting a parent's email. Lawyer confirms.
- **L4. Notice.** The change takes effect on the publish day. It helps users, and no one holds Rounds yet, so no notice email is needed. Gate item 3 checks this on the day.
- **L5. Old passes.** No one holds Rounds yet, so T3 has no "bought before" sentence and there is nothing to give back.
