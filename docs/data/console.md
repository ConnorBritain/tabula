# Data list: the Tabula account site

The account site is the web console where you sign in, manage your profile, run a school, and buy rounds of AI help.
Its code is not public. This list is.

Everything on this page lives **on our server**, not on your device, except the cookies and a short browser copy of
photos. The judging app and Speech Events keep their own
data on your device; see [debate.md](debate.md) and [events.md](events.md).

Some words used below:

- **School**: a group of accounts. A person in a school has one role: admin, coach, student or judge.
- **Staff**: an admin or a coach.
- **Admin rights**: an admin can have any of three rights: manage members, edit AI rules, manage billing.
- **Operator**: a person at Tabula with direct access to the database. No screen in the product shows operators the
  items below, but they can read the database.
- **Closing your account**: you can do this yourself on the account site. See [Closing your account](#closing-your-account).

There is no parent account and no parent role. A "parent" in this list is only an adult who bought rounds for a teen and
answers one emailed question.

We never fully remove an account record. When you close your account, we keep a small closed record. The tables say
what stays.

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
| Under-13 check fields (dates and status of an under-13 check) | Our process when a birth date shows a person under 13 | No screen shows them. | Not in the self-service export; ask us | No. They stay after you close your account. | We keep them. We have no automatic deletion for these yet. An account on an under-13 hold is closed after 7 days. | Our server |
| Payment customer number | Opens checkout and the billing page for you | No screen shows it. | Not in the self-service export; ask us | No. It stays after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Billing hold time | Set by hand while a card dispute is open. It stops hosted AI and checkout. | No screen shows it. | Not in the self-service export; ask us | Cleared by hand when the dispute ends | We keep it. We have no automatic deletion for this yet. | Our server |
| Passkey handle and two-step sign-in fields | For passkeys and two-step sign-in. **This feature is not on yet.** | No screen shows them. | Not in the self-service export; ask us | No. They stay after you close your account. | We keep them. We have no automatic deletion for these yet. | Our server |

## Profile photo

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Profile photo (JPEG, PNG or WebP, up to 512 KB) | Shows who you are in your school | You. In a school you share: admins and coaches see every member's photo; judges see staff and judges, never students; students see no one else's photo. | You can download it on its own. It is not in the export file. | Your delete button. A new photo replaces and deletes the old one. Closing your account deletes all your photos. | Until you delete or replace it, or close your account | Our server (photo store) |

**Important:** we store the photo exactly as you upload it. We do not remove hidden photo data (for example, the
place where the photo was taken, if your camera saved it). Remove that data before you upload, if you do not want to
share it. Browsers can keep a copy of a photo for up to 5 minutes.

When someone else sees a student's photo, we write a row in the student-data read log (see below).

## Sign-in

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Sign-in request: the email you typed (it may have no account), a scrambled copy (hash) of the sign-in link and of the 6-digit code, the page to return to, times, tries (up to 5) | Emails you a sign-in link and code. The sign-in request keeps only scrambled copies. The queued email holds the link and code until it is sent (see Emails we send). | No screen shows it. | Not in the self-service export; ask us | Closing your account deletes these for your email. | A code works for 15 minutes. We delete the request 24 hours after it stops working. | Our server |
| Session: times, a scrambled copy of a fresh confirmation code, a sign-in strength level. No IP address, browser name or device. | Keeps you signed in | No screen shows it. | Not in the self-service export; ask us | Sign out, "sign out everywhere", or close your account. | Up to 30 days. It also ends after 30 days without use, or 12 hours without use for staff. We delete it when it ends and is next checked. | Our server (a fast per-person store) |
| Count of confirmation emails sent | Limits how many confirmation codes we send | No screen shows it. | No | Automatic | 1 hour | Our server (a fast per-person store) |
| One-time passkey challenge | Passkey sign-in. **This feature is not on yet.** | No screen shows it. | No | Deleted when used | Unused ones that run out: we have no automatic deletion for these yet. | Our server |
| Passkeys: public key, type, counter, how it connects, backed-up flag, name (up to 40 characters), who added it, times | Passkey sign-in. **This feature is not on yet.** | You | Not in the self-service export; ask us | You can delete a passkey. Closing your account does **not** delete passkeys. | We keep them. We have no automatic deletion for these yet. | Our server |

## Schools, members and roles

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| School: id, name (typed by the person who made it), who made it, created time, which app (debate, Speech Events, or both), settings version | The group your account belongs to. Only adults can make a school. | Members. The school name is also in invite emails and in a person's list of open invites. | The school name and id are in each member's export. | No. We have no way to delete a school yet. | We keep it. We have no automatic deletion for this yet. | Our server |
| Membership: school, person, role, a "managed" flag (a teen who joined with a student code, managed by the school), the three admin rights, joined time | Who is in the school and what they can do | You see your own. Admins and coaches see the roster with roles, rights, the managed flag and join times. Judges and students see no roster. | Yes | A member manager removes you (this needs a fresh emailed code), you leave, or you close your account. | Until removed | Our server |
| School AI rules: the rule, where it applies, its value, updated time, who updated it | What AI help the school allows | Admins and coaches. Only an admin with the edit-AI-rules right can change them. | Not in the self-service export; ask us | Changed by editing. Old values are overwritten. | We keep them. We have no automatic deletion for these yet. | Our server |
| School change log: who, when, what changed, old and new value. Account numbers only, never names or emails. | A record of settings and team changes (roles, rights, members joining or leaving, invites, join codes) | Admins and coaches see settings changes, with the person's display name. No screen shows team changes. | Not in the self-service export; ask us | No. Closing your account does not remove these. | We keep it. We have no automatic deletion for this yet. | Our server |

Who manages school data: school admins first, then coaches. Admin rights decide who can manage members, edit AI rules
and manage billing.

## Invites and join codes

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Invite (to a judge or coach): school, the invited email, a scrambled copy of the invite link, who sent it, times (it runs out after 7 days), how many times it was sent, accepted or revoked, role | Invites a person to a school | Admins and coaches see the list. Coaches without the manage-members right do not see coach invite emails. The invited person sees their open invites (school name, role, end date), but not who sent it or the email. | Not in the self-service export; ask us | Revoke marks it revoked; it does not delete it. Closing your account revokes open invites you sent. Invites sent **to** you keep your real email after you close your account. | We keep it. We have no automatic deletion for this yet. | Our server |
| Student join code: school, a scrambled copy of the code (the code shows once), role (student), end date, most uses, uses, who made it, times, revoked | Lets students join a school | Admins and coaches | Not in the self-service export; ask us | Revoke only | We keep it. We have no automatic deletion for this yet. | Our server |

A join code holds no student data.

## Student-data read log

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| School, who read, time, read or export, what kind of item (for example roster or photo), which student (for one-person reads), count. No content, email, IP address or name. | A record of who looked at student data. We write it when someone reads the roster, when someone else sees a student's photo, and when a student exports their own data (one row per school). | School admins see the last 90 days. Students cannot see reads of their own data. | Not in the self-service export; ask us | Automatic | 365 days, then we delete it | Our server |

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
| Auto-renew consent: person, product, notice version, times | A record that you agreed to automatic renewal (required in California) | No screen shows it. | Not in the self-service export; ask us | No | At least 3 years. We have no automatic deletion for this yet. | Our server |

Checkout without an account is off. When it is on, the checkout record also holds a scrambled copy of a random cookie
value and of the IP address. We keep these records.

## Buying rounds for someone else

You can buy rounds and send them to another person by email.

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Send: buyer, product, status, the email address the buyer typed, times, reminder times | Delivers the rounds to the other person | The buyer sees open sends, with the address partly hidden. | Not in the self-service export; ask us | We clear the typed address when the send ends: the other person keeps, claims or declines it, the buyer cancels, 14 days pass, an under-13 hold starts, the buyer starts a new send, or the buyer closes their account. | The address: until the send ends. The rest of the send record: we keep it. We have no automatic deletion for this yet. | Our server |
| Send limit check: a scrambled copy of the other person's email address. It can still be matched to that address. | Stops too many sends to one person. | No screen shows it. | No | Deleted when the send ends | Until the send ends | Our server |
| Rounds moved between accounts | Records the move | No screen shows it. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |
| Sender block (a person blocked a buyer) | Stops more sends from that buyer | No screen shows it. | Not in the self-service export; ask us | No | We keep it. We have no automatic deletion for this yet. | Our server |

### The parent question

When a teen (13 to 17) accepts rounds that an adult sent, we email the buyer one yes-or-no question. We store: the
buyer's account number, the teen's account number, the notice version, a scrambled copy of the answer link, the answer
and the time.

- Who can see it: no screen shows it, to anyone.
- Export: not in the self-service export; ask us.
- Delete: closing either account does not delete it.
- How long we keep it: we keep it. We planned to delete it 3 years after both accounts close, but that deletion is
  switched off today.

## Emails we send

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Queued email: recipient address, kind of email (for example receipts and sign-in codes), subject, body, tries, last error, times | Sends email reliably. The body can hold a sign-in or answer link. | No screen shows it. | Not in the self-service export; ask us | We blank the body once the email is sent, or after 5 failed tries. "Sent to you" emails are deleted when the send ends. | Recipient address and subject: we keep them, also after you close your account. We have no automatic deletion for these yet. | Our server |

## Rate limits

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Request counters, kept by IP address (sign-in, answer links, checkout without an account) or by account number (AI, export, photo, checkout) | Stops abuse and overload | No screen shows them. | No | Automatic | Each count covers 60 seconds. How the hosting provider stores them: we are confirming this. | Our hosting provider |

## Security counts

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Hour, a fixed event word, a count. No user data. | Finds attacks and problems | No screen shows it. | No | Automatic | 30 days | Our server |

## Short-lived data for AI calls

| Data | Why | Who can see it | Export | Delete | How long we keep it | Where it lives |
|---|---|---|---|---|---|---|
| Hold on your rounds during a call | Stops a call from using more than you have | No screen shows it. | No | Automatic | 5 minutes | Our server (a fast per-person store) |
| Call record waiting to be written: call id, cost, round id, task, format, app, model, token counts. No text. | Writes the AI use record | No screen shows it. | No | Automatic | 24 hours after it is written to the main database | Our server (a fast per-person store) |
| Round budget | The AI limits for one round. Open rounds end by themselves after 6 hours. | No screen shows it. | No | Automatic | 2 days | Our server (a fast per-person store) |
| Live-flow word count: kept by round id and the first 40 characters of the speech label | Bills only the new words in a speech | No screen shows it. | No | Automatic | 2 days | Our server (a fast per-person store) |
| Cached balance and account number | Shows rounds left quickly | No screen shows it. | No | Closing your account does not clear it. | We keep it. We have no automatic deletion for this yet. | Our server (a fast per-person store) |

## Self-service export

On the account site you can download your data. You need a fresh emailed code. Each list holds up to 5,000 rows.

The export has: your account (account number, email, plan, adult confirmation time, birth date, age-check time,
created time); your profile (display name, paradigm, whether you have a photo, your uses); your memberships (school id,
school name, role, since); your rounds (first and last call time, number of calls, app); purchases (product, amount,
rounds, time); subscriptions (product, status, cancel flag, period end); balance changes (time, change, kind); badges (none are given
yet). Your photo downloads on its own.

The rows above that say "Not in the self-service export" are not in it. To get them, email support@tabulaspeech.com.

## Closing your account

You can close your account yourself on the account site. You type your email and a fresh emailed code. You cannot
close it while you are the last person who can manage members or billing in a school, or while a paid plan renews.

When you close your account, we:

- set the closed time and replace your email with a placeholder;
- clear your display name, paradigm, photo link, birth date, age-check time and uses;
- remove you from every school (each removal adds one row to that school's change log);
- revoke open invites you sent, and delete sign-in requests for your email;
- sign you out everywhere and delete all your profile photos;
- return sent rounds to the people who bought them, and cancel your own open sends (we clear the addresses you
  typed).

We keep, after you close your account:

- the closed account record: account number, placeholder email, plan, created and closed times, payment customer
  number, billing hold, email-verified time, under-13 check fields, passkey handle and two-step sign-in fields;
- money, usage and audit records: balance changes, AI use records, cost-overrun records, paid grants, payments,
  subscriptions, card disputes, payment customer links, checkout records, rounds moved, auto-renew consents, parent
  questions, school change logs, sender blocks, security counts, and the student-data read log (until its 365-day
  deletion);
- invites sent **to** you, with your real email;
- queued emails' recipient address and subject;
- your passkeys (the feature is not on yet);
- your cached balance;
- your customer record at the payment service (we do not ask it to delete it).

To ask us to delete more, email support@tabulaspeech.com.

## Sent to other services

| Service | What it gets | Why |
|---|---|---|
| Payment service (Stripe) | Your account number as a reference, the product, your email if you are a new customer. It collects your card and billing address itself. | It sells you the product (it is the seller of record), and handles refunds and cancels. We do not ask it to delete your customer record. How long it keeps data: we are confirming this. |
| Email service (Resend) | Recipient, subject and text of: sign-in and confirmation codes, invites (with the school name), notices that a student was removed, receipts, send links, the parent question, and internal alerts that hold account numbers | Delivers our emails. How long it keeps data: we are confirming this. |
| Bot check (Cloudflare Turnstile) | A check token and your IP address | Stops automated abuse. It is **off** today for sign-in, send forms and checkout without an account. |
| AI providers (OpenAI, Anthropic) | Only when the judging app uses hosted AI. See [debate.md](debate.md). Speech Events has no hosted AI today. | Answers AI requests |

## Cookies

| Cookie | What it holds | How long |
|---|---|---|
| Session cookie | Your account number and session id, signed. Scripts on the page cannot read it. | 30 days |
| Sign-in hint (`tabula_si`) | The value 1. No user data. | We are confirming this. |
| Under-13 marker | Set only during the birth-date step | 1 year |
| Guest checkout cookie | A random value. Only for checkout without an account, which is off. | 1 day |

## Backups

Our database provider keeps restore points. Data we delete can be recovered by an operator for up to about 30 days.
The fast per-person store also keeps 30 days of restore points.

## Logs

Our hosting provider logs every request. A log line can hold the web address (which can contain ids), request headers
and your IP address. What exactly it keeps, and for how long: we are confirming this.

Our own security log uses fixed words only. Some of our log lines hold an account number (for example: a round ended,
a cost limit was hit, an under-13 review was asked for, a manual refund, a renewal was skipped with its invoice number).
We log model names and timings, never round text.

## Where our server is

Which country or region our server and database are in: we are confirming this.

## Questions, export and delete

Email support@tabulaspeech.com.
