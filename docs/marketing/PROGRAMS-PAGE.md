# Programs page: spec (draft 1)

Status: draft 3c, 2026-11-20. The owner chose Option A (weekends and rounds). Not built. Draft 3 sizes team AI in tournament weekends and adds invited judges. The weekend-sized team pool applies only under Option A. The invited-judge weekend by card (FAQ "Can our team pay for a judge's weekend?") applies under both options. Owner review needed.

**Launch gate:** do not publish any "about N rounds" or "rounds per weekend" number until the hosted round cost has been measured. Until then the page shows the plan, the size and the weekends, and says "Rounds per weekend: shown at launch".

This is the public spec for the school and team sales page on tabulaspeech.com (path `/programs`). It has the layout, the configurator, the FAQ, and the buying flows.

**No prices, costs or margins are in this file.** Prices appear as `{{placeholders}}`, in the same style as the live Plans page. The price list, the formula numbers and the reasons behind them are in the private pricing notes. The page gets its numbers from the server price route (§4d), so the page and the invoice always agree.

Rules this page follows:
- Plain words. One idea per sentence. Every price is a full year price, before tax.
- No dark patterns: no fake timers, no "only 3 left", no pre-ticked extras, no hidden fees (`docs/marketing/ANTI-PATTERNS.md`).
- The same words as the app: "rounds", not "credits"; "AI clerk" for students; "Flow only" when AI is off (`docs/design/AI-POLICY.md` §2).
- Students never get judging tools for their own rounds (`docs/STUDENT-EDITION.md`). The page never suggests they do.

## 1. Who reads this page

| Reader | What they need | Where the page answers |
|---|---|---|
| Head coach | "What does my team get, and what will it cost?" | Hero, configurator, plan cards |
| Assistant coach or parent judge | "Do I get AI? Do I need to pay?" | "Who gets what" table, FAQ |
| Booster club or parent | "How can we help pay?" | "Ways to pay", booster link |
| Principal, activities director, bookkeeper | "Is it a fair price? Can we use a PO? Is student data safe?" | Paperwork box, FAQ, Trust link |
| District IT or privacy officer | "Do you sign our DPA? Where is data stored?" | Privacy box, FAQ, Trust page |

## 2. Page layout (top to bottom)

1. **Hero.**
   - Title: "Tabula for your whole team."
   - Line: "Coaches, students and judges on one plan. Flow, clocks and ballots always work. Add hosted AI when you want it."
   - Two buttons: **Build your price** (scrolls to §2.3) and **Get a quote (PDF)** (opens the quote form with defaults).
   - Small line: "The AI on/off switches are free for every school, in the free school space too."
2. **Two plans, side by side.**
   - **Whole Team** (marked "Most teams pick this"): "Every student on your roster, plus unlimited coaches and judges. One price by team size." From `{{whole_from}}` a year.
   - **Seats**: "Start small. Pay only for the coaches and students you add." Coach `{{seat_coach}}`, student `{{seat_student}}` a year, plus AI rounds.
   - One line under both: "Not sure? The price builder shows both and picks the lower price."
   - One link: "Buying for yourself? See plans for one person." (to `/plans`)
3. **Price builder (the configurator).** Full spec in §3. Left: inputs. Right: a sticky price card. On a phone, the price card is a bar at the bottom that opens upward.
4. **Who gets what.** A table (§2a).
5. **Team sizes at a glance.** The six Whole Team bands with the Standard price for each, debate and debate + Speech Events. Text: "Prices for other AI levels are in the price builder."
6. **Ways to pay.** Three cards (§5):
   - "Pay by card now" (coach card, school purchasing card, booster card).
   - "Get a quote, then send a PO" (net 30 invoice).
   - "Let parents and boosters help" (booster clubs can pay by card or invoice; the Fund our team link comes later).
7. **Paperwork box.** "Everything your bookkeeper needs, in one download": quote PDF, W-9, the student data privacy agreement (`{{confirm: signed}}`), and a sole-source letter (once written, §8). A button: **Download the paperwork packet** (needs a quote first, so the quote number is on every page).
8. **Privacy box.** "Student data stays with your school." Three short lines, each `{{confirm}}` until the architecture and the signed DPA support it: names are removed before any AI call; hosted AI does not keep round content; the school can delete its program at any time. Link to the Trust page.
9. **FAQ** (§6). Grouped: Plans, AI and rounds, Buying and paperwork, Privacy and safety, Students and parents.
10. **Big programs strip.** "More than {{custom_students}} students, more than one school, or need a signed contract? Get a custom quote." Button opens a short form (§5d).
11. **Footer line.** "Prices in US dollars, before tax. Sold by Pattern Engine LLC."

### 2a. "Who gets what" table

| | Coach | Student | Program judge (parent, alum) |
|---|---|---|---|
| Clocks, flow, ballot, offline | ✓ | ✓ | ✓ |
| Coach tools (roster, assignments, feedback inbox, Library tracks) | ✓ | – | – |
| Set the team's AI rules | Head coach, and coaches they allow | – | – |
| Hosted AI from the team's rounds | ✓ | AI clerk for practice and tournament weekends, if the coach turns it on | Judge weekends the team gives them |
| Judging tools in their own debate rounds | – | Never | – |
| Cost | A seat (Seats plan) or included (Whole Team) | A seat (Seats plan) or included (Whole Team) | Account free and unlimited. AI: a judge weekend from the team pool, or a Weekend Pass the team buys for them |

Note under the table: "A judge's own plan or own AI key always works. The team only decides if it pays for a judge's weekend."

## 3. Price builder (configurator)

### 3a. Inputs

Eight controls, in this order. Each has a one-line help text. Defaults are in bold.

| # | Control | Type | Values | Help text |
|---|---|---|---|---|
| 1 | Apps | Two big buttons | **Debate** · Debate + Speech Events | "Speech Events is the forensics app: rank boards, comment sheets, Congress." |
| 2 | Students | Number with − / + | 1 to {{custom_students}}; **15** | Whole Team: "Everyone on your roster." Seats: "Only students who need a seat." |
| 3 | Coaches | Number with − / + | 1 to 20; **2** | "Head coach and assistants. Unlimited on Whole Team." |
| 4 | Judges with team AI | Number with − / + | 0 to twice the students (at least 20); **0** | "Parents, alumni and hired judges you invite. Their accounts are always free. Count only the judges whose weekends the team pays for." More: custom quote. |
| 5 | Weekends per judge | Number with − / + | 0 to 12; **0** (hidden when control 4 is 0) | "Tournament weekends the team pays for, per judge." |
| 6 | Coach AI | Four cards | None · **Light** · Standard · Heavy | None: "No hosted AI for coaches." Light: "Some practice reviews." Standard: "Most practice reviews." Heavy: "Review every practice round." Default is the lowest paid choice, so the page never pre-selects a higher price. |
| 7 | Tournament weekends with AI, per student | Number with − / + | 0 to 12; **0** | "Each weekend covers one student's rounds at one tournament. You still choose the students' AI rules in the app later." This only sizes the pool. It does not set the program's AI rules. |
| 8 | Term | Two buttons | **School year** (to July 31) · Second half (January 1 to July 31) | "Second half costs less. It appears from December 1." |

A "Pay for" switch is not needed. The builder always shows both plans.

### 3b. Outputs (the price card)

The price card updates at once on every change (no "calculate" button). It shows:

1. **The recommended plan and price**, large: "Whole Team, up to 25 students — `{{price}}` a year".
2. **The other plan**, small: "Seats would be `{{other_price}}`." If Seats is lower, the two swap.
3. **What is included**, in weekends: "`{{student_weekends}}` student weekends and `{{judge_weekends}}` judge weekends." After the launch gate, a second line: "A weekend covers up to `{{rounds_per_weekend}}` rounds." Also: "About `{{per_student_weekend}}` per student weekend."
4. **Per student**, small: "About `{{per_student}}` per student." (Shown only for Whole Team. Gives parents and principals a sense of scale.)
5. **Band note** (Whole Team only): "You can grow to `{{band_top_plus_10pct}}` students at no charge." If the roster is within 3 of the band top: "3 more students would move you to the next size."
6. **How to pay**:
   - Under `{{invoice_min}}`: "Pay by card. A school purchasing card works." One button: **Pay by card**. Link: "Need a quote first? Download one."
   - From `{{invoice_min}}` up to `{{custom_min}}`: two buttons, **Pay by card** and **Get a quote for a PO**.
   - `{{custom_min}}` and up, or more than {{custom_students}} students: one button, **Get a custom quote**.
7. **Tax line**: "Before tax. Tax-exempt schools pay no tax: upload your certificate at checkout or with the quote."
8. **Title I / UDL**: a checkbox, "Our school is Title I or our team is part of an Urban Debate League." Ticked: the price shows the discount on the plan part (`{{title1_discount}}` off; AI rounds keep their normal price), with the line "We trust you. We may ask for a school link later."

### 3c. Behaviour rules

- Prices come only from the server route `GET /api/v1/programs/price` (§4d). The page never computes a price on its own. If the route fails, the page shows "from" prices only and turns off the buy and quote buttons until the route answers.
- The page keeps the builder's choices in the URL (`?apps=both&students=30&sw=6&judges=8&jw=6&coach=standard…`), so a coach can send the exact quote to a principal.
- No account is needed to use the builder or download a quote.
- Keyboard: every control works with Tab, arrows and Enter. The price card is an `aria-live="polite"` region.
- Phone width: inputs stack; the price card becomes a bottom bar with price and one button.

## 4. Where the numbers come from

### 4a. Plans

- **Whole Team:** one flat price per team size band: up to {{band_1}}, {{band_2}}, {{band_3}}, {{band_4}}, {{band_5}} and {{band_6}} students. Unlimited coaches and program judge accounts. The access price depends on the band and the apps. Hosted AI is added as tournament weekends and coach AI.
- **Seats:** coach seats plus student seats plus the AI rounds those people need.

### 4b. AI rounds

- All AI in a program comes from one **team pool**. Coaches, AI-clerk students and invited judges share it.
- The pool is sized in **weekends**. A student weekend covers one student's rounds at one tournament. A judge weekend covers one judge's rounds at one tournament, with ballot and decision drafts.
- A weekend runs for 4 days from its first AI round. The head coach gives judge weekends in the admin screen and can set limits per role.
- Unused pool rounds last until July 31.
- **Invited judge, no pool:** the team can buy one judge a Weekend Pass by card for `{{weekend_pass}}`, the same price a judge pays alone.

### 4c. More rounds later

- **Add rounds** at any time: four sizes, `{{topup_s}}`, `{{topup_m}}`, `{{topup_l}}` and `{{topup_season}}`. Bigger sizes cost less per round.
- Pay by card, or "add to our invoice" for teams that already sent a PO.
- **Fund our team link** (later): a page each team can share. Anyone can buy rounds for the team pool by card. No account needed. The coach sees a thank-you note with no payer details beyond a first name, if given.

### 4d. Server route

`GET /api/v1/programs/price?apps=&students=&coaches=&sw=&judges=&jw=&coach=&term=&title1=` returns:

```json
{ "recommended": { "plan": "whole", "band": 25, "price": 0, "studentWeekends": 0, "judgeWeekends": 0 },
  "other": { "plan": "seats", "price": 0 },
  "perStudent": 0, "payment": "card|card_or_quote|custom",
  "priceDate": "YYYY-MM-DD" }
```

The quote and checkout routes recompute the price from the same inputs. The browser never sends a price.

## 5. Buying flows

### 5a. Pay by card (any size below the custom line)

1. The coach clicks **Pay by card** in the price card.
2. Sign in, or make an account, on tabulaspeech.com. (Adults only. The buyer becomes the program admin.)
3. Name the program (school and team name). Optional: upload a tax-exempt certificate.
4. Stripe Checkout opens with the line items from the builder. Card, Apple Pay, Google Pay and Link work. A school purchasing card works like any card.
5. On success: the program is ready at once. The page shows the join code and "Add your coaches and students".
6. A receipt and an invoice marked "Paid" arrive by email. Both show the program name, the term and the line items.

### 5b. Quote, then PO, then invoice (net 30)

1. The coach clicks **Get a quote for a PO**.
2. A short form: school name, school address, billing contact email, buyer name, optional tax-exempt certificate. No account is needed yet.
3. The quote PDF appears at once and is emailed. It shows the quote number, line items, "valid for 30 days", and payment terms "Net 30 from the invoice date".
4. **Download the paperwork packet**: quote, W-9, signed student data privacy agreement, sole-source letter.
5. The school issues a PO. The coach (or bookkeeper) opens the link in the quote email and uploads the PO: PO number and the PO file.
6. The PO upload needs a sign-in. The person who uploads becomes the program admin (or must already be one).
7. The program starts at once, before payment: coach tools, join code, and a starter share of the AI rounds. The rest of the rounds arrive when the invoice is paid.
8. Stripe sends the invoice with the PO number on it, due in 30 days. The school can pay by card, ACH bank debit or bank transfer. Paper checks: see the FAQ.
9. Reminders go out 7 days before the due date, on the due date, and 14 days after. At 30 days overdue, new hosted AI from the team pool pauses. Clocks, flow, ballot and coach tools keep working. AI starts again when the invoice is paid.

### 5c. Renewal

- March 1: next year's prices are published.
- April 15: the head coach and the billing contact get a renewal quote with this year's setup. One click to change sizes.
- Renew by June 30: keep this year's price.
- July 31: the term ends. Unused rounds end. Rosters, assignments and Library progress stay for 120 days (the program retention period), then are deleted unless the program renews.
- No automatic charge. A program never renews without a new payment or PO.

### 5d. Custom quote (big programs)

- Shown when the builder passes `{{custom_min}}` a year, more than {{custom_students}} students, more than one school, or when the buyer ticks "We need changes to the terms" (a custom privacy agreement, a signed contract, longer payment terms, an RFP).
- Form: name, role, school or district, number of schools, rough number of students, what you need. A reply within 2 school days.

### 5e. Seat changes during the year

- **Whole Team:** the roster can grow 10% above the size at no cost. Past that, the head coach sees "Move to the next size" with the price. New students can still join. No one already in is ever removed.
- **Seats:** "Add seats" by card or added to the invoice.
- At launch, a size change is a new quote for the difference. Prorated prices (by months left) come later.
- Removing people never gives money back (all sales are final; refund policy §7). A free seat can go to someone new.

## 6. FAQ (questions and answers)

### Plans

**What is the difference between Whole Team and Seats?**
Whole Team covers every student on your roster, plus unlimited coaches and judges, for one price by team size. Seats lets you pay only for the people you add. Whole Team costs less per person. Seats can cost less when only a few people need it. The price builder shows both.

**What does "up to 25 students" mean if our roster changes?**
Count the students on your team now. You can grow 10% above your size at no cost. If you grow more, you can move up to the next size and pay only the difference for the months left.

**Are judges really free?**
Yes. Judge accounts are free and unlimited: parents, alumni, hired judges. A judge uses team AI only on the weekends the team pays for.

**Can our team pay for a judge's weekend?**
Yes. Invite the judge by email or link. They sign in with their own email or phone; you never make a password for them. Then give them a judge weekend or a few rounds from your team pool. No pool? Buy them a Weekend Pass for `{{weekend_pass}}`, or single rounds at `{{single_round}}` each.

**What is a weekend?**
One person's AI for one tournament. It starts at the first AI round and lasts 4 days. A Weekend Pass for one judge alone is `{{weekend_pass}}`. In a team pool a student weekend is about `{{per_student_weekend}}`.

**Can we buy Debate now and add Speech Events later?**
Yes. Add it at renewal, or at any time with a new quote for the difference. `{{confirm: prorated mid-year price}}`

**Is there a free option for schools?**
Yes. The free school space gives you a join code, Debate Library tracks, completion badges and the AI on/off switches. Every judge, coach and student can also use the full free app with no account. A paid plan adds coach tools and hosted AI.

**We joined in January. Do we pay for the full year?**
No. `{{confirm: second-half term}}` From December 1, the builder offers a "Second half" term (January 1 to July 31) at a lower price.

**Do you offer help for teams with little money?**
Yes. Title I schools and Urban Debate League teams get `{{title1_discount}}` off the plan part of the price. Tick the box in the price builder.

### AI and rounds

**What is a "round"?**
One typical policy round with live transcription, live flow and a ballot draft. Short practice speeches use much less. Long rounds and Deep analysis use more. The app always shows rounds left, not raw numbers.

**What happens if our team runs out of rounds?**
Nothing stops. Clocks, flow and ballots keep working. Hosted AI steps down to free tools. The head coach gets an email with a link to add rounds. Parents and boosters can also add rounds with your Fund our team link.

**Can we turn AI off for students?**
Yes. The head coach picks "Flow only" or "Flow + AI clerk" for students. Turning AI off is free and takes effect at once. You can also turn off single features, such as recording.

**Can the team limit how many rounds one person uses?**
Yes. The head coach can set a limit per day or per term for each role.

**Which AI does Tabula use? Do we need an AI key?**
No key is needed. Hosted AI uses several providers, and Tabula picks one for each step. Coaches and judges can still use their own key if they want.

**Do students get AI that judges their own rounds?**
No. Students never get the ballot, decision or analysis tools in their own debate rounds. The AI clerk helps with practice only.

### Buying and paperwork

**Can we pay by purchase order?**
Yes, for orders of `{{invoice_min}}` or more. Smaller orders pay by card; a school purchasing card works. Get a quote in the price builder, send it to your bookkeeper, and upload the PO when you have it. Your team starts at once. The invoice is due in 30 days.

**Can we pay with a school purchasing card or a booster club card?**
Yes. Any card works at checkout, for any order size.

**Do you have a W-9?**
Yes. It is in the paperwork packet, with the quote and the student data privacy agreement.

**We are tax-exempt. How do we skip sales tax?**
Upload your tax-exempt certificate at checkout or with the quote. We set your account as tax-exempt, and no sales tax is added where the law allows.

**Do you accept checks?**
`{{check_policy}}` (Owner decision. Proposed: checks for invoices of a set size or more, mailed to the address on the invoice. Smaller orders pay by card, ACH or bank transfer.)

**How long is a quote good for?**
30 days. After that, make a new one in the price builder. It takes a minute.

**Does the plan renew by itself?**
No. Each school year is a new purchase. We send a renewal quote in April. Renew by June 30 to keep this year's price.

**Can we get a refund?**
Program purchases are final, unless a written agreement signed by Pattern Engine LLC and your school says otherwise. Try the free app and the free trial first. See the refund policy.

**Who is the seller?**
Pattern Engine LLC sells Tabula. The name appears on the quote, the invoice and the W-9.

**We need a signed contract, a vendor portal, or longer payment terms.**
Use "Get a custom quote". We reply within 2 school days.

### Privacy and safety

**Will you sign our student data privacy agreement?**
`{{confirm: NDPA signed}}` Yes. We sign the national Student Data Privacy Consortium agreement (NDPA). It is in the paperwork packet. If your district needs changes to it, use "Get a custom quote".

**Where does student data go?**
`{{confirm: each fact against the architecture}}` Rounds stay on the device unless a coach shares them. Names are removed before any AI call. Hosted AI does not keep round content. Program data is deleted 120 days after the season ends, with reminders first. See the Trust page.

**Can students under 13 use Tabula?**
No, not through a program. The program path is for students 13 and up, through the school. `{{confirm against the privacy policy}}`

**Can a tournament ban AI?**
Yes. Tournament mode turns off AI ballots and recording. The team's own AI rules also apply.

### Students and parents

**Does my child need to pay?**
No. If the team has a plan, the student is covered. The free app also works with no account.

**How can parents help pay?**
Give through your booster club, or (later) through the team's Fund our team link. Every gift adds rounds to the whole team's pool.

**I am a parent judge. Do I need a plan?**
No. The free app has everything a judge needs. If your team gives you a judge weekend, you get AI at that tournament. Your own plan, Weekend Pass or own key also works.

## 7. Copy and design notes

- Use the shared button system and the "no stripes" rule (`docs/design/NO-STRIPES.md`).
- The parent brand (tabulaspeech.com) is black and white, with small blue, red and sage dots only.
- The site's build test fails on any literal dollar amount in page source. Every price on this page is a placeholder filled at build or from the price route.
- Reading level: aim for grade 7. Every FAQ answer starts with Yes, No, or a direct fact (a `{{confirm}}` tag comes first only until it is cleared).

## 8. Open items (owner)

1. Band names: plain numbers ("Up to 25 students") or names.
2. Check policy wording for the FAQ.
6. Clear every `{{confirm}}` tag before the page goes live.
3. Final placeholder values (from the private price notes).
4. The sole-source letter text (needs one true, unique claim about the product).
5. The Trust page facts must match the architecture before this page goes live.
