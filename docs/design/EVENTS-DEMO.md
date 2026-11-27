# Speech Events sample guide

Local preview: http://127.0.0.1:8742/?demo=events

## Scope

Six Watch / Try chapters use the existing Events screens and data operations:

1. Original Oratory setup and criteria, with district rules and two fictional speakers.
2. Maya Chen's repair-table speech, shown as silent sample captions beside an example timer.
3. Manual feedback, Strength / To work on chips, private notes, and rule flags.
4. A saved synthetic rewrite in the normal Original / Suggested review panel.
5. The judge’s own ranking or rating and reason.
6. Individual copy controls to complete the local ballot.

Events has no live transcription screen. Captions are a reading aid, not a claim
that Events is recording or transcribing. There is no audio asset, microphone
request, provider call, or paid generation. The synthetic rewrite is available
only for the exact sample manual comment, whole-comment Clarify mode. Other
text, selections, and edit modes get a clear refusal without calling a service.

Watch examples and practice use separate records. The guide captures the room
created in setup and follows that ID. Skip can create a ready-made practice room.
Restart and Watch replace only the example. During route changes the old screen
stays inert until the destination mounts, so fast edits cannot hit the old room.
The compact yellow guide keeps one instruction visible in Try. Details holds supporting detail.
A blue ring marks the next visible control. It pulses three times, then stays still.
Reduced motion uses a static ring. Show me scrolls and focuses without using the control.
The cue follows setup, comparison, ranking, and each individual copy step.
Begin receives the first cue. A neutral Chapters picker avoids repeating titles.

The judge owns ranks and ratings. Sample outcomes are fictional decisions, not
AI assessments. Copy all copies combined text only. Copy ranks, each comment,
and the reason separately to reach the existing app's completed state.

## Isolation and build contract

The first script is the existing, unchanged `assets/demo-boot.js`. It replaces
local/session storage with memory stores and blocks data transports, IndexedDB,
and microphone access. Demo startup skips service-worker registration and
storage persistence requests. Rules are a static snapshot of published Events
rules, verified against every source file by tests. Real rounds, history,
settings, keys, documents and audio are not used.

The prior blocker was packaging: Events' build and cache did not allow the
shared sandbox or the new guide assets. The build now explicitly lists the
sandbox plus four `events/sample-guide/` files. The cache check permits exactly
that sandbox path in addition to its existing allowed assets. All exclusions
for tests, private fixtures, unrelated app files and API paths remain. A new
negative test removes the sandbox from the build allowlist and requires failure.
A byte comparison proves the shipped sandbox matches the shared source.

First opening requires the static app files to load. Once open, the sample's
controls and captions do not need a network connection. No live sharing or
account is required. Leaving the sample loads a fresh normal setup page; sample
records are discarded. The guide says that reload clears practice.

## Validation

`events/demo.test.mjs` covers fixture fidelity, draft protection, playback
cancellation, sandbox wiring, and rejection of unsupported sample edit requests.

`events/demo-browser.test.mjs` drives the built app, including setup handoff,
Watch/restart preservation, normal review controls, draft cancellation, real
ranking and completion, active-playback exit, offline in-page use, transport
and microphone blocking, storage isolation, keyboard focus and six viewport /
theme combinations (390, 820, 1280 pixels; light and dark; reduced motion).

Screenshots and logs are on the external scratch volume:
- `/Volumes/cre-scratch/events-demo-390-light.png`
- `/Volumes/cre-scratch/events-demo-390-dark.png`
- `/Volumes/cre-scratch/events-demo-820-light.png`
- `/Volumes/cre-scratch/events-demo-820-dark.png`
- `/Volumes/cre-scratch/events-demo-1280-light.png`
- `/Volumes/cre-scratch/events-demo-1280-dark.png`
- `/Volumes/cre-scratch/events-demo-browser-approved.log`

The architecture reviewer required preserving the edit mode and selected-text
contract for saved drafts. That was fixed with explicit refusals and tests.
The verification reviewer required route locking, exact Tab focus assertions,
active-playback exit, pending-draft cancellation, and real completion controls.
Those fixes and tests are included.

No commit, push or deployment was made. Other contributors' existing work was
preserved. This is a local demo for Connor to review before deployment.

Checks before the compact-guide revision on 27 November 2026:
- `node --test`: 1,574 passed; 0 failed; 0 skipped.
- `node check-publish.mjs`: exit 0; all publish checks passed.
- `node --test events/demo-browser.test.mjs`: 13 passed; 0 failed.
- `node build-events.mjs /Volumes/cre-scratch/events-demo-preview`: exit 0; 158 files.
- Clean-context verification and architecture reviews: SHIP.

Final gate logs: `/Volumes/cre-scratch/events-demo-gates-complete.log` and
`/Volumes/cre-scratch/events-demo-publish-complete.log`.

## Compact guide revision

The visual direction comes from the Debate chat handoff in
`docs/design/EVENTS-DEMO-VISUAL-HANDOFF.md`. Events uses its own controls.
Guide utilities, the current task, and Back / Next have separate positions.
Details contains the sample disclosures, Skip, and Restart. Silent captions remain
visible during Watch playback. They never run beside the visitor’s timer.
Page changes pause playback. Page hiding also cancels cue updates and disconnects
the observer. Returning restores the cue without resuming playback. Disposal
removes all guide listeners and the observer.

Additional browser coverage checks the compact opening, finite pulses, reduced
motion, focus without data changes, setup-to-timer cues, real comparison and
acceptance, individual copy progress, and all chapters at 320 pixels.

Delivery checks for the compact guide, 27 November 2026:
- `node --test`: 1,584 passed; 0 failed; 0 skipped.
- `node check-publish.mjs`: exit 0.
- `node --test events/demo-browser.test.mjs`: 19 passed; 0 failed.
- `node build-events.mjs /Volumes/cre-scratch/events-demo-preview`: 158 files.
- Clean-context verification-critic and architecture-reviewer: SHIP.

The independent verification caught a timer redraw restoring a dismissed cue.
Cues now retain dismissal by control identity. The zero-cue test waits two frames.
Details also skips its hidden summary in the keyboard order.
A separate normal-navigation test complements the forced pending-draft disposal test.

The final local preview was driven from real setup through timer, typed feedback,
saved comparison and acceptance, changed ranks, and completed individual copies.
Phone, tablet and desktop render in both themes. Reduced motion uses a static cue.
No deployment was made.

Delivery evidence:
- `/Volumes/cre-scratch/events-guide-gates-delivery.log`
- `/Volumes/cre-scratch/events-guide-publish-delivery.log`
- `/Volumes/cre-scratch/events-guide-browser-approved.log`
- `/Volumes/cre-scratch/events-guide-local-intro.png`
- `/Volumes/cre-scratch/events-guide-local-complete.png`
- `/Volumes/cre-scratch/events-guide-review-dark.png`

## Current design and new-judge setup revision

The complete current Debate handoff was received and compared with its source.
`EVENTS-DEMO-VISUAL-HANDOFF.md` records the applied changes and Events-specific
differences. Details replaces More. Chapters has a thin inset chevron and label
space. The utilities fit in one row at 320 pixels. Blue cues remain visible on
keyboard focus. The guide scrolls within 40 percent of phone height.

New room now uses a compact “Elim or panel?” disclosure. It still shows the
current values when closed. Attached help explains Prelim, Elim and panel, says
to count yourself, and points to the ballot, room posting or tournament staff.
The private panel-note field appears only for a panel. Switching back and forth
preserves the note in the form; the existing model omits it for a single judge.
This change applies to actual room setup, including normal rooms.

New checks cover utility spacing, exact accessible names, native keyboard
opening, panel visibility, saved stage/panel values, normal phone clicks past
the open saved-edit panel, and a direct offline jump to saved review.

Visual evidence:
- `/Volumes/cre-scratch/events-design-delivery.png`
- `/Volumes/cre-scratch/events-round-help-detail.png`
- `/Volumes/cre-scratch/events-design-setup-320-light.png`
- `/Volumes/cre-scratch/events-design-help-820-dark.png`

Both clean-context reviewers approved the final design and hidden-field fix.
No deployment, commit or push was made.

Final checks for this revision:
- Combined `node --test`: 1,594 passed; 0 failed; 0 skipped. The Debate chat
  fixed its shared CSS contract and ran the fresh combined gate, including all
  23 Events browser checks, after the Events changes.
- `node check-publish.mjs`: exit 0.
- `node build-events.mjs /Volumes/cre-scratch/events-demo-preview`: 159 files.
- Both clean-context reviews: SHIP.

Combined gate log: `/Volumes/cre-scratch/debate-demo-direct-release-gate.log`.
Publish log: `/Volumes/cre-scratch/events-design-publish-delivery.log`.

## Current release-base port, 2026-11-27

This port supersedes the older checkout validation above. Its base is
`38f00822b24bef856b873c0f199f8cd2bfc5b6ec`. The candidate is
`/Volumes/cre-scratch/events-release-port-20261127`.

The port keeps the released data journal, recovery, lifetime, writer lock,
update guard, timers, Comment Kit, and install paths. Normal pages retain
`createEventsStore(ui)` and the native writer lock. Demo pages use the same
writer lifecycle with a page-local lease and the existing memory sandbox.
They do not request the device lock. Losing the page lease stops the guide.

The new browser test opens a normal owner, two separate demos, and another
normal tab. It proves that each demo makes zero native storage reads, writes,
or lock requests. The second normal tab still waits for the native owner.
When the owner closes, that normal tab can acquire the lock and read the
unchanged real round. Closing one demo does not change the other demo.
The sample writer also rejects use before acquisition and after release.

Browser test artifacts use `/Volumes/cre-scratch` on macOS and the system
temporary directory on other systems. No Linux execution is claimed here.
All safety assertions remain. The exact cache allowance for the sandbox
is retained, along with the build test that rejects a missing sandbox.

The current-base build contains 186 files, including the released install
and Comment Kit assets. The rounded guide has a 12 px radius. The local
preview is `http://127.0.0.1:8743/?demo=events`. A direct browser pass created
practice rooms and retained typed feedback at 390 px dark, 820 px light,
and 1280 px light. It found no page errors or horizontal overflow.

Both fresh independent reviewers returned SHIP. The verification reviewer
ran `node --test events/demo.test.mjs events/demo-browser.test.mjs events/sw.test.mjs`:
39 passed, zero failed or skipped. `git diff HEAD --check` passed.
Final gate results and frozen source hashes accompany the release handoff.
No commit, push, or deployment was made by this chat. Production stays on
hold for Connor's review of the combined staging preview.
