# Tabula scaling and compute cost (draft 1, 2026-11-20)

How Tabula stays cheap when nobody is using it, and safe when everyone is.

This file is public. It shows the cost **method** and Cloudflare list prices only. It has no prices, plan names, margins or per-round totals. Every number is an estimate. Check live provider prices before you build.

Related: `ARCHITECTURE.md` (the parts), private business plan §3 and §5 (credits and the first hosting sketch).

## 1. The traffic shape

| Time | What happens | Load |
|---|---|---|
| Thursday afternoon to Saturday night, in season | Tournaments. Many judges start rounds at the same set times (8 AM, 10:30 AM, 1 PM, ...). | **Peak.** Sharp jumps at round start. |
| Weekday school hours | Practice rounds in class, library reading, a few sign-ins. Spread across 4 US time zones. | Low, scattered |
| Weekday evenings | Practice, coach work, library | Low |
| Season (September to March, TOC in April) | All of the above | Peaks each week |
| Summer camps (June, July) | Practice rounds, library | Small peaks |
| Off-season (May, August) | Almost nothing | Near zero |

**Design rule:** pay per use, never for idle capacity. Every server part scales to zero. The only capacity to arrange ahead of time is **AI provider rate limits**, not Cloudflare.

## 2. Where compute goes

| Part | Who pays | Notes |
|---|---|---|
| Static app, library, marketing (Cloudflare Pages) | Free | Static requests are free and not limited. The CDN (content delivery network: copies of the files in many cities) serves them. |
| Free users with their own key | The user pays their provider | Their browser calls the provider. Our server sees nothing. **$0 to Tabula at any scale.** |
| Browser transcription | Free | On the device or Google's browser service. |
| Hosted AI and transcription (paid users) | Tabula pays the provider | **About 99% of all variable cost.** |
| Worker, Durable Objects, D1, KV, Queues, R2 | Tabula pays Cloudflare | Small. See §4. |

So the cost problem is the **AI bill**, not hosting. Hosting choices matter for **safety at peak** and for **idle cost**.

## 3. Cost per hosted round

### 3.1 Assumptions

- A typical policy round: 8 speeches (52 min) plus 4 cross-examinations (12 min), so about 64 minutes of talk, about 68 minutes in all.
- Transcription: about 8 s clips with 1 s overlap, so 64 min bills about 72 min. Hosted speech-to-text bills per audio hour at the provider's list rate.
- AI: a cheap "standard" model for all automatic calls, billed per million input tokens, cached input tokens and output tokens at the provider's list rates (check before build).
- After the planned token fixes, a typical round sends about 2.5M input tokens. About 70% are cache reads. About 150k output tokens.
- Requests: about 7.5 transcription requests a minute and 1.3 AI requests a minute, so about 600 Worker requests a round.
- Cloudflare list prices (check before build): Workers Paid $5/month with 10M requests and 30M CPU-ms included, then $0.30 per million requests and $0.02 per million CPU-ms. Durable Objects: 1M requests included, then $0.15 per million. D1: 50M row writes a month included.

### 3.2 The math (typical round)

| Item | Math | Cost |
|---|---|---|
| Transcription | 72 min × the per-hour rate | Provider bill |
| AI input, uncached | 0.75M × the uncached rate | Provider bill |
| AI input, cache reads | 1.75M × the cached rate | Provider bill |
| AI cache writes (premium on first write) | estimate | Provider bill |
| AI output | 0.15M × the output rate | Provider bill |
| Worker requests | 600 × $0.30/M | $0.0002 |
| Worker CPU | 600 × ~5 ms × $0.02/M ms | $0.0001 |
| Durable Object meter, requests | ~600 × $0.15/M | $0.0001 |
| Durable Object meter, duration | Idle between calls, so billed only while it handles a request (see note) | ~$0 |
| DO storage writes | ~2 per call (reserve, settle), ~1,200 a round | ~$0.001 at $1 per million |
| D1 writes | ~30 rows (once per speech, plus round start and end) | ~$0 |
| **Cloudflare total** | | **≈ $0.002** |

**Result:** the AI and transcription providers are almost all of the cost of a round. Cloudflare is under 1% of it. An optional analysis on a stronger model adds to the provider bill per use.

**DO duration note.** Durable Objects bill for wall-clock time while active. The design keeps the meter idle between calls: the Worker, not the DO, waits on the provider (`ARCHITECTURE.md` §4). If a meter DO stayed active for a whole 68-minute round instead, it would cost about 510 GB-s a round (about $0.006), about $14 a month at "Launch" and about $370 a month at "Many formats". Still small next to the AI bill, but worth avoiding.

A round with **browser transcription** drops the transcription line. A free user with their own key costs Tabula **$0**.

### 3.3 Other formats and Speech Events

- Cost follows minutes of talk. A policy round is about 64 minutes of talk; LD about 45; PF about 40 (`docs/growth/FORMATS.md`). So an LD or PF round costs roughly **60 to 70%** of a policy round.
- Tabula Speech Events uses little hosted AI: no live flow, no transcription in competitive rounds by default, and one "clean up my comments" call per entry. Its cost per room is a small part of a debate round's. Its load is small next to debate.
- The peak shape is the same: speech events run on the same tournament days.

## 4. Cost per month at four traffic levels

### 4.1 Assumptions

- A paying judge runs about 6 hosted rounds in a busy season month.
- At the Saturday peak slot, about 20% of paying judges are in a round at once (30% judge that day × 70% in the busiest slot).
- Free users and library readers add no server cost (static, or their own key).
- "Other fixed" covers the sign-in email sender, a status page and alerts. Estimate $0 to $50 a month, more at the top level.
- **Not in these totals:** card fees, legal work, insurance and other business costs. The private plan carries those. This table is the compute bill only.

### 4.2 Table (a busy season month)

| Level | Paying judges | Hosted rounds / month | Peak rounds at once | Peak Worker req/s | Cloudflare | Other fixed |
|---|---|---|---|---|---|---|
| Pilot | 50 | 300 | 10 | ~1.5 | $5 | $0–20 |
| Launch | 500 | 3,000 | 100 | ~15 | $5 | $10–30 |
| Growth | 2,000 | 12,000 | 400 | ~60 | ~$6 | $20–50 |
| Many formats | 10,000 | 60,000 | 2,000 | ~300 | ~$20 | $50–150 |

The AI and transcription bill for each level is hosted rounds × the cost of one round (§3). Those totals are not in this public file.

Cloudflare at "Many formats": 36M requests (26M over the included amount, $7.80), about 180M CPU-ms ($3), about 36M DO requests ($5.25), base $5. About $20.

**Off-season month** at any level: about **$5 to $25** (Workers base, email, status page). This is the idle cost.

**Library and free users:** 10,000 or 100,000 readers a month cost about $0 extra. They are static.

The AI bill follows paid use, which credits pay for. So cost grows with revenue, not ahead of it.

## 5. What breaks first at peak

In order of risk:

1. **AI provider rate limits and spend caps.** Providers set limits per account tier. Tiers rise with usage history or on request, not by paying ahead. A new account may start very low. At "Launch" the spend already passes some low-tier monthly caps.
   - *Fix:* start real API use early. Ask for higher tiers in August. Keep two same-price models from two providers, with automatic failover. One limiter DO per provider and model holds traffic at 80% of the limit.
2. **Transcription provider limits.** Some providers publish no limits. 400 rounds at once is about 3,000 requests a minute.
   - *Fix:* get limits in writing. Split load across two or three providers. Fall back to browser transcription, then to the on-device engine. The client clip buffer means a slow provider loses no audio.
3. **The Saturday 8 AM jump.** Hundreds of rounds start in the same minute. Some providers return 429 (too many requests) on sharp jumps even under the limit.
   - *Fix:* the limiter smooths the start. Flow passes start 30 to 60 s into the first speech with a random offset. Transcription has the top priority.
4. **Sign-in at the tournament.** Many judges sign in on hotel Wi-Fi at 7 AM. Email sending services also have rate limits.
   - *Fix:* 30-day sessions renewed on use. A reminder to sign in the night before. Google and Microsoft sign-in need no email.
5. **Ledger writes.** Writing the ledger on every call would be about 3 writes per call, many hundreds per second at "Many formats", all on one database.
   - *Fix:* the meter DO keeps the live round in its own durable storage and writes a summary to D1 once per speech.
6. **Venue Wi-Fi.** Not our server, but it fails most often.
   - *Fix:* the local-first core. Opus audio is about 27 kbps (10× smaller than WAV). The clip buffer catches up after a drop.
7. **One person on call.** A provider fails at 9 AM on a Saturday.
   - *Fix:* a kill switch in KV ("hosted AI off" or "browser transcription only"), phone alerts, a status page linked from the app's "AI busy" banner, and a written runbook.

**Will not break first:** static hosting, Worker CPU, Stripe.

**Degrade ladder** (automatic, as the limiter fills): flow every 60 s → every 120 s → at speech end only → pause the live eval refresh → move transcription to the backup provider → move it to the browser → show "AI busy, catching up". Never fail silently.

**Priority:** transcription > final ballot and decision > live flow > eval refresh > post-round analysis (queued).

## 6. Choices

### 6.1 Static hosting and CDN

Cloudflare Pages for the app, library and marketing. Free, global, and the owner already uses Cloudflare. `_headers` sets the CSP. Once the planned service worker ships (PLAN.md step 8), a judge's second visit needs no network.

### 6.2 Serverless functions

One Cloudflare Worker for all `/api/v1/*` routes. Why:
- It bills per request and per CPU millisecond. **Time spent waiting for an AI provider is not CPU time**, so streaming a long answer is cheap.
- It has no cold start worth counting and no servers to size.
- It runs in the same network as Pages, D1, DO, KV, Queues and R2.

Not chosen: an always-on VM or container (you pay all summer), or a region-locked function host (cold starts at 8 AM).

### 6.3 AI proxy and per-user metering

- **Meter:** one Durable Object per user during a live round. It keeps reservations in its durable storage, so an eviction or deploy loses nothing. Each call and clip has an ID, so a resent clip is never charged twice. It reserves the worst case before each call, settles the real cost after it from the provider's `usage` numbers, and writes to D1 once per speech. A conditional update stops a balance from going below its floor.
- **Limiter:** one Durable Object per provider and model. A token bucket at 80% of the provider limit. When it is empty, it names the same-price failover. If the limiter cannot be reached, the Worker goes to the failover, then tells the client to use browser transcription. Above about 100 requests a second per model, split it into shards so one object is not a hot spot.
- **AI Gateway** in front of providers, with **payload logging off** (the payloads are student speech). It adds retries and a cost view.
- **Price table** on the server, with every multiplier (cache writes, long-context tiers, region surcharges). The client never sends a model, price or prompt.

### 6.4 Transcription load

- 7.5 requests a minute per round, each a short Opus clip.
- Live and latency-sensitive: **no queue**. Direct proxy, limiter, failover.
- Paid users with the offline engine and all free users transcribe on the device. That takes load off the server at peak by design.

### 6.5 Rate limits

| Limit | Value (start here, tune with data) | Stops |
|---|---|---|
| Sign-in form | Turnstile (the one allowed script, `ARCHITECTURE.md` §3.2), about 5 requests a minute per IP, and a cap on sign-in emails per address | Bots, email bombing |
| Live rounds | 1 per account (a second device only if the owner wants it; `ARCHITECTURE.md` Q6) | Shared logins |
| Per round | A credit cap with a judge setting; then the degrade ladder | A runaway round |
| Per account per day | A credit cap with a one-click raise after a check | A stolen session |
| Trial | Once per verified email and device, global monthly cap | Trial farming |
| Per provider | 80% bucket in the limiter DO | Provider 429s |
| Global | Kill switch in KV | Anything else |

Use the Workers rate-limiting binding or WAF rate rules for the per-IP limits.

#### 6.5a Provider limits on record (owner read the consoles on 2026-11-22)

**Luna (GPT-6 Luna) stays the main model** for every automatic call. Haiku 5.5 is the failover. Sonnet 5.5 serves the paid "deep" actions. The server copy of these numbers is `perMinute` in tabula-cloud `src/ai/prices.ts`. The limiter DO uses 80% of it.

Our accounts now:

| Model | Provider and org | Tier | Requests per minute | Tokens per minute |
|---|---|---|---|---|
| gpt-6-luna (main) | OpenAI, company org | Build | 5,000 | 2,000,000 |
| claude-haiku-5-5 (failover) | Anthropic, company org | Build | 10,000 | 5M input, 1M output |
| claude-sonnet-5-5 (deep actions) | Anthropic, company org | Build | 10,000 | 5M input, 1M output |

OpenAI tier ladder for gpt-6-luna (from the OpenAI limits page):

| OpenAI tier | Requests per minute | Requests per day | Tokens per minute | Batch queue (tokens per day) |
|---|---|---|---|---|
| Free | 10 | 50 | 60,000 | 200,000 |
| Build (ours) | 5,000 | no cap shown | 2,000,000 | 20,000,000 |
| Launch | 10,000 | no cap shown | 10,000,000 | 1,000,000,000 |
| Grow | 30,000 | no cap shown | 180,000,000 | 15,000,000,000 |

Rules:
- The production OpenAI key must come from the **company** org. The owner's "Personal" org is on the Free tier (50 requests a day), which would push almost every call to failover.
- Build gives Luna 4,000 calls a minute after the 80% margin. The app makes one live-flow pass every 30 s per speech, so this is far above the 400-round load test. Ask for Launch before a season where "Growth" traffic is likely.
- Read both consoles again each August and update `src/ai/prices.ts` and this table together.

### 6.6 Queues

Use Cloudflare Queues for work that can wait:
- post-round analysis,
- emails (sign-in links may go direct; reminders and receipts go through the queue),
- retention deletions and backup jobs.

Stripe webhooks run inline: store the event ID first, so each event runs once. At this volume a queue adds nothing.

Never queue live transcription or the live flow.

### 6.7 Database

**D1** (Cloudflare's SQLite database) for accounts, sessions, ledger, usage, badges and programs.
- Scales to zero. Billed per row read and written.
- One database holds up to 10 GB. Usage rows are about 200 bytes × 8 speeches per round. At "Many formats", that is about 100 MB a month, about 2.4 GB over the 24-month retention. Watch this, but it fits.
- **Durable Objects with SQLite** for the per-user meter, and later one per large program (a data boundary, and one-call deletion).
- **Not chosen now:** a managed Postgres such as Supabase. It has a flat monthly fee that runs all summer, and adds a second vendor that can fail. The owner chose all Cloudflare on 2026-11-20 (`STACK.md` §3).

## 7. Before the first paid Saturday

1. **Load test:** 200 simulated rounds with real Opus audio, then a ramp from 0 to 400 rounds in 5 minutes. Pass: no lost clip, no balance below the floor, failover works.
2. **Failover drill:** block the main AI provider and the main transcription provider during the test.
3. **Kill-switch drill:** flip it, confirm every client falls back within one request.
4. **Provider tiers:** written limits from each provider, raised in August.
5. **Alerts on the phone:** 429 rate, spend-cap errors, cost per round drift, Worker error rate.
6. **Runbook** written and tried once.

## 8. Open questions for the owner

1. **Target scale for year 1:** plan alerts and provider tiers for "Launch" (500 paying judges) or for "Growth" (2,000)?
2. **Transcription default for paid users at peak:** hosted first (better text, server load), or on-device first where the device can (no server load, needs the offline engine)?
3. **Alert channel:** phone push, SMS or email? Who backs you up if you cannot answer on a Saturday?
4. **Status page:** a hosted status service on its own domain (never a `*.tabulaspeech.com` subdomain, `ARCHITECTURE.md` §3.2), or a static page you edit by hand?
5. **Load test budget:** the test spends real provider money (200 full rounds, plus the ramp test). Is that fine?
