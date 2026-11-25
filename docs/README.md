# Docs map

These docs explain the public Tabula apps (Tabula Debate and Tabula Speech Events): their formats, their design rules and how to work on them. Hosting and the server are not in this repository. The public API contract between the apps and the server is in [`contract/`](contract/).

## Start here

| File | What it is |
|---|---|
| [`README.md`](../README.md) | The repository: what the apps do, how to run and test them, and the code map |
| [`SECURITY.md`](../SECURITY.md) | How to report a security problem |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | How to file an issue, and the current rules for code changes |
| [`PLAN.md`](../PLAN.md) | The working plan for the Debate app (data, brand, UI, audio, open source) |
| [`contract/`](contract/) | What an app sends to the server, and what it gets back |
| [`formats/FORMATS.md`](formats/FORMATS.md) | Speech and prep times for the debate formats |

## Top-level docs

| File | Purpose | Status |
|---|---|---|
| [`STUDENT-EDITION.md`](STUDENT-EDITION.md) | Design notes on help for debaters with flowing and docs | Proposal |

## `architecture/`

| File | Purpose | Status |
|---|---|---|
| [`ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | How the local app grows into a hosted app with accounts and hosted AI. The round never needs the server. | Draft 3 |
| [`STACK.md`](architecture/STACK.md) | Vendor choices for hosting and operations | Draft 2 |
| [`SCALING.md`](architecture/SCALING.md) | Method to estimate load and capacity | Draft 1 |

## `contract/`

| File | Purpose | Status |
|---|---|---|
| [`README.md`](contract/README.md) | Introduction to the public server contract | — |
| [`API.md`](contract/API.md) | Routes, fields, error codes and cookies | — |
| [`ai-replies-v1.json`](contract/ai-replies-v1.json) | JSON Schemas for hosted AI replies, version 1 | — |

## `design/`

| File | Purpose | Status |
|---|---|---|
| [`SPEC.md`](design/SPEC.md) | UI/UX spec for the Debate app | Draft for owner approval |
| [`UX-RESEARCH.md`](design/UX-RESEARCH.md) | UI/UX research: findings, patterns and open questions | — |
| [`DECISIONS.md`](design/DECISIONS.md) | Owner answers to the questions in `UX-RESEARCH.md` §6 | Decided |
| [`NO-STRIPES.md`](design/NO-STRIPES.md) | The no-stripes rule and the button system | Approved, built |
| [`AI-POLICY.md`](design/AI-POLICY.md) | Program controls that turn the AI tools off for some people | Draft 1, owner decisions made |
| [`AI-ROUND-CONSENT.md`](design/AI-ROUND-CONSENT.md) | Choose: a judge clicks to use a round's AI, or the AI starts when the round starts | — |
| [`BUY-FIRST-SPEC.md`](design/BUY-FIRST-SPEC.md) | Account setup after checkout | Draft 2 |
| [`FORMAT-PICK.md`](design/FORMAT-PICK.md) | Debate format names, and where a judge picks the format | Draft 1 |
| [`WELCOME-COPY.md`](design/WELCOME-COPY.md) | Final copy for the welcome dialog | — |
| [`COPY-TRIM-AUDIT.md`](design/COPY-TRIM-AUDIT.md) | Audit of app text that can be cut | Report only |
| [`EVENTS-DESIGN-REVIEW.md`](design/EVENTS-DESIGN-REVIEW.md) | Design review of every Speech Events screen | Owner accepted §4 |
| [`events-review/`](design/events-review/) | Screenshots for `EVENTS-DESIGN-REVIEW.md` (laptop and phone, light and dark) | — |

## `events/`

Design notes for Tabula Speech Events. The app code is in `events/` at the root.

| File | Purpose | Status |
|---|---|---|
| [`EVENTS.md`](events/EVENTS.md) | Which events the app supports, and their rules in plain words | Draft 1 |
| [`CATALOG.md`](events/CATALOG.md) | Full list of competitive events, the app that owns each one, and what each needs | Draft 1 |
| [`VENN.md`](events/VENN.md) | Which parts all events share, some share, or only one has | Draft 1 |
| [`SHARED-VS-NEW.md`](events/SHARED-VS-NEW.md) | Which parts the app reuses, and which parts are new | Draft 1 |
| [`ARCHITECTURE.md`](events/ARCHITECTURE.md) | Speech Events architecture | Draft 1 |
| [`MODELS.md`](events/MODELS.md) | Object, data and design models for each event family | Draft 1 |
| [`DESIGN.md`](events/DESIGN.md) | Look and components | Draft 1 |
| [`EXPERIENCE.md`](events/EXPERIENCE.md) | Home screens, the round router, the page for each round type and the floater flow | Draft 1, owner accepted §12 |
| [`CONGRESS.md`](events/CONGRESS.md) | Design of the Congressional Debate screens | Draft 1, scorer built |
| [`CONGRESS-REVIEW.md`](events/CONGRESS-REVIEW.md) | Design review of the Congress scorer screens | Review done |
| [`LEAGUES.md`](events/LEAGUES.md) | League rule packs and their draft profile files | Draft 1 |
| [`PROTOTYPE-TEST.md`](events/PROTOTYPE-TEST.md) | Plan for a 5-judge lay test of the prototype | — |
| [`DEPLOY.md`](events/DEPLOY.md) | How Speech Events is built and hosted as static files | — |

## `formats/`

| File | Purpose | Status |
|---|---|---|
| [`FORMATS.md`](formats/FORMATS.md) | Speech and prep times used by the format files in `formats/` at the root | — |

## `library/`

Source for the public Library pages in `learn/` (built by `build-learn.mjs`). Run `node build-learn.mjs` after you edit this folder. The text has its own license (see [`LICENSE.md`](library/LICENSE.md)).

| File | Purpose | Status |
|---|---|---|
| [`index.md`](library/index.md) | The Library home page | Built |
| `<topic>.md`, `example-*.md` | One file for each Library page (topics and example rounds) | Built |
| [`checks/`](library/checks/) | Short checks for the track pages, one file per page | Built as draft (checks wait for review) |
| [`tracks.json`](library/tracks.json) | The guided tracks and reading paths | Built (a track goes live after its checks are reviewed) |
| [`learn.css`](library/learn.css) | Library styles, copied to `learn/` | Built |
| [`library.js`](library/library.js) | Library page script, copied to `learn/` | Built |
| [`images/`](library/images/) | Web copies of the Library pictures. A picture shows only when its slot is approved. | — |
| [`visuals/`](library/visuals/) | Picture slots, status ledger, style guide, prompt template, image session prompt and image scripts | — |
| [`PLAN.md`](library/PLAN.md) | Plan for the Library: pages, tone and build | Not built as a page |
| [`TRACKS.md`](library/TRACKS.md) | Design for guided tracks, checks and completion badges | Draft 3, phase 1 built. Not built as a page. |
| [`READERS.md`](library/READERS.md) | Who reads each page, and the words to use for that reader | v1. Not built as a page. |
| [`LICENSE.md`](library/LICENSE.md) | License for the Library text (CC BY-SA 4.0) | Not built as a page |

The builder skips `PLAN.md`, `LICENSE.md`, `TRACKS.md` and `READERS.md` (`NOT_PAGES` in `build-learn.mjs`). It also skips files that end in `.local.md`.

## Where else

- The app code map is in the root [`README.md`](../README.md).
- Hosting, the server and the marketing sites live in private repositories.

## Keep this map current

When you add a doc, add a row here.
