# Debate Library visuals: style guide

Status: v1, 2026-11-20. Owner: Pattern Engine LLC. This guide is the source of truth for every picture in the Tabula Debate Library. Both people and image agents read it. `TEMPLATE.md` turns it into prompts. `KICKOFF.md` runs the image session.

## 1. Purpose

- A picture explains or reinforces **one** idea from its page. It helps a reader see the idea before or after reading it.
- A picture never carries information that the text does not. A reader who cannot see it misses nothing, because the page text and the alt text say it all.
- Pictures are **sparse**: 0 to 2 per page. A page with no picture is fine, and is listed with its reason in `exempt.json`.
- There are two kinds:
  - **Illustration:** a wordless picture or metaphor, made by an image agent from a prompt.
  - **Diagram:** an exact structure with labels (a DA chain with its four names, the speech order, flow columns). Diagrams are drawn later as code (SVG) with real text, never by an image model.

## 2. The look

Match the Tabula mark (`assets/tabula-mark-black.png`): a bold black clipboard with flow lines, a blue speech bubble on the left and a red one on the right.

- **Flat vector style.** Simple geometric shapes, flat fills, clean edges.
- **Thick, even, rounded black outlines** (ink `#16191d`), about the weight of the mark's clipboard outline at the picture's size. Rounded line ends and corners.
- **One clear subject**, centred or placed on a simple left-to-right line. Lots of white space. Nothing in the corners that pulls the eye.
- **Calm and friendly**, never jokey, cute or dramatic. It should look like it belongs next to a textbook page, not an ad.
- **Light greys** for secondary shapes: `#e1e4e8`, `#cfd4da`, `#7d8690`.

Never use:
- gradients, 3D, shadows, glow, bevels, glass, metal or paper textures;
- photo realism, sketchy or hand-drawn lines, watercolour, noise or grain;
- clip-art people, stock-art poses or busy scenes;
- decorative frills: confetti, sparkles, stars, swooshes, ribbons, badges, check-mark emoji, trophies (the Tabula "AI-slop check" in `PLAN.md` §1).

## 3. Colours and what they mean

| Colour | Hex | Use |
|---|---|---|
| Ink | `#16191d` | All outlines, main shapes |
| White | `#ffffff` | Background and inner fills |
| Light grey | `#e1e4e8`, `#cfd4da` | Secondary fills, ground lines |
| Mid grey | `#7d8690` | Muted or "past" parts |
| Aff blue | `#0055b8` | **Only** the affirmative side |
| Neg red | `#f2232d` | **Only** the negative side (fills and edges) |
| Neg red, text | `#c8161f` | Red **words** in diagrams only (`#f2232d` is too light for text) |

Rules:
- Blue and red mean **aff and neg**, as in the app. Use them only when the picture is about the two sides (for example, two speakers, two paths, a link and a turn). Never use blue or red as decoration.
- When the picture is not about sides, use ink, white and greys, with **at most one** accent, and that accent is blue or red only if the idea leans to one side.
- Never use orange, yellow, green or purple. (In the app, orange means errors and green means done.)
- Keep fills flat. No tints, no shading inside a shape.
- Sides are not values. Never give only one side the flaw, the crack or the smaller share in a way that says that side is worse. If a picture needs a flaw, make it grey, or give each side its own.
- Notes: the mark itself is drawn in pure black; library pictures use ink `#16191d`, which reads the same. `#cfd4da` is a library-only grey (not an app token).
- Diagrams (SVG) may use pale tints (`#eaf1fb` aff, `#fdecec` neg) behind ink text. Never white text on blue or red.

## 4. No text, ever

- No letters, words, numbers, maths signs, arrows with writing, labels or captions inside the picture.
- No shapes that look like writing: no scribbles on paper, no fake lines of text on screens, no "lorem" squiggles. Paper and cards may show **plain straight lines** like the mark's flow lines.
- No logos, watermarks, signatures or brand marks, including the Tabula mark. The mark is a **style reference only**.
- Words belong in the page: in the caption (`caption`) and alt text (`alt`), which the builder adds as real HTML.

## 5. People

- Use people only when the idea needs them (a judge, two debaters, a room).
- Draw simple, faceless, non-realistic figures: round head, simple body, the same thick outline style. Mixed, neutral skin tones in flat greys are fine. No faces, hair detail or clothing logos.
- Never draw realistic children or students, and never draw real or famous people.
- Figures stand for roles (judge, aff speaker, neg speaker), never for a type of person. Keep them neutral: no gender cues needed.

## 6. Format

| Use | Aspect | Size | Where |
|---|---|---|---|
| Main picture on a page | 3:2 landscape | 1536×1024 | After the Plain version or the main "parts" heading |
| Small inline picture | 1:1 square | 1024×1024 | Inside a deeper section |

- **Background: plain white `#ffffff`**, edge to edge. No frame, border or vignette. The page puts each picture on a white card, so it looks the same in light and dark mode.
- Keep a clear margin (about 8% of the width) around the subject.
- Save as PNG. The file name is the slot's `file` path.

## 7. Recurring metaphors (keep them consistent)

Use the same picture language for the same idea across pages:

| Idea | Picture language |
|---|---|
| A flow, notes | A clipboard or sheet with plain straight lines, in columns, like the mark |
| Aff vs neg | A blue shape on the left, a red shape on the right (as in the mark) |
| A chain of reasons (DA, advantage) | Linked rings or dominoes in a row, left to right |
| A limit or boundary (topicality) | A fenced field or a drawn boundary line |
| Choosing between paths (CP, perm) | Roads or paths that split or merge |
| Weighing | A simple two-pan balance scale |
| A lens on ideas (kritik) | A pair of glasses or a lens over a scene |
| Rules of the game (theory, framework) | A game board, a referee's whistle, or a rulebook shown as a plain closed book |
| Time | A plain clock face with no numbers, or an hourglass |
| The judge's decision | A ballot shown as a plain card with lines, or a judge figure at a desk |

## 8. Do and don't

Do:
- One idea, one subject, one glance.
- Show change from left to right (before → after, cause → effect).
- Leave space. If in doubt, take a shape out.

Don't:
- Put two ideas in one picture.
- Draw a literal courtroom, gavel or legal scales for debate (it is not a court). Use the balance scale only for weighing.
- Use red for "bad" and blue for "good". They are sides, not values.
- Add text "just as a label".

## 9. Reference images

Attach these to every image request:
1. `assets/tabula-mark-black.png`: line weight, shapes and colours.
2. After the owner approves Phase A of `KICKOFF.md`: the anchor set in `docs/library/images/_anchors/`.
