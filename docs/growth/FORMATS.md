# Debate formats past high school policy

Status: draft for the owner, 2026-11-20. Planning only. No app code changed.

Related: [FORENSICS.md](FORENSICS.md) (speech events), [BRAND.md](BRAND.md) (brand, domains, accounts, repo).

**Not legal advice. Rules change each season. Each tournament's invitation wins.** Sources were seen 2026-11-20. "Unverified" means I found no primary source.

## 1. Summary

- **Recommended order:** LD → PF → college policy (a free preset, same release as LD) → college parli (NPDA/APDA) → British Parliamentary.
- **Why:** LD is closest to today's app (cards, docs, Aff/Neg, a flow grid). Most of it is a data file. PF is the biggest high school debate market, but it needs a few new pieces of code (speaking order, crossfire, a lay-judge ballot). College policy is almost pure data but a small market. Parli and BP need new code for points of information, rank ballots and four-team rounds.
- **The key build step:** move policy's hard-coded speech list into a **format file**. After that, each new format is mostly a new file plus a few small features.

## 2. The formats at a glance

Times are minutes. "CX" is cross-examination. "POI" is a point of information (a short question during the other side's speech).

| | **HS Policy** (today) | **Public Forum** | **Lincoln-Douglas** | **College Policy** (NDT/CEDA) | **NPDA parli** | **APDA parli** | **British Parl.** (BP) |
|---|---|---|---|---|---|---|---|
| Teams | 2 v 2 | 2 v 2 | 1 v 1 | 2 v 2 | 2 v 2 | 2 v 2 | 4 teams of 2 |
| Speeches | 8,3,8,3,8,3,8,3 then 5,5,5,5 | Con 4,4 · CF 3 · Reb 4,4 · CF 3 · Sum 3,3 · Grand CF 3 · Final Focus 2,2 | AC 6 · CX 3 · NC 7 · CX 3 · 1AR 4 · NR 6 · 2AR 3 | 9 / 3 CX / 6 | PMC 7 · LOC 8 · MG 8 · MO 8 · LOR 4 · PMR 5 | 7:30 · 8:30 · 8:30 · 8:30 · 4:30 · 5:30 | 8 speeches of 7 (5 in schools) |
| Questions | CX after each constructive | Crossfire, both speakers; Grand CF all four | CX after each constructive | CX | POIs in constructives | POIs, not in first or last minute | POIs, opposite side only, ≤15 s |
| Prep | 8 per team | 3 per team (some invitationals 4) | 4 per debater | 10 per team (total) | ~20 after topic release | Case brought in; Opp has none. Motion rounds: 15 | 15 after motion, no devices |
| Who speaks first | Aff | Coin flip picks side **and** order | Aff | Aff | Gov | Gov | Opening Gov |
| Flow | 1 sheet per argument, 7 columns | Usually Pro and Con case sheets (unverified) | Framework (value, criterion) then contentions; progressive LD uses T/DA/CP/K (unverified) | Like HS policy, faster | Paper, few sheets (unverified) | Same (unverified) | Notes per team, 4 teams (unverified) |
| Ballot | Win/loss + points | Win/loss + points; lay judges common | Win/loss + points | Win/loss + points, half/tenth points | Win/loss + points; oral RFD common | Win/loss + points **5–45** + speaker ranks 1–4 | **Rank teams 1st–4th** (3/2/1/0) + points **50–100**; panel confers; oral adjudication |
| Evidence | Cards; full docs shared (email chain, SpeechDrop, Tabroom share) | Cards or paraphrase; NSDA evidence rules; cards shared on request more than full docs (unverified) | Cards; docs shared on the circuit | Cards; docs shared; openCaselist | **No evidence in round** | No evidence | **No evidence, no devices** |
| Topic | One per year | Monthly or two-monthly | Two-monthly | One per year | New motion every round | Gov writes case; some motion rounds | New motion every round |
| Season | Sep–Jun (NSDA Nats June; TOC April) | Same | Same | Sep–Apr (NDT late Mar/early Apr) | Sep–Mar (Nats late Feb–Apr) | Sep–Apr (Nats late Apr) | All year; WUDC Dec 29–Jan 3 |
| Tournament days | Fri–Sat or Sat, 4–7 prelims (unverified) | Same | Same | 2–3 days, 6–8 prelims (unverified) | 6 prelims at Nats | Weekend | WUDC 9 prelims |

2026-27 topics: Policy is national health insurance. PF Sep/Oct is a data center moratorium; Nov/Dec is NATO members and the nuclear ban treaty. LD Sep/Oct is space colonization; Nov/Dec is de-extinction. (NSDA topics page.)

## 3. Market size (rough)

Judge counts are not published anywhere I could find. So the table counts students and teams. Treat every number as a range.

| Circuit | Best numbers found | How solid |
|---|---|---|
| NSDA (all HS speech and debate) | ~100,000 students and 4,000 schools (2025 one-pager). Marketing figure 140,000 students, 5,200 coaches. 3,199 HS and 643 MS schools with degrees. | Medium. Sources conflict. |
| NSDA Nationals 2025 | 7,089 students from 1,562 schools, all events | Solid |
| PF, LD, Policy split | No public per-event counts found. Nov/Dec 2026 LD topic vote: 636 coaches, 3,167 students (secondary source). | Weak |
| Urban debate leagues (mostly policy) | 24 cities, 500+ schools | Medium |
| NDT | ≤78 teams at the national tournament | Solid |
| CEDA Nationals | 175–200+ teams | Fairly solid |
| NPDA | ~200–250 schools a year (2015 figure) | Dated |
| APDA | ~80 member schools, mostly Northeast | Medium |
| BP / WUDC | 150–400 teams at Worlds; many national school and university circuits | Range only |

**Reading this:** High school is where the people are. PF and LD each likely have more students than HS policy, but I could not prove the split. College circuits are small: good for reputation, weak for revenue. BP is large worldwide, but it is a new market with no evidence and no devices for debaters.

**First thing to measure (cheap):** count PF, LD and CX entries on 20 public Tabroom tournaments this season. That gives a real split. See open question Q4.

## 4. What carries over from Tabula

✓ = as is. ◐ = small change. ✗ = new work. **D** = can be data in a format file. **C** = needs new code.

| Part | LD | PF | College policy | Parli (NPDA/APDA) | BP |
|---|---|---|---|---|---|
| Clock and Next speech | ✓ **D** | ◐ **D** + **C**: order chosen by coin flip; crossfire rows | ✓ **D** | ◐ **D** + **C**: POI tally button | ◐ **D** + **C**: 8 speeches, 4 teams |
| Prep timers | ◐ **D**: per debater, 4 min | ✓ **D**: 3 min | ✓ **D**: 10 min per team | ✗ **C**: one shared topic-prep countdown before the round | ✗ **C**: one 15-min countdown |
| Flow grid | ◐ **D**: 7 columns (AC, NC, 1AR, NR, 2AR…) | ◐ **D**: 8 columns; crossfire not flowed | ✓ **D** | ◐ **D**: 6 columns | ✗ **C**: 8 columns across 4 teams, or a sheet per team |
| Default sheets | ◐ **D**: Framework, Aff case, Neg case (+T, DA, CP, K) | ◐ **D**: Pro case, Con case | ✓ **D** | ◐ **D**: Gov case, Opp | ✗ **D**+**C** |
| Ballot | ✓ **D** | ◐ **D**: lay wording, simpler RFD | ◐ **D**: tenth points | ◐ **D**: 5–45 scale; **C** for speaker ranks 1–4 (APDA) | ✗ **C**: rank 4 teams, 50–100 scale, panel notes |
| Tabroom copy boxes | ✓ | ✓ | ✓ | ◐ | ✗ (most BP uses Tabbycat) |
| Speech docs, SpeechDrop | ✓ | ◐ cards on request more than full docs | ✓ | ✗ not used (hide) | ✗ not used (hide) |
| AI flow | ◐ **D**: format prompt text, transcribe hint | ◐ **D** | ✓ **D** | ◐ **D**: no docs, so transcript only | ◐ **D**+**C**: 4 teams |
| AI ballot, Live Eval, analysis | ◐ **D**: rules text (no new args in 2AR; framework weighing) | ◐ **D**: rules text (no new args in final focus; weighing) | ✓ **D** | ◐ **D** | ✗ **C**: a 4-way ranking, not a winner |
| Debate Library | ◐ ~50% of the 79 pages apply (cards, flowing, T/DA/CP/K in progressive LD). New pages: value and criterion, LD framework, philosophy basics | ◐ ~30% apply. New pages: crossfire, summary, final focus, weighing, paraphrase rules | ✓ ~all apply | ◐ ~20% apply. New pages: POIs, case building, no-evidence argument | ◐ ~15% apply. New pages: roles of the 4 teams, extension, ranking |
| Student edition rules | ✓ | ✓ | ✓ | ✓ | ✓ |

### What the format file holds (data)

One JSON file per format, named by the architecture plan's format ID, for example `formats/ld.json`:

- `id`, `name`, `level` (HS or college)
- `sides`: labels and colors (Aff/Neg, Pro/Con, Gov/Opp, or OG/OO/CG/CO)
- `speeches`: id, label, side, seconds, speaker, kind (`speech`, `cx`, `crossfire`, `grandCrossfire`, `poiAllowed`), flow column
- `flowColumns` and `defaultSheets`
- `prep`: seconds, and mode (`perTeam`, `perDebater`, `sharedPool`, `beforeRound`)
- `order`: `fixed` or `coinFlip`
- `ballot`: decision type (`winLoss` or `rank4`), points min/max/step, speaker ranks yes/no, ballot wording
- `evidence`: `cards`, `paraphraseAllowed`, or `none`; doc share on/off
- `ai`: transcribe hint, judge rules text, "no new arguments in" list
- `library`: which Library tags apply

### What needs new code

1. **Load speeches from a format file** instead of the constants at the top of `logic.js`. Today policy names appear about 40 times in `logic.js` and 18 times in `app.js`. This is the one big refactor. It unlocks LD, PF and college policy.
2. **Format in the round record.** Old rounds default to HS policy.
3. **Coin-flip order** (PF): pick side and who speaks first.
4. **Crossfire rows** (PF): timed, not flowed, both sides at once.
5. **Prep modes:** per debater (LD), shared topic prep before the round (parli, BP).
6. **POI tally** (parli, BP): one key adds a POI to the current speaker. Small.
7. **Rank ballot** (APDA speaker ranks, BP team ranks) and new point scales.
8. **Four-team round** (BP): sides, flow and AI all assume two sides today. Large.

## 5. Value against effort

Scores 1–5. Value = market size × fit with judges who flow and use laptops. Effort = new code beyond the format file.

| Rank | Format | Value | Effort | Note |
|---|---|---|---|---|
| 1 | **LD** | 4 | 1 | Same habits as policy: cards, docs, flow judges. Proves the format file. |
| 2 | **PF** | 5 | 2 | Biggest HS market. Many lay judges, so Plain mode and a short clean ballot matter most. More rival AI tools here already (PublicForumAI, Debate Judge AI, Criterion). |
| 3 | **College policy** | 2 | 1 | Tiny market. Ship as a free preset with LD. Good for credibility with coaches, who were often college debaters. |
| 4 | **NPDA / APDA** | 2 | 3 | No evidence, so the AI works from transcripts only. POIs and rank ballots needed. |
| 5 | **BP** | 3 | 5 | Large worldwide but a different world: four teams, Tabbycat, oral adjudication. Do last, if ever. |

**Suggested order and timing (owner to confirm):**

1. **Format file refactor + LD + college policy preset.** Target: before the Jan/Feb LD topic window, or summer 2027 if the UI slices run long.
2. **PF.** Target: ready for the 2027-28 season start (Sep 2027), with camps in summer 2027 as the test bed.
3. **Parli presets** (data only, no POI tally at first). Later.
4. **BP.** Only after a clear signal (for example, a school league asks).

## 6. Go-to-market: next market

**Enter LD next, then PF.** Speech events (FORENSICS.md) come after both.

### Why LD first
- LD judges on the national circuit flow on laptops, read cards and get speech docs. That is today's Tabula user.
- Many LD judges also judge policy, and many policy coaches also coach LD. Tabula can reach them through people it already knows.
- It proves the format file at low cost before the bigger PF build.

### How to reach judges and coaches
1. **Through the coach, not the judge.** Coaches recruit and brief their parent and alumni judges. One coach can bring 5–15 judges. Offer coaches a short "judge kit": a one-page guide plus a link that opens Tabula set to LD or PF.
2. **Tournament judge briefings.** Ask 3–5 friendly tournament directors to put one line and a link in the judge email ("A free flow and ballot helper: tabuladebate.com"). No sponsorship money needed at first.
3. **NSDA Learn and judge training season.** Judges train in Sep–Oct. A free "How to flow LD" and "How to flow PF" page in the Library ranks in search at that time.
4. **Summer camps (Jun–Aug).** Camp staff and lab leaders try new tools. A camp is a safe place to test PF before the season.
5. **Topic release days.** Each new LD and PF topic comes out about a month before it starts. A free Library page per topic ("What this topic is about, how to flow it") brings judges in each time.
6. **Community spaces** where coaches already talk (coach forums, state league lists). Post only where the rules allow it.

### What to prove first (before more build)
1. **A first-time LD judge starts a round in under 60 seconds** (the same target as the policy spec), with LD loaded.
2. **5 LD judges and 5 PF judges** use it at a real tournament and fill a short survey. Pass mark: 4 of 5 say they would use it again.
3. **PF lay judges finish a ballot faster** with Tabula than on paper or the Tabroom ballot alone. Measure minutes.
4. **At least 2 coaches** share the judge kit with their pool without being asked twice.
5. **Paid signal:** at least 1 in 20 active LD/PF judges pays for hosted AI in the first season. If not, keep LD/PF free and learn why before PF marketing.

## 7. Notes for the architecture plan

These affect `docs/architecture/` (owned by another session; I did not edit it). `ARCHITECTURE.md` §9 already plans "format as data" with the IDs `policy-hs`, `ld`, `pf`, `parli`, `college-policy`. This plan uses the same IDs. Add `bp` later if BP goes ahead.


- Each round record needs a `format` id. Each credit debit can carry it too.
- Credits per round change by format. A PF round is about 40 minutes of speech and talk. LD is about 45. Policy is about 90. So PF and LD rounds should cost fewer credits than policy. The price page should say "rounds" per format, not one number.
- Format files are static data. They can ship with the app and work offline.
- Peak Saturday load grows with each format: PF and LD run in the same buildings on the same days as policy.

## 8. Open questions for the owner

- **Q1.** Do you agree with the order LD → PF → college policy preset → parli → BP?
- **Q2.** Should LD ship before PF, even though PF is the bigger market? (LD is cheaper and proves the format file. PF is where the money is.)
- **Q3.** For PF lay judges, should Plain mode become the default when the format is PF?
- **Q4.** May I (or a later session) count entries per event on about 20 public Tabroom tournaments to get a real market split? It reads public pages only.
- **Q5.** Should college formats stay free presets with no marketing, to keep focus on high school?
- **Q6.** Do you know any LD or PF coaches who would test a beta? Their names stay private.

## Sources

High school (NSDA):
- Policy event page: https://www.speechanddebate.org/policy-debate/
- PF event page: https://www.speechanddebate.org/public-forum-debate/
- LD event page: https://www.speechanddebate.org/lincoln-douglas-debate/
- Topics 2026-27: https://www.speechanddebate.org/topics/ and https://nfhs.org/stories/nfhs-announces-health-insurance-to-be-2026-27-national-high-school-policy-debate-topic
- Evidence guide: https://www.speechanddebate.org/wp-content/uploads/Debate-Evidence-Guide.pdf
- PF prep variants: https://en.wikipedia.org/wiki/Public_forum_debate and https://s3.amazonaws.com/tabroom-files/tourns/21194/postings/28360/PublicForumSpeechTimesandRubric.pdf
- Policy flow and points norms: https://en.wikipedia.org/wiki/Policy_debate
- Tabroom share: https://docs.tabroom.com/settings/tabroom-share
- TOC: https://en.wikipedia.org/wiki/Tournament_of_Champions_(debate)
- NSDA size: https://www.speechanddebate.org/wp-content/uploads/2025_NSDA_OnePager.pdf, https://www.speechanddebate.org/community-impact-report-2025/, https://en.wikipedia.org/wiki/National_Speech_and_Debate_Association
- LD topic vote (secondary): https://orieladmissions.com/?p=11578

College and BP:
- NDT Standing Rules (times, prep, field size, panels): https://nationaldebatetournament.org/about/standing-rules/
- CEDA: https://cedadebate.org/ and https://en.wikipedia.org/wiki/Cross_Examination_Debate_Association
- openCaselist dataset: https://huggingface.co/datasets/Yusuf5/OpenCaselist/blob/main/README.md
- NPDA: https://en.wikipedia.org/wiki/National_Parliamentary_Debate_Association, https://npdadebate.com/wp-content/uploads/2025/11/NPDA-2026-Invitation.pdf
- APDA: https://apda.online/about/guide-to-apda/, https://apda.online/wp-content/uploads/2021/09/RevisedSpeakerScale.pdf, https://en.wikipedia.org/wiki/American_Parliamentary_Debate_Association
- BP: https://en.wikipedia.org/wiki/British_Parliamentary_Style, https://en.wikipedia.org/wiki/World_Universities_Debating_Championship, https://www.uvm.edu/~debate/watch/wudcdvd/text/bphandbook.pdf, WUDC Debating and Judging Manual https://debatingunion.ssmu.ca/wp-content/uploads/2023/10/WUDC-Debating-and-Judging-Manual.pdf
- Tabbycat: https://tabbycat.readthedocs.io/en/stable/guide/comparisons.html

Rival tools (PF/LD): https://www.debatedrills.com/blog/publicforumai, https://apps.apple.com/us/app/criterion/id6751784325, https://flexcel-flow.github.io/flexcel-website

Code facts: `logic.js` lines 5–33 (`SPEECHES`, `FLOW_COLUMNS`, `DEFAULT_FLOWS`), `logic.js` `SPEECH_TO_COLUMN`, `TRANSCRIBE_HINT`.
