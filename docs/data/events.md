# Data list: Tabula Speech Events

Speech Events is the app for judging speech events: rounds, rooms, timing, ranks, ballot comments, Congress and your
day at a tournament. Its code is public in this repository under `events/`.

**Where your data lives:** on your device, in this browser. Speech Events does not sign in and does not send your
rounds to our server. AI request content leaves your device only when you use an AI company with your own key (see
[Sent to other services](#sent-to-other-services)).

Who can see device data: anyone who can use this browser on this device. Tabula does not receive it.

If you also have a Tabula account, the account site keeps the data in [console.md](console.md). Speech Events does not
use that account today.

## Open tabs

One Speech Events tab can write saved data at a time. Another tab waits and offers a retry. Close or reload older Speech Events tabs after an update before using Data controls. Older copies do not have this guard. This does not sync data between browsers or devices.

## Rounds and ballots

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Round details: event, rules used, tournament, round, flight, level, panel, state, created and updated times, when you copied ranks or comments | Runs the round and keeps your history | People with this browser on this device | Backup file. History CSV (some columns). | History → ⋯ → Delete (with Undo). Or clear site data in your browser. | Until you delete it or optional auto-delete removes it (see below) | This browser on this device |
| Each entry: competitor code, competitor name, piece title and author, speaking order, status (for example no-show) | Who spoke, in what order | People with this browser on this device | Backup file. History CSV has the code; names only if you tick "Include names and comments". Print / PDF has the code and the piece title and author. | Remove the entry in the room, delete the round, or clear site data | Until you delete it or optional auto-delete removes it (see below) | This browser on this device |
| Timing: time used, runs, over time or grace, prep time | Time checks and the ballot | People with this browser on this device | Backup file. Print / PDF. | Delete the round, or clear site data | Until you delete it or optional auto-delete removes it (see below) | This browser on this device |
| Notes and private notes, tags, rule-check flags | Your judging notes | People with this browser on this device | Backup file only. Private notes and flags are never in the CSV, the copy text or Print / PDF. | Delete the round, or clear site data | Until you delete it or optional auto-delete removes it (see below) | This browser on this device |
| Ballot comment (and whether you edited an AI suggestion), rank, rubric scores or ratings, reason for rank, drawn question or topic | The ballot | People with this browser on this device | Backup file. Review → Copy all (no names). Print / PDF. History CSV has the rank; comments only if you tick "Include names and comments". | Delete the round, or clear site data | Until you delete it or optional auto-delete removes it (see below) | This browser on this device |

## Congress

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Chambers: house, your role, legislators (code and name), docket titles, tournament | Runs a Congress chamber | People with this browser on this device | Backup file | Use Settings → Clear this device, or clear site data in your browser. | Until you clear site data or optional auto-delete removes it (see below) | This browser on this device |
| Sessions: speeches (side, type, speaking and question times, points, penalty, comment), presiding officer terms, ranks, recency; your scale preference | Scores and ranks a session | People with this browser on this device | Backup file | You can remove a single speech (with Undo). There is no single-session delete button. Use Settings → Clear this device, or clear site data in your browser. | Until you clear site data or optional auto-delete removes it (see below) | This browser on this device |

## My day

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Days: date, tournament, check-in time, standby | Plans your tournament day | People with this browser on this device | Backup file | Use Settings → Clear this device, or clear site data in your browser. | Until you clear site data or optional auto-delete removes it (see below) | This browser on this device |
| Ballot cards: event, role, round, flight, level, room, start time, ranks-due time, submitted time, status, linked round | Lists the ballots you have that day | People with this browser on this device | Backup file | Cancel marks a card cancelled; it does not delete it. Deleting a round in History does not delete its card. Use Settings → Clear this device or browser site-data removal to remove cards. | Until you clear site data or optional auto-delete removes it (see below) | This browser on this device |

## Settings and AI key

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Settings: mode, theme, ranks-due reminder, recent events (up to 5), draw gap, vibration and Big digits, backup reminders, the auto-delete choice, feedback-edit defaults, general and per-tool AI preferences, room-judging priorities | Your preferences | People with this browser on this device | Backup file | Clear site data | Until you clear site data | This browser on this device |
| AI key you paste (for comment editing and room comparison) | Lets the app call the AI company you chose | People with this browser on this device | Not in the backup file unless you tick "Include my AI key". A key kept in this tab only is never in a backup. | Settings → "Forget my key". Closing the tab also forgets a key kept in this tab only. | "Only this tab" (the default): until you close the tab. "Remember on this device": until you forget it or clear site data. | "Only this tab": this tab's session storage. "Remember on this device": this browser on this device. |
| AI model you picked | Uses the same model next time. No secret. | People with this browser on this device | Backup file | "Forget my key" also removes it. | Until you forget your key | This browser on this device |
| Damaged saved value (a copy kept when saved data cannot be read) | So a storage problem does not lose your data | People with this browser on this device | Backup file | Clear site data. Nothing deletes it by itself. | Until you clear site data | This browser on this device |

## App files for offline use

The app saves its own files (code, styles, event rules, fonts) in the browser so it works without internet. This
cache holds **no user data**. A new version of the app deletes the old cache by itself.

## Export and backup

- **Settings → Data → Download backup**: a file with everything Speech Events saved in this browser. Your AI key is
  left out unless you tick "Include my AI key". Keep the file safe: it holds names and comments.
- **Settings → Data → Check a backup**: shows what a Speech Events backup holds before any change. Restore then asks before replacing saved data. It keeps this device's auto-delete choice and offers Undo while the tab stays open.
- **History → Copy as TSV / Download CSV**: date, tournament, round, flight, level, event, state, order, code, status,
  rank. Names and comments only if you tick "Include names and comments".
- **Review → Copy all** and **Print / PDF**: the ballot for one round. No private notes or rule-check flags.

## Optional auto-delete

Settings → Data → Auto-delete old rounds is off by default. You can choose 7, 30 or 90 local calendar days. It runs when the app starts. It removes only old rounds marked submitted with comments closed. Rounds with no linked card stay. A Congress chamber is removed only when it has sessions and every session is submitted. Old days and their remaining cards go only when no round remains on that day. Today and days with an invalid date stay.

Undo and Settings → Data → Put them back can restore removed records while the tab stays open. A clock earlier than a saved time pauses deletion. A clock that runs far ahead cannot be distinguished from real time.

## Recovery after a failed data change

For Clear this device, backup Restore, automatic old-round removal, and their Undo or Put them back actions, the app saves recovery records on this device. They keep the prior data and the requested result until the change or recovery completes. A tab-only AI key stays in session storage and is never copied into the local recovery record. Closing its tab still forgets that key.

For these operations, recovery after an interrupted change runs before normal app work or auto-delete. If safe recovery cannot finish, the app blocks further changes and offers recovery controls. A failed Undo of one of these operations keeps its requested original data for an explicit retry. Recovery records stay until the change and its recovery cleanup finish. These records do not go to Tabula's server. Browser storage failures can prevent a change; read the message shown.

## Delete everything

Settings → **Clear this device** removes the app's saved data from this browser and its tab-only AI key.
It offers a backup first and an Undo while the page stays open. A browser storage failure can prevent a clear or restore; check any error shown. It does not clear Tabula Debate data.
Settings → Data → Wrap up the season offers a backup, asks whether it saved, then opens the clear confirmation. Skipping the backup is a separate choice.
Clearing site data in browser settings is another way to remove it. Download a backup first if you want to keep it.

## Sent to other services

| Service | What it gets | Why |
|---|---|---|
| The AI company you choose with your own key (Anthropic, Google, OpenAI, OpenRouter or xAI) | Your key and the text needed for the requested edit or comparison. Comment editing sends the selected comment or excerpt, event name, saved style and editing preferences, plus a custom request when supplied. Room comparison sends original public notes, event criteria, saved priorities and style, and whether each speech is complete and first-place eligible. | The request goes straight from your browser to that company, not through our server. That company's own terms apply. |

Before either request, the app replaces known entry codes, names, piece titles and authors from setup with neutral
labels. It refuses a request when a known value remains. Other names or private details typed only into notes,
preferences or a custom request can still leave the device. Check the text first.

Private notes, rule-check flags, current ranks and ratings are not sent for room comparison. A suggested order is an
optional read-only aid. It does not write the final ballot. Pending suggestions and comparison evidence are held in
page memory; only accepted comment changes are written into the saved room. The room keeps AI-origin marks and
manual-edit protection with its saved comments.

Speech Events has no active Hosted AI account path. It sends no round content to Tabula's server. It loads no
analytics, ads, outside fonts or outside scripts.

## Cookies

Speech Events sets no account cookies of its own. A cookie from another Tabula service can also apply to its
subdomains. See the [account cookie list](console.md#cookies).

## Backups

Your Speech Events data is on your device. Our server backups do not hold it. The backup files you download are yours to keep.

## Logs

Cloudflare receives technical request data, such as the address and the browser's IP address, to serve and protect
the app. The [Privacy Policy](https://tabulaspeech.com/privacy/#collect) describes that processing. It does not say
Tabula receives a visitor-by-visitor traffic record. The app sends no round data in requests for its own files.

## Questions, export and delete

Email support@tabulaspeech.com.

Reviewed with the data-lifetime release candidate on 26 November 2026. [PR44](https://github.com/TabulaSpeech/tabula/pull/44) records the final source and release checks.
