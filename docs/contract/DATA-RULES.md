# Tabula server data rules

This is the public description of the reviewed server data rules. The server is closed source.
See [README.md](README.md), the detailed [data lists](../data/README.md), and the
[Privacy Policy](https://tabulaspeech.com/privacy/).

Reviewed on 26 November 2026 against server source `41afb26` and app source `afb7d14`.
The free judging tools work without an account. Hosted AI and account services need the server.
Gated source code is not a promise that a feature is active.

## 1. The rules first

- **Judging content stays on the device.** The current judging and Hosted AI paths do not save Debate speech content, transcripts,
  flows, ballot text or AI replies. Held Programs team storage is listed separately below. A Hosted AI request passes through the server to a provider and back.
  The [Hosted AI policy](https://tabulaspeech.com/privacy/#hosted-ai) applies.
- **Names are not required as separate surname fields.** A display name is free text. A person can put a name in it.
- **Usage records hold metadata.** They hold identifiers, times, tasks, models, token counts and cost, not the round text.
  The detailed list also identifies short-lived meter data and the live-flow speech-label key.
- **School audit records use identifiers and permitted change values.** They do not copy round content.
  The settings-change view joins the actor's current display name for the screen. It does not return the actor's email.
- **School deletion follows the policy and agreement.** The current core school-account API does not provide automatic
  deletion of an entire school and all its records. New team-data deletion code is separate and not active in the
  checked production configuration. A school can make a request through support. Do not infer a working automatic
  school-wide purge from a retention setting.
- **School money and personal money are separate.** A school's balance and a person's balance use separate owners.

## 2. What the server keeps

| About | What is kept |
|---|---|
| Your account | Account identifier, email, plan, created and closed times, optional profile and photo, birth date and age-check fields, adult-confirmation time, and account-security records. |
| Your schools | Membership, role, administrative rights, joined time, and group membership where used. |
| A school | Identifier, name, product, settings, entitlements, invitation history, join codes and change records. An invitation may keep its recipient address after its link stops working. |
| Use | Hosted call and round identifiers, counts, task, format, model, token counts, cost and times. Short-lived meter records hold reservations and round budgets. |
| Money | Checkouts, payments, subscriptions, balance and lot records, refunds, disputes, renewal consent and payment-customer links. Card details stay with the payment service. |
| Gated features | Purchase setup, sending and parent-answer records; optional passkey and recovery records; separate Programs team data. The [data lists](../data/console.md) state their release and cleanup limits. |

The age band (`adult`, `teen` or `unknown`) is calculated from the birth date.

## 3. Who can see what

| Data | Who can see it |
|---|---|
| Your account, profile, memberships, round totals, purchases, balance changes and badges | You through the self-service export. Each list has a row cap. The export is not every internal record. |
| A school's roster and settings | Authorized administrators and coaches. An admin or coach needs the AI-rule edit right to change settings. Coaches can change only coach and student rules. |
| A school's settings-change records | Administrators and coaches with `audit.view`. The current audit endpoint returns settings changes, not every membership or invitation change. |
| A school's usage counts | Authorized staff with the required usage-report entitlement. Per-person reads are access-logged when they include student data. |
| A school's balance and billing details | Staff with the rights required by that endpoint. Membership alone does not give billing access. |
| Per-person limits | Staff with the required view or edit right. |
| Your capability record | The signed-in person. It contains no other person's email or student record. |

Self-service export is `GET /api/v1/me/export` ([API.md](API.md) §7). It needs a fresh identity check.
For records not in that file, contact support from the account email address.

## 4. Change records

School settings and supported membership, invitation, join-code and limit changes have audit writers.
The covered change and its audit statement are batched together. This is not a claim that every server action has the
same audit record or that the settings-change screen exposes the full stored history.

Stored records use actor and target identifiers. The settings screen can show an actor's display name.
For a deleted or missing actor it shows “A school admin”. No round text is copied into these audit records.

## 5. Account closure

`POST /api/v1/me/delete` ([API.md](API.md) §7) closes an account after confirmation and a fresh identity check.
It refuses closure while a paid plan renews or the person is a school's last required manager.

- **Removed or cleared:** the email becomes a placeholder; profile, birth date, pending age date, age-check time,
  uses, passkey handle, passkeys, account-bound verification challenges and staff recovery fields are removed or cleared.
  Memberships, group memberships and per-person limits are removed. Open invitations sent by the person are revoked.
  Sign-in requests for the address are deleted.
- **Follow-up cleanup:** the service ends sessions and removes photos. For enabled purchase sending it also returns
  held sent Rounds and cancels the buyer's open setups. These are follow-up steps; an account can already be closed
  when one fails. A response is not proof that every storage or payment-provider cleanup succeeded.
- **Kept:** a closed-account record and money, usage and audit records. This includes the payment-customer identifier.
  Invitation history follows the separate school-data rules. The [Privacy Policy](https://tabulaspeech.com/privacy/#retention)
  states the retention commitments; this document does not add a new automatic-purge promise.
- The same email can later create a new account. It does not reopen the old account or its data.

Closing an account does not erase the judging data in a browser. Use each app's local deletion controls or clear its
site data. Download a backup first if you want to keep it.
