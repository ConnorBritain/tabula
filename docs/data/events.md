# Data list: Tabula Speech Events

Speech Events is the app for judging speech events: rounds, rooms, timing, ranks, ballot comments, Congress and your
day at a tournament. Its code is public in this repository under `events/`.

**Where your data lives:** on your device, in this browser. Speech Events does not sign in and does not send your
rounds to our server. The only data that leaves your device is what you send to an AI company with your own key (see
[Sent to other services](#sent-to-other-services)).

Who can see device data: anyone who can use this browser on this device. Tabula does not receive it.

If you also have a Tabula account, the account site keeps the data in [console.md](console.md). Speech Events does not
use that account today.

## Rounds and ballots

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Round details: event, rules used, tournament, round, flight, level, panel, state, created and updated times, when you copied ranks or comments | Runs the round and keeps your history | People with this browser on this device | Backup file. History CSV (some columns). | History → ⋯ → Delete (with Undo). Or clear site data in your browser. | Until you delete it | This browser on this device |
| Each entry: competitor code, competitor name, piece title and author, speaking order, status (for example no-show) | Who spoke, in what order | People with this browser on this device | Backup file. History CSV has the code; names only if you tick "Include names and comments". Print / PDF has the code and the piece title and author. | Remove the entry in the room, delete the round, or clear site data | Until you delete it | This browser on this device |
| Timing: time used, runs, over time or grace, prep time | Time checks and the ballot | People with this browser on this device | Backup file. Print / PDF. | Delete the round, or clear site data | Until you delete it | This browser on this device |
| Notes and private notes, tags, rule-check flags | Your judging notes | People with this browser on this device | Backup file only. Private notes and flags are never in the CSV, the copy text or Print / PDF. | Delete the round, or clear site data | Until you delete it | This browser on this device |
| Ballot comment (and whether you edited an AI suggestion), rank, rubric scores or ratings, reason for rank, drawn question or topic | The ballot | People with this browser on this device | Backup file. Review → Copy all (no names). Print / PDF. History CSV has the rank; comments only if you tick "Include names and comments". | Delete the round, or clear site data | Until you delete it | This browser on this device |

## Congress

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Chambers: house, your role, legislators (code and name), docket titles, tournament | Runs a Congress chamber | People with this browser on this device | Backup file | There is no delete button for this yet. Clear site data in your browser. | Until you clear site data | This browser on this device |
| Sessions: speeches (side, type, speaking and question times, points, penalty, comment), presiding officer terms, ranks, recency; your scale preference | Scores and ranks a session | People with this browser on this device | Backup file | There is no delete button for this yet. Clear site data in your browser. | Until you clear site data | This browser on this device |

## My day

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Days: date, tournament, check-in time, standby | Plans your tournament day | People with this browser on this device | Backup file | There is no delete button for this yet. Clear site data in your browser. | Until you clear site data | This browser on this device |
| Ballot cards: event, role, round, flight, level, room, start time, ranks-due time, submitted time, status, linked round | Lists the ballots you have that day | People with this browser on this device | Backup file | Cancel marks a card cancelled; it does not delete it. Deleting a round in History does not delete its card. Clear site data to remove cards. | Until you clear site data | This browser on this device |

## Settings and AI key

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Settings: mode, theme, ranks-due reminder, recent events (up to 5), draw gap | Your preferences | People with this browser on this device | Backup file | Clear site data | Until you clear site data | This browser on this device |
| AI key you paste (for AI comment clean-up) | Lets the app call the AI company you chose | People with this browser on this device | Not in the backup file unless you tick "Include my AI key". A key kept in this tab only is never in a backup. | Settings → "Forget my key". Closing the tab also forgets a key kept in this tab only. | "Only this tab" (the default): until you close the tab. "Remember on this device": until you forget it or clear site data. | "Only this tab": this tab's session storage. "Remember on this device": this browser on this device. |
| AI model you picked | Uses the same model next time. No secret. | People with this browser on this device | Backup file | "Forget my key" also removes it. | Until you forget your key | This browser on this device |
| Damaged saved value (a copy kept when saved data cannot be read) | So a storage problem does not lose your data | People with this browser on this device | Backup file | Clear site data. Nothing deletes it by itself. | Until you clear site data | This browser on this device |

## App files for offline use

The app saves its own files (code, styles, event rules, fonts) in the browser so it works without internet. This
cache holds **no user data**. A new version of the app deletes the old cache by itself.

## Export and backup

- **Settings → Data → Download backup**: a file with everything Speech Events saved in this browser. Your AI key is
  left out unless you tick "Include my AI key". Keep the file safe: it holds names and comments.
- **Settings → Restore from a backup**: replaces the saved data with the file's data. It only takes Speech Events
  backups.
- **History → Copy as TSV / Download CSV**: date, tournament, round, flight, level, event, state, order, code, status,
  rank. Names and comments only if you tick "Include names and comments".
- **Review → Copy all** and **Print / PDF**: the ballot for one round. No private notes or rule-check flags.

## Delete everything

There is no single "delete everything" button yet. To remove all Speech Events data from a device, clear this site's
data in your browser settings. Download a backup first if you want to keep it.

## Sent to other services

| Service | What it gets | Why |
|---|---|---|
| The AI company you choose with your own key (Anthropic, Google, OpenAI, OpenRouter or xAI) | Your key, and for each AI clean-up: a fixed instruction, the event name, and the ballot comments (or notes) of the entries you picked. Before sending, the app swaps competitor codes, names, piece titles and authors for labels like "Speaker 1", and stops if any remain. Private notes and rule-check flags are never sent. | AI comment clean-up. The key and text go straight from your browser to that company, not through our server. That company's own terms apply. |

Speech Events has no hosted AI today. It sends nothing to our server. It loads no analytics, ads, outside fonts or
outside scripts.

## Cookies

Speech Events sets no cookies.

## Backups

Your Speech Events data is on your device. Our server backups do not hold it. The backup files you download are yours to keep.

## Logs

The service that serves the app's files can log each request (for example, the web address and your IP address).
What it keeps and for how long: we are confirming this. The app sends no round data in these requests.

## Questions, export and delete

Email support@tabulaspeech.com.
