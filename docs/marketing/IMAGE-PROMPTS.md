# Marketing images: prompts for ChatGPT (draft 1, 2026-11-20)

Status: none of these images exist yet. The pages work without them. `build.mjs` copies `sites/<site>/img/` when the folder exists (Markdown notes are skipped).

These prompts make the illustrations for the three marketing sites. Paste one prompt into ChatGPT image generation. Save the result with the file name given. Put it in the site's image folder in the site repo.

The look matches the Debate Library pictures ([`docs/library/visuals/STYLE.md`](../library/visuals/STYLE.md)). Read §2 to §5 there first. This file adds only what is new for marketing.

## 1. What is a picture, and what is not

| Kind | Who makes it | Example |
|---|---|---|
| **Product picture** | Code (HTML in `shared/pictures.css`), later a real screenshot | The flow sheet, clock, ballot, rank board |
| **Diagram** | Code (inline SVG with real text) | "How AI works" on the debate home page |
| **Illustration** | ChatGPT, from the prompts below | A judge at a desk, a speaker at a lectern |

- Never let an image model draw the app, words or numbers. It gets them wrong. The app is shown by code or by real screenshots.
- An illustration supports one idea. The page text says everything. The alt text describes the picture.

## 2. Shared style block

Paste this block at the start of every prompt.

```
Flat vector illustration. Thick, even, rounded black outlines (#16191d). Flat fills, no gradients, no shadows, no texture, no 3D. White background (#ffffff). Light greys #e1e4e8 and #cfd4da for secondary shapes, mid grey #7d8690 for muted parts. Lots of white space, one clear subject, calm and friendly, like a modern textbook. No text, no letters, no numbers, no logos, no writing on paper or screens (plain straight lines only). No confetti, sparkles, stars, trophies or badges. People are simple and friendly, with no facial detail beyond simple shapes, varied in age and skin tone.
```

## 3. Colour rules per site

| Site | Allowed accent | Rule |
|---|---|---|
| Tabula Speech (parent) | Black and white only. Optional small calls: one blue `#0055b8`, one red `#f2232d`, one sage green `#4f6f58` | Calls are small (a speech bubble, a dot). Never a big fill. Never one colour alone as decoration. |
| Tabula Debate | Blue `#0055b8` and red `#f2232d` | Only when the picture shows two sides (Aff blue, Neg red). Otherwise ink and greys only. |
| Tabula Speech Events | Sage deep `#4f6f58` and sage light `#93b39a` | Two tints of one green. No red or blue. |

Never use orange, yellow or purple (orange means errors in the app).

## 4. Prompts

Each slot names the file, the size, the page and the alt text. Ask for a landscape image at the given ratio, then crop to size.

### S1. Parent hero art (optional, behind or beside the hero)
- File: `sites/speech/img/family.png` · 1600 × 1000 (16:10)
- Page: tabulaspeech.com home, hero (if the owner wants art instead of the product pictures)
- Alt: "A judge's clipboard with three small speech bubbles: blue, red and green."
- Prompt: *[style block]* A large bold black clipboard with plain horizontal lines on its paper, centred. Three small speech bubbles float above its top edge: one blue (#0055b8) on the left, one sage green (#4f6f58) in the middle, one red (#f2232d) on the right. Each bubble is outlined in black. Wide white space around it.

### S2. Parent "one account" art
- File: `sites/speech/img/one-account.png` · 1200 × 900 (4:3)
- Page: tabulaspeech.com home, "Sign in once" section
- Alt: "One key on a ring that opens two doors."
- Prompt: *[style block]* One simple black key on a ring, in the centre. On the left a door with a small blue-and-red pair of dots above it; on the right a door with two small sage green dots above it. Both doors stand slightly open. Ink and greys, with the dots as the only colour.

### D1. Parent judge, first round
- File: `sites/debate/img/first-judge.png` · 1200 × 900 (4:3)
- Page: tabuladebate.com home, Library section; coaches page
- Alt: "A parent judge at a classroom desk with a laptop, two debaters standing at the front."
- Prompt: *[style block]* A classroom seen from the side. A parent judge sits at a desk with an open laptop (screen shows plain grey lines only) and a pen. At the front, two student debaters stand at two small lecterns: the left one wears a blue (#0055b8) top, the right one a red (#f2232d) top. Calm, simple, no clutter.

### D2. Flowing by keyboard
- File: `sites/debate/img/keyboard.png` · 1200 × 900 (4:3)
- Page: tabuladebate.com, "Built for the keyboard" (optional, next to the clock picture)
- Alt: "Two hands typing on a laptop keyboard, with a stopwatch beside it."
- Prompt: *[style block]* Close view of two hands typing on a laptop keyboard, seen from above at an angle. A simple round stopwatch sits beside the laptop. Ink, white and greys only.

### D3. Coaches: one link to many judges
- File: `sites/debate/img/coach-link.png` · 1200 × 900 (4:3)
- Page: tabuladebate.com/coaches
- Alt: "A coach hands one sheet to a row of parent judges."
- Prompt: *[style block]* A coach on the left holds out one sheet of paper (plain lines only). Three adult volunteers stand in a row on the right, each reaching for a copy. Ink, white and greys only. Friendly, not corporate.

### D4. School IT: a safe Chromebook
- File: `sites/debate/img/school-it.png` · 1200 × 900 (4:3)
- Page: tabuladebate.com/school-it
- Alt: "A closed laptop with a simple shield shape on its lid."
- Prompt: *[style block]* A simple laptop, half open, on a desk. A plain shield shape, outlined in black and filled light grey, sits on the lid. Ink, white and greys only.

### E1. Speech Events hero art
- File: `sites/events/img/lectern.png` · 1600 × 1000 (16:10)
- Page: tabulaforensics.com home (optional, beside or instead of the rank board)
- Alt: "A student speaks at a lectern while a judge writes at a desk."
- Prompt: *[style block]* A student stands at a simple lectern on the left, one hand raised as they speak, wearing a sage green (#4f6f58) top. On the right a judge sits at a small desk with a pen and a sheet of paper (plain lines only). A small light sage (#93b39a) speech bubble shape floats near the student. No red, no blue.

### E2. Congress chamber
- File: `sites/events/img/congress.png` · 1200 × 900 (4:3)
- Page: tabulaforensics.com, "What it will do", Congress card
- Alt: "Rows of student desks facing a raised chair for the presiding officer."
- Prompt: *[style block]* A small chamber seen from the back: three curved rows of simple desks face a raised desk at the front where one student sits. Sage deep (#4f6f58) and sage light (#93b39a) as the only colours, on chairs. No text on anything.

## 5. After you generate

1. Check each picture against STYLE.md §2 to §5 and the colour table above. Reject any picture with letters, numbers or logos.
2. Save as PNG, then the session converts it to WebP and adds `width`, `height` and `alt` in the page.
3. Keep the ChatGPT prompt and date in `sites/<site>/img/README.md`, so the picture can be made again.

## 6. Real app screenshots

Real screenshots are better than any drawing for the product itself. The plan:

- Take them after Slice 4 lands, in light and dark, at 1440 px wide, with an invented round (no real student names).
- A demo round file in the app repo would make this repeatable. That is a follow-up for the app session.
- Until then, the HTML product pictures copy the real layout (tabs, speech list, flow columns, clock bar).
