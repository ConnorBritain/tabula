# AI controls across Tabula

The star identifies an AI feature or action. The mark never grants access or changes policy. Activating an action button can start its request, as described below.

## Debate

- The ballot uses the square lock/star control for permission to edit a field. Typing protects the field.
- The help marker beside Draft with AI explains the two states. The existing tooltip system waits 500 ms on hover and supports keyboard and touch.
- AI Flow has a star beside its name. An edited AI cell has a labeled lock. Use AI and Keep mine keep their existing behavior.
- Live Eval and Analysis have stars on their Run/Update actions. Automatic updates remain checkboxes. AI results have no field-protection switches.

## Speech Events

- Edit with AI uses the same white star shape with dark/light green gradient accents.
- The button remains absent when AI is unavailable or when there is no comment.
- Suggestions stay in review. Use this is required before a comment changes. Keep mine and Undo remain available.
- The existing private-note lock keeps its Just for you / never on the ballot label. It does not mean AI permission.

## Programs review

Reviewed the school console in the tabula-sites repository: `shared/console.js`, `shared/console-students.js`, and `sites/my/pages/schools.html`.

Programs currently controls AI policy rather than offering an AI drafting action. Its settings use role checks, explicit choices, and Save. Student settings may remain unpicked, and read-only roles do not get editing controls.

No new AI action or field-protection switch is added to Programs. A future AI action may use a shared star, but it must retain the existing role checks, student policy, and explicit review. The icon must never enable access or send student data by itself.

## Shared implementation

`core/ai-mark.js` owns the shapes. `core/ai-mark.css` owns their layout and high-contrast fallback. `core/tokens.css` owns the palettes. Neither app imports the other app's page code or side colors.

## Contextual editing

Speech Events uses the text-selection pattern in Gamma's inline editor. Reference: https://mobbin.com/screens/9c722748-1af1-4cab-a352-c8706aad29d2 . The interaction follows the reference; Tabula keeps its own green star, typography, spacing and theme.

A comment reveals a compact star and chevron on hover or keyboard focus. Touch and narrow layouts keep them visible. The star requests the saved default edit immediately. It does not open a setup panel or require a Preview click. An initial key connection is requested only if no key is connected. Opening More sends nothing: it reveals one custom request field and quick edits. Each quick edit starts its request directly; Apply sends a custom request.

Highlighting public feedback opens a small floating toolbar above the selection. The primary action uses the saved default; its chevron opens the same quick-edit menu for that excerpt. Selection works in the read-only comment and its edit textarea. It excludes private notes, other text fields, and selections spanning comments. Opening the floating controls preserves the captured target while the request field has focus.

Only the selected excerpt goes to the AI. Range offsets are validated against the exact saved source; invalid or stale ranges never fall back to sending the full comment. The app reconstructs the full comment locally and preserves all text outside the range, including its whitespace. Source edits invalidate pending work and stale suggestions cannot overwrite newer text.

A suggestion shows Original and Suggested comparison tabs, a word diff, Use this and Keep mine. Nothing changes until acceptance. Undo restores the original comment and copy status, provided no later edit changed the result. Escape returns focus to the star. Outside clicks and navigation dismiss the editor, abort pending work and discard late replies. The floating layer is separate from the cards, so it does not replace the user's textarea while they select or type. It clamps inside the viewport and scrolls when needed.

Clarify and Fix spelling retain their published v1 templates. Shorten, Write full sentences and Custom request use v2 wording rules. Preferences and custom requests cannot add observations, advice, praise, faults, evidence, scores or comparisons between students.

## Saved preferences

General AI configuration lives in Settings only. Debate no longer shows a Round writing or preference panel. Historical round preferences and reading-level overrides are ignored. Device defaults and per-tool choices apply across rounds. A tool can inherit the saved defaults, use its own custom preferences, or use standard task instructions only.

Debate's AI Flow receives response style only. Live Eval, Analysis and Ballot can also receive judging guidance within the chosen paradigm. Tool choices follow school policy. Neither preference can override task rules, supplied evidence or policy. Own-key and local-helper requests add bounded preference data before the existing name scrub. Hosted requests use the existing state.notes field and server-owned prompts.

Speech Events Settings holds the default edit operation, an optional saved custom wording request, and feedback style. The primary star uses these settings for whole-comment and selection edits. It never renders or sends judging guidance. All preference and request fields are capped at 1,000 characters. Preferences are hidden when the corresponding tool is removed by policy, including when key setup is separately allowed.

Known names, codes, titles and authors are scrubbed from selected text, custom requests and saved style. Other private details cannot be reliably removed. Settings explains this and asks users to keep names and private details out of preferences.

Preferences use the existing app settings storage and backup/restore paths. They contain no AI keys. Speech Events continues to use its existing own-key path; this change adds no hosted access. Programs has no new drafting feature or student-data access.
# Speech Events room review (2026-11-25)

Review has one compact green-star **Compare the room** action. It opens an in-flow review, with **Suggest an order** inside. There is no insertion, acceptance, copy-to-ballot or rank-writing action. The judge changes final ranks on Rank. Closing or leaving discards the review.

This is a separate task from feedback editing. It uses the `analysis` gate and the existing own-key setup gate at the UI and request boundaries. It adds no hosted task, new provider path, Programs access or student edition access. General feedback editing still cannot judge or rank.

The request contains only finished speakers' original public notes (a human public comment is a fallback), neutral speaker tags, event prompts/rubric labels, saved judging priorities and response style. AI-rewritten comments are never fresh evidence. Existing ranks, ratings, private notes, rule allegations, names/codes/titles/authors and room identifiers are not sent. Known identity values are swapped with the existing scrubber. Unknown personal details in public notes or priorities can still reach the provider; Settings and the review help disclose this.

Judging priorities live in Settings under the collapsed **Room comparison** section. Event criteria take priority. Feedback wording preferences never change judging criteria. Only tournament-permitted use is appropriate.

Every comparative point requires exact quotes from at least two supplied speakers. Quote references are validated against the sent notes; unknown speakers, fabricated quotes, incomplete/duplicate orderings, unsolicited orders and a first place barred by the recorded overtime rule are rejected. The review exposes each quote and the full original public notes. These checks validate references; the judge must still assess the reasoning.

Missing or unfinished speakers appear as coverage gaps. Suggested order requires every present speaker finished with public notes, and a rank-enabled profile. No-shows are excluded. The model can decline an order when notes do not support it. It must not reward note volume, infer identity or invent observations, scores or certainty. Changed source notes, criteria, priorities or eligibility invalidate a waiting or displayed review. Closing, navigation and Escape cancel work and discard late replies. Results are transient and never enter exports or ballot copy.
