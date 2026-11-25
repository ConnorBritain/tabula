# Debate Library: guided tracks, checks and completion badges (design doc, draft 3)

Status: owner decisions recorded (§9). **Phase 1 (first and second release) is built** (2026-11-19): `tracks.json`, the 6 parent judge checks (status: draft, waiting for coach review), `learn-tracks.mjs`, `check.js`, track pages, certificate, save/load/clear progress. The parent judge track shows as a draft (noindex, out of the sitemap) until each check has `status: reviewed`. Phases 2 and 3 are not built.
Related docs: `docs/library/PLAN.md` (the library), `PLAN.md` (the app), `docs/STUDENT-EDITION.md` §10 (coach and student roles), `BUSINESS-PLAN.md` §10 (legal table; private, git-ignored).

## 0. Summary

- A **track** is an ordered list of library pages with a short **check** (a quiz) after each page.
- The name is **track** ("Guided tracks"), decided 2026-11-19. "Program" stays the name of the paid school plan only (`BUSINESS-PLAN.md` §2, `STUDENT-EDITION.md` §10g).
- Build in three phases:
  1. **Phase 1:** tracks and checks, with progress saved only in the browser. No account. Safe for every age, because Tabula collects nothing.
  2. **Phase 2:** a **completion badge** for the judge tracks, on an account, for adults (18+) only. The judge earns it by passing a **server-graded final check**. A judge can share a verify link. It ships with the round-pack accounts.
  3. **Phase 3:** free student badges, with school or parent consent, private by default, with the privacy rules in §6.
- A badge says "this person finished a free, self-paced course". It is **not a certification**. See §7.

## 1. Goals and limits

**Goals**

- Make the library feel like a course, not only a reference shelf. A reader always knows the next step.
- Test understanding, not memory. A good check asks the reader to *use* the idea on a new flow or a new speech.
- Give parent judges something they can show a tournament: "I did the training."

**Limits (from the existing plans)**

- **Local-first.** The library works with no account and no server. Tracks must too.
- **Free, always** (`docs/library/index.md`). No sign-up wall in front of any page or per-step check. Only the optional final check for a badge needs sign-in (§5.3).
- **No inline scripts.** The site CSP is `script-src 'self'` (`_headers`). Any quiz logic is one small self-hosted `.js` file.
- **Pages work without JavaScript** (`docs/library/PLAN.md` §7).
- **No gamified practice.** `STUDENT-EDITION.md` §10c bans streaks, points, login badges and leaderboards. Decided (§9, item 2): a completion badge for finishing a track is allowed. The ban on streaks, points, levels, login badges and leaderboards stays.
- **Minors.** Most debaters are 13 to 17. Some are younger. Privacy decides the design (§6).

## 2. The tracks

Each track lists library slugs from `docs/library/PLAN.md` §2, in order. Each step has a check. A step whose page is not written yet is marked *(planned)*.

**Rule: a track goes live only when every step page exists and every step's check has `status: reviewed`.** The build enforces this (`trackState()` in `learn-tracks.mjs`; §3.2). Coach approval of the pages themselves is tracked in `docs/library/PLAN.md` §10 item 3, not by the build. Order: a page is reviewed first, then its check.

The "Ready" counts and *(planned)* marks below are a snapshot (2026-11-20). For the current state, run `node build-learn.mjs`: `trackState()` reports each listed track as ready or live. A track with "coming soon" steps cannot be finished, so it cannot give a badge. Until then, the reading path on the library home page does the job.

### 2.1 New parent judge (time: the `minutes` field in `tracks.json`; the optional final check for a badge adds about 10 minutes)

Step order lives in `docs/library/tracks.json` (entry `judge`); if this table and that file differ, the file wins. This table gives what each check includes. Promise: "You can judge a fair round today."

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `debate-101` | Name which speech comes next, and which side gives it, at four points in the round. |
| 2 | `first-round-judge` | Choose what to do in common judge problems: keeping time, a new argument in the 2AR, what to vote on, and being confused at the end. |
| 3 | `how-to-flow` | Find the dropped part of a DA on a short flow, say what a drop means, why answers are lined up, and what to write. |
| 4 | `speaker-points` | Say which of two described speakers deserves higher points, and why (no point scale, because scales vary by league); points apart from the win; what points rate. |
| 5 | `ballot-and-rfd` | Pick the RFD that explains the decision, where to start deciding, and what to do when no one weighed. Also a self-check: write a short RFD on a topicality flow (§3.3). |
| 6 | `impact-calculus` | Name the measure a team uses (size, likelihood, timing), and choose which team weighed better. (The check covers only the plain summary, as path A says.) |

**Status:** built (2026-11-19). All 6 pages are approved. The 6 checks are drafts (`status: draft`), so the track is a draft (noindex) until coach review.

### 2.2 Novice debater (first month)

Step order lives in `docs/library/tracks.json` (entry `novice`); if this table and that file differ, the file wins. This table gives what each check includes. Promise: "You can run and answer the core arguments."

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `debate-101` | (Same check as 2.1, step 1.) |
| 2 | `speeches-and-times` | Say what a speech may and may not do (for example, no new arguments in rebuttals). |
| 3 | `how-to-flow` | (Same check as 2.1, step 3.) |
| 4 | `flow-shorthand` | Read a line of shorthand and say what it means. |
| 5 | `affirmative-case` | Read a short new case and say which part a given neg attack hits (the plan, the harm, or solvency). |
| 6 | `stock-issues` | Spot which stock issue a neg answer attacks. |
| 7 | `disadvantages` | Find the missing part of a DA on a flow (example in §3.2). |
| 8 | `answering-disadvantages` | Pick the answer that is a turn, not just defense. |
| 9 | `counterplans` | Say whether a CP competes with a given plan. |
| 10 | `permutations` | Pick the perm that tests competition. |
| 11 | `topicality` | Read a new plan and a short T shell: find its parts, and say whether the plan meets the interpretation. (One check, shared with 2.8, step 1.) |
| 12 | `cross-examination` | Pick the CX question that sets up a later argument. |
| 13 | `impact-calculus` | (Same check as 2.1, step 6.) |
| 14 | `rebuttal-strategy` | Choose what the 2NR should go for, from a flow. |

**Status:** built (2026-11-21). All 14 checks are written (11 new drafts), so the track is built as a draft (noindex) until coach review. The 3 wave-2 pages still need coach review (`docs/library/PLAN.md` §10 item 3), then review of the checks. **Badge:** yes, for students in Phase 3, so this track also needs its own hidden final-check pool (§5.3).

### 2.3 Intro to the K

Prerequisite (suggested, not enforced): the novice track, or `disadvantages` and `framework`.

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `kritiks` | Label the link, impact and alternative in a short K shell (example in §3.2). |
| 2 | `kritik-links` | Tell a specific link from a generic one. |
| 3 | `kritik-alternative` | Say what the alternative asks the judge to do. |
| 4 | `role-of-the-ballot` | Say what a given role-of-the-ballot claim would change about the decision. |
| 5 | `framework-vs-kritik` | Match each side's framework claim to its answer (aff: weigh the plan; neg: weigh the kritik first), fair to both sides. |
| 6 | `answering-kritiks` | Pick the answer that is a permutation, and the one that is a link turn. |
| 7 | `example-cap-k` | Read a short flow of the cap K debate and say which side is ahead on the link. |

**Status:** built (2026-11-21) as track `kritik`. All 7 checks are drafts, so the track is a draft (noindex) until coach review. The `common-kritiks` page is left out on purpose: it is the hardest page to write fairly (`docs/library/PLAN.md` §2.7), and a quiz on it risks a "right answer" about a contested idea.

### 2.4 Theory basics

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `theory` | Find the interpretation, violation, standards and voter in a theory shell. |
| 2 | `fiat` | Tell a fiat answer from a solvency answer. |
| 3 | `conditionality` | Say what "conditional" means for a CP the neg can drop. |
| 4 | `reject-the-team` | Say whether an argument asks to reject the argument or the team. |
| 5 | `common-theory` | Read a short 1NC and say which theory argument the aff could make against it, and why. |
| 6 | `example-condo-debate` | Read a condo flow and find what each side's interpretation is. |

**Status:** built (2026-11-21) as track `theory`. All 6 checks are drafts, so the track is a draft (noindex) until coach review.

### 2.5 Judging well: decisions and RFDs

For judges who have done the parent track, or who judge often.

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `judge-paradigms` | Say how two paradigms would decide the same short flow differently. |
| 2 | `ballot-and-rfd` | (Same check as 2.1, step 5, which includes the RFD self-check.) |
| 3 | `presumption` | Say who wins when nothing changed in the round. |
| 4 | `turns-case` | Spot a "DA turns case" claim and what it does to the weighing. |
| 5 | `round-conduct` | Choose the right step when an evidence ethics claim comes up. |
| 6 | `giving-feedback` | Pick the oral feedback that is specific and kind. |
| 7 | `writing-a-paradigm` | Self-check a short paradigm draft for the 4 things debaters look for. |

**Status:** built (2026-11-21) as track `judging`. All its checks are drafts, so the track is a draft (noindex) until coach review. This track has a badge, so it also needs its own hidden final-check pool (§5.3).

### 2.6 Policy vs K: framework

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `framework` | Say what a framework argument asks the judge to weigh. |
| 2 | `framework-vs-kritik` | (Same check as 2.3, step 5.) |
| 3 | `role-of-the-ballot` | (Same check as 2.3, step 4.) |
| 4 | `kritikal-affirmatives` *(planned)* | Say what a K aff does instead of a plan. |
| 5 | `framework-vs-k-aff` *(planned)* | Find the interpretation and the main standard in a T-USFG style shell. |
| 6 | `example-fw-vs-k-aff` *(planned)* | Read the flow and say which impact each side weighs. |
| 7 | `example-extinction-vs-structural` *(planned)* | Say what each side must win to make its impact come first. |

**Ready:** 3 of 7 pages written. Missing: `kritikal-affirmatives`, `framework-vs-k-aff`, `example-fw-vs-k-aff`, `example-extinction-vs-structural` (wave 3). Checks here must be **fair to both sides**. No question has "policy is right" or "the K is right" as its answer. The questions test that you can see what each side argues. Both reviewers (Reviewer A and B) check this track.

### 2.7 Counterplans and competition

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `counterplans` | Say whether a CP competes. |
| 2 | `counterplan-text` | Spot what a CP text leaves out. |
| 3 | `competition` | Tell mutual exclusivity from net benefits. |
| 4 | `net-benefits` | Find the net benefit on a flow. |
| 5 | `permutations` | Pick the perm that tests competition. |
| 6 | `solvency-deficits` | Weigh a small solvency deficit against a net benefit. |
| 7 | `example-states-cp` | Read the states CP flow and say what the aff must win. |

**Ready:** 7 of 7 pages written; it needs its checks and coach review.

### 2.8 Topicality

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `topicality` | (Same check as 2.2, step 11.) |
| 2 | `topicality-interpretation` | Say whether a plan meets an interpretation. |
| 3 | `topicality-standards` | Match a standard (limits, ground) to the claim it makes. |
| 4 | `topicality-voters` | Tell competing interpretations from reasonability. |
| 5 | `example-t-substantial` *(planned)* | Read the flow and say who wins the limits debate. |

**Ready:** 4 of 5 pages written. Missing: `example-t-substantial` (wave 3).

### 2.9 One list for tracks and reading paths

Built in Phase 1 (2026-11-19):

- `docs/library/tracks.json` is the **one source** for track step lists. Its schema is checked by `loadTracks()` in `learn-tracks.mjs`; read that, not this doc, for the exact fields.
- Two fields carry design meaning. `pathName` makes a track also a reading path: the "Next on your path" box shows only for those entries, with labels "New judge path" and "New debater path". `badge` marks a track that will give a badge in Phase 2 or 3, and `audience` (`judge` or `debater`) decides who may earn it (§5.2, §6.2: students never earn a judge badge). Phase 1 reads neither, and `loadTracks()` does not validate them yet. **Phase 2 must validate both**, because a wrong `audience` would weaken a privacy rule.
- `home` (optional, added 2026-11-21) holds the heading id of a "Pick your path" card on the library home page (for example `i-already-know-debate-pick-a-branch`). The card then lists the track, once it is built. A track with no `home` is listed on a card only when its steps equal that card's numbered list, in order. The build stops with an error if `home` names a card that does not exist, so renaming a path heading means updating `home`. One built track on a card shows "Take it as a guided track"; several show a list.
- `build-learn.mjs` builds the reading paths from `tracks.json` with `readingPaths(tracks)`. The old hard-coded `PATHS` lists are gone. A test still checks that `index.md` lists each path's written pages in the same order.
- `docs/library/PLAN.md` §3 points to `tracks.json` for the step lists.
- Tracks 2.3 to 2.5 are in `tracks.json` (2026-11-21, ids `kritik`, `theory`, `judging`), listed on the home page's "I already know debate" card through their `home` field. Tracks 2.6 to 2.8 are not in `tracks.json` yet. When one is added, its order there wins, and this doc keeps only its check-intent table. Tracks 2.4 to 2.6 replace the PLAN.md §3 Path C branches.

## 3. Checks

### 3.1 Where they live

- One check file per page: `docs/library/checks/<slug>.md`. A sibling folder keeps check files out of the page list (`isPageFile()` only reads the top folder, and check files have no `slug:` key).
- A track reuses a page's check. A page has one check, even if it is on three tracks.
- Checks and `tracks.json` use the same license as the pages (CC BY-SA 4.0; `LICENSE.md` names both). Coaches may reuse questions.
- Each check has 3 to 5 questions. To pass, you get every question right. You can try again at once, as many times as you want. Each answer shows a short "why". The goal is learning, not a score. No score is shown or kept, only "done".

### 3.2 File format

The format looks like the Markdown the library already uses, so writers need to learn little. The builder needs no new dependency. But it needs a **new, small parser**, `parseCheck()`, because the page renderer `markdown()` in `build-learn.mjs` is built for topic pages (its list reader has no checkbox rule). `parseCheck()` and the track and check rendering live in `learn-tracks.mjs`. The parser is strict and imports nothing from the builder; the renderer gets the builder's escape, inline and fence helpers passed in. Check files are read only from `docs/library/checks/`, never by `loadPages()`. The parser's error messages are the full rule list; the rules below are the ones writers meet most.

````markdown
---
page: disadvantages
version: 1
status: draft
---

## Which part is missing?

The neg reads this DA in the 1NC.

```
1NC  DA: Spending
U: budget balanced now
L: plan costs $50B
I: cuts to school lunch -> more hunger
```

In words: the budget is balanced now; the plan costs 50 billion dollars;
the impact is cuts to school lunch.

Which part of this DA is missing?

- [ ] Uniqueness
- [ ] Link
- [x] Internal link
- [ ] Impact

**Why:** The link says the plan costs money. The impact is about cuts.
Nothing says that a new cost *forces* cuts. That step is the internal link.
The 2AC can point at the gap: "No internal link."
````

Rules:

- Front matter: `page` (the slug, same as the file name), `version` (a whole number), and `status` (`draft` or `reviewed`; default `draft`). **A track is live only when every step's check is `reviewed`** (§2 live rule). A reviewer's approval is what changes a check to `reviewed`. A draft track gets `noindex` and stays out of the sitemap (§3.4).
- Each check has 3 to 5 questions.
- `## heading` starts a question. The heading is the short question name.
- The **paragraph right before the choices** is the question prompt. Paragraphs and flows above it are the setup. After the choices, only the `**Why:**` paragraph may follow.
- Inside a question, use only paragraphs, code fences and the one choice list. No other lists, headings, tables or `>` quotes.
- A code fence holds a flow. **Every flow has an "In words:" line under it**, because a screen reader reads a flow grid badly.
- `- [x]` marks a right choice, `- [ ]` a wrong one. One `[x]` is a single-choice question (radio buttons). Two or more is "pick all that apply" (checkboxes), and then the prompt must say "Pick all that apply"; with one right choice it must not. A choice question has 2 to 5 choices. No "all of the above".
- `**Why:**` starts the explanation. Every question needs one.
- `version:` goes up when the page or the check changes in a way that matters (§3.5).
- A `**Self-check:**` block (§3.3) replaces the choices for writing tasks, in exactly this order: task paragraph, `**Self-check:**`, checklist, `**Model answer:**`, `**Why:**`. The task is the paragraph before `**Self-check:**`. Under `**Self-check:**` comes the checklist, written as `- [ ]` items (inside a self-check block these are ticks for the reader, not quiz choices; at least 2 items). Then `**Model answer:**` gives a model answer. It still ends with `**Why:**`.

More examples, to set the bar for writers:

- **K shell (Intro to the K, step 1).** "The 1NC says: (1) The plan treats other countries as threats. (2) Seeing the world as threats makes wars more likely. (3) The judge should vote neg to reject threat-based thinking. Which sentence is the alternative?" Answer: (3). Why: the alternative is what the K asks the judge to do instead.
- **Theory shell (Theory basics, step 1).** "The 2AC says: 'Condo is bad. The neg should get one conditional advocacy. They ran three. That kills aff strategy. Reject the team.' Which sentence is the interpretation?" Answer: "The neg should get one conditional advocacy." Why: the interpretation is the rule the aff says the neg should follow.
- **New in the 2AR (parent judge, step 2).** A short flow. The 2AR makes a link turn that was not in the 2AC. "How do most judges treat this argument?" Answer: they do not count it, because the neg had no speech left to answer it. Why also says: "Some judges want the neg to point this out in the round. Most will not count it either way."

Things writers must avoid:

- Questions about facts that vary by league (exact prep time, point scales). Say "in the common national format" or leave them out.
- Questions where good coaches disagree on the answer. If coaches disagree, the question asks what each side *claims*, not who is right.
- Trick choices and "all of the above".
- Named people, schools, topics or years (`docs/library/PLAN.md` §5).

### 3.3 Self-checks for writing tasks

Some skills (writing an RFD, writing a paradigm) cannot be graded by choices. For these:

1. The page shows a short flow and asks you to write a two-sentence RFD in a text box.
2. You press "Compare". The page shows a model RFD and a checklist: "Did yours say who won? Name the key argument? Say why it outweighed?"
3. You tick the items your RFD covered. When you tick them all, the step is done.

The text you write **never leaves the browser** and is **not saved**. The page clears it when you leave. Only "step done" is saved.

### 3.4 How the build renders a check (static HTML, no inline script)

`build-learn.mjs` adds a `<section class="check">` at the foot of the page, after "Related pages" and before the "Next on your path" box.

**Without JavaScript** (and in search results): each question is a plain list of choices, and the answer and the "why" sit in a `<details>` box ("Show the answer"). The page is complete and useful. Nothing is saved.

**With JavaScript:** the page loads one file, `learn/check.js`, with `<script src="../check.js" defer>` (topic pages), `./check.js` (the home page) or `../../check.js` (track pages). Built: `shell()` now takes the page depth, so track pages at `learn/tracks/<id>/` (depth 2) get correct CSS, script, brand, font, canonical and JSON-LD links. `tracks` is a reserved slug, so no page `tracks.md` can collide. The CSP allows it, because it is on the same site. The script:

- turns each question into a `<fieldset>` with a `<legend>` and radio buttons or checkboxes;
- adds a "Check my answers" button (`type="button"`, not a form submit: the CSP has `form-action 'none'`);
- marks each answer right or wrong, with words and an icon, not color alone, and shows the "why";
- reports the result in an `aria-live` region, so screen readers hear it;
- saves "step done" in the browser when every answer is right (§4).

The right answers are in the page HTML (in `data-key` attributes and in the `<details>` boxes). Anyone can read them. That is by design: per-step checks are for learning. The badge rests on the separate, server-graded final check (§5.3), whose answers are never in the page.

Size target: `check.js` under 300 lines, no libraries. `learn.css` gets the check styles.

`check.js` is **code**, so it is licensed AGPL-3.0 like the app, not CC BY-SA. Keep its source out of `docs/library/` (for example in the repo root, copied into `learn/` by the build).

**Safety.** The hosted app now lives on its own origin (`debate.tabulaspeech.com`, `docs/architecture/ARCHITECTURE.md` §3), so the hosted library no longer shares storage with judges' API keys. It is also a different registered domain from the apps, so it gets no sign-in cookie, and it must never hold keys (`docs/architecture/ARCHITECTURE.md` §3.6). The local helper still serves the app and `learn/` from one `localhost` origin, so the old rule stays: `check.js` reads and writes only its own key (`tabula.learn.v1`), never builds HTML from stored text, and gets the same review as app code.

**New track pages.** The build also makes `learn/tracks/index.html` (all tracks) and `learn/tracks/<id>/index.html` (one track: its promise, steps and links). Without JavaScript, a track page is an ordered list of links. With JavaScript, `check.js` adds a tick next to each finished step and a "Resume" link to the first unfinished one. The library home gets a short "Guided tracks" section that links to `learn/tracks/`.

**Tests** (built in Phase 1; parser and track tests are in `learn-tracks.test.mjs`, page tests in `build-learn.test.mjs`):

- the parser rules in §3.2, the `page:` link to a real page, and the live rule (a track is live only when every check is `reviewed`);
- built pages hold no inline script. The existing test was edited (the diff is visible): it allows only the JSON-LD data tag and `<script src="…check.js" defer>` (at any depth), and it fails on an `on*=` handler. **Phase 2:** `final-check.js` is served by the `tabulaspeech.com` site, not `learn/`, so this test does not cover it. That site's build (`build-home.mjs`) needs the same no-inline-script test;
- built pages still pass the freshness test (`learn/` matches the Markdown).

**Still open:** the guard test in §5.3 (a subfolder file or a `*.local.md` file in the source folder never reaches `learn/`). The existing "private and planning files are never published" test covers top-level `*.local.md` files only.

`node check-publish.mjs` already scans every page in `learn/` for `todo` and `href="#"`, so the track pages get those checks. Its remote-script scan now also covers `learn/check.js` (built). **Phase 2:** extend `check-publish.mjs` to scan the `tabulaspeech.com` site's build output too (including `final-check.js`), with the same remote-script and placeholder checks. Until then nothing guards that script.

The existing tests read every built page. Track pages must pass them too: a 140 to 160 character description, one H1, a canonical URL, the call to action, and working relative links and anchors. Live track pages go in `learn/sitemap.xml` (they are public content). A draft track (a check not yet reviewed) and the track list while no track is live get `noindex` and stay out of the sitemap.

**Local helper.** Built: `bridge.mjs` now serves `.js` from `learn/` (`LEARN_TYPES`), with a test in `bridge.test.mjs`, so the checks work through the helper.

### 3.5 Versions

- **Built:** progress stores the check `version` for each step. When the check's version is newer, the check's status line says the page was updated since then.
- **Not built yet:** a "Page updated: review" note on the track-page tick, and track versions. The rule stays: the step stays done, the track stays finished, and old badges stay valid.
- A big rewrite of a track (steps added or removed) gets a new track version. A badge names the track version it was earned on.

## 4. Phase 1: tracks with progress in the browser (no account)

**What the user gets**

**Built (2026-11-19): both releases below.** The **first release** was: checks, ticks on track pages, "Resume", and "Clear my progress". The certificate and export/import can follow in a **second Phase 1 release**. (The name "Phase 1b" means only the novice track, §10.) For versions, see §3.5 (part built).

- Track pages with ticks, a "Resume" link, and a progress line ("4 of 6 steps done").
- A **certificate of completion you print yourself.** At the end of a track, the track page offers "Print a certificate". It is a view that `check.js` draws on the track page, with print styles in `learn.css`. It is not a separate built page. You type the name you want on it. The name stays in the page and is never saved or sent. The certificate says what it is: "completed the Tabula *New parent judge* track. A free, self-paced course from the Tabula Debate Library. Not a certification or endorsement by any league or tournament. Not verified." The user can print it or save it as a PDF.
- **Export and import** progress as a small file, to move to another device. **Clear my progress** removes it all.

**What is stored, and where**

- One `localStorage` key, for example `tabula.learn.v1`:
  `{ "steps": { "disadvantages": { "v": 1, "done": "2026-11-19" } }, "tracks": { "judge": { "done": "2026-11-20" } } }`
- Only slugs, check versions and dates. No answers. No names. No time spent. No count of tries.
- Nothing goes to any server. There is no analytics in the library. This should keep Phase 1 outside COPPA, because Tabula collects no personal information from anyone. (This is not legal advice. Counsel should confirm it before launch.)

**Things to know**

- `localStorage` belongs to one origin (one site address). Library progress lives on `tabuladebate.com`. The hosted app is on `debate.tabulaspeech.com` and does not read it. Progress through the local helper (`bridge.mjs`, `localhost`) is separate. Export and import fix this.
- On a **shared school computer**, the next user sees the progress. The track page shows a short note and the "Clear my progress" button.
- A browser in private mode, or one that blocks storage, loses progress when it closes. `check.js` must work when storage throws (wrap every read and write in `try/catch`; the check still marks answers, it only cannot save).

**Size:** about 1 to 1.5 weeks of code (track data file, check parser and renderer, `check.js`, track pages, certificate page, tests). Writing the checks for the parent judge track: about 1 to 2 hours per check (about 2 days for 6), then coach review, which is a wait, not work. **First release: the parent judge track only (6 checks).**

## 5. Phase 2: judge completion badge on an account (adults only)

### 5.1 Why

**Note on order.** Root `PLAN.md` §6 plans accounts as work to do before charging for round packs. Decided (§9, item 4): the judge badge **waits** for the round-pack account system, and both use it. Phase 1 needs no account and ships first. The library stays free and readable signed out.

- Some leagues and tournaments offer or ask for judge training. A parent judge who did the Tabula track wants a way to show it.
- A badge also gives a reason to make an account, which the paid plans will need anyway.

### 5.2 Who can get one

- **Adults only (18+).** The account sign-up asks the user to confirm they are 18 or older. This is like the buyer rule in `BUSINESS-PLAN.md` §10 row 6 (buyers must be 18+), but it is a separate rule: a badge account buys nothing.
- Only tracks marked `badge: true` and `audience: judge`: at first, **New parent judge** (2.1); later **Judging well** (2.5).
- Student judges (often 16 or 17) do not get a judge badge, in Phase 2 or Phase 3, until the owner decides otherwise (§9, item 10). They can still read the judge tracks and do the per-step checks.

### 5.3 How a judge earns it

Decided (§9, item 3): the badge needs a **server-graded final check** from day one. The per-step checks stay open in the page, for learning. Only the final check counts for the badge.

1. The judge does the track, with the per-step checks, as in Phase 1. No account is needed for this part.
2. At the end, the track page offers "Take the final check for a badge". It is a plain link to `tabulaspeech.com/badges/check/<track>?v=<version>`, where accounts live. Only now must the judge sign in (§8). The library never calls the server: a sign-in cookie cannot cross from `tabulaspeech.com` to `tabuladebate.com` (`docs/architecture/ARCHITECTURE.md` §3.5).
3. The server picks about 12 questions from a **hidden pool** for that track (a pool of about 40 for a 12-question try, so two tries rarely match). It sends the questions and choices with **no answer keys**.
4. The judge answers and submits. The server grades the answers. **Pass mark: 80% (10 of 12).**
5. **Pass:** the server saves the badge (§5.5). The page shows the verify link and the certificate.
6. **Fail:** the page shows the sections (library pages) where the judge was weak, with a link to each page to reread. It does **not** show which answers were wrong, so the pool stays useful. Then:
   - The judge can retry after **5 minutes**. After several fails in one day, the wait **grows**: 5 minutes, then 15, then 60 (§9, item 11). The server enforces the wait. It resets the next day.
   - The page offers an **optional cool-down timer** that matches the current wait. The judge can read the linked pages while it runs. When it ends, the timer shows a link back to the retake. The timer runs in the self-hosted script; it is a help, not the rule.
   - Each retry draws new questions from the pool. There is **no limit** on tries.
   - The grade reply carries the weak-section slugs. The page keeps them in the browser, so the reading links survive a reload. The server does not keep them.

**Serving and grading.** The server gives each try an attempt token and remembers which question IDs it served, so the browser cannot choose its own questions. It grades only those IDs, then deletes the attempt.

**Pool leaks.** With no limit on tries, someone could take the check many times to collect the pool. The 5-minute wait slows this. The **growing wait** (5, then 15, then 60 minutes after several fails in one day) slows it more, and tries stay unlimited (§9, item 11).

**Pool rules.** No pool question may copy or lightly reword a public per-step check question, because those answers are public. The private-repo review checks this for every new question. The pool's format checks and tests live in the private repo. The server may reuse the question rules of `parseCheck()` (in `learn-tracks.mjs`, with no builder imports) while Pattern Engine LLC holds all of its copyright; if outside contributions change that, write a separate parser. **Not built:** `parseCheck()` today needs 3 to 5 questions per file and has no section tag. In Phase 2, either split the pool into files of 3 to 5 questions (one file per section, so the file names the section), or give `parseCheck()` a limits option and a `section` field. Final-check questions follow the same writing rules as other checks (§3.2), but they live in the **private server repo** (or server storage seeded from it), never in this repo. This repo is, or will be, public (AGPL on GitHub), so any committed file, and its git history, is public. The pool is also **not** CC BY-SA and not part of the library license (`LICENSE.md` covers the Markdown in `docs/library/`), so keep it out of that folder.

**Guard (still open).** Add a test to `build-learn.test.mjs` that puts a subfolder file and a `*.local.md` file in the source folder and checks that neither reaches `learn/`. Today only code habits protect this (`loadPages()` reads one folder, `isPageFile()` skips `*.local.md`). Each question is tagged with its section (a page slug), so the server can name weak sections. Writers add new questions and retire old ones each season, because answers can leak over time. The pool gets the same coach review as the pages.

**Code size.** Phase 2 browser code (the final check and the cool-down timer) goes in its own file, for example `final-check.js`, served by the `tabulaspeech.com` site build, not in `learn/`. `check.js` stays small.

#### Old versions and retired tracks (proposal, needs the owner's yes)

If the `v=` in the link is older than the live track version, the check page says the track changed and links to the new version in the library. A retired track shows "This track is no longer offered" and a link to its replacement. After a pass, the page links **Back to the Library**. The library itself never shows "badge earned"; its copy says the badge lives on the account.

**What it means.** The badge now says the judge *passed a final check*, not only that they say they finished. It is still a completion badge, not a certification (§7).

### 5.4 How a badge is shown and verified

- **Verify link.** Each badge gets a link like `tabulaspeech.com/v/7Q2M-K9XD-...` (moved from `tabuladebate.com/v/` on 2026-11-20: one place for badges from every Tabula product), with a long random ID (at least 128 bits, so nobody can guess another link). The page shows:
  - the name the judge chose to show (optional; the judge types it; it can be just initials);
  - the track name and version;
  - the date;
  - the line from §7, after "Completed this course and passed its final check.": "A free, self-paced course from Tabula. Not a certification or endorsement by any league or tournament."
- **The judge controls it.** The judge can turn the link off (revoke it) or delete the badge. A revoked link says "This link is no longer active" and nothing else.
- **No search engines.** Verify pages send an `X-Robots-Tag: noindex` header and are left out of every sitemap. Verify pages are made by server code (Pages Functions or a Worker), and Cloudflare applies `_headers` only to static files, not to those responses. So the server code sets the CSP, `X-Content-Type-Options` and `X-Robots-Tag` itself, and a server test checks that response. There is no list or search of badge holders.
- **No scripts on verify pages.** They are plain server-made HTML. Full header set, checked by a server test:
  - `Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
  - `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex`
  - `Referrer-Policy: no-referrer` and `Cache-Control: private, no-store`, because the verify ID in the URL works like a password to the page.
  - The page ignores the session cookie: it shows the same thing to everyone.
  - The display name is HTML-escaped, because `tabulaspeech.com` shares the sign-in cookie with the apps.
- **QR code.** The server makes it as an SVG, or a small generator goes in `vendor/`. No third-party script (the CSP blocks it anyway).
- **Where a judge can put it:** in their judge paradigm text (for example on Tabroom), in an email to a tournament, or as a QR code on the printed certificate.
- **Printed certificate.** The same as Phase 1, plus the verify link and its QR code.
- **Later (optional):** export the badge as an **Open Badges 3.0** credential (a standard file format for digital badges, from 1EdTech, based on W3C Verifiable Credentials), so a judge can keep it in a badge wallet. Not needed for launch.

A signed link (a link that carries its own digital signature, so it can be checked with no database) is an alternative to the random-ID link. It works if the server is down, but it cannot be revoked easily. **Recommendation:** use the random-ID link, because the judge's control (revoke and delete) matters more.

### 5.5 What the server stores for a judge badge

| Stored | Not stored |
|---|---|
| Account ID (random), email, sign-in provider and that provider's user ID | Final-check answers and scores (graded, then thrown away), any count of tries beyond today |
| "18+ confirmed" and the date; last sign-in date | Time on a page, page views, click trails |
| For each badge: track ID, track version, date, verify-link ID, revoked yes/no | Self-check text (it never leaves the browser) |
| Optional display name for the verify page | Device data beyond short security logs |
| During a try: an attempt token and the served question IDs (deleted when graded, or after 1 hour) | |
| While a retry wait runs: the time of the last failed try and the count of fails today, per track (deleted on pass, or after 1 day) | The weak-section list (made at grading time, shown once, not kept) |

Delete on request. Delete the account and all badges on "Delete my account". **Inactive accounts** (§9, item 19): delete the account, its badges and verify links 24 months after the last sign-in, with reminders 30 days before, 7 days before and on the day, each with an export link. Short security logs (for abuse and rate limits) expire on a fixed schedule.

**Size:** after the round-pack accounts exist: about 2 to 3 weeks of code (final-check endpoints and grading, retry wait and timer, badge table, verify page, revoke and delete, certificate with QR, tests). Plus writing and reviewing the hidden pool for the parent judge track (about 40 questions, about 1 to 2 weeks). Plus updates to the privacy policy and ToS: the single policy and terms on `tabulaspeech.com` cover the final check and verify pages. The move to `tabulaspeech.com` adds about 2 to 3 days (the static check page on that site, the Back to Library link, the old-version and retired-track pages). It needs accounts on `tabulaspeech.com` first (`docs/architecture/ARCHITECTURE.md` §11, steps 4 and 7).

## 6. Phase 3: student badges (only with strong privacy rules)

Students are minors, so this phase follows the coach and student rules in `STUDENT-EDITION.md` §10e, plus the rules below.

### 6.1 Who and how

- **No accounts under 13** (COPPA: the US children's online privacy law, which needs verified parent consent before a site collects personal information from a child under 13). Middle school debaters keep Phase 1: local progress and a self-printed certificate, with nothing collected.
- **Students 13 to 17 get a free account** with consent, by one of two paths (§9, item 5). Neither needs a paid plan.
  1. **School path.** A coach or teacher opens a **free school space** with school consent. It holds only membership (join code), track assignments and badges. No paid features. A paid Program includes the same space.
  2. **Parent path.** If the student has no school space, a parent consents by email. The parent gets a short notice of what is stored, and a light account to see, export or delete it (§6.4).
- **School-path data** is school data. The school controls it under the data agreement (§6.3).
- **Parent-path data** is not under any school agreement. The parent and the student control it. Tabula keeps a record of each consent (who, when, the notice version) and the light parent account (its email only), and nothing more about the parent.
- This adds a consent and reporting burden on purpose: the owner chose wider free access over tying badges to a paid plan.

### 6.2 Rules for student badges

- **Private by default.** Only the student sees their badges.
- **No public student profiles.** No public verify links for students. No public pages with a student's name or badges. Nothing is indexed by search engines.
- **Sharing is the student's choice, and narrow.** A student in a school space can share any of their badges with their coach there, for an assigned track or not. A student can print a certificate (the name is typed at print time and not stored, as in Phase 1) and hand it to anyone.
- **Coach view.** A coach sees track completion only for a track the coach **assigned**, or a badge the student chose to share (a student opt-in, the one exception), and only as "done" or "not done". No scores, no tries, no time spent, no "who is behind" list. This matches the assignment rules in `STUDENT-EDITION.md` §10d.
- **No judge badges for students** (§9, item 10). Student accounts can earn debater-track badges only.
- **No gamification.** No streaks, points, leaderboards, levels, or "badges for logging in" (`STUDENT-EDITION.md` §10c). A badge is only "finished this track".
- **No automatic messages** (retention reminders excepted) about progress to the student, the coach, or parents.
- **Same final check, on the student host.** A student badge (for example the novice track) needs the same server-graded final check as a judge badge (§5.3), with its own hidden pool. It runs on `student.tabulaspeech.com/badges/check/<track>`, with the student's own host-only cookie (`docs/architecture/ARCHITECTURE.md` §3.2), so a student device never gets the judge and coach session. The library's final-check link depends on the track's audience: `debater` tracks link to the student host, `judge` tracks to `tabulaspeech.com`. `tracks.json` gets a per-audience target. The `tabulaspeech.com` check page refuses student accounts.
- **Students own their record.** Badges are in the student export (`STUDENT-EDITION.md` §10e). The student can delete their own badge at any time. On the school path, the school can also delete the whole space. The export is the student's copy. It does not give the student control of the school's data.
- **Retention.** School-space data is deleted 120 days after the season ends, with the reminders in `STUDENT-EDITION.md` §10i. A parent-path account is deleted 12 months after its last sign-in. Reminders go 30 days before, 7 days before and on the day, each with an export link, to the account email and the consenting parent's email. The student's export stays theirs.

### 6.3 Laws and the existing rules

| Rule | What it means for badges |
|---|---|
| **COPPA** (under 13) | No accounts under 13. Phase 1 collects nothing, so it is safe at any age. Do not add analytics, sign-in or a newsletter to library pages without a COPPA review. |
| **FERPA** (the US law on student education records) | On the school path (a free school space or a paid Program), badge records are education records. The school controls them. Tabula acts as a "school official" under a data agreement. Have the SDPC National Data Privacy Agreement (a standard contract many districts use) ready. |
| **State student-privacy laws** (for example CA SOPIPA, NY Education Law 2-d, IL SOPPA) | No ads, no sale, no profiling, no training AI on student data. List every subprocessor (each outside service that touches the data). Badge data is never used for marketing. |
| **Parent consent** (the parent path) | COPPA does not apply at 13 to 17, but state laws for minors still do. Keep each consent record (who, when, notice version). Send the parent a plain notice. Give the parent a way to see, export and delete the data. Check each state's minor-privacy law in the legal review. |
| **Age-appropriate design rules** (for example California's Age-Appropriate Design Code and similar state laws for users under 18) | Highest privacy settings by default. No public profiles. No nudges to share. No features that push a minor to stay longer. |
| **Student names** (`BUSINESS-PLAN.md` §10 row 11) | **Changed (§9, item 14):** a school-space account stores a **real display name**, so the coach can tell students apart. This matches `STUDENT-EDITION.md` §10e ("Names"). Row 11 is amended to match (2026-11-19). A parent-path account needs no display name. AI prompts still never get names. The name on a printed certificate is still typed at print time and never sent. |

Get a legal review before Phase 3 launches. The age-design laws change often and some are under court challenge.

### 6.4 What Phase 3 stores, and account life

| Stored | For |
|---|---|
| Account ID, email, birth year | Every student account |
| Last sign-in date | Parent-path accounts (and adult accounts, §5.5); set when a school-path account moves to the parent path |
| Display name, school-space membership, assigned tracks, done or not done | School path only |
| Parent email, consent date, notice version; a light parent account (§9, item 15) | Parent path only |
| Badges: track ID, track version, date | Both paths |
| Sign-in provider and that provider's user ID; during a final check, the attempt token, served question IDs and retry-wait state (same rules as §5.5) | Both paths |

Not stored: final-check answers, time on pages, device data, activity trails. "Last sign-in date" is the only long-lived activity data, and it exists only to run the inactivity deletion rules (§5.5 for adults, §6.2 "Retention" for the parent path). Birth year (no month or day) exists only to block under-13 sign-up and to end parent consent at 18.

**Account-life rules** (owner decisions, 2026-11-19; §9, items 15 to 18):

- **Parent account (data rights only).** The consenting parent gets a light account, with emailed-link sign-in. It shows only: a plain list of what is stored, export, delete, and withdraw consent. It shows no progress, no badge view beyond that list, and sends no alerts except the retention reminders. So it is not a parent dashboard (`STUDENT-EDITION.md` §10i item 5). It is deleted with the student's account.
- **Consent record after deletion.** Keep the consent record (parent email, date, notice version, and the deleted account's random ID) for 3 years after the account is deleted, as proof of consent, then delete it. The random ID ties the record to one account. The record holds no student name, email or birth year.
- **Turning 18.** Every student account stores a **birth year**. In the year the student turns 18, at the start of the next season, the account becomes an adult account, and the parent link and parent account end (with a notice to both). At that point the birth year is deleted (adults store none, §8.3), and the adult rules apply, including the 24-month inactivity rule (§5.5). A school-space account stays in its space until the season ends. Exact check: an account is 18+ when the current year minus the birth year is 19 or more; when it is exactly 18, the account asks once "Have you had your 18th birthday?".
- **When school consent ends** (§9, item 20). If the school space is deleted, or the student leaves it, the student has **30 days** to add parent consent and move to the parent path, with reminders and an export link. If not, the account is deleted. Reminders go 30 days, 7 days and 0 days before the deadline. If the account moves to the parent path, the student's own badges (moving rule, below) move with it. If the account is deleted, those badges survive only in the export the student can download during the 30 days. School-space badges stay with the school until the space is deleted.
- **Moving between paths.** Badges earned before joining a school space stay the student's. Badges earned inside the school space are the school's data (the student keeps a copy in the export). Leaving a school space keeps the student's own badges.

**Size:** about 4 to 6 weeks of code **after** these exist: accounts (round packs, §9 item 4), join codes (`STUDENT-EDITION.md` §10h step 3), Phase 2 server grading, and the novice track's hidden pool (Phase 1b). The free school space and a paid Program's space are **one thing**, built once in §10h step 3, with a free-tier flag (`STUDENT-EDITION.md` §10h now says so). The narrow track assignment sits between steps 3 and 4. Phase 3 adds only the narrow track assignment (assign a track, see done or not done), the badge view, the age gate and the parent flow. It does not need the full assignment system (§10h step 4). The work: the age gate, the free school space, the parent-consent flow with notice and records, the light parent account, retention reminder jobs, the coach view, and the badges. Plus legal review and the data agreement.

## 7. Naming: what to call a badge

Say:

- **"completion badge"**
- **"certificate of completion"**
- "completed the *New parent judge* track"

Do not say (unless a league endorses it in writing):

- "certified", "certification", "certified judge"
- "accredited", "licensed", "qualified", "official", "approved"
- anything that suggests a league, NSDA, a state association, or a tournament stands behind it

Every badge, certificate and verify page carries at least this line: "A free, self-paced course from Tabula" (or "from the Tabula Debate Library"), then "Not a certification or endorsement by any league or tournament." The built certificate uses the Debate Library form. Phase 2 verify pages must use the same wording.

Talk to leagues (a state association or NSDA) only **after** the parent judge track has passed both coach reviews and been used for one season (§9, item 7).

If a league later endorses a track, its name appears only with its written approval, and only in the words it approves. A Tabula badge does not replace a league's required training unless that league says so.

## 8. Accounts: what badges need

`PLAN.md` §6 lists "Accounts and login" as needed before charging. They are not built. Badges and round packs should share **one** account system.

### 8.1 What badges need (Phase 2)

- **Sign-in.** Decided (§9, item 4): an emailed sign-in link (no password) plus "Sign in with Google" and "Sign in with Microsoft". Many judges and coaches have a school Google or Microsoft account. No passwords to store or leak.
- **Where it runs.** Decided 2026-11-20: all Cloudflare. A Worker and D1, with our own email link and code and a small OAuth library (`docs/architecture/STACK.md` §3). Sign-in, the final check and verify pages are on `tabulaspeech.com`.
- **Fit with the `tabulaspeech.com` CSP** (that site's own `_headers`; the library's CSP is unchanged):
  - Serve the account and badge endpoints from the same origin as the page that calls them: `tabulaspeech.com/api/v1/` for the final check page. Then `connect-src 'self'` is enough. The library on `tabuladebate.com` makes no API calls.
  - Use the **redirect** sign-in flow for Google and Microsoft. Their pop-up button libraries load a third-party script, which `script-src 'self'` blocks. That is good: keep it so.
  - `form-action 'none'` blocks plain HTML forms. Sign-in pages use `fetch` from a self-hosted script. The only CSP exception is Turnstile on `/signin` (`docs/architecture/ARCHITECTURE.md` §3.2). `final-check.js` is same-origin with no inline script, and the final-check page has no third-party content.
- **Stored:** see the table in §5.5. Nothing more.
- **Session.** The sign-in session lives in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie for `tabulaspeech.com`, never in `localStorage`, because the apps keep judges' API keys in `localStorage`. Session rules (one sign-in across apps, CSRF checks, sign-out) are in `docs/architecture/ARCHITECTURE.md` §3.2. The redirect sign-in flow works with `form-action 'none'` and `connect-src 'self'`, because it is plain navigation.
- **An 18+ confirmation** at sign-up for Phase 2. Phase 3 adds a birth-year step for students (§8.3).
- **A "Delete my account" button** that deletes badges too.
- **The library stays readable signed out.** Sign-in appears only when a judge chooses to take the final check.

### 8.2 What can wait

The final-check grading, the retry wait and the hidden pool **cannot** wait: the judge badge needs them on day one (§9, item 3).

- Sync of all progress between devices (export and import is enough at first).
- Paid plans and billing.
- Coach dashboards, school spaces and Program accounts (needed only for Phase 3).
- District single sign-on such as Clever or ClassLink (Phase 3, if schools ask).
- Open Badges export (§5.4).

### 8.3 Note for Phase 3 sign-in

Phase 3 sign-up asks for the user's birth year and refuses anyone under 13. Exact check: if the current year minus the birth year is 14 or more, go on; if it is 13, ask "Have you had your 13th birthday?" and go on only on yes; if it is less, refuse. Counsel should confirm this gate (it is the COPPA gate). A user aged 13 to 17 goes to the school or parent consent step (§6.1) before the account opens. Adults (Phase 2) only confirm 18+; no birth year is stored for them.

School Google and Microsoft accounts for students under 18 often need the school's IT admin to approve a third-party app before sign-in works. Plan for a short "how to approve Tabula" page for school admins.

## 9. Owner decisions (2026-11-19)

1. **Name: tracks.** "Guided tracks" in the app, the site and the code. "Program" means only the paid school plan. This file is `TRACKS.md`.
2. **Completion badges are allowed.** A badge means only "finished this track". Streaks, points, levels, login badges and leaderboards stay banned. `STUDENT-EDITION.md` §10c now says so.
3. **The judge badge is server-graded from day one.** On a fail: retry after **5 minutes**, with **links to reading** for the sections the judge struggled with, and an **optional cool-down timer** that links back to the retake (§5.3). Confirmed: a hidden pool of about **40** questions per badge track, **12** questions per try, a pass mark of **80%** (10 of 12), and no limit on tries.
4. **Accounts wait for round packs.** One account system for both. Sign-in: emailed link plus Google plus Microsoft, with the redirect flow (§8).
5. **Students: free accounts, school or parent consent**. A free school space with school consent, or parent consent by email. No paid plan needed. No accounts under 13 (§6.1).
6. **Verify-page name: optional.** The judge types it (initials are fine). Adults only.
7. **Leagues: after review and one season** of real use.
8. **Free.** Tracks, checks, the judge badge and student badges are all free. Fairness comes first, even with more consent and reporting work.
9. **Next track: novice debater**, after the parent judge track. It needs 3 wave-2 pages: `answering-disadvantages`, `permutations`, `rebuttal-strategy` (as decided 2026-11-19; all 3 were written 2026-11-20, see §2.2).
10. **Students and judge tracks:** students may read the judge tracks and do their per-step checks, but cannot earn a judge badge for now.
11. **The retry wait grows.** After several fails in one day: 5 minutes, then 15, then 60. Tries stay unlimited (§5.3).
12. **The free school space covers badges and tracks only:** join code, assign a track, see done or not done, badges. **Track assignments** are this narrow thing. Other paid features stay in the paid Program (`STUDENT-EDITION.md` §10g).
13. **A parent-path account is deleted 12 months after its last sign-in**, with reminders 30 days before, 7 days before and on the day, each with an export link.
14. **Coaches see a real display name** for each student in a school space. `BUSINESS-PLAN.md` §10 row 11 is amended to match (§6.3).
15. **Parents get a light account for data rights only:** see what is stored, export, delete, withdraw consent. No progress view, no alerts (§6.4).
16. **Consent records are kept 3 years** after the account is deleted, then deleted.
17. **Every student account stores a birth year** (not month or day). It blocks under-13 sign-up and ends parent consent at 18. A one-time "Have you had your birthday?" question settles the edge year (§8.3, §6.4).
18. **Badges split by where they were earned** when a student moves between the parent path and a school space (§6.4).
19. **Inactive judge accounts are deleted 24 months after the last sign-in**, with reminders and an export link (§5.5).
20. **When school consent ends** (space deleted, or the student leaves), the student has 30 days to add parent consent. If not, the account is deleted (§6.4).
21. **Badge pages move to `tabulaspeech.com` (2026-11-20).** The final check and verify pages live where accounts live (`tabulaspeech.com/badges/check/<track>`, `tabulaspeech.com/v/<id>`). The library on `tabuladebate.com` links to them and never calls the server (§5.3, §5.4, §8.1; `docs/architecture/ARCHITECTURE.md` §3.5).

## 10. Rough size, by phase

| Phase | Work | Rough size | Depends on |
|---|---|---|---|
| **1** | **Built 2026-11-19:** `tracks.json`, `learn-tracks.mjs` (parser and renderer), `check.js`, track pages, the `bridge.mjs` and `check-publish.mjs` changes, `TRACKS.md` excluded from publishing, `LICENSE.md` extended, the 6 parent judge checks, the certificate and save/load/clear. **Open:** the guard test (§5.3); the track-tick version note (§3.5) | Done | To go **live**: coach review of the 6 checks, then each check set to `status: reviewed`. The 6 pages are approved (`docs/library/PLAN.md` §10). |
| **1b** | Novice track: 11 new checks (3 are shared with the judge track) | About 2 weeks of writing and review. Its hidden final-check pool (for Phase 3 student badges) adds about 1 to 2 weeks. | All 14 pages exist (2026-11-20). Coach review of the 3 wave-2 pages (`answering-disadvantages`, `permutations`, `rebuttal-strategy`) and of the 11 checks |
| **2** | Judge badge: server-graded final check with retry wait and timer, verify link, revoke and delete, certificate with QR, privacy policy update; hidden pool of about 40 questions | 2 to 3 weeks of code, plus 1 to 2 weeks to write and review the pool | Round-pack accounts (§8). No date until those are scheduled. |
| **3** | Free student badges: age gate, free school space, parent-consent flow, coach "assigned track done" view, export, retention | 4 to 6 weeks of code, plus legal review and the data agreement | Accounts (round packs), join codes (`STUDENT-EDITION.md` §10h step 3), Phase 2 grading, Phase 1b novice pool. No date until accounts are scheduled. |

## 11. Next step

1. Send the 6 parent judge checks (`docs/library/checks/`) to the two reviewers. They stay unnamed for now.
2. After each check is approved, set its `status:` to `reviewed` and rebuild. When all 6 are reviewed, the track goes live (indexed, in the sitemap).
3. Add the guard test from §5.3.
4. Novice track (Phase 1b): its 3 wave-2 pages now exist. Send them for coach review, and write its 11 new checks.
5. Later tracks: 2.5 (Judging well) and 2.7 (Counterplans) have all their pages; they need checks and coach review. Tracks 2.3, 2.4, 2.6 and 2.8 wait for the pages marked *(planned)* in §2. A track is added to `tracks.json` only with its checks, because `trackState()` needs a check for every step.
