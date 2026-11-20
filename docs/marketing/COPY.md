# Marketing copy deck (draft 2, 2026-11-20)

This file holds the final copy for the three Tabula sites. The copy is now in the page files in `~/Code/tabula-sites`.
Use this file to review the words. Use [ANTI-PATTERNS.md](ANTI-PATTERNS.md) section 5 to check each change.

This file is public. It has no prices.

## 1. What changed, in short

- Every page has a benefit headline. No headline is a slogan pair, a feature name or an "X, not Y" line.
- The `.facts` stat strips are gone from both home pages. Each fact now lives in the section that proves it.
- We removed all eyebrows but one (the dot eyebrow on the tabulaspeech.com hero, now "Free and open source"). The three 404 pages keep their "404" label.
- No page says how many pages the Debate Library has. The `{{libpages}}` placeholder is no longer used in copy.
- Formats say "Policy, available today" and "Lincoln-Douglas and Public Forum, coming soon". No page says "next".
- Features that do not exist yet (Programs, admin AI controls, Speech Events) are in the future tense.
- Middle-dot chains are gone from copy. The product pictures keep their app-style labels, for example "2AC · 8 min".
- Buttons say what they do: "Open Tabula Debate", "Read the first-round judge guide", "Email me when it opens".
- We fixed one picture label for accuracy: "Copy for tournament ballot" is now "Copy for the tournament ballot", the real app button.
- Headlines wrap their last phrase in `<span class="nowrap">` so the break falls between ideas. No headline uses `<br>`.

## 2. How we worked

We used the koedify plugin.

1. **Headlines (`koedify:headline`).** For each h1 we listed the page's strongest parts (problem, goal, benefit). We wrote at least 10 candidates in 4 or more frames, then cut questions, contrast pairs, jargon and long lines.
2. **Reader panel (`koedify:panel`).** Five `koedify:lens-critic` readers read the visible text of every page, each in a clean context. A `koedify:fidelity-critic` checked each round against the original pages and the facts list.
3. **Loop.** We revised after each round and graded again, until the panel passed and fidelity passed.

### Where we adapted koedify, and why

| koedify step | What we did instead | Why |
|---|---|---|
| Ten lenses for newsletter readers (stranger, skeptic, sharer and others) | Five market readers for this product, each mapped to the nearest lens (section 3) | A landing page has buyers and approvers, not newsletter readers |
| Seed confirmed by the author | The facts list and the owner's hard rules were the seed and the keep list | The owner was not in the loop. The brief gave the facts |
| Title frames with numbers and time frames | We used time frames only where true ("before your first round", "tonight"). We used no invented numbers | Owner rule: no invented numbers |
| "World fit" against the author's profile | "World fit" against the owner's hard rules and ANTI-PATTERNS.md | The rules are the voice guide for these sites |
| `panel-score.mjs`, votes, report bundle | Scores collected by hand in section 4 | The market JSON did not match the scorer's lens format. The scores are below |
| Questions to the author at each checkpoint | Open questions in section 7 | No author was in the loop |

## 3. The panel

| Reader | Who | Nearest koedify lens | What they read |
|---|---|---|---|
| Parent | A parent judge before the first tournament. Nervous. On a phone the night before | stranger, pain mirror | Debate home, Library block, parent home, plans |
| Coach | A varsity policy coach who must train 15 parent judges. Forwards one link with their name on it | value auditor, sharer | Debate home, coaches, parent home, plans, trust |
| IT | A school IT admin who decides if the app is allowed on managed Chromebooks. Reads for facts and risk | skeptic | School IT, trust, privacy, terms, parent home |
| Fast judge | An experienced college-student judge who flows fast. Hates fluff. Spots weak claims and AI tells | hook editor, pacing editor | Debate home, parent home, plans |
| Speech coach | A forensics coach who wants Speech Events | world keeper, pain mirror | Speech Events, parent home, about, plans |

Each reader scored 0 to 10 on: reach (the first screen gets attention), pull (the reader keeps reading), value, relevance, world fit (owner rules) and coherence (the headline promise matches the body).
The bar: a mean of 8 on each dimension, no reader below 6, no open high finding, and a fidelity PASS.

## 4. Panel verdict

**PASS.** Round 3 met the bar. Fidelity passed in round 4, after three small fixes.

| Reader | Round 1 (reach / pull / value / relevance / world / coherence) | Last round | Verdict |
|---|---|---|---|
| Parent | 6.5 / 6 / 7.5 / 6.5 / 7 / 7 | 8.5 / 8 / 8.5 / 8.5 / 8.5 / 8.5 (round 3) | PASS |
| Coach | 8 / 7.5 / 7.5 / 8.5 / 7 / 6.5 | 8 / 8 / 8.5 / 8 / 8 / 8 (round 2) | PASS |
| IT | 7.5 / 7 / 7 / 8 / 6.5 / 6 | 8 / 8 / 8.5 / 9 / 8.5 / 8 (round 2) | PASS |
| Fast judge | 8 / 7.5 / 7.5 / 8 / 7.5 / 8 | 8 / 8 / 8 / 7.5 / 8.5 / 8 (round 2) | PASS |
| Speech coach | 7.5 / 7.5 / 7 / 7.5 / 7 / 6.5 | 8.5 / 8.5 / 7.5 / 8 / 9 / 8.5 (round 3) | PASS |
| Mean, last round | | 8.2 / 8.1 / 8.2 / 8.2 / 8.5 / 8.2 | |
| Fidelity | | BLOCK (round 2), BLOCK (round 3), PASS (round 4) | PASS |

Notes on the scores:

- Speech coach value stays at 7.5. Speech Events has nothing to use today. Only a real product can raise it. Words cannot.
- The coach, IT and fast judge were not run again after round 2. Round 3 and round 4 changes were small fixes in their favor. Round 3 changes did not touch the pages they own, except plans (future tense) and coaches (rules list).

### What the panel caught

- Round 1. The debate h1 "Catch every drop" lost the parent: a new judge does not know the word "drop". "A free school space" on the coaches page contradicted the paid Program on plans. Programs and admin AI controls were in the present tense, but they do not exist yet. The school IT data table left out the paid-plan route through our server. "We never rank students" contradicted speech judging, where judges rank the room. The privacy page had an "X, not Y" line. "Each argument gets its own sheet" was wrong debate usage.
- Round 2. "One plan will cover each app" read as one plan per app. The plans card said "Free" twice. Fidelity found claims we had made stronger: "no scores", an "only" data claim on the school IT page, an invented policy name, and "the decision is on the page by the last speech".
- Round 3. Fidelity found three more small claims: "the night before" (implied one night is enough), "on one screen" and a connection claim that the on-device transcription mode could break.

## 5. Before and after: the worst offenders

| Page | Before | After | Panel verdict |
|---|---|---|---|
| Debate home h1 | "Judge the round,`<br>`not the paperwork." | "Follow every speech and write a ballot you can explain." | Parent: "What works for a parent: the debate hero." Round 1 h1 "Catch every drop" failed the parent and was replaced |
| Debate home hero line | "It works with Wi-Fi off." | "Rounds save on your device, and the flow, clocks and ballot keep working if the school Wi-Fi drops." | Passed all readers; IT accepted the limit "Features that send data to an AI provider need a connection" |
| Debate home fine print | "Free · No account · Saved on your device · No ads" | "It is free, with no account and no ads." | No reader flagged it |
| Debate home AI h2 | "Your choice. Your judgment." | "Let AI draft a ballot while you keep the decision." | Round 1 draft "Let AI draft the ballot. You still decide." was itself a clipped pair and was rewritten before the panel |
| Debate home keyboard h2 | "Built for the keyboard." | "Flow a fast round without touching the mouse." | Fast judge proposed the new line |
| Debate home formats h2 | "Ready for policy today." with "LD and PF next" in the plan | "Use it for policy rounds today." with "Lincoln-Douglas and Public Forum are coming soon." | No reader flagged it |
| Debate home closing | "Your next round starts here." | "Try it on a practice round tonight." | No reader flagged it |
| Debate home stat strip | "Free / Offline / Private / Open source" tiles | Removed | Each fact is in its own section |
| Parent home h1 | "Tools for speech and debate judges." | "Follow the round and write a fair ballot, even in your first round." | Round 2 draft "Judge with confidence" failed the fast judge as a stock slogan |
| Parent home stat strip | "Free / Open source / 79 pages / Offline" | Removed | Owner rule: no page count, no stat tiles |
| Parent home account h2 | "Sign in once. Use every product." | "One account will work in every Tabula app." | Parent and fast judge caught "One plan will cover each app" in the body; fixed |
| Parent home trust h2 | "Built for schools from the start." | "A school can check what Tabula does with data." | IT: PASS, relevance 9 |
| Parent home trust card | "No ads. No tracking." / "...no data sales. Ever." | "No ads or tracking scripts" / "The app loads no ad networks and no tracking scripts. We do not sell data." | Fidelity: weaker, so accepted |
| Parent home closing | "Free. No account. Open it in your browser." | "Tabula Debate is free and opens in your browser. You do not need an account." | Round 2 h2 "this evening" read as a tournament tonight; fixed to "Get ready for your first round tonight." |
| Plans h1 | "Free is the whole app." | "The whole app is free." | Fast judge and IT both flagged the inverted line |
| Plans free card | "No card. No time limit." | "No card needed. It does not expire." | Coach, parent and fast judge flagged the double "Free" |
| Plans Pass card | "See rounds left, not confusing credits" | "Shows about how many rounds of hosted AI you have left" | Fidelity asked to keep the "rounds" unit |
| Coaches h2 | "Learning, not leaderboards." | "Rules you can stand behind when you share the link." | Coach: the old student h2 switched topic; new h2 ties to forwarding |
| About h1 | "Made for the people who run the round." | "Tabula helps volunteer judges write fair ballots." | No reader flagged it |
| School IT h1 | "What Tabula needs from you." | "What to check before you allow Tabula on school Chromebooks." | IT: round 2 "Everything you need to approve" overclaimed, because the data agreement is not out yet |
| Speech Events h1 | "Tabula Speech Events" (name only) | "Give every speaker a comment they can use next round." | Speech coach: "goes straight at the real pain of speech ballots" |
| Speech Events h2 | "Rank fairly. Comment kindly." | "Rank the room and write comments that help." | No reader flagged it |
| Speech Events fine print | "One email when it opens. Nothing else." | "We send one email when it opens, and no others." | Speech coach: "earns trust" |
| Speech Events note | "Same family, same account, same rules as Tabula Debate" | "Like Tabula Debate, it will be free to use, save rounds on your device and show no ads. One Tabula account will work in both." | No reader flagged it |
| Trust and about | "never a score ranking", "No student rankings" | "with no ranking of students", "We never put students on leaderboards" | Speech coach: speech judges rank the room, so "rank students" read as a contradiction |

## 6. Shared strings in `layout.mjs`

| String | Before | After |
|---|---|---|
| Debate header button | "Open Tabula" | "Open the app" |
| Parent header button | "Open Tabula Debate" | No change |
| Events header button | "Get updates" | No change |
| Footer blurb | "Tools for judges, coaches and students in speech and debate. Free to use. Open source." | "Free, open-source apps that help judges, coaches and students in speech and debate." |
| Footer link | "First-round judge" | "Your first round as a judge" (the guide's own title) |
| Footer base | "No ads. No tracking scripts." | "The sites and app load no ads or tracking scripts." |
| Nav labels | Products, Plans, Trust, About; Features, Library, Coaches, School IT, Plans; Events, What it will do, Tabula Debate | No change. They are short and say where they go |

## 7. Open questions for the owner

1. **Picture order on the parent home.** The Speech Events rank board sits in front of the debate flow in the hero picture. The parent reader worried that a "coming later" app looks ready. We did not change picture blocks.
2. **Picture tab label.** The debate hero picture shows a "Ballots" tab. The app's tab says "Ballot". We did not change it, because we could not confirm the other tab names.
3. **School IT details.** Should the install section name the Chrome policy (`WebAppInstallForcelist`)? Fidelity blocked it because it was not in the facts. Is the trailing slash difference between the install and microphone addresses intended? What does "deleted from the device after" mean exactly (after upload, or after the transcript)?
4. **Claims from before this redraft.** The panel asked the owner to confirm these: "no analytics beacons and no third-party scripts" (school IT), "A Pro plan for heavy use may come later", "Pay by invoice or purchase order", the rank-board tie warning, and the "Informative" event chip.
5. **Speech Events and names.** Will Speech Events swap competitor names before AI requests, as Tabula Debate does? The trust page talks only about debate.
6. **"Most speech judges are parents and volunteers."** This is a claim about the field. Keep it, or soften it to "Many".
7. **Button that copies a link.** The coach wanted a "copy the guide link" button. That needs new HTML and a script, so we did not add it.

## 8. The final copy deck

Visible text of every page, in page order. "Button:" marks a button. "Eyebrow:" marks the one kicker. "[PRODUCT PICTURE: ...]" is the picture's alt text (unchanged). The h1 is `####`, h2 is `#####`, h3 is `######`.

### speech `/about/`

- Page title: About
- Meta description: Tabula is made by Connor England and published by Pattern Engine LLC. Free, open-source tools for speech and debate.

#### Tabula helps volunteer judges write fair ballots.

Most speech and debate judges are parents and volunteers. Tabula helps them follow a round and decide it, and it helps coaches train them.

##### Who makes Tabula

Tabula is made by Connor England. Pattern Engine LLC publishes it. The app is open source, so anyone can read the code and run it.

##### The rules we keep

- The whole app is free. Paid plans will only add hosted AI.

- Your rounds stay on your device.

- We run no ads or tracking scripts, and we never sell data.

- AI only writes drafts. The judge makes the decision.

- We do not favor any one AI company.

- We never put students on leaderboards or use streaks.

##### The family

Tabula Debate is ready for policy debate today. Lincoln-Douglas and Public Forum are coming soon. Tabula Speech Events comes later, for extemp, oratory, interp and Congress. The Debate Library is free for everyone.

##### Contact

support@tabulaspeech.com

### speech `/`

- Page title: Tabula Speech: free apps for speech and debate judges
- Meta description: Tabula makes free, open-source apps for speech and debate judges, coaches and students. Rounds save on your device, and one account will work in every Tabula app.

Eyebrow: Free and open source

#### Follow the round and write a fair ballot, even in your first round.

Tabula makes free, open-source apps for speech and debate judges. Tabula Debate is ready for policy rounds today, and the free Debate Library teaches new judges what to do in the room.

Button: See the apps
Button: Read the first-round judge guide

[PRODUCT PICTURE: Two Tabula apps: a debate flow sheet, and in front of it a speech-events rank board]

###### Tabula Debate Available

The flow, clocks and ballot for policy debate. They keep working when the school Wi-Fi drops. Lincoln-Douglas and Public Forum are coming soon.

Button: Open the app
Button: About Tabula Debate

###### Tabula Speech Events Coming later

Rank boards and comment sheets for extemp, oratory, interp and Congress judges. Like Tabula Debate, it will be free and save rounds on your device.

Button: About Speech Events

##### One account will work in every Tabula app.

You do not need an account to judge tonight. Later, one account and one plan will cover every Tabula app, so a coach who judges policy on Saturday and extemp on Sunday will sign in once.

- Accounts open with paid plans.

- Hosted AI from a paid plan will work the same way in each app.

- A Program will cover a whole school team, with its judges and students in debate and speech.

###### What a Program admin will control

- Turn AI on or off for students. With AI off, students will see no AI at all.

- Add people to the team with a join code. There is no student email list to upload.

- Assign a Library track and see who has finished it.

Programs are coming later.

##### A school can check what Tabula does with data.

We keep as little as we can, and we say what we keep. The code is public, so anyone can check it.

###### Rounds stay on the device
Rounds, flows and ballots stay in your browser. The free app does not send them to our server.

###### No ads or tracking scripts
The app loads no ad networks and no tracking scripts. We do not sell data.

###### AI stays off until you turn it on
Each user decides when to turn AI on. When Programs open, an admin will be able to turn it off for students.

###### Code anyone can read
The app’s code is public under the AGPL-3.0 license.

Read how Tabula handles data

##### Get ready for your first round tonight.

Tabula Debate is free and opens in your browser. You do not need an account.

Button: Open Tabula Debate
Button: Read the first-round judge guide

### speech `/plans/`

- Page title: Plans
- Meta description: Free is the whole Tabula app, with your own AI key. Paid plans add hosted AI with no key. Programs will cover a whole school team.

#### The whole app is free.

You do not need AI to flow and judge a round. Every AI feature also works free with your own AI key, and a paid plan will add hosted AI with no key to set up.

Paid plans are not on sale yet. Prices come at launch.

Start here

Free
For every judge, coach and student.

No card needed
It does not expire.

- The flow, speech and prep clocks, ballot and RFD

- Keeps working when the Wi-Fi drops, and rounds save on your device

- Every AI feature with your own key

- Tournament mode, which turns the AI ballot and audio off

- The free guides in the Debate Library

Button: Open Tabula Debate

No key needed

Pass
For judges who want AI with no key.

Price at launch
Monthly or yearly.

- Everything in Free

- Hosted AI with no key to set up

- Shows about how many rounds of hosted AI you have left

- The round keeps going if your AI runs low

- Works in every Tabula app

Button: Email me at launch

Coming later

Program
For a school team and its coach.

For schools
One plan for the whole team.

- Hosted AI shared across the team

- Admins will turn AI on or off for students

- Assign Library tracks and see who has finished

- Covers Tabula Debate, and Speech Events when it opens

- Pay by invoice or purchase order

Button: Email us about a Program

A Pro plan for heavy use may come later.

##### Compare plans

FeatureFreePassProgram

Flow, clocks, ballotYesYesYes
Flow, clocks and ballot without Wi-FiYesYesYes
AI with your own keyYesYesYes
Hosted AI, no keyNoYesYes, shared
Account neededNoYesYes
Admin AI controlsNoNoYes
Library tracks for a teamNoNoYes

##### Questions

Do I need an account?
No. The free app works with no account. You need one only for a paid plan or a Program.

What does “your own key” mean?
An AI key is a password from an AI provider. You pay that provider for what you use. Tabula never sees your bill, and the key stays on your device.

Which AI does Tabula use?
You pick. Tabula works with more than one provider and does not favor any of them.

Can a school turn AI off?
Yes, once Programs open. A Program admin will be able to turn AI off for students. Those students will then see no AI in the app.

What if I run out mid-round?
The round keeps going. Hosted AI steps down to the free tools until you add more, and the flow, clock and ballot keep working.

### speech `/privacy/`

- Page title: Privacy policy
- Meta description: The Tabula privacy policy. This is a draft summary; the full policy is published before accounts open.

#### Privacy policy

Draft. The full policy is published before accounts open. Until then, this page sums up the rules.

Not yet in effect. This summary is a placeholder. The plain-words version is on the Trust page.

##### Summary

- The free app stores rounds on your device. It does not send them to our server.

- We run no ads and no tracking scripts.

- AI requests go to the provider you pick, only when you turn AI on. With a paid plan, they pass through our server first.

- With an account, we keep your email, plan and credit balance.

##### Publisher

Pattern Engine LLC. Contact: support@tabulaspeech.com.

### speech `/signin/`

- Page title: Sign in
- Meta description: Sign in to your Tabula account. Accounts open with paid plans. The free app needs no account.

#### Sign in to Tabula

Accounts open with paid plans. One account will work in every Tabula product.


The free app saves your rounds on this device. You do not need an account to use it.

Read how we handle data, the privacy policy and the terms.

### speech `/terms/`

- Page title: Terms
- Meta description: The Tabula terms of use. This is a draft summary; the full terms are published before paid plans open.

#### Terms of use

Draft. The full terms are published before paid plans open.

Not yet in effect. This summary is a placeholder.

##### Summary

- The app code is open source under AGPL-3.0.

- The AI ballot is a draft. The judge makes the decision.

- The judge is responsible for consent before any recording.

- Follow your tournament's rules on recording and AI.

##### Publisher

Pattern Engine LLC. Contact: support@tabulaspeech.com.

### speech `/trust/`

- Page title: Trust and privacy
- Meta description: How Tabula handles data: rounds stay on your device, no ads or tracking scripts, AI only when you turn it on, and admins will be able to turn AI off for students.

#### We keep as little as we can.

This page says, in plain words, what Tabula stores, where it goes, and what we never do. The legal text is in the privacy policy.

On your device
AI providers
What we never do
For schools
Audio
Open code
Contact

##### What stays on your device

The free app keeps your rounds, flows, ballots and settings in your browser. They are not sent to our server. If you clear your browser, they are gone, so export a round to keep a copy.

###### We keep
- Nothing, for the free app
- With an account: your email, your plan, and your credit balance

###### We never keep
- Your flows or ballots, unless you turn on backup later
- Debater names: the app swaps them for speaker labels before any AI request
- Your AI key

##### What goes to an AI provider

AI is off until you turn it on. When it is on, the text of the round goes to the provider you picked. With your own key, it goes straight from your browser to that provider. With a paid plan, it passes through our server to the provider. Our plan is to keep no copy of it.

The app swaps debater names for speaker labels (1A, 2N) before any AI request. The AI ballot is only a draft, and the judge makes the decision.

##### What we never do

- Sell or rent data.

- Show ads, or run ad or tracking scripts.

- Put students on leaderboards, or use streaks to keep students on screen.

- Use your rounds to train AI models. We pick provider settings that do not train on requests, where the provider offers them.

##### For schools

Programs are coming later. When they open, a Program admin will be able to turn AI off for students, and those students will see no AI anywhere in the app. Coaches will see "done or not done" for Library tracks, with no ranking of students.

School IT can find install and microphone policy steps on the For school IT page. We plan to publish a list of subprocessors and a data agreement before accounts open.

##### Audio

Transcription modeWhere the audio goes

Off (no audio)Nowhere. Works at every tournament.
On-deviceStays on the device.
Browser speechYour browser may send audio to its maker's speech service.
AI providerTo the provider you picked. Deleted from the device after.

The judge is responsible for consent before any recording. The app asks first.

##### Read the code

The app is open source under AGPL-3.0. Anyone can check what it does. See the code.

##### Contact

Privacy questions: support@tabulaspeech.com.

### debate `/coaches/`

- Page title: For coaches
- Meta description: Get parent judges ready with one link to a free first-round guide. Give novices the free Debate Library. A Program for school teams is coming later.

#### Get your parent judges ready with one link.

New parent judges need a short, calm start. Send them the first-round guide. They learn what to write down and how to decide, then judge with Tabula.

Button: Get the guide link for your judges
Button: Browse the Debate Library

###### Parent judges
The first-round guide is short. It is free and needs no account, so you can paste the link into your team group chat.

###### Novices
The Library explains each argument type with a worked example. It is free, and students need no account to read it.

###### Your program
A Program for your school team is coming later. You will add students with a join code, assign Library tracks and see who has finished.

##### Rules you can stand behind when you share the link.

- Tournament mode turns the AI ballot and audio off. Remind your judges to follow each tournament’s rules on recording and AI.

- Tabula will never put students on a leaderboard. Coaches will see done or not done for each Library track.

- There are no streaks or other tricks to keep students on screen.

- When Programs open, an admin will be able to turn AI off for students. Those students will then see no AI at all.

Want a Program for your team early?

Email support@tabulaspeech.com. Tell us your team size and the formats you coach.

### debate `/`

- Page title: Tabula Debate: a free app to flow and judge policy debate rounds
- Meta description: Tabula Debate is a free app to flow and judge policy debate rounds. The flow, clocks and ballot keep working when the Wi-Fi drops, and your rounds save on your device.

#### Follow every speech and write a ballot you can explain.

Tabula is a free app for judging policy debate. Flow and time the round on one screen, mark the arguments a team dropped, then write your reason for decision next to the flow.

Button: Open Tabula Debate
Button: Read the first-round judge guide

It is free, with no account and no ads. Rounds save on your device, and the flow, clocks and ballot keep working if the school Wi-Fi drops.

[PRODUCT PICTURE: The Tabula app during a round: speech list on the left, five flow columns from 1AC to 1AR on the Case sheet, and the speech clock at 4:12 in the 2AC]

Example round. Names and arguments are made up.

###### Type your notes while they talk.
Each main argument, such as the case or a counterplan, gets its own sheet. The speech and prep clocks stay on screen.

###### Mark the arguments nobody answered.
Follow each argument from speech to speech. A drop is an argument the other team did not answer. Mark drops and turns as you go, so you can check the last speeches against your flow.

###### Hand in a ballot the debaters can learn from.
Enter the speaker points and the decision, then write your reason in plain words.

##### Flow a fast round without touching the mouse.

Policy speeches are fast, but you can keep up by typing.

- Move around the flow, extend an argument into the next speech and mark a drop, all from the keyboard.

- Speech and prep clocks for both teams stay in view. Press Space to start or pause the clock.

- Press ? to see every shortcut, or ⌘K / Ctrl K to search and run a command.

[PRODUCT PICTURE: Speech clock showing the 2NC with 7:42 left, aff prep 6:30 and neg prep 3:05, with keyboard shortcuts]

##### Tell the debaters why they won or lost.

Debaters read the reason for decision to get better. Tabula keeps your flow beside the ballot, so you can point to the argument that decided the round.

- Speaker points and the decision sit in one place.

- Your marks on the flow stay in view while you write the reason for decision.

- When you finish, print the ballot, save a PDF, or copy it into the tournament ballot.

[PRODUCT PICTURE: Ballot: decision for the Affirmative, speaker points for four debaters, and a short reason for decision]

##### Let AI draft a ballot while you keep the decision.

AI can turn round audio into a draft flow and draft a ballot from your flow. It stays off until you turn it on.

- It is free with your own key from the AI provider you choose.

- A paid plan will add hosted AI with no key to set up. Plans are not on sale yet.

- The app swaps debater names for speaker labels, such as 1A and 2N, before any AI request.

- Tournament mode turns the AI ballot and audio off. Always follow your tournament’s rules on recording and AI.


Features that send data to an AI provider need a connection. How we handle data

##### Learn how to judge before your first round.

The Debate Library is a set of free guides on how policy debate works, how to flow and how to decide. Parent judges and new debaters can read it with no account.

Button: Browse the Debate Library

- Debate 101How a round works

- Your first round as a judgeWhat to do in the room

- How to flowNotes that keep up

- The ballot and the RFDHow to decide and explain

- GlossaryLook up a term

##### Use it for policy rounds today.

Lincoln-Douglas and Public Forum are coming soon.

Available now

###### Policy
Two-person teams, eight speeches, cross-examination and prep. The flow, clocks and ballot are ready.
Open Tabula Debate

Coming soon

###### Lincoln-Douglas
One-on-one debate about values.

Coming soon

###### Public Forum
Two-person teams, crossfire and a coin flip.

##### Try it on a practice round tonight.

Tabula runs in your browser. You do not have to install it or make an account.

Button: Open Tabula Debate
Button: Share it with your judges

### debate `/school-it/`

- Page title: For school IT
- Meta description: Install Tabula on managed Chromebooks, allow the microphone, and see what the app stores and where. It loads no ads and no tracking scripts.

#### What to check before you allow Tabula on school Chromebooks.

Tabula is a web app. It installs from the browser, runs only scripts from its own address and stores rounds on the device. This page lists the install address, the microphone policy and what goes where.

Install
Microphone
What is stored
Security policy
Contact

##### Install on managed Chromebooks

Force-install the app from this address:

https://debate.tabulaspeech.com/

It is an installable web app. After the first visit, the flow, clocks and ballot work without a connection. Features that send data to an AI provider need one.

##### Allow the microphone (optional)

The app needs the microphone only for transcription. Students and judges who never record do not need it. To allow it without a prompt, add the app to the AudioCaptureAllowedUrls policy:

https://debate.tabulaspeech.com

##### What is stored, and where

DataWhere

Rounds, flows, ballots, settingsThe device (browser storage)
A user's own AI keyThe device only
Round text, if AI is onThe AI provider the user picked. The app swaps debater names for speaker labels (1A, 2N) first. With the user’s own key, it goes straight from the browser. With a paid plan, it passes through our server, and our plan is to keep no copy.
Audio, if AI transcription is onThe AI provider; deleted from the device after
Audio, if browser speech is onThe browser maker's speech service may receive it

When accounts open, we will also keep a user’s email, plan and credit balance. Read the full trust page.

##### Security policy

The app runs only scripts from its own address. It loads no ads, no analytics beacons and no third-party scripts. AI requests go only to the provider hosts the user turned on.

We plan to publish a subprocessor list and a data agreement before accounts open.

##### Contact

support@tabulaspeech.com

### events `/`

- Page title: Tabula Speech Events: rank boards and comment sheets for speech judges, coming later
- Meta description: Tabula Speech Events: rank boards and comment sheets for extemp, oratory, interp and Congress judges. Coming later, from the makers of Tabula Debate.

#### Give every speaker a comment they can use next round.

Tabula Speech Events is coming later. It will help forensics judges rank the room and write comments in extemp, oratory, interp and Congress.

Button: Email me when it opens
Button: Judge debate today with Tabula Debate

We send one email when it opens, and no others.

[PRODUCT PICTURE: Draft of a rank board for Original Oratory: five speakers in rank order with their speech times]

##### These events are on the list so far.

ExtemporaneousOriginal OratoryInformativeDramatic InterpHumorous InterpDuo InterpProgram Oral InterpProsePoetryCongress

##### Rank the room and write comments that help.

Most speech judges are parents and volunteers. Tabula Speech Events will keep the ranks and comments for a room in one place.

###### Rank board
You will keep a time and notes for each speaker, then drag them into rank order. The board will warn you if two speakers share a rank.

###### Comment sheet
Short prompts will help you write comments a speaker can act on.

###### Congress grid
It will track speeches, questions and the presiding officer in one view.

Like Tabula Debate, it will be free to use, save rounds on your device and show no ads. One Tabula account will work in both.

##### Want to know when it opens?

The button opens a short email to us, and sending it is all it takes.

Button: Email me when it opens
Button: About Tabula
