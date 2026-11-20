# Legal update: final text to publish

Final text, 2026-11-20. Built from `LEGAL-UPDATE-DRAFT.md` draft 4, with all review tags removed.
The owner answered all open questions. The owner reports that a lawyer approved draft 4. The owner said "Yes, publish draft 4" on 2026-11-20.

How to apply:

- Each block below replaces the matching text in `~/Code/tabula-sites/sites/speech/pages/terms.html` or `refunds.html`.
- "[...]" means the live text in that place does not change.
- Keep the `{{support}}`, `{{trial_days}}` and `{{trial_rounds}}` slots.
- Keep the HTML structure, the "In short" boxes and the anchor ids.
- Sections that are not listed here do not change.
- After the build, search both pages for `Credit`, `credit` and `Pass`. Only terms.html §15 "payment or credit to you" may stay.

## Part 1: Terms of Service

### Terms §2. Definitions

Replace these four definitions. Delete the "Credits" definition. Add "Round" after "Hosted AI" and "Subscription" after "Paid Plan". The other definitions do not change.

> "Hosted AI" means AI features that we provide through our servers and pay for with Rounds.
>
> "Round" means the unit of Hosted AI that you use when you start a debate round with Hosted AI on. One debate round normally uses one Round. Section 6 explains when a debate round can use more. The app shows how many Rounds you have left. Inside our systems we measure Hosted AI use in smaller units. You do not buy those units, and the app does not show them.
>
> "Paid Plan" means a Single Round, a Round Pack, a Weekend Pass, a Subscription or a Program, as described in Section 6.
>
> "Subscription" means a Paid Plan that renews automatically: the Monthly plan, the Season plan and the All-Access plan.
>
> "Program" means a paid plan for a school or team, with a shared pool of Rounds and one or more administrators ("Program Admins").

### Terms §6. Paid plans and credits

> **6. Paid plans and Rounds**
>
> In short: Paid Plans give you Rounds for Hosted AI. One debate round normally uses one Round. You can return a Round until the first speech is recorded. Rounds expire on the schedule below. If you run low during a debate round, the debate round keeps working.
>
> **6.1 Plans we offer.** The Paid Plans below are the types of plan we offer. Not every plan is on sale at all times. The Plans page shows which plans are available now and their current prices. The Plans page and checkout show how many Rounds each plan includes. Checkout shows the final price and the number of Rounds before you pay.
>
> - **Single Round.** A one-time purchase of 1 Round.
> - **Round Pack.** A one-time purchase of a set number of Rounds.
> - **Weekend Pass.** A one-time purchase of a set number of Rounds to use in 4 days. The 4 days start when the first Round from the pass is committed (see 6.3). A Weekend Pass does not renew.
> - **Monthly plan.** A Subscription billed each month. It gives a set number of Rounds each month.
> - **Season plan.** A Subscription billed each year. It gives a set number of Rounds for the 12-month term.
> - **All-Access plan.** A Subscription billed each year. It gives a set number of Rounds for the 12-month term. You can use these Rounds in Tabula Debate and in Tabula Speech Events. We sell All-Access only after Tabula Speech Events is open to the public.
> - **Program.** A plan for schools and teams with a shared pool of Rounds, paid by invoice or purchase order (see Section 9).
>
> **6.2 How a Round is used.** A Round is held from your balance when you start a debate round with Hosted AI on. It counts as used when it is committed (see 6.3). Until then you can return it, and it does not count toward any limit, such as the trial limit. Each Round has a Hosted AI budget. The app uses this budget first for the core of the debate round: transcription, the live flow, the ballot draft and the decision draft. Extra features use only the rest of the budget. When extra features use up their part, the app asks if you want to use another Round to keep them on. We use another Round only if you say yes.
>
> **6.3 Returning a Round.** You can return a Round until the first speech of that debate round is recorded. To return it, leave or close the debate round before the first speech, and confirm when the app asks. The Round goes back to the balance it came from, with the same expiry date. If that balance has already expired, the Round does not come back. When the first speech is recorded, the Round is committed. "Committed" means the Round is used and cannot be returned. A Round that you add for extra features (see 6.2) is committed when you add it. A returned Round is not a refund. No money is paid back. This rule also applies to free trial Rounds.
>
> **6.4 Long debate rounds.** The core of a debate round always finishes. If a very long debate round needs more Hosted AI for the core than one Round holds, we cover the extra. The core of one debate round never uses more than one Round. A debate round is never cut off. Only extra features can use another Round, and only if you say yes (see 6.2).
>
> **6.5 Which Rounds we use first.** We use your Rounds in this order: first Weekend Pass Rounds, then Subscription Rounds, then Single Round and Round Pack Rounds. Inside each group, we use the Rounds that expire soonest first. Program Rounds are not part of this order. Section 9 explains how they are kept apart.
>
> **6.6 Round expiry.** Rounds expire as follows. Unused Rounds are forfeited when they expire.
>
> - Single Round and Round Pack Rounds expire 12 months after the date of purchase.
> - Weekend Pass Rounds expire 4 days after the first Round from the pass is committed. If you never commit a Round from the pass, its Rounds expire 12 months after the date of purchase.
> - Monthly plan Rounds roll over from month to month while your plan stays active. Your rolled-over balance is capped at the amount shown on the Plans page and at checkout. Rounds above the cap are not added. When your plan ends, unused Monthly plan Rounds expire at the end of your last paid month.
> - Season plan and All-Access plan Rounds expire at the end of the 12-month term in which they were granted. All 135 All-Access Rounds are granted at the start of the term.
> - Free trial Rounds expire as Section 7 says.
> - Program Rounds expire on July 31 following the start of the Program term.
>
> **6.7 What Rounds are.** Rounds are a limited, revocable license to use Hosted AI. They are not money, a deposit, a stored-value instrument (an account or card that holds money to spend later) or property. They have no cash value. They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise.
>
> **6.8 Failed requests.** If a Hosted AI request fails because of a problem on our side, we do not charge Rounds for it.
>
> **6.9 Low balance.** A debate round never breaks when your Rounds run low or run out. The clock, flow and ballot keep working. Hosted AI steps down to the free tools in the app.

### Terms §7. Free trial

> In short: New Accounts get a {{trial_days}}-day free trial with {{trial_rounds}} Rounds of Hosted AI. No card is needed. One trial per person.
>
> Each new Account gets one free trial. The trial lasts {{trial_days}} days and includes {{trial_rounds}} Rounds of Hosted AI. The trial ends when the {{trial_days}} days pass or when you have used the {{trial_rounds}} Rounds, whichever comes first.
>
> [...] we may void the trial and remove any unused trial Rounds.

### Terms §8. Billing, renewal and refunds

> In short: Pattern Engine LLC sells Paid Plans, and Stripe processes payments. Subscriptions renew until you cancel. Single Rounds, Round Packs and Weekend Passes never renew. You can cancel at any time. We do not give refunds, except where the law requires one.
>
> **Seller.** The seller of every Paid Plan is Pattern Engine LLC, doing business as Tabula Speech. Checkout and your receipt show the name Tabula Speech.
>
> **Payment.** Our payment processor, Stripe, handles all payments. You can pay by card, or with a payment method that Stripe offers at checkout, such as Link, Apple Pay or Google Pay. You authorize us and Stripe to charge your payment method for each purchase and each renewal. Prices are shown on the Plans page and at checkout. Sales tax and similar taxes are calculated and added at checkout. Charges appear on your statement as "TABULA SPEECH", or as a short name that starts with "TABULA".
>
> **Saved payment methods.** If you save a payment method, Stripe or the wallet provider (for example, Apple or Google) stores it. We do not store your full card number. We charge a saved payment method only for a purchase that you start and confirm, and for the renewals of a Subscription that you agreed to. You can remove a saved payment method at any time in your Account settings.
>
> **Automatic renewal.** A Subscription renews automatically at the end of each billing period, and we charge the price then in effect for your plan, until you cancel. The Monthly plan renews each month. The Season and All-Access plans renew each year. At least 7 days and no more than 30 days before each yearly renewal, we send a reminder to your Account email. Single Rounds, Round Packs and Weekend Passes are one-time purchases. They never renew.
>
> **Cancelling.** You can cancel a Subscription at any time in your Account settings, or by email to {{support}}. Cancellation stops future renewals. You keep access, and you can use your Rounds, until the end of the period you have already paid for.
>
> **Price changes.** We may change our prices. A price change for a Subscription applies from your next renewal after we give you notice. If you do not agree to the new price, you can cancel before that renewal.
>
> **No refunds.** All purchases are final and non-refundable. This includes Single Rounds, Round Packs, Weekend Passes, Subscriptions, renewals, unused Rounds and partial billing periods. A Round returned under Section 6.3 goes back to your balance. It is not a refund. The only exception is where the law requires a refund. Our Refund Policy gives the full details.
>
> **Disputes and chargebacks.** If you think a charge is wrong, please contact us first. We will look into it. If you open a payment dispute or chargeback, we may suspend Hosted AI on your Account and remove unspent Rounds while the dispute is open or after it ends. The free app keeps working.

### Terms §9. School Programs

> The Program Customer chooses its Program Admins. Program Admins may add and remove members, assign Rounds from the shared pool and set policy, including turning AI off for students. Students for whom AI is off see no AI features.
>
> **School-paid judge Rounds.** A Program can pay for Rounds that a judge uses, for example at a tournament. These Rounds come from the Program pool. They follow the Program terms, not the terms for your own Paid Plans. They expire on July 31 following the start of the Program term. They are not refundable, unless a written agreement signed by Pattern Engine LLC and the school says otherwise. The return rule in Section 6.3 applies to them. They stay in the Program pool. They never move into a judge's own Round balance, and a judge cannot keep them after the Program removes the judge. A judge's own Rounds are never used for Program work.

### Terms §13. Acceptable use

> In short: Use Tabula fairly and lawfully. Do not abuse it, scrape it, resell Rounds or get around limits.
>
> - resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions, trials or Accounts;
> - get around usage limits, trial limits, Round metering, access controls or Program policies;

### Terms §17. Availability and changes

> If we stop offering Hosted AI entirely, we will give you reasonable notice and, where the law requires, a remedy for unused Rounds.

### Terms §18. Suspension and termination

> When your Account ends, your right to use hosted features ends and unused Rounds are forfeited, except where the law requires otherwise.

### Terms §24. Changes to these Terms

> If you do not agree, you must stop using the Service and may cancel any Subscription.

### Terms header

"Effective November 20, 2026. Last updated November 20, 2026." (Use the real publish date if it is not November 20, 2026.)


## Part 2: Refund Policy

### Refunds §1. No refunds

> All purchases are final. We do not give refunds for:
> - Single Rounds and Round Packs;
> - Weekend Passes, including Rounds that you did not use in the 4 days;
> - Monthly, Season and All-Access plans, including automatic renewals;
> - unused or expired Rounds; or
> - partial billing periods, including when you cancel part of the way through a period.
>
> You can return a Round until the first speech of that debate round is recorded (Terms Section 6.3). A returned Round goes back to your balance. It is not a refund. No money is paid back.

### Refunds §2. Free trial

> In short: Test Hosted AI free for {{trial_days}} days, with {{trial_rounds}} Rounds included. No card is needed.
>
> Each new Account gets a {{trial_days}}-day free trial that includes {{trial_rounds}} Rounds of Hosted AI.

### Refunds §3. How to cancel

> The Monthly plan renews each month, and the Season and All-Access plans renew each year, until you cancel. You can cancel at any time in either of these ways: [...]
>
> Cancellation stops all future renewal charges. You keep your plan, and you can use your Rounds, until the end of the period you have already paid for. We do not refund the rest of that period.
>
> Single Rounds, Round Packs and Weekend Passes never renew, so there is nothing to cancel.

### Refunds §4. What happens to credits

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

### Refunds §5. Renewal reminders

> In short: We email you before each yearly renewal.
>
> At least 7 days and no more than 30 days before each Season or All-Access renewal, we send a reminder to your Account email. It gives the renewal date, the price and how to cancel. Your receipt for each charge comes by email. Charges appear on your card statement as "TABULA SPEECH", or as a short name that starts with "TABULA".

### Refunds §7. School Programs

> Programs paid by invoice or purchase order are not refundable, unless a written agreement signed by Pattern Engine LLC and the school says otherwise. This includes Rounds that a Program pays for judges. Program Rounds expire on July 31.

### Refunds §8. Disputes and chargebacks

> In short: Contact us first. If you file a chargeback, we may pause Hosted AI and remove unspent Rounds. The free app keeps working.
>
> [...] we may suspend Hosted AI on your Account and remove unspent Rounds. The free app keeps working on your device.

### Refunds header

"Effective November 20, 2026. Last updated November 20, 2026." (Use the real publish date if it is not November 20, 2026.)

## Part 3: Small word changes

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

