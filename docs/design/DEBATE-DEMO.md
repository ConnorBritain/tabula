# Debate practice demo

Status: local implementation verified on 2026-11-27. Do not deploy before Connor reviews it.

Use the existing Policy, LD and PF synthetic rounds. Keep their speakers, speech
text and saved replies together. All evidence is invented for this sample.

The current player has only Next and reload. It replaces transcripts on replay,
combines transcript arrival with AI mapping, and accepts the ballot draft for the
visitor. It does not teach manual work or offer chapter navigation.

## Learning sequence

Each chapter opens the real screen. Watch is an explicit action. Try chapters do
not type for the visitor. Back, Next and a chapter picker skip without filling
missing work. Replay never resets a practice round. Restart reloads the disposable
sandbox and is the only operation that clears it.

1. Meet the sample speakers and inspect Round settings.
2. Type an analytic, Tab through citation and notes, and save it.
3. Watch silent sample captions arrive in the actual transcript drawer.
4. Apply the saved AI reply separately. Compare it with the manual note.
5. Change Flow options and inspect source markers.
6. Add a sample speech document with the normal document import operation.
7. Group, respond, move and extend entries. Use Flow Check and Undo.
8. Browse speeches and try speech and prep clocks.
9. Watch the opposing speech and map its saved reply.
10. Optionally fill untouched later speeches.
11. Configure and run Live Eval with the real controls.
12. Configure the ballot draft, run it, review and insert selected fields.
13. Revise the ballot and practice freely.

Captions are explicitly simulated. There is no audio, waveform, recording badge,
mic request or provider request. No paid generation is used. Reduced motion shows
captions in one user-initiated step. Animated playback pauses on input outside the
player. A changed transcript stops playback instead of replacing the edit.

The existing memory storage, disabled database and blocked network stay intact.
Sample documents live in the page only. Real SpeechDrop requires network access
and is explained but not called. Offline manual practice remains available; the
app's offline AI controls may pause saved-reply actions. Explain this state.

Do not add sharing, accounts or a parallel flow model. Keep desktop grid and the
approved mobile speech focus. Viewed speech and timed speech remain separate.
Use native controls and the existing theme tokens. No floating overlay.

## Verification

Test cancellation, pause/resume, transcript edits, replay, chapter jumps, document
idempotence, saved AI output, manual protection and exit. Drive Policy and LD at
phone, tablet and desktop sizes in both themes. Store screenshots on cre-scratch.
Run `node --test` and `node check-publish.mjs`. Run the independent verification
and architecture reviews before declaring completion.

## Local verification, 2026-11-26

- `node --test demo.test.js`: 27 pass.
- `node --test demo-journey.browser-test.mjs`: 15 pass. Includes real manual
  entry and Tab, pause/resume, visible replay, cancellation while a clock runs,
  document content, reset, offline network blocking, reduced motion, Live Eval,
  ballot review and exit. Viewports: 390, 820 and 1280; Policy and LD; both themes.
- `node check-publish.mjs`: pass.
- `node --test`: 1,541 pass, 17 fail. One failure is the existing browser-file
  registration gate at app-sw.test.mjs:111. It does not list the new demo test.
  The other failures are concurrent Speech Events build/storage/cache changes.
  No failing assertion was changed. Completion remains blocked.
- Architecture review: SHIP. Verification review: implementation findings fixed;
  BLOCK remains for the gate contract. Connor has been asked about registration.

Preview: http://127.0.0.1:8896/?demo=policy (LD uses `?demo=ld`).
No commit, push or deployment. Screenshots and logs are on `/Volumes/cre-scratch`.
This version uses silent captions. It does not include sample audio. Try chapters
use the real controls; their instructions do not auto-complete user tasks.

## Follow-up, 2026-11-27

Connor authorized registering `demo-journey.browser-test.mjs` in the existing
browser-file gate. The two previous files and all assertions remain in place.

Resolved the native-tooltip gate by using an accessible label on disabled
microphone controls. Saved-reply waits now exclude paused time. Every paused
operation, including Fill untouched speeches, exposes Resume. A new browser test
checks that a 16-second pause cannot apply a reply or end without user action.
Both independent reviewers returned SHIP for the revised Debate scope.

`node --test copy-dialogs.test.mjs app-sw.test.mjs`: 27 passed.
The focused new pause test passed. The existing offline Speeches/Flow Check test
also passed when rerun alone after a full-run timeout. No tests were weakened.
No Speech Events files were edited in this follow-up. No commit or deployment.


### Final gate results

- `node --test`: 1,571 passed; zero failed, cancelled or skipped. Exit status 0.
  Log: `/Volumes/cre-scratch/debate-demo-gates-nov27-isolated.log`.
- `node check-publish.mjs`: passed.
- Verification critic: SHIP. Architecture reviewer: SHIP.
- All 16 Debate demo browser checks passed within the full run.
- The earlier gate conflicts and failures above are historical. The final full
  run passed with all existing checks retained.

Local review URLs: `http://127.0.0.1:8896/?demo=policy` and
`http://127.0.0.1:8896/?demo=ld`. The preview is built on the external scratch disk.
No deployment, commit or push was performed.

## Presentation revision, 2026-11-27

Job: a visitor sees one next action, finds its real control, and tries it.
Target: #demo-bar and demo-only target cues. Preserve the app shell, flow model,
round controls, theme tokens, sample fixtures, sandbox and existing player safety.
User requested shorter copy, balanced layout, visual click guidance, and immediate
transcript-to-flow mapping. This is a targeted code revision, not a theme change.

Reference direction: compact in-context guide. Weavy shows a short instruction
and progress while leaving its workspace visible:
https://mobbin.com/screens/c08a2be4-1418-4217-9795-81932e345167
Navattic shows a target-attached instruction and a Next control:
https://mobbin.com/screens/ce908fe9-6fb5-4e16-b73b-362a69c59a02
These cross-domain references lend structure only. The full-screen modal direction
in Magnific, Monarch and Sentry was dropped because it covers the practice area.

Moves:
1. Replace the broad amber block with a compact neutral guide (Weavy). Keep the
   next instruction visible; put the existing detail under More. Short copy is new.
2. Group chapter navigation separately from practice actions (Weavy, Navattic).
   Keep back/next, chapter choice, restart and exit. Exact placement is our judgment.
3. Highlight the next real control (Navattic plus the user's explicit blue-glow
   request). Use a finite pulse and static reduced-motion ring. Show me scrolls
   and focuses only on request. Never block a click or automate the user's input.
4. Follow caption playback with saved mapping, then expose the resulting flow
   (explicit user correction). Keep simulation labeling and cancellation between stages.

Presentation revision verified:
- `node --test`: 1,575 passed; zero failures, cancellations or skips.
- `node check-publish.mjs`: passed.
- Browser coverage now includes automatic mapping, interruption during mapping,
  replay recovery, manual-note protection, cue source, Show me keyboard focus,
  cue updates after editor rendering, and static cues under reduced motion.
- Both independent reviews returned SHIP after fixes.
- Existing format-name and no-custom-shadow checks remain unchanged. The intro
  retains its plain format name. Cues pulse with outline colour and offset.
- Before/after board: `/Volumes/cre-scratch/debate-demo-redesign/board.html`.
- Rendered comparison: `/Volumes/cre-scratch/debate-demo-redesign/comparison.png`.
- Local preview rebuilt at port 8896. No commit, push or deployment.

## Compact guide and cue handoff, 2026-11-27

Connor asked for some yellow, one clear reading order, less repeated copy, and
more light around the blue outline. The opening screenshot exposed a separate
issue: the cue pointed to the Policy radio button even though the demo had already
selected the format. Begin now receives the first cue and takes the visitor to
manual entry. The cue then moves to the actual entry control.

- The guide uses a light mix of the existing amber and panel tokens. Its first
  row groups progress, Chapters, More and Exit. The second row gives the chapter
  one title, one short instruction and its action. On phones the actions wrap
  below the instruction. The picker says Chapters when closed and lists the
  chapter names inside it. Progress appears once.
- More reveals the current chapter's supporting detail, restart and the manual
  flow retry where applicable. The main instruction gives way to status during
  playback or mapping. A chapter that requires sample input explains how to get
  it if the visitor jumps in early.
- The real control gets a blue outline and three 1.5-second halo pulses. The
  ring stays when motion ends. Reduced motion shows a static ring. Show me
  scrolls to and focuses an app control on request without activating it.
- Watch shows silent captions, applies a saved reply, closes the transcript
  drawer and points to a transcript entry for that speech when it is visible.
  A chapter change cancels pending playback and saved work. Replay leaves manual
  input intact and retries mapping if the earlier attempt was interrupted.
- The app's real controls remain usable throughout. Demo mode uses disposable
  storage. The caption and saved-result sequence uses no microphone or provider.

Files: `index.html` defines the guide and halo. `js/demo.js` runs the player,
chooses targets and manages the guide. `logic/demo.js` holds chapter copy.
`demo-journey.browser-test.mjs` drives the built app. The preview uses
`http://127.0.0.1:8896/?demo=policy` or `?demo=ld`.

Reference images: the previous comparison at
`/Volumes/cre-scratch/debate-demo-redesign/comparison.png` records the Mobbin
reference pass. Current screen captures include
`/Volumes/cre-scratch/debate-guide-intro-1066-dark.png` and
`/Volumes/cre-scratch/debate-guide-note-390-light.png`. The previous Mobbin
links above show the in-context structure, not the new color or effect.

Events can reuse these presentation decisions with its own chapter tasks. This
handoff makes no change to Events and proposes no shared runtime dependency.

## All-chapter cue walkthrough, 2026-11-27

The opening cue pulses on the Policy button in the top bar, then passes to
Begin. Selecting Policy can advance the cue without waiting for the pulse.
The Chapters chevron uses a lighter stroke and sits in from the edge. Details
opens the chapter notes and restart controls.

The browser walkthrough drives all 13 Policy chapters at 1280 and 390 pixels.
It checks one real cue at a time, including Watch and the mapped transcript
entry for both 1AC and 1NC. The narrow test selects another speech before Watch.
On completion the demo reveals the mapped speech and sheet, and the cue prefers
an entry added by that mapping. A separate visual check confirmed the 1NC entry
could receive a pointer on 320, 390 and 1280 pixel layouts.

The walkthrough found a phone obstruction on Next after drafting. The demo
keeps its guide above the mobile draft panel. After the visitor inserts the
selected fields, the panel closes and the editable reason receives the cue.
Desktop and mobile walkthroughs retain normal Playwright clicks. The existing
file picker on Round still extends beyond the document at 320 pixels, as it did
before this pass. The guide controls themselves fit on one row at that width.

Fresh preview: `http://127.0.0.1:8898/?demo=policy`. Captures are
`/Volumes/cre-scratch/debate-cue-intro-1280.png` and
`/Volumes/cre-scratch/debate-cue-flow-390.png`.

## Current guide handoff, 2026-11-27

This section describes the current Debate preview. The preview starts on Flow
and points to Round. Round setup cues the format chip and echoes it on the
selected format card. The cue then points to the round details. Ready opens a
short confirmation. Begin explains the blue cue and moves to the first note.
The active app tab has a soft amber fill after the opening. The fill stays on
the selected tab even after the blue pulse ends.

- `index.html` defines `.demo-bar`, `.demo-heading`, `.demo-tools` and
  `.demo-actions`. The compact amber guide has one progress readout, one title
  and one instruction. Chapters, Details and Exit share the top row. The
  Chapters select has a separate thin chevron with its own right inset. It
  stays wide enough for the label on phones. Details reveals the chapter note,
  Start over and Map saved transcript when available.
- `js/demo.js` selects a visible, enabled control in `demoCueUpdate`. A
  MutationObserver updates it when the actual workspace changes. The cue runs
  three blue pulses, then keeps a fixed outline. Reduced motion keeps the
  outline without pulsing. Show me scrolls to and focuses the indicated control
  without activating it. It stays hidden when the control is already in the
  header or playback is busy.
- Watch shows silent sample captions, applies the saved map, closes the
  transcript drawer and reveals an entry created by that mapping. On a phone
  it also switches the viewed speech and sheet as needed. Pause freezes the
  player and delivery of its saved reply. A chapter change cancels pending
  work. Replay leaves any current user edits in place. These controls never
  access the microphone or an AI provider.
- On phones the guide stays within 40 percent of the viewport height and
  scrolls if needed. The draft sheet starts below the header, so Back and Next
  remain clickable. Inserting a draft during review closes the draft sheet and
  moves the cue to the editable reason. The desktop guide keeps its controls
  alongside the instruction.
- Live Eval and Draft use saved results even when the visitor jumps to them
  from a fresh round. Review can load the same draft directly. The final
  chapter explains the personal-plan round cost in Details. Its account link
  opens the visitor's real balance in a new tab.

The earlier Mobbin comparison is at
`/Volumes/cre-scratch/debate-demo-redesign/comparison.png`. The current demo
preview is `http://127.0.0.1:8911/?demo=policy`. The built-app tests in
`demo-journey.browser-test.mjs` cover the 13 chapters at desktop and phone
widths, plus offline jumps to Live Eval and Draft.
