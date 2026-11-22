# Legal update 4 (draft 3): Camp Pass

Status: LAWYER-APPROVED. Do not publish until the rest of the publish gate is met.

Lawyer result (owner report, 2026-11-22): the owner sent this draft (pushed as 1f05e66) to the lawyer. The lawyer said "lgtm". This approves the text as written, so:

- L1, L2, L4: no change needed.
- L3: the sale dates stay off the Terms. The Plans page shows them. The other §6.1 sentence is not used.
- L5: the live Weekend Pass refund line stays as it is.

Owner answers, 2026-11-22 (relayed by the pricing session): "Yes, all four picks". Q1 to Q4 now use the recommended choices. This is not a yes to publish.

- Request: the marketing session, 2026-11-22. The owner approved a new one-time product, the Camp Pass, in the marketing chat.
- Product, as the owner approved it: a one-time purchase of a set number of Rounds. You use them within 30 days from the first Round. We sell it only from June 1 to August 31 each year. It never renews.
- The price and the number of Rounds are not in this file. The Terms do not name them for the other one-time plans either. The Plans page and checkout show them (Terms §6.1).
- This repo is public. This file names the Camp Pass and its sale months before the product is on sale. Tell the owner if that is a problem.
- Base text: the live pages, tabula-sites `origin/main` at 703e09a. In the source files, the header dates are the `{{legal_date}}` placeholder. Today that placeholder shows "November 21, 2026".
- Not urgent. The first sale window opens on June 1, 2027.

## Publish gate

Publish only when all of these are true:

1. The lawyer approves this text.
2. The owner says yes in the marketing chat.
3. The app and the server sell the Camp Pass and apply the rules below.
4. The Plans page shows the Camp Pass on the same day, or later. The Plans page must never show it before the Terms name it.
   - Marketing enforces this in the build (tabula-sites branch `plans-three-cards`, e2b9bec). The Camp Pass card stays off the Plans page while `terms.html` does not contain "Camp Pass". Tests check both cases.
   - The Plans page checks the sale window with the visitor's local date. The server applies the real window in US Eastern time (Q4). Near midnight on June 1 or August 31, the card can show for a short time when checkout will not sell the pass, or the other way round. This is acceptable because the server decides the sale.

Use the publish date in the Terms and the Refund Policy headers.

## Rules that the text sets

All of these rules are decided by the owner.

- A one-time purchase. It never renews.
- You use the Rounds within 30 days from the first Round.
- We sell it only from June 1 to August 31 each year.
- **Start of the 30 days (Q1):** the 30 days start when the first Round from the pass is committed (Terms §6.3). This is the Weekend Pass rule. A Round that you return does not start the 30 days.
- **A pass that is never started (Q1):** its Rounds expire 12 months after the date of purchase. This is the Weekend Pass rule.
- **More than one pass (Q2):** no limit. The "soonest first" rule in §6.5 handles passes with different expiry dates.
- **Use order (Q3, choice B):** Rounds from a started Camp Pass are in the first group, with Weekend Pass Rounds. Rounds from a Camp Pass that has not started are used last. So the user does not start the 30 days by mistake. This needs a small app change: the app must know if a pass has started.
- **Sale dates (Q4):** US Eastern time, from the start of June 1 to the end of August 31. The sale dates limit when you can buy. They do not limit when you can use the Rounds. A pass bought on August 31 still gets its full 30 days.

## Part 1: Terms of Service

### §2 Definitions, "Paid Plan"

**Before:** "**"Paid Plan"** means a Single Round, a Round Pack, a Weekend Pass, a Subscription or a Program, as described in Section 6."

**After:** "**"Paid Plan"** means a Single Round, a Round Pack, a Weekend Pass, a Camp Pass, a Subscription or a Program, as described in Section 6."

### §6.1 Plans we offer (new list item after Weekend Pass)

**Add:**

"**Camp Pass.** A one-time purchase of a set number of Rounds to use in 30 days. The 30 days start when the first Round from the pass is committed (see 6.3). We sell the Camp Pass only in a summer sale period each year. The Plans page shows the dates. A Camp Pass does not renew."

This text does not put the dates in the Terms. Reason: §6.1 already says that the Plans page shows which plans are on sale. If the dates change, the Terms do not need to change. L3 asks the lawyer to confirm this. If the lawyer wants the dates in the Terms, use this sentence in place of the two sentences about the sale period: "We sell the Camp Pass only from June 1 to August 31 each year, US Eastern time."

### §6.5 Which Rounds we use first

**Before:** "We use your Rounds in this order: first Weekend Pass Rounds, then Subscription Rounds, then Single Round and Round Pack Rounds. Inside each group, we use the Rounds that expire soonest first."

**After (Q3 choice B, owner's pick):** "We use your Rounds in this order: first Weekend Pass Rounds and Rounds from a Camp Pass that has started, then Subscription Rounds, then Single Round and Round Pack Rounds, then Rounds from a Camp Pass that has not started. Inside each group, we use the Rounds that expire soonest first. A Camp Pass starts when its first Round is committed (see 6.1)."

The rest of §6.5 stays the same.

### §6.6 Round expiry (new list item after Weekend Pass)

**Add:**

"Camp Pass Rounds expire 30 days after the first Round from the pass is committed. If you never commit a Round from the pass, its Rounds expire 12 months after the date of purchase."

### §8 Billing, renewal and refunds: "In short" box

**Before:** "Subscriptions renew until you cancel. Single Rounds, Round Packs and Weekend Passes never renew."

**After:** "Subscriptions renew until you cancel. Single Rounds, Round Packs, Weekend Passes and Camp Passes never renew."

### §8 "Automatic renewal" paragraph

**Before:** "Single Rounds, Round Packs and Weekend Passes are one-time purchases. They never renew."

**After:** "Single Rounds, Round Packs, Weekend Passes and Camp Passes are one-time purchases. They never renew."

### §8 "No refunds" paragraph

**Before:** "This includes Single Rounds, Round Packs, Weekend Passes, Subscriptions, renewals, unused Rounds and partial billing periods."

**After:** "This includes Single Rounds, Round Packs, Weekend Passes, Camp Passes, Subscriptions, renewals, unused Rounds and partial billing periods."

### §13 Acceptable use

**Before:** "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts;"

**After:** "resell, share, transfer or trade Rounds, Weekend Passes, Camp Passes, Subscriptions or Accounts;"

### Header

**Before:** "Effective November 21, 2026. Last updated November 21, 2026."

**After:** "Effective [publish date]. Last updated [publish date]."

All other Terms sections stay the same.

## Part 2: Refund Policy

### §1 No refunds (new list item after Weekend Passes)

**Before:**
"- Weekend Passes, including Rounds that you did not use in the 4 days;"

**After:**
"- Weekend Passes, including Rounds that you did not use in the 4 days;
- Camp Passes, including Rounds that expired before you used them;"

The Camp Pass line does not say "in the 30 days". Reason: a pass that is never started has no 30 days. Its Rounds last 12 months. The live Weekend Pass line has the same small problem. This draft does not change it. The lawyer can choose to fix it in the same update (L5).

### §3 How to cancel

**Before:** "Single Rounds, Round Packs and Weekend Passes never renew, so there is nothing to cancel."

**After:** "Single Rounds, Round Packs, Weekend Passes and Camp Passes never renew, so there is nothing to cancel."

### §4 What happens to Rounds: "Expiry"

**Before:** "Weekend Pass Rounds expire 4 days after the first Round from the pass is committed."

**After:** "Weekend Pass Rounds expire 4 days after the first Round from the pass is committed. Camp Pass Rounds expire 30 days after the first Round from the pass is committed."

The rest of the item stays the same.

### §4 What happens to Rounds: "Order"

**Before:** "We use Weekend Pass Rounds first, then Subscription Rounds, then Single Round and Round Pack Rounds."

**After (Q3 choice B, owner's pick):** "We use Weekend Pass Rounds and Rounds from a started Camp Pass first, then Subscription Rounds, then Single Round and Round Pack Rounds. We use Rounds from a Camp Pass that has not started last."

### Header

**Before:** "Effective November 21, 2026. Last updated November 21, 2026."

**After:** "Effective [publish date]. Last updated [publish date]."

All other Refund Policy sections stay the same.

## Part 3: No change

- **Privacy Policy:** no change. A Camp Pass collects no new data.
- **Plans page:** the marketing session owns it. It must not show the Camp Pass before the Terms name it (publish gate, item 4).
- **Other copy:** checked 2026-11-21. Only these files name the Weekend Pass: tabula-sites `plans.html`, `terms.html`, `refunds.html` and `buy.test.mjs`. The app repo (outside `docs/` and `private/`) has none. Check again before publish.

## Owner questions

Answered 2026-11-22: "Yes, all four picks". Each question below uses the recommended choice. The text above uses these answers.

- **Q1. Start and the 12-month rule.** The draft copies two Weekend Pass rules. (a) The 30 days start when the first Round is committed. A returned Round does not start them. (b) A pass that is never started expires 12 months after purchase. The other choice for (b) is a fixed date, for example September 30 of the same year. I recommend both Weekend Pass rules. They are simpler, and users already see them.
- **Q2. Buying more than one.** Can one Account buy two Camp Passes in the same summer? The draft does not limit this. Two passes that start at different times have different expiry dates. The "soonest first" rule in §6.5 already handles that. If you want a limit, §6.1 needs one more sentence.
- **Q3. Use order.**
  - Choice A: Camp Pass Rounds go first, like the Weekend Pass. Side effect: a user with Subscription Rounds and an unstarted Camp Pass starts the 30 days at the next debate round. The user may not want that.
  - Choice B: a Camp Pass goes first only after it has started. An unstarted pass is used last. Then the user starts the 30 days only when no other Rounds are left, or when the app lets the user choose the pass.
  - I recommend choice B. A 30-day clock on many Rounds costs the user more than a 4-day clock. Choice B needs a small app change: the app must know if a pass has started.
- **Q4. Sale dates.** Which time zone do June 1 and August 31 use? Is all of August 31 included? I recommend US Eastern time, with all of August 31 included. A pass bought on August 31 keeps its full 30 days.

## Lawyer points

- **L1. Short expiry.** Camp Pass Rounds expire 30 days after first use. Terms §6.7 says that Rounds are a license, not stored value. Please confirm that a 30-day expiry is allowed, with §6.7 as it is. Some states have rules for gift cards and prepaid value.
- **L2. What checkout must show.** Please confirm what checkout must show about the 30 days and the 12-month rule, and how clearly.
- **L3. Sale dates in the Terms.** The draft keeps the dates on the Plans page only. §6.1 already says that not every plan is on sale at all times. Please confirm. If the dates must be in the Terms, use the other sentence under §6.1.
- **L4. The name "Camp".** Users aged 13 to 17 may use Tabula, but only adults buy (Terms §3). Please confirm that the name "Camp Pass" and its marketing raise no extra rules about marketing to minors.
- **L5. Weekend Pass refund line (optional).** The live Refund Policy says "Weekend Passes, including Rounds that you did not use in the 4 days". A Weekend Pass that is never started has no 4 days. Do you want this line changed to "Weekend Passes, including Rounds that expired before you used them" in the same update?

## Checklist

- [x] Owner answers Q1 to Q4 (2026-11-22: all recommended choices).
- [x] Lawyer answers L1 to L5 and approves the text (2026-11-22: "lgtm").
- [x] Pick the "After" text for §6.5 and Refunds §4 "Order": choice B.
- [ ] The app and server apply the Camp Pass rules (publish gate, item 3), including the choice B use order and the US Eastern sale dates.
- [ ] Check other copy for one-time plan lists again.
- [ ] Owner says yes in the marketing chat.
- [ ] Marketing publishes the Terms, the Refund Policy and the Plans page.
