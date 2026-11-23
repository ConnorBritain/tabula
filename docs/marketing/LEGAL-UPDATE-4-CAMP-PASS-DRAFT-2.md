# Legal update 4, draft 2: Camp Pass with a Start button and a half-keep rule

2026-11-23. Draft for the owner and the lawyer. Not live.

This draft **replaces** `LEGAL-UPDATE-4-CAMP-PASS-FINAL.md`. That text was lawyer-approved on 2026-11-22. The owner changed the Camp Pass rules on 2026-11-23, so the lawyer must approve this text again.

Source of the rules: the owner's decisions in the pricing chat, 2026-11-23. The full spec is private (`private/pricing/CAMP-PASS-SPEC.md`, §12 and §13 win over older lines).

## The rules, in short

- The Camp Pass is a one-time purchase of a set number of Rounds for summer camp.
- **Sale period:** May 1 to July 15 each year, Pacific time. The Plans page shows the dates. The Terms do not name them (the approved choice from draft 1).
- **Start:** Camp Pass Rounds are not used until the user taps "Start my Camp Pass". Using a Round does not start the pass.
- **Camp period:** it starts when the user starts the pass. It ends 30 days later, or at 11:59 p.m. Pacific time on August 15, whichever comes first.
- **Spend order:** after the start, Camp Pass Rounds are used first. Before the start, they are not used at all.
- **Half-keep rule (owner):** when the camp period ends, half of the unused Camp Pass Rounds, rounded down, stay in the balance. 20 unused → 10 kept. 19 unused → 9 kept. The rest expire.
- **A pass never started:** its camp period ends on August 15. The same half-keep rule applies.
- **Kept Rounds** become Round Pack Rounds. They expire 12 months after the day they are added. Normal expiry reminders apply (update 6).
- **No cash refunds** for unused Camp Pass Rounds, started or not, except where the law requires one or Link gives one under its own rules.
- **Reminders:** a started pass: about 7 days before the end and on the last day. A pass not started: on August 8 and August 15.

## Publish gate

1. **Update 6 (Weekend Pass 12 months) is live first, including its reminder texts T4, R4 and P1.** This draft uses update 6's text as its "Before". T4b and R5 add to update 6's reminder text, and the Privacy Policy relies on update 6 P1. If update 6 went live without its reminder texts, these must go live first or in the same release. If update 4 must ship first, write a new variant.
2. The lawyer approves this text, including the questions at the end.
3. The server sells the Camp Pass and applies every rule above: the Start step, the camp period, the spend order, the half-keep step, refunds and disputes after the half-keep step (see T5), the reminders and the send records (update 6, gate item 5).
4. The owner types yes in the marketing chat.
5. The Terms, the Refund Policy and the Plans page go live on the same day, or the Plans page later. The build check keeps the Camp Pass card off the Plans page until `terms.html` contains "Camp Pass".
6. The card, the Start confirm step, the checkout page, the receipt and the emails all state the start rule and the half-keep rule, with the same rule as T2, in the spec §12 words ("saved rounds" is fine on the card). Never use the words "value" or "gift".

Use the publish date in the Terms and Refund Policy headers.

## Terms of Service (`sites/speech/pages/terms.html`)

**T1. §2, "Paid Plan" (replace)**
- Before: ""Paid Plan" means a Single Round, a Round Pack, a Weekend Pass, a Subscription or a Program, as described in Section 6."
- After: ""Paid Plan" means a Single Round, a Round Pack, a Weekend Pass, a Camp Pass, a Subscription or a Program, as described in Section 6."

**T2. §6.1, new item after the Weekend Pass item**
- Add: "**Camp Pass.** A one-time purchase of a set number of Rounds for summer camp. We sell the Camp Pass only in a summer sale period each year. The Plans page shows the dates. We do not use Camp Pass Rounds until you start the pass in your Account. Your camp period starts when you start the pass. It ends 30 days later, or at 11:59 p.m. Pacific time on August 15, whichever comes first. If you do not start the pass, the camp period ends at 11:59 p.m. Pacific time on August 15. When the camp period ends, we keep half of your unused Camp Pass Rounds, rounded down, as Round Pack Rounds. For example, if 19 Camp Pass Rounds are unused, we keep 9. The other unused Camp Pass Rounds expire. Rounds that we keep count as Rounds from your Camp Pass payment (see Section 8). A Camp Pass does not renew."

**T3. §6.5, first sentence (replace; update 6 text)**
- Before: "We use your Rounds in this order: first Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds."
- After: "We use your Rounds in this order: first Rounds from a Camp Pass that you have started, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds. We do not use Rounds from a Camp Pass that you have not started."
- Keep the rest of §6.5.

**T4. §6.6, new list item after the Single Round, Round Pack and Weekend Pass item**
- Add: "Camp Pass Rounds expire when the camp period ends (see 6.1), except the Rounds that we keep. Rounds that we keep expire 12 months after the camp period ends, not 12 months after the date of purchase."

**T4b. §6.6, reminder paragraph (update 6 T4; add one sentence)**
- Add after update 6's reminder paragraph: "For a Camp Pass, we try to email the address on your Account about 7 days before the camp period ends and on its last day. For a Camp Pass that you have not started, we try to email on August 8 and August 15. If a send fails, we try again. If an email does not reach you, the end of the camp period does not change."

**T5. §8 "Disputes and chargebacks" (no text change)**
- The live text says "first from that payment's unused Rounds". T2's last sentence makes kept Rounds part of "that payment's" Rounds. So a refund or dispute after the half-keep step takes back kept Rounds first. The server must do the same (spec §13).

Note for the server (spec §13): a full refund takes back Rounds "in proportion", first from that payment's unused Rounds (including kept Rounds), then from the user's other unused Rounds. The server must continue into the other Rounds, as the live text says.

**T6. §8 "In short", "Automatic renewal", "No refunds" and §13 (as approved in draft 1)**
- "Single Rounds, Round Packs and Weekend Passes never renew." → "Single Rounds, Round Packs, Weekend Passes and Camp Passes never renew."
- "Single Rounds, Round Packs and Weekend Passes are one-time purchases. They never renew." → "Single Rounds, Round Packs, Weekend Passes and Camp Passes are one-time purchases. They never renew."
- "This includes Single Rounds, Round Packs, Weekend Passes, Subscriptions, renewals, unused Rounds and partial billing periods." → "This includes Single Rounds, Round Packs, Weekend Passes, Camp Passes, Subscriptions, renewals, unused Rounds and partial billing periods."
- "resell, share, transfer or trade Rounds, Weekend Passes, Subscriptions or Accounts;" → "resell, share, transfer or trade Rounds, Weekend Passes, Camp Passes, Subscriptions or Accounts;" (If update 5 Part B is live first, keep its "except that a buyer may send a purchase …" ending.)

**"Except where the law requires."** The live "No refunds" paragraph already says "The exceptions are where the law requires a refund and where Link gives one under its own rules." §6.7 already says "except where the law requires otherwise". No new text is needed. The Camp Pass falls under both.

## Refund Policy (`sites/speech/pages/refunds.html`)

**R1. §1, new list item after "Single Rounds, Round Packs and Weekend Passes;" (update 6 text)**
- Add: "Camp Passes, including Camp Pass Rounds that expire when the camp period ends;"

**R2. §3 (replace)**
- Before: "Single Rounds, Round Packs and Weekend Passes never renew, so there is nothing to cancel."
- After: "Single Rounds, Round Packs, Weekend Passes and Camp Passes never renew, so there is nothing to cancel."

**R3. §4 "Expiry", add after the 12-month sentence (update 6 text)**
- Add: "Camp Pass Rounds are not used until you start the pass. The camp period ends 30 days after you start it, or on August 15, whichever comes first. If you do not start it, the camp period ends on August 15. Then we keep half of the unused Camp Pass Rounds, rounded down, as Round Pack Rounds for 12 months. The rest expire."

**R4. §4 "Order" (replace; update 6 text)**
- Before: "We use Subscription Rounds first, then Single Round, Round Pack and Weekend Pass Rounds."
- After: "We use Rounds from a started Camp Pass first, then Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds. We do not use Rounds from a Camp Pass until you start it."

**R5. §5 "Reminders" (update 6 R4; add one sentence)**
- Add: "For a Camp Pass, we try to email you about 7 days before the camp period ends and on its last day, or on August 8 and August 15 if you have not started it."

## Privacy Policy

No change. Update 6 P1 ("reminders before your Rounds expire") covers the Camp Pass reminders. Draft 1's line "The Privacy Policy does not change" was true only before update 6.

## Plans page and other copy (marketing)

- The card says: "Not used until you tap Start. After start: 30 days or Aug 15, whichever comes first. When your camp period ends, we keep half your unused camp rounds, rounded down, as saved rounds for 12 months. 19 left → 9 kept." (spec §12).
- "Saved rounds" on the card means Round Pack Rounds in the Terms. This is fine, because the card and the Terms give the same rule.
- Remove "from your first round" from the card (plans.html:111).

## Settled by the legal session (2026-11-23)

- **Seller wording.** Update 5 Part A is live: Paid Plans bought online are sold through Link, and Programs are sold by Pattern Engine LLC by invoice. `LEGAL-FACTS.md` line 13 was out of date. It now says the same as the live Terms. New Camp Pass text uses the Link wording.
- **Who gets the reminders.** The Account that holds the Rounds gets them, and no one else. Before a buy-first purchase is set up, that Account is the buyer's checkout email. After the purchase is sent to another person, that person gets the reminders. This matches update 6 L3 (no copy to a parent).

## Other drafts to change

- **Update 5 Part B** §6.6 setup item (line 281): "A Weekend Pass or Camp Pass keeps its own rule: its days start when its first Round is committed." → "A Camp Pass keeps its own rule: see Section 6.1." (Update 6 already drops the Weekend Pass part.) Same change in `docs/design/BUY-FIRST-SPEC.md` step 4.
- **Update 6 draft**: its "If update 4 (Camp Pass) is live first" section and the Camp Pass texts in its "Other drafts" section use the old start rule. This draft replaces both.
- **`LEGAL-UPDATE-4-CAMP-PASS-FINAL.md`:** marked as replaced by this draft.

## Questions for the lawyer

- **C1. Half-keep for a pass never started.** Your approved text (draft 1) let a pass never started keep all its Rounds for 12 months. The new rule keeps half on August 15. A buyer who never starts the pass loses half of the Rounds. Is this lawful under state gift certificate and prepaid laws (Cal. Civ. Code 1749.5, Washington), the CARD Act, and "paid amount never expires" cases (Groupon-style)? The private brief has the price argument. Fallback: a pass never started keeps all its Rounds (1 to 1) as Round Pack Rounds.
- **C2. August 15 in the Terms.** The end date is a core rule, so T2 names it. The sale dates stay on the Plans page. Is that right?
- **C3. A started pass.** No pro-rata refund for unused Rounds of a started pass. The half-keep rule applies instead. Is a refund ever required?
- **C4. Reminders.** Do these emails count as service (transactional) mail? They have no buy link and no sales content.
- **C5. Link.** Link is the merchant of record. Does the half-keep rule, or the no-refund rule, need Link's agreement?
- **C6. A short camp period.** A pass started on July 17 or later has fewer than 30 days, because the period always ends on August 15. Does the Plans page need to say this before purchase, or is the rule on the card enough?
