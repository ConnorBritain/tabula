# Demo presentation handoff: Debate to Speech Events

27 November 2026. This records the cross-chat review Connor requested.
The handoff below records the design before implementation. The compact guide is now applied to Events; see EVENTS-DEMO.md for delivery evidence.

## Sources read

- Debate chat `01a21b3e-2bd8-7bc0-86ff-63ecf3b24cd0`, including Connor's latest two visual corrections.
- `docs/design/DEBATE-DEMO.md`, including the presentation revision.
- `js/demo.js`, `logic/demo.js`, and `demo-journey.browser-test.mjs`.
- `/Volumes/cre-scratch/debate-demo-redesign/comparison.png`.
- Current Events guide, CSS, and Events visual evidence.

The Events chat sent a direct handoff request to the Debate chat with Connor's
explicit authorization. Debate supplied its response in the Compact guide and cue
handoff section of DEBATE-DEMO.md. The latest pass is now verified: 1,576 tests
passed, publish checks passed, and both independent reviews approved. The current
intro image is /Volumes/cre-scratch/debate-guide-intro-1066-dark.png; the phone
image is /Volumes/cre-scratch/debate-guide-note-390-light.png. The older comparison
image records the prior neutral-background pass.

## Connor's latest visual direction

Keep a light yellow / amber background. Remove repeated labels and titles.
Give each step a deliberate layout. Make the blue border pulse visibly so the
next control is obvious. On the first screen, point to Begin, not a round setting
that is already selected. Keep the useful information, but present fewer words.

Earlier correction: showing transcription alone is incomplete. The demonstration
must continue into the resulting flow entries, then expose that result.

## What Debate implemented and learned

The completed first presentation pass uses a compact guide, one short instruction,
More for details, a blue target ring, and Show me. Watch runs captions, applies a
saved sample AI reply, closes the transcript drawer, and highlights the resulting
entry from that speech. A manual note must not be mistaken for the generated result.

The latest refinement separates utility controls (Chapters, More, Exit), the
current task, and navigation. It keeps the chapter title once. Progress appears
once. The chapter picker returns to the neutral label Chapters. Begin starts the
journey. A specific task action is primary; Next is secondary when that action
is present. Status replaces the instruction while work runs instead of stacking
another paragraph under it. Start over is under More.

Target cues resolve the actual visible, enabled control. Mobile and desktop may
need different targets and different short instructions. A cue follows a newly
rendered editor. It clears after the visitor uses the target. Show me scrolls and
focuses only when requested; it does not enter data or activate the control.
Reduced motion uses a static ring. The final verified cue uses three 1.5-second
halo pulses, then keeps the ring. The verified guide has the light amber tint.
Its utility controls fit on one row at 320 pixels.

Safety lessons:
- Pause time must not count toward an operation timeout.
- Every paused operation needs a visible Resume control.
- Interaction outside the player pauses automatic work.
- Chapter changes and exit cancel pending work, not only caption timers.
- Replay preserves edited text and existing flow entries.
- If a sequence stops after the transcript but before mapping, replay must finish
  the missing mapping without duplicating completed work.
- Stable generated IDs make repeat document imports harmless.
- Test the target's meaning and source, not only whether a blue ring exists.

## Apply the principles to Events

The current Events demo works, but its presentation is behind this direction.
Its expanded panel repeats chapter names and notices. Collapsing the entire guide
in Try hides the next instruction. It has no target cue or Show me action. Some
chapters present a saved result without demonstrating the action that produced it.

Use a compact, lightly tinted guide with one visible task and one sentence.
Keep the actual Events workspace visible. Put explanation and sample disclosures
under More while retaining a short persistent sample label. Keep navigation,
restart and exit separate from task actions. Use a chapter picker instead of the
large button grid. Avoid a floating modal over the workspace.

| Events moment | Next real control | Visible consequence |
| --- | --- | --- |
| Begin | Begin / Try setup | Setup opens with clear roster instructions |
| Configure | Event, rules, roster, then Start room | The visitor's configured room opens |
| Time | Start / Stop | The actual clock changes state |
| Note | Comments field or a Strength chip | Feedback appears on the real sheet |
| Private note | Private note field | The note stays outside the ballot |
| Saved rewrite | AI edit control, then Original / Suggested | The real comparison panel shows the wording change |
| Accept or keep | Use this / Keep mine | The actual feedback updates or stays unchanged |
| Judge | Rank or rating control | The real ordering or rating changes |
| Finish | Individual Copy ranks / comment / reason controls | The existing completion state advances |

For Events, cause and effect means notes to feedback, rewrite to review, judge
choice to ranks, and copy actions to completion. Do not import Debate's transcript
mapping or Live Eval: Events has no such screen. Keep silent captions clearly
separate from recording and from the visitor's actual timer.

Preserve Events-specific fixes: follow the room created in setup; lock the old
screen during route changes; separate Watch and practice records; refuse synthetic
rewrites for unmatched text, selections, and unsupported edit modes; use the
existing review controller; preserve copy completion semantics.

## References and boundaries

The Debate pass used Weavy for a compact guide that leaves the workspace visible,
and Navattic for an instruction tied to a real target. These are structural
references, not a new theme or a copied product workflow.

- https://mobbin.com/screens/c08a2be4-1418-4217-9795-81932e345167
- https://mobbin.com/screens/ce908fe9-6fb5-4e16-b73b-362a69c59a02

Do not edit Debate-owned files. Do not create a shared tour framework just to
make the two products look related. Reuse visual principles, app tokens, and
safety contracts while keeping Events' own screens and state model.

## Current handoff applied, 27 November 2026

The Debate chat supplied its complete update in `DEBATE-DEMO.md`, section
“Current guide handoff, 2026-11-27.” This supersedes the earlier More and opening
notes above. The implementation was checked against current `index.html`,
`js/demo.js` and `logic/demo.js`, not only against the screenshots.

| Current Debate change | Events treatment |
| --- | --- |
| Chapters has a thin inset chevron and more label space | Applied with shared spacing tokens; utilities fit in one row at 320 pixels. |
| Details replaces More | Applied; supporting copy, Skip and Restart stay in Details. |
| One title, instruction and progress count | Applied; the accessible progress label also identifies Watch or Practice. |
| Hide navigation that does not apply | Applied to the first Back and final Next. |
| Blue outline survives keyboard focus | Applied; focus gets a thicker blue outline. Three pulses and reduced motion remain. |
| Guide stays within 40 percent of phone height | Applied; expanded details and captions scroll within the guide. |
| Floating draft must not block Next | Verified with normal phone clicks while the Events saved-edit panel is open. Leaving does not accept the draft. |
| Jump straight to a saved result, including offline | Events already seeds its untouched practice room for saved comment review. A direct offline chapter test verifies it without requiring earlier chapters. |
| Flow → Round → Ready → Begin and amber active tabs | Events has a separate event guide and New room screen. It keeps its existing Begin → setup → Start room path. It has no Debate Flow tab or format-chip header to copy. |
| Watch → map → reveal a generated flow entry | Events has no live transcription or flow mapping. It keeps honest silent captions and the actual Original / Suggested comment editor. |
| Live Eval, ballot drafting and a real round-balance link | These are Debate capabilities. Events keeps its actual feedback, ranking and copy workflow. It uses a connected provider key; no round-credit claim or account dependency was added. |

The separate Events setup change keeps the current round values visible in a
compact disclosure. It defines Prelim, Elim and panel; says to count yourself;
and points judges to their ballot, room posting or tournament staff. Accessible
names stay short, with the explanations attached as descriptions. The same setup
screen serves demo and normal rooms. Saved level/panel data and private-note
behavior are unchanged.
