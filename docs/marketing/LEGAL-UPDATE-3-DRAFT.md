# Legal update 3 draft: no free trials, and Hosted AI for users aged 13 to 17 (Terms, Refund Policy, Privacy, Plans)

Draft 3, 2026-11-21. **Not approved. Not live.** Do not copy this text to the live pages until the lawyer approves it and the owner says yes.

## Owner decisions this draft follows

1. **No free trials at all.** Owner, 2026-11-21: "go with the demo and no free trial"; then, after the lawyer's text: "we won't have trials. Really, let's just get rid of the trials". This removes the 7-day / 8-Round trial and the student school-code free Round from draft 1. A paid promotional price (for example a later $1 first Round) is not a trial and stays possible.
2. **A staged demo** that anyone can watch as many times as they like. Owner: "demo will be ready by go-live".
3. **Users under 18 can use Hosted AI.** Owner: "the terms can make it so that people younger than 18 can use the hosted AI, unless there are state laws that preclude people from being able to do so in their state." The owner reports that the lawyer said the 18+ rule for Hosted AI can be lowered or removed, with no trials.
4. **Research all 50 states and DC first**, and name in the Terms any state where a law stops this.
5. **Legal minimum only.** Owner, 2026-11-21: "do the legal minimum required - so where it is required by law, obtain it; otherwise, let them sign up directly". Users aged 13 to 17 sign up on their own. We ask for a parent's consent only where a law requires it. As far as researched, no state law requires it for Tabula as built.

## Research result in short

The full summary, with sources and gaps, is in `private/legal/MINORS-AI-SUMMARY.md`. The research notes are in `private/legal/minors-ai-research/`. Both are private (gitignored). Give both to the lawyer with this draft.

- **As far as researched, we found no state law that bars people aged 13 to 17 from using or buying a tool like Hosted AI.** So the Terms name no state where minors may not use it.
- As far as researched, we found no state that needs parental consent or age verification for Tabula as it is built today: a web app, no ads, no sale of data, no social features, no AI companion features. (Arkansas needs consent from the teen or a parent before it collects data from a known 13 to 16 year old. A teen's own consent is enough there.)
- Several states give known minors extra privacy rights (for example Arkansas, Colorado, Connecticut, Montana, New York, Vermont from 2027). The Privacy changes below cover the main ones.
- A minor can cancel a contract in most states. So only adults buy (Terms §3).
- **Gaps.** Some items are not verified. The main gaps: K-12 student-data laws in Florida, Georgia, Hawaii, Idaho, Indiana and Iowa were not researched. The Georgia SB 540 text and the Indiana HEA 1408 definitions were not read. Some New York, Nebraska, Nevada, Montana, Vermont, Tennessee, Texas and Utah items rest on secondary sources. The summary lists all gaps. [LAWYER L7]

Source files (do not edit until approved): `~/Code/tabula-sites/sites/speech/pages/terms.html`, `refunds.html`, `privacy.html`, `plans.html` (live at tabulaspeech.com).

Section numbers and anchor ids do not change. Terms §7 and Refunds §2 keep `id="trial"`, so old links still work.

Tags: **[LAWYER Ln]** is a point for the lawyer. **[OWNER Qn]** is a question for the owner.

---

# Part 1. Terms of Service

## Terms page description (meta, line 1)

**Before:** "The Tabula Terms of Service from Pattern Engine LLC: accounts, Rounds, plans, the free trial, AI ballots, acceptable use, arbitration and your rights."

**After:** "The Tabula Terms of Service from Pattern Engine LLC: accounts, Rounds, plans, AI ballots, acceptable use, arbitration and your rights."

## Table of contents (line 18)

**Before:** "7. Free trial"

**After:** "7. No free trials" [OWNER Q2]

## §1 Agreement (line 47, one phrase)

**Before:** "You accept these Terms when you first use the Service, create an account, start a free trial, or make a purchase."

**After:** "You accept these Terms when you first use the Service, create an account, or make a purchase."

## §3 Eligibility (lines 68–77)

This section is the one place for the age rules. The Privacy Policy and the Refund Policy point here.

**Before (live text, in full)**

> **3. Eligibility**
>
> In short: You must be 18 or older to buy. Students aged 13 to 17 can use hosted features only through a school Program. The Service is not for children under 13.
>
> - You must be at least 18 years old, and able to form a binding contract, to create a personal Account, start a free trial or buy a Paid Plan.
> - Students aged 13 to 17 may use Hosted AI and other account features only as members of a school Program, and only with the authorization of their school or a parent or guardian.
> - The Service is not directed to children under 13. Children under 13 may not create an Account or give us personal information.
> - You may not use the Service if the law forbids it, or if we have suspended or terminated your access before.

**After (in full)**

> **3. Eligibility**
>
> In short: You must be 13 or older to have an Account. Only adults can buy. The Service is not for children under 13.
>
> - You must be at least 13 years old to create an Account or use Hosted AI.
> - If you are 13 to 17, you can create an Account and use Hosted AI on your own. If a law where you live requires a parent's or guardian's consent, we ask for it before you use Hosted AI. [LAWYER L5]
> - To buy a Paid Plan, you must be an adult where you live and able to form a binding contract. In most states, an adult is 18 or older. This rule does not apply to a school or other organization that buys a Program (see Section 9). [LAWYER L6]
> - A parent or guardian can buy a Paid Plan for a minor's Account. The parent or guardian who buys is responsible for the purchase.
> - Some states give users under 18 extra privacy rights. We follow those laws where they apply. Our Privacy Policy, Section 12, tells you how we protect the data of users under 18. [LAWYER L7]
> - The Service is not directed to children under 13. Children under 13 may not create an Account or give us personal information. [OWNER Q4]
> - You may not use the Service if the law forbids it, or if we have suspended or terminated your access before.

The Terms name no state where minors may not use Hosted AI, because the research found none. [LAWYER L7]

## §4 Accounts (line 82)

**Before:** "You do not need an Account to use the free app. You need an Account for the free trial, Paid Plans, Programs and Hosted AI."

**After:** "You do not need an Account to use the free app. You need an Account for Paid Plans, Programs and Hosted AI."

## §6.2 How a Round is used (line 114, one phrase)

**Before:** "Until then you can return it, and it does not count toward any limit, such as the trial limit."

**After:** "Until then you can return it, and it does not count toward any limit."

## §6.3 Returning a Round (line 115, last sentence)

**Before:** "This rule also applies to free trial Rounds."

**After:** delete the sentence.

## §6.6 Expiry list (line 132)

**Before:** "Free trial Rounds expire as Section 7 says."

**After:** delete the bullet.

## §7 (lines 140–149)

**Before (live text, in full)**

> **7. Free trial**
>
> In short: New Accounts get a {{trial_days}}-day free trial with {{trial_rounds}} Rounds of Hosted AI. No card is needed. One trial per person.
>
> - Each new Account gets one free trial. The trial lasts {{trial_days}} days and includes {{trial_rounds}} Rounds of Hosted AI. The trial ends when the {{trial_days}} days pass or when you have used the {{trial_rounds}} Rounds, whichever comes first.
> - You do not need to give a payment card to start the trial. The trial does not turn into a paid subscription by itself.
> - Each person may have only one trial. We verify trials by email address and device. If we find that someone has created more than one trial, or has abused the trial in another way, we may void the trial and remove any unused trial Rounds.
> - The trial exists so you can test Hosted AI before you buy. This is one reason purchases are not refundable (see Section 8).

**After (in full)**

> **7. No free trials**
>
> In short: We do not offer free trials of Hosted AI.
>
> - We do not offer free trials or free Rounds of Hosted AI.
> - A promotional price (see Section 8) is a paid purchase. It is not a free trial.
> - To try Tabula before you buy, see our Refund Policy, Section 2. [LAWYER L1] [LAWYER L2]

The section stays, with the same number and anchor, so that cross-references and old links still work.

## §8 Price changes (line 159)

**Before (live text, in full)**

> **Price changes.** We may change our prices. A price change for a Subscription applies from your next renewal after we give you notice. If you do not agree to the new price, you can cancel before that renewal.

**After (in full)**

> **Price changes.** We may change our prices. We may also offer promotional or test prices. For example, we may offer a lower price for your first Single Round. A promotional price may be for some users only, and for a limited time. The price shown at checkout is the price you pay. A price change for a Subscription applies from your next renewal after we give you notice. If you do not agree to the new price, you can cancel before that renewal. [LAWYER L4]

## §13 Acceptable use (lines 214–215)

**Before:** "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions, trials or Accounts;" and "get around usage limits, trial limits, Round metering, access controls or Program policies;"

**After:** "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts;" and "get around usage limits, Round metering, access controls, the age rules in Section 3 or Program policies;" (a cross-reference only) [LAWYER L7]

## Terms header

**Before:** "Effective November 21, 2026. Last updated November 21, 2026."

**After:** "Effective [PUBLISH DATE]. Last updated [PUBLISH DATE]." [LAWYER L1]

---

# Part 2. Refund Policy

## Refund page description (meta, line 1)

**Before:** "The Tabula Refund Policy: no refunds except where the law requires, a {{trial_days}}-day free trial with {{trial_rounds}} rounds, how to cancel, what happens to Rounds, and chargebacks."

**After:** "The Tabula Refund Policy: no refunds except where the law requires, how to try Tabula before you buy, how to cancel, what happens to Rounds, and chargebacks."

## Lede (line 5)

**Before:** "Tabula purchases are not refundable. Try Hosted AI free first with the {{trial_days}}-day trial, then buy only if it works for you."

**After:** "Tabula purchases are not refundable. Use the free app and watch the Hosted AI demo first. Then start with a Single Round before you buy a larger plan." [OWNER Q1]

## Table of contents (line 13)

**Before:** "2. Free trial"

**After:** "2. Try before you buy"

## §2 (lines 40–49)

This section is the one place that tells users how to try Tabula before they buy. Terms §7 points here.

**Before (live text, in full)**

> **2. Free trial**
>
> In short: Test Hosted AI free for {{trial_days}} days, with {{trial_rounds}} Rounds included. No card is needed.
>
> - Each new Account gets a {{trial_days}}-day free trial that includes {{trial_rounds}} Rounds of Hosted AI.
> - You do not need a payment card to start the trial. The trial does not turn into a paid plan by itself.
> - There is one trial per person. We verify trials by email address and device. Abuse voids the trial.
>
> The trial exists so you can test Hosted AI in real rounds before you pay. Please use it before you buy.

**After (in full)**

> **2. Try before you buy**
>
> In short: The whole app is free, and the Hosted AI demo is free to watch. To test Hosted AI in your own round, start small.
>
> - The whole app is free with no purchase and no Account: the clock, the flow, the ballot, and AI with your own key. Use it in real rounds before you buy anything.
> - Watch the demo of a full debate round with Hosted AI, as many times as you like.
> - To test Hosted AI in your own round, buy a Single Round first. Buy a larger plan only if Hosted AI works for you.
> - You can return a Round until the first speech of that debate round is recorded (Terms Section 6.3). A returned Round goes back to your balance. It is not a refund.
> - We do not offer free trials (Terms Section 7). [LAWYER L3]

## §4 What happens to Rounds, Expiry bullet (line 68)

**Before:** "…Season and All-Access Rounds expire at the end of the 12-month term. Free trial Rounds expire when the trial ends. Program Rounds expire on July 31…"

**After:** "…Season and All-Access Rounds expire at the end of the 12-month term. Program Rounds expire on July 31…"

## Refund Policy header

**Before:** "Effective November 20, 2026. Last updated November 20, 2026."

**After:** "Effective [PUBLISH DATE]. Last updated [PUBLISH DATE]." [LAWYER L1]

All other Refund Policy sections stay the same.

---

# Part 3. Privacy Policy

## §3 Data we collect: In short (line 52)

**Before:** "With an account, we keep your email, sign-in records, plan, credit balance, a ledger of purchases and credit use, and basic usage records."

**After:** "With an account, we keep your email, sign-in records, date of birth, plan, credit balance, a ledger of purchases and credit use, and basic usage records."

## §3 line 53 (one phrase)

**Before:** "If you create an Account, start a free trial, buy a Paid Plan or join a Program, we collect…"

**After:** "If you create an Account, buy a Paid Plan or join a Program, we collect…"

## §3 line 57 (one phrase)

**Before:** "your plan, its status and renewal date, your trial status, and your Credit balance."

**After:** "your plan, its status and renewal date, and your Credit balance."

Add a new bullet after it: "**Date of birth:** the date of birth you give when you create an Account." [LAWYER L8]

## §9 lines 133 and §18 line 276 (one phrase each)

**Before:** "prevent fraud, trial abuse and misuse, and keep the Service secure;" and "to keep the Service secure, prevent fraud and trial abuse, …"

**After:** "prevent fraud and misuse, and keep the Service secure;" and "to keep the Service secure, prevent fraud and misuse, …"

## §12 Children (lines 190–192)

Privacy §9 (line 137) already says: "We do not sell personal information. We do not use personal information for targeted advertising. We do not build profiles of students." Privacy §16 already gives access, correction and deletion rights. So §12 adds only the new promises and points to those sections.

**Before (live text, in full)**

> In short: Tabula is not for children under 13, and we do not knowingly collect their personal information.
>
> The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. Students aged 13 to 17 may use hosted features only through a school Program, with the authorization of their school or a parent or guardian. Purchasers must be 18 or older.
>
> If we learn that we have collected personal information from a child under 13 without the consent the law requires, we delete it. If you believe a child under 13 has given us personal information, contact us at {{support}}.

**After (in full)**

> In short: Tabula is not for children under 13. Users aged 13 to 17 can sign up on their own, and we give their data extra protection.
>
> The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13.
>
> Users aged 13 to 17 may use Tabula as Terms Section 3 says. We ask for your date of birth when you create an Account. When you create an Account, you agree that we collect the personal information we need to provide the Service. Where a law requires a parent's consent, we ask for it. For users we know are under 18:
>
> - we do not use their recordings, transcripts or other content to train AI models; and
> - we collect and keep only the personal information we need to provide the Service.
>
> Section 9 applies to all users: we do not sell personal information, use it for targeted advertising or build profiles of students. A user under 18, or their parent or guardian, can use the rights in Section 16.
>
> If we learn that we have collected personal information from a child under 13 without the consent the law requires, we delete it. If you believe a child under 13 has given us personal information, contact us at {{support}}. [LAWYER L8]

The old sentence "Purchasers must be 18 or older." is removed. Terms §3 now has the purchase rule.

## Privacy header (line 6)

**Before:** "Effective November 20, 2026. Last updated November 20, 2026."

**After:** "Effective [PUBLISH DATE]. Last updated [PUBLISH DATE]." [LAWYER L1]

---

# Part 4. Plans page

No new Plans copy is needed. The live Plans page (origin/main) still has trial lines (lines 1, 11, 36, 85, 86), because the production page is held. The marketing session's production Plans page on tabula-sites branch `buy-prod` already has no trial words, links or `/trial/` page. Checked 2026-11-21: `buy-prod` at ec63e6e has 0 matches for "trial" in `plans.html` and no trial files. Marketing reports a check that blocks trial words from coming back.

**Rule: the Terms, Refund and Privacy changes and `buy-prod` go live on the same day.** If they go live apart, the Plans page and the Terms contradict each other.

After that, remove `trial_days` and `trial_rounds` from the site config (`build.mjs` line 30 area) when no page uses them.

---|---|---|
| 1 (meta description) | "…starts at {{price_round}} a round, or {{price_month}} a month. Start with a {{trial_days}}-day free trial." | "…starts at {{price_round}} a round, or {{price_month}} a month. Watch the free demo first." |
| 11 | "Try it free for {{trial_days}} days: {{trial_rounds}} rounds of AI, no card. Accounts open soon, and the trial starts with your account." | "Watch a full round with Hosted AI in the free demo, as many times as you like." |
| 36 | Button: "Get the trial when accounts open" | Remove. The buy button on `buy-prod` replaces it. |
| 85 (FAQ) | "Can I try it before I pay?" / "Yes. New accounts get {{trial_days}} days and {{trial_rounds}} rounds of AI free. No card needed." | "Can I try it before I pay?" / "Yes. The whole app is free. Watch the Hosted AI demo as many times as you like. Then start with a single round." |
| 86 (FAQ) | "What happens after the trial?" / "Nothing is charged. AI with no setup stops until you buy a plan. …" | Remove. |

After these, remove `trial_days` and `trial_rounds` from the site config (`build.mjs` line 30 area) when no page uses them.

---

# Before publishing (checklist)

- [ ] Lawyer approves L1 to L8. Owner answers Q1, Q2 and Q4 and says yes.
- [ ] The Hosted AI demo is live. If not, remove the demo lines (Refunds lede and §2).
- [ ] `buy-prod` (no trial) goes live on the same day as this text. Re-check it has no "trial" match.
- [ ] The app asks for a date of birth (a date picker) at sign-up and blocks under 13.
- [ ] At sign-up, a user aged 13 to 17 agrees to the data collection (Arkansas teen consent, per L5). The app can ask for a parent's consent in a state where the lawyer says the law requires it.
- [ ] For users known to be under 18, the app does not use their recordings or transcripts to train AI models.
- [ ] A data retention rule exists for minors' data ("collect and keep only what we need").
- [ ] A way exists to handle access, correction and deletion requests from a minor or their parent (Privacy §16).
- [ ] Product rules in `private/legal/MINORS-AI-SUMMARY.md` (no social features, no AI companion features, no push notifications to known minors, web app only, no voiceprints) are true in the app.
- [ ] Re-check the federal bills (GUARD Act, COPPA 2.0, KIDS Act) and Pennsylvania HB 2006 after 2026-11-30.
- [ ] The tabula-sites branch `claude/free-trial` (trial wording, a1a3806) does not ship.

---

# Points for the lawyer

| # | Point | Where |
|---|---|---|
| L1 | Notice and effective date. Accounts are open only on staging. No one has a production trial. Does the old 8-Round promise bind anyone who signed up on staging? Terms §24 and Privacy §20 need 30 days' notice for a material change. Can these changes take effect on the publish day? | Terms header, §7, §24; Refunds header; Privacy header, §20 |
| L2 | §7 now says "We do not offer free trials". A future trial would need a Terms change. Is that right, given your advice that "we won't have trials"? | Terms §7 |
| L3 | The no-refund rule no longer points to a trial. The new reasons: the whole app is free to use first. The demo is free. A Single Round lets you test at low cost. You can return a Round before the first speech. Are these reasons clear and enough under state consumer law and card-network rules? | Refunds lede, §2 |
| L4 | Promotional or test prices for some users only (a later $1 first Round). Is the §8 text enough, and is a price test of this kind allowed under state consumer law? | Terms §8 |
| L5 | Users 13 to 17 sign up on their own. The owner wants only the legal minimum. As far as researched, no state law requires a parent's consent for Tabula as built. Arkansas Act 952 needs consent from the teen or a parent before collecting data from a known 13 to 16 year old, unless a permitted purpose applies. Is the teen's agreement at sign-up (Privacy §12) enough for Arkansas? Is any other state's parental consent rule triggered? Can a teen agree to these Terms (for example arbitration, §22) without a parent? | Terms §3, §22; Privacy §12 |
| L6 | Only adults buy. §3 says "an adult where you live… in most states, 18 or older". The research confirms that Alabama is 19 (Ala. Code 26-1-1). Please confirm the other states with a higher age. So an 18-year-old in Alabama can use Hosted AI but cannot buy. Is that right? A minor who buys anyway can usually cancel the contract. Kansas K.S.A. 38-103 stops that if the minor misstated their age. Do we need a refund path for a minor who cancels? | Terms §3, §8 |
| L7 | As far as researched, no state bars users aged 13 to 17 from Hosted AI. So the Terms name no state. Do you agree, given the gaps in the summary? Should the Terms name states with special rules (Arkansas, Colorado, Connecticut, Montana, New York, Vermont)? The draft puts those duties in Privacy §12 instead. Also: §3 now promises "We follow those laws where they apply." Do you want that promise? | Terms §3, §13; summary file |
| L8 | Privacy now collects a date of birth (owner choice, 2026-11-21: a date picker). It adds two promises for users under 18: no AI training on their content, and minimum data. It points to §9 and §16 for the rest. Do these meet the minors' data laws in the summary? The main ones: Arkansas Act 952, Colorado SB 24-041, Connecticut CGS 42-529, Montana SB 297, the New York Child Data Protection Act, and the Vermont design code. What else is needed? For example, Colorado and Connecticut may need data-protection assessments. | Privacy §3, §12 |

# Questions for the owner

| # | Question | Draft choice |
|---|---|---|
| Q1 | The Refund Policy tells users to watch the demo, then test with a Single Round. Is that the message you want? | Kept |
| Q2 | Terms §7 and Refunds §2 keep their section numbers and the `#trial` anchor, so links still work. OK? | Keep |
| Q3 | Parent permission for users 13 to 17? | **Answered (owner, 2026-11-21):** legal minimum only. Teens sign up on their own. Ask a parent only where a law requires it. |
| Q4 | Under 13: the draft keeps the live rule (no Accounts under 13). An option for later: allow under 13 only through a school Program, with school consent under COPPA. That helps middle-school debate, but Hosted AI records children's voices, so the lawyer must check it first. | Keep the live rule |
