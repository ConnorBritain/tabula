# Marketing sites plan (draft 1, 2026-11-20)

Three public sites, one design system. This file builds on [`docs/architecture/MARKETING-SITE.md`](../architecture/MARKETING-SITE.md) (site map, deploy, DNS) and [`docs/growth/BRAND.md`](../growth/BRAND.md) (names, marks, colors). Research is in [RESEARCH.md](RESEARCH.md).

This file is public. Approved prices live in `layout.mjs` (`LINKS.priceMonth`, `LINKS.priceYear`) and show only on /plans/. The three sites are live (Workers static assets, configs in `deploy/`).

## 1. Where the code lives

- Owner decision (2026-11-20): a new repo at `~/Code/tabula-sites`. It is not in the app repo.
- Plain HTML and CSS. One tiny build script (`node build.mjs`, no dependencies) wraps each page in the shared header and footer.
- Layout:

| Path | What |
|---|---|
| `shared/` | `tokens.css`, `site.css`, `theme.js`, marks (SVG), Inter Tight font, icon |
| `layout.mjs` | One site registry (host, port, nav, Library mounts) plus the shared head, family bar, header and footer |
| `sites/speech/pages/` | tabulaspeech.com pages (body fragments) |
| `sites/debate/pages/` | tabuladebate.com pages |
| `sites/events/pages/` | tabulaforensics.com pages |
| `build.mjs` | Writes `dist/<site>/` with `_headers`, `robots.txt`, `sitemap.xml`. `--library <app repo>` copies the Debate Library in |
| `serve.mjs` | Builds with local links and the Library, then serves ports 8781 (speech), 8782 (debate), 8783 (events) |
| `build.test.mjs` | Gates (11): see §7 |

- Deploy later: one Cloudflare Pages project per site. Build command `node --test && node build.mjs --library <app repo>`. Output `dist/speech`, `dist/debate`, `dist/events`.
- The Debate Library stays in the app repo (`build-learn.mjs` → `learn/`). `build.mjs --library` copies `learn/` and `assets/` into `dist/debate/`. The gates fail if the Library is missing, so a deploy cannot ship dead `/learn/` links. How the Pages build gets the app repo (second checkout, git submodule, or a published artifact) is a decision for the owner (§8).
- Headers: `build.mjs` writes one `_headers` per site. It also governs the copied Library (the Library has no inline script or style, so the strict CSP fits). HSTS has no `includeSubDomains` yet: on tabulaspeech.com it would bind every app subdomain.

## 2. Page list

### tabulaspeech.com (parent: plans, sign-in, all products)

| URL | Page | Status in draft 1 |
|---|---|---|
| `/` | The Tabula family: what we make, products, one account, trust, open source | Built |
| `/plans/` | Free; Pass (prices: see the Pricing page); Round packs coming soon; Programs and the two-app plan as rows; trial line; comparison table; FAQ | Built |
| `/trust/` | Privacy and student data: what we keep, what we never keep, AI controls for admins | Built |
| `/about/` | Who makes it, the company, the rules we keep | Built |
| `/signin/` | Sign-in entry. Accounts are not open yet, so it says so and links to the free app | Built (placeholder) |
| `/terms/`, `/privacy/`, `/refunds/` | Full legal text (Kansas LLC), TOC and plain summaries per section. Facts to confirm: [LEGAL-FACTS.md](LEGAL-FACTS.md) | Built, live |
| `/404.html` | Not found | Built |
| `/account/`, `/badges/check/…`, `/v/:id` | With accounts and badges (Worker routes) | Later |

### tabuladebate.com (Tabula Debate: direct to purpose, plus the Library)

| URL | Page | Status |
|---|---|---|
| `/` | Hero, how a round works, features, AI your way, trust strip, Library, formats | Built |
| `/learn/…` | Debate Library (app repo) | Exists; linked |
| `/coaches/` | Share one link with parent judges; Library for novices; school space later | Built |
| `/school-it/` | Install, microphone policy, what is stored where, CSP, contact | Built |
| `/ld/`, `/pf/` | Format pages | When each format ships |
| `/404.html` | Not found | Built |

### tabulaforensics.com (Tabula Speech Events: coming soon)

| URL | Page | Status |
|---|---|---|
| `/` | Top line "Tabula Speech Events: extemp, oratory, interp, Congress. Coming later." Events, what it will do, get updates | Built |
| `/404.html` | Not found | Built |

## 3. Copy

The final copy for every page is in [COPY.md](COPY.md). It was redrafted with the owner's koedify plugin against a five-reader market panel (parent judge, varsity coach, school IT, fast college judge, speech coach), and checked against [ANTI-PATTERNS.md](ANTI-PATTERNS.md).

Rules: plain words, short sentences, benefit-led headlines. No model or company named or favored. No region names. No prices. No invented quotes, counts or logos. No Library page count. No middle-dot fragment chains, no clipped slogan pairs, no "X, not Y". At most one eyebrow label per page. Formats say "available today" and "coming soon".

## 4. How the sites link

| From | To | How |
|---|---|---|
| Family bar (every page, every site) | Tabula Speech, Tabula Debate, Speech Events, Debate Library | Thin strip above the header; current site is bold |
| Header "Sign in" (all three sites) | `tabulaspeech.com/signin/` | Same words, same place, one destination |
| Header primary button | Debate site and parent: `debate.tabulaspeech.com`; events: email for updates | |
| Debate header "Plans" | `tabulaspeech.com/plans/` | Plans live only on the parent |
| Debate header "Library" | `/learn/` | Same site |
| Footer (shared, all sites) | Products, Learn, Company, Legal | Legal and trust pages live only on the parent |
| Library pages | App | Library footer link (app repo, already planned) |
| Product sites | Parent | Footer brand block links to tabulaspeech.com |

## 5. Shared design system

- **Pictures:** `shared/pictures.css` holds the product pictures (HTML copies of the real app layout) and diagrams. It is the only file where Aff and Neg colours may appear. Illustrations come from ChatGPT with the prompts in [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md).
- **Tokens:** `shared/tokens.css`. Neutral values copy the app's `assets/tokens.css`, so sites and app match. Marketing adds display sizes (hero up to 64 px) and wider spacing.
- **Font:** Inter Tight for headings (self-hosted), system sans for body. No third-party fonts.
- **One frame:** family bar, header, footer and components are the same on all three sites. Only the mark, product name and accent change (`<html data-site>`).
- **Palettes:** each site has its own light and dark surfaces, so a visitor can tell which site they are on. The marks, fonts and components tie the family together.

| Site | Light | Dark | Buttons |
|---|---|---|---|
| Tabula Speech | Pure white `#ffffff` | Near-black `#0a0a0a` | Black / white. Small blue, red and sage dots and strips only |
| Tabula Debate | Cool slate `#f6f8fb` | Navy slate `#0b1019` | Ink. Red and blue only in the logo, round data (`shared/pictures.css`), the small family calls and the format cards |
| Tabula Speech Events | Warm cream `#faf8f2` | Green-black `#0e120e` | Sage `#4f6f58` / `#93b39a` |

- **Format cards (debate):** Policy is filled (available today). Lincoln-Douglas and Public Forum are pale red and blue tints (coming soon). Tokens: `--fmt-*`.
- **Marks:** the clipboard is constant. Light and dark SVG pairs follow the theme. Parent uses option C.
- **Light and dark:** system setting by default; a header button switches it (saved in the browser only).
- **Phone width:** every grid falls to one column; the nav folds into a menu that needs no script.
- **Accessibility:** WCAG 2.2 AA target. Text colors pass 4.5:1 in both themes. Visible focus ring. Skip link. `prefers-reduced-motion` respected.
- **Speed and safety:** static pages, one small script (theme), no third-party scripts, strict CSP in `_headers`.

## 6. What research changed

- The four-square stats strip was removed (ANTI-PATTERNS.md).
- "Sign in" sits in the same place on all three sites (§7).
- The family bar copies the Proton and 37signals "family" pattern (§8).
- The trust page uses "what we keep / what we never keep" lists (§6).
- Plans show the free plan first with a full list, no trial words, no fake discounts (§4).

## 7. Gates (Tier 1)

`node --test` in `~/Code/tabula-sites` runs `build.test.mjs` (11 tests, built into a temp folder):

1. The Debate Library is present for the build.
2. Every internal and cross-site link resolves.
3. Every page has a title, a description and one `h1`.
4. Scripts only from `/shared/`; no inline styles.
5. Prices appear only on the plans page, and only the owner-approved amounts.
6. No middle-dot fragment chains in page copy; no Library page count.
7. Aff, Neg, family-call and format colours stay out of brand UI and brand tokens.
8. Aff and Neg colours appear only in `pictures.css`, and never on links, buttons or menus there.
9. No raw colours in `site.css`.
10. The two dark-theme copies match; one dark block per site.
11. Each site ships `_headers`, `robots.txt`, `sitemap.xml` and `404.html`.

## 8. Decisions for the owner

See the final list in the hand-over. Short form:
1. Support email address shown on the sites (draft uses `support@tabulaspeech.com`).
2. "Get updates" for Speech Events: a plain email link (draft), or a tiny form on our own Worker.
3. Real app screenshots after Slice 4 (needs a demo round file in the app repo), or keep the HTML product pictures.
4. How the Pages build gets the Library: a second checkout of the app repo, a git submodule, or a published artifact.
5. Plan names on the public page: Free / Pass / Program (draft).
6. Public byline and links: "Made by Connor England" (BRAND.md §3 says it stays) and the GitHub handle in the source link.
7. Trust page claims: confirm each line before launch (hosted AI keeps no copy, provider no-training settings, audio deleted after).
