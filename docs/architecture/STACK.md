# Tabula vendor stack and solo operations (draft 2, 2026-11-20)

Which services to use, so that one person (or a very small team) can run Tabula, costs stay near zero when idle, and nothing needs a big cloud backend.

This file is public. It names vendors and their public list prices only. **Prices marked (check) must be confirmed before sign-up**; vendors change them. Related: `ARCHITECTURE.md` (the parts), `SCALING.md` (load and cost).

## 1. The rules for picking a vendor

1. **Pay per use, or a small flat fee.** No idle servers that we run and pay for all summer. A small flat fee for a managed service is fine when it removes real risk.
2. **Managed, not run by us.** No VMs, containers or Kubernetes. No AWS or Google Cloud accounts to secure.
3. **As few vendors as the jobs allow.** Each one is a bill, a login, an outage and a data agreement (DPA) for schools.
4. **Standard tech** (JavaScript, SQL, Stripe), so leaving is possible.
5. **The round never depends on a vendor** (`ARCHITECTURE.md` §1).

## 2. The stack (decided 2026-11-20: all Cloudflare)

| Job | Vendor | Cost (list) |
|---|---|---|
| DNS, CDN, static sites and apps | Cloudflare Pages | $0 |
| Server code: API, AI proxy, sign-in | Cloudflare Workers | $5/month base (check) |
| Per-user sessions and live credit meter; provider rate limits | Cloudflare Durable Objects | In the Workers plan; small extra at scale |
| Database: accounts, ledger, badges, coach data | Cloudflare D1 (SQLite), with Time Travel restore (check the window) | In the Workers plan at our size |
| Kill switch, flags | Cloudflare KV | ~$0 |
| Background jobs, cron | Cloudflare Queues, Cron Triggers | ~$0 |
| Bot check on the sign-in page | Cloudflare Turnstile | $0 |
| Incoming mail (`support@`, `privacy@`) | Cloudflare Email Routing | $0 |
| AI call retries and cost view | Cloudflare AI Gateway (logging off) | $0 |
| Payments, receipts, card updates, failed-payment emails, tax, fraud rules | Stripe Checkout, Billing, Customer Portal, Tax, Radar | Per-transaction fees |
| Sending email (sign-in links and codes, reminders) | **Resend** (decided 2026-11-20) | $0 to ~$20/month (check) |
| AI and transcription | Anthropic, OpenAI, xAI; Workers AI or Groq as backup | Pay per use (`SCALING.md` §3) |
| Status page and phone alerts | A hosted status service on **its own domain** (for example Better Stack or UptimeRobot) | $0 to ~$25/month (check) |
| Code and deploys | GitHub (public app repo, private server repo); Actions deploys the Worker | $0 |

**Not used:** AWS, Google Cloud, Azure, Firebase, any always-on server. **No client-side analytics or error scripts**: they would break the CSP and the privacy promise. Client errors post to a small `/api/v1/client-error` endpoint.

That is **five outside vendors** (Cloudflare, Stripe, Resend, a status service, the AI providers) plus GitHub.

## 3. Sign-in: all Cloudflare, or Supabase?

**Owner decision (2026-11-20): Option A, all Cloudflare.** Option B stays below as the record of why.

You asked whether Supabase can run email links and Google or Microsoft sign-in. It can. But Tabula's own security rules (`ARCHITECTURE.md` §3.2) already make our Worker do most of the sign-in work:

- our own `HttpOnly` cookie on `tabulaspeech.com`, never a token in `localStorage` (judges' API keys live there);
- the session kept in the user's Durable Object, so sign-out works at once;
- the exact return-URL allow-list, the CSRF checks and the `state` check;
- a confirm page with a button and a 6-digit code, so mail scanners do not use up sign-in links.

So Supabase would replace only two small parts: **making and checking the one-time email token**, and **finishing the Google and Microsoft sign-in**.

### Option A: all Cloudflare (decided)

- **Email link and code:** the Worker makes a random token, stores only its hash in D1 with a 15-minute expiry, and emails a link to our confirm page plus a 6-digit code. Small, well-known code.
- **Google and Microsoft:** a small, maintained OAuth client library that runs in Workers (for example Arctic) handles the code exchange with PKCE (a one-time proof that the same browser started and finished the sign-in).
- **Why:** one vendor for everything at the edge; one user table; one failure domain (sessions, meter and ledger all on Cloudflare); sign-in screens show only our domains; idle cost about $5/month.
- **The cost:** we own about a few hundred lines of sign-in code. Get it reviewed once by someone outside, and keep it covered by tests.

### Option B: Supabase Auth and Postgres

- **What it adds:** Supabase makes the email token and does the OAuth exchange; a SQL dashboard; daily backups on Pro (point-in-time restore is a paid add-on, check).
- **What it costs:**
  - Pro is about $25/month (check). Free projects pause after about a week with no activity (check), so Pro is needed once real users have accounts.
  - A second user table (`auth.users`) beside ours, and two places to delete on "Delete my account".
  - A second failure domain. If Supabase is down, new sign-ins and new Stripe grants wait. A cold meter DO cannot load a balance from Postgres, so it must fail closed (see `ARCHITECTURE.md` §4).
  - Sign-in screens and Google's consent screen show `<project>.supabase.co` unless we pay for a custom auth domain (check). Some school web filters may block it.
  - Its default email link signs in on first open. A custom template and a server-side check are needed to keep the confirm-button rule.
  - Row-level security does not help us, because the browser never talks to Supabase.
- **Choose it** if you value the managed dashboard and outside-run token code more than the extra vendor and about $25 to $35 a month.

## 4. Monthly fixed cost (est.)

| Item | Before accounts | Option A (all Cloudflare) | Option B (Supabase) |
|---|---|---|---|
| Cloudflare Workers base | $0 (static only) | $5 | $5 |
| Supabase Pro | – | – | $25 |
| Email sender | – | $0–20 | $0–20 |
| Status page and alerts | $0 | $0–25 | $0–25 |
| Domains (4, yearly fees spread out) | ~$4 | ~$4 | ~$4 |
| **Idle month** | **~$4** | **~$9–54** | **~$34–79** |

AI and transcription come on top and follow paid use (`SCALING.md` §4). Stripe takes a cut of each sale only.

## 5. Operational jobs

| Job | How |
|---|---|
| Secrets (cookie signing key, Stripe keys, webhook secret, provider keys, email key) | Worker secrets only. Each signing key has an ID, so it can be rotated without signing everyone out. Rotate once a year and after any leak. |
| Backups | D1 Time Travel for restore; a weekly export of D1 to R2, kept for a fixed time. KV holds only flags, so no backup. DO state is rebuilt from D1. |
| Logs | Workers logs with no names, no prompts, no transcript text. Short retention. |
| Mail domain | SPF, DKIM and DMARC for the sender domain; bounces and complaints handled by Resend. |
| Alerts | Provider 429s and spend caps, Worker error rate, Stripe webhook failures, D1 errors, cost per round drift. |
| Domains | Auto-renew on, registrar lock on, two-factor sign-in on the Cloudflare and Stripe accounts. All four domains sit in one Cloudflare account, so guard that account most of all. |
| Subprocessor list (for schools) | Cloudflare, Stripe, Resend, the status service (if it sees user data), each AI provider. Add Supabase only if Option B is chosen. |

## 6. What runs by itself, and what needs a person

**Runs by itself:** scaling for peaks, static sites and updates; payments, receipts, card updates, failed-payment emails and tax (Stripe); sign-in emails; retention deletes and reminders (cron); provider failover and the degrade ladder; phone alerts.

**Needs a person** (est. 2 to 5 hours a week in season, less off-season):

| Task | When |
|---|---|
| Support email | A few a week |
| Card disputes and refund requests | Rare |
| Ask AI providers for higher limits | Each August, and when growth jumps |
| Update the server price table when a provider changes prices | A few times a year |
| Be reachable on tournament Saturdays (kill switch, runbook) | In season |
| School data agreements and privacy requests | Per school |

**Keep it lean:** every vendor account under the LLC; a second person with sealed emergency access and the runbook; no deploys from Thursday noon to Saturday night in season. A team of 2 or 3 adds a second on-call person and school sales and support. The tech does not need more.

## 7. How hard it is to leave

| Part | If we leave Cloudflare |
|---|---|
| Static sites | Plain files; any static host. Easy. |
| Worker routes | Standard JavaScript and `fetch`. Moderate work. |
| D1 | SQLite export. Easy to move to another SQL database. |
| Durable Objects (sessions, meter, limiters) | **Real rewrite** (for example to Redis plus Postgres row locks). The most Cloudflare-specific part. |
| KV, Queues, Turnstile, AI Gateway, Email Routing | Each has common replacements. Small to moderate work each. |
| Stripe | Customer and subscription export. |

Honest summary: the static side moves in days; the hosted-AI side would take weeks of work. That is the price of a $5 idle bill and no servers.

## 8. Open questions for the owner

1. ~~Sign-in and database~~: **decided 2026-11-20: all Cloudflare (Option A).**
2. ~~Email sender~~: **decided 2026-11-20: Resend.**
3. **Status page:** which hosted service, on which domain?
4. **Emergency access:** who is the second person with the logins and the runbook?
5. **Outside review of the sign-in code** (Option A): budget for one review before the first accounts?
