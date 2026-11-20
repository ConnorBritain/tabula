# Debate Library visuals: prompt template

Every illustration prompt has the same six parts, in this order. Parts 1, 5 (first half) and 6 are fixed. **Do not assemble prompts by hand:** run `node docs/library/visuals/build-prompt.mjs <slot id>`, which reads the template block below and fills it from the slot. This block is the single source. Parts 2 to 4 come from the slot in `slots/*.json` (`subject`, `composition`, `colors`, `avoid`, `format`). Do not add, drop or reorder parts. Do not add style words beyond part 1.

## The template

```
[1 STYLE]
Flat vector illustration in the style of the attached reference mark: thick, even,
rounded black outlines (#16191d), flat fills, simple geometric shapes, plain white
background (#ffffff), lots of white space, one clear subject. Calm, clean, textbook
style. Colours: ink #16191d, white, light greys #e1e4e8 and #cfd4da, mid grey #7d8690,
plus only the accents named below.

[2 SUBJECT]
{slot.subject}

[3 COMPOSITION]
{slot.composition} Keep a clear margin of about 8% around the subject.

[4 COLOUR ROLES]
{slot.colors}{side_rule}

[5 AVOID]
No text of any kind: no letters, words, numbers, labels, captions, symbols that look
like writing, or fake lines of text. No logos, watermarks or signatures. No gradients,
shadows, 3D, glow, textures, photo realism, sketchy lines, confetti, sparkles, stars,
badges, trophies, emoji or check marks. No faces; no realistic children; no real people.
No orange, yellow, green or purple. {slot.avoid}

[6 OUTPUT]
{output}
```

`{output}` depends on the slot's `format` (STYLE.md §6):
- `hero`: 3:2 (1536×1024), with every shape inside the middle band, because the picture is cropped to a 2:1 banner.
- `inline`: 3:2 (1536×1024).
- `spot`: 1:1 (1024×1024), one compact object with a wide margin, because it is shown small.

`{side_rule}` is added only when the slot's `colors` names aff blue or neg red: " Blue #0055b8 means the affirmative side and red #f2232d means the negative side; use them only as stated here, never as decoration." For a slot with no blue or red it is empty, so the prompt does not invite stray colour.

Attach as references: `assets/tabula-mark-black.png`, and the approved anchors in `docs/library/images/_anchors/` once they exist.

## Worked example

Slot (from `slots/disadvantages.json`):

```json
{
  "id": "disadvantages-chain",
  "subject": "A horizontal chain of four large linked rings, like a simple bicycle chain made of round links. The third ring is cracked open, so the chain is about to come apart there.",
  "composition": "The chain runs left to right across the middle of the frame, slightly rising toward the right. The cracked ring sits a little right of centre. Nothing else is in the picture.",
  "colors": "The rings are white with black outlines. The crack is a short gap edged in mid grey #7d8690. No blue or red.",
  "avoid": "No hands, tools or broken pieces flying away.",
  "format": "hero"
}
```

The full prompt, as printed by `node docs/library/visuals/build-prompt.mjs disadvantages-chain`:

```
Flat vector illustration in the style of the attached reference mark: thick, even, rounded black outlines (#16191d), flat fills, simple geometric shapes, plain white background (#ffffff), lots of white space, one clear subject. Calm, clean, textbook style. Colours: ink #16191d, white, light greys #e1e4e8 and #cfd4da, mid grey #7d8690, plus only the accents named below.

A horizontal chain of four large linked rings, like a simple bicycle chain made of round links. The third ring is cracked open, so the chain is about to come apart there.

The chain runs left to right across the middle of the frame, slightly rising toward the right. The cracked ring sits a little right of centre. Nothing else is in the picture. Keep a clear margin of about 8% around the subject.

The rings are white with black outlines. The crack is a short gap edged in mid grey #7d8690. No blue or red.

No text of any kind: no letters, words, numbers, labels, captions, symbols that look like writing, or fake lines of text. No logos, watermarks or signatures. No gradients, shadows, 3D, glow, textures, photo realism, sketchy lines, confetti, sparkles, stars, badges, trophies, emoji or check marks. No faces; no realistic children; no real people. No orange, yellow, green or purple. No hands, tools or broken pieces flying away.

3:2 image (1536×1024), plain white background, PNG.
```

Why no blue or red here: the picture is about how any chain of reasons breaks, not about one side. Blue and red mean aff and neg, so use them only when the picture is truly about the two sides. When a colour's side is not clear, use ink or grey. (Slot writers: say the side meaning in `colors`, or write "No blue or red.")

## Slot fields (for slot writers)

| Field | Kind | Rule |
|---|---|---|
| `id` | both | `<page>-<short-name>`, lowercase, unique across all slot files |
| `page` | both | A slug that exists in `docs/library/` |
| `kind` | both | `illustration` or `diagram` |
| `after_heading` | both | The exact text of a `##` or `###` heading on that page (without the `#`), or the special value `Plain version`, which places the picture right after the page's Plain version box (that box is not a heading) |
| `priority` | both | 1 (new-judge track and main concept pages), 2 (deeper pages), 3 (examples) |
| `format` | both | `hero` (wide banner after the Plain version box), `inline` (3:2 picture in a section), `spot` (small square with no card) or `diagram` (SVG drawn as code). See STYLE.md §6 |
| `purpose` | both | One sentence: what the reader should understand from it |
| `subject` | illustration | One concrete scene or metaphor, described in plain words, with no text in it |
| `composition` | illustration | Where things sit; left-to-right order; what is left out |
| `colors` | illustration | Which shapes are blue (aff), red (neg), ink, grey; or "No blue or red." |
| `avoid` | illustration | Slot-specific things to leave out (can be "") |
| `diagram_spec` | diagram | What the SVG shows: boxes, labels (real words), arrows, order. Words here are fine, because a diagram is drawn as code |
| `alt` | both | 20-200 characters. Describes what the picture shows and why it matters on this page |
| `caption` | both | One short sentence shown under the picture, or "" |
| `file` | both | `images/<id>.webp` (illustration: the web copy made by `process-image.mjs`) or `images/<id>.svg` (diagram) |

Status is **not** a slot field. It lives in `status.json` (one entry per slot id: `todo`, `draft`, `skipped` or `approved`, plus a `note`), so the image session writes to one file only and never touches the prompt text. A page that should have no picture is listed, with its reason, in `exempt.json`.
