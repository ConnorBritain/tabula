# Legal update 5 Part B, draft 3: buy first, set up later, send to one person

2026-11-23. Draft for the owner and the lawyer. Not live.

This draft **replaces** Part B of `LEGAL-UPDATE-5-DRAFT.md` (the lawyer's "good working baseline", 2026-11-22). It follows the later decisions:
- Paid Rounds never expire (update 6 draft 4). The old Part B line "the 12-month periods count from the day that person sets it up" is gone.
- The lawyer's answers on teen Rounds and sending (`docs/design/TEEN-ROUNDS-AND-GIFTS.md` §11b): the word is "send", never "gift"; the sender confirms "I know this person"; the refund and dispute take-back covers sent Rounds.
- The build: tabula-cloud branch `claude/buy-first` (side session "buy-first build", started 2026-11-23), following `docs/design/BUY-FIRST-SPEC.md` draft 2.

Scope: the first send only (buyer to one other person). Later moves (give back, take back, re-send) and the pause refund belong to a later update (update 7, teen Rounds).

## The rules, in short

- A buyer can buy without signing in. We make an Account from the checkout email.
- The buyer uses the Rounds, or sends all unused Rounds of one purchase to one other person through the setup step.
- Before a send, the buyer confirms that they know the person (parent, guardian, coach or teammate).
- The other person signs in or signs up, gives a date of birth, and accepts.
- Under 13 at that step: two confirmations, then a 7-day hold. During the hold we keep only the email, the date of birth and the time. A mistake can be fixed through support. Otherwise the personal data is deleted after 7 days and the buyer can get a refund.
- Sent Rounds keep "no end date" (update 6). Camp Pass Rounds keep their own rule (update 4), and a started Camp Pass cannot be sent.
- A refund or dispute takes back the purchase's unused Rounds from the person who holds them. Any shortfall comes only from the buyer's other unused Rounds, never from the holder's own purchases.

## Publish gate

1. Update 6 (never expire) is live. If update 4 (Camp Pass) is live too, use the Camp variant in T6.
2. The buy-first flow is live on the server and the site, including: the "I know this person" confirm; the accept screen, decline and the 14-day end of an unaccepted send; deletion of the recipient email when a send is accepted, declined or ends (including `mail_outbox` rows and per-recipient cap counters); the parent-or-guardian question and its consent record (P3); return of sent Rounds to the buyer when the holder's Account is deleted (T8); a started Camp Pass cannot be sent; the under-13 hold; the two sender controls from the lawyer's answer 9 (at most 3 different senders per receiving Account in 30 days, keyed on Account ids; and the receiver can decline or block a sender); the Turnstile widget on the guest checkout form with TURNSTILE_SECRET_KEY set (P5 is true only then); the holder-first take-back with buyer-only shortfall; the California renewal consent on the Subscribe button ("Subscribe: renews yearly at $Y", with the bold renewal line, a confirmation email with cancel steps, and consent records kept at least 3 years).
3. ~~The lawyer approves this draft 3.~~ **Done 2026-11-23:** the lawyer agreed with all proposed answers in `private/programs/legal/LAWYER-CONFIRM-SHEET.md` Part 4 (L1 to L13), reported by the owner (relayed from the Programs legal chat). His L7, L10 and L12 answers are in P1, P3 and P4 below.
4. The owner types yes in the marketing chat.

## Terms of Service (`sites/speech/pages/terms.html`)

**T1. §3 Eligibility (replace two sentences)**
- Before: "A parent or guardian can buy a Paid Plan for a minor’s Account. The parent or guardian who buys is responsible for the purchase."
- After: "When you buy a Paid Plan, you confirm that you meet the age rule above, that you are allowed to use the payment method, and that the date of birth on your Account, if you give one, is true. We rely on these statements when you buy. An adult can buy a Paid Plan for an Account holder aged 13 to 17. The adult who buys is responsible for the purchase."

**T2. §4 Accounts (new paragraph after "An Account is for one person. You may not share, sell or transfer your Account.")**
- Add: "If you buy a Paid Plan without signing in, we create an Account with the email you give at checkout, so we can deliver your purchase. You can use the Rounds yourself, or send them to one other person through our setup step. If you send a Subscription, the Rounds from each renewal go to that person, and billing, renewal and cancelling stay with you. The Account stays unverified until someone signs in with that email."

**T3. §6.7 What Rounds are (replace the fourth sentence; live text, unchanged by update 6)**
- Before: "They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise."
- After: "They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise, and except that a buyer may send a purchase to one other person through our setup step (see Section 13)."

**T4. §4 Accounts (new paragraph after T2)**
- Add: "Before you send a purchase, you confirm that you know the person, for example as their parent, guardian, coach or teammate. The person must accept the send. Nothing moves until they do."
- If update 4 (Camp Pass) is live, add: "A Camp Pass that has been started cannot be sent."

**T5. §8 "Disputes and chargebacks" (add after "If the dispute is decided for us, we give them back. If it is decided for you, they are removed.")**
- Add: "This includes Rounds that you sent to another person, and Rounds that another person sent to you. For a sent purchase, we take back or hold back its unused Rounds from the person who holds them, and we give held Rounds back to that person if the dispute is decided for us. We take any shortfall only from the buyer's other unused Rounds, never from the holder's own purchases."
- The first sentence is the lawyer's approved wording (§11b item 6).

**T8. §18 Suspension and termination (replace the sentence)**
- Before: "When your Account ends, your right to use hosted features ends and unused Rounds are forfeited, except where the law requires otherwise."
- After: "When your Account ends, your right to use hosted features ends and unused Rounds are forfeited, except where the law requires otherwise. If unused Rounds on your Account were sent to you by a buyer, they go back to that buyer."

**T6. §13 Acceptable use (replace the item)**
- Before: "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts;"
- After: "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts, except that a buyer may send a purchase to one other person through our setup step;"
- If update 4 is live first: "resell, share, transfer or trade Rounds, Weekend Passes, Camp Passes, Subscriptions or Accounts, except that a buyer may send a purchase to one other person through our setup step;"

**T7. §8 "No refunds" (replace the last two sentences)**
- Before: "The exceptions are where the law requires a refund and where Link gives one under its own rules. Our Refund Policy, Section 6, gives the details."
- After: "Our Refund Policy, Section 6, lists the cases where we give a refund."

## Refund Policy (`sites/speech/pages/refunds.html`)

**R1. §6 "In short" (replace)**
- Before: "We give a refund where the law requires one, and Link may give one under its own rules."
- After: "We give a refund where the law requires one, in a few cases about children and permission, and Link may give one under its own rules."

**R2. §6 body, add after the Link paragraph**
- Add: "We also give a full refund, through Link, in these cases:
  - a child under 13 bought the purchase;
  - you sent the purchase to a person who is under 13, and you ask for a refund;
  - a cardholder tells us that a charge was made without their permission; or
  - a user under 18 bought the purchase, and that user or their parent or guardian asks for a refund."
- The last item covers only a purchase that a minor made, not a purchase that an adult made for a minor.

**R3. Take-back of sent Rounds**
- §6, add after "…then from your other unused Rounds (Terms Section 8).": "This includes Rounds that were sent to another person. We take them back from the person who holds them, and any shortfall only from the buyer's other unused Rounds."
- §8, add after "If the dispute is decided for us, we give them back. If it is decided for you, they are removed.": "For a sent purchase, we hold back its unused Rounds from the person who holds them, and we give them back to that person if the dispute is decided for us."

**R4. §4 "Rounds have no cash value" (replace the second sentence; update 6 R5 text)**
- Before: "They cannot be refunded, redeemed for cash or transferred, except where the law requires otherwise."
- After: "They cannot be refunded, redeemed for cash or transferred, except where the law requires otherwise, and except that a buyer may send a purchase to one other person through our setup step (Terms Section 13)."

## Privacy Policy (`sites/speech/pages/privacy.html`)

**P1. §3 Data we collect (add after "If you create an Account, buy a Paid Plan or join a Program, we collect and store the following on our servers:" list)**
- Add: "If you buy a Paid Plan without signing in, we create an Account with the email you give at checkout, so we can deliver your purchase. If you send the purchase to another person, we use the email you give for them only to send the setup email and to match their acceptance. We delete it when the send is accepted, declined or ends. We keep a record of each send, linking the buyer's and the holder's Accounts, for refunds and disputes."

**P2. §12 Children (add after "We do not knowingly collect personal information from children under 13.")**
- Add: "If someone gives a date of birth under 13 when they set up an Account, we freeze the Account for up to 7 days, so that a mistake can be fixed. During that time we keep only the email address, the date of birth and the time. We use them only for this review. If support confirms that the date was a mistake, the Account opens with the right date. If not, we delete the Account's personal data after 7 days."

**P3. §12 Children (add after P2)**
- Add: "If an adult sends a purchase to an Account holder aged 13 to 17, we ask the adult to confirm that they are the person's parent or guardian and that the person may use Hosted AI. We keep a record of the answer (the date, the notice shown and the two Accounts) while either Account is open, and for 3 years after both Accounts close. Then we delete it."

**P4. §10 Sharing and subprocessors (replace the Resend row)**
- Before: Purpose "Sign-in email"; Data "Email address, sign-in link or code".
- After: Purpose "Email delivery (sign-in, receipts, reminders and setup emails)"; Data "Email address, email content".
- If update 4 goes live first, make this change there instead, because Camp Pass reminders also use Resend.

**P5. Cookies and similar tools, and §10 (Turnstile on guest checkout only)**
- The buy-first server checks Cloudflare Turnstile on guest checkout (tabula-cloud `src/billing/routes.ts`, guest gate). Update 9 removed the old sign-in Turnstile line, because sign-in has no Turnstile.
- Add to the cookies list: "If you buy without signing in, the checkout form uses Cloudflare Turnstile to block automated abuse. Turnstile checks the browser for signs of a bot. It does not track you across sites."
- §10 Cloudflare row, Purpose: add "bot protection on checkout without sign-in (Turnstile)".
- Turnstile is also built (off) for the sign-in form and the send form. On the publish day, name every form where it is on, for example "the sign-in, checkout and send forms".

**Name fix (L13).** If any text from this update names the Plans page, write "the Pricing page (tabulaspeech.com/pricing/)".

## Words

- "Send", never "gift", "give" or "gift card" (`LEGAL-FACTS.md`, "Words for Rounds").

## For the lawyer

- New since his baseline: T4, T5 (its first sentence is his §11b item 6 wording), T8 (§18 carve-out), R3, P1's deletion rule, P3 (consent record), and the removal of the 12-month setup rule (never expire).
- Terms §3 says children under 13 may not give us personal information; P2 keeps a child's minimal data for up to 7 days. He saw this tension in the baseline; please confirm.
- The send record (`payment_moves`) links the buyer's and the holder's Accounts. It is needed for refunds and disputes. Is P1 clear enough about it, or should §3 name it?
