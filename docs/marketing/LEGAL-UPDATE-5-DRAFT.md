# Legal update 5 (draft 2): Link as seller, refunds, disputes, buy first

Status: the lawyer accepted the working answers as "a good working baseline" (owner report, 2026-11-22). He will do a deeper review later. This file turns those answers into exact Terms, Refund Policy and Privacy Policy text. Not published.

- Base text: live pages, tabula-sites `origin/main` 3d00b26 (legal date November 21, 2026). Every "Before" quote was checked against it word for word.
- Source of the answers: `private/legal/BUY-FIRST-LAWYER-BRIEF.md`, section 6 (private). This file cites them as A1 to A16.
- Lines marked **[new]** go beyond the lawyer's working answers. The lawyer should see them in his deeper review.
- Two parts:
  - **Part A: Link as seller, refunds, disputes.** It fixes live text that does not match checkout today. It goes live when the Part A gate is met (below).
  - **Part B: buy first, set up later.** It describes a flow that is not built yet (`docs/design/BUY-FIRST-SPEC.md`). It goes live on the day that flow ships, and only after Part A is live.

## Overlap with legal update 4 (Camp Pass)

Update 4 is lawyer-approved but not live. Both updates change the same lines. Whichever goes live second must keep the other's words:
- Terms §8 "In short" box and "No refunds" list: update 4 adds "Camp Passes".
- Terms §13 list item: update 4 adds "Camp Passes". Part B's merged line is given below.
- Terms §6.6: update 4 adds the Camp Pass expiry. Part B's setup-day rule does not change the Camp Pass 30-day rule (section B.1).
- Refund Policy §1 list, §3, §4 "Expiry" and §4 "Order": update 4 adds "Camp Passes" or the Camp Pass rule. Part B adds a sentence at the end of §4 "Expiry". Keep both.
- Update 4 does not touch Terms §6.7 or Refund §4 "no cash value". Part B changes them alone.
- All three page headers: each publish sets a new "Effective" date.

This file shows the text without the Camp Pass, unless a line says otherwise.

---

# Part A: Link as seller, refunds, disputes

## Part A gate

Publish Part A only when all of these are true:

1. **Live checkout is checked.** Cloud setup confirms, on a live Checkout Session (no purchase by us), that Managed Payments is on and that the page shows "Sold through Link". It also confirms that a customer can cancel a live subscription through Link. If not, remove "through Link" from Terms §8 "Cancelling" and Refund Policy §3. If the live statement name is known, use it in §8 "Payment". If not, the text below stays true.
2. **The dispute hold is changed in the code** (section A.4). Today a dispute puts a billing hold on the account. The hold stops Hosted AI and blocks checkout. Part A says we do not do that.
3. **The live Link refund setting is "Refund without emailing me"** (owner choice O3), so it matches Refund Policy §6.
4. **The owner says yes** in the marketing chat.

**Gate status (2026-11-22, reported by cloud setup and checked in git):**
- Item 1: partly done. Read-only check in the live Stripe dashboard: Managed Payments is on ("Ready to use", default for all Checkout Sessions; no payment has used it yet). The live statement descriptor is `TABULASPEECH`, so the statement will start with `LINK.COM*`. Not checked live: the "Sold through Link" label and cancel through Link. Both were seen in the sandbox. Opening a live Checkout Session needs a prod account with a date of birth.
- Item 2: built, not deployed. tabula-cloud branch `claude/dispute-no-hold` (cf85e36, ee28934, ed8daed): `refreshHold` is removed; a hold that support sets by hand still works. Tests: 456/456 passed on cf85e36. The lost-dispute review flag (O1) is on the same branch (aec73bf, 7360c8c): the second lost dispute adds a "possible fraud" line to the review list, with no hold. Tests: 459/459 passed on 7360c8c.
- Item 3: the owner chose **automatic refunds** in this chat (2026-11-22: "automatic, check after the first month"). The live Stripe setting was switched to "Email me for approval" earlier the same day. Cloud setup must switch it back to "Refund without emailing me" before Part A goes live. Then no 48-hour approval is needed. Review the refund count in the Stripe dashboard one month after the first sale. If there is abuse, switch to approval and update Refund Policy §6.

## A.1 Terms of Service

### §8 "In short" box (A1, A3)

**Before:** "Pattern Engine LLC sells Paid Plans, and Stripe processes payments. Subscriptions renew until you cancel. Single Rounds, Round Packs and Weekend Passes never renew. You can cancel at any time. We do not give refunds, except where the law requires one."

**After:** "Paid Plans bought online are sold through Link, Stripe's checkout service. Programs are sold by Pattern Engine LLC by invoice. Subscriptions renew until you cancel. Single Rounds, Round Packs and Weekend Passes never renew. You can cancel at any time. We do not give refunds, except as our Refund Policy says."

### §8 "Seller" (A1)

**Before:** "**Seller.** The seller of every Paid Plan is Pattern Engine LLC, doing business as Tabula Speech. Checkout and your receipt show the name Tabula Speech."

**After:** "**Seller.** Paid Plans that you buy online (every Paid Plan except a Program) are sold through Link, a service of Stripe. Link is the merchant of record. This means that Link takes the payment and handles sales tax. Checkout shows "Sold through Link". Pattern Engine LLC, doing business as Tabula Speech, provides the Service and the Rounds. These Terms apply to your use of the Service and your Rounds. Link's own terms apply to the payment. Programs are sold by Pattern Engine LLC by invoice or purchase order (see Section 9)."

### §8 "Payment" (A1)

**Before:** "**Payment.** Our payment processor, Stripe, handles all payments. You can pay by card, or with a payment method that Stripe offers at checkout, such as Link, Apple Pay or Google Pay. You authorize us and Stripe to charge your payment method for each purchase and each renewal. Prices are shown on the Plans page and at checkout. Sales tax and similar taxes are calculated and added at checkout. Charges appear on your statement as "TABULA SPEECH", or as a short name that starts with "TABULA"."

**After:** "**Payment.** Link handles payments for Paid Plans bought online. You can pay by card, or with another payment method offered at checkout, such as Apple Pay or Google Pay. You authorize Link to charge your payment method for each purchase and each renewal. Prices are shown on the Plans page and at checkout. Sales tax and similar taxes are calculated and added at checkout. Charges appear on your statement with a name that starts with "LINK.COM*"."

(If the gate check confirms the full name, add it: "…as "LINK.COM* [name]".")

### §8 "Saved payment methods" (A1) [new]

**Before:** "We charge a saved payment method only for a purchase that you start and confirm, and for the renewals of a Subscription that you agreed to."

**After:** "Link charges a saved payment method only for a purchase that you start and confirm, and for the renewals of a Subscription that you agreed to."

### §8 "Automatic renewal" (A1) [new]

**Before:** "A Subscription renews automatically at the end of each billing period, and we charge the price then in effect for your plan, until you cancel."

**After:** "A Subscription renews automatically at the end of each billing period, and Link charges the price then in effect for your plan, until you cancel."

### §8 "Cancelling" (A3)

**Before:** "You can cancel a Subscription at any time in your Account settings, or by email to {{support}}."

**After:** "You can cancel a Subscription at any time in your Account settings, through Link, or by email to {{support}}."

### §8 "No refunds" (A3)

**Before:** "**No refunds.** All purchases are final and non-refundable. This includes Single Rounds, Round Packs, Weekend Passes, Subscriptions, renewals, unused Rounds and partial billing periods. A Round returned under Section 6.3 goes back to your balance. It is not a refund. The only exception is where the law requires a refund. Our Refund Policy gives the full details."

**After:** "**No refunds.** Purchases are final and non-refundable. This includes Single Rounds, Round Packs, Weekend Passes, Subscriptions, renewals, unused Rounds and partial billing periods. A Round returned under Section 6.3 goes back to your balance. It is not a refund. The exceptions are where the law requires a refund and where Link gives one under its own rules. Our Refund Policy, Section 6, gives the details."

### §8 "Disputes and chargebacks" (A15)

The text matches what the code does today with Rounds (tabula-cloud `src/billing/webhook.ts`; `docs/STRIPE.md`: a refund takes back the refunded share of a payment's Rounds, and a dispute holds back the payment's Rounds and gives them back if the dispute is decided for us. Both take from the payment's own Rounds first, then from other unused Rounds). It removes the account suspension.

**Before:** "**Disputes and chargebacks.** If you think a charge is wrong, please contact us first. We will look into it. If you open a payment dispute or chargeback, we may suspend Hosted AI on your Account and remove unspent Rounds while the dispute is open or after it ends. The free app keeps working."

**After:** "**Disputes and chargebacks.** If you think a charge is wrong, please contact us first. We will look into it. If a payment is refunded, we take back Rounds in proportion to the amount refunded: first from that payment's unused Rounds, then from your other unused Rounds. If you open a dispute or chargeback, we hold back Rounds equal to that payment's Rounds, in the same order, while it is open. If the dispute is decided for us, we give them back. If it is decided for you, they are removed. We do not suspend your Account because of a dispute. The free app always keeps working."

### §14 Third-party services (A1) [new]

**Before:** "Stripe processes payments under its own terms and privacy policy."

**After:** "Stripe, through its Link service, sells Paid Plans bought online and processes payments under its own terms and privacy policy."

### §18 Suspension and termination (A15)

**Before:** "…if your use creates risk or harm for us or others, or for fraud, abuse or a payment dispute."

**After:** "…if your use creates risk or harm for us or others, or for fraud or abuse."

### §22.2 Binding arbitration (A2), add at the end

**Add:** "This includes Disputes about the Service or your Rounds when you bought through Link. It does not cover disputes between you and Link about the payment. Link's terms govern those."

### Header

**After:** "Effective [publish date]. Last updated [publish date]."

## A.2 Refund Policy

The Link refund rule is written once, in §6. The other places point to it.

### Lede (A3)

**Before:** "Tabula purchases are not refundable."

**After:** "Tabula purchases are not refundable, except in the cases in Section 6."

### §1 "In short" (A3)

**Before:** "All purchases are final."

**After:** "Purchases are final, except in the cases in Section 6."

### §1 body (A3)

**Before:** "All purchases are final. We do not give refunds for:"

**After:** "Purchases are final. We do not give refunds for:"

**Before:** "The only exception is where the law requires a refund (see Section 6)."

**After:** "The only exceptions are the cases in Section 6."

### §3 How to cancel (A3)

**Before:**
"You can cancel at any time in either of these ways:
- in your Account settings; or
- by email to {{support}} from your Account email address."

**After:**
"You can cancel at any time in any of these ways:
- in your Account settings;
- through Link; or
- by email to {{support}} from your Account email address."

### §5 Renewal reminders (A1)

**Before:** "Charges appear on your card statement as "TABULA SPEECH", or as a short name that starts with "TABULA"."

**After:** "Charges appear on your card statement with a name that starts with "LINK.COM*"."

### §6 title and table of contents (A3)

**Before:** "6. Where the law requires a refund"

**After:** "6. When we give a refund"

### §6 "In short" (A3)

**Before:** "If the law where you live gives you a right to a refund, we honor it."

**After:** "We give a refund where the law requires one, and Link may give one under its own rules."

### §6 body, add a new first paragraph (A1, A3)

**Add:** "Paid Plans bought online are sold through Link, a service of Stripe (Terms Section 8). You can ask Link support or us for a refund. Link decides refund requests under its own rules. For example, Link can give a refund within 60 days of a purchase in certain cases. If a payment is refunded, we take back Rounds in proportion to the amount refunded: first from that payment's unused Rounds, then from your other unused Rounds (Terms Section 8)."

The existing §6 paragraph (the law) stays after it.

### §8 Disputes and chargebacks (A15)

**Before (In short):** "Contact us first. If you file a chargeback, we may pause Hosted AI and remove unspent Rounds. The free app keeps working."

**After (In short):** "Contact us first. While a dispute is open, we hold back Rounds equal to that payment's Rounds. The free app keeps working."

**Before (body):** "If you think a charge is a mistake, please email us first. We will look into it quickly. If you open a dispute or chargeback with your bank or card issuer, we may suspend Hosted AI on your Account and remove unspent Rounds. The free app keeps working on your device."

**After (body):** "If you think a charge is a mistake, please email us first. We will look into it quickly. If you open a dispute or chargeback with your bank or card issuer, we hold back Rounds equal to that payment's Rounds while it is open: first from that payment's unused Rounds, then from your other unused Rounds. If the dispute is decided for us, we give them back. If it is decided for you, they are removed. We do not suspend your Account because of a dispute. The free app keeps working on your device."

### Header

**After:** "Effective [publish date]. Last updated [publish date]."

## A.3 Privacy Policy

### §3 "Payment data" (A1)

**Before:** "Payment data: Stripe collects your payment card details directly. We do not receive or store your full card number. Stripe gives us a record of each payment, its status, and the billing details Stripe uses to calculate tax."

**After:** "Payment data: Link, a service of Stripe, sells Paid Plans bought online as the merchant of record and collects your payment card details directly. Link handles that data under its own privacy policy. We do not receive or store your full card number. Stripe gives us a record of each payment, its status, and the billing details Stripe uses to calculate tax."

### §10 introduction (A1) [new]

**Before:** "Each processes data on our behalf, under a written agreement, and only to provide its service to us."

**After:** "Each processes data on our behalf, under a written agreement, and only to provide its service to us. Stripe is an exception for payments: as Link, it sells Paid Plans bought online and uses payment data under its own privacy policy."

### §10 subprocessor table, Stripe row (A1)

**Before:** "Stripe | Payments and sales tax | Email address, payment card and billing details, purchase records"

**After:** "Stripe (including Link) | Payments, sales tax, and selling Paid Plans bought online as merchant of record | Email address, payment card and billing details, purchase records"

### Header

**After:** "Effective [publish date]. Last updated [publish date]."

## A.3b Plans page (marketing; publish with Part A)

### Fine print (live today; tabula-sites `plans.html`)

**Before:** "Payments are handled by Stripe. Paid plans are not refundable: read the refund policy and the terms."

**After:** "Online purchases are sold through Link, a service of Stripe. Purchases are final, except in the cases in our refund policy. Read the refund policy and the terms."

(Marketing first reported a trial FAQ line too. It is not on the live page or on origin/main, so it needs no change.)

### Footer

"© 2026 Pattern Engine LLC." does not change. Pattern Engine LLC still owns the site and provides the Service.

## A.4 Product changes that Part A needs (cloud setup)

1. **Disputes (gate item 2).** Today `refreshHold` (`src/billing/webhook.ts`) sets `billing_hold_at` while a dispute is open **or lost**. The hold is read in `src/billing/routes.ts` (it blocks checkout with `billing_hold`), `capabilities.ts` and `ai/proxy.ts` (it stops Hosted AI). Change: a dispute no longer sets the hold, open or lost. Keep the Rounds rule as it is (hold back while open, give back if won). Support can still suspend an account for fraud (Terms §18). Owner question O1 covers repeat lost disputes.
2. **Live checkout check (gate item 1).** Open a live Checkout Session without paying. Confirm Managed Payments and "Sold through Link". Find the live statement name.
3. **48-hour support rule (gate item 3).** Who watches Link support requests, and how.
4. **Repeat-refund review flag** (owner yes, 2026-11-22): at an account's 2nd refunded payment, add a "repeat refunds" line to the review list. A flag only, no hold. Sent to cloud setup.
5. **Docs.** `docs/STRIPE.md` §5 item 5 still says "Refunds: 14 days, unused credits only". That is an old plan and does not match the Terms. Update it to point to the Refund Policy.

---

# Part B: buy first, set up later

## Part B gate

Publish Part B only when all of these are true:

1. Part A is live.
2. The buy-first flow is live (`docs/design/BUY-FIRST-SPEC.md`), including the California renewal consent on the Subscribe button (A14).
3. The owner says yes in the marketing chat.

## B.1 Terms of Service

### §3 Eligibility (A4)

**Before:** "A parent or guardian can buy a Paid Plan for a minor's Account. The parent or guardian who buys is responsible for the purchase."

**After:** "When you buy a Paid Plan, you confirm that you meet the age rule above, that you are allowed to use the payment method, and that the date of birth on your Account is true. We rely on these statements when you buy. An adult can buy a Paid Plan for an Account holder aged 13 to 17. The adult who buys is responsible for the purchase."

### §4 Accounts (A5), new item

**Add:** "If you buy a Paid Plan without signing in, we create an Account with the email you give at checkout, so we can deliver your purchase. You can use the Rounds yourself, or send them to one other person through our setup step. The Account stays unverified until someone signs in with that email."

### §6.6 Round expiry (A10), new item

**Add:** "If you send a purchase to another person through our setup step, the 12-month periods in this section count from the day that person sets it up, not from the date of purchase. A Weekend Pass or Camp Pass keeps its own rule: its days start when its first Round is committed."

(Owner question O2: yes, 2026-11-22.)

### §6.7 What Rounds are (A9) [new]

**Before:** "They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise."

**After:** "They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise, and except that a buyer may send a purchase to one other person through our setup step (see Section 13)."

### §8 "No refunds" (A4, A6)

**Before (after Part A):** "The exceptions are where the law requires a refund and where Link gives one under its own rules. Our Refund Policy, Section 6, gives the details."

**After:** "Our Refund Policy, Section 6, lists the cases where we give a refund."

### §8 "In short" (after Part A)

No change. It already says "except as our Refund Policy says".

### §13 Acceptable use (A9)

**Before:** "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts;"

**After:** "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts, except that a buyer may send a purchase to one other person through our setup step;"

**If update 4 is live first, use:** "resell, share, transfer or trade Rounds, Weekend Passes, Camp Passes, Subscriptions or Accounts, except that a buyer may send a purchase to one other person through our setup step;"

## B.2 Refund Policy

### §6 "In short"

**Before (after Part A):** "We give a refund where the law requires one, and Link may give one under its own rules."

**After:** "We give a refund where the law requires one, in a few cases about children and permission, and Link may give one under its own rules."

### §6 body, add after the Link paragraph (A4, A6)

**Add:** "We also give a full refund, through Link, in these cases:
- a child under 13 bought the purchase;
- you sent the purchase to a person who is under 13, and you ask for a refund;
- a cardholder tells us that a charge was made without their permission; or
- a user under 18 bought the purchase, and that user or their parent or guardian asks for a refund."

The last item covers only a purchase that a minor made. It does not cover a purchase that an adult made for a minor (A4).

### §4 "Expiry" (A10)

**Add at the end:** "If a purchase is sent to another person through our setup step, its 12-month periods count from the day that person sets it up (Terms Section 6.6)."

### §4 "Rounds have no cash value" (A9)

**Before:** "They cannot be refunded, redeemed for cash or transferred."

**After:** "They cannot be refunded, redeemed for cash or transferred, except that a buyer may send a purchase to one other person through our setup step (Terms Section 13)."

## B.3 Privacy Policy

### §3 Data we collect (A5), add after the first paragraph

**Add:** "If you buy a Paid Plan without signing in, we create an Account with the email you give at checkout, so we can deliver your purchase. If you send the purchase to another person, we use the email you give for them only to send the setup email. We do not keep it after that."

### §12 Children (A6), add after "We do not knowingly collect personal information from children under 13."

**Add:** "If someone gives a date of birth under 13 when they set up an Account, we freeze the Account for up to 7 days, so that a mistake can be fixed. During that time we keep only the email address, the date of birth and the time. We use them only for this review. If support confirms that the date was a mistake, the Account opens with the right date. If not, we delete the Account's personal data after 7 days."

## B.4 Product rules that Part B needs

All are in `docs/design/BUY-FIRST-SPEC.md`, plus:
- A14: the Subscribe button states the renewal ("Subscribe: renews yearly at $Y"), with the bold renewal line above it, a confirmation email with cancel steps, and consent records kept for at least 3 years.
- A10: the owner accepted O2, so the spec counts expiry from the setup day for a sent purchase.

---

## Owner questions

- **O3. Link refund setting.** Answered: automatic ("Refund without emailing me"), with a review after the first month (owner, in this chat, 2026-11-22). This replaces an earlier choice of "Email me for approval".

Answered 2026-11-22: yes to O1 and yes to O2.

- **O1. Repeat lost disputes.** After this change, a dispute never suspends an account. Should support review an account that loses 2 or more disputes, as possible fraud (Terms §18)? I recommend yes. It is a person's decision, not an automatic hold.
- **O2. Expiry for a purchase sent to someone (A10).** The lawyer's baseline says it is safer to count the 12 months from the setup day. I recommend it. The spec counts from the purchase date today, so the spec must change too.

## For the lawyer's deeper review

- The lines marked **[new]**: Terms §8 "Saved payment methods" and "Automatic renewal", §14, §6.7, and the Privacy §10 introduction. They follow from A1 and A9, but he did not see the words.
- The Program carve-out in §8: Programs stay sold by Pattern Engine LLC by invoice.
- Part A describes the refund and dispute Rounds rule as the code works: hold back while open, give back if won, and take from the payment's own Rounds first, then from the user's other unused Rounds. The working answer A15 said only "take back the unused Rounds from that payment". If he wants only that payment's Rounds taken, the code must change.
- Terms §3 says "Children under 13 may not… give us personal information". Privacy §12 (Part B) keeps a child's minimal data for up to 7 days.

## Checklist

- [ ] Cloud setup: live checkout check, dispute hold change, STRIPE.md fix (A.4).
- [ ] Owner: the 48-hour support rule.
- [x] Owner answers O1 and O2 (yes to both, 2026-11-22).
- [ ] Owner says yes to Part A in the marketing chat. Marketing publishes Part A.
- [ ] The buy-first flow ships. Owner says yes. Marketing publishes Part B the same day.
