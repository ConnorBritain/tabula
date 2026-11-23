# Legal pages: business facts (checked against the live pages on 2026-11-23)

The live pages are https://tabulaspeech.com/terms/, https://tabulaspeech.com/privacy/ and https://tabulaspeech.com/refunds/. They say "Effective November 22, 2026". These are the business facts and legal choices inside them. Change the pages and this file together. Source files: `~/Code/tabula-sites/sites/speech/pages/{terms,privacy,refunds}.html`.

History: draft 4 (Rounds, Weekend Pass, Subscriptions, the return rule) published 2026-11-20 (`LEGAL-UPDATE-FINAL.md`). Update 3 (13+, no free trials) and update 5 Part A (Link as seller, refunds, disputes) published 2026-11-22 (`LEGAL-UPDATE-3-FINAL.md`, `LEGAL-UPDATE-5-DRAFT.md`).

## Facts from the owner

- Pattern Engine LLC is a Kansas limited liability company. Legal address: 2812 SW Huntoon St, Topeka, KS 66604.
- Contact for support, privacy and legal notices: support@tabulaspeech.com.
- Seller: Paid Plans bought online are sold through Link, Stripe's checkout service, as the merchant of record. Programs are sold by Pattern Engine LLC by invoice or purchase order.
- Card statement: the name starts with "LINK.COM*". The Stripe statement descriptor is "TABULASPEECH".
- Refunds: purchases are final, except where the law requires a refund or Link gives one under its own rules (for example within 60 days in certain cases). Refunds run automatically, with no manual approval step (owner, 2026-11-22; review the refund count one month after the first sale).
- No free trials. The free app works with no account and no card.
- Who can use and buy: 13 or older to have an Account. Users 13 to 17 can use Hosted AI on their own. Only adults can buy (18 or older in most states). A parent or guardian can buy for a minor's Account. Date of birth is asked at sign-up.
- Prices on the live Plans page (2026-11-23): Single Round $2 (1 Round); packs of 3 for $5, 7 for $10 and 16 for $20; Weekend Pass $10 (8 Rounds); Monthly $15 (13 Rounds a month, roll-over cap 39); Season $59 a year (60 Rounds); All-Access $149 a year (165 Rounds, sold only after Speech Events opens). Prices are in US dollars; sales tax is added at checkout.
- Checkout is not open yet: the Plans page says "Email us to buy".

## Legal choices in the pages

| Topic | What the pages say | Where |
|---|---|---|
| Courts | State courts of Shawnee County, Kansas, and the U.S. District Court for the District of Kansas, for claims outside arbitration | Terms §22-23 |
| Arbitration | AAA Consumer Arbitration Rules; 60-day informal period first; company pays consumer fees; 30-day opt-out; batching for many similar claims; small-claims and IP carve-outs; covers Rounds bought through Link, not disputes with Link about the payment | Terms §22 |
| Liability cap | The greater of what the user paid in the last 12 months and one hundred U.S. dollars | Terms §20 |
| Changes to documents | 30 days' notice for material changes | Terms §24, Privacy |
| Renewal reminder | 7 to 30 days before each Season or All-Access renewal, by email; Link sends it to the checkout email (Link sends it 15 days before) | Terms §8, Refunds §5 |
| Free trials | None; a promotional price is a paid purchase | Terms §7, Refunds §2 |
| Unit | "Round": one debate round normally uses one Round; internal smaller units are never sold or shown | Terms §2, §6 |
| Round expiry | Single Round and Round Pack: 12 months. Weekend Pass: 4 days after the first Round is committed (12 months if never committed). Monthly: rolls over while active, up to the cap on the Plans page; expires at the end of the last paid month. Season and All-Access: end of the 12-month term. Programs: July 31 | Terms §6.6, Refunds §4 |
| What Rounds are | A limited, revocable license to use Hosted AI; not money, a deposit, stored value or property; no cash value | Terms §6.7, Refunds §4 |
| Return rule | A Round can be returned until the first speech is recorded; then it is committed. A returned Round goes back to its balance with the same expiry; it is not a refund | Terms §6.3, Refunds §1, §4 |
| Spend order | Weekend Pass Rounds, then Subscription Rounds, then Single Round and Round Pack Rounds; soonest expiry first inside each group; Program Rounds kept apart | Terms §6.5, Refunds §4 |
| Long rounds | The core of a debate round always finishes and never uses more than one Round; extra features may use another Round only if the user says yes | Terms §6.2, §6.4 |
| Saved payment methods | Stored by Stripe or the wallet provider, never the full card number by us | Terms §8 |
| Refunded payment | Rounds taken back in proportion to the amount refunded: first that payment's unused Rounds, then other unused Rounds | Terms §8, Refunds §6 |
| Disputes and chargebacks | While a dispute is open, Rounds equal to that payment's Rounds are held back; given back if we win, removed if we lose; no Account suspension; the free app keeps working | Terms §8, Refunds §8 |
| School-paid judge Rounds | From the Program pool; follow Program terms; expire July 31; not refundable unless a signed school agreement says otherwise; never move into a judge's own balance | Terms §9, Refunds §7 |
| Program refunds | None, unless a signed school agreement says otherwise | Refunds §7 |
| Users under 18 | No AI training on their content; only the data needed; parent consent where a state law requires it | Terms §3, Privacy §12 |
| Data requests | Answered within 30 days | Privacy §16 |
| Record keeping | Payment records kept for tax purposes, typically 7 years | Privacy §13 |
| Breach notice | Without unreasonable delay and within the time the law requires | Privacy §15 |
| Sign-in | Email link or 6-digit code; Google or Microsoft account "where we offer it"; Cloudflare Turnstile on sign-in forms | Terms §4, Privacy |
| Subprocessors | Cloudflare (incl. Workers AI and Turnstile), Stripe (including Link), Resend, Anthropic, OpenAI, Google (Gemini), xAI, Groq | Privacy §10 |
| International | EU-U.S. Data Privacy Framework or Standard Contractual Clauses; Global Privacy Control honored | Privacy |
| Student data | FERPA school official; COPPA; SOPIPA, NY Ed Law 2-d, IL SOPPA; data processing agreement for schools; no student data used to train AI | Privacy §11 |

## Approved, not live yet

- **Update 6** (`LEGAL-UPDATE-6-WEEKEND-PASS-12-MONTHS-DRAFT.md`, lawyer good 2026-11-23): Weekend Pass Rounds last 12 months; spend order becomes Subscription Rounds, then Single Round, Round Pack and Weekend Pass Rounds; expiry reminder emails (with send records); Rounds are not a gift card or gift certificate (§6.7). Waits for the server change and the owner's yes in the marketing chat.
- **Update 4 draft 3** (`LEGAL-UPDATE-4-CAMP-PASS-DRAFT-2.md`, lawyer good with his two changes 2026-11-23): Camp Pass with a Start button, an August 15 end and a kept share set on the purchase day, rounded up. Goes live after update 6.
- **Update 5 Part B** (buy without signing in, send a purchase to another person): waits for the buy-first build.
- **Plans page changes held by marketing** (tabula-sites `claude/pricing-held-weekend`): pack names Single, Trio, Weekend Pass, Circuit; 7-round pack removed; Circuit price change; Weekend Pass "Rounds last 12 months". These ship on the same day as update 6.

## Not yet true in the product

- Accounts are live for sign-in. Checkout, paid plans and Programs are not live. The Plans page says "Email us to buy". The legal text describes the service as it will run.
- Google and Microsoft sign-in are not built yet.

## Words for Rounds (owner rule, 2026-11-23)

This rule applies to the product, the legal pages, emails and all marketing.

- Never call Rounds, packs or passes a "gift", a "gift card" or a "gift certificate".
- Never offer them "as a gift", and never say "give Rounds" or "gift Rounds" to a person.
- When a buyer moves Rounds to another person, say "send" (for example "send Rounds", "send a purchase").
- Reason: in some states a gift card or gift certificate cannot expire (for example Cal. Civ. Code 1749.5). Rounds expire 12 months after purchase. Terms §6.7 says Rounds are a license, not a gift card or stored value. Copy that calls them gifts weakens that case.
- Not covered: money given to a school team pool (Programs page, "Fund our team"). That is a donation of money, not Rounds sold to a person. Ask the legal session before you change that copy.
