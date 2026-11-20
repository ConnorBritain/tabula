# Debate Library: guided tracks, checks and completion badges (design doc, draft 2)

Status: owner decisions recorded (§9). Ready to build Phase 1. Date: 2026-11-19. Docs only: nothing here is built.
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

**Rule: a track goes live only when every step page exists, has passed coach review, and has a check.** A track with "coming soon" steps cannot be finished, so it cannot give a badge. Until then, the reading path on the library home page does the job.

### 2.1 New parent judge (about 45 minutes: the 30 minutes of reading path A plus about 15 for the checks; the optional final check for a badge adds about 10)

Same order as reading path A (`docs/library/PLAN.md` §3). Promise: "You can judge a fair round today."

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `debate-101` | Name which speech comes next, and which side gives it, from a short round story. |
| 2 | `first-round-judge` | Choose what to do in a common room problem (a team asks you to time; a debater runs over time). |
| 3 | `how-to-flow` | Find the dropped argument on a short flow. |
| 4 | `speaker-points` | Say which of two described speeches deserves higher points, and why (no point scale, because scales vary by league). |
| 5 | `ballot-and-rfd` | Pick the RFD that explains the decision, from three choices. Also a self-check (§3.3). |
| 6 | `impact-calculus` | Choose which impact a team weighed better, and why. (The check covers only the plain summary, as path A says.) |

**Ready now:** all 6 pages are written. Only the checks are missing. This is the first track to build.

### 2.2 Novice debater (first month)

Same order as reading path B and `PATHS.novice` in `build-learn.mjs`. Promise: "You can run and answer the core arguments."

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `debate-101` | (Same check as 2.1, step 1.) |
| 2 | `speeches-and-times` | Say what a speech may and may not do (for example, no new arguments in rebuttals). |
| 3 | `how-to-flow` | Find the dropped argument on a short flow. |
| 4 | `flow-shorthand` | Read a line of shorthand and say what it means. |
| 5 | `affirmative-case` | Read a short new case and say which part a given neg attack hits (the plan, the harm, or solvency). |
| 6 | `stock-issues` | Spot which stock issue a neg answer attacks. |
| 7 | `disadvantages` | Find the missing part of a DA on a flow (example in §3.2). |
| 8 | `answering-disadvantages` *(planned)* | Pick the answer that is a turn, not just defense. |
| 9 | `counterplans` | Say whether a CP competes with a given plan. |
| 10 | `permutations` *(planned)* | Pick the perm that tests competition. |
| 11 | `topicality` | Read a new plan and a short T shell, and say whether the plan meets the interpretation. |
| 12 | `cross-examination` | Pick the CX question that sets up a later argument. |
| 13 | `impact-calculus` | Weigh two impacts on magnitude and probability. |
| 14 | `rebuttal-strategy` *(planned)* | Choose what the 2NR should go for, from a flow. |

**Ready:** 11 of 14 pages written. Needs 3 wave-2 pages. **Badge:** yes, for students in Phase 3, so this track also needs its own hidden final-check pool (§5.3).

### 2.3 Intro to the K

Prerequisite (suggested, not enforced): the novice track, or `disadvantages` and `framework`.

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `kritiks` | Label the link, impact and alternative in a short K shell (example in §3.2). |
| 2 | `kritik-links` *(planned)* | Tell a specific link from a generic one. |
| 3 | `kritik-alternative` *(planned)* | Say what the alternative asks the judge to do. |
| 4 | `role-of-the-ballot` *(planned)* | Say what a given role-of-the-ballot claim would change about the decision. |
| 5 | `framework-vs-kritik` *(planned)* | Pick the aff answer that says "weigh the plan". |
| 6 | `answering-kritiks` *(planned)* | Pick the answer that is a permutation, and the one that is a link turn. |
| 7 | `example-cap-k` *(planned)* | Read a short flow of the cap K debate and say which side is ahead on the link. |

**Ready:** 1 of 7. Wave 2 and 3 pages first. The `common-kritiks` page is left out on purpose: it is the hardest page to write fairly (`docs/library/PLAN.md` §2.7), and a quiz on it risks a "right answer" about a contested idea.

### 2.4 Theory basics

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `theory` | Find the interpretation, violation, standards and voter in a theory shell. |
| 2 | `fiat` | Tell a fiat answer from a solvency answer. |
| 3 | `conditionality` *(planned)* | Say what "conditional" means for a CP the neg can drop. |
| 4 | `reject-the-team` *(planned)* | Say whether an argument asks to reject the argument or the team. |
| 5 | `common-theory` *(planned)* | Read a short 1NC and say which theory argument the aff could make against it, and why. |
| 6 | `example-condo-debate` *(planned)* | Read a condo flow and find what each side's interpretation is. |

**Ready:** 2 of 6.

### 2.5 Judging well: decisions and RFDs

For judges who have done the parent track, or who judge often.

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `judge-paradigms` | Say how two paradigms would decide the same short flow differently. |
| 2 | `ballot-and-rfd` | Self-check your own RFD against a model (§3.3). |
| 3 | `presumption` *(planned)* | Say who wins when nothing changed in the round. |
| 4 | `turns-case` *(planned)* | Spot a "DA turns case" claim and what it does to the weighing. |
| 5 | `round-conduct` *(planned)* | Choose the right step when an evidence ethics claim comes up. |
| 6 | `giving-feedback` *(planned)* | Pick the oral feedback that is specific and kind. |
| 7 | `writing-a-paradigm` *(planned)* | Self-check a short paradigm draft for the 4 things debaters look for. |

**Ready:** 2 of 7. This track has a badge, so it also needs its own hidden final-check pool (§5.3).

### 2.6 Policy vs K: framework

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `framework` | Say what a framework argument asks the judge to weigh. |
| 2 | `framework-vs-kritik` *(planned)* | Pick the neg-K answer to "weigh the plan". |
| 3 | `role-of-the-ballot` *(planned)* | (Same check as 2.3, step 4.) |
| 4 | `kritikal-affirmatives` *(planned)* | Say what a K aff does instead of a plan. |
| 5 | `framework-vs-k-aff` *(planned)* | Find the interpretation and the main standard in a T-USFG style shell. |
| 6 | `example-fw-vs-k-aff` *(planned)* | Read the flow and say which impact each side weighs. |
| 7 | `example-extinction-vs-structural` *(planned)* | Say what each side must win to make its impact come first. |

**Ready:** 1 of 7. Checks here must be **fair to both sides**. No question has "policy is right" or "the K is right" as its answer. The questions test that you can see what each side argues. Both reviewers (Reviewer A and B) check this track.

### 2.7 Counterplans and competition

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `counterplans` | Say whether a CP competes. |
| 2 | `counterplan-text` *(planned)* | Spot what a CP text leaves out. |
| 3 | `competition` *(planned)* | Tell mutual exclusivity from net benefits. |
| 4 | `net-benefits` *(planned)* | Find the net benefit on a flow. |
| 5 | `permutations` *(planned)* | Pick the perm that tests competition. |
| 6 | `solvency-deficits` *(planned)* | Weigh a small solvency deficit against a net benefit. |
| 7 | `example-states-cp` *(planned)* | Read the states CP flow and say what the aff must win. |

**Ready:** 1 of 7.

### 2.8 Topicality

| # | Slug | The check tests that you can... |
|---|---|---|
| 1 | `topicality` | Find the interpretation, violation, standards and voter. |
| 2 | `topicality-interpretation` *(planned)* | Say whether a plan meets an interpretation. |
| 3 | `topicality-standards` *(planned)* | Match a standard (limits, ground) to the claim it makes. |
| 4 | `topicality-voters` *(planned)* | Tell competing interpretations from reasonability. |
| 5 | `example-t-substantial` *(planned)* | Read the flow and say who wins the limits debate. |

**Ready:** 1 of 5.

### 2.9 One list for tracks and reading paths

Today `build-learn.mjs` holds the reading paths in `PATHS`. Tracks 2.1 and 2.2 are the same lists. To keep one source:

- Move the lists into one data file, `docs/library/tracks.json`. Each entry has `id`, `name`, `promise`, `audience` (`judge` or `debater`), `badge` (true or false) and `steps` (slugs).
- `tracks.json` **replaces** the hard-coded `PATHS` lists. `build-learn.mjs` keeps a `PATHS` export, but builds it from the `judge` and `novice` entries of `tracks.json`. Keep those two IDs as they are today, because the test below and the "Next on your path" box use them.
- When `tracks.json` exists, `docs/library/PLAN.md` §3 drops its step lists and keeps only each path's promise and audience, plus one line: "The step lists live in `tracks.json`." §2.1 and §2.2 of this doc then point to `tracks.json` too, so the order lives in one place (plus `index.md`, which a test already checks against it).
- Tracks 2.4 to 2.6 **replace** the Path C branches. Where their order differs from PLAN.md §3 (for example, Fiat comes second in 2.4), the track order wins. Tracks 2.7 and 2.8 are new.
- The "Next on your path" box keeps today's labels ("New judge path", "New debater path") through a `pathName` field on those two entries, so the existing test keeps working. It shows only for entries that have a `pathName`.
- The existing test (`index.md` lists each path in `PATHS` order) keeps working. Add a test that every step slug is in the `docs/library/PLAN.md` slug tables.

## 3. Checks

### 3.1 Where they live

- One check file per page: `docs/library/checks/<slug>.md`. A sibling folder keeps check files out of the page list (`isPageFile()` only reads the top folder, and check files have no `slug:` key).
- A track reuses a page's check. A page has one check, even if it is on three tracks.
- Checks use the same license as the pages (CC BY-SA 4.0). Coaches may reuse questions.
- Each check has 3 to 5 questions. To pass, you get every question right. You can try again at once, as many times as you want. Each answer shows a short "why". The goal is learning, not a score. No score is shown or kept, only "done".

### 3.2 File format

The format looks like the Markdown the library already uses, so writers need to learn little. The builder needs no new dependency. But it needs a **new, small parser**, `parseCheck()`, because the page renderer `markdown()` would get it wrong: it turns `##` into a page section with an anchor, and it shows `- [x]` as plain text (its list reader has no checkbox rule). `parseCheck()` splits the file on `## `, finds the choices and the `**Why:**` line, and calls the existing `fence()` and `inline()` for each part. Check files are read only from `docs/library/checks/`, never by `loadPages()`.

````markdown
---
page: disadvantages
version: 1
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

- `## heading` starts a question. The heading is the short question name.
- The **last paragraph before the choices** is the question prompt. Paragraphs and flows above it are the setup.
- A code fence holds a flow. **Every flow has an "In words:" line under it**, because a screen reader reads a flow grid badly.
- `- [x]` marks a right choice, `- [ ]` a wrong one. One `[x]` is a single-choice question (radio buttons). Two or more is "pick all that apply" (checkboxes).
- `**Why:**` starts the explanation. Every question needs one.
- `version:` goes up when the page or the check changes in a way that matters (§3.5).
- A `**Self-check:**` block (§3.3) replaces the choices for writing tasks.

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

**With JavaScript:** the page loads one file, `learn/check.js`, with `<script src="../check.js" defer>` (topic pages) or `./check.js` (the home page). **Track pages need a build change:** `relHref()` and `shell()` today know only the home page (depth 0) and topic pages (depth 1). `learn/tracks/<id>/` is depth 2. So `shell()` must take a depth (or base path) for the CSS, script, brand, font, canonical and JSON-LD links. Reserve `tracks` as a slug, so no page `tracks.md` can collide. The CSP allows it, because it is on the same site. The script:

- turns each question into a `<fieldset>` with a `<legend>` and radio buttons or checkboxes;
- adds a "Check my answers" button (`type="button"`, not a form submit: the CSP has `form-action 'none'`);
- marks each answer right or wrong, with words and an icon, not color alone, and shows the "why";
- reports the result in an `aria-live` region, so screen readers hear it;
- saves "step done" in the browser when every answer is right (§4).

The right answers are in the page HTML (in `data-key` attributes and in the `<details>` boxes). Anyone can read them. That is by design: per-step checks are for learning. The badge rests on the separate, server-graded final check (§5.3), whose answers are never in the page.

Size target: `check.js` under 300 lines, no libraries. `learn.css` gets the check styles.

`check.js` is **code**, so it is licensed AGPL-3.0 like the app, not CC BY-SA. Keep its source out of `docs/library/` (for example in the repo root, copied into `learn/` by the build).

**Safety.** The library shares the `tabuladebate.com` origin with the app, and the app keeps judges' API keys in the browser on that origin. So `check.js` reads and writes only its own key (`tabula.learn.v1`), never builds HTML from stored text, and gets the same review as app code.

**New track pages.** The build also makes `learn/tracks/index.html` (all tracks) and `learn/tracks/<id>/index.html` (one track: its promise, steps and links). Without JavaScript, a track page is an ordered list of links. With JavaScript, `check.js` adds a tick next to each finished step and a "Resume" link to the first unfinished one. The library home gets a short "Guided tracks" section that links to `learn/tracks/`.

**Tests to add** (in `build-learn.test.mjs`):

- every check's `page:` is a real page, and every question has at least one `[x]` and a "Why";
- every track step has a check before the track can be marked live;
- built pages still have no inline script. **This needs an edit to an existing test:** `build-learn.test.mjs` ("built pages hold no runnable script, only JSON-LD data") allows only `<script type="application/ld+json">` tags today, so the new `<script src="../check.js" defer>` tag would fail it. Change it to also allow exactly that tag, and keep it failing on any inline code and any `on*=` handler. The diff stays visible for review;
- built pages still pass the freshness test (`learn/` matches the Markdown).

`node check-publish.mjs` already scans every page in `learn/` for `todo` and `href="#"`, so the track pages get those checks. Its remote-script scan lists only `index.html`, `app.js` and `about.html` today: **add `learn/check.js` to that list.**

The existing tests read every built page. Track pages must pass them too: a 140 to 160 character description, one H1, a canonical URL, the call to action, and working relative links and anchors. Track pages go in `learn/sitemap.xml` (they are public content).

**Local helper.** `bridge.mjs` serves `learn/` only for `.html`, `.css`, `.xml`, `.png` and `.webp` today (`LEARN_TYPES`). Add `.js`, with a test in `bridge.test.mjs`, or the checks do not work through the helper.

### 3.5 Versions

- Progress stores the check `version` for each step.
- If the version goes up, the step stays done, but its tick shows "Page updated: review". The track stays finished. Old badges stay valid.
- A big rewrite of a track (steps added or removed) gets a new track version. A badge names the track version it was earned on.

## 4. Phase 1: tracks with progress in the browser (no account)

**What the user gets**

The **first release** is small: checks, ticks on track pages, "Resume", and "Clear my progress". The certificate and export/import can follow in a **second Phase 1 release**. (The name "Phase 1b" means only the novice track, §10.) Versions (§3.5) can wait until a check first changes.

- Track pages with ticks, a "Resume" link, and a progress line ("4 of 6 steps done").
- A **certificate of completion you print yourself.** At the end of a track, the track page offers "Print a certificate". It is a view that `check.js` draws on the track page, with print styles in `learn.css`. It is not a separate built page. You type the name you want on it. The name stays in the page and is never saved or sent. The certificate says what it is: "Completed the Tabula *New parent judge* track. A free, self-paced course from Tabula. Not a certification or endorsement by any league or tournament. Not verified." The user can print it or save it as a PDF.
- **Export and import** progress as a small file, to move to another device. **Clear my progress** removes it all.

**What is stored, and where**

- One `localStorage` key, for example `tabula.learn.v1`:
  `{ "steps": { "disadvantages": { "v": 1, "done": "2026-11-19" } }, "tracks": { "judge": { "done": "2026-11-20" } } }`
- Only slugs, check versions and dates. No answers. No names. No time spent. No count of tries.
- Nothing goes to any server. There is no analytics in the library. This should keep Phase 1 outside COPPA, because Tabula collects no personal information from anyone. (This is not legal advice. Counsel should confirm it before launch.)

**Things to know**

- `localStorage` belongs to one origin (one site address). Progress on `tabuladebate.com` is the same in the hosted app and the hosted library, because both are on that site. Progress through the local helper (`bridge.mjs`, `localhost`) is separate. Export and import fix this.
- On a **shared school computer**, the next user sees the progress. The track page shows a short note and the "Clear my progress" button.
- A browser in private mode, or one that blocks storage, loses progress when it closes. `check.js` must work when storage throws (wrap every read and write in `try/catch`; the check still marks answers, it only cannot save).

**Size:** about 1 to 1.5 weeks of code (track data file, check parser and renderer, `check.js`, track pages, certificate page, tests). Writing the checks for the parent judge track: about 1 to 2 hours per check, then coach review. **First release: the parent judge track only (6 checks).**

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
2. At the end, the track page offers "Take the final check for a badge". Only now must the judge sign in (§8).
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

**Pool rules.** No pool question may copy or lightly reword a public per-step check question, because those answers are public. The private-repo review checks this for every new question. The pool's format checks and tests live in the private repo. The server may reuse `parseCheck()` from this repo while Pattern Engine LLC holds all of its copyright; if outside contributions change that, write a separate parser. Final-check questions follow the same writing rules as other checks (§3.2), but they live in the **private server repo** (or server storage seeded from it), never in this repo. This repo is, or will be, public (AGPL on GitHub), so any committed file, and its git history, is public. The pool is also **not** CC BY-SA and not part of the library license (`LICENSE.md` covers the Markdown in `docs/library/`), so keep it out of that folder.

**Guard.** When Phase 1 is built, add a test to `build-learn.test.mjs` that puts a subfolder file and a `*.local.md` file in the source folder and checks that neither reaches `learn/`. Today only code habits protect this (`loadPages()` reads one folder, `isPageFile()` skips `*.local.md`). Each question is tagged with its section (a page slug), so the server can name weak sections. Writers add new questions and retire old ones each season, because answers can leak over time. The pool gets the same coach review as the pages.

**Code size.** Phase 2 browser code (the final check and the cool-down timer) goes in its own file, for example `learn/final-check.js`, so `check.js` stays small.

**What it means.** The badge now says the judge *passed a final check*, not only that they say they finished. It is still a completion badge, not a certification (§7).

### 5.4 How a badge is shown and verified

- **Verify link.** Each badge gets a link like `tabuladebate.com/v/7Q2M-K9XD-...`, with a long random ID (at least 128 bits, so nobody can guess another link). The page shows:
  - the name the judge chose to show (optional; the judge types it; it can be just initials);
  - the track name and version;
  - the date;
  - the line from §7, after "Completed this course and passed its final check.": "A free, self-paced course from Tabula. Not a certification or endorsement by any league or tournament."
- **The judge controls it.** The judge can turn the link off (revoke it) or delete the badge. A revoked link says "This link is no longer active" and nothing else.
- **No search engines.** Verify pages send an `X-Robots-Tag: noindex` header (`_headers` today has one rule for all paths, so add one for `/v/*`), and they are left out of `learn/sitemap.xml`. Cloudflare Pages applies every matching rule, so the site CSP from `/*` must still reach `/v/*`. Add a test that checks it. There is no list or search of badge holders.
- **No scripts on verify pages.** They are plain server-made HTML. The display name is escaped, because the page is on the same origin as the judge's API keys.
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

**Size:** after the round-pack accounts exist: about 2 to 3 weeks of code (final-check endpoints and grading, retry wait and timer, badge table, verify page, revoke and delete, certificate with QR, tests). Plus writing and reviewing the hidden pool for the parent judge track (about 40 questions, about 1 to 2 weeks). Plus updates to the privacy policy and ToS.

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
- **Coach view.** A coach sees track completion only for a track the coach **assigned**, and only as "done" or "not done". No scores, no tries, no time spent, no "who is behind" list. This matches the assignment rules in `STUDENT-EDITION.md` §10d.
- **No judge badges for students** (§9, item 10). Student accounts can earn debater-track badges only.
- **No gamification.** No streaks, points, leaderboards, levels, or "badges for logging in" (`STUDENT-EDITION.md` §10c). A badge is only "finished this track".
- **No automatic messages** (retention reminders excepted) about progress to the student, the coach, or parents.
- **Same final check.** A student badge (for example the novice track) needs the same server-graded final check as a judge badge (§5.3), with its own hidden pool.
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
| Account ID, email, birth year, last sign-in date | Every student account |
| Display name, school-space membership, assigned tracks, done or not done | School path only |
| Parent email, consent date, notice version; a light parent account (§9, item 15) | Parent path only |
| Badges: track ID, track version, date | Both paths |
| Sign-in provider and that provider's user ID; during a final check, the attempt token, served question IDs and retry-wait state (same rules as §5.5) | Both paths |

Not stored: final-check answers, time on pages, device data, activity trails. "Last sign-in date" is the only activity data, and it exists only to run the inactivity deletion rules (§6.4, account-life rules). Birth year (no month or day) exists only to block under-13 sign-up and to end parent consent at 18.

**Account-life rules** (owner decisions, 2026-11-19; §9, items 15 to 18):

- **Parent account (data rights only).** The consenting parent gets a light account, with emailed-link sign-in. It shows only: a plain list of what is stored, export, delete, and withdraw consent. It shows no progress, no badge view beyond that list, and sends no alerts except the retention reminders. So it is not a parent dashboard (`STUDENT-EDITION.md` §10i item 5). It is deleted with the student's account.
- **Consent record after deletion.** Keep the consent record (parent email, date, notice version) for 3 years after the account is deleted, as proof of consent, then delete it. It holds no student data.
- **Turning 18.** Every student account stores a **birth year**. In the year the student turns 18, at the start of the next season, the account becomes an adult account, and the parent link and parent account end (with a notice to both). A school-space account stays in its space until the season ends.
- **When school consent ends** (§9, item 20). If the school space is deleted, or the student leaves it, the student has **30 days** to add parent consent and move to the parent path, with reminders and an export link. If not, the account is deleted. The student's own badges (§6.4, moving rule) move with the account; school-space badges stay with the school until the space is deleted.
- **Moving between paths.** Badges earned before joining a school space stay the student's. Badges earned inside the school space are the school's data (the student keeps a copy in the export). Leaving a school space keeps the student's own badges.

**Size:** about 4 to 6 weeks of code **after** these exist: accounts (round packs, §9 item 4), join codes (`STUDENT-EDITION.md` §10h step 3), Phase 2 server grading, and the novice track's hidden pool (Phase 1b). The free school space and a paid Program's space are **one thing**, built once in §10h step 3, with a free-tier flag. Phase 3 adds only the narrow track assignment (assign a track, see done or not done), the badge view, the age gate and the parent flow. It does not need the full assignment system (§10h step 4). The work: the age gate, the free school space, the parent-consent flow with notice and records, the light parent account, retention reminder jobs, the coach view, and the badges. Plus legal review and the data agreement.

## 7. Naming: what to call a badge

Say:

- **"completion badge"**
- **"certificate of completion"**
- "completed the *New parent judge* track"

Do not say (unless a league endorses it in writing):

- "certified", "certification", "certified judge"
- "accredited", "licensed", "qualified", "official", "approved"
- anything that suggests a league, NSDA, a state association, or a tournament stands behind it

Every badge, certificate and verify page carries the line: "A free, self-paced course from Tabula. Not a certification or endorsement by any league or tournament."

Talk to leagues (a state association or NSDA) only **after** the parent judge track has passed both coach reviews and been used for one season (§9, item 7).

If a league later endorses a track, its name appears only with its written approval, and only in the words it approves. A Tabula badge does not replace a league's required training unless that league says so.

## 8. Accounts: what badges need

`PLAN.md` §6 lists "Accounts and login" as needed before charging. They are not built. Badges and round packs should share **one** account system.

### 8.1 What badges need (Phase 2)

- **Sign-in.** Decided (§9, item 4): an emailed sign-in link (no password) plus "Sign in with Google" and "Sign in with Microsoft". Many judges and coaches have a school Google or Microsoft account. No passwords to store or leak.
- **Where it runs.** The same stack as the planned round-pack backend (a Cloudflare Worker and its database, `PLAN.md` §6). A hosted identity service is also fine. Choose the one that the round packs use.
- **Fit with the CSP** (`_headers`):
  - Serve the account and badge endpoints from the same origin (for example Cloudflare Pages Functions under `tabuladebate.com/api/`). Otherwise `connect-src` must change.
  - Use the **redirect** sign-in flow for Google and Microsoft. Their pop-up button libraries load a third-party script, which `script-src 'self'` blocks. That is good: keep it so.
  - `form-action 'none'` blocks plain HTML forms. Sign-in pages either use `fetch` from a self-hosted script, or get their own CSP rule.
- **Stored:** see the table in §5.5. Nothing more.
- **Session.** The sign-in session lives in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, never in `localStorage`, because the app keeps judges' API keys in `localStorage` on this origin. The redirect sign-in flow works with `form-action 'none'` and `connect-src 'self'`, because it is plain navigation.
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

Phase 3 sign-up asks for the user's birth year and refuses anyone under 13. A user aged 13 to 17 goes to the school or parent consent step (§6.1) before the account opens. Adults (Phase 2) only confirm 18+; no birth year is stored for them.

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
9. **Next track: novice debater**, after the parent judge track. It needs 3 wave-2 pages: `answering-disadvantages`, `permutations`, `rebuttal-strategy`.
10. **Students and judge tracks:** students may read the judge tracks and do their per-step checks, but cannot earn a judge badge for now.
11. **The retry wait grows.** After several fails in one day: 5 minutes, then 15, then 60. Tries stay unlimited (§5.3).
12. **The free school space covers badges and tracks only:** join code, assign a track, see done or not done, badges. **Track assignments** are this narrow thing. The full **assignments** of `STUDENT-EDITION.md` §10d (drills, speech redos, case review), the feedback inbox and hosted AI stay in the paid Program (§10g).
13. **A parent-path account is deleted 12 months after its last sign-in**, with reminders 30 days before, 7 days before and on the day, each with an export link.
14. **Coaches see a real display name** for each student in a school space. `BUSINESS-PLAN.md` §10 row 11 is amended to match (§6.3).
15. **Parents get a light account for data rights only:** see what is stored, export, delete, withdraw consent. No progress view, no alerts (§6.4).
16. **Consent records are kept 3 years** after the account is deleted, then deleted.
17. **Every student account stores a birth year** (not month or day). It blocks under-13 sign-up and ends parent consent at 18.
18. **Badges split by where they were earned** when a student moves between the parent path and a school space (§6.4).
19. **Inactive judge accounts are deleted 24 months after the last sign-in**, with reminders and an export link (§5.5).
20. **When school consent ends** (space deleted, or the student leaves), the student has 30 days to add parent consent. If not, the account is deleted (§6.4).

## 10. Rough size, by phase

| Phase | Work | Rough size | Depends on |
|---|---|---|---|
| **1** | `tracks.json`, check parser and renderer, `check.js`, track pages (with the `shell()` depth change), clear, tests, `bridge.mjs` `.js` type, `check-publish.mjs` scan; 6 parent judge checks. Second release: certificate view, export, import | 1 to 1.5 weeks of code, plus about 1 week to write the checks | Coach review of the 6 checks (§2 live rule) |
| **1b** | Novice track: 11 new checks (3 are shared with the judge track) | About 2 weeks of writing and review. The 3 wave-2 pages add about 2 to 3 weeks. Its hidden final-check pool (for Phase 3 student badges) adds about 1 to 2 weeks. | The 3 wave-2 pages and their coach review |
| **2** | Judge badge: server-graded final check with retry wait and timer, verify link, revoke and delete, certificate with QR, privacy policy update; hidden pool of about 40 questions | 2 to 3 weeks of code, plus 1 to 2 weeks to write and review the pool | Round-pack accounts (§8). No date until those are scheduled. |
| **3** | Free student badges: age gate, free school space, parent-consent flow, coach "assigned track done" view, export, retention | 4 to 6 weeks of code, plus legal review and the data agreement | Accounts (round packs), join codes (`STUDENT-EDITION.md` §10h step 3), Phase 2 grading, Phase 1b novice pool. No date until accounts are scheduled. |

## 11. Next step

Build Phase 1 with the parent judge track only: `tracks.json`, the check parser and `check.js`, track pages, and 6 checks. Then write the 3 wave-2 pages for the novice track.
