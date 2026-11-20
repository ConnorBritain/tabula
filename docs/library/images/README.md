# Debate Library images

Small web copies of the library pictures live here, named by slot: `images/<slot id>.webp` (made by `../visuals/process-image.mjs`). Full-size originals are archived outside the repo, in the folder set in `../visuals/local.json` (git-ignored). The slot list is in `../visuals/slots/*.json`, the style guide in `../visuals/STYLE.md`, and the image session prompt in `../visuals/KICKOFF.md`.

- `_anchors/`: the style anchors from Phase A of the image session (web copies). Every later image uses them as references.
- Each slot's status lives in `../visuals/status.json`. Only `approved` pictures appear on library pages: `node build-learn.mjs` copies them to `learn/img/` and places them on their pages.
- `diagram` slots (`.svg`) are drawn later as code from each slot's `diagram_spec`.
- Check a session's work with `node docs/library/visuals/check-session.mjs`.
- License: CC BY-SA 4.0, like the library text (see `../LICENSE.md`).
