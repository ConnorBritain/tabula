# Legal update 6, draft 4: paid Rounds never expire, plans roll over with a cap

2026-11-23. Draft for the owner and the lawyer. Not live.

**Lawyer approved (2026-11-23).** The owner sent `private/legal/ROUNDS-NEVER-EXPIRE-LAWYER-EMAIL.md` (cap wording, cancel rule, account deletion, Program Rounds, Camp Pass in Washington, cash-out). Owner, relayed by the pricing session: "He agrees with everything as is."

**Status (2026-11-23):** the owner reports that the owner and the lawyer agree with this text and with the legal session's recommendations (see "Recommendations adopted" at the end). Still needed to publish: the server work, then the owner's yes in the marketing chat.

This draft **replaces** `LEGAL-UPDATE-6-WEEKEND-PASS-12-MONTHS-DRAFT.md` (Weekend Pass 12 months). That text never went live.

## Why

- Research of 2026-11-23 (private: `private/legal/minors-ai-research/group7-gaps-2026-11-23.md`, item 6): expiring Rounds may count as gift certificates in Washington (*Hollis v. Audible*, W.D. Wash. 2025; RCW 19.240) and California (Civ. Code 1749.5). Both states ban expiry dates on gift certificates. A "not a gift card" label does not protect us.
- Owner decisions, pricing chat, 2026-11-23 (`private/pricing/ROUND-EXPIRY-AND-ROLLOVER.md`): "the lawyer agrees with you on all points" (paid Rounds never expire), then "Option A" (plan Rounds that a person holds stay after they cancel, and never expire).

## The rules, in short

- **Single Round, Round Pack and Weekend Pass Rounds never expire.** The Weekend Pass loses its 4-day window.
- **Monthly plan:** each month's new Rounds stop at the cap shown on the Plans page (39 today). The cap limits what we add. It never removes Rounds you hold.
- **Season and All-Access:** unused Rounds carry into the next year. Each year's new Rounds stop at one year's amount (60 for Season, 165 for All-Access). The cap never removes Rounds you hold.
- **After you cancel a plan,** you keep the Rounds you hold. They never expire.
- **Programs** (schools, by invoice): Program Rounds still expire on July 31. A school buys them under a business contract, not as a consumer (lawyer question L3).
- **No expiry reminder emails.** Nothing that a person buys expires, so update 6's reminder sentences (old T4, R4, P1) are dropped.
- **Rounds still have no cash value.** The Refund Policy gets the same "except where the law requires otherwise" carve-out that Terms §6.7 already has (R5).

## Publish gate

1. The lawyer approves this text, including the questions at the end.
2. The server applies every rule above, including a spend order that uses the oldest lot first inside each group (a `created_at` tie-break in `lots.ts` `spendOrder`; today it falls back to the lot id, which is not in date order): no expiry on one-time and plan lots; the Monthly cap; the Season and All-Access roll-over with the cap; plan Rounds kept after cancel; Weekend Pass with no window. Cloud-setup deploys it to prod first, after the owner's yes in the cloud-setup chat.
3. The owner types yes in the marketing chat.
4. The Terms, the Refund Policy and the Plans page go live on the same day. Use the publish date in the headers. (The shared date also moves the Privacy Policy date. That is harmless. The Privacy text does not change.)
5. On the publish day, confirm that no customer holds Rounds that expired under the old rules. The owner says no one holds Rounds yet.

## Terms of Service (`sites/speech/pages/terms.html`)

**T0. §6 "In short", fourth sentence (replace)**
- Before: "Rounds expire on the schedule below."
- After: "Rounds that you buy do not expire, except Program Rounds (see 6.6)."

**T0b. §6.3, fourth and fifth sentences (replace)**
- Before: "The Round goes back to the balance it came from, with the same expiry date. If that balance has already expired, the Round does not come back."
- After: "The Round goes back to the balance it came from. If it came from a Program pool whose term has ended, the Round does not come back."

**T1. §6.1, Weekend Pass item (replace)**
- Before: "**Weekend Pass.** A one-time purchase of a set number of Rounds to use in 4 days. The 4 days start when the first Round from the pass is committed (see 6.3). A Weekend Pass does not renew."
- After: "**Weekend Pass.** A one-time purchase of a set number of Rounds, sized for one tournament weekend. A Weekend Pass does not renew."

**T2. §6.1, Season plan item (replace)**
- Before: "**Season plan.** A Subscription billed each year. It gives a set number of Rounds for the 12-month term."
- After: "**Season plan.** A Subscription billed each year. It gives a set number of Rounds at the start of each yearly term."

**T3. §6.1, All-Access plan item, first two sentences (replace)**
- Before: "A Subscription billed each year. It gives a set number of Rounds for the 12-month term."
- After: "A Subscription billed each year. It gives a set number of Rounds at the start of each yearly term."

**T4. §6.5, first sentence (replace)**
- Before: "We use your Rounds in this order: first Weekend Pass Rounds, then Subscription Rounds, then Single Round and Round Pack Rounds."
- After: "We use your Rounds in this order: first Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds."
- Second sentence. Before: "Inside each group, we use the Rounds that expire soonest first." After: "Inside each group, we use the Rounds that you got first."
- The server must use the same order (check before publish).

**T5. §6.6 (replace the heading, the first paragraph and every list item)**
- Before (heading and first paragraph): "6.6 Round expiry. Rounds expire as follows. Unused Rounds are forfeited when they expire."
- Before (list): the Single Round and Round Pack item, the Weekend Pass item, the Monthly plan item, the Season and All-Access item, and the Program item.
- After:

  "**6.6 How long Rounds last.** Except for Program Rounds, Rounds that you buy do not expire. They stay in your balance until you use them, except as Sections 8 and 18 say.
  - Single Round, Round Pack and Weekend Pass Rounds do not expire.
  - Monthly plan: each month we add the plan's Rounds, but only enough to bring your Monthly plan Rounds up to the cap shown on the Plans page and at checkout. The cap limits only what we add. It never removes Rounds that you already have.
  - Season plan and All-Access plan: at the start of each yearly term we add the plan's Rounds, but only enough to bring your Rounds from that plan up to one year's amount for that plan. Rounds that you did not use in earlier terms stay in your balance. The cap limits only what we add. It never removes Rounds that you already have.
  - If you cancel a Subscription, the Rounds that you have stay in your balance. They do not expire.
  - Program Rounds expire on July 31 following the start of the Program term."

**§6.7 (no change).** The live text already says "They cannot be redeemed for cash, transferred, sold or exchanged, except where the law requires otherwise." That covers the state cash-out rules. Update 6 draft 2's "a gift card, a gift certificate" addition is dropped: the research says the label does not control in Washington.

Nothing else in the Terms changes. §8 (refunds and disputes take back Rounds) and §18 (unused Rounds are forfeited when your Account ends, "except where the law requires otherwise") stays; see L2.

## Refund Policy (`sites/speech/pages/refunds.html`)

**R1. §1, list (replace three items)**
- Before: "Single Rounds and Round Packs;" and "Weekend Passes, including Rounds that you did not use in the 4 days;" and "unused or expired Rounds; or"
- After: "Single Rounds, Round Packs and Weekend Passes;" and "unused Rounds; or"

**R2. §4 "In short" (replace)**
- Before: "You can return a Round until the first speech is recorded. Rounds expire on a fixed schedule. Rounds have no cash value."
- After: "You can return a Round until the first speech is recorded. Except for Program Rounds, Rounds that you buy do not expire. Rounds have no cash value."

**R3. §4 "Expiry" (replace the whole item; new label "How long Rounds last")**
- Before: "Expiry. Single Round and Round Pack Rounds expire 12 months after purchase. Weekend Pass Rounds expire 4 days after the first Round from the pass is committed. Monthly plan Rounds roll over while your plan stays active, up to a cap. Season and All-Access Rounds expire at the end of the 12-month term. Program Rounds expire on July 31. Terms Section 6.6 gives the full schedule."
- After: "**How long Rounds last.** Single Round, Round Pack and Weekend Pass Rounds do not expire. Plan Rounds carry over. Each month or year, we add new plan Rounds only up to a cap, and the cap never removes Rounds that you have. If you cancel a plan, you keep the Rounds that you have. Program Rounds expire on July 31. Terms Section 6.6 gives the full rule."

**R4. §4 "Order" (replace the first sentence)**
- Before: "We use Weekend Pass Rounds first, then Subscription Rounds, then Single Round and Round Pack Rounds."
- After: "We use Subscription Rounds first, then Single Round, Round Pack and Weekend Pass Rounds."

**R5. §4, "Rounds have no cash value" item (replace the first two sentences)**
- Before: "Rounds have no cash value. They cannot be refunded, redeemed for cash or transferred."
- After: "Rounds have no cash value. They cannot be refunded, redeemed for cash or transferred, except where the law requires otherwise."

## Privacy Policy

No change.

## Plans page (marketing)

- Header line. Before: "Pay once. Nothing renews. Packs and single rounds expire 12 months after purchase." After: "Pay once. Nothing renews. Your rounds never expire."
- Weekend Pass card: remove "Use within 4 days from your first round." Suggested line: "Rounds never expire."
- Season card. Before: "60 rounds for the year." and "Use them any month you like." After: "Each year we top you up to 60 rounds." and "Unused rounds carry over." (Marketing review: "carry over, up to 60" can be read as 60 extra.)
- Monthly card. Before: "Unused rounds carry over, up to 39." After: "Unused rounds carry over, up to 39 in all."
- All-Access card: "Each year we top you up to 165 rounds." and "Unused rounds carry over." (when it goes on sale).
- my. app Plan page (`sites/my/pages/plan.html`, W7): "{{rounds_season}} rounds for the year." → "Each year we top you up to {{rounds_season}} rounds. Unused rounds carry over."
- Weekend Pass card, full line: "For one tournament weekend. Rounds never expire."
- FAQ on cancel. Before: "Yes. You keep your plan until the end of the month or Season you paid for." After: add "The rounds you have stay in your account and never expire."
- Camp Pass keep wording (card, `TabulaCamp.keepText`, the my. confirm step): "as saved rounds for 12 months" → "as saved rounds that never expire".
- Never use the words "value" or "gift".

## Check after publish

- "expire" appears on the live Terms and Refund Policy only in the Program sentences, the "do not expire" sentences and §18.
- "4 days" and "12-month term" give 0 hits.
- All After texts above are on the live pages.

## Other drafts and records to change

- **Update 4, Camp Pass** (`LEGAL-UPDATE-4-CAMP-PASS-DRAFT-2.md`):
  - T4 (kept Rounds "expire 12 months after the camp period ends") → kept Rounds become Round Pack Rounds and do not expire.
  - T4b and R5 assumed update 6's reminder paragraph. There is none now. Rewrite them as a standalone Camp Pass reminder sentence.
  - T3 and R4 "Before" texts become this draft's T4 and R4 After texts.
  - The Plans card line "as saved rounds for 12 months" → "as saved rounds that never expire".
  - Gate item 1 requires update 6's T4, R4 and P1 (reminders). Those are gone. Rewrite the gate: update 6 (this draft) goes live first, and the Camp Pass adds its own reminder sentences.
  - Its Privacy note relied on update 6 P1. Add a P1 of its own: "send service messages, such as sign-in emails, receipts, renewal reminders, Camp Pass reminders and notices of changes to our terms or this policy;".
  - R3 ("add after the 12-month sentence", "as Round Pack Rounds for 12 months") and the "Kept Rounds" rule ("12 months") → kept Rounds do not expire.
  - Three texts in this draft become false when the Camp Pass is live: T5 "Except for Program Rounds, Rounds that you buy do not expire", R2, and the Plans line "Your rounds never expire". Update 4 must change them to name the Camp Pass end date (for example "Except for Program Rounds and unused Camp Pass Rounds when the camp period ends, …").
  - The research flags the Camp Pass end date and the share rule as a possible expiry in Washington (L4).
- **Update 5 Part B** (buy first):
  - Remove the whole Terms §6.6 setup item (line 281): both the 12-month sentence and "A Weekend Pass or Camp Pass keeps its own rule …". Same change in `docs/design/BUY-FIRST-SPEC.md` step 4.
  - Remove the Refund §4 "Expiry" addition (line 329, "its 12-month periods count …"). R3 also renames that item to "How long Rounds last".
  - Refund §4 "no cash value" item (A9): its Before ("They cannot be refunded, redeemed for cash or transferred.") changes after R5 to "They cannot be refunded, redeemed for cash or transferred, except where the law requires otherwise."
- **`TEEN-ROUNDS-AND-GIFTS.md` §9.4** (expiry of sent Rounds): no longer needed for one-time Rounds.
- **`LEGAL-FACTS.md`** on the publish day: the "Round expiry" and "Spend order" rows, and the "Approved, not live yet" list.

## Questions for the lawyer

- **L1. The cap wording (the lawyer asked about roll-over limits).** T5 says the cap "limits only what we add" and "never removes Rounds that you already have". Is a cap on new grants safe under Washington and California gift-certificate law? Our view: nothing that a buyer paid for is ever taken away; the cap only limits future grants.
- **L2. Account deletion.** §18 says unused Rounds are forfeited when the Account ends, "except where the law requires otherwise". When a user deletes their own Account, is that a lawful forfeit, or must we pay out or warn first?
- **L3. Program Rounds.** Program Rounds still expire on July 31. Schools buy them by invoice under a business contract. Are business purchases outside the gift-certificate laws?
- **L4. Camp Pass.** The research says a fixed end date and the share rule may be an "expiration" in Washington (Hollis: "use by" versus "use for"). Is the Camp Pass safe as drafted in update 4, or should it be sold as a time pass ("use it until August 15")?
- **L5. Cash-out.** Terms §6.7 already says "except where the law requires otherwise", and R5 adds the same words to the Refund Policy. California requires cash-out below $15, and Washington below $5, if Rounds are covered. Is the carve-out enough, or must we state a cash amount per Round?

## Recommendations adopted (owner and lawyer, 2026-11-23)

1. Paid Rounds never expire (this draft).
2. No "gift card" label in §6.7; the Refund Policy gets "except where the law requires otherwise" (this draft, R5).
3. Camp Pass: a pass that is never started keeps all its Rounds (1 to 1) as Round Pack Rounds. The share rule applies only to a started pass (update 4, draft 4).
4. Small-balance cash-out: where a state law requires a cash payment (California below $15, Washington below $5, if Rounds are covered), support pays the price paid per Round on request (`LEGAL-FACTS.md`, "Support rules").
5. Account deletion: before a user deletes their Account, the app shows "You have N rounds. Deleting your account removes them." (`LEGAL-FACTS.md`, "Support rules"; app work).
6. New York from 2027-01-01: Hosted AI stays a narrow, on-topic tool (`docs/design/AI-POLICY.md`, "New York companion rules").
7. School data agreements: delete student data within 45 days of a school's request (`LEGAL-FACTS.md`, "School data").
8. Watch the federal KIDS Act / COPPA 2.0: if a version that covers age 13 passes, 13-year-olds need a parent's consent or a school agreement (`private/legal/MINORS-AI-SUMMARY.md`).
