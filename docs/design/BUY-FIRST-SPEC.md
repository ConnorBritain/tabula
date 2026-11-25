# Buy first, set up later (spec, draft 2)

Status: DRAFT. The owner agreed to the flow on 2026-11-22. Settle the design, then build. Nothing ships before the legal review and the owner says yes.

Draft 2 changes the core design. Draft 1 kept the Rounds on a "waiting" purchase with no owner. The server cannot do that: renewals, refunds, disputes and the billing portal all need an account (in the server, `payments.owner_id` and `subscriptions.user_id` are NOT NULL). Draft 2 gives every purchase an owner from the first second: **the buyer's own account**, made from the checkout email. Setup is then either "the buyer uses it" or "the buyer sends it to someone".

## 1. Goal

Anyone can buy a Paid Plan right away, with no sign-in. The Rounds are active at once. The person who will use them sets up later, or the buyer sends the setup to them.

Why: admins, coaches, parents and judges often want to pay first. Today the server needs a signed-in account with a date of birth before it opens checkout (in the server).

## 2. Rules (owner decisions, 2026-11-22)

1. **No sign-in to buy.** Stripe's checkout page collects the buyer's email.
2. **The buyer confirms that they are an adult.** A line under the Buy button says so. There is no checkbox.
3. **The Rounds are granted at once**, to the buyer's account.
4. **Purchase and account setup are separate.** Checkout asks only for what Stripe needs. It does not ask who will use the Rounds.
5. **An adult can buy for a teen.** A user aged 13 to 17 can receive and use the Rounds. We do not refund because the user is 13 to 17.
6. **Under 13: block, but slowly and safely.** Two confirmations, then a 7-day hold with a way to fix a mistake (section 7).
7. **Receipts, renewal notices and billing stay with the buyer.** The person who pays always knows about the charge and controls the card.
8. **Charges made without permission are refunded** when the cardholder asks.
9. **Managed Payments stays on.** Link is the merchant of record (the company that legally takes the payment).

## 3. Words

- **Buyer:** the person who pays. Their checkout email becomes their account.
- **Buyer account:** the account made (or found) for the buyer's checkout email. It owns the purchase, the Stripe customer and any subscription.
- **User:** the person who uses the Rounds. It can be the buyer, or someone the buyer sends the setup to.
- **Setup link:** a one-time secret link that lets one person receive one purchase's Rounds.
- **Send:** the step that moves a purchase's Rounds from the buyer account to the user's account.

## 4. The flow

### 4.1 Buy

1. The visitor clicks Buy. No sign-in.
2. Our server makes a Stripe Checkout Session with no user. Stripe asks for the email. The server also sets `customer_creation: "always"` for one-time purchases, so that every charge has a Stripe customer (today this is set only on the `customer_email` branch in the server).
3. Abuse controls on this open endpoint: Stripe Radar, a Turnstile check on the Buy click, and a per-IP cap that allows a school network (for example, 30 sessions per IP per hour).
4. If the visitor is already signed in, the server works as today, except that it no longer needs a date of birth first. The purchase belongs to their account.

### 4.2 After payment (server)

1. The webhook arrives. The server calls `findOrCreateUser(email)` (already exists in the server) with the normalized buyer email (`normalizeEmail`). That is the buyer account.
   - The buyer account is **unverified** until someone signs in with that email. An unverified account shows nothing to anyone.
   - If `findOrCreateUser` refuses (for example, a deleted account), the webhook flags the event for review (`ctx.review`) and returns success, so Stripe does not retry for ever.
2. The grant runs as today, to the buyer account.
3. **Link the Stripe objects to the buyer account at once**, so later events find it:
   - A `stripe_customers` table maps each Stripe customer to an account. One account can have more than one customer (a repeat guest buyer gets a new Stripe customer each time). Today `saveCustomer` allows only one customer per account.
   - For a subscription, the webhook writes the buyer account ID into the subscription's metadata (a Stripe update call), as signed-in checkouts do today.
   - If `invoice.paid` or a subscription event arrives before `checkout.session.completed` and the account is not known yet, the webhook returns an error for our prices, so Stripe retries later. Today it flags the event and stops, and the buyer would get nothing.
4. The server writes a `purchase_setups` row: the purchase key, the buyer account, a hash of a new setup link secret, status `open`.
5. The server writes the two emails (section 6) to a `mail_outbox` table, with an idempotency key, in the same database step. A sender drains the outbox right after the webhook (`waitUntil`) and again in the daily `scheduled` job, with retries. So a mail failure cannot make Stripe retry the webhook, and no email goes twice.
6. Caps against card testing and stolen cards: at most 5 purchase emails per buyer email per day. Radar blocks most card tests before payment.

### 4.3 The "purchase active" screen

Stripe returns the buyer to our page with the checkout session ID. The webhook may not have arrived yet, so the page shows "Finishing your purchase…" and checks every 2 seconds, for up to 30 seconds.

When the purchase is ready, the page shows:

- **Title:** "Your purchase is active."
- **Button 1 (main):** "Set up your account now."
- **Button 2:** "Send setup to someone else."
- **Small text:** "We also sent the setup link to [buyer email]. If you close this page, you can use that email to set up later."

**How the page knows the buyer.** We never sign anyone in from the checkout session alone. Anyone can type any email at Stripe, so a paid session does not prove that the person owns that email. (A first idea, a one-time sign-in from the session, was dropped for this reason: an attacker could pay and then enter a stranger's existing account.)

- **Button 1:** we send a normal 6-digit sign-in code to the buyer email, and the page shows the code box. The buyer types the code. Now they are signed in, and they own the email. The date-of-birth step comes next (section 5). Then the app.
- **Button 2:** this button acts only on this one purchase and never signs anyone in. It needs proof that this browser started this checkout: a random value in a cookie, set when the visitor clicked Buy, and stored with the checkout session. The buyer types the user's email. We send that person a setup link (section 4.5). No free-text note, so our mail cannot carry spam. Caps: 3 sends per purchase, and 3 per recipient address per day.

The owner asked for a third button, "Account setup". It does the same as button 1, so this spec merges them. Design can split them again if it tests better.

Design task: look at post-purchase and gift screens in Mobbin (app-store gift cards, family plans, course purchases), then design this screen for web and mobile.

### 4.4 The buyer uses the Rounds themselves

The buyer signs in (from the screen, the setup email, or later with their email). The date-of-birth step comes next. Then the Rounds are ready on their own account. No transfer.

### 4.5 The buyer sends the Rounds to someone

1. The user opens the setup link. The secret is in the part of the link after `#`, so it does not reach server logs or other sites. The page shows a "Set up" button. Nothing happens on page load, because mail scanners open links. This is the same pattern as today's sign-in link.
2. The user signs in or signs up. Our sign-in has no password, so sign-in and sign-up are one step (Terms §4). Any email works.
3. The date-of-birth step (section 5).
4. If the age result allows it, the server sends the purchase:
   - It reserves the setup (`UPDATE purchase_setups SET status='claiming', claimed_by=? WHERE status='open'`).
   - It takes the purchase's unused Rounds back from the buyer account and grants them to the user, with one idempotent ledger reference (`setup:<purchase key>`). A crash between the steps can be retried safely.
   - The Rounds get new expiry dates, counted from the setup day, not the purchase date (owner decision 2026-11-22, legal update 5 Part B, Terms §6.6). A Weekend Pass or Camp Pass keeps its own rule: its days start when its first Round is committed.
   - Status becomes `sent`.
5. The buyer gets a "Your purchase was set up by [masked email]" email.

**Every move is recorded per payment** in a `payment_moves` table: payment key, from account, to account, Rounds moved, ledger reference. Refunds and disputes read it (section 11).

Subscriptions:
- Each renewal grants to the buyer account first, then moves at once to the user, by the same rule, with its own `payment_moves` row.
- Auto-move stops when the user's account is deleted, held under 13, or the setup is returned. Renewal Rounds then stay with the buyer.
- The subscription, the card and the Stripe customer stay with the buyer. The user never sees the buyer's billing. The server never copies the buyer's Stripe customer to the user's account.
- The user's account gets the "paid" plan flag while it receives Rounds from an active subscription.

## 5. The date-of-birth step

- It comes at the first sign-in of any account, before the Rounds can be used.
- **The server enforces it.** The Hosted AI and meter routes refuse an account with no date of birth (`age_required`). Today only the page redirect (`landing()`) sends users to the age step, and `requireUser` does not check age.
- It is neutral: no price and no "18+" words on the screen.
- A buyer who only uses button 2 ("Send setup to someone else") never gives a date of birth. The buyer confirmed at checkout that they are an adult, and the person who receives the Rounds gives a date of birth. This needs legal review.
- Results:
  - **18 or older (or the adult age in that state):** continue.
  - **13 to 17:** continue. An adult paid (rule 5).
  - **Under 13:** section 7.

## 6. Emails

The "send" step writes `*_sent_at` times, so no email goes twice.

| Email | To | When | Contents |
|---|---|---|---|
| Receipt | buyer | at once | product, price, date, order number, "Sold through Link", help, Refund Policy link |
| Setup | buyer | at once | the setup link; "Use it yourself or forward this email to the person who will use Tabula"; the link works once |
| Setup for you | the user | when the buyer uses "send" | the setup link; who sent it (the buyer's masked email) |
| Reminder | buyer | 3 and 14 days later, if no one has used the Rounds | no secret; "Sign in with this email to set up or send your purchase" |
| Set up | buyer | when someone uses the setup link | "Your purchase was set up by [masked email]"; "Not you? Contact support" |
| Renewal reminder | buyer | as Terms §8 says | as today |

Reminders carry no secret. So a forwarded setup link keeps working until someone uses it.

## 7. Under 13: the safe path

The goal: obey the law, and do not punish a typing mistake.

### 7.1 Two confirmations

When the date of birth means the person is under 13:

1. **Confirmation 1:** a screen says: "You entered [Month Day, Year]. That makes you [N] years old. Is this right?" Buttons: "Yes, this is right" and "No, let me fix it".
2. "No, let me fix it" goes back to the date field. It works once. The server enforces "once", not only the screen: the first under-13 date is stored as a pending date (`users.age_pending_date`) with a fix counter (`users.age_fix_used`). Neither is the saved date of birth yet.
3. **Confirmation 2:** after "Yes", the person types their birth year again. If it matches, the under-13 path starts. If it does not match, the date field opens again (this counts as the one fix).

The FTC advises an age question that a child cannot simply go back and change. One fix before the date is saved is a small exception. It needs legal review.

### 7.2 The 7-day hold

After confirmation 2:

1. The account is on hold. The server refuses every request from it except "sign out" (a check in `requireUser`). A new `age_hold_until` column holds the hold state.
2. We keep only: the account email, the date of birth, and the time. We collect nothing else. This is a change from today, where nothing is kept. The Privacy Policy §12 needs a line for it.
3. The block cookie is set at once, as today, so that this browser cannot try again with another date.
4. Nothing moves. If this account was a user receiving a purchase, the Rounds stay on the buyer account. The setup link goes back to `open`.
5. We email the **buyer** (if the buyer is a different account): "The person who used your setup link gave a date of birth under 13. Tabula is not for children under 13. Your Rounds are still on your account." Choices:
   - "This was a mistake": the buyer asks support to review. If support approves, support corrects the date and lifts the hold. The block cookie does not stop it, because support makes the change.
   - "Send the setup to someone else": a new setup link (the old one stops).
   - "Refund me": a full refund (Refund Policy).
6. The held account itself can ask for a review once, through a "This is a mistake" link on the hold screen. Support reviews every request by hand.
7. After 7 days with no approved fix: the server closes the held account as `closeAccount` does today (it keeps money records, deletes personal data), and clears the date of birth.

### 7.3 When the buyer account itself is under 13

A child bought alone and then gave an under-13 date at their first sign-in. Then:

- Steps 1 to 3 and 6 above apply.
- When the hold starts, any subscription is set to cancel at the end of the period, so it does not renew during the hold. If support approves a fix, support can turn renewal back on.
- After 7 days with no approved fix, a daily job (the existing `scheduled` cron) does this, in order, and retries on failure: cancel any subscription; refund every purchase in full; take back the Rounds; close the account.
- The cancel comes first, because `closeAccount` refuses while a subscription renews.

### 7.4 Who can start a hold

A setup link holder can start a hold on their own new account only. It never touches the buyer account or its Rounds. So a stranger with a forwarded link cannot force a refund on the buyer.

## 8. Recovery: the buyer lost the setup link

1. **Sign in with the buyer email.** The buyer account already exists. After sign-in, the app shows the purchase with "Use it myself" and "Send to someone else". Sign-in proves the email, so this is safe.
2. **"Bought Tabula but cannot find your setup email?"** A link on the sign-in page and in help. It starts a normal sign-in with that email. So the buyer gets a sign-in code, not a setup link, and we reveal nothing about purchases. Normal sign-in limits apply (`MAX_MAILS_PER_HOUR`).
3. **Support.** The buyer gives the order number from the Link receipt. Support sends a sign-in link to the buyer email only.

## 9. The sign-in page

One email box for both sign-in and sign-up stays (no passwords). Add:

- "Bought Tabula but cannot find your setup email?" (section 8, way 2).
- After sign-in: if the account owns a purchase whose setup is still open, show "You have a purchase to set up: use it yourself, or send it to someone."

A typed setup code is not offered. The link is the only path, and the buyer can always recover by signing in. This avoids a short code that could be guessed.

## 10. Security

- The setup link secret has at least 128 bits. The server stores only its hash. It works once.
- It is in the link fragment (after `#`) and is used by POST, never on page load.
- Sending a new link stops the old one. Only the signed-in buyer (or support) can send a new link.
- "Send setup to someone else" needs the signed-in buyer. It has no free text. It has caps per purchase and per recipient.
- No sign-in from a checkout session. Sign-in always needs the email code or link.
- Button 2 needs the browser cookie set at the Buy click, and acts on that one purchase only.
- Guest checkout: Radar, Turnstile and a per-IP cap. At most 5 purchase emails per buyer email per day.
- Support can void a setup link at any time.

## 11. Refunds, disputes and holds

| Case | What happens |
|---|---|
| Refund before the Rounds were sent | The refund takes Rounds back from the buyer account, as today. A subscription refund also cancels the subscription. |
| Refund after the Rounds were sent | The refund takes back the purchase's unused Rounds from the account that `payment_moves` names. Rounds already used are not taken back, and no balance goes below zero (the take-back is capped at what is left, as today). The buyer is emailed. |
| Dispute (chargeback) | The billing hold goes on the buyer account only, never on the user. The user's unused Rounds from that purchase are taken back. (Open question for legal review: drop the dispute hold entirely.) |
| The user's account is deleted | Unused Rounds from the purchase go back to the buyer account. The buyer is emailed. |
| The buyer typed a wrong email at checkout | The receipt and setup link go to a stranger. The buyer contacts support with the order number. Support voids the setup link, moves the purchase to the right email, and sends a new link. |
| No one ever uses the Rounds | Reminders at 3 and 14 days. The Rounds stay on the buyer account and expire on the normal schedule from the purchase date. If the buyer sends them later, the expiry restarts from the setup day. |
| A minor used a parent's card without permission | The parent asks for a refund (rule 8). We refund and take back the Rounds. |
| A Program or school | Not in this spec. Schools pay by invoice (Terms §9). A self-serve team pool is platform work. |

## 12. States of a setup

`open` → `claiming` → `sent`.
Also: `open` → `replaced` (a new link was made), `open` → `cancelled` (refund or dispute before sending), `sent` → `returned` (the user's account was deleted, or the user is held under 13 before the move completes).

## 13. What changes where

**The server**
- A new billing module for setups, sends and holds. New mail templates. Do not grow `webhook.ts` or `setBirthDate`.
- Checkout with no user: remove the sign-in and date-of-birth gate (keep the billing-hold check for signed-in buyers). Add Turnstile and the per-IP cap. Set `customer_creation: "always"`.
- Webhook: find or create the buyer account from the email when there is no user ID.
- One migration adds: `purchase_setups`, `payment_moves`, `stripe_customers`, `mail_outbox`, and on `users`: `age_hold_until`, `age_pending_date`, `age_fix_used`, and a "verified" time (first sign-in).
- Webhook: find or create the buyer account; link the Stripe customer and subscription at once; retry (not flag) an unknown owner for our prices; write mail to the outbox.
- The outbox sender (`waitUntil` and `scheduled`) and the reminder job (3 and 14 days).
- Server-enforced date-of-birth gate on the Hosted AI and meter routes.
- Under 13: the two confirmations (server-enforced), the hold (a check in `requireUser` that allows only sign-out), support review, and the 7-day job in `scheduled`.
- Renewal moves to the user; the refund and dispute rules in section 11.

**Settle before the build starts (these can break the design)**
- Managed Payments allows checkout with no customer, Stripe collecting the email, and `customer_creation: "always"`.
- `lotFor` can give moved Rounds a new expiry that counts from the setup day (owner decision 2026-11-22).

**Check during the build**
- Managed Payments allows refunds by API.
- `applyTakeBack` works on an account that `closeAccount` has closed.

**tabula-sites and the app**
- Plans page: Buy works signed out, with the line under each Buy button.
- The "purchase active" screen, the setup screen, the neutral date-of-birth screen, the two under-13 confirmations, the hold screen.
- Sign-in page link (section 9).

**Design**
- The "purchase active" screen (Mobbin research first), setup screens, under-13 screens, email layouts, on web and mobile.

**Legal**
- Terms §3, §8, §13 (moving Rounds at setup is allowed; today §13 forbids transfers) and the Refund Policy. The Privacy Policy §3 (accounts made from the checkout email) and §12 (the 7-day hold).
- The legal review.

## 14. Open questions for the owner

1. **"Reissue" after 7 days.** You said "hold the account and funds for upwards of 7 days, and then after that we reissue it". This spec reads it as: the child's account is closed, the Rounds stay with the buyer, and the buyer can send a new setup link or ask for a refund. If the child bought alone, we refund after 7 days. Is that what you meant, or did you mean that we restore the account after 7 days?
2. **Reminder timing:** 3 and 14 days. Right?
3. **Support review** of under-13 mistakes by hand at launch. Acceptable?
4. **The third button:** merge with "Set up your account now" (this spec), or keep three?

Owner answers, 2026-11-22: Q1 yes (the reading above is right); Q2 yes (3 and 14 days); Q3 yes (support reviews by hand at launch); Q4 keep merged.

Settled in draft 2: "Set up now" asks for one 6-digit sign-in code. A one-click sign-in from checkout is not safe (section 4.3).
