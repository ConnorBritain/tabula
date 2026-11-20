# Brand architecture

Status: draft for the owner, 2026-11-20. Planning only. No app code changed.

Related: [FORMATS.md](FORMATS.md) (debate formats), [FORENSICS.md](FORENSICS.md) (speech events). Technical side of domains and subdomains: [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md).

## 0. Owner decisions (2026-11-20)

- **Debate app address:** `debate.tabulaspeech.com`, from the first public launch.
- **Public name for the speech-events line:** **Tabula Speech Events**.
- **tabulaspeech.com** is the overarching commercial site for the whole family: plans, sign-in, links to every product.
- **tabuladebate.com** and **tabulaforensics.com** are product marketing sites.
- **Apps run on subdomains** of tabulaspeech.com.
- **Learning content sits on the commercial domains, by section:** debate learning at tabuladebate.com (the Debate Library, as today); speech-events learning at tabulaforensics.com, next to its marketing.
- **Order:** LD, then PF, then speech events.

These decisions replace my earlier advice where they differ (for example, tabulaforensics.com is now a marketing site, not only a redirect).

## 1. The question

The owner's idea: **Tabula Speech** is the parent brand and hub (resources and links). Under it sit **Tabula Debate** and a speech-events line (first called "Tabula Forensics"). More speech products can come later. The owner owns tabuladebate.com, tabulaspeech.com, tabulaspeech.org and tabulaforensics.com.

This doc weighs that idea against two other shapes. Then it covers names, domains, accounts and plans, and the open-source repo.

## 2. Three shapes

| Shape | What the user sees | Good | Bad |
|---|---|---|---|
| **A. Parent + product lines** (owner's idea) | tabulaspeech.com hub. Tabula Debate and a speech-events product as named products. | Room to grow. Each product talks to its own buyer (a debate judge is not an interp judge). Coaches who run both see one family. | Three names to keep up. A hub with one product looks empty. More pages to write. |
| **B. One brand, format modes** | "Tabula" only. Pick Policy, PF, LD, Extemp… in Round setup. | Least work. One site, one login, one price page. | "Debate" in the domain hides speech events. One page must sell to very different judges. Speech features crowd a debate app. |
| **C. Separate brands** | Unrelated names for each product. | Each product can fail alone. | No shared trust. Double marketing. A solo developer cannot carry two brands. |

### Recommendation: A, but staged

- **Now to first speech-events beta: act like B on the outside.** One product, "Tabula Debate", with debate formats as modes. tabuladebate.com is the public home. Do not build a hub page with one product in it.
- **But fix the app's address under the parent now** (see §4). Moving a local-first app to a new address later loses judges' saved rounds.
- **When the speech-events app has a working beta: turn on A.** tabulaspeech.com becomes the hub.
- **Never do C.**

Why: A is the right end state. But a hub page with one product is weak. And the speech-events app is a new app, not a mode (see FORENSICS.md §4). So the second product line is real only when that app exists.

## 3. Names

- **Parent:** "Tabula" in short, "Tabula Speech" in full. "Speech" is the umbrella word schools use ("speech and debate", the NSDA's own name).
- **Product lines:** "Tabula Debate" (all debate formats). A second line for speech events and Congress.
  - The owner agrees "forensics" confuses people outside the activity (it sounds like crime labs). Most speech judges are parents and community members. So the **public name should not be "Forensics"**.
  - **Public name (owner decision): "Tabula Speech Events"** (plain, matches "speech and debate").
  - "Forensics" can still appear in coach-facing copy and search keywords, because coaches and leagues use it.
- **Format names are not brands.** PF, LD, Policy, Extemp and Congress are modes or pages inside a product line, never their own brand or app.
- **Editions stay as editions, not brands:** judge edition, student edition, coach edition. They live inside each product line.
- **Byline:** "Made by Connor England" stays on every product. Legal entity on legal pages: Pattern Engine LLC.

### Trademark check (do this before spending on the brand)

- "Tabula" is a common Latin word. Other products use it. One example is Tabula, the open-source tool that pulls tables out of PDFs (tabula.technology). tabula.com and tabula.io are taken.
- I did **not** search the USPTO. I am not a lawyer. A short trademark search on "Tabula" in class 9 (software) and class 41 (education) is a must before the brand goes on paid ads or merch.

## 4. Domains and addresses

### What the owner owns (2026-11-20, all on Cloudflare)

- tabuladebate.com
- tabulaspeech.com
- tabulaspeech.org
- tabulaforensics.com (mainly a protective buy)

Taken by others (public lookup, 2026-11-20): tabula.com, tabula.io, tabula.app, usetabula.com, gettabula.com, tabulahq.com. Optional cheap protective buys, only if wanted: tabuladebate.org, tabulaspeech.app.

### The owner's idea

- **Tabula Speech** is the parent brand.
- **tabuladebate.com** and **tabulaforensics.com** are product marketing sites.
- **The apps run on subdomains of the parent:** `debate.tabulaspeech.com`, `forensics.tabulaspeech.com`, maybe with format-level names (PF, LD).

### My view: yes to the shape, with three changes

**1. Apps on parent subdomains: yes.** This is the strongest part of the idea.
- All apps share one parent domain. So one sign-in can work across every app, and later products slot in as new subdomains.
- It also fixes a gap: the current architecture draft puts the app at `app.tabuladebate.com` with a sign-in cookie for `tabuladebate.com` only. That would not reach a second product.
- **The address is now decided (`debate.tabulaspeech.com`), and it must not change after launch.** A local-first app keeps rounds in the browser, tied to its exact address. Moving the app later means judges lose saved rounds unless they export them. It also breaks installed apps and bookmarks.
- Name the speech-events app by what it does, not by "forensics": for example `events.tabulaspeech.com` or `speech.tabulaspeech.com`. See open question Q4.

**2. Format-level subdomains (pf., ld.): no.** Use modes and pages instead.
- Each subdomain is a separate address. So each would keep its own saved rounds, settings and keys, and need its own install. A judge who judges PF in the morning and LD after lunch would have two apps that cannot see each other's rounds.
- Formats are data inside one app (FORMATS.md §4). Pick the format in Round setup. A link can open the app set to a format, for example `debate.tabulaspeech.com/?format=pf`.
- For search and marketing, make **format pages** on the marketing site: `tabuladebate.com/pf/`, `tabuladebate.com/ld/`.

**3. Product marketing sites: yes for tabuladebate.com. Not yet for tabulaforensics.com.**
- tabuladebate.com keeps the debate marketing page and the Debate Library (its search ranking already points there).
- tabulaforensics.com: **owner decision: the speech-events marketing site.** Until the app exists, it shows a short "coming later" page. (My earlier advice was a redirect only, because "forensics" confuses the public. The mismatch note in the address map covers that risk.)

**Technical detail lives in the architecture plan.** Subdomains, the shared sign-in cookie, the API host, the student edition address and the Library badge check are covered in [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) (§3 origins, §9 room for other formats and brands). One point for that plan: if the app moves to `debate.tabulaspeech.com` while the Library stays on `tabuladebate.com`, the two are different domains. A cookie cannot cross them, so the Library badge check needs a different method. That is the architecture session's call.

### What tabulaspeech.org could be for

Recommended: **the free and open side of Tabula.**
- The open-source project page: what the code is, the AGPL license, how to run it locally, how to report bugs and help.
- Free resources for judges and coaches: judge guides, the "judge kit" for coaches (FORMATS.md §6), links to the Libraries.
- A plain privacy and data page for schools: what is stored, where, and for how long.

Why .org: schools and coaches read .org as "free resource, not a sales page". It fits the "Tabula Speech hub (resources and links)" idea, and keeps sales copy on .com.

Until that content exists: **redirect tabulaspeech.org to tabulaspeech.com.** Do not move the Debate Library to .org now; that would reset its search ranking for little gain.

### Address map (owner decisions applied)

| Address | Now | When the speech-events app has a beta |
|---|---|---|
| tabulaspeech.com | Simple parent page | Commercial hub: all products, plans, sign-in |
| debate.tabulaspeech.com | **The debate app** (decided) | Same |
| events.tabulaspeech.com (name TBD, Q4) | Not used | The Tabula Speech Events app |
| tabuladebate.com | Debate marketing, format pages, Debate Library | Same |
| tabulaforensics.com | Simple "coming later" page | Tabula Speech Events marketing site and speech-events learning content |
| tabulaspeech.org | Redirect to .com | Open source, free resources, privacy page for schools |

**Name and domain mismatch to watch:** the product is "Tabula Speech Events" but its marketing site is tabulaforensics.com. Coaches will find it by the word "forensics". Parents may not. Put "Tabula Speech Events: extemp, oratory, interp, Congress" at the top of every page there, and link to it from tabulaspeech.com with the plain name.

## 5. Accounts and plans across product lines

Rule: **one account, one wallet, many products.**

- **One Tabula account** works in every product line. A coach who judges PF on Saturday and extemp on Sunday signs in once.
- **Credits are the shared currency.** Hosted-AI credits spend the same in Debate and Speech Events. Do not sell a separate speech-events pass at first. Fewer products means less checkout, support and copy work.
- **Free stays free in every line.** The same rule as today: the whole app is free; paid plans sell hosted AI without a key.
- **Programs (coach plans) cover the whole school.** A school buys one Program. Its judges and students use both product lines. Speech-heavy schools then get value from day one.
- **Student edition rules apply in every line.** No live judging help in a round, in debate or in speech events.
- **Where data lives:** each product reads and writes its own record types (rounds, ballots, rooms). The account, wallet, backup and Program sit above them. The architecture session should keep "product line" as a field on records and on credit debits, so reports can split revenue by line.

## 6. The open-source repo

Today: one public repo (`ConnorBritain/tabula`, AGPL-3.0). Server, billing and coach backend may be private (owner decision).

Recommendation: **keep one public repo.** Split by folder, not by repo.

- `core/` (later): clock, timers, storage, export, AI client, keyboard map, dialogs, toasts. Shared.
- `debate/`: today's app, plus format files (`formats/policy.json`, `formats/pf.json`, …).
- `events/` (name TBD): the speech-events app when it starts.
- `docs/library/`: the Debate Library. A Speech Library can sit next to it.
- Private repo(s): server, billing, coach backend. As already decided.

Why one repo:
- One developer. One CI, one issue list, one license file.
- Shared code changes land in one commit. No version drift between two repos.
- AGPL covers it all the same way.

When to split: only if outside contributors want just one product, or a product gets its own team. Not before.

The folder split is a refactor of app files. It is **not** part of this plan's scope. It should wait until the UI slices settle, and it needs its own design and tests.

## 7. Open questions for the owner

Decided 2026-11-20: app at `debate.tabulaspeech.com`; public name Tabula Speech Events; tabulaspeech.com as the commercial hub; tabuladebate.com and tabulaforensics.com as marketing sites; order LD, PF, speech events; speech-events learning content on tabulaforensics.com.

Still open:

- **Q1.** Drop format-level subdomains (pf., ld.) in favor of format modes in the app and format pages on tabuladebate.com: yes?
- **Q2.** tabulaspeech.org as the free and open side (open source, judge guides, school privacy page), with a redirect until then: yes?
- **Q4.** Speech-events app address: `events.tabulaspeech.com` or `speech.tabulaspeech.com`?
- **Q5.** Will you pay for a short trademark search on "Tabula" before marketing spend?
- **Q6.** One shared credit wallet across all product lines: yes?
- **Q7.** Keep one public repo with folders, and split only if a real need shows up: yes?

## Sources

- Domains owned: owner input, 2026-11-20. Taken-domain results: Verisign WHOIS (`whois.verisign-grs.com`), Verisign RDAP (`rdap.verisign.com`), Google Registry RDAP (`pubapi.registry.google`), PIR and `.io` WHOIS. All checked 2026-11-20.
- NSDA name "National Speech & Debate Association": https://www.speechanddebate.org/
- Tabula PDF tool: https://tabula.technology/
- Plan and credit rules: the owner's private business notes (not quoted here).
