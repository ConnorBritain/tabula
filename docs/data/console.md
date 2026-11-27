# Data list: the Tabula account site

The account site is the web console where you sign in, manage your profile, run a school, and buy rounds of AI help.
The server code is private. This list describes the reviewed implementation.

The account records below live **on our server**. Cookies and short browser copies of photos live on your device.
Other services receive the limited data listed below. The judging app and Speech Events keep their own data on your device; see [debate.md](debate.md) and [events.md](events.md).

Some words used below:

- **School**: a group of accounts. A person in a school has one role: admin, coach, student or judge.
- **Staff**: an admin or a coach.
- **Admin rights**: an admin can have any of three rights: manage members, edit AI rules, manage billing.
- **Operator**: a person at Tabula with direct access to the database. No screen in the product shows operators the
  items below, but they can read the database.
- **Closing your account**: you can do this yourself on the account site. See [Closing your account](#closing-your-account).

There is no parent account and no parent role. A "parent" in this list is only an adult who bought rounds for a teen and
would answer one emailed question if sending were enabled. Sending is off in the checked release configuration.

We never fully remove an account record. When you close your account, we keep a small closed record. The tables say
what stays.

## Policy and release status

The [Privacy Policy](https://tabulaspeech.com/privacy/) sets the public retention, school-data and provider terms.
A table cell that says there is no automatic deletion describes the software. It does not permit us to ignore a
school agreement, a valid deletion request or the policy. Payment and tax records have legal retention duties.
The policy says these records are typically kept for seven years. This document does not set a new legal period.

This review uses app `afb7d14`, server source `41afb26` and policy source `370952c`, dated 26 November 2026.
Source review is not proof of production deployment. The server release still needs its release checks.
In that configuration, guest checkout, sending Rounds, parent-consent cleanup and passkey sign-in are off.
Sign-in bot enforcement is on in staging and off in production. The separate Programs team database is not bound.
Usage archiving is not active. Rows for those features describe implemented storage, not a feature launch.

The visibility columns describe product access. Operators with direct database access can also read server rows.
For rows outside the self-service export, contact support to make a data request. That is not a promise that every
internal security or legally retained record can be released or erased.

## Your account

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Account number (a random id) | Identifies your account. It is in your sign-in cookie. We send it to the payment service as a reference. | You. Staff in your school see member account numbers. | Yes | No. It stays after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Email address | Sign-in, emails we send you, and matching invites to you | You. In a school: admins with the manage-members right see every member's email; any admin or coach sees students' emails. | Yes | Closing your account replaces it with a placeholder. | Until you close your account | Our server |
| Plan (free or paid) | Decides if you can use AI that we host | You | Yes | No. It stays after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Adult confirmation time | An older "I am 18 or older" tick. It still counts. | You | Yes | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Created time, closed time | Account history. A closed time stops sign-in. | No screen shows the closed time. | Created time: yes | No. Both stay after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Display name (up to 80 characters) | Your name in the product | You. Staff see it on the school roster. Admins see it in the student-data read log. Staff see it next to school settings changes. | Yes | You can change it. Closing your account clears it. | Until you change it or close your account | Our server |
| Judge paradigm (free text, up to 5,000 characters) | Your judging preferences, used by the judging app | Only you | Yes | You can change it. Closing your account clears it. | Until you change it or close your account | Our server |
| Birth date | Age rules: you must be 13 or older; buyers and school admins must be adults | You see it as adult, minor or an age band. | Yes (the full date) | Closing your account clears it. | Until you close your account | Our server |
| Age-check time | When you gave your birth date and agreed to the Terms and Privacy Policy. It is our record of that agreement. | You | Yes | Closing your account clears it. | Until you close your account | Our server |
| Your uses (admin, coach, debater, judge) | You pick these. They change your home screen only. They give no rights. | You | Yes | You can change them. Closing your account clears them. | Until you change them or close your account | Our server |
| Email-verified time | When you first signed in with this email | No screen shows it. | Not in the self-service export; ask us | No. It stays after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Under-13 check fields: pending birth date, correction-used flag, hold end and review-request time | Handles a birth date below 13 | The age flow shows the pending date and hold state. No screen lists every internal field. | Full saved birth date is in the export; pending and internal fields are not. Ask support. | Closing clears the saved and pending birth dates and age-check time. Correction-used, hold and review-request fields remain. | Daily jobs try to close accounts whose seven-day hold ended. There is no automatic purge for the remaining closed-account fields. | Our server |
| Payment customer number | Opens checkout and the billing page for you | No screen shows it. | Not in the self-service export; ask us | No. It stays after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Billing hold time | Set by hand while a card dispute is open. It stops hosted AI and checkout. | No screen shows it. | Not in the self-service export; ask us | Cleared by hand when the dispute ends | We keep it. We have no automatic deletion for this yet. | Our server |
| Passkey handle and two-step sign-in fields: due time, recovery request, code hash, tries, session and approval window | Passkey sign-in and recovery, when enabled | The enabled flow shows required actions, not the internal values. | Not in the self-service export; ask us | Account closure clears these fields in the main close batch. | Until cleared or the account closes. Expired recovery windows stop working even if the field remains. | Our server |

## Profile photo

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Profile photo (JPEG, PNG or WebP, up to 512 KB) | Shows who you are in your school | You. In a school you share: admins and coaches see every member's photo; judges see staff and judges, never students; students see no one else's photo. | You can download it on its own. It is not in the export file. | Your delete button. A new photo replaces and deletes the old one. Account closure tries to delete all your photos after the account-close batch. | Until you delete or replace it, or close your account | Our server (photo store) |

Before storage, the server removes photo metadata, such as EXIF location and camera details. It keeps only allowed
image-format parts, including image data and embedded colour profiles. It refuses an upload it cannot parse safely.
This does not make the photo anonymous. Faces, names and other details visible in the image can still identify
someone. Browsers can keep a copy of a photo for up to 5 minutes.

When someone else sees a student's photo, we write a row in the student-data read log (see below).

## Sign-in

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Sign-in request: the email you typed (it may have no account), a scrambled copy (hash) of the sign-in link and of the 6-digit code, the page to return to, times, tries (up to 5) | Emails you a sign-in link and code. The sign-in request keeps only scrambled copies. The queued email holds the link and code until it is sent or 5 tries fail (see Emails we send). | No screen shows it. | Not in the self-service export; ask us | Closing your account deletes these for your email. | A code works for 15 minutes. We delete the request 24 hours after it stops working. | Our server |
| Session: created, expiry, last-use and fresh-proof times; confirmation-code hash, expiry and tries; proof method, sign-in strength and cached passkey requirements. No IP address, browser name or device. | Keeps you signed in and checks sensitive actions | No screen lists the stored row. | Not in the self-service export; ask us | Sign out or sign out everywhere. Account closure tries to remove all sessions and refuses later access even if removal fails. | At most 30 days after sign-in. Staff also expire after about 12 hours without use. Expired rows are removed when checked. | Our server (a per-person store) |
| Count of confirmation emails sent | Limits how many confirmation codes we send | No screen shows it. | No | Automatic | 1 hour | Our server (a fast per-person store) |
| One-time passkey challenge: id, challenge hash, purpose, optional account id, created and expiry times | Passkey sign-in or registration, when enabled | No screen shows the row. | No | A valid use consumes it. Account closure deletes account-bound challenges. | Expired challenges are eligible for daily cleanup, up to 500 per run. A backlog can take more than one run. Anonymous challenges use this cleanup too. | Our server |
| Passkeys: identifier, public key, algorithm, counter, connection types, backed-up flag, name (up to 40 characters), how it was added and times | Passkey sign-in, when enabled. Your device keeps the private key. | You see the enabled account list, with name and dates. | Not in the self-service export; ask us | Remove a passkey. Account closure deletes all account-bound credentials in the close batch. | Until removed or the account closes | Our server |

## Schools, members and roles

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| School: id, name, creator, created time, app scope and settings version | Groups accounts. An adult creates the school. | Members. Invite messages and open-invite screens include the school name. | School name and id are in each member's export. | There is no self-service whole-school delete in this source. Contact support for the school's deletion request. | No automatic core-school purge is implemented. The school agreement and Privacy Policy still apply. | Our server |
| Membership: school, person, role, a "managed" flag (a teen who joined with a student code, managed by the school), the three admin rights, joined time | Who is in the school and what they can do | You see your own. Admins and coaches see the roster with roles, rights, the managed flag and join times. Judges and students see no roster. | Yes | A member manager removes you (this needs a fresh emailed code), you leave, or you close your account. Group membership and member limits are removed too. | Until removed | Our server |
| School AI rules: the rule, where it applies, its value, updated time, who updated it | What AI help the school allows | Admins and coaches can view them. An admin or coach with the edit-AI-rules right can change them. Coaches can change only coach and student rules, not admin, judge or whole-school rules. | Not in the self-service export; ask us | Changed by editing. Old values are overwritten. | We keep them. We have no automatic deletion for these yet. | Our server |
| School change log: school, actor id, time, action, target, field and allowed old/new values | Records covered settings and team changes | Admins and coaches can view settings changes. The screen joins the actor's current display name. It does not expose actor email or the full membership/invite log. | Not in the self-service export; ask us | Account closure does not remove these records. | No automatic core audit purge is implemented. Policy and school agreement apply. | Our server |

Who manages school data: school admins first, then coaches. Permission flags and role limits decide who can manage
members, edit AI rules and manage billing. A coach's AI-rule permission covers only coach and student rules.

## School groups, limits and billing

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Group id, school id, school-typed group name, created time and student membership | Groups students for school work | Admins and coaches with student-management rights | Not in the self-service export; ask us | Staff can delete a group or move a student. Leaving or closing removes that student's group links. | Until removed; no automatic whole-school purge | Our server |
| Member AI limits, school entitlements, school credit ledger, billing reference and accepted terms/version/source | School AI rules, payment and spending limits | Each endpoint checks rights. Billing management is required for billing details; school membership alone is not enough. | Personal export includes membership, not all school records. Ask support for a school request. | Member limits are removed with membership/account closure. Money and terms records stay under policy. | No automatic general purge; legal and school-agreement duties apply | Our server |

## Invites and join codes

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Invite (to a judge or coach): school, the invited email, a scrambled copy of the invite link, who sent it, times (it runs out after 7 days), how many times it was sent, accepted or revoked, role | Invites a person to a school | Admins and coaches see the list. Coaches without the manage-members right do not see coach invite emails. The invited person sees their open invites (school name, role, end date), but not who sent it or the email. | Not in the self-service export; ask us | Revoke marks it revoked; it does not delete it. Closing your account revokes open invites you sent. Invites sent **to** you keep your real email after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Student join code: school, a scrambled copy of the code (the code shows once), role (student), end date, most uses, uses, who made it, times, revoked | Lets students join a school | Admins and coaches | Not in the self-service export; ask us | Revoke only | We keep it. We have no automatic deletion for this yet. | Our server |

A join code holds no student data.

## Student-data read log

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| School, reader id, time, action, item kind, optional student/item id and count. No names, emails, IP addresses or item content in the row. | Records reads of student roster data, per-person usage and limits, another person's student photo, and a student's own export. The Programs path can also add write/delete events when enabled. | Admins with the access-log right see the last 90 days. The screen can join current display names. Students do not see their own read history. | Not in the self-service export; ask us | Scheduled deletion | The daily job deletes rows older than 365 days. A failed run can delay cleanup. | Our server |

## Rounds, purchases and subscriptions

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Balance changes: amount, kind (grant, use, refund, adjust), reference, time | Your rounds left | You see it as rounds left. | Yes, without the reference | No. These are records. | We keep them. We have no automatic deletion for these yet. | Our server |
| AI use record, one per AI call: call id, person, round id (made by the app), task, format, app (debate or Speech Events), model, word-piece (token) counts, cost | Billing and limits. Usage numbers only: no round text, no names. | No screen lists them. | Per-round totals only (first and last call time, number of calls, app) | No. These are records. | We keep them. We have no automatic deletion for these yet. | Our server |
| Cost-overrun record: person, call, round, amount | Finds calls that cost more than planned. We check these records for unusual costs. | No screen shows it. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Paid grant: product, amount, created time, end date (paid grants do not run out) | Rounds you bought | You see it as rounds left. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Payment: payment reference, invoice number, owner, product, amount, rounds, time | Your purchase record | You (export, and the page after you pay) | Yes (product, amount, rounds, time) | No. These are records. | We keep them. We have no automatic deletion for these yet. | Our server |
| Subscription: product, status, cancel flag, period end | Plans that renew | You | Yes | No. While a plan renews, you cannot close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Checkout record: owner, product, which app you came from, status, times | Tracks a checkout until it is paid | You see it on the page after you pay. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Card dispute record | Handles a card dispute | No screen shows it. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Link between your account and the payment service's customer record | Billing | No screen shows it. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Auto-renew consent: person, product, notice version and times | Records agreement to automatic renewal | No screen lists it. | Not in the self-service export; ask us | No automatic deletion is implemented. | Retained under the Privacy Policy and applicable legal duties. This source does not enforce a legal retention deadline. | Our server |

Guest checkout is off. Its implemented path adds hashes of a random browser cookie and the IP address to the
checkout record. A hash can still be linked or compared; it is not anonymous data. This review does not assert that
the path ran in production. Any retained checkout rows remain subject to the Privacy Policy.

## Buying rounds for someone else

**Sending is off in the checked release configuration.** The implemented path can send purchased Rounds to an
email address. The rows below describe that path and any retained records, not an available production feature.
The send-end actions below include cleanup writes. They are not proof that every failure or retry clears data.
Account closure runs its send cleanup after the main close batch and can report success if that cleanup failed.

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Send: buyer, product, status, the email address the buyer typed, times, reminder times | Delivers the rounds to the other person | The buyer sees open sends, with the address partly hidden. | Not in the self-service export; ask us | We clear the typed address when the send ends: the other person keeps, claims or declines it, the buyer cancels, 14 days pass, an under-13 hold starts, the buyer starts a new send, or the buyer closes their account. | The address: until the send ends. The rest of the send record: we keep it. We have no automatic deletion for this yet. | Our server |
| Send limit check: a scrambled copy of the other person's email address. It can still be matched to that address. | Stops too many sends to one person. | No screen shows it. | No | Deleted when the send ends | Until the send ends | Our server |
| Rounds moved between accounts | Records the move | No screen shows it. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Sender block (a person blocked a buyer) | Stops more sends from that buyer | No screen shows it. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |

### The parent question

If sending is enabled and a teen (13 to 17) accepts Rounds from an adult, the implemented path emails the buyer one
yes-or-no question. That record contains: the
buyer's account number, the teen's account number, the notice version, a scrambled copy of the answer link, the answer
and the time.

- Who can see it: no screen shows it, to anyone.
- Export: not in the self-service export; ask us.
- Delete: closing either account does not delete it.
- How long we keep it: we keep it. The implemented cleanup uses three years after the later account closure, but its
  separate switch is off. This is not a running retention job.

## Emails we send

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Queued email: recipient, message kind, subject, text and HTML body, tries, last error and times | Sends mail reliably. A body can contain a one-time sign-in, invite or answer link. | No product screen lists it. | Not in the self-service export; ask us | Text and HTML bodies are blanked after provider acceptance or five failed attempts. The implemented send-end path deletes its recipient notification. | Recipient and subject have no automatic general purge, including after account closure. Sending cleanup is conditional and sending remains off. Policy applies. | Our server |

## Rate limits

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Request counters, keyed by IP address or account id; shared AI-capacity counters keyed by provider/model | Stops abuse and overload | No screen shows them. | No | Limits reset or age out under the limiter implementation. | Request limits use a 60-second period. That period is not a promise that every provider or log copy is erased after 60 seconds. | Cloudflare rate-limit service and server capacity stores |

## Security counts

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Hour, a fixed event word, a count. No user data. | Finds attacks and problems | No screen shows it. | No | Automatic | 30 days | Our server |

## Short-lived data for AI calls

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Hold on your rounds during a call | Stops a call from using more than you have | No screen shows it. | No | Automatic | 5 minutes | Our server (a fast per-person store) |
| Call record waiting to be written: call id, cost, round id, task, format, app, model, token counts. No text. | Writes the AI use record | No screen shows it. | No | Automatic | After successful writing, cleanup can remove call records more than 24 hours old. Unwritten records stay for retry. | Our server (a fast per-person store) |
| Round budget | The AI limits for one round. Open rounds end by themselves after 6 hours. | No screen shows it. | No | Automatic | Cleanup can remove records more than two days old. Open committed budgets stay until the round closes. | Our server (a fast per-person store) |
| Live-flow word count: kept by round id and the first 40 characters of the speech label | Bills only the new words in a speech | No screen shows it. | No | Automatic | 2 days | Our server (a fast per-person store) |
| Cached balance and account number | Shows rounds left quickly | No screen shows it. | No | Closing your account does not clear it. | We keep it. We have no automatic deletion for this yet. | Our server (a fast per-person store) |

## Operational records and held Programs storage

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Operational measurements: fixed provider/model labels, status classes, counts, backlog ages, capacity and environment | Finds service failures and overload | Operators; no customer screen | Not in the self-service export | Provider and operational cleanup settings apply | This review does not verify the configured provider retention window | Cloudflare operational stores. These points contain no round text, email or account id. |
| Incident record, scope, affected school ids, staff-entered facts and actor name, drafted notice recipient/subject/body, attempt and sent times, reminder payloads and times | Supports incident response and proof of notice | Authorized incident operators; no ordinary account screen | Not in the self-service export; requests need review | No automatic incident purge in reviewed source | Policy, agreements and legal duties apply; no new duration is set here | Server source and migration 0034. Deployment must be verified before treating this as live storage. |
| Programs team keys, seasons, team links, tasks and targets/states, round slots/debater ids, sealed feedback and summaries, visibility preferences, deletion jobs and pending access-log rows | Planned school-directed team work and retention | Role, membership and feature checks apply when enabled | No completed general school-export feature is proved here | Separate team-data jobs implement their own deletion paths; they are not a whole-school core-account purge. | Not active in the checked release: the separate database is not bound | Separate Programs database, when provisioned. It does not store name/email columns. Free text and sealed content can still contain personal data. |

The Programs inventory is not a promise that these features or their retention jobs are live. Usage rollups,
ledger compaction and a general usage archive are also not active in this release.

## Self-service export

On the account site you can download your data. You need a fresh identity check. The current email flow uses a code; the enabled passkey flow can also prove identity. Each list holds up to 5,000 rows.

The export has: your account (account number, email, plan, adult confirmation time, birth date, age-check time,
created time); your profile (display name, paradigm, whether you have a photo, your uses); your memberships (school id,
school name, role, since); your rounds (first and last call time, number of calls, app); purchases (product, amount,
rounds, time); subscriptions (product, status, cancel flag, period end); balance changes (time, change, kind); badges (none are given
yet). Your photo downloads on its own.

The rows above that say "Not in the self-service export" are not in it. To get them, email support@tabulaspeech.com.

## Closing your account

You can close your account yourself on the account site. You confirm your email and complete a fresh identity check. You cannot
close it while you are the last person who can manage members or billing in a school, or while a paid plan renews.

The main account-close batch:

- sets the closed time and replaces the email with a placeholder;
- clears the display name, paradigm, photo link, saved and pending birth dates, age-check time and uses;
- clears the passkey handle and two-step recovery fields, and deletes account-bound credentials and challenges;
- removes school memberships, group memberships and member limits;
- adds change-log rows for the covered school removals;
- revokes open invites you sent and deletes sign-in requests for your old email.

After that batch, the server tries to remove sessions and photos, return sent Rounds to their buyers and cancel
open sends. These are separate cleanup steps. A failed step is logged, but the account remains closed and the
request can still return success. A leftover session cannot sign in to a closed account. Support must check any
failed cleanup. Sending remains off in the checked configuration.

The source retains the closed account id, placeholder email, plan, created and closed times, payment customer
number, billing hold, email-verification time and remaining age-hold/review flags. It retains money, usage and
audit records; invitation history can still include the real recipient email. Email recipients and subjects,
parent-answer records, sender blocks and cached balance can also remain. Timed security-count and student-read-log
cleanup still applies. Stripe keeps its own customer record under its terms.

These remaining rows are subject to the Privacy Policy, legal duties and school agreements. The code does not
perform a full-school purge when one member closes an account. A later sign-in with the old email can create a new,
empty account. It does not reopen the closed account or restore its records.

To ask us to delete more, email support@tabulaspeech.com.

## Sent to other services

| Service | What it gets | Why |
|---|---|---|
| Payment service (Stripe) | Your account number as a reference, the product, your email if you are a new customer. It collects your card and billing address itself. | The published Terms identify Link, a Stripe service, as the merchant of record for online Paid Plans. It handles payment and tax under its terms. Programs use separate invoice terms. We do not ask Stripe to erase a customer record on account closure. See the Privacy Policy for the provider terms. |
| Email service (Resend) | Recipient, subject and text of: sign-in and confirmation codes, invites (with the school name), notices that a student was removed, receipts, send links, the parent question, and internal alerts that hold account numbers | Delivers mail. The Privacy Policy identifies its provider role. This review does not establish a separate provider retention period. |
| Bot check (Cloudflare Turnstile) | A check token and your IP address | Stops automated abuse. Sign-in enforcement is on in staging and off in production in the checked configuration. Sending and guest checkout are off. Other form checks depend on their feature and enforcement switches. |
| AI providers (OpenAI, Anthropic) | Only when the judging app uses hosted AI. See [debate.md](debate.md). Speech Events has no hosted AI today. | Answers AI requests |

## Cookies

| Cookie | What it holds | How long |
|---|---|---|
| Session cookie | Your account number and session id, signed. Scripts on the page cannot read it. | 30 days |
| Sign-in hint (`tabula_si`) | The value 1; indicates a sign-in. Page scripts can read it. | Up to 30 days, or until sign-out/session cleanup clears it |
| Under-13 marker | The value 1, set by the birth-date flow. Page scripts cannot read it. Its path is limited to that API step. | 1 year |
| Guest checkout cookie | A random value. Only for checkout without an account, which is off. | 1 day |

## Backups

Provider recovery copies can outlast normal deletion. Their availability depends on the store, plan and recovery
settings. This source review does not verify a production recovery window or guarantee that every deleted row can
be restored. The Privacy Policy applies to retained recovery copies too.

## Logs

Cloudflare receives technical request data, including an IP address and browser details, to serve and protect the
service. The Privacy Policy says Tabula receives aggregate traffic counts, not a visitor-by-visitor traffic record.
That statement is separate from the application logs below. This review does not establish provider log settings
or a separate provider retention period.

Security-event logs use fixed words. Other application log lines can hold an account number (for example: a round ended,
a cost limit was hit, an under-13 review was asked for, a manual refund, a renewal was skipped with its invoice number).
We log model names and timings, never round text.

## Where our server is

Worker execution, database placement and provider storage settings determine where processing occurs. This review
does not establish one production country or region. See the Privacy Policy for cross-border processing terms.

## Questions, export and delete

Email support@tabulaspeech.com.

Reviewed against app `afb7d14`, server source `41afb26` and policy source `370952c` on 26 November 2026.
