# Tabula API contract

> **What this is.** What a Tabula app on a device sends to the Tabula server, and what it gets back: routes, fields, error codes and cookies.
> **The server is closed source.** This is the public contract only. It does not describe how the server works inside (see [README.md](README.md)).
> **Source.** Edited from the server's contract doc, as of 2026-11-21.
> **Date.** 2026-11-25.

Status: draft 1. No app decides a plan or policy rule itself.

## 1. The one rule for apps

An app asks the server **one question**: "what may this user do here?" It gets one record. It shows what the record allows and **removes** the rest. With no record (signed out, never signed in), the app is the solo app. The public app works fully with no server.

## 2. `GET /api/v1/me/capabilities?v=2`

Served on every app host (`debate.`, `events.`). Same-origin, session cookie.

Query:

| Param | Required | Meaning |
|---|---|---|
| `v` | yes for v2 | Contract version. Missing = v1 (the old shape, kept for old builds). |
| `product` | yes | `debate` or `events` |
| `programId` | no | The "Judging for" choice. Missing or `none` = the person's own round. |

Response (v2). The names and numbers are examples only:

```json
{
  "v": 2,
  "product": "debate",
  "edition": "judge",
  "subject": { "role": "coach", "programId": "p_123", "programName": "Lincoln HS Debate", "managed": false },
  "features": {
    "transcription": { "payer": "program" },
    "aiFlow":        { "payer": "program" },
    "ballotDraft":   { "payer": "self" }
  },
  "aiSetup": true,
  "settings": { "recording": "on" },
  "limits": { "poolRoundsLeft": 6 },
  "account": { "plan": "free", "hosted": true, "roundsLeft": 7, "ageBand": "adult" },
  "versions": { "settings": 14, "entitlements": 1760440000000, "resolver": 1 },
  "issuedAt": 1795216738000,
  "expiresAt": 1796426338000
}
```

Always sent: `v`, `product`, `edition`, `subject`, `features`, `aiSetup`, `account.plan`, `account.hosted`, `versions.settings`, `versions.resolver`, `issuedAt`, `expiresAt`. The other fields are sent only when the server has a real value for them. An app must work when they are absent.

Field rules:

- **`features`** lists only allowed features. **A key that is absent is hidden.** There is no `false` and no reason field, so no app can render a "why". `payer` is `program` (the school pays) or `self` (own plan or own key).
- **`aiSetup`** is true only when at least one feature has `payer: "self"`. It means "the Connect AI card, key paste and plan buttons may show". The app still hides them when the device already has a hosted plan or a key (that part is `ready()`, on the device).
- **`settings`** carries only the settings the app reads. Never an admin-only setting.
- **`limits`** are numbers the app may show to the person. Never prices. Today the only key is `poolRoundsLeft`: it is the smaller of the person's own cap left and the school's rounds left; it is absent when the school does not pay for this person.
- **`account.roundsLeft`** is the person's own rounds left, as whole rounds.
- **`account.ageBand`** is `adult`, `teen` or `unknown`.
- **`versions`** are integers. `versions.entitlements` is 0 when there is no program.
- **`subject.programName`** is shown only as "Judging for Lincoln HS Debate" and "Managed by Lincoln HS Debate" ([docs/design/AI-POLICY.md](../design/AI-POLICY.md) R6).
- No names of other people. No email. No student data.
- `expiresAt` = 14 days after `issuedAt` ([docs/design/AI-POLICY.md](../design/AI-POLICY.md) §2d). The app reads the record again at app start, sign-in and round start, never mid-round.

Errors: `401 signed_out` (clear the cache, act as signed out). `400 bad_product`. `403 not_member` when `programId` is a program the person is not in (the app drops the choice and asks again). `410 upgrade` when the app asks for a contract version the server no longer serves. Any other error or offline: keep the cached record (§5).

The server checks every hosted AI call again on its side. A call for a feature the person may not use gets `403 policyOff`. The server never trusts the record on the device.

## 3. Other routes an app calls

| Route | What the app sends and gets |
|---|---|
| `GET /api/v1/me/profile` | `{ displayName, paradigm, photo, programs: [{ id, name, role }] }`. `401 signed_out` if not signed in. §5 rule 6 uses the programs list. |
| `PUT /api/v1/me/profile` | The person's own display name and paradigm. Round content is never sent. |
| `POST /api/v1/ai/<task>` | One hosted AI call for one round. Body: `{ callId, format, formatVersion, state, roundId, programId, resume? }`. `state` is the round text the task needs; it is not saved. The answer comes as server-sent events. The finished reply has the shape in [ai-replies-v1.json](ai-replies-v1.json). Errors are in the table below. |
| `GET /api/v1/ai/round/limits` | `{ v: 1, now, limits: { timeLimitMin, idleMin, coverRounds }, round, roundsLeft }`: the round limits the app shows, the state of the current round, and the person's own rounds left. Optional query `roundId`. |
| `POST /api/v1/auth/signout` | Ends this session. Clears the session cookie and the hint cookie. |

Writes must come from the app's own origin and carry the header `X-Tabula: 1`.

Hosted AI call errors (status, then code). The app shows plain words for each; `logic/hosted.js` `hostedError` is the full list.

| Status | Codes | What the app does |
|---|---|---|
| any | `policyOff`, `duplicate_call` | Stops quietly. |
| any | `round_idle`, `free_mode`, `round_closed`, `extras_spent` | The round goes on with the free tools. |
| 401 | | Signed out. |
| 402 | `round_cap`, `day_cap`, `plan_required`, `age_required`, `parent_consent_required`, other | No hosted AI for this call; the message says why. |
| 403 | `billing_hold`, other | No hosted AI for this call. |
| 404 | `reload_app` | Asks for a reload after the round. |
| 413 | | The round is too big to send. |
| 429 | `too_many_rounds`, other | Too many requests; try again later. |
| 5xx | | Busy; try again. |

The app code that builds these requests and reads the answers is in this repo: `logic/caps.js`, `core/policy.js`, `logic/account.js`, `logic/hosted.js` and `logic/limits.js`.

## 4. Versioning

- **v1 never leaks a hidden feature.** v1 and v2 come from the same rules. A coach whose school hid AI gets `features: []` in v1 too.
- **The `v` param is the contract version.** v1 stays until no app build in the field asks for it. Then v1 returns `410 upgrade`.
- **Inside v2, changes are additive only:** new feature keys, new settings, new limits. Apps ignore unknown fields. Removing or changing the meaning of a field needs v3.
- **New feature keys are safe:** an old app has no UI for a key it does not know. A new app treats a key the server does not send as hidden.
- **`versions.resolver`** goes up when the server's rules change, so support can match a record to the rules that made it.
- The feature key list, the settings registry and **a set of sample records made by the real server** are in [`fixtures/platform-v2.json`](../../fixtures/platform-v2.json). The app tests read it. A test fails if the app uses a key the file does not have.

## 5. How an app hides a feature (no taunting)

From [docs/design/AI-POLICY.md](../design/AI-POLICY.md) §3. For app behavior, AI-POLICY §3 and `js/caps.js` in this repo win; this section shows the shape only.

```js
// caps.js (shape, not final code)
can(f)        // true if features[f] exists; with no record, true (solo app)
payer(f)      // 'program' | 'self' | null
showSetup()   // record ? record.aiSetup && !ready() : !ready()
ready()       // device has a hosted plan (record.account.hosted) or a saved key
applyCapabilities(root)  // hides [data-ai] whose feature is not allowed,
                         // and [data-ai-setup] when showSetup() is false
```

Rules:
1. Static markup: `data-ai="<feature>"` on every AI control; `data-ai-setup` on every Connect AI surface.
2. Built markup: the builder calls `can()` or `showSetup()` and does not build the part.
3. `applyCapabilities` runs from the boot script **before first paint**, from the cached record, and again at each round boundary.
4. Every network call site checks `can(f)` first and returns with no UI.
5. Empty states never say "Connect AI" unless `showSetup()` is true. With no AI allowed, the empty state is plain ("The ballot works by hand.") or absent.
6. **No usable record** (offline and expired, a fetch error, or a new device) at app start or round start:
   - "Just me" round, not managed: the solo app.
   - A round "Judging for" a program, or a managed account: the app looks up the person's role there in the cached profile (`/me/profile` programs list). Coach, admin or student: **all AI hidden and no setup** until a record arrives. Judge: solo behavior (a judge's own AI is never removed, [docs/design/AI-POLICY.md](../design/AI-POLICY.md) §1a).
   - This only ever removes, so the round itself never waits.
7. Sign-out clears the record, the key in memory, and the session.

A static test (`ai-gate.test.mjs` in this repo) fails on: an untagged AI id; an unknown `data-ai` key; a call site whose `can('<key>')` is missing **or comes after its first fetch**; a tour step, palette entry or help block on an AI id with no `feature`; a Connect AI surface without `data-ai-setup`. **Each check has its own negative fixture** that must make it fail.

A DOM test (`ai-gate-dom.test.mjs` in this repo) loads sample records from `fixtures/platform-v2.json` and asserts what is visible for each.

## 6. Cookies

- **Session cookie.** Set at sign-in. Every route above reads it.
- **Sign-in hint cookie `tabula_si`.** `tabula_si=1; Path=/; SameSite=Lax; Max-Age=<session Max-Age>; Secure; Domain=tabulaspeech.com`. Not HttpOnly, no user data. Set with the session at every sign-in. Cleared at sign-out and at any `401 signed_out`. It grants nothing: no route reads it. Pages use it only to decide whether to ask the server who is signed in.

## 7. Your data: export and delete

A signed-in person can download or delete their account data from the account site.

Both routes need a fresh check first: the person enters a recent code sent by email. Without it, the server refuses the request.

- `GET /api/v1/me/export` (rate-limited, `429 slow_down`). `200` JSON with `Content-Disposition: attachment; filename="tabula-export.json"`:
  `{ v: 1, exportedAt, account: { id, email, plan, adultConfirmedAt, birthDate, ageCheckedAt, createdAt }, profile: { displayName, paradigm, hasPhoto, uses: [...] }, memberships: [{ programId, programName, role, since }], rounds: [{ id, product, firstCallAt, lastCallAt, calls }], purchases: [{ product, amountCents, credits, at }], subscriptions: [{ product, status, cancelAtPeriodEnd, currentPeriodEnd }], ledger: [{ at, delta, kind }], badges: [{ track, version, awardedAt }], truncated: [listName] }`.
  - `rounds` are counts and times only. `product` is `debate` or `events`.
  - `ledger` lists the person's own balance only. Spend from a school's rounds is the school's record.
  - Each list holds at most 5000 rows. A longer list is cut and named in `truncated`.
  - No payment-processor ids. No other person's email or data.
  - The photo is a separate `GET /users/:id/photo`.
- `POST /api/v1/me/delete` (same-origin write with `X-Tabula: 1`; body `{ confirm: "<the account email>" }`, case does not matter).
  - `400 confirm_mismatch`: the confirm value is missing or is not the account email.
  - `409 last_manager` with `{ programs: [id] }`: the person is the only member manager, or the only billing manager, of these schools. Hand over first.
  - `409 active_subscription`: a subscription will renew. Set it to cancel in the billing portal first.
  - `200 { ok: true }`, and both cookies are cleared.
  - Data rules: coming later.

## 8. Hosted AI replies

Each hosted AI task has one reply shape: [ai-replies-v1.json](ai-replies-v1.json) (JSON Schema). The server checks each reply against it. The debate app reads the reply with the same shape. A shape changes only with a new version and a matching app change.
