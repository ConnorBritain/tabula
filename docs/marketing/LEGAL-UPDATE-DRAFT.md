# Legal update draft: new individual products (for owner and lawyer check)

Draft 4, 2026-11-20, with the owner's answers. **Not approved. Not live.** Do not copy this text to the live pages until the owner and a lawyer approve it.

## Why this update is needed

On 2026-11-20 the owner chose new individual prices. Users now see rounds, not credits. The live Terms of Service and Refund Policy still describe only the old Round Packs and the monthly or yearly Pass. Checkout must not go live until the pages match the products.

Source files (do not edit until approved):

- `~/Code/tabula-sites/sites/speech/pages/terms.html` (live at tabulaspeech.com/terms/)
- `~/Code/tabula-sites/sites/speech/pages/refunds.html` (live at tabulaspeech.com/refunds/)

## How to read this draft

- Each section gives the **Before** text (live today) and the **After** text (proposed). Sections with large changes (Terms §6 and §8) quote the live text in full. Other sections quote only the sentences that change.
- Sections that are not listed here do not change.
- `{{support}}`, `{{trial_days}}` and `{{trial_rounds}}` are template slots. The build fills them in. Keep them.
- **[LAWYER Ln]** marks a point for the lawyer. The table "Points for the lawyer" at the end explains each one.
- **[OWNER Qn]** marks a point that waits for an owner decision. The table "Open questions for the owner" at the end explains each one. Text in square brackets is not decided yet. After the owner's answers, no decision text is still in brackets.
- **[CHANGED]** marks a fact that the live text states wrongly today.
- **[NEW]** marks a promise or rule that is not in the live text in any form.
- Two words stay apart in the After text:
  - **Round** (capital R) is the unit that the user buys and uses.
  - **debate round** is the real event that a judge judges.
- The After text keeps the live legal words "expire", "forfeited" and "unspent". It changes "Credits" to "Rounds" and "Pass" to the new product names only. This keeps the legal meaning the same.

## Products covered

| Product | Price | Rounds | Rounds expire | Renews? |
|---|---|---|---|---|
| Single Round | $2, no minimum | 1 | 12 months after purchase [OWNER Q1] | No |
| Round Pack | $5 / $10 / $20 | 3 / 7 / 16 | 12 months after purchase | No |
| Weekend Pass | $10 | 8 | 4 days after the clock starts [OWNER Q4] | No |
| Monthly plan | $15 a month | 13 each month | Roll over while active; expire at end of last paid month | Yes, monthly |
| Season plan (the yearly plan) | $79 a year | 70 | End of the 12-month term | Yes, yearly [OWNER Q5] |
| All-Access plan | $149 a year | 135, for Tabula Debate and Tabula Speech Events | End of the 12-month term | Yes, yearly [OWNER Q5] |
| Free trial | Free, no card | 8 | 7 days or 8 Rounds, first to come | No |
| School Program, including school-paid judge Rounds | By invoice or purchase order | Shared pool | July 31 | No (by order) |

## Changes needed outside these two pages

These are not legal text. But the After text depends on them.

1. **Plans page.** The After text says the Plans page and checkout show how many Rounds each product includes. The live Plans page shows no round counts. The owner decided (Q2): the Plans page and checkout both show the counts. The Plans page must add them before checkout goes live. [OWNER Q2]
2. **Monthly rollover cap.** The live pages say the cap is "shown on the Plans page and at checkout". `LEGAL-FACTS.md` says the number is not public yet. The cap number must be on the Plans page or at checkout before checkout goes live. [OWNER Q10]
3. **`docs/marketing/LEGAL-FACTS.md`.** Change these rows with the pages:
   - "Pass price: $5 a month or $50 a year" (now wrong).
   - "Renewal reminder" (now Season and All-Access).
   - "Credit expiry" (now Round expiry, with the new products).
   - "Chargebacks" ("unspent credits" becomes "unspent Rounds").
   - "Statement descriptor" ("TABULA DEBATE" becomes "TABULA SPEECH", short "TABULA"). Add the trade name Tabula Speech.
   - Add rows for the return rule, the spend order, saved payment methods and school-paid judge Rounds.
4. **Page metadata and links.** See "Small word changes" in Part 3.
5. **Apple Pay.** Terms §8 names Apple Pay. Apple Pay works only after the owner verifies the domain in Stripe. Remove "Apple Pay" from §8 if that is not done before checkout goes live.
6. **Privacy page.** Terms §8 now names Link, Apple Pay and Google Pay. Check that the Privacy Policy covers the data that Stripe and the wallet providers handle. [LAWYER L14]

---

# Part 1: Terms of Service

## Terms §2. Definitions

**Before**

> "Hosted AI" means AI features that we provide through our servers and pay for with Credits.
>
> "Credits" means the units that pay for Hosted AI. The app shows your Credits as rounds left.
>
> "Paid Plan" means a Round Pack, a Pass or a Program, as described in Section 6.
>
> "Program" means a paid plan for a school or team, with a shared pool of Credits and one or more administrators ("Program Admins").

**After**

> "Hosted AI" means AI features that we provide through our servers and pay for with Rounds.
>
> "Round" means the unit of Hosted AI that you use when you start a debate round with Hosted AI on. One debate round normally uses one Round. Section 6 explains when a debate round can use more. The app shows how many Rounds you have left. Inside our systems we measure Hosted AI use in smaller units. You do not buy those units, and the app does not show them. [LAWYER L1]
>
> "Paid Plan" means a Single Round, a Round Pack, a Weekend Pass, a Subscription or a Program, as described in Section 6.
>
> "Subscription" means a Paid Plan that renews automatically: the Monthly plan, the Season plan and the All-Access plan. [OWNER Q5]
>
> "Program" means a paid plan for a school or team, with a shared pool of Rounds and one or more administrators ("Program Admins").

## Terms §6. Paid plans and credits → Paid plans and Rounds

**Before (live text, in full)**

> **6. Paid plans and credits**
>
> In short: Paid Plans give you Credits for Hosted AI. Credits expire on the schedule below. If you run low during a round, the round keeps working.
>
> The Paid Plans below are the types of plan we offer. Not every plan is on sale at all times. The Plans page shows which plans are available now and their current prices, and checkout shows the final price before you pay.
>
> - Round Pack. A one-time purchase of Credits.
> - Pass. A subscription billed monthly or yearly that grants Credits for each billing period.
> - Program. A plan for schools and teams with a shared pool of Credits, paid by invoice or purchase order.
>
> Credit expiry. Credits expire as follows:
>
> - Round Pack Credits expire 12 months after the date of purchase.
> - Monthly Pass Credits roll over from month to month while your Pass stays active. Your rolled-over balance is capped at the amount shown on the Plans page and at checkout. Credits above the cap are not added.
> - Yearly Pass Credits expire at the end of the 12-month term in which they were granted.
> - Program Credits expire on July 31 following the start of the Program term.
>
> What Credits are. Credits are a limited, revocable license to use Hosted AI. They are not money, a deposit, a stored-value instrument or property. They have no cash value. They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise. We may set how many Credits each Hosted AI feature uses, and the app shows this before or as you use it.
>
> Failed requests. If a Hosted AI request fails because of a problem on our side, we do not charge Credits for it.
>
> Low balance. A round never breaks when your Credits run low or run out. The clock, flow and ballot keep working. Hosted AI steps down to the free tools in the app.

**After (in full)**

> **6. Paid plans and Rounds**
>
> In short: Paid Plans give you Rounds for Hosted AI. One debate round normally uses one Round. You can return a Round until the first speech is recorded. Rounds expire on the schedule below. If you run low during a debate round, the debate round keeps working.
>
> **6.1 Plans we offer.** The Paid Plans below are the types of plan we offer. Not every plan is on sale at all times. The Plans page shows which plans are available now and their current prices. The Plans page and checkout show how many Rounds each plan includes. Checkout shows the final price and the number of Rounds before you pay. [OWNER Q2]
>
> - **Single Round.** A one-time purchase of 1 Round.
> - **Round Pack.** A one-time purchase of a set number of Rounds.
> - **Weekend Pass.** A one-time purchase of a set number of Rounds to use in 4 days. The 4 days start when the first Round from the pass is committed (see 6.3). [OWNER Q4] A Weekend Pass does not renew.
> - **Monthly plan.** A Subscription billed each month. It gives a set number of Rounds each month.
> - **Season plan.** A Subscription billed each year. It gives a set number of Rounds for the 12-month term.
> - **All-Access plan.** A Subscription billed each year. It gives a set number of Rounds for the 12-month term. You can use these Rounds in Tabula Debate and in Tabula Speech Events. We sell All-Access only after Tabula Speech Events is open to the public. [OWNER Q7] [LAWYER L7]
> - **Program.** A plan for schools and teams with a shared pool of Rounds, paid by invoice or purchase order (see Section 9).
>
> **6.2 How a Round is used.** A Round is held from your balance when you start a debate round with Hosted AI on. It counts as used when it is committed (see 6.3). Until then you can return it, and it does not count toward any limit, such as the trial limit. Each Round has a Hosted AI budget. The app uses this budget first for the core of the debate round: transcription, the live flow, the ballot draft and the decision draft. Extra features use only the rest of the budget. When extra features use up their part, the app asks if you want to use another Round to keep them on. We use another Round only if you say yes. [LAWYER L6]
>
> **6.3 Returning a Round.** **[NEW]** You can return a Round until the first speech of that debate round is recorded. To return it, leave or close the debate round before the first speech, and confirm when the app asks. The Round goes back to the balance it came from, with the same expiry date. If that balance has already expired, the Round does not come back. When the first speech is recorded, the Round is committed. "Committed" means the Round is used and cannot be returned. A Round that you add for extra features (see 6.2) is committed when you add it. [OWNER Q14] A returned Round is not a refund. No money is paid back. This rule also applies to free trial Rounds. [OWNER Q8] [LAWYER L5]
>
> **6.4 Long debate rounds.** **[NEW]** The core of a debate round always finishes. If a very long debate round needs more Hosted AI for the core than one Round holds, we cover the extra. The core of one debate round never uses more than one Round. A debate round is never cut off. Only extra features can use another Round, and only if you say yes (see 6.2). [LAWYER L2]
>
> **6.5 Which Rounds we use first.** We use your Rounds in this order: first Weekend Pass Rounds, then Subscription Rounds, then Single Round and Round Pack Rounds. Inside each group, we use the Rounds that expire soonest first. Program Rounds are not part of this order. Section 9 explains how they are kept apart.
>
> **6.6 Round expiry.** Rounds expire as follows. Unused Rounds are forfeited when they expire.
>
> - Single Round and Round Pack Rounds expire 12 months after the date of purchase. [OWNER Q1] [LAWYER L3]
> - Weekend Pass Rounds expire 4 days after the first Round from the pass is committed. If you never commit a Round from the pass, its Rounds expire 12 months after the date of purchase. [OWNER Q4] [LAWYER L4]
> - Monthly plan Rounds roll over from month to month while your plan stays active. Your rolled-over balance is capped at the amount shown on the Plans page and at checkout. Rounds above the cap are not added. When your plan ends, unused Monthly plan Rounds expire at the end of your last paid month. [OWNER Q10]
> - Season plan and All-Access plan Rounds expire at the end of the 12-month term in which they were granted. All 135 All-Access Rounds are granted at the start of the term. [OWNER Q6]
> - Free trial Rounds expire as Section 7 says.
> - Program Rounds expire on July 31 following the start of the Program term.
>
> **6.7 What Rounds are.** Rounds are a limited, revocable license to use Hosted AI. They are not money, a deposit, a stored-value instrument (an account or card that holds money to spend later) or property. They have no cash value. They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise. [LAWYER L3]
>
> **6.8 Failed requests.** If a Hosted AI request fails because of a problem on our side, we do not charge Rounds for it.
>
> **6.9 Low balance.** A debate round never breaks when your Rounds run low or run out. The clock, flow and ballot keep working. Hosted AI steps down to the free tools in the app.

What changed, in short:

- The product list has the new products.
- 6.2, 6.3, 6.4 and 6.5 are **[NEW]**.
- The live sentence "We may set how many Credits each Hosted AI feature uses, and the app shows this before or as you use it" is removed. Users now see whole Rounds, and 6.2 replaces it.
- The live text in 6.7, 6.8 and 6.9 is kept, with "Credits" changed to "Rounds" and "round" changed to "debate round".

## Terms §7. Free trial

**Before**

> In short: New Accounts get a {{trial_days}}-day free trial with {{trial_rounds}} rounds of Hosted AI. No card is needed. One trial per person.
>
> Each new Account gets one free trial. The trial lasts 7 days and includes {{trial_rounds}} rounds of Hosted AI. The trial ends when the 7 days pass or when you have used the {{trial_rounds}} rounds, whichever comes first.
>
> [...] we may void the trial and remove any unused trial rounds.

**After**

> In short: New Accounts get a {{trial_days}}-day free trial with {{trial_rounds}} Rounds of Hosted AI. No card is needed. One trial per person.
>
> Each new Account gets one free trial. The trial lasts {{trial_days}} days and includes {{trial_rounds}} Rounds of Hosted AI. The trial ends when the {{trial_days}} days pass or when you have used the {{trial_rounds}} Rounds, whichever comes first.
>
> [...] we may void the trial and remove any unused trial Rounds.

Notes:

- The live text writes "7 days" in two places and uses the slot in the summary. The After text uses the slot in all places, so the numbers cannot drift.
- All other trial text stays the same: 7 days, 8 Rounds, no card, one per person, does not turn into a paid plan.

## Terms §8. Billing, renewal and refunds

**Before (live text, in full)**

> In short: Stripe processes payments. A Pass renews until you cancel. You can cancel at any time. We do not give refunds, except where the law requires one.
>
> Payment. Our payment processor, Stripe, handles all card payments. You authorize us and Stripe to charge your payment method for each purchase and each renewal. Prices are shown on the Plans page and at checkout. Sales tax and similar taxes are calculated and added at checkout. Charges appear on your statement as "TABULA DEBATE".
>
> Automatic renewal. A Pass renews automatically at the end of each monthly or yearly billing period, and we charge the price then in effect for your plan, until you cancel. At least 7 days and no more than 30 days before each yearly renewal, we send a reminder to your Account email.
>
> Cancelling. You can cancel a Pass at any time in your Account settings, or by email to {{support}}. Cancellation stops future renewals. You keep access, and you can use your Credits, until the end of the period you have already paid for.
>
> Price changes. We may change our prices. A price change for a Pass applies from your next renewal after we give you notice. If you do not agree to the new price, you can cancel before that renewal.
>
> No refunds. All purchases are final and non-refundable. This includes Round Packs, Passes, renewals, unused Credits and partial billing periods. The only exception is where the law requires a refund. Our Refund Policy gives the full details.
>
> Disputes and chargebacks. If you think a charge is wrong, please contact us first. We will look into it. If you open a payment dispute or chargeback, we may suspend Hosted AI on your Account and remove unspent Credits while the dispute is open or after it ends. The free app keeps working.

**After (in full)**

> In short: Pattern Engine LLC sells Paid Plans, and Stripe processes payments. Subscriptions renew until you cancel. Single Rounds, Round Packs and Weekend Passes never renew. You can cancel at any time. We do not give refunds, except where the law requires one.
>
> **Seller.** **[NEW]** The seller of every Paid Plan is Pattern Engine LLC, doing business as Tabula Speech. Checkout and your receipt show the name Tabula Speech. [OWNER Q15] [LAWYER L13]
>
> **Payment.** Our payment processor, Stripe, handles all payments. You can pay by card, or with a payment method that Stripe offers at checkout, such as Link, Apple Pay or Google Pay. You authorize us and Stripe to charge your payment method for each purchase and each renewal. Prices are shown on the Plans page and at checkout. Sales tax and similar taxes are calculated and added at checkout. Charges appear on your statement as "TABULA SPEECH", or as a short name that starts with "TABULA". **[CHANGED]** [LAWYER L13] [LAWYER L14]
>
> **Saved payment methods.** **[NEW]** If you save a payment method, Stripe or the wallet provider (for example, Apple or Google) stores it. We do not store your full card number. We charge a saved payment method only for a purchase that you start and confirm, and for the renewals of a Subscription that you agreed to. You can remove a saved payment method at any time in your Account settings. [OWNER Q13] [LAWYER L14]
>
> **Automatic renewal.** A Subscription renews automatically at the end of each billing period, and we charge the price then in effect for your plan, until you cancel. The Monthly plan renews each month. The Season and All-Access plans renew each year. [OWNER Q5] At least 7 days and no more than 30 days before each yearly renewal, we send a reminder to your Account email. Single Rounds, Round Packs and Weekend Passes are one-time purchases. They never renew. [LAWYER L8] [LAWYER L9]
>
> **Cancelling.** You can cancel a Subscription at any time in your Account settings, or by email to {{support}}. Cancellation stops future renewals. You keep access, and you can use your Rounds, until the end of the period you have already paid for.
>
> **Price changes.** We may change our prices. A price change for a Subscription applies from your next renewal after we give you notice. If you do not agree to the new price, you can cancel before that renewal.
>
> **No refunds.** All purchases are final and non-refundable. This includes Single Rounds, Round Packs, Weekend Passes, Subscriptions, renewals, unused Rounds and partial billing periods. A Round returned under Section 6.3 goes back to your balance. It is not a refund. The only exception is where the law requires a refund. Our Refund Policy gives the full details. [LAWYER L5]
>
> **Disputes and chargebacks.** If you think a charge is wrong, please contact us first. We will look into it. If you open a payment dispute or chargeback, we may suspend Hosted AI on your Account and remove unspent Rounds while the dispute is open or after it ends. The free app keeps working.

What changed, in short:

- "Pass" becomes "Subscription". "Credits" becomes "Rounds".
- "handles all card payments" becomes "handles all payments", and Link, Apple Pay and Google Pay are named.
- "Seller" and "Saved payment methods" are **[NEW]**.
- The statement descriptor changes from "TABULA DEBATE" to "TABULA SPEECH" (long) and "TABULA" (short). The owner confirmed these are the Stripe settings. The live text is wrong today.
- The two sentences about one-time purchases are new, but they only state how the product works.

## Terms §9. School Programs

**Before**

> The Program Customer chooses its Program Admins. Program Admins may add and remove members, assign Credits from the shared pool and set policy, including turning AI off for students. Students for whom AI is off see no AI features.

**After**

> The Program Customer chooses its Program Admins. Program Admins may add and remove members, assign Rounds from the shared pool and set policy, including turning AI off for students. Students for whom AI is off see no AI features.
>
> **School-paid judge Rounds.** **[NEW]** A Program can pay for Rounds that a judge uses, for example at a tournament. These Rounds come from the Program pool. They follow the Program terms, not the terms for your own Paid Plans. They expire on July 31 following the start of the Program term. They are not refundable, unless a written agreement signed by Pattern Engine LLC and the school says otherwise. The return rule in Section 6.3 applies to them. They stay in the Program pool. They never move into a judge's own Round balance, and a judge cannot keep them after the Program removes the judge. A judge's own Rounds are never used for Program work. [OWNER Q9] [OWNER Q11] [LAWYER L15]

Notes:

- School purchases stay final and expire July 31, as the live Refund Policy says. Nothing in this draft changes that.

## Terms §13. Acceptable use

**Before**

> In short: Use Tabula fairly and lawfully. Do not abuse it, scrape it, resell credits or get around limits.
>
> - resell, share, transfer or trade Credits, trials or Accounts;
> - get around usage limits, trial limits, credit metering, access controls or Program policies;

**After**

> In short: Use Tabula fairly and lawfully. Do not abuse it, scrape it, resell Rounds or get around limits.
>
> - resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions, trials or Accounts;
> - get around usage limits, trial limits, Round metering, access controls or Program policies;

## Terms §17. Availability and changes

**Before**

> If we stop offering Hosted AI entirely, we will give you reasonable notice and, where the law requires, a remedy for unused Credits.

**After**

> If we stop offering Hosted AI entirely, we will give you reasonable notice and, where the law requires, a remedy for unused Rounds. [LAWYER L10]

## Terms §18. Suspension and termination

**Before**

> When your Account ends, your right to use hosted features ends and unused Credits are forfeited, except where the law requires otherwise.

**After**

> When your Account ends, your right to use hosted features ends and unused Rounds are forfeited, except where the law requires otherwise.

## Terms §24. Changes to these Terms

**Before**

> If you do not agree, you must stop using the Service and may cancel any Pass.

**After**

> If you do not agree, you must stop using the Service and may cancel any Subscription.

## Terms header

**Before:** "Effective November 20, 2026. Last updated November 20, 2026."

**After:** "Effective [date checkout goes live]. Last updated [same date]." [LAWYER L11]

---

# Part 2: Refund Policy

The Refund Policy is a short summary. The full rules are in Terms §6 and §8. The After text points there, so the rules are written in one place only.

## Refunds §1. No refunds

**Before**

> All purchases are final. We do not give refunds or credits for:
> - Round Packs;
> - monthly or yearly Passes, including automatic renewals;
> - unused or expired Credits; or
> - partial billing periods, including when you cancel part of the way through a period.

**After**

> All purchases are final. We do not give refunds for:
> - Single Rounds and Round Packs;
> - Weekend Passes, including Rounds that you did not use in the 4 days;
> - Monthly, Season and All-Access plans, including automatic renewals;
> - unused or expired Rounds; or
> - partial billing periods, including when you cancel part of the way through a period.
>
> You can return a Round until the first speech of that debate round is recorded (Terms Section 6.3). A returned Round goes back to your balance. It is not a refund. No money is paid back.

Note: draft 4 kept "refunds or credits" [LAWYER L12]. At publish on 2026-11-20 the owner changed it to "refunds" only.

## Refunds §2. Free trial

**Before**

> In short: Test Hosted AI free for 7 days, with {{trial_rounds}} rounds included. No card is needed.
>
> Each new Account gets a {{trial_days}}-day free trial that includes {{trial_rounds}} rounds of Hosted AI.

**After**

> In short: Test Hosted AI free for {{trial_days}} days, with {{trial_rounds}} Rounds included. No card is needed.
>
> Each new Account gets a {{trial_days}}-day free trial that includes {{trial_rounds}} Rounds of Hosted AI.

## Refunds §3. How to cancel

**Before**

> A Pass renews automatically at the end of each monthly or yearly period until you cancel. You can cancel at any time in either of these ways: [...]
>
> Cancellation stops all future renewal charges. You keep access to your Pass, and you can use your Credits, until the end of the period you have already paid for. We do not refund the rest of that period.

**After**

> The Monthly plan renews each month, and the Season and All-Access plans renew each year, until you cancel. [OWNER Q5] You can cancel at any time in either of these ways: [...]
>
> Cancellation stops all future renewal charges. You keep your plan, and you can use your Rounds, until the end of the period you have already paid for. We do not refund the rest of that period.
>
> Single Rounds, Round Packs and Weekend Passes never renew, so there is nothing to cancel.

## Refunds §4. What happens to credits → What happens to Rounds

**Before (live text, in full)**

> In short: Credits expire on a fixed schedule, and they have no cash value.
>
> - Round Pack Credits expire 12 months after purchase, whether or not you have a Pass.
> - Monthly Pass Credits roll over while your Pass stays active, up to the balance cap shown on the Plans page and at checkout. When your Pass ends, unused Pass Credits expire at the end of your last paid period.
> - Yearly Pass Credits expire at the end of the 12-month term.
> - Program Credits expire on July 31.
> - If a Hosted AI request fails because of a problem on our side, we do not charge Credits for it.
>
> Credits have no cash value. They cannot be refunded, redeemed for cash or transferred. If your Credits run out during a round, the round keeps working: the clock, flow and ballot stay on, and Hosted AI steps down to the free tools.

**After (in full)**

> **4. What happens to Rounds**
>
> In short: You can return a Round until the first speech is recorded. Rounds expire on a fixed schedule. Rounds have no cash value.
>
> - **Return.** You can return a Round until the first speech of that debate round is recorded. After that, the Round is committed (used) and cannot be returned. A returned Round is not a refund. Terms Section 6.3 gives the full rule.
> - **Expiry.** Single Round and Round Pack Rounds expire 12 months after purchase. Weekend Pass Rounds expire 4 days after the first Round from the pass is committed. Monthly plan Rounds roll over while your plan stays active, up to a cap. Season and All-Access Rounds expire at the end of the 12-month term. Free trial Rounds expire when the trial ends. Program Rounds expire on July 31. Terms Section 6.6 gives the full schedule.
> - **Order.** We use Weekend Pass Rounds first, then Subscription Rounds, then Single Round and Round Pack Rounds. Terms Section 6.5 gives the full rule.
> - **Failed requests.** If a Hosted AI request fails because of a problem on our side, we do not charge Rounds for it.
>
> Rounds have no cash value. They cannot be refunded, redeemed for cash or transferred. If your Rounds run out during a debate round, the debate round keeps working: the clock, flow and ballot stay on, and Hosted AI steps down to the free tools.

## Refunds §5. Renewal reminders

**Before**

> In short: We email you before each yearly renewal.
>
> At least 7 days and no more than 30 days before each yearly Pass renewal, we send a reminder to your Account email. It gives the renewal date and how to cancel.

**After**

> In short: We email you before each yearly renewal.
>
> At least 7 days and no more than 30 days before each Season or All-Access renewal, we send a reminder to your Account email. It gives the renewal date, the price **[NEW]** and how to cancel. [LAWYER L9] Your receipt for each charge comes by email. Charges appear on your card statement as "TABULA SPEECH", or as a short name that starts with "TABULA". **[CHANGED]**

Before (rest of the same paragraph): "Your receipt for each charge comes by email. Charges appear on your card statement as "TABULA DEBATE"."

## Refunds §7. School Programs

**Before**

> Programs paid by invoice or purchase order are not refundable, unless a written agreement signed by Pattern Engine LLC and the school says otherwise. Program Credits expire on July 31.

**After**

> Programs paid by invoice or purchase order are not refundable, unless a written agreement signed by Pattern Engine LLC and the school says otherwise. This includes Rounds that a Program pays for judges. **[NEW]** [LAWYER L15] Program Rounds expire on July 31.

## Refunds §8. Disputes and chargebacks

**Before**

> In short: Contact us first. If you file a chargeback, we may pause Hosted AI and remove unspent Credits. The free app keeps working.
>
> [...] we may suspend Hosted AI on your Account and remove unspent Credits. The free app keeps working on your device.

**After**

> In short: Contact us first. If you file a chargeback, we may pause Hosted AI and remove unspent Rounds. The free app keeps working.
>
> [...] we may suspend Hosted AI on your Account and remove unspent Rounds. The free app keeps working on your device.

## Refunds header

**Before:** "Effective November 20, 2026. Last updated November 20, 2026."

**After:** "Effective [date checkout goes live]. Last updated [same date]."

Refunds §6 and §9 do not change.

---

# Part 3: Small word changes

These are the remaining uses of "Credits", "credits" or "Pass" in the two source files. A search of both files for `credit`, `Pass` and `unspent` found them all. Each one changes as shown.

| File and place | Before | After |
|---|---|---|
| terms.html line 1, page description | accounts, credits, plans, the free trial | accounts, Rounds, plans, the free trial |
| terms.html table of contents | 6. Paid plans and credits | 6. Paid plans and Rounds |
| terms.html §2 "Service" | accounts, credits, hosted features and support | accounts, Rounds, hosted features and support |
| terms.html §10 Open source | including Accounts, Credits, Hosted AI | including Accounts, Rounds, Hosted AI |
| refunds.html line 1, page description | what happens to credits | what happens to Rounds |
| refunds.html table of contents | 4. What happens to credits | 4. What happens to Rounds |
| refunds.html §3 email link subject | `Cancel%20my%20Pass` | `Cancel%20my%20plan` |

Not changed: the page anchor ids `#plans-credits` (terms.html) and `#credits` (refunds.html). Users do not see them, and other pages may link to them. Keep them.

Not changed: terms.html §15 "without payment or credit to you" (this "credit" means attribution, not Rounds).

---

# Points for the lawyer

| # | Point | Where |
|---|---|---|
| L1 | Is "Round" safe as the defined unit? Do we say anything about the smaller internal units, or say nothing? | Terms §2 |
| L2 | We absorb the extra AI for a very long debate round, so the core never uses more than 1 Round. Is the 6.4 promise clear, and does it limit us too much? | Terms §6.4 |
| L3 | 12-month expiry for Single Rounds and Round Packs, and the "not a stored-value instrument" text, under state gift-card, prepaid-service and unclaimed-property laws. | Terms §6.6, §6.7 |
| L4 | Weekend Pass: a 4-day window that starts when the first Round is committed, not at purchase. What must we say about a pass that is never started? | Terms §6.1, §6.6 |
| L5 | Return rule: the words "return" and "committed", and "a returned Round is not a refund". Does the return rule conflict with the no-refund rule? | Terms §6.3, §8; Refunds §1, §4 |
| L6 | Is a yes in the app enough consent to use a second Round in one debate round? | Terms §6.2 |
| L7 | Rules for selling All-Access before Speech Events opens, if the owner wants to sell it early. | Terms §6.1 |
| L8 | State and federal automatic-renewal rules for the $15 Monthly, $79 Season and $149 All-Access plans: the checkout disclosure, the consent box, online cancel, and any state that needs a reminder for monthly renewals. | Terms §8 |
| L9 | The 7-to-30-day yearly reminder now covers two products and adds the price. Does it fit each state law that sets a window? | Terms §8; Refunds §5 |
| L10 | All-Access covers Speech Events. What must we say if Speech Events closes or is late during a paid All-Access term? | Terms §17 |
| L11 | Is 30 days' notice needed for this change, when no one has bought yet? Is a notice to trial users needed? | Terms §24; headers |
| L12 | "Refunds or credits": is this phrase still clear now that users never see "credits" as a unit? | Refunds §1 |
| L13 | Seller name, trade name and statement descriptor. The legal seller is Pattern Engine LLC. Receipts show the trade name (DBA, "doing business as") Tabula Speech. Statements show "TABULA SPEECH" or a short name that starts with "TABULA". Is that enough? Must the trade name be registered anywhere before we use it? | Terms §8 |
| L14 | Saved payment methods, Link, Apple Pay and Google Pay. Is the text about storage and use enough? Do the wallet providers' terms need a mention? | Terms §8 |
| L15 | School-paid judge Rounds. The judge is often not the school's employee or student. Who is the buyer, and whose terms apply to the judge's use? | Terms §9; Refunds §7 |

Also ask the lawyer to read the whole After text once, end to end.

# Open questions for the owner

| # | Question | Recommendation |
|---|---|---|
| Q1 | Do Single Rounds expire 12 months after purchase? | **Yes, 12 months.** It matches Round Packs, so users learn one rule. It also stops a balance that never expires. |
| Q2 | Where do users see round counts (3, 7, 16, 8, 13, 70, 135)? On the Plans page, or only at checkout? | **On the Plans page and at checkout.** The Terms then point there, and the counts can change without a new Terms version. |
| Q3 | A very long debate round needs more than 1 Round of AI for the core. Take the extra from the balance, or absorb it? | Recommended: take from the balance. |
| Q4 | When does the Weekend Pass clock start? And when do the Rounds of a pass that is never started expire? | **The clock starts when the first Round from the pass is committed.** A returned Round then does not start the clock. A pass never started expires **12 months after purchase**, the same as packs. |
| Q5 | Do Season and All-Access renew automatically each year? | **Yes.** The draft assumes this. If not, remove them from "Subscription" and the reminder text. |
| Q6 | All-Access Rounds: all 135 at the start of the term, or a part each quarter? | **All at the start**, the same as Season. A quarterly grant is not built. |
| Q7 | Do we sell All-Access before Speech Events opens? | **No.** Sell it only when Speech Events is open. |
| Q8 | Can a user return a free trial Round? | **Yes.** The same rule everywhere is simpler. |
| Q9 | Are Program Rounds kept apart from a person's own Rounds? | **Yes.** Program Rounds are for Program work only, and personal Rounds are never used for Program work. |
| Q10 | The Monthly rollover cap: what is the number, and where is it shown? `LEGAL-FACTS.md` says it is not public yet. | **Set the number and show it at checkout** before checkout goes live. The Terms already say it is shown there. |
| Q11 | School-paid judge Rounds: confirm the rules in Terms §9 (from the Program pool, expire July 31, not refundable, stay with the Program). | **Confirm as written.** |
| Q13 | Saved payment methods: confirm each bracketed sentence in Terms §8 against the real build. Is there any automatic charge, for example an auto-reload of a pack? | **Confirm each sentence, or remove it.** If an auto-reload is built, it needs its own consent text and lawyer check. |
| Q14 | Is a Round added for extra features committed at once, or can it be returned? | **Committed at once.** The debate round has already started. |
| Q15 | Do checkout and the receipt show "Pattern Engine LLC"? Check the Stripe business name. | **Confirm in Stripe.** If they do not, remove the sentence. Do not change Stripe for this draft. |
| Q16 | School student rounds use a smaller unit than a judge Round. Do the Terms call them Rounds too, or name a separate unit? | **Name them in the Program order, not in the Terms.** The Terms then say only "Program Rounds". |

# Owner answers (2026-11-20)

The owner answered the questions above in this session. Tags `[OWNER Qn]` stay in the text so the lawyer can see which lines the answers changed.

| # | Answer |
|---|---|
| Q1 | 12 months |
| Q2 | Plans page and checkout |
| Q3 | **Absorb it.** The core of one debate round never costs more than 1 Round. (Differs from the price list, which takes the extra from the balance. The code and `MODEL.md` §D3.6 must change to match.) |
| Q4 | Clock starts at the first committed Round; an unstarted pass expires 12 months after purchase |
| Q5 | Yes, both auto-renew yearly |
| Q6 | All 135 at the start of the term |
| Q7 | No. Sell only after Speech Events opens |
| Q8 | Yes, trial Rounds can be returned |
| Q9 | Yes, kept apart |
| Q10 | Set the number and show it at checkout and on the Plans page before launch |
| Q11 | Confirmed as written |
| Q13 | No automatic charge. Keep the three sentences; they must match the build |
| Q14 | Committed at once; cannot be returned |
| Q15 | Stripe legal name: Pattern Engine LLC. Trade name (DBA) on receipts: Tabula Speech. Statement descriptor: "TABULA SPEECH" (long), "TABULA" (short). The live pages say "TABULA DEBATE", which is wrong and is fixed in Terms §8 and Refunds §5 |
| Q16 | Name the student unit in each Program order; the Terms say only "Program Rounds" |

# Before publishing

This draft must not go live until all of these are true:

1. The owner has answered every open question above.
2. A lawyer has read this version, after the owner's answers, and approved the final text.
3. Every square bracket and tag is removed from the text.
4. The changes in "Changes needed outside these two pages" are done.

Checkout is not live yet. [LAWYER L11] covers whether the live pages may stay as they are until then.
