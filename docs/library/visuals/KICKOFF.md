# Debate Library visuals: kickoff prompt for the image session

This file holds the prompt that starts a long-running image session in the **Codex desktop app** (it can read and write this repo) or the **ChatGPT desktop app** (you upload files and save images by hand). The session uses the app's own built-in image tool. It does not use the Images API.

How to use it:
1. Open a new Codex session on this repo (or a ChatGPT chat).
2. Paste the prompt in the matching box below.
3. After Phase A, look at the 4 anchor images. Approve them (or ask for changes) in the same chat.
4. Let Phase B run. Check each batch report. Come back any time: the session resumes from the slot statuses.
5. After each batch, run `node docs/library/visuals/check-session.mjs`. It checks that the session changed only images and `status.json`, and that every draft has a valid image.
6. To publish a picture, change its entry in `docs/library/visuals/status.json` from `draft` to `approved` yourself, then run `node build-learn.mjs`. Only approved pictures show on library pages.

Before the first session, commit the library, so the checker can see what the session changed.

---

## Prompt for Codex (repo access)

```text
You are the image maker for the Tabula Debate Library, a free set of plain-language guides
to high school policy debate, in this repo. Your job: make the planned illustrations, one
per slot, consistent with the Tabula brand, using your built-in image generation tool.
Work in batches and keep going across many turns until every illustration slot is done.

READ FIRST, fully, before you make anything:
1. docs/library/visuals/STYLE.md   - the visual brand guide. It is the law for every image.
2. docs/library/visuals/TEMPLATE.md - the exact prompt template and a worked example.
3. docs/library/visuals/slots/*.json - every planned picture ("slots"), and
   docs/library/visuals/status.json - the ledger: each slot's status (todo, draft, skipped,
   approved) and a note. This is the ONLY data file you may edit.
4. assets/tabula-mark-black.png    - the Tabula mark. Use it as a STYLE REFERENCE for line
   weight, shapes and the blue/red colours. Never draw it into a picture.
5. For the brand feel, also look at: assets/tokens.css (colour names and values) and
   about.html. (The public website's homepage is not built yet, so do not use the web for
   brand cues. The built learn/ pages are being restyled, so do not rely on them.)

WHAT TO MAKE:
- Only slots with "kind": "illustration" whose status in status.json is "todo". Skip
  "diagram" slots: those are drawn later as code. Skip every other status: this is how you
  resume across sessions.
- Get each prompt by running: node docs/library/visuals/build-prompt.mjs <slot id>
  (or --all to list every remaining one). Use the printed prompt exactly, word for word.
  Do not write prompts by hand, add style words, or drop parts.
- Attach the mark (and, after Phase A is approved, the anchors) as reference images on every
  generation.
- Read the slot's page (docs/library/<page>.md) around its "after_heading" so the picture
  fits what the reader is learning there.

PHASE A - ANCHORS (do this first, then STOP):
- Skip Phase A if docs/library/images/_anchors/ already holds .webp images or any slot in
  status.json is "draft": the anchors were made in an earlier session (ask me if they are approved).
- Pick 4 illustration slots that are as different as possible (for example: one with people,
  one about aff vs neg with blue and red, one object metaphor with no side colours, and one
  square 1:1 inline picture).
- Make each one, run process-image.mjs on it (see Phase B), and copy the web copy to
  docs/library/images/_anchors/<slot id>.webp.
- Show me the 4 images with their slot ids and the exact prompts you used.
- STOP and wait. Do not start Phase B until I say the anchors are approved. If I ask for
  changes, remake them and stop again.
- When I approve them: set each anchor's slot to "draft" in status.json, so Phase B does not
  make it again (process-image.mjs already saved its web copy).

PHASE B - THE LOOP (after I approve the anchors):
- Work in priority order (priority 1 first), about 8 slots per batch.
- For each slot: build the prompt, generate, look at the result, and check it against
  STYLE.md: wordless (no letters, numbers or writing-like marks), flat style, thick rounded
  black outlines, white background, only the allowed colours, blue/red only as the slot's
  "colors" says, no faces or real people, one clear subject that matches the slot's
  "purpose". If it fails, regenerate (up to 3 tries). If it still fails, set its status to
  "skipped" in status.json with a note saying why, and move on.
- Save the generated file anywhere outside the repo, then run:
  node docs/library/visuals/process-image.mjs <slot id> <path to the generated file>
  It archives the full-size original in the archive folder set in docs/library/visuals/local.json
  (on the big drive; the script stops if the drive is not mounted) and saves the small web copy at docs/library/<slot "file"> (for example
  docs/library/images/disadvantages-chain.webp), cropped and sized for the slot's "format".
  Never put full-size originals in the repo.
- Then edit that slot's entry in status.json: set "status" to "draft" and "note" to a short
  note (for example "try 2; removed stray lines"). Change nothing else.
- After each batch: run node docs/library/visuals/check-session.mjs and fix anything it
  reports. View the whole batch next to the anchors. If any image breaks the set's
  look (heavier or thinner lines, a different colour feel, a busier scene), remake it. Then
  report: the slot ids done, any skipped and why, and anything I should decide.
- Then continue with the next batch, without waiting, unless I said to pause.

HARD RULES:
- Only create files under docs/library/images/, and only edit docs/library/visuals/status.json.
  Touch nothing else: no slot files, pages, code, CSS or other docs.
- Never draw text, numbers, logos or watermarks. Never draw the Tabula mark.
- Never set a slot to "approved". Only the owner does that.
- Never change a slot file. If a slot's idea seems wrong or impossible to show without
  words, set it to "skipped" with a note, and explain in your report.
- Never use real people, realistic children, real countries, flags or famous places.
- Do not commit, push or open pull requests unless I ask.
```

---

## Prompt for ChatGPT (no repo access)

Upload these files first: `STYLE.md`, `TEMPLATE.md`, and `assets/tabula-mark-black.png`. Then, for each batch, paste the prompts printed by `node docs/library/visuals/build-prompt.mjs --all` (or one slot at a time). Then paste:

```text
You are the image maker for the Tabula Debate Library. I uploaded the visual brand guide
(STYLE.md), the prompt template (TEMPLATE.md), the planned pictures (slots JSON) and the
Tabula mark (a PNG to use as a style reference only, never drawn into a picture).

Read STYLE.md and TEMPLATE.md fully. Then:
- Phase A: pick 4 very different "illustration" slots, build each prompt exactly as
  TEMPLATE.md says, attach the mark as a reference, and generate them. Show each image with
  its slot id. Then STOP and wait for my approval.
- Phase B (after I approve): go through the prompts I paste, about 4 per turn, in the order
  given. Use each prompt exactly as written, generate it with the mark and the approved anchors as references, check
  it against STYLE.md (no text of any kind, flat style, only the allowed colours, white
  background), and regenerate if it fails. Show each image with its slot id and its "file"
  name, so I can save it under that name.
- Never draw text, numbers, logos or watermarks, or the Tabula mark. Skip "diagram" slots.
  If a slot cannot be shown without words, skip it and tell me why.
```

When you save a ChatGPT image, save the download anywhere outside the repo (the big drive is best), then run `node docs/library/visuals/process-image.mjs <slot id> <downloaded file>` to make the web copy, and set that slot's entry in `status.json` to `draft`. (You may set it straight to `approved` if you have reviewed it: that is your call as the owner.) Then run `node docs/library/visuals/check-session.mjs`.

---

## After the session

- Review drafts on your computer, or ask Claude Code to show them in a contact sheet.
- Approve by setting `"status": "approved"` in `status.json`.
- Then run `node build-learn.mjs`: each approved picture appears on its page (after the Plain version box, or after the first paragraph under its heading), with its alt text and caption, on a white card that works in light and dark mode. The page's first approved picture also becomes its share image (`og:image`). If a page heading was renamed, the build stops and names the picture, so nothing disappears silently.
- `"kind": "diagram"` slots are drawn later as code (SVG) with real text. Ask Claude Code to draw them from each slot's `diagram_spec`.
