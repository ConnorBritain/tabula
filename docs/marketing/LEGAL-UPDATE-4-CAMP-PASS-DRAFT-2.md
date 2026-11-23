# Legal update 4, draft 4: Camp Pass with a Start button and a keep rule

2026-11-23. Draft for the owner and the lawyer. Not live.

**Lawyer (2026-11-23):** he agrees with the never-expire email "as is", including its Camp Pass question (the started-pass share in Washington). The 2-per-summer limit was added after that email; the lawyer has not seen it.

**Status (2026-11-23):** the owner confirmed in the legal chat (2026-11-23) that a pass never started keeps all its Rounds. This replaces "Option A" from the pricing chat.

- Draft 3 had the lawyer's two changes: the keep share is set by prices on the day of purchase, and it rounds up (19 unused → 10 kept).
- Draft 4 follows the never-expire decision (update 6 draft 4) and the legal session's recommendation 3, which the owner and the lawyer agree with: **a pass that is never started keeps all its Rounds.** Kept Rounds never expire.
- The lawyer should see the final T2 and R4 wording once before publish.

This draft **replaces** `LEGAL-UPDATE-4-CAMP-PASS-FINAL.md` (lawyer-approved 2026-11-22, then replaced by new owner rules).

Source of the rules: the owner's decisions in the pricing chat, 2026-11-23 (`private/pricing/CAMP-PASS-SPEC.md` §12 and §13; `private/pricing/ROUND-EXPIRY-AND-ROLLOVER.md`).

## The rules, in short

- The Camp Pass is a one-time purchase of a set number of Rounds for summer camp.
- **Sale period:** May 1 to July 15 each year, Pacific time. The Plans page shows the dates. The Terms do not name them.
- **Limit (owner, pricing chat, 2026-11-23: "Yes, limit to 2"):** at most 2 Camp Passes per Account in each summer sale period. A fully refunded pass does not count. If a third pass is paid anyway (for example two checkouts at once), the server still grants it and flags it for review: we never take money and refuse the Rounds. Site: "Up to 2 per account each summer." Checkout error: "You already have 2 Camp Passes this summer."
- **Start:** Camp Pass Rounds are not used until the user taps "Start my Camp Pass". Using a Round does not start the pass.
- **Camp period:** it starts when the user starts the pass. It ends 30 days later, or at 11:59 p.m. Pacific time on August 15, whichever comes first.
- **Spend order:** after the start, Camp Pass Rounds are used first. Before the start, they are not used at all.
- **Keep rule for a started pass:** when the camp period ends, a share of the unused Camp Pass Rounds, rounded up, stays in the balance as Round Pack Rounds. The rest expire.
  - The share = (the price paid per Camp Pass Round) ÷ (the Single Round price on the day of purchase), never more than 1. The server stores it with the purchase.
  - At today's prices the share is one half: 20 unused → 10 kept. 19 unused → 10 kept. 1 unused → 1 kept.
- **A pass never started:** at 11:59 p.m. Pacific time on August 15, all of its Rounds become Round Pack Rounds. Nothing is lost.
- **Kept Rounds** are Round Pack Rounds. They never expire (update 6).
- **No cash refunds** for unused Camp Pass Rounds, except where the law requires one or Link gives one under its own rules.
- **Reminders:** a started pass: about 7 days before the end and on the last day. Service mail only. They go to the Account that holds the Rounds.

## Publish gate

1. **Update 6 draft 4 (paid Rounds never expire) is live first.** This draft uses its After texts as "Before".
2. The lawyer sees the final T2 and R4 wording.
3. The server sells the Camp Pass and applies every rule above: the Start step; the camp period; the spend order; the keep step for a started pass (share stored at purchase, rounded up); the full conversion of a pass never started; kept Rounds with no expiry; refunds and disputes after the keep step (T8); the reminders, with a record of each send try (time, address, purchase, email type, provider message ID, result; kept at least 2 years).
4. The owner types yes in the marketing chat.
5. Before publish, save a live Privacy Policy snapshot and check the P1 Before text against it.
6. The Terms, the Refund Policy, the Privacy Policy and the Plans page go live on the same day, or the Plans page later. The build check keeps the Camp Pass card off the Plans page until `terms.html` contains "Camp Pass".
7. The card, the Start confirm step, the checkout page, the receipt and the emails state the start rule and the keep rule. The share comes from the server's catalog (for example "1 of every 2"), never a typed "half". Never use the words "value" or "gift".

Use the publish date in the page headers.

## Terms of Service (`sites/speech/pages/terms.html`)

**T1. §2, "Paid Plan" (replace)**
- Before: ""Paid Plan" means a Single Round, a Round Pack, a Weekend Pass, a Subscription or a Program, as described in Section 6."
- After: ""Paid Plan" means a Single Round, a Round Pack, a Weekend Pass, a Camp Pass, a Subscription or a Program, as described in Section 6."

**T2. §6.1, new item after the Weekend Pass item**
- Add: "**Camp Pass.** A one-time purchase of a set number of Rounds for summer camp. We sell the Camp Pass only in a summer sale period each year. The Plans page shows the dates. Each Account can buy at most 2 Camp Passes in each summer sale period. A Camp Pass that was fully refunded does not count. We do not use Camp Pass Rounds until you start the pass in your Account. Your camp period starts when you start the pass. It ends 30 days later, or at 11:59 p.m. Pacific time on August 15, whichever comes first. When the camp period ends, we keep a share of your unused Camp Pass Rounds, rounded up, as Round Pack Rounds. The share is the price you paid per Camp Pass Round divided by the price of a Single Round on the day you bought the pass, and never more than all of them. Checkout and your receipt show the share. For example, if the share is one half and 19 Camp Pass Rounds are unused, we keep 10. The other unused Camp Pass Rounds expire. If you never start the pass, we keep all of its Rounds as Round Pack Rounds after 11:59 p.m. Pacific time on August 15. Rounds that we keep count as Rounds from your Camp Pass payment (see Section 8). A Camp Pass does not renew."

**T3. §6 "In short", fourth sentence (replace; update 6 T0 text)**
- Before: "Rounds that you buy do not expire, except Program Rounds (see 6.6)."
- After: "Rounds that you buy do not expire, except Program Rounds and unused Camp Pass Rounds when the camp period ends (see 6.6)."

**T4. §6.5, first sentence (replace; update 6 T4 text)**
- Before: "We use your Rounds in this order: first Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds."
- After: "We use your Rounds in this order: first Rounds from a Camp Pass that you have started, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds. We do not use Rounds from a Camp Pass that you have not started."

**T5. §6.6, first sentence (replace; update 6 T5 text)**
- Before: "Except for Program Rounds, Rounds that you buy do not expire."
- After: "Except for Program Rounds and unused Camp Pass Rounds when the camp period ends, Rounds that you buy do not expire."

**T5b. §6.3, fourth and fifth sentences (replace; update 6 T0b text)**
- Before: "The Round goes back to the balance it came from. If it came from a Program pool whose term has ended, the Round does not come back."
- After: "The Round goes back to the balance it came from. If it came from a Camp Pass whose camp period has ended, it goes back as a Round that we keep (see 6.1). If it came from a Program pool whose term has ended, the Round does not come back."

**T6. §6.6, new list item before the Program item**
- Add: "Camp Pass: when the camp period ends, unused Camp Pass Rounds expire, except the Rounds that we keep (see 6.1). Rounds that we keep do not expire."

**T7. §6.6, new paragraph after the list**
- Add: "For a Camp Pass that you have started, we try to email the Account that holds its Rounds about 7 days before the camp period ends, if the camp period is that long, and on its last day. If a send fails, we try again. If an email does not reach you, the end of the camp period does not change."

**T8. §8 "Disputes and chargebacks" (no text change)**
- The live text says "first from that payment's unused Rounds". T2's "count as Rounds from your Camp Pass payment" makes kept Rounds part of that payment. The server must take back kept Rounds first, then the user's other unused Rounds, in proportion, as the live text says.

**T9. §8 and §13 lists (add "Camp Passes")**
- "Single Rounds, Round Packs and Weekend Passes never renew." → "Single Rounds, Round Packs, Weekend Passes and Camp Passes never renew."
- "Single Rounds, Round Packs and Weekend Passes are one-time purchases. They never renew." → "Single Rounds, Round Packs, Weekend Passes and Camp Passes are one-time purchases. They never renew."
- "This includes Single Rounds, Round Packs, Weekend Passes, Subscriptions, renewals, unused Rounds and partial billing periods." → "This includes Single Rounds, Round Packs, Weekend Passes, Camp Passes, Subscriptions, renewals, unused Rounds and partial billing periods."
- "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts;" → "resell, share, transfer or trade Rounds, Weekend Passes, Camp Passes, Subscriptions or Accounts;" (If update 5 Part B is live first, keep its "except that a buyer may send a purchase …" ending.)

## Refund Policy (`sites/speech/pages/refunds.html`)

**R1. §1, new list item after "Single Rounds, Round Packs and Weekend Passes;"**
- Add: "Camp Passes, including Camp Pass Rounds that expire when the camp period ends;"

**R2. §3 (replace)**
- Before: "Single Rounds, Round Packs and Weekend Passes never renew, so there is nothing to cancel."
- After: "Single Rounds, Round Packs, Weekend Passes and Camp Passes never renew, so there is nothing to cancel."

**R3. §4 "In short", second sentence (replace; update 6 R2 text)**
- Before: "Except for Program Rounds, Rounds that you buy do not expire."
- After: "Except for Program Rounds and unused Camp Pass Rounds when the camp period ends, Rounds that you buy do not expire."

**R4. §4 "How long Rounds last", add after the first sentence (update 6 R3 text)**
- Add: "Camp Pass Rounds are not used until you start the pass. The camp period ends 30 days after you start it, or on August 15, whichever comes first. Then we keep a share of the unused Camp Pass Rounds, rounded up, as Round Pack Rounds that do not expire. The share is set on the day you buy the pass, and checkout and your receipt show it (Terms Section 6.1). The rest expire. If you never start the pass, we keep all of its Rounds after August 15."

**R5. §4 "Order" (replace; update 6 R4 text)**
- Before: "We use Subscription Rounds first, then Single Round, Round Pack and Weekend Pass Rounds."
- After: "We use Rounds from a started Camp Pass first, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds. We do not use Rounds from a Camp Pass until you start it."

**R6. §5 "Renewal reminders"**
- Heading. Before: "5. Renewal reminders". After: "5. Reminders". The table of contents entry changes too.
- In short. Before: "You get an email before each yearly renewal." After: "You get an email before each yearly renewal, and before a Camp Pass camp period ends."
- Add after the first paragraph: "For a Camp Pass that you have started, we try to email you about 7 days before the camp period ends, if the camp period is that long, and on its last day. Terms Section 6.6 gives the full rule."

## Privacy Policy (`sites/speech/pages/privacy.html`)

**P1. §9 "How we use data"**
- Before: "send service messages, such as sign-in emails, receipts, renewal reminders and notices of changes to our terms or this policy;"
- After: "send service messages, such as sign-in emails, receipts, renewal reminders, Camp Pass reminders and notices of changes to our terms or this policy;"

## Plans page and other copy (marketing)

- Card: "Not used until you tap Start. After start: 30 days or Aug 15, whichever comes first. When your camp period ends, we keep [share from the catalog, for example "1 of every 2"] of your unused camp rounds, rounded up, as saved rounds that never expire. 19 left → 10 kept. Never started? You keep them all after Aug 15."
- Packs header (update 6: "Your rounds never expire."): when the Camp Pass card shows on the same page, use "Pay once. Nothing renews. Packs and single rounds never expire." Drive the header from the same condition that shows the card (the Terms check and the catalog `onSale`), so the two can never disagree.
- "Saved rounds" on the card means Round Pack Rounds in the Terms. That is fine.

## Settled by the legal session (2026-11-23)

- **Seller wording.** Link sells Paid Plans bought online (live since update 5 Part A). New text uses the Link wording.
- **Who gets the reminders.** The Account that holds the Rounds, and no one else. Before a buy-first purchase is set up, that is the buyer's checkout email.

## Other drafts to change

- **Update 5 Part B:** its §6.6 setup item is removed by update 6 draft 4. Nothing more for the Camp Pass.
- **`LEGAL-UPDATE-4-CAMP-PASS-FINAL.md`:** marked as replaced.

## Lawyer answers (2026-11-23)

- C1 (share for a pass never started): replaced. A pass never started now keeps all its Rounds (recommendation 3, owner and lawyer agree).
- C2 (August 15 in the Terms), C3 (no pro-rata refund for a started pass), C4 (reminders are service mail), C5 (Link), C6 (short camp period): the lawyer is good.
- Washington "use by" question for a started pass (research item 6): the owner and the lawyer accept the keep rule for a started pass, because a pass never started loses nothing and a started pass keeps a share that the buyer paid for.
