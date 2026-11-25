# Tabula server data rules

> **What this is.** What the Tabula server keeps about a person and a school, who can see it, and what delete removes.
> **The server is closed source.** This is the public part of its data rules. It does not show the server's tables or code (see [README.md](README.md)).
> **Source.** Edited from the server's data doc and contract doc, as of 2026-11-21.
> **Date.** 2026-11-25.

Status: draft 1. Tabula keeps as little data as it can. The app works fully with no account and no server.

## 1. The rules first

- **No round content is saved.** The server does not save speech, transcripts, flows, ballot text or AI replies. A hosted AI call goes through the server to the AI provider and back. The AI provider's own data rules apply to that call.
- **No student surname field.** The display name is free text the person chooses.
- **Usage is counts only.** Rounds and hosted calls per person, with times. No content.
- **School change records keep no content and no student names.** They keep who changed what, and when.
- **School data is deleted by school.** When a school is deleted, or the school's retention setting ends, its data is deleted. Its change records are kept until the same retention setting ends after the school's last term.
- **School money and personal money never mix.** A school's balance and a person's own balance are separate records.

## 2. What the server keeps

| About | What is kept |
|---|---|
| Your account | Email, plan, display name, paradigm, photo (if you add one), birth date and the time of the age step, the time you confirmed you are an adult, when the account was made. |
| Your schools | Each school you are in, your role there, and your rights (edit settings, manage members, manage billing). |
| A school | Name, product, settings, open invites (email and role; never a student), change records. |
| Use | Counts of rounds and hosted AI calls, with times. |
| Money | Purchases, subscriptions and balance changes. A payment-processor customer id links your account to the payment processor. Card details are with the payment processor, not on the Tabula server. |

The age band (`adult`, `teen` or `unknown`) is worked out from the birth date. It is not kept as its own value.

## 3. Who can see what

| Data | Who can see it |
|---|---|
| Your account, profile, schools, round counts, purchases, balance, badges | You, by `GET /api/v1/me/export` ([API.md](API.md) §7) |
| A school's roster and settings | Admins and coaches of that school |
| A school's change records and usage counts | Admins and coaches of that school |
| A school's balance | Admins and coaches of that school |
| Per-person caps | School members with the right to manage billing or edit settings |
| The capability record | Only the signed-in person. It holds no names of other people, no email and no student data. |

## 4. Change records

- Every change to a school (settings, members, invites, billing) writes one change record: who, when, what, the old value and the new value.
- A change record never holds round content or student names.
- A settings change and its change record are written together, or not at all.

## 5. Delete

`POST /api/v1/me/delete` ([API.md](API.md) §7) deletes an account:

- **Removed or cleared:** the email (it becomes `deleted+<id>@invalid`), display name, paradigm, photo, school memberships, pending invites the person sent, pending sign-in links, per-person caps, and every session.
- **Kept:** the payment-processor customer id, and the purchase and balance records. Disputes and tax records need them. Usage counts and school change records also stay. A change record shows "A school admin" for a deleted person.
- The same email can sign in again later. It gets a new, empty account.
