# Tabula Debate Library: plan

Status: the first 22 pages (5 first drafts and 17 wave-1 pages) are approved for v1 by both reviewers (2026-11-19). Wave 2 (39 pages) and wave 3 (16 pages) were written 2026-11-20 and wait for coach review. Every page in §2 now exists: 76 pages plus the library home. Owner: Pattern Engine LLC. Content license: CC BY-SA 4.0 (see `LICENSE.md` in this folder). The app code stays AGPL-3.0.

## 1. What this is

A free reference library for high school policy debate. It sits in two places:

1. **In the app**, under the **?** help menu, as "Debate library". It works offline, like the rest of Tabula.
2. **On the website**, at `tabuladebate.com/learn/...`, as normal web pages that search engines can find.

The same Markdown files feed both. One source, two outputs.

**Who it is for**

- A **new parent judge** who got a phone call last night and judges at 8 a.m.
- A **novice debater** in their first season.
- An **experienced flower**: a varsity debater, coach or ex-debater judge who wants a clean, fair statement of a theory idea, or wants a page to send to a novice.

The full reader definitions, and which reader each page is written for, live in `READERS.md`.

**What "done well" looks like**

- A parent can read one page in 5 minutes and judge a fair round.
- A novice can go from "what is a DA?" to "I can extend a DA and do impact calculus" by following links.
- An experienced reader finds nothing wrong, nothing slanted, and a few things they want to quote to their team.

**Why it helps Tabula**

- It helps the people the app is for (judges and debaters) at the moment they need it, inside the app.
- It is good search content. People search "what is a kritik in debate" and "how to judge policy debate" every season. One clear page per question can rank, and each page gently points to the free app.
- It builds trust with coaches. A coach who sends a novice to our "How to flow" page is a coach who will try the flow tool.

## 2. Information architecture

Eleven sections. Each section has an overview page (the hub) and topic pages. One topic per page. Slugs are short, lowercase, hyphenated, and stable (never change a slug once it is live; add a redirect if you must).

Marks: **[D]** = drafted in this pass. **[1]** = write next (wave 1). **[2]** = wave 2. **[3]** = wave 3.

### 2.1 Start here

| Page | Slug | Wave |
|---|---|---|
| Debate library home (reading paths, search) | `/learn/` | 1 |
| Debate 101: what policy debate is | `/learn/debate-101` | **D** |
| Glossary (every term, one line each, links out) | `/learn/glossary` | 1 |
| Judging your first round (parent judge quick start) | `/learn/first-round-judge` | 1 |

### 2.2 The round

| Page | Slug | Wave |
|---|---|---|
| Speeches, order and times | `/learn/speeches-and-times` | 1 |
| Cross-examination | `/learn/cross-examination` | 1 |
| Prep time | `/learn/prep-time` | 2 |
| How to flow | `/learn/how-to-flow` | **D** |
| Flow shorthand and symbols | `/learn/flow-shorthand` | 1 |
| Evidence and cards (tag, cite, text, reading "clipping") | `/learn/evidence-and-cards` | 1 |
| Speaker points | `/learn/speaker-points` | 1 |
| The ballot and the RFD (reason for decision) | `/learn/ballot-and-rfd` | 1 |
| Oral critiques and feedback | `/learn/giving-feedback` | 2 |
| Speech docs and email chains | `/learn/speech-docs` | 2 |
| Round conduct, safety and evidence ethics | `/learn/round-conduct` | 2 |

### 2.3 The affirmative case and stock issues

| Page | Slug | Wave |
|---|---|---|
| The affirmative case (plan, advantages) | `/learn/affirmative-case` | 1 |
| Stock issues overview | `/learn/stock-issues` | 1 |
| Harms | `/learn/harms` | 2 |
| Inherency | `/learn/inherency` | 2 |
| Solvency | `/learn/solvency` | 2 |
| Significance | `/learn/significance` | 2 |
| Advantages and internal links | `/learn/advantages` | 2 |
| Case turns and case defense | `/learn/case-turns` | 2 |

Topicality is also a stock issue. Its page lives in its own section (2.6) because it is big. The stock issues page links to it.

### 2.4 Disadvantages

| Page | Slug | Wave |
|---|---|---|
| Disadvantages (DA) overview | `/learn/disadvantages` | **D** |
| Uniqueness | `/learn/uniqueness` | 2 |
| Links and link turns | `/learn/links` | 2 |
| Internal links | `/learn/internal-links` | 2 |
| Impacts | `/learn/impacts` | 2 |
| Answering a DA (the 2AC block) | `/learn/answering-disadvantages` | 2 |
| Common DA shapes (politics, economy, trade-off, spending, "spillover") | `/learn/common-disadvantages` | 3 |

### 2.5 Counterplans

| Page | Slug | Wave |
|---|---|---|
| Counterplans (CP) overview | `/learn/counterplans` | 1 |
| Counterplan text | `/learn/counterplan-text` | 2 |
| Competition (mutual exclusivity, net benefits) | `/learn/competition` | 2 |
| Net benefits | `/learn/net-benefits` | 2 |
| Permutations | `/learn/permutations` | 2 |
| Solvency deficits | `/learn/solvency-deficits` | 2 |
| Common CP shapes (states, agent, advantage, process, consult, PIC) | `/learn/common-counterplans` | 3 |

### 2.6 Topicality

| Page | Slug | Wave |
|---|---|---|
| Topicality (T) overview | `/learn/topicality` | **D** |
| Interpretation and violation | `/learn/topicality-interpretation` | 2 |
| Standards (limits, ground, precision, education) | `/learn/topicality-standards` | 2 |
| Voters, competing interpretations and reasonability | `/learn/topicality-voters` | 2 |
| Effects and extra topicality | `/learn/effects-and-extra-topicality` | 3 |

### 2.7 Kritiks

| Page | Slug | Wave |
|---|---|---|
| Kritiks (K) overview | `/learn/kritiks` | **D** |
| The link | `/learn/kritik-links` | 2 |
| The alternative | `/learn/kritik-alternative` | 2 |
| Role of the ballot and role of the judge | `/learn/role-of-the-ballot` | 2 |
| Answering a kritik | `/learn/answering-kritiks` | 2 |
| Kritikal affirmatives | `/learn/kritikal-affirmatives` | 3 |
| Common kritik families, described fairly (capitalism, security, settler colonialism, anti-blackness, psychoanalysis, and others) | `/learn/common-kritiks` | 3 |

The "common families" page is the hardest page in the library to write fairly. It needs review by at least two coaches with different styles before it goes live.

### 2.8 Theory

| Page | Slug | Wave |
|---|---|---|
| Theory overview (what a theory argument is) | `/learn/theory` | 1 |
| Conditionality | `/learn/conditionality` | 2 |
| Reasons to reject: the argument or the team | `/learn/reject-the-team` | 2 |
| Common theory arguments (PICs bad, multiple actor fiat, international fiat, severance and intrinsic perms) | `/learn/common-theory` | 3 |
| Fiat (what it is and what it is not) | `/learn/fiat` | 1 |

### 2.9 Framework

| Page | Slug | Wave |
|---|---|---|
| Framework overview | `/learn/framework` | 1 |
| Framework against a kritik (weigh the plan) | `/learn/framework-vs-kritik` | 2 |
| Framework against a kritikal affirmative (T-USFG style) | `/learn/framework-vs-k-aff` | 3 |

### 2.10 Weighing and judging

| Page | Slug | Wave |
|---|---|---|
| Impact calculus (magnitude, probability, timeframe, and more) | `/learn/impact-calculus` | 1 |
| Turns case and "outweighs and turns" | `/learn/turns-case` | 2 |
| Presumption | `/learn/presumption` | 2 |
| Judge paradigms (stock issues, policymaker, tabula rasa, games, critic of argument) | `/learn/judge-paradigms` | 1 |
| Writing a paradigm | `/learn/writing-a-paradigm` | 2 |
| Adapting to your judge | `/learn/judge-adaptation` | 2 |
| Rebuttal strategy (2NR and 2AR choices) | `/learn/rebuttal-strategy` | 2 |

### 2.11 Timeless examples

These are the examples that come back every year, whatever the resolution. Each page explains one example in the generic form, shows a short flow, and links to the theory pages. No page names a topic year, a school or a student.

| Page | Slug | Wave |
|---|---|---|
| Timeless examples hub | `/learn/examples` | 2 |
| The spending / trade-off DA | `/learn/example-spending-da` | 2 |
| The politics DA (the plan costs the leader capital) | `/learn/example-politics-da` | 2 |
| The economy DA (plan hurts growth, growth prevents conflict) | `/learn/example-economy-da` | 3 |
| The states counterplan (50 states do the plan) | `/learn/example-states-cp` | 2 |
| The consult counterplan | `/learn/example-consult-cp` | 3 |
| The "word PIC" and plan-inclusive counterplans | `/learn/example-pic` | 3 |
| T: "substantial" and "its/their" style limits | `/learn/example-t-substantial` | 3 |
| The "status quo solves" case argument | `/learn/example-squo-solves` | 3 |
| Extinction vs structural violence: a weighing debate | `/learn/example-extinction-vs-structural` | 3 |
| Condo with 3+ advocacies: a theory debate | `/learn/example-condo-debate` | 3 |
| The cap K against a policy aff | `/learn/example-cap-k` | 3 |
| Framework vs a K aff | `/learn/example-fw-vs-k-aff` | 3 |

**Count:** 76 pages plus the library home, all written (2026-11-20). Wave 1 (22 pages with the first drafts) is approved for v1; waves 2 and 3 wait for coach review.

**Canonical pages (to stop overlap).** Some ideas show up in more than one section. One page owns each idea. Other pages give one or two sentences and link to it.

| Idea | Canonical page | Pages that only mention it |
|---|---|---|
| Internal links | `/learn/internal-links` | advantages, disadvantages |
| Net benefits | `/learn/net-benefits` | competition, counterplans |
| Turns case | `/learn/turns-case` | case-turns, disadvantages, kritiks |
| Fiat | `/learn/fiat` (move to wave 1: every CP and DA page needs it) | counterplans, theory |
| Speeches, CX, prep, evidence, points | their own pages | `debate-101` is the overview: a short paragraph on each, then a link |

## 3. Reading paths

Each path is an ordered list on the library home page. Guided tracks (`TRACKS.md`) add a short check after each page and save progress in the browser. The build step adds a small static "Reading paths" box at the foot of each page that is on a path, for example "New judge path: next, Speaker points". It needs no JavaScript and no URL parameter.

**The step lists live in `tracks.json`** (one source for reading paths and guided tracks; see `TRACKS.md` §2.9). The home page (`index.md`) shows the same order, and a test checks it.

### Path A: new parent judge (30 minutes)

Audience: a parent or community judge with no debate background. Track id `judge`. Promise: "You can judge a fair round today."

### Path B: novice debater (first month)

Audience: a first-year debater. Track id `novice`. Wave 1 shows pages that exist as links, and later pages as plain "coming soon" text. Promise: "You can run and answer the core arguments."

### Path C: experienced flower (pick a branch)

- **Theory branch:** Theory, Fiat, Conditionality, Reject the team, Common theory.
- **Critical branch:** Kritiks, Kritik links, Kritik alternative, Role of the ballot, Framework, Framework vs kritik, Kritikal affirmatives, Framework vs K aff.
- **Judge branch:** Judge paradigms, Writing a paradigm, Presumption, Turns case, Giving feedback.

Promise: "A fair, clear statement of each idea, good enough to send to your team."

## 4. Page template

Every topic page uses this shape. The drafted pages follow it.

```markdown
---
title: "Disadvantages in Policy Debate: Uniqueness, Link, Impact"   # SEO title, 50–60 chars
slug: disadvantages
description: "A disadvantage (DA) says the plan causes something bad. Learn the four parts, how to answer one, and how judges weigh it."   # 140–160 chars
section: Disadvantages
level: beginner | intermediate | advanced
reading_time: 6
sheet: DA            # optional; the app's flow sheet this page explains
related: [counterplans, impact-calculus, links, uniqueness]
updated: 2026-11-19
---

# Disadvantages (DA)

> **Plain version.** (One lead sentence, 30 words at most, then 1 to 4 points as
> "- **Short label:** one or two sentences". No jargon, or jargon explained at once.
> This is what the page shows first, under the label "The big idea".)

## The parts            (or "How it works")
## How to answer it      (for debaters)
## How to judge it       (for judges)
## Example in flow shorthand
## Common mistakes
## Related pages
```

There are two page types. Both start with the front matter, the H1 and the Plain version, and both end with the example, the common mistakes and the related pages. The middle differs:

- **Concept pages** (an argument, such as DA, T, K, CP): "The parts", "How to answer it", "How to judge it". Headings can name the argument ("How judges decide T").
- **Process pages** (a skill or part of the round, such as Debate 101 or How to flow): free middle sections, in the order a beginner needs them.

The build adds things that are not in the Markdown. Writers do not add them by hand:

- **The page frame** (redesign, 2026-11-20). A top bar that copies the tabuladebate.com header: brand (to the site home), Library, Coaches, School IT, Sign in, and "Open the app". A breadcrumb ("Library › section") and a meta line ("7 min read · Beginner"). A footer with the site links. The nav is copied from the site repo (`tabula-sites/layout.mjs`), so a nav change there must change `SITE_NAV` in `build-learn.mjs` too. The marketing-sites session tells the Library session when the site nav, footer or app address changes; nothing checks it automatically.
- **"On this page"** on article pages with 3 or more `##` headings. On wide screens it is a side list; on narrower screens `library.js` turns it into a floating button with progress, minutes left and the section list. Without the script, a fold-out list shows under the summary.
- The "Reading paths" box (section 3), as one card, and one soft call to action (section 7).

**Rules for the template**

- The **Plain version** comes first and stands alone. A parent who stops reading after it should still be right. Format: one lead sentence (30 words at most) with the core takeaway, then a blank `>` line and 1 to 4 points, each `> - **Short label:** one or two sentences`. A very short summary can be the lead sentence alone. The page shows it under the label "The big idea".
- One H1 per page. The H1 uses the common name and the short name: "Disadvantages (DA)".
- The deeper sections go from simple to hard. Advanced material sits at the bottom, under a heading that says so.
- Every **example** uses flow shorthand in a code block, with a one-line note under it. Keep it to the core moves. Every line in the block is 40 characters or fewer, so it reads on a phone: stack the speeches one under another instead of side by side. If the block uses short forms, put one line that starts with `Key:` just above it.
- **Common mistakes** has 4 to 7 items. Each one names the mistake and the fix.
- **Related pages** has 3 to 6 links, each with a few words on why to go there.
- `sheet:` ties the page to a flow sheet in the app (T, DA, CP, K, FW, Case).

## 5. Tone and style

Write each page for the reader `READERS.md` names for it, at the point in their season when they arrive.

- **Plain words. Short sentences.** One idea per sentence. Target grade 7 to 8 reading level for the Plain version, and grade 9 to 10 for the rest. (This matches the app's "Plain" reading level.)
- **Explain a term the first time it shows on a page**, even if another page explains it. Each page can be the first page a reader sees, because most come from search.
- **Second person** ("you") for debaters and judges. Say which one you mean when it matters ("If you are judging...").
- **Neutral on style.** Policy, kritikal, traditional and "lay" debate all get fair, respectful treatment. Say "some judges think X; others think Y" when the community disagrees. Never call a style cheating or lazy.
- **No inside jokes, no camp slang without a definition, no named people.** No student names. No coach names. No named schools, tournaments or topic years.
- **Timeless.** Do not tie an example to a real resolution. Use generic stand-ins: "the plan", "the federal government", "a new program", "a policy change in area X".
- **Honest about edges.** If a rule varies by league or region (for example, prep time amounts), say so and give the common value.

## 6. Sourcing rules

- **Original writing only.** Do not copy or close-paraphrase camp files, debate wikis, textbooks, videos or other sites. Write from understanding.
- **Facts that vary** (speech times, prep time, speaker point scales) use the common national high school format, and say that local rules can differ. Re-check these facts once a year.
- **Card examples are invented.** When a page shows evidence, it is a made-up card, marked as such, with a fake author like "Analyst 2021". Never quote a real card.
- **No real-world claims that need a citation.** The library teaches how arguments work. It does not argue that any policy is good or bad.
- **Review.** Each page gets one review by an experienced coach or judge before it goes live. The theory and kritik pages get two, from people with different styles.
- **Credit.** Reviewers can be thanked by name on a credits page, with their consent. Students are never named.

## 7. SEO plan

**One topic per page.** Each page answers one search question. Do not merge "what is a DA" and "how to answer a DA" into one huge page; link them.

**Titles.** Pattern: `<Term> in Policy Debate: <what you learn>`. 50 to 60 characters. Examples:

| Page | `<title>` |
|---|---|
| Debate 101 | Policy Debate 101: How a Round Works |
| How to flow | How to Flow a Debate Round: A Beginner's Guide |
| Disadvantages | Disadvantages in Policy Debate: Uniqueness, Link, Impact |
| Topicality | Topicality in Policy Debate: Interpretation to Voters |
| Kritiks | What Is a Kritik? Policy Debate Kritiks Explained |

**Slugs.** Under `/learn/`. Short, no dates, and no stop words except a joining "and" where it reads better (`speeches-and-times`): `/learn/disadvantages`, not `/learn/what-is-a-disadvantage-in-debate-2026`.

**Meta description.** 140 to 160 characters. Use the Plain version's lead sentence and first point as the base.

**Headings.** H2s match real questions ("How do you answer a disadvantage?") where it reads well. These can win "People also ask" spots.

**Internal links.**

- Every page links to its section hub and to 3 to 6 related pages.
- Every hub links to all its pages.
- The glossary links every term to its page. Every page links its key terms to the glossary only when no full page exists yet.
- Use descriptive anchor text ("how permutations work"), never "click here".
- Each page has one soft call to action at the bottom, added by the build: "Flow your next round in Tabula, free." No pop-ups. No email wall. The library stays free and readable without the app. The top bar's "Open the app" button is site navigation (it copies the site header), not a second pitch.

**Structured data.** Add `Article` and `BreadcrumbList` JSON-LD on each page. Add `FAQPage` only where the page truly has a Q&A block, and keep it honest. The glossary can use `DefinedTermSet`.

**Technical.** Static HTML, fast, mobile-first, readable without JavaScript. No inline scripts: the site's `_headers` sets a strict CSP (`script-src 'self'`). A sitemap. Canonical URLs. Open Graph images per section (one simple card per section is enough).

**What to measure.** Search Console: impressions and clicks per page. In-app: nothing is tracked (Tabula is local-first). Count only website visits, with a privacy-friendly counter, if any.

## 8. How the app links in

**Built (2026-11-19):** a "Debate library" item in the ? menu (`#library-link`; it was briefly a separate "i" button next to ?, and the owner moved it back into the ? menu); the sheet "ⓘ Learn" link in both the My flow and AI flow tab bars, with the `SHEET_PAGES` map (8.2; "Adv" sheets also map to the case page, "Case turns" sheets do not); and the local helper serving `learn/` (`bridge.mjs`). For a quick look without the helper, `.claude/launch.json` has a "library" static server on port 8771. Tests: `library-links.test.mjs` and the last test in `bridge.test.mjs`.

### 8.1 The ? help menu

Add one item to `#help-menu` in `index.html`, after "Tour this page":

```html
<a role="menuitem" href="learn/" target="_blank" rel="noopener">Debate library</a>
```

- `learn/` is the **built** output folder (see section 9), not the Markdown source. The app and the website serve the same folder at the same relative path, so one link works in both.
- Inside the Library, "Open the app" links to the app's web address, which is right on the website. When the Library is opened from the app, `learn/library.js` points it back to the app (the site root) as "Back to the app", so the reader never leaves the running app. This needs JavaScript (the app needs it anyway); without it the link goes to the app's web address.
- Offline is a goal, not a fact yet. The app has no service worker today (PLAN.md step 8 is not built). When step 8 lands, its offline cache should include `learn/`.

### 8.2 Sheet tabs (T, DA, CP, K, FW, Case)

Today, a sheet tab shows its full name in a long-hover tip (`data-tip` in `sheetTab()`, `app.js`). The tip has `role="tooltip"`. A tooltip should not hold a link: it vanishes when the mouse leaves, and a keyboard user cannot reach a link inside it. So:

- **Keep the tip as plain text.** Do not put a link or a key hint in it. (`sheetTab()` also sets `aria-label` to the full name, so screen readers never hear extra tip text.)
- **Put the real link on a small ⓘ button** at the right end of the flow toolbar. It opens the library page for the active sheet. Label it with the sheet name, for example `aria-label="Learn about Disadvantages"`. It can take focus, so keyboard users reach it.
- **Do not use F1.** The browser and some systems own that key, and the app does not handle it.
- **Add one new map** in `logic.js`, next to the sheet name tables: `SHEET_PAGES = { Case: 'affirmative-case', T: 'topicality', DA: 'disadvantages', CP: 'counterplans', K: 'kritiks', FW: 'framework' }`. (The existing `LONG_TO_SHORT` maps long names to short names. It is not this map.) Add a test that every `sheet:` value in the library front matter has an entry in `SHEET_PAGES`, so the two never drift.

### 8.3 Later

Other hooks (term links in the Plain decision draft, a link from the ballot filler, a last tour step) can wait until wave 1 is live.

## 9. Build and publish

1. **Now:** Markdown source in `docs/library/`. Drafts are reviewed in the repo.
2. **Wave 1:** about 17 pages. **Built:** `node build-learn.mjs` (no dependencies; tests in `build-learn.test.mjs`; styles in `docs/library/learn.css`) turns `docs/library/*.md` into static HTML in one output folder, `learn/` (`docs/library/disadvantages.md` → `learn/disadvantages/index.html`). The app bundle and the website both serve `learn/`. Style it with the shared tokens (`assets/tokens.css`, planned in PLAN.md step 9; it does not exist yet).
3. **Link rule.** Source pages link as `[text](slug.md)`, so links work on GitHub. The build rewrites each one to a relative link (`../slug/`), because the same files are served at `tabuladebate.com/learn/` and inside the app.
4. **Forward links.** Drafts link to pages that are not written yet (about 40 links today). The build must never publish a dead link. Rule: if a linked slug has no page yet, the build turns the link into plain text (the words stay, the link goes). When the page is written, the link comes back on the next build. The test `build-learn.test.mjs` then checks every remaining link and `#anchor` against the built pages, and a broken one fails `node --test`. A `related:` slug with no page is left out of the "Related pages" box.
5. **Private files.** The build only takes pages with front matter, and it skips `PLAN.md`, `LICENSE.md` and any `*.local.md` file (for example `REVIEWERS.local.md`, which git also ignores).
6. **Gate.** `node check-publish.mjs` now scans every built `learn/` page too. `node --test` fails if `learn/` is out of date with the Markdown, so always run `node build-learn.mjs` after editing a page.
   **Pictures:** `learn-visuals.mjs` places approved pictures (from `docs/library/visuals/`: slots, `status.json`, images) on their pages, copies them to `learn/img/`, and sets `og:image`. A broken approved picture (missing place, file, alt text, or over 1.5 MB) stops the build. See `docs/library/visuals/KICKOFF.md`.
   The local helper (`bridge.mjs`) serves `learn/` by path (only files inside it, with a known type), and redirects a page URL without its trailing slash. A plain static server (and Cloudflare Pages) already serves it.
7. **Live claims.** Do not publish wave 1 until both reviewers have reviewed it, because the home page says each page gets a coach review. **Done (2026-11-19):** both reviewers approved all 22 pages that existed then (the 5 first drafts and the 17 wave-1 pages) for v1. Later pages (wave 2 and up) and any changed page need the same review before they go live.
8. **Later:** the product help docs (PLAN.md step 10) and the library can share one docs site, with two sections: "Using Tabula" and "Debate library".

## 10. Decisions (2026-11-19)

1. **Content license: CC BY-SA 4.0.** Coaches may copy and adapt pages for handouts, with credit, under the same license. See `LICENSE.md`. The app code stays AGPL-3.0.
2. **URL root: `/learn/`.**
3. **Reviewers:** two working high school coaches (Reviewer A and Reviewer B). Their names are kept in `docs/library/REVIEWERS.local.md`, which git ignores, until each one agrees to be named. Status (2026-11-19): both approved all 22 pages that existed then for v1: the 5 first drafts (`debate-101`, `how-to-flow`, `disadvantages`, `topicality`, `kritiks`) and the 17 wave-1 pages. **Not yet reviewed:** the wave-2 pages written 2026-11-20. This item is the one place that records page review status. **Both asked not to be named for now.** Keep "Reviewer A" and "Reviewer B" everywhere public. No credits page with their names until they say yes.
4. **Local-circuit lens.** Both reviewers coach on a circuit with many lay and traditional judges. That fits the library's beginner-first aim. Pages describe the common national format, stay region-neutral, and say that local rules differ. Reviewers should flag any place where their local practice differs (for example, prep time, or how many judges expect stock issues).

## 11. Wave 1 page list

17 pages, plus the 5 drafts: library home (`index`), glossary, first-round-judge, speeches-and-times, cross-examination, flow-shorthand, evidence-and-cards, speaker-points, ballot-and-rfd, affirmative-case, stock-issues, counterplans, theory, fiat, framework, impact-calculus, judge-paradigms.
