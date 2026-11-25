# Tabula web app architecture (draft 3, 2026-11-20)

How Tabula grows from a local static app into a hosted app with accounts, paid hosted AI, a coach backend and backup. The local-first core stays.

This file is public. It has no prices, plan names or margins. Those live in the private business plan. Its hosting sketch (§5) and roadmap row C1 are the base. This file lists only what it adds or changes.

Related: `STACK.md` (vendors and solo operations), `SCALING.md` (load and cost), `docs/STUDENT-EDITION.md` §10 (coach roles), `docs/library/TRACKS.md` §5 and §8 (badges and accounts).

## 1. The rule

**The round never needs the server.** The clock, the flow, the ballot, docs, export and on-device transcription work with Wi-Fi off. A server adds things (hosted AI, accounts, badges, school spaces). It never holds the round hostage.

Three tests for every new feature:

1. Does a round still finish if the server is down? It must.
2. Does it store a student name, audio, a transcript or a flow on the server? It must not. (Encrypted backup, §6, would need an owner decision and a data-rules change first.)
3. Can a free user with their own key use it with no account? If it does not need a server by its nature, yes.

## 2. The parts

```
        Cloudflare (one account: tabulaspeech.com, tabuladebate.com, tabulaforensics.com, tabulaspeech.org)
┌──────────────────────────────────────────────────────────────────────────────┐
│ STATIC (free, cached at the edge)                                            │
│   tabulaspeech.com          commercial site: products, plans, sign-in pages  │
│   debate.tabulaspeech.com   Tabula Debate app (PWA)                          │
│   events.tabulaspeech.com   Tabula Speech Events app (later)                 │
│   student.tabulaspeech.com  student edition (own build, later)               │
│   tabuladebate.com          debate marketing, format pages, /learn/ library  │
│   tabulaforensics.com       Speech Events marketing ("coming later" now)     │
│   tabulaspeech.org          redirect to tabulaspeech.com (for now)           │
│                                                                              │
│ SERVER (one Worker, pay per request, ~zero when idle)                        │
│   On every *.tabulaspeech.com host, under /api/v1/ (see §3.7):               │
│     auth/*      sign-in link, Google, Microsoft; session cookie              │
│     ai/:task    hosted AI: server builds the prompt, meters, streams back    │
│     stt         hosted transcription: meters billed minutes                  │
│     billing/*   Stripe Checkout and webhooks                                 │
│     library/*   badge final check, badges                                    │
│     coach/*     school spaces and join codes (later)                         │
│   On tabulaspeech.com only:                                                  │
│     /v/:id      badge verify page (server-made HTML, no scripts, noindex)    │
│                                                                              │
│ STATE                                                                        │
│   D1 (SQLite)      accounts, ledger, badges, programs                        │
│   Durable Objects  one per user: live sessions + meter; provider limiters    │
│   KV               kill switch, feature flags                                │
│   Queues           post-round analysis, reminder emails, retention jobs      │
│   R2               offline transcription model files (later)                 │
└──────────────────────────────────────────────────────────────────────────────┘
   free / own key: browser talks straight to the provider (never our server)
   paid:           browser → our Worker → AI and transcription providers
```

### 2.1 What stays static

| Part | Where | Note |
|---|---|---|
| Judge app (`index.html`, `app.js`, `logic.js`, `ui.js`, `providers.js`, `vendor/`) | app host | The round runs on the device. A service worker for offline use is **planned** (PLAN.md step 8); there is none today. |
| Debate Library (`learn/`) | `tabuladebate.com/learn/` | Built by `build-learn.mjs`. Progress stays in that origin's storage (`tabula.learn.v1`). |
| Track pages and practice checks | `tabuladebate.com/learn/tracks/` | Checks grade in the browser. Only the badge final check needs the server. |
| Marketing, About, Privacy, Terms, For school IT | `tabuladebate.com` | Plain pages. |
| Free AI with the user's own key | browser → provider | Tabula never sees the key or the call. |
| Browser transcription | browser | Free. Chrome's Web Speech may send audio to Google unless on-device mode is on. |

### 2.2 What needs a server

| Need | Server part | Phase |
|---|---|---|
| Hosted AI, no keys | `ai`, `stt`, meter DO, limiter DO, ledger in D1 | Paid launch |
| Accounts | `auth`, `users` table, live sessions in the user's DO | Paid launch or judge badges, whichever is first |
| Payments | `billing`, Stripe webhooks, ledger grants | Paid launch |
| Judge badges | `library`, `/v/:id` | After accounts |
| School spaces | `coach` | After accounts (STUDENT-EDITION §10h step 3) |
| Cross-device backup | not planned yet (§6) | Only after an owner decision |

## 3. Domains and origins

### 3.0 Owner decisions (2026-11-20)

The owner decided:

- The debate app is at **`debate.tabulaspeech.com` from the first public launch**.
- **`tabulaspeech.com`** is the commercial site for the whole family: products, plans, sign-in.
- **`tabuladebate.com`** and **`tabulaforensics.com`** are product marketing sites. The Debate Library stays on `tabuladebate.com`.
- **Apps run on `tabulaspeech.com` subdomains.**
- The speech product's public name is **Tabula Speech Events**.
- Format order: **LD, then PF, then speech events.**

| Host | Role | Shares the login cookie? |
|---|---|---|
| `tabulaspeech.com` (+ `www` redirect) | Commercial site: products, plans, sign-in and account pages | Yes |
| `debate.tabulaspeech.com` | Tabula Debate app | Yes |
| `events.tabulaspeech.com` (name not final, §3.2) | Tabula Speech Events app, later | Yes |
| `student.tabulaspeech.com` | Student edition, later (§3.8) | Yes |
| `tabuladebate.com` | Debate marketing, format pages (`/ld/`, `/pf/`), Debate Library | No |
| `tabulaforensics.com` | Speech Events marketing; a "coming later" page now | No |
| `tabulaspeech.org` | Redirect to `tabulaspeech.com`, keeping the path (§3.4) | No |

### 3.1 The app's origin is fixed

- Browser storage (localStorage, IndexedDB, the service worker, the installed PWA) belongs to **one origin**: one scheme plus one exact host.
- If the app moved later, every judge's saved rounds, ballots, settings and remembered keys would stay behind on the old origin. Chromebook force-install URLs and installed icons would break too.
- The owner's decision fixes the origin before launch. **It must never move.** The same rule holds for `events.` and `student.` from their first public day.
- **Current users** run the app on `localhost` through the local helper, which is its own origin. Give them one path: **Export all** on the old origin makes a file (rounds, ballots, settings; keys left out on purpose); **Import** on `debate.tabulaspeech.com` reads it. Export exists in part (PLAN.md step 1). Add a test that a full export and import loses nothing. Keys are typed again.

### 3.2 Subdomains and one sign-in

**How sign-in works across the apps:**

1. A judge clicks **Sign in** in any app. The app goes to `tabulaspeech.com/signin?return=<app URL>` by a normal link.
2. The judge signs in there (email link, Google or Microsoft, by redirect).
3. The Worker sets one session cookie with `Domain=tabulaspeech.com`, then sends the judge back to the `return` URL.
4. The browser now sends that cookie to every `*.tabulaspeech.com` host. `debate.`, `events.` and `student.` all see the same account, wallet and badges.

**Rules:**

- **Return URLs:** an exact list of origins (`https://tabulaspeech.com`, `https://debate.tabulaspeech.com`, later `events.` and `student.`). The Worker parses the URL and compares the origin exactly; it never matches a prefix, and it rejects user-info, backslashes and `//host` forms. Anything else goes to `tabulaspeech.com`. The Google and Microsoft `state` round trip uses the same check. This stops an open redirect (a sign-in link that sends people to another site).
- **Cookie:** `__Secure-` prefix, `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=tabulaspeech.com`.
- **CSRF defence** (CSRF: a page on another site makes the browser send a request with the user's cookie) on every request that changes data: the `Origin` header must **equal the request's own host**, and the request carries a custom header (`X-Tabula: 1`). The Worker sends no CORS headers (no cross-origin reads or writes). So one app host can never call another host's API, and the account API on the apex answers only the apex. `SameSite=Lax` alone does not help here, because all `*.tabulaspeech.com` hosts count as the same site.
- **Exempt routes:** Stripe webhooks carry no `Origin`; the Worker checks Stripe's signature instead. Sign-in callbacks check a one-time `state` value, so nobody can sign a judge into someone else's account.
- **No third-party content on any `*.tabulaspeech.com` host**, the commercial site included: no third-party scripts, embeds or analytics beacons. The cookie is `HttpOnly`, so a script cannot read it, but a script runs with the page's rights and can make signed-in calls as the user. Use Cloudflare's zone analytics (no script). Host the status page on another domain, or as a static page. Delete DNS records for hosts not in use, so no forgotten subdomain receives the cookie.
- **One exception: Turnstile** (Cloudflare's bot check) on `tabulaspeech.com/signin` only. That one page gets its own CSP that allows `https://challenges.cloudflare.com` and nothing else. If the owner does not want the exception, drop Turnstile and use the Worker rate limiter plus a cap on sign-in emails per address (open question 11).
- **Session lifecycle:**
  - A new session ID at every sign-in, stored and checked on the server. **Where:** in the user's own Durable Object, the same one that holds the meter. The cookie carries the user ID and session ID, signed with our key; the Worker checks the signature, then asks that DO whether the session is live. A DO is strongly consistent, so a sign-out or deletion takes effect at once, and no database call is needed per request. A cookie planted by a sibling subdomain ('cookie tossing') then cannot fix a session.
  - Sign-out is a CSRF-checked POST. It deletes the session from the user's DO and clears the cookie for the parent domain. Account deletion deletes every session.
  - Email sign-in links open a **confirm page with a button** (a POST), not an instant sign-in. Mail scanners that open links do not use up the link. The email also carries a 6-digit code, so a judge who asked on a laptop can finish on a phone.
  - If sign-in is down during a tournament, the app stays fully usable signed out. Hosted AI works on the existing session until it expires.
- **Student host:** student accounts use their own cookie (host-only on `student.tabulaspeech.com`) and their own account scope, not the judge and coach session. A student device then never holds a judge session.
- **Each app keeps its own storage and keys.** A judge who uses both Debate and Speech Events with their own AI key enters the key in each app. Keys never go to the server, so the account cannot carry them. Hosted AI needs no key, so paid users do not see this.
- **Speech Events host name:** `events.tabulaspeech.com` is recommended. It matches the name "Tabula Speech Events", and `speech.tabulaspeech.com` repeats a word.

### 3.3 Debate formats: modes in one app

Policy, LD, PF, parli and college policy are **modes inside the debate app** on one origin.

- Many judges judge more than one format, often at the same tournament. One origin means one install, one set of saved rounds, one set of keys.
- The flow, clock, ballot and AI path are the same machine with different data (§9).
- A subdomain per format would split each judge's data into separate stores (§3.1).
- A link can open the app in a format: `debate.tabulaspeech.com/?format=ld`. Format marketing pages live on `tabuladebate.com` (`/ld/`, `/pf/`).
- **A separate subdomain is for a different product only**: Tabula Speech Events (§10).

### 3.4 `tabulaspeech.org`

Not decided. **Recommendation:** redirect to `tabulaspeech.com` now, keeping the path. Later it can hold the free and open side (open-source project, free judge resources, a plain data page for schools). Do not move the Debate Library there: its canonical URLs point to `tabuladebate.com/learn/`, and a move costs search ranking.

### 3.5 The Library badge check across two domains

The Library is on `tabuladebate.com`. Accounts are on `tabulaspeech.com`. A cookie cannot cross two registered domains, and browsers block most cross-site cookies in background calls. So the Library never calls the API.

**Design: the final check lives on the account side.**

Student tracks follow the same steps on `student.tabulaspeech.com`, with the student cookie (TRACKS §6.2).

1. Practice checks stay where they are: static, graded in the browser, progress in `tabuladebate.com` storage (`tabula.learn.v1`). No account.
2. At the end of a track, the Library shows **Take the final check** as a normal link to `tabulaspeech.com/badges/check/<track>?v=<version>`.
3. On that page, the judge signs in (if not signed in), confirms 18+, and takes the final check. The page is Tabula's own static page plus `/api/v1/library/*` calls on the same origin. The hidden question pool and grading stay on the server, as TRACKS §5.3 says.
4. On a pass, the badge goes on the account. The page shows the certificate, the verify link and a link **Back to the Library**.
   - If `v=` is older than the live track version, the page says the track changed and links to the new version in the Library. A retired track shows "This track is no longer offered" and a link to its replacement. The Library itself never shows "badge earned"; its copy says the badge lives on the account.
5. **Verify pages** are at `tabulaspeech.com/v/:id` (decided 2026-11-20; TRACKS §5.4 updated). One place for badges from every product, and no Worker route on a marketing domain. They stay script-free and `noindex`, and set their own full header set (TRACKS §5.4): `default-src 'none'` with only same-site styles and images, no framing, no referrer, no caching. The display name is HTML-escaped, because the page is on a cookie host.

What does not cross: practice-check progress stays in the Library's browser storage. The final check does not need it, because it is graded on its own. If "my progress on every device" is wanted later, the account page can offer an explicit import of the Library progress file. No silent cross-domain sync.

### 3.6 Marketing and app on separate origins

- Free users keep API keys in the app origin's storage. Any script on that origin can read them.
- Marketing pages tend to grow (embeds, video, forms). On another origin they can never reach the keys.
- Both origins use `script-src 'self'`. The site may relax its own CSP later; the app never does.
- `_headers` today is one file for one host. Each Pages project gets its own copy (§11 doc updates).
- The library's canonical URLs already point to `https://tabuladebate.com/learn/`. The app's library links (`index.html` `href="learn/"`, `app.js` sheet links) become absolute on the hosted app. The local helper keeps serving `learn/` for offline use.
- Library progress (`tabula.learn.v1`) lives on the library origin. The app does not read it. Badges, which are on the account, are the only link between the two.

### 3.7 Hosted API vs the local helper

The local helper (`bridge.mjs`) already answers `/api/health`, `/api/ai` and `/api/speechdrop/*` on `localhost`, and `app.js` calls them by those paths. If the hosted Worker used the same paths, the hosted app would detect a "helper" and send helper-shaped requests to it.

- The hosted API lives under **`/api/v1/`**. It never answers the helper's paths.
- The hosted app hides the helper card (business plan §7 already says so). The helper probe gets its own path (for example `/api/helper/health`) as part of that change.
- This needs an `app.js` change. Another session owns app files now, so it is a follow-up.

### 3.8 Student edition

The student edition must never show live judging tools (STUDENT-EDITION §1e). **Recommendation:** its own host (`student.tabulaspeech.com`), its own Pages project and its own allowlist build that never contains the judging modules. Then judge tools cannot be reached by URL, and a student device never holds judge data. A test checks the student build's file list.

## 4. The hosted AI path

1. The app sends **round state, not a prompt**: task, round ID, a call ID, flow cells, this speech's transcript and doc text, roles as 1A/2A/1N/2N (never names).
2. The Worker checks the `Origin`, the custom header, the session, the kill switch and the account caps.
3. The user's meter DO reserves the worst-case cost and writes the reservation to its **durable storage** (it survives eviction and deploys). Each reservation expires after a few minutes: a DO alarm releases it, or settles it at the action's minimum, if the Worker never settles it.
4. The Worker builds the prompt from a server template and picks the model from the server's model map.
5. The limiter for that provider and model gives a token, or names the failover.
6. The **Worker** (not the DO) calls the provider through AI Gateway with logging off, and streams the answer back. The DO is idle and not billed while it waits.
7. The meter DO settles the real cost from the provider's `usage` numbers.
8. Nothing of the round is stored: no prompt, answer, audio or transcript. Only usage numbers.

**Meter rules:**
- **If D1 cannot be reached** when a meter DO starts, the DO uses the last balance kept in its own storage, capped at one round's worth, and settles with D1 later. A DO with no stored balance fails closed: hosted AI waits, and the app falls back to own-key or browser transcription.
- **One balance authority.** The D1 ledger is the record. The meter DO loads its balance from D1 when it starts, and owns the live balance during a round. A Stripe webhook writes the grant to D1 and then tells the DO (retried, and safe to repeat), so a mid-round top-up shows at once. If the DO missed it, it reloads from D1 the next time a balance check fails.
- **Idempotency.** Each call and each audio clip carries an ID. The clip buffer resends clips after a network drop; a repeated ID is never charged twice.
- **Cancelled streams.** If the client stops a stream, the Worker charges what was produced (counted tokens, at least the action's minimum) and releases the rest.
- **D1 writes** happen once per speech, as a summary, from the DO's durable record.
- **No deploys from Thursday noon to Saturday night** in season.

**Limiter rules:**
- One limiter per provider and model, holding traffic at 80% of the provider limit.
- If the limiter cannot be reached, the Worker uses a small fixed cap per Worker instance and sends overflow to the same-price failover, then tells the client to use browser transcription. It never blocks the round and does not flood the failover.
- Above about 100 requests a second per model, split the limiter into shards (for example by region), each with a fixed share of the 80% budget, so one object is not a hot spot.

**Transcription** uses the same path with short Opus clips. Each clip is sent, transcribed, metered and dropped.

**When the server fails:** the app falls back to browser transcription and manual flowing, and says so. The round goes on.

## 5. Accounts

- **Sign-in:** an emailed link and code (no password; sent with Resend, `STACK.md` §2), plus Google and Microsoft by redirect (TRACKS §8.1). Turnstile on the email form only, as the one allowed script (§3.2).
- **Session:** 30 days, renewed on use, so judges do not sign in at 8 AM in a tournament hallway.
- **One account system** for hosted AI, badges and school spaces, on every Tabula app host.
- **Ages:** hosted AI is for people aged 13 and over, with or without a school. No accounts under 13.
- **First tables:** `users`, `identities`, `ledger` (integer milli-credits), `usage` (one row per speech; no text, no names), `badges`, `stripe_events` (event ID first, then process inline, so each event runs once). Coach tables come later.
- **Paid but not yet granted:** after Checkout, the app polls for the grant for up to a minute and says "Payment received, adding your rounds".

## 6. Backup and sync

**Recommendation now: the user's own export file.** It already fits the data rules: round content stays on the device. A signed-in account keeps account, usage and purchase records on the server.

- A round has one writer: one judge on one device. Live multi-device merge is not needed.
- Moving to a new device: **Export all**, then **Import** (§3.1).
- **Encrypted cloud backup** (snapshots encrypted on the device, so the server stores only data it cannot read) is possible later. But it puts flows and transcripts on the server, even if unreadable. That breaks today's promise ("no audio, no transcripts, no flows") in STUDENT-EDITION §10e and the business plan's server data list. A lost passphrase also loses the backup. **Build it only after the owner decides and the published data rules change** (open question 5).

## 7. Coach backend

- Follows STUDENT-EDITION §10h: accounts, then school spaces and join codes.
- Each program's rows carry a `program_id`, and one shared query helper always filters by it.
- Retention jobs (planned, not in place today) will run on a daily Cron Trigger and write counts only.

## 8. Public and private code

The owner decided: the app stays AGPL in the public repo; the server, billing and coach backend may be private.

- **The contract is public.** Publish the API shapes and the server's data rules in the public repo, so schools and families can check them. Done: see `docs/contract/`.
- **Watch the prompt templates.** The server builds prompts. If it copies prompt code from `logic.js`, and `logic.js` has outside AGPL contributions, the server must be AGPL too. Write the server templates fresh, or use a contributor licence agreement (CLA: contributors let the owner relicense) before accepting outside code.
- The public app must work fully with no server.

## 9. Formats as data (debate)

Format order: LD, then PF (owner decision). College policy comes almost free with the same work. Parli later.

**Format IDs:** `policy-hs` (today's NSDA 8-3-5), `ld`, `pf`, `college-policy`, `parli`. Possible later: `bp` (four teams; large).

**One file per format,** shipped with the app (not fetched from the server, so it works offline): `formats/<id>.json`.

| Field | Holds |
|---|---|
| `id`, `version`, `name`, `level` | Identity. `version` rises on any change. |
| `sides` | Labels and colors (Aff/Neg, Pro/Con, Gov/Opp) |
| `speeches` | id, label, side, seconds, speaker, `kind` (`speech`, `cx`, `crossfire`; later `poiAllowed`), flow column. A grand crossfire is a `crossfire` row with four `speakers`. |
| `flowColumns`, `defaultSheets` | The flow grid and first sheets |
| `prep` | seconds and mode (`perTeam`, `perDebater`, `sharedPool`, `beforeRound`) |
| `order` | absent (fixed) or `coinFlip` (built: see below) |
| `ballot` | `winLoss` or `rank4`; points min, max, step; speaker ranks yes or no; wording |
| `evidence` | `cards`, `paraphraseAllowed` or `none`; doc share on or off |
| `ai` | transcribe hint, judge rules text, "no new arguments in" list |
| `library` | Library tags that apply |

**Build the schema from `policy-hs`, `ld` and `pf` only.** Add a field (POI, four teams, shared prep) when a format that needs it is next in line. The table lists the full proposal for reference.

**Rules:**

- **Today's constants move into `formats/policy-hs.json`:** `SPEECHES`, `FLOW_COLUMNS`, `DEFAULT_FLOWS`, `SPEECH_TO_COLUMN`, `MAP_SPEECHES`, `SPEAKERS`, `DEFAULT_PREP_SECONDS` and `TRANSCRIBE_HINT` in `logic.js`. Policy names appear about 40 times in `logic.js` and 18 times in `app.js`. That refactor is the gate for LD.
- **Round records store `format` and `formatVersion`.** Old rounds with no format load as `policy-hs` version 1. A round renders with the version it was judged under. So the app **keeps every old format file** (`formats/ld.v1.json`, `ld.v2.json`, ...), and a test checks that every version ever published is still there.
- **Records and credit debits also carry `productLine`** (`debate` or `events`), so reports can split use by line.
- **Hosted AI:** the client sends `format` and `formatVersion`, never rules text. The server's copy of each `ai` block is **generated from the same format files at deploy**, so the two cannot drift. An unknown version gets a "Reload the app" error. Prompt templates are keyed by task and format.
- **A schema test** checks every format file: required fields, speech IDs unique, each flowed speech maps to a column, the times add up.
- **Built so far:** per-debater prep (LD, `prep.mode: 'perDebater'`), and for PF (`formats/pf.v1.js`):
  - **Coin-flip order.** The file says `order: 'coinFlip'`. Each speech and flow column names its `team` (`first` or `second`), not its side, and each speech names its debater by name box (`slot`). Labels may hold `{side}` ("{side} Constructive"). The round stores the side that speaks first as `round.firstSide` (`aff` or `neg`; missing or bad = `aff`), and `formatFields` writes it with `format` and `formatVersion`, so round files, saved ballots and hosted AI bodies carry it. `formatOf(round)` returns the format seated for that order (`logic/format.js` `seat`): each speech gets its side, debater and label, so all other code reads a normal format. Speech ids keep their places across orders. Round setup has a "Speaks first" pick; once speech work exists (`orderInUse`), a change asks first. A file with no `order` is fixed order and is never seated.
  - **Crossfire rows.** `kind: 'crossfire'` with `speakers` (two, or all four for grand crossfire) and `column: null`. The row's side is worked out from its debaters: one side, or `both` (no side colour, the word "Both"). `speechSpeakers(fmt, speech)` gives a row's debaters for the clock line and the AI transcript heading.
  - **Side words.** Screen text that names a side reads the format's `sides` labels (`sideLabel`; `data-side-word` and `data-side-name` in index.html), so PF says Pro and Con. Policy and LD are unchanged; `fixtures/format-baseline.json` and `formats-pf.test.js` check that.
- **New code still needed**: POI tally (parli), other rank ballots and point scales, and four teams (BP, large). Hosted AI for LD and PF needs the server's format list and its generated `ai` copy first (and PF bodies carry `firstSide`).
- **Per-format cost:** shorter rounds use fewer credits. See `SCALING.md` §3.3.

## 10. Tabula Speech Events

A second app on `events.tabulaspeech.com`, after LD and PF. **The host is decided** (owner, 2026-11-20). The full plan is in `docs/events/`. It is a new app, not a format file: no flow grid, ranked ballots, many speakers per room.

### 10.1 What it borrows and what is new

| Part | From the debate app | Note |
|---|---|---|
| Shell: tabs, panes, settings, theme tokens, welcome | Borrow | New layout for one room, not one round |
| Clock engine and refresh-safe timer state (spec 1.1) | Borrow | New face: one speaker at a time, limit plus 30 s grace, "over grace" flag |
| Storage, round files, backup, export and import | Borrow | New record type: a room (event, entries by code, order) |
| AI client (`providers.js`), keys (`keys.js` for shortcuts, key store in `app.js`) | Borrow | Same providers and BYOK rules |
| Dialogs and toasts (`ui.js`), tours (`tour.js`), `tap.js` | Borrow | New tour text |
| Account, sign-in, credits wallet, hosted AI path | Borrow | Same account and wallet; debits carry `productLine: 'events'` |
| Recording and clip queue (`clipqueue.js`) | Borrow, practice only | No recording in competitive rounds by default (minors, copyrighted interp texts) |
| Rank board (drag 1–7, no ties, over-grace entry cannot be 1st) | **New** | |
| Comment sheet per entry, with event-specific prompts and tags | **New** | |
| Congress scoring grid (1–6 and 1–8 scales), PO hours, top-8 helper | **New** | |
| Event files (`events/defs/<id>.json`: limit, grace, prep, prompts, ballot wording; all versions kept) | **New** | Like format files, but a different shape (no sides, a rank ballot) |
| AI prompts: "clean up my comments", later coach summaries | **New** | Never ranks, never picks a winner |
| Flow grid, sheets, speech docs, SpeechDrop, live AI flow, Live Eval, analysis, Round Map, debate ballot | Not used | Debate only |

### 10.2 Check of the 35–45% estimate

Counted on 2026-11-20 while the Slice 2 work was changing `app.js`, so the line counts move from day to day. The share is what matters. Files: `app.js`, `logic.js`, `index.html` and the small modules, about 6,060 lines; `check.js` left out.

| Group | Lines (approx.) | Product-neutral |
|---|---|---|
| Small modules: `ui.js`, `providers.js`, `keys.js`, `tour.js`, `tap.js`, `clipqueue.js` | 860 | all |
| `app.js` (about 2,840): storage, binding, round files, clock and restore, settings, reading level, AI client and connections, audio settings, welcome, backup | ~960 | yes |
| `app.js`: recording, transcription, meter, clip queue glue | ~460 | only if Speech Events reuses recording |
| `app.js`: flow, AI flow, docs, SpeechDrop, Live Eval, analysis, Round Map, ballot, prep | ~1,240 | no |
| `logic.js` (1,496): clock format, CSV, round files and backup, clock restore, toasts, error text, dialog helpers, audio helpers | ~520 | yes |
| `logic.js`: speeches, flow, paradigms, prompts and schemas, map, docs | ~980 | no |
| `index.html` (863): header, settings, dialogs, welcome, connections | ~260 | yes |

**Result:** about **2,600 of 6,060 lines (about 43%)** are product-neutral today. About **50%** if Speech Events reuses the recording code for practice. The `app.js` neutral count is cautious: the tabs and timer sections hold debate wiring, so only part of them is counted. So the earlier 35–45% estimate is close, a little low. Keep **35–45% as the planning number**, because pulling code out of `app.js` always leaves glue behind: today the neutral parts share globals (`R`, `S`) and DOM IDs with debate code.

### 10.3 How the code is split

- **One public repo** (AGPL). Later folders: `core/` (shared modules), `events/` (with `events/defs/`, `events/profiles/`, `events/prompts/`; `docs/events/ARCHITECTURE.md` §8), and optionally `debate/`. No build step: each app loads `core/` modules from its own origin.
- **`core/` loads as native ES modules** (`<script type="module">`, `import` from `/core/…`). Decided by the owner on 2026-11-20. Each debate file changes how it loads once, during the lift.
- **Moving today's app into `debate/` is optional.** It changes the live host's paths, `check-publish.mjs` and the `learn/` links. `core/` can be lifted while the debate app stays at the repo root.
- **Right-sized order for one person:** do the format refactor first (§9). It makes the seams (state passed in, not read from globals). **Pull out `core/` only when `events/` starts**, using those seams. Do not move files before a second app needs them.
- Once `core/` exists: it never names a debate thing (speech IDs, sides, flow), checked by a test, and the student edition (§3.8) uses it too.

## 11. Build order and doc updates

**Build order** (each step works alone; it follows the business plan roadmap):

1. Static launch: the app on `debate.tabulaspeech.com`, debate site and Library on `tabuladebate.com`, a simple `tabulaspeech.com` page, a "coming later" page on `tabulaforensics.com`, the `.org` redirect. Export and import path for current users. No server.
2. Service worker and install (PLAN.md step 8).
3. Worker skeleton: `/api/v1/health`, kill switch, alerts, status page.
4. Accounts and sign-in on `tabulaspeech.com` (§3.2).
5. Hosted AI and transcription behind the meter and limiter. Load test (`SCALING.md` §7).
6. Stripe Checkout and the ledger; plans page on `tabulaspeech.com`.
7. Judge badges: final check and verify pages on `tabulaspeech.com` (§3.5).
8. Pull out `core/` and move policy into a format file (§9, §10.3). Then LD, then PF.
9. Coach steps 3 to 5. Student edition host when the student app is built.
10. Tabula Speech Events on `events.tabulaspeech.com` (§10).

**Doc updates needed (owner decisions are now made):**
- ~~`docs/library/TRACKS.md`~~: **done 2026-11-20** (§3.4, §4, §5.3, §5.4, §8.1 and decision 21).
- `_headers`: one file per Pages project; update the comment that names the host.
- Business plan §5a and §7: `api.<domain>` and its CSP entry become same-origin `/api/v1/` on each `tabulaspeech.com` host.

## 12. Open questions for the owner

1. **API location:** same-origin `/api/v1/` on each `tabulaspeech.com` host (recommended), or a separate `api.` host as the business plan says?
2. ~~Speech Events host~~: **decided 2026-11-20 (owner): `events.tabulaspeech.com`**.
3. **Student edition:** its own host and build, `student.tabulaspeech.com` (recommended)?
4. ~~Badge pages~~: **decided 2026-11-20: on `tabulaspeech.com`** (§3.5); TRACKS.md updated.
5. **Backup:** export files only for now (recommended), or plan encrypted cloud backup and change the published data rules (§6)?
6. **Two devices on one live round** (for example a laptop flow and a phone clock): needed? It sets the live-round limit in `SCALING.md` §6.5.
7. **`tabulaspeech.org`:** redirect for now (recommended), or start the open-source and free-resources page now (§3.4)?
8. **Server prompt code:** write the server templates fresh, or add a CLA before outside contributions arrive?
9. ~~Sign-in email sender~~: **decided 2026-11-20: Resend.** Check its sending limits before the first peak Saturday.
10. **Domain renewals:** turn on auto-renew for all four domains, so no product URL can lapse.
11. **Turnstile on the sign-in page:** allow this one Cloudflare script on `/signin` only (recommended), or drop it and rely on rate limits (§3.2)?
12. ~~Sign-in and database vendor~~: **decided 2026-11-20: all Cloudflare** (D1, our own email link and code, a small OAuth library; `STACK.md` §3).
