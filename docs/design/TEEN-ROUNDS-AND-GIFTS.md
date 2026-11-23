# Teen rounds, school AI settings, sending rounds, and the refund fallback (design, draft 1)

Status: DRAFT, 2026-11-23. Design only. No code, no Stripe change, no legal text is live. The owner decided D1 to D8 on 2026-11-23 (§12). The lawyer agreed with all 9 working answers on 2026-11-23 (§11b, as reported by the owner). Their three changes are now in §5.1, §6.1 and §8. Items marked "lawyer" in §13 are answered; each part still goes live only with its legal text.

Builds on: `docs/design/BUY-FIRST-SPEC.md` (draft 2, "send setup to someone else"), `docs/design/AI-POLICY.md`, `docs/design/AI-ROUND-CONSENT.md`, `docs/marketing/LEGAL-UPDATE-5-DRAFT.md` (Parts A and B), tabula-cloud `src/age.ts`, `src/platform/resolve.ts`, `src/platform/settings.ts`, `src/platform/limits.ts`, `src/meter/user-do.ts`, `src/billing/webhook.ts`, `docs/platform/MODEL.md`.

Prices: this doc names no prices. The private business plan holds them.

---

## 1. The owner's ideas (2026-11-23), in short

1. A parent buys rounds. The teen is **not** in a school program. The teen can use Hosted AI with those rounds.
2. The teen **is** in a program, and the school allows AI. The rounds carry over and work.
3. The school has AI off ("muted"). The rounds stay on the account. They work later if the account gets an allowance (for example, the teen becomes a judge), or they can move to another user.
4. Gifts and transfers: type the recipient's email. If it is a real account, the recipient must accept (a consent double check).
5. Fallback: a refund window (maybe 7 days) when the school setting blocks the rounds. After that, the rounds stay credited. That gives time to cure: send them to a judge you know, or to the school pool.

This doc keeps ideas 1 and 3. It changes idea 2 (code work is needed), idea 4 (§5.2: the sender never learns whether an email has an account) and idea 5 (§6.2 and §6.4: the buyer cures, and no move into a school pool). §2 says why.

---

## 2. What exists today, and where it conflicts

### 2.1 Age rules

| Source | What it says | Conflict? |
|---|---|---|
| Live Terms §3 (tabula-sites `sites/speech/pages/terms.html`) | 13+ may have an Account **and use Hosted AI on their own**. Only adults buy. A parent or guardian may buy for a minor's Account. | No. Idea 1 matches it. |
| tabula-cloud `src/age.ts` (on main, commit c6bd335 "13+ for Hosted AI, adults buy, school stays 18+") | `hostedAge`: a teen with a date of birth may use Hosted AI on their own plan. `buyAge`: the state's age of majority (18; AL 19, NE 19, MS 21). `joinAge`: under 18 joins a school as **managed**. Running a school is 18+. A per-state "parent consent before Hosted AI" switch exists, but no state has it on and no consent flow exists. | No. Idea 1 already works in code. |
| `BUSINESS-PLAN.md` (private) row 6 and §12 Q7 | Hosted AI is 18+ until Program codes exist (summer 2027). Student judges use Hosted AI only through a Program code. | **Yes.** It is older than the Terms and the code. **Replaced by D1** (owner, 2026-11-23). The private file itself is not edited; the owner edits it if they want. |
| `BUY-FIRST-SPEC.md` rule 5 | An adult may buy; a 13 to 17 user may receive and use the rounds. | No. It matches idea 1. |
| tabula-cloud `docs/platform/MODEL.md` §7 | "A teen account is always managed by at least one program, or by a guardian (later). A teen never buys." | **Yes, the first sentence.** A solo teen account (no program) exists today under Terms §3 and `age.ts`. "A teen never buys" still holds. |
| `AI-POLICY.md` §2c ("Managed account" line) | Students 13 to 17 can get an account only through the school or with parent consent (paraphrase). | **Yes**, same as MODEL §7. Both docs need one line fixed (§10.3). |

The task brief called the age-check work "13+ to buy". The code says **adults buy** and **13+ use**. This doc follows the code.

### 2.2 School AI settings versus personal rounds (the big one)

The resolver already decides "school setting versus personal rounds". Today it says:

- A teen who joins by code is a **managed** member (`joinAge`). The program's policy covers **every** round on that account, on every host (MODEL §7, AI-POLICY §2c).
- A student's `ai.mode` may only be `program` (school pays) or `hidden` (off). `self` (own plan) is not allowed for students (`settings.ts:81-85`). A student `self` row resolves to hidden (`resolve.ts:92`).
- The student wallet order is: pool, then step-down. **A student never falls back to their own rounds** (`src/platform/limits.ts:119-124`).
- Until a program has a pool (summer 2027), `program` collapses to `hidden` for students (MODEL §5, CONTRACTS §3 step 4).

So, today:

- Idea 3 (AI off → rounds frozen) already happens. The server answers `403 policyOff` before the meter reserves anything. No round is spent.
- **Idea 2 does not work.** A teen in any program, even one with AI on, cannot use personal rounds. And until pools exist, every program hides student AI. A parent who buys for a teen who later joins a school would see the rounds freeze in all cases.

Fix in §4.2 (decision D2).

### 2.3 Moving rounds between users

- Live Terms §6.7 and §13, and live Refund Policy §4: rounds "cannot be ... transferred". §13 forbids "resell, share, transfer or trade Rounds".
- Legal update 5 Part B (not live) adds one exception: "a buyer may send a purchase to **one other person** through our setup step".
- Code: no transfer exists. Credit lots belong to one `user_id` (`migrations/0006_credit_lots.sql`). Ledger writes hard-code the owner (`user-do.ts:877, 1007, 1026`). The buy-first spec plans the first move (`payment_moves`, `purchase_setups`), not built.

Idea 4 and the "cure" in idea 5 need a **second** move of the same purchase (teen → back to the buyer → a judge). That goes past Part B's "one other person". Part B text must widen before it ships (§10).

### 2.4 Moving rounds into a school pool

- MODEL §4: "A program pool and personal lots never mix." The pool is owned by `program_id`. Personal lots are owned by `user_id`.
- The pool is sold by Pattern Engine LLC by invoice. Personal rounds are sold through Link (Stripe's merchant of record).
- Pool rounds expire July 31. Pack rounds expire 12 months after purchase.
- Pools do not exist until summer 2027.

So "transfer to the school pool" mixes two sellers, two expiry rules and two refund paths. This doc does not allow it (§6.4, decision D5).

### 2.5 Refund windows

- Live Refund Policy §1: no refunds, except where the law requires one. No window for unused rounds.
- Legal update 5 Part A (lawyer baseline, not live): Link may refund under its own rules ("within 60 days of a purchase in certain cases"). The live Link setting is "Refund without emailing me" (automatic). A refund takes back rounds pro rata: first from that payment's unused rounds, then from the account's other unused rounds.
- Legal update 5 Part B (not live): full refunds for under-13, a send to an under-13 person, a charge without permission, and a purchase a minor made.
- tabula-cloud `docs/STRIPE.md` §"choices" item 5 says "Refunds: 14 days, unused credits only, Stripe fee kept". **It is stale.** No code checks a window, and no live text has one. It should point to the Refund Policy.

So **no refund window for unused rounds exists today.** Idea 5 adds a narrow one (§7).

### 2.6 Refunds and disputes after a move (code facts)

`applyTakeBack` (`user-do.ts:910-943`) takes back from the payment's own lot, then from the same user's other lots. The webhook calls the meter of `payments.owner_id` (`webhook.ts:251-312`). `applyRestore` (`user-do.ts:952-998`) returns rounds to the original lots of the original user. The dispute hold (`billing_hold_at`) goes on that user.

If a lot has moved to another user, all four steps hit the **buyer**: the take-back drains the buyer's other rounds, the recipient keeps the moved rounds, and a won dispute restores to the wrong account. The buy-first spec §11 names the fix (`payment_moves`). §8 here adds the rules it does not cover.

---

## 3. Words

- **Buyer:** the adult who paid. Owns the payment, the Stripe customer and any subscription (BUY-FIRST rule 7).
- **Holder:** the account that holds a purchase's rounds now.
- **Teen:** an account aged 13 to 17 by date of birth (`ageBand = teen`).
- **Managed:** a teen in a program. The program's policy covers every round on the account.
- **Paused rounds:** rounds on an account whose program policy turns off every AI feature they could pay for. They are not spent, not removed, and keep their dates.
- **Send:** move all unused rounds of one purchase to another account. The recipient must accept.
- **Pause refund:** the narrow refund in §7.

We say "send rounds", not "gift" or "gift card", in the product and the legal text. See §11 item 3 for why.

---

## 4. Rules: whose rounds work where

### 4.1 Teen with no program (idea 1)

- Works today. The teen gives a date of birth, then uses Hosted AI with rounds an adult sent (`hostedAge`).
- Edition rules still win (AI-POLICY §4 layer 1). On the student host, the student edition's rules apply (no live judging tools about their own round; post-mortem only after closure). Rounds never unlock a feature an edition forbids.
- Where a state law needs a parent's consent, the per-state switch in `age.ts` blocks the teen until a consent flow exists. §9.2 says how a parent's send could become that consent (lawyer item).

### 4.2 Teen in a program that allows AI (idea 2): needs a new student mode

Add a third student choice to the admin's AI setting:

| Admin sees | `ai.mode` for students | Who pays |
|---|---|---|
| Flow only | `hidden` | Nobody. Personal rounds pause. |
| AI clerk, school pays | `program` | The pool. If the pool is empty or capped, the student's own rounds, then step-down. |
| AI clerk, family rounds | `self` (new for students) | The student's own rounds only, then step-down. |

- The **features** stay the school's choice (`ai.features`). The mode only says who pays.
- "Family rounds" works today, with no pool. So a school can allow AI before summer 2027.
- The admin still must pick (AI-POLICY §2b). Until the pick is saved, students are Flow only.
- **This reverses one rule: "students never pay from their own rounds".** It is not a small edit. Three files hold that rule today:
  - `src/platform/settings.ts:81-85` (`modesFor`, which is also the setting validator) must allow `self` for students.
  - `src/platform/resolve.ts:90-92` must stop mapping student `self` to hidden, and its "minors cannot buy" comment must say "minors cannot buy, but may spend rounds an adult sent".
  - `src/platform/limits.ts:112-124` (`walletOrder`) for students becomes pool → self → step-down (payer `program`) and self → step-down (payer `self`).
- The buy right does not change. Only an adult buys (`buyAge`). A teen only spends rounds an adult sent.
- AI-ROUND-CONSENT applies: a teen paying with own rounds is a self-payer, so "Ask me first" and the rounds-left pill apply.

Decision D2.

### 4.3 Which setting wins (idea 3)

- **The program wins on every round of a managed teen.** This is the code today and AI-POLICY §2c. A school that picks Flow only gets Flow only, at home too.
- Layers (AI-POLICY §4) are unchanged: edition, tournament mode, program policy, plan or rounds, own settings. Each layer only removes.
- A teen in two programs: inside a round for program A, A's policy applies. Outside any program round, the **strictest** of the teen's programs applies (fail closed). Today `resolve.ts:70-76` picks "any managed membership"; it must pick the strictest. Small code change.
- Tournament mode still turns AI off in rounds, whoever pays.

Decision D3.

### 4.4 Paused rounds become usable again when

1. The admin changes students to "AI clerk" (either kind).
2. The teen leaves the program (or the program ends) and has no other program.
3. The admin turns on "Student judges may use judge AI" (`ai.studentJudges`, AI-POLICY §1b). Then the teen's own rounds pay **only** for judge-host rounds the teen judges. (This is the owner's "promoted to judge" case.)
4. The teen turns 18 and confirms. The account can become linked (MODEL §7). Then the policy covers program rounds only.
5. The rounds move to another account (§6).

---

## 5. Sending rounds (idea 4)

### 5.0 Which doc owns what

- `BUY-FIRST-SPEC.md` owns the purchase, the setup link and the **first** send (one hop: buyer to user).
- **This doc owns every move after the first** (give back, take back, re-send), the pause, the pause refund, and the refund and dispute rules for a purchase that has moved more than once (§8). BUY-FIRST §11 should point here (§10.3). Neither doc repeats the other's rules.

### 5.0b v1 minimum, and what can wait

The owner asked for: send by email, accept, a pause, and a 7-day refund. The **v1 minimum** is:

- §5.1 (send, accept or decline, 14-day lapse), §5.2 (same message for every email), the existing BUY-FIRST caps.
- §6.1 to §6.3 (pause, buyer email, give back, take back, what the teen sees).
- §7 (the pause refund).
- §8 (refunds and disputes follow the holder).

**Optional, add only if abuse or the lawyer asks for them:** the two-send limit (v1 can allow only "give back" plus one re-send, which is the same thing in practice), the 3-senders-per-30-days cap, the 72-hour hold after an "elevated" Radar charge, and blocking a sender. Each one adds Terms text. **Not optional any more** (lawyer, §11b items 2 and 9): the "I know this person" confirm in §5.1 step 3, and the consent record in §9.2.

### 5.1 One flow for every send

The buy-first spec already has "Send setup to someone else" after checkout. This doc reuses that flow for every later send, and lets it run from the app too.

1. **Who can send:** the buyer of the purchase, signed in. (A teen holder cannot send. See §6.2.)
2. **What moves:** all unused rounds of **one purchase**. No split. One purchase is one row in `payment_moves`, so refunds stay simple.
3. **The sender types one email.** No free-text note (spam and contact risk). The sender confirms "I know this person (parent, guardian, coach or teammate)" (lawyer, §11b item 9). Then: "Send 7 rounds to ma***@example.com?"
4. **The rounds are held.** They leave the sender's balance at once and wait. They cannot be spent while they wait.
5. **The recipient gets one email,** the same words whether or not the email has an account: "[masked sender email] sent you 7 Tabula rounds. Open Tabula to accept them. The offer ends on [date]." The link opens the setup page (BUY-FIRST §4.5): sign in or sign up, then the date-of-birth step, then the accept screen.
6. **The accept screen** (the consent double check):
   - "Accept 7 rounds from ma***@example.com?" Buttons: **Accept** and **Decline**.
   - If this account is managed and its rounds would pause: one more line, "Your school manages AI on this account, so these rounds will be paused here." The recipient can decline, and the rounds go back. This is the one place before acceptance where a pause is named (see §6.3 on the no-taunt rule).
   - Accept needs the signed-in account whose email matches the typed email. A forwarded link alone is not enough for an existing account.
7. **On accept:** the move runs as BUY-FIRST §4.5 step 4 (reserve, take from the holder, grant to the recipient, one idempotent ledger ref, one `payment_moves` row).
8. **Decline, or 14 days with no answer:** the rounds go back to the sender. The sender gets an email.
9. **Under 13 at the date-of-birth step:** BUY-FIRST §7 applies. Nothing moves. The rounds go back.

### 5.2 Change to the owner's idea: never say whether an email has an account

The owner's idea says "if it is a valid account, the recipient gets a gift to accept". If the screen tells the sender "this email has no account", anyone can test emails to learn who uses Tabula, including which teens do. So:

- The sender always sees: "Sent. They have 14 days to accept."
- An email with no account gets the same message and can sign up from it.
- The consent double check is still there: nothing moves until the recipient accepts while signed in.

Decision D7.

### 5.3 Limits

- A purchase can be **sent at most twice** in its life: the first send, and one re-send after it comes back (§6.2). Then the rounds stay where they are.
- Caps (from BUY-FIRST §4.3, kept): 3 send attempts per purchase, 3 per recipient address per day. New: an account can **accept** sends from at most 3 different senders per 30 days.
- A Weekend Pass (or Camp Pass) whose days have started cannot be sent. Its window is running.
- A subscription is not sent as a whole. BUY-FIRST's renewal auto-move applies (§6.5 adds a pause rule).

---

## 6. When rounds pause: the cure paths

### 6.1 What happens at the moment of a pause

A pause starts when a managed teen's resolved features no longer include any AI feature their own rounds can pay for. That happens when the teen joins a Flow-only program, or the admin switches students to Flow only, or (until §4.2 ships) the teen joins any program.

**Where the server detects it.** `resolve` is a pure function per request, so it cannot stamp a pause. Two event hooks do it instead:

1. **On join** (`src/students.ts`, after `joinAge` makes a managed membership): resolve the teen's features once. If none can use their own rounds and the teen holds rounds, start the pause.
2. **On a policy change** (the settings write that changes `ai.mode` or `ai.features` for students): for each managed student who holds sent rounds, do the same check. The policy write already logs to `policy_events` (AI-POLICY §6e); the check runs after it, in `waitUntil`, and again in the daily `scheduled` job as a backstop.

The reverse (AI comes back on, or the teen leaves) clears the pause the same way. A pause is per account, not per program: with two programs, the strictest wins (§4.3).

The server:

1. Stamps the pause start on each affected purchase the teen holds (`paused_at` on the `payment_moves` row, or on the lot).
2. Emails **the buyer** (when the buyer is another account): "The rounds you sent can't be used on that account right now. You can take them back, send them to someone else, or ask for a refund until [date]." [date] is the pause start plus 7 days. The email does **not** mention a school at all (lawyer, §11b item 7).
3. Stops any renewal auto-move to that teen (§6.5).

Nothing is removed. Expiry dates keep running (decision D8).

### 6.2 Who cures, and how (changes idea 5)

The owner's idea lets the holder send to "a judge they know". This doc puts the buyer in charge:

- **The teen holder** sees one action: **"Give back to [masked buyer email]"**. One tap, with a confirm. The rounds go back to the buyer at once (no accept step: they are the buyer's own purchase).
- **The buyer** sees the paused purchase in their account with three actions:
  - **Take back.** Same as the teen's "give back", started by the buyer. The teen gets a short notice.
  - **Send to someone else.** The §5 flow. This uses the purchase's second and last send. A parent who judges can send to themselves by "Take back" and use the rounds.
  - **Refund** (only inside the §7 window).

Why the buyer, not the teen: the buyer paid and holds the card (BUY-FIRST rule 7). A minor who sends value to adults is a resale and contact risk. A minor can also undo a contract; an adult buyer making the choice is cleaner (§11 item 5).

Decision D4.

### 6.3 What the teen sees while paused

AI-POLICY's no-taunt rules (§3b R3) forbid words about removed features in the app. So:

- **Round screens:** nothing. No pill, no lock, no "paused" banner. The app looks Flow only, as today.
- **The rounds-left pill** (AI-ROUND-CONSENT §3) does not show while every AI feature is off.
- **Settings → Account** (R6 already allows "Managed by {program}" there): one card, "Your rounds: 7. They are paused while {program} manages AI on this account. They keep their dates." One button: "Give back to ma***@example.com". No feature names.
- **The accept screen** (§5.1 step 6): one line before acceptance.

These are two new allowed notices. AI-POLICY R6 must list them (§10.3).

### 6.4 No move into a school pool

The owner suggested the school pool as a cure. This doc says no, for now:

- Pool and personal lots never mix (MODEL §4). Pool rounds are sold by Pattern Engine LLC by invoice and expire July 31. Personal rounds are sold through Link and expire on their own schedule.
- A later refund or dispute of the Link payment would need to take rounds out of a school's pool.
- A school would hold value that a family paid for. That needs its own school terms.
- Pools do not exist before summer 2027.

The buyer can still send the rounds to a coach or judge account in that program. That person then uses them as their own.

Decision D5.

### 6.5 Subscriptions

- While the recipient is paused, renewal rounds **stay with the buyer** (BUY-FIRST already stops auto-move for deleted or under-13 accounts; add "paused").
- Before the next renewal, the buyer gets one extra email: "Your plan renews on [date]. Rounds sent to ma***@example.com are paused. Cancel, or keep it and use the rounds yourself." Renewal reminders in Terms §8 still go as today.

---

## 7. The pause refund (idea 5)

### 7.1 The rule

- **Who:** the buyer only. The money goes back to the card that paid.
- **When:** within **7 days after the pause starts** for that purchase (decision D6). The buyer email in §6.1 states the last day.
- **What:** the unused rounds of that purchase, pro rata to the price paid. Rounds already used are not refunded.
- **Condition:** the rounds were paused by a program's AI setting on the holder's account. Not for a buyer who simply changed their mind.
- **How often:** once per purchase.
- **How:** through Link, by the Refund API (BUY-FIRST §13 "check during the build: Managed Payments allows refunds by API"). The take-back follows §8.
- **After 7 days:** no pause refund. The rounds stay credited. The cure paths in §6.2 stay open until the rounds expire.

### 7.2 Why from the pause start, not from the purchase

A family can buy in September and the teen can join a school in January. A window from the purchase date would be closed long before the problem appears. The owner's goal is "fair time to cure", so the clock starts when the problem starts.

### 7.3 What this does not change

- Link's own refund rules stay (legal update 5 Part A). Link may refund other cases within 60 days. The automatic Link setting is unchanged.
- The Part B refund cases (under 13, no permission, a minor bought) are unchanged.
- No general "unused rounds" refund window is added. Fix STRIPE.md's stale "14 days" line to point to the Refund Policy.

---

## 8. Refunds and disputes after a send

The buy-first spec §11 covers a refund after the first send. These rules cover holds, re-sends and the code gaps in §2.6.

| Case | Rule |
|---|---|
| Refund (any kind) while a send is waiting | The waiting send is cancelled. The take-back runs on the buyer as today. |
| Refund after a send | Take back the purchase's unused rounds from the **current holder** named by the latest `payment_moves` row. Rounds already used are not taken back. |
| The shortfall | When the holder is not the buyer, **any shortfall is taken only from the buyer's other rounds, never from the holder's own purchases.** Today `applyTakeBack` takes the shortfall from the same user's other lots. This must change for moved purchases. |
| Dispute | The hold (if the lawyer keeps it; Part A drops the account suspension) goes on the buyer only. The holder's unused rounds from that purchase are held back while it is open. |
| Legal text | Legal update 5 Part B says the take-back "includes Rounds that you sent to another person, and Rounds that another person sent to you" (lawyer, §11b item 6). This table is the code side of that sentence. |
| Dispute won | Held rounds go back to the account that held them (the holder), not to the buyer. Today `applyRestore` returns them to the original user. Fix with `payment_moves`. |
| Re-send after a take-back | Not allowed for that purchase once a refund or dispute has started. |
| The holder's account is deleted | Unused rounds go back to the buyer (BUY-FIRST §11). |
| The holder is notified | Plain words, no blame: "7 rounds from ma***@example.com were taken back because the purchase was refunded." |

**Code: a two-step take-back across two meters.** Today `applyTakeBack` and `applyRestore` work on one user's ledger and lots (`user-do.ts:910-998`), and the webhook reads `payments.owner_id AS user_id` (`webhook.ts:222, 260`). After a move:

1. The webhook reads the latest `payment_moves` row for the payment. It gives the holder and the **holder's lot id** (a move grants a new lot on the holder, so `payments.ledger_ref` names the buyer's old lot, not the holder's).
2. **Step 1, holder's meter:** take back from that lot only, with no shortfall from other lots. Ref: `takeback:<paymentKey>:<event>:holder`. It returns how much it took.
3. **Step 2, buyer's meter:** take the shortfall (target minus step 1) from the buyer's other lots, as today. Ref: `takeback:<paymentKey>:<event>:buyer`.
4. Both refs share the payment key and event, so a retried webhook repeats neither step (the ledger's UNIQUE(kind, ref)). If step 2 fails, the webhook returns an error and Stripe retries; step 1 is already done and is skipped by its ref.
5. `applyRestore` after a won dispute reverses each step on the meter that did it, using the same two refs.

`payments.owner_id` stays the buyer.

---

## 9. Safety and law

### 9.1 Under 13: no

- No account, no rounds, no send to an under-13 person. BUY-FIRST §7 handles a send that reaches a person who gives an under-13 date (two confirmations, 7-day hold, rounds back to the buyer, refund if asked).
- COPPA covers under 13 only. We do not knowingly collect a child's data, except the minimal 7-day hold record (Part B Privacy §12).

### 9.2 Ages 13 to 17: parent consent

- COPPA does not apply at 13 to 17. Some state laws do (for example Arkansas Act 952, Texas SCOPE Act, California age-appropriate design rules). `age.ts` has one switch per state (`parentConsentForHostedAI`). None is on.
- A send from an adult to a teen is a natural place to record consent. Proposal: when an adult sends to an account that turns out to be a teen, the accept step asks **the sender** (by email) one question: "Are you this person's parent or guardian, and do you agree that they may use Tabula's Hosted AI?" A yes is stored as a consent record (date, notice version, the two account IDs).
- **Lawyer (§11b item 2):** the record counts as parent consent (a card payment plus a statement) and is relied on where a state needs it. The per-state switch stays off today.

### 9.3 Abuse risks and controls

| Risk | Control |
|---|---|
| **Card testing** (stolen cards used to test small charges) | Unchanged from BUY-FIRST: Radar, Turnstile, per-IP cap, 5 purchase emails per buyer email per day. New: if Radar marks the charge "elevated", the purchase cannot be sent for 72 hours. |
| **Stolen card, send, use, then chargeback** | Rounds used before the dispute are lost (a small cost). Unused rounds are held back from the holder (§8). The 3-senders-per-30-days cap limits a "collector" account. |
| **Send, then refund** (automatic Link refunds make this easy) | Unused rounds are taken back from the holder. The existing repeat-refund review flag (Part A §A.4 item 4) also counts refunds of sent purchases. |
| **Reselling** (buy packs, send for cash) | One purchase per send; at most two sends per purchase; only the buyer sends; Terms §13 still forbids resale. Support can void a send. |
| **Adults sending rounds to minors they do not know** (contact risk) | No free-text note. The sender is shown only as a masked email. The teen can decline, and can **block a sender** (future sends from that account to this account stop silently). Teens cannot send to anyone (only give back to the buyer). The 3-senders cap. |
| **Account testing** (learn who has an account) | Same message for every email (§5.2). |
| **A teen escapes the school setting by sending to a second account** | Teens cannot send. A second account made by the teen gets a teen date of birth (or lies). The program policy follows the account, not the person (AI-POLICY §6d, honest limit). |
| **Expiry laundering** (send back and forth to reset dates) | Only the first send restarts the 12 months (Part B §6.6). The re-send keeps the dates. At most two sends. |

### 9.4 Expiry of sent rounds

**Update, 2026-11-23:** paid Rounds now never expire (legal update 6, draft 4; lawyer §11b item 3). So the expiry rules below no longer apply to one-time Rounds, and D8 is moot for them. They apply only to any Rounds that still have an end date under legal update 6 (check that draft). The rule "only the first send restarts the dates" stays for those.- **First send:** the 12 months restart on the accept day (Part B §6.6, owner O2).
- **Give back, take back, re-send:** dates do **not** restart.
- **While waiting for accept:** dates keep running. If the rounds would expire during the 14 days, the offer ends early on the expiry day.
- **While paused:** dates keep running (decision D8).
- **Lawyer:** see §11 item 3 (gift certificate laws).

---

## 10. What must change

### 10.1 tabula-cloud (later build, not now)

- Student `self` mode and the new wallet order (§4.2). Strictest-policy pick for a teen in two programs (§4.3).
- Sends: held state, accept and decline, 14-day lapse, caps, block a sender, give back, take back, the two-send limit. Use BUY-FIRST's `purchase_setups` and `payment_moves`; add `paused_at`, `send_count`, and a `sender_blocks` table.
- Pause detection on policy change and on join, with the buyer email (outbox, BUY-FIRST §4.2 step 5).
- Pause refund route (buyer only, window check, once per purchase) through the Link Refund API.
- `applyTakeBack` and `applyRestore` follow `payment_moves`; shortfall only from the buyer (§8).
- The consent record (§9.2), behind the lawyer's answer.

### 10.2 App and sites

- Settings → Account rounds card for managed teens (§6.3). The accept screen. The buyer's "your purchases" list with Take back, Send, Refund.
- The admin AI setting: the third student choice, "AI clerk, family rounds".
- The pricing page: any parent or student wording waits for D1 to D3. Suggested line once decided: "Buying for a teen? They can use the rounds on their own. If their school turns AI off, the rounds wait, and you can take them back."

### 10.3 Design docs (one line each)

- `docs/design/AI-POLICY.md` §2c: a teen may also have a solo account (Terms §3). R6: add the two allowed notices in §6.3.
- tabula-cloud `docs/platform/MODEL.md` §5 and §7: student `self` mode; "a teen account is managed by a program, or is solo"; "a teen never buys" stays.
- `docs/design/BUY-FIRST-SPEC.md` §4.3 and §11: point to this doc for later sends, pause, and refunds after a re-send.
- tabula-cloud `docs/STRIPE.md` item 5: remove "14 days"; point to the Refund Policy.
- `BUSINESS-PLAN.md` (private) Q7 and row 6: replaced by D1 (owner, 2026-11-23). Edit the private file only if the owner asks.

### 10.4 Legal text (draft later, as legal update 7; none written here)

| Where | Change |
|---|---|
| Terms §6 (new 6.10, "Rounds and school Programs") | A Program may turn off Hosted AI for a student. Rounds on that Account are paused, not removed, and keep their expiry dates. They work again when the Program allows AI, or the student leaves. |
| Terms §6.6 | Only the first send restarts the 12 months. A returned or re-sent purchase keeps its dates. |
| Terms §6.7 and §13 (Part B's exception) | Widen "send a purchase to one other person" to: the buyer may send a purchase, take it back, and send it once more. The person who receives it may give it back to the buyer. No other transfer. |
| Terms §8 / Refund Policy §6 | New case: the pause refund (§7.1), with its 7-day window from the pause start. |
| Refund Policy §4 | Same transfer exception as §6.7. |
| Terms §8 "Disputes" / Refund Policy §8 | A refund or dispute of a sent purchase takes back that purchase's unused rounds from whoever holds them; any shortfall comes only from the buyer. Legal update 5 Part B adds (lawyer, §11b item 6): "This includes Rounds that you sent to another person, and Rounds that another person sent to you." |
| Privacy Policy §3 | The recipient's email is used to send the offer, and kept with the move record (it is needed for refunds). This changes Part B's "we do not keep it". |
| Privacy Policy §12 | The pause email to the buyer; the consent record (if the lawyer agrees). |
| School terms / DPA | The school does not see family purchases. A family's rounds pause under the school's setting; the school cannot take or use them. |

---

## 11. For the lawyer

1. **Teens and Hosted AI with no program.** Terms §3 and the code allow it now. Which states need a parent's consent, an age-appropriate design assessment, or other steps (Arkansas, Texas SCOPE, California, Utah, others)? Is the per-state switch enough?
2. **The sender's yes as parent consent** (§9.2). Does it count where a state needs consent? What must the notice say?
3. **Gift certificate laws.** California Civ. Code §1749.5 and Washington ban expiry on sold gift certificates; *Hollis v. Audible* (W.D. Wash. 2025) let a claim go on for expiring membership credits. A feature that lets a buyer send rounds to another person may look more like a gift certificate. Is "send rounds" (not "gift") with 12-month expiry safe? Does California's cash-out for small balances apply (our research note of 2026-11-20 says under $15 since 2026-04-01; confirm the number)? Sources for this item: the owner's private research note `gift-card-law-research.md` and tabula-cloud `docs/BILLING-LEGAL.md`.
4. **Link as merchant of record.** May we promise the pause refund in our Refund Policy when Link is the seller? Must Link agree to the rule?
5. **Minors.** A teen recipient did not contract; the adult buyer did. Is "only the buyer can move or refund" the right line? Can a teen disaffirm anything here?
6. **Taking rounds back from a recipient** after the buyer's refund or chargeback. Is the notice in §8 enough?
7. **The pause email to the buyer.** It tells the buyer that a school manages AI on the teen's account (not which school). Is that a disclosure problem under FERPA or state student-privacy laws, given that the program is a school?
8. **Texas SCOPE.** "May not allow the known minor to make purchases" (quoted from the age-check memo of 2026-11-22; unverified here). Accepting a sent purchase is not a purchase. Confirm.
9. **Unrelated adults sending to minors.** Are the controls in §9.3 enough?

---

### 11b. Lawyer answers (2026-11-23)

The owner sent the legal session's 9 working answers (`private/legal/TEEN-ROUNDS-LAWYER-NOTES.md`). The owner reports that the lawyer agrees with all 9. In short:

1. Teens 13 to 17 may use Hosted AI with no program. The per-state consent switch stays off. Arkansas: the teen's own consent at sign-up is enough. Texas SCOPE does not apply.
2. The sender's yes is stored as parent consent and relied on where a state needs it (a card payment plus a statement).
3. Gift-card laws: "send", never "gift". Paid Rounds never expire (legal update 6 draft 4), so §9.4 no longer applies to one-time Rounds.
4. The pause refund is promised as "we refund through Link" and issued with Stripe's refund tool.
5. Only the adult buyer can move, take back or refund a purchase. If a teen cancels their own agreement, the account closes and unused Rounds go back to the buyer.
6. **Change:** legal update 5 Part B adds: "This includes Rounds that you sent to another person, and Rounds that another person sent to you." (refund and dispute take-back).
7. **Change:** the pause email to the buyer does not mention a school at all: "The rounds you sent can't be used on that account right now. You can take them back, send them to someone else, or ask for a refund until [date]." (§6.1 item 2.)
8. Texas SCOPE does not apply (no profiles, posts or chat).
9. **Change:** the sender confirms "I know this person (parent, guardian, coach or teammate)" before a send (§5.1 step 3).

## 12. Owner decisions

**All 8 DECIDED, 2026-11-23: option A for each.** Owner's words: "Yes, all 8" (typed in the cloud-setup chat, relayed to this session by the cloud-setup session). Option B stays below as the record of what was not chosen.

**D1. Can a teen (13 to 17) with no school program use Hosted AI now?** **DECIDED 2026-11-23: A.**
- **A (chosen): Yes.** This is the live Terms §3 and the code today, and your idea 1. Mark business plan Q7 as replaced. The lawyer checks the state list (§11 item 1).
- B: No. Wait until Programs (summer 2027), as Q7 says. Then the Terms and the code must change back.

**D2. A school allows AI. Can the teen use family-bought rounds?** **DECIDED 2026-11-23: A.**
- **A (chosen): Yes. Add a third student choice, "AI clerk, family rounds".** It works before school pools exist. Code change in §4.2.
- B: No. Keep the code: students use only the school pool. Family rounds pause in every program until pools exist.

**D3. Which setting wins for a teen in a school?** **DECIDED 2026-11-23: A.**
- **A (chosen): The school wins on every round, home practice too.** This is the code and AI-POLICY today, and your idea 3.
- B: The school wins only in rounds for that school. The teen's own rounds work in their own practice.

**D4. Who can move paused rounds?** **DECIDED 2026-11-23: A.**
- **A (chosen): Only the buyer.** The teen can give them back to the buyer in one tap. The buyer can take back, send once more, or ask for a refund.
- B: The teen can send them straight to anyone, for example a judge they know (your idea 5 as written).

**D5. Can paused rounds move into the school's pool?** **DECIDED 2026-11-23: A.**
- **A (chosen): No. They stay personal.** The buyer can send them to a coach or judge in that school instead.
- B: Yes, after pools exist in 2027. Needs school terms and refund rules for pool rounds bought through Link.

**D6. When does the 7-day pause refund window start?** **DECIDED 2026-11-23: A.**
- **A (chosen): On the day the rounds pause.** The buyer gets an email with the last day.
- B: On the purchase day. Simpler, but it is usually closed before a teen joins a school.

**D7. Should the sender learn whether the email has an account?** **DECIDED 2026-11-23: A.**
- **A (chosen): No. Same message every time.** Nothing moves until the person accepts. This stops strangers from testing which teens use Tabula.
- B: Yes, as your idea 4 says ("if it is a valid account").

**D8. Do expiry dates stop while rounds are paused?** **DECIDED 2026-11-23: A.**
- **A (chosen): No. Dates keep running.** The 7-day refund and the take-back cover the gap. It matches Terms §6.6.
- B: Yes. The clock stops while paused. Fairer to the family, but it needs new Terms text and makes the balance last longer on our books.

---

## 13. Build order (after the decisions, 2026-11-23)

No code or deploy is part of this doc. Each step below is a later task. "Lawyer" means: wait for that §11 item before the step goes live. A step can be built and tested on staging before the lawyer answers. Only going live waits.

**Depends on:** the buy-first flow (`BUY-FIRST-SPEC.md`) adds `purchase_setups` and `payment_moves`. Steps S3 to S6 build on those tables, so they come after buy-first, or in the same build.

### Server (tabula-cloud)

| Step | What | Waits for |
|---|---|---|
| S1 | Student "family rounds" mode (D2): `settings.ts` `modesFor`, `resolve.ts`, `limits.ts` `walletOrder`. Strictest policy for a teen in two programs (D3). Tests for each role and mode. | Nothing. It does not change who can buy. |
| S2 | Pause detection hooks: on join and on a student policy change, plus the daily backstop (§6.1). `paused_at` on the purchase. | S1. |
| S3 | Take-back and restore follow the holder (§8): the two-step saga with shared refs. | Buy-first `payment_moves`. Build this before any later send goes live. |
| S4 | Later sends (§5): held state, accept or decline, 14-day lapse, same message for every email (D7), give back and take back (D4), re-send once, the "I know this person" confirm, and the consent record (§9.2). | S3. Lawyer answered (§11b); goes live with its legal text. |
| S5 | Buyer emails: pause notice (§6.1), renewal notice while paused (§6.5). Stop renewal auto-move while paused. | S2. Lawyer item 7 (the pause email). |
| S6 | Pause refund route (§7, D6): buyer only, 7 days from the pause start, once per purchase, unused share pro rata, through the Link Refund API. | S2, S3. Lawyer item 4. Check that Managed Payments allows refunds by API. |
| S7 | Optional items from §5.0b (caps, Radar hold, sender block) only if abuse shows up. | Nothing. |

### App

| Step | What | Waits for |
|---|---|---|
| A1 | Admin AI setting: the third student choice "AI clerk, family rounds". | S1. |
| A2 | Managed teen while paused: no pill, no notice in round screens; one Settings → Account card with "Give back" (§6.3). | S2, S4. |
| A3 | Accept screen with the one pause line (§5.1 step 6). Buyer's purchase list with Take back, Send, Refund. | S4, S6. |

### Sites (tabula-sites)

| Step | What | Waits for |
|---|---|---|
| W1 | Pricing page parent and student wording (§10.2). D1 to D3 are now decided, so the wording can be drafted now. | Publish with A1, or say only what is live. |
| W2 | Help page: "Buying for a teen", "If a school turns AI off", "Sending rounds". | S4 to S6 live. |

### Legal text (legal update 7, drafted by the legal-text session)

| Step | What | Waits for |
|---|---|---|
| L1 | Draft the text in §10.4: Terms 6.6, 6.7, new 6.10, §8, §13; Refund Policy §4, §6, §8; Privacy §3, §12; school terms note. | Can be drafted now. It must merge with legal update 5 Part B, which is not live yet. |
| L2 | Send the §11 list and the L1 draft to the lawyer. | L1. |
| L3 | Publish on the same day as the matching server step: 6.10 with S2, transfers with S4, the pause refund with S6. The owner says yes in the marketing chat. | Lawyer answers. Legal update 5 Part B live. |

### Doc fixes (any time)

- AI-POLICY §2c and R6, MODEL §5 and §7, BUY-FIRST §4.3 and §11 pointers, STRIPE.md item 5 (§10.3). These are one-line edits in other files. Each one needs its owner session's yes.
