# Public sites plan (draft 2, 2026-11-20)

The public sites: `tabuladebate.com` (debate marketing and the Debate Library) in full, plus the `tabulaspeech.com` commercial site and the `tabulaforensics.com` holding page in short. Pages, copy outline, links to the apps, and how to deploy.

**Owner decisions (2026-11-20, `docs/growth/BRAND.md` §0):** `tabulaspeech.com` is the commercial site (products, plans, sign-in). `tabuladebate.com` and `tabulaforensics.com` are product marketing sites. Apps run on `tabulaspeech.com` subdomains; the debate app is `debate.tabulaspeech.com`. The Debate Library stays on `tabuladebate.com`. The speech product is named Tabula Speech Events. **Nothing gets deployed and no DNS record changes without the owner's yes.**

This file is public. It has no prices. Related: `ARCHITECTURE.md` §3 (origins), `PLAN.md` §6b (first homepage ideas), `docs/library/PLAN.md` §9 (library publish gate).

## 1. What is there now

Checked from outside on 2026-11-20 (DNS lookups only):

- The name servers are Cloudflare's. So the zone is on Cloudflare.
- There are **no** A, AAAA, CNAME, MX or TXT records for `tabuladebate.com`, `www`, `app`, `learn` or `api`. Nothing answers on the web, and no mail is set up.

What a DNS lookup cannot see: a Pages project not yet attached, Email Routing turned on but not finished, redirect rules, or SSL settings. **The owner must confirm what is in the dashboard** (open question 1) before any change.

## 2. Site map: tabuladebate.com

| URL | Page | When |
|---|---|---|
| `/` | Home | Launch |
| `/learn/` | Debate Library (exists, built by `build-learn.mjs`) | Launch, after the library reviewers sign off |
| `/learn/tracks/` | Guided tracks (exists, `noindex` until checks are reviewed) | With the library |
| `/coaches/` | For coaches and programs | Launch |
| `/school-it/` | For school IT | Launch |
| `/about/` | About (`about.html` exists) | Launch |
| `/privacy/` and `/terms/` | Privacy policy and terms | Launch (short free-app version); full version before accounts |
| `/ld/`, `/pf/` | Format pages | When each format ships in the app (LD first) |
| `/404.html` | Not found | Launch |
| `www.tabuladebate.com` | Redirects to `tabuladebate.com` | Launch |

Plans, sign-in and badge pages are **not** here. They live on `tabulaspeech.com` (§2a). Status page and GitHub are links, not pages.

## 2a. tabulaspeech.com (commercial site) and tabulaforensics.com

| URL | Page | When |
|---|---|---|
| `tabulaspeech.com/` | The Tabula family: Tabula Debate now, Tabula Speech Events "coming later"; one account across both | Launch (a simple page) |
| `tabulaspeech.com/plans/` | Hosted AI plans | **Only when paid plans ship** |
| `tabulaspeech.com/signin`, `/account/` | Sign-in and account (data, delete account) | With accounts |
| `tabulaspeech.com/badges/check/<track>` | Badge final check (`ARCHITECTURE.md` §3.5) | With judge badges |
| `tabulaspeech.com/v/:id` | Badge verify pages (Worker, `noindex`) | With judge badges |
| `tabulaspeech.com/privacy/`, `/terms/` | One legal home for every product; the product sites link here | Before accounts |
| `tabulaforensics.com/` | Holding page. Top line: "Tabula Speech Events: extemp, oratory, interp, Congress. Coming later." Link to `tabulaspeech.com`. | Launch |
| `tabulaspeech.org` | Redirect to `tabulaspeech.com`, keeping the path | Launch |

**Rule for `tabulaspeech.com`:** it shares the sign-in cookie with the apps (`ARCHITECTURE.md` §3.2). So it runs **no third-party scripts, embeds or analytics beacons**, ever. Stripe Checkout is a redirect to Stripe's own page, which is fine.

## 3. Copy outline

Rules: plain words, short sentences (`SPEC.md` §4.5). No model or company is favored. No region names. No prices until paid plans ship. Screenshots come from the real app with invented round data.

### 3.1 Home `/`

1. **Hero.** "Judge the round, not the paperwork." One line under it: a free flowing and judging app for policy debate; the clock, flow and ballot work offline, and your rounds are saved on your device, not on our server. Buttons: **Open Tabula** (to the app) and **New judge? Start here** (to the parent judge track).
2. **Three blocks.**
   - *Flow and clock:* keyboard-first flow, speech and prep timers, works with Wi-Fi off.
   - *Ballot:* points, RFD, print or PDF, copy into the tournament ballot.
   - *AI if you want it:* use your own AI key today. The AI ballot is a draft; the judge decides. (Later: "Hosted AI, no key needed".)
3. **Trust strip.** Free and open source (AGPL). No ads. No tracking scripts. Debater names never go to an AI provider. One honest line on audio: with AI transcription, audio goes to the provider the judge picked and is deleted from the device after; Chrome's free transcription may send audio to Google. The For school IT page gives the full list.
4. **Screenshots:** flow, ballot, Round Map.
5. **Learn to judge:** three library links (Debate 101, First-round judge, How to flow).
6. **Footer:** Library, Coaches, School IT, About, Privacy, Terms, GitHub, Status.

### 3.2 For coaches `/coaches/`

- Share one link with your parent judges. The parent judge track takes about an hour.
- The Debate Library for your novices: free, no account.
- Coming: a free school space (join code, assign a track, see "done or not done"), then coach tools. Say "coming", with no dates.
- Our rules: no rankings of students, no streaks, no tracking. Link to `docs/STUDENT-EDITION.md` §10 rules in plain words.

### 3.3 For school IT `/school-it/`

- The install URL for force-install on managed Chromebooks.
- The microphone policy entry (`AudioCaptureAllowedUrls`) for the app host.
- What the app stores and where (on the device). What goes to which provider, and only when the judge turns it on. One row per transcription mode (provider AI, Chrome Web Speech, on-device), saying where the audio goes.
- The CSP in one paragraph: the app runs only its own scripts.
- Subprocessor list and data agreement (when accounts exist).
- A contact email.

### 3.4 Plans `tabulaspeech.com/plans/` (later)

- "Free is the whole app." Then the hosted AI plans, in rounds, not credits ("about 5 rounds left").
- No page until the plans exist. No waitlist form that needs a third-party script (see open question 4).

## 4. Links between site, app and library

| From | To | How |
|---|---|---|
| Site header and hero | App | `https://debate.tabulaspeech.com/` |
| App ⓘ library button | Library | Absolute `https://tabuladebate.com/learn/` on the hosted app. The local helper keeps serving `learn/` for offline use. |
| App sheet "ⓘ Learn" links | Library page for that sheet | Same rule, using `SHEET_PAGES` in `logic.js` |
| Library pages | App | A small "Open Tabula" link in the library footer |
| Library tracks | Badge final check | A plain link to `tabulaspeech.com/badges/check/<track>` (later; `ARCHITECTURE.md` §3.5) |
| Site header | Sign in, Plans | Links to `tabulaspeech.com` |
| Every page | Canonical URL | Already `https://tabuladebate.com/learn/...` for the library |

The app link change touches `index.html` and `app.js`. Another session owns those files now. This is a follow-up for after Slice 2.

## 5. Look and tech

- Same tokens and font as the app and library (`assets/`, Inter Tight). The library's `learn.css` is the starting point.
- Plain static HTML. No framework, no build beyond a copy step.
- **No third-party scripts.** For visitor counts, use Cloudflare's zone analytics in the dashboard (no script in the page). A beacon script would need a CSP change.
- CSP on the site: `script-src 'self'`, like the app. The site does not need provider hosts in `connect-src`.
- `robots.txt`, a root `sitemap.xml` that points to `learn/sitemap.xml`, Open Graph images for sharing.
- Light and dark mode, phone width, keyboard focus visible. Checked in the browser before each publish (PLAN.md rule).

## 6. Deploy plan

### 6.1 Pages projects, one repo

| Project | Host | Build command | Output |
|---|---|---|---|
| `tabula-site` | `tabuladebate.com` (+ `www` redirect) | `node --test && node check-publish.mjs && node build-learn.mjs && node build-site.mjs` | `dist/site/` |
| `tabula-app` | `debate.tabulaspeech.com` | `node --test && node check-publish.mjs && node build-app.mjs` | `dist/app/` (**built as Workers assets, not Pages**: see the note below) |
| `tabula-home` | `tabulaspeech.com` (+ `www` redirect) | `node --test && node check-publish.mjs && node build-home.mjs` | `dist/home/` |
| `tabula-events-site` | `tabulaforensics.com` | none (one static page) | `sites/forensics/` |

- **CHANGED 2026-11-20 (as built):** the app is not a Pages project. It is an assets-only Worker, `tabula-app`, on the route `debate.tabulaspeech.com/*` (config `wrangler.app.jsonc`; its build command runs `node --test`, `check-publish.mjs` and `build-app.mjs` before every deploy). `/api/v1/*` on that host stays on the server Worker. No DNS record was changed. The rest of this table is still the plan.
- `build-site.mjs` and `build-home.mjs` do not exist yet (`build-app.mjs` does). They are small copy scripts with an **allowlist** of files. Today the repo root has tests, docs and plans. An allowlist means only the right files go out, even if a new file appears.
- The gates run in the build. A red test stops the deploy.
- Production branch: `main`. Other branches get preview URLs. Previews send `X-Robots-Tag: noindex`.
- Git-ignored files (`BUSINESS-PLAN.md`, `REVIEWERS.local.md`) are never in the repo, so Pages never sees them. `check-publish.mjs` still scans the output.
- **Prerequisite:** `check-publish.mjs` is meant to fail until the owner fills in the public details it checks for (its line 2). Today it passes. Keep it in the build so a new placeholder stops the deploy.
- **Headers per project:** each project gets its own `_headers` (the app keeps today's CSP; the site needs no AI provider hosts in `connect-src`).
- **Student edition** (later): a third project, `tabula-student`, on `student.tabulaspeech.com`, with its own allowlist (`ARCHITECTURE.md` §3.8).

### 6.2 DNS records (only after the owner's yes)

| Record | Value | Why |
|---|---|---|
| `tabuladebate.com` | Custom domain on `tabula-site` (Cloudflare adds the record) | Site |
| `www` | Redirect rule to the apex | One canonical host |
| `debate.tabulaspeech.com` | Worker route `debate.tabulaspeech.com/*` on the assets-only Worker `tabula-app` (live 2026-11-20; no DNS change made) | App |
| `tabulaspeech.com` | Custom domain on `tabula-home`; `www` redirects to it | Commercial site |
| `tabulaspeech.com/api/v1/*`, `/v/*`, `debate.tabulaspeech.com/api/v1/*` | Worker routes (later, with accounts) | API, verify pages |
| `tabulaspeech.org` | Redirect rule to `tabulaspeech.com` (keep the path) | Protect the name |
| `tabulaforensics.com` | Custom domain on `tabula-events-site` | Holding page |
| Any unused host | No record | No forgotten subdomain gets the cookie |
| MX + SPF (TXT) | Email Routing on `tabulaspeech.com` | `support@` and `privacy@` forward to the owner |
| DMARC (TXT) | `p=quarantine` to start | Stops spoofed mail from the domain |

### 6.3 Order

1. **Site and library first.** They have no keys and no server. The library waits for its two reviewers (library PLAN §9).
2. **App second.** It waits for the business plan's before-publishing list: key safety, cheap default models, the PWA, and the "For school IT" page.
3. **Worker third**, when accounts or hosted AI start (`ARCHITECTURE.md` §11).

The `tabulaspeech.com` simple page, the `tabulaforensics.com` holding page and the `.org` redirect can go live with step 1.

## 7. Room for other formats and brands

- Keep debate-wide words in the site skeleton ("Judges", "Coaches", "Library"), and put "policy" in page text. A new format then adds a section, not a new site.
- Library paths per format later (for example `/learn/ld/`). Today's `/learn/` stays policy, so no link breaks.
- Format pages (`/ld/`, `/pf/`) on `tabuladebate.com` carry format search traffic. No format subdomains.
- `tabulaforensics.com` grows from a holding page into the Tabula Speech Events site when that app has a beta. Speech-events learning content goes there (BRAND.md Q3).

## 8. Open questions for the owner

1. **What is set up in the Cloudflare dashboard now?** Pages projects, Email Routing, redirect rules on any of the four domains? DNS for `tabuladebate.com` showed no records on 2026-11-20.
2. **Launch order:** may the site and library go live before the app (recommended), or all at once?
3. **Legal pages:** one privacy policy and terms on `tabulaspeech.com` for every product (recommended)?
4. **Waitlist for hosted AI:** none until launch, a plain "email us" link, or a tiny form backed by our own Worker?
5. **Support email address** (recommended on `tabulaspeech.com`), and where it forwards. (The address will be public on the site.)
6. **Screenshots:** take them after Slice 3 (the new look), or now and redo later?
7. **"Buy me a coffee":** keep it on About only?
