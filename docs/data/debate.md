# Data list: Tabula Debate

Tabula Debate is the judging app for debate rounds: the flow, clocks, transcripts, AI help and the ballot. Its code is
public in this repository.

**Where your data lives:**

- **On your device.** Your rounds, flows, transcripts, speech documents, saved ballots, settings and any AI key you
  paste stay in this browser on this device. Tabula cannot see them.
- **On our server**, only if you sign in. Your account, your profile and records of AI use and purchases. See
  [Our server](#our-server) and the full list in [console.md](console.md).

Who can see device data: anyone who can use this browser on this device.

## The current round

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Round details: tournament, round name, judge name, topic, room, start time, flight, format, points range | Sets up the round | People with this browser on this device | Save round file (.tab). Backup file. | New round (clears the round). Or clear site data in your browser. | Until you start a new round or open another round file | This browser on this device |
| Team names and debater names | The flow, ballot and points | People with this browser on this device | Save round file. Backup file. | New round, or clear site data | Until you start a new round | This browser on this device |
| Your flow (sheets and cells), clocks, prep time left | Judging the round | People with this browser on this device | Save round file. Backup file. | New round, or clear site data | Until you start a new round | This browser on this device |
| Transcripts of speeches | Text of what was said, for you and for AI help | People with this browser on this device | Save round file. Backup file. | New round, or clear site data | Until you start a new round | This browser on this device |
| AI results: AI flow, live evaluation, analysis, round map, ballot draft | AI help you asked for | People with this browser on this device | Save round file. Backup file. | New round, or clear site data | Until you start a new round | This browser on this device |
| Judge paradigm choice and your notes for the AI | Shapes AI help | People with this browser on this device | Save round file. Backup file. | New round, or clear site data | Until you start a new round | This browser on this device |
| Ballot: winner, points, ranks, reason for decision, feedback to each side | The ballot | People with this browser on this device | Print / PDF. Copy for the tournament ballot. Save to History. Save round file. Backup file. | New round, or clear site data | Until you start a new round | This browser on this device |
| Round id (random), "Judging for" school, your answer to "use a round of AI?" | Links AI use and school rules to this round | People with this browser on this device | Backup file. A round file does not carry the school or the answer. | New round, or clear site data | Until you start a new round | This browser on this device |
| Speech documents you add (PDF, Word, text) | Card text and evidence for you and for AI help | People with this browser on this device | Save round file. Backup file. | New round deletes them. Or clear site data. | Until you start a new round | This browser on this device (browser database) |
| Audio clips waiting to be turned into text | Transcription with your own key. A clip waits here if the connection drops. | People with this browser on this device | No | Deleted when its text comes back, when you start a new round, and when the app opens another round | Until its text comes back | This browser on this device (browser database) |
| Damaged or unknown saved round (a copy kept when a saved round cannot be read) | So a storage problem does not lose your round | People with this browser on this device | Backup file | Clear site data. Nothing deletes it by itself. | Until you clear site data | This browser on this device |

## History (saved ballots)

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Each saved ballot: time saved, tournament, round, judge, topic, team names, debater names, points, ranks, winner, reason for decision, feedback, format | Your record of past ballots | People with this browser on this device | History → CSV. Print a saved ballot. Backup file. | History → delete (with Undo). New round does **not** delete History. Or clear site data. | Until you delete it | This browser on this device |

## Settings and AI keys

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Settings: theme, writing style, AI provider and models, transcription choice, microphone choice, audio mode, prep minutes, panes, keyboard and tour choices, your own paradigm text, time of your last backup, time you accepted the recording notice | Your preferences | People with this browser on this device | Backup file | Clear site data. The recording notice has its own reset button. | Until you clear site data | This browser on this device |
| AI keys you paste (Anthropic, Google, OpenAI, OpenRouter, xAI) | Lets the app call the AI company you chose | People with this browser on this device | Not in the backup file unless you ask to include keys. Never in a round file. | Settings → remove the key. A key kept in this tab only is forgotten when you close the tab. | With "Remember" off (the default for new installs): until you close the tab. With "Remember" on: until you remove it or clear site data. | "Remember" off: this tab's session storage. "Remember" on: this browser on this device. |
| Copy of your account profile (display name, paradigm, your schools with their names and your role) | Shows "Judging for" and your account paradigm when you are signed in | People with this browser on this device | No | Removed when the app sees you are signed out. Or clear site data. | Until you sign out | This browser on this device |
| Copy of your AI access (role and school, which AI features are on and who pays, plan, times) | Decides which AI features show | People with this browser on this device | No | Removed when the app sees you are signed out. Or clear site data. | Until you sign out, or a new check replaces it | This browser on this device |
| Last "Judging for" choice, schools whose key notice you saw, whether the app offered to copy your paradigm | Small reminders | People with this browser on this device | No | Clear site data | Until you clear site data | This browser on this device |
| Study timer marks (only when the page address has `?study=1`) | A timing test for the app | People with this browser on this device | Copy button on the study card | Clear site data | Until you clear site data | This browser on this device |

## Export and backup

- **Save round file (.tab)**: the current round and its documents. It does not carry your AI keys, your "Judging for"
  school or your AI answer.
- **Download backup**: the current round, History, settings and the round's documents. AI keys are left out unless you tick the box to include them. The account copies and small reminders are
  not in it. Keep the file safe: it holds names and ballots.
- **History → CSV**, **Print / PDF** and **Copy for the tournament ballot** give one ballot or a list of ballots.

## Delete everything

There is no single "delete everything" button yet. To remove all Tabula Debate data from a device, clear this site's
data in your browser settings. Download a backup first if you want to keep it.

## Our server

These are kept only if you sign in. The full list, with who can see each item, is in [console.md](console.md).

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Account: account number, email address, plan, birth date and age check, created time | Your Tabula account | You. Some school staff see your email (see console.md). | Yes, on the account site | Closing your account replaces the email and clears the birth date. The account record stays. | See console.md | Our server |
| Profile: display name, judge paradigm | The app reads and saves your paradigm when you are signed in | You. Staff see your display name. Only you see your paradigm. | Yes | Change it, or close your account to clear it | Until you change it or close your account | Our server |
| School memberships | "Judging for" and school AI rules | You, and your school's admins and coaches | Yes | Leave, be removed, or close your account | Until removed | Our server |
| Session (times, no IP address or device) | Keeps you signed in | No screen shows it. | No | Sign out, or close your account | Up to 30 days (less for staff, or after no use) | Our server |
| AI use record, one per hosted AI call: round id, task, format, app, model, word-piece counts, cost. No round text, no names. | Billing and limits | No screen lists them. | Per-round totals only | No. These are records. | We keep them. We have no automatic deletion for these yet. | Our server |
| Short-lived round data: round budget, live-flow word count (kept by round id and the first 40 characters of the speech label), a hold on your rounds during a call | Limits for a round, and billing only new words | No screen shows it. | No | Automatic | 5 minutes to 2 days | Our server |
| Balance changes, purchases, subscriptions | Your rounds left and what you bought | You | Yes (balance changes without reference; purchases; subscriptions) | No. These are records. | We keep them. We have no automatic deletion for these yet. | Our server |

## Sent to other services

| Where | What it gets | Why |
|---|---|---|
| **The AI company you choose with your own key** (Anthropic, Google, OpenAI, OpenRouter or xAI) | Your key; audio clips, if you transcribe with that company; and the round content the AI feature needs: transcripts, flows, your notes and paradigm, the topic, and speech documents. Before sending, the app swaps debater and team names in text for labels like "1A" or "the Aff team", and puts the names back in the reply. PDF documents are sent as they are, so names inside a PDF are not swapped. | AI help and transcription. This goes straight from your browser to that company, not through our server. That company's own terms apply. |
| **Our server, with hosted AI** (when you are signed in and use rounds of AI) | Round id, "Judging for" school, a call id, the format and task, and the round text the task needs: transcripts, your flow and the AI flow, the topic, your paradigm and notes, ballot details you asked for, the writing style, the points range, and text documents. Names in text are swapped for labels first. PDF documents are not sent (only their file names). Tournament, school and student names are not sent as fields. | Our server forwards the round text to an AI company (OpenAI; Anthropic as a backup and for a deeper mode) and streams the answer back. Our server does not store the round text. It keeps only the usage record above. For OpenAI we ask it not to store the request; Anthropic has no matching setting. How long the AI companies keep data: we are confirming this. |
| **Our server, other checks** (when signed in) | Your profile (read, and your paradigm when you save it), your AI access check (with the "Judging for" school), and a round limits check (with the round id) | Shows your schools, paradigm, AI features and rounds left |
| **Your browser's speech recognition** (if you pick the browser for transcription) | Microphone audio | Turns speech into text. Some browsers send this audio to the browser maker's service. That browser's own terms apply. |
| **SpeechDrop** (only if you import a SpeechDrop room) | The room code. The request goes through a helper route on the site that serves the app, which fetches the room's files. | Imports speech documents |
| **Local helper** (only if you run the helper on your own computer) | AI requests go to the Claude Code or Codex app on that computer, which uses the subscription it is signed in with | AI help without a key |

The app loads no analytics, ads, outside fonts or outside scripts.

## Cookies

The app itself sets no cookies. When you sign in on the account site, the browser sends the account site's session
cookie with the app's requests to our server. See [console.md](console.md#cookies).

## Backups

Your device data is on your device. Our server backups do not hold it. Use **Download backup** to keep your own copy.
For the server data, see [console.md](console.md#backups): data we delete can be recovered by an operator for up to
about 30 days.

## Logs

Our hosting provider logs every request to our site. A log line can hold the web address (which can contain ids),
request headers and your IP address. What it keeps and for how long: we are confirming this. We log AI model names and
timings, and only error status codes from AI companies, never round text.

## Questions, export and delete

Email support@tabulaspeech.com.
