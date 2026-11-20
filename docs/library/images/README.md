# Debate Library images

Illustration files for the library live here, named by slot: `images/<slot id>.png`. The slot list is in `../visuals/slots/*.json`, the style guide in `../visuals/STYLE.md`, and the image session prompt in `../visuals/KICKOFF.md`.

- `_anchors/`: the 4 approved style anchors from Phase A of the image session. Every later image uses them as references.
- Each slot's status lives in `../visuals/status.json`. Only `approved` pictures will appear on library pages, once the builder step lands (it waits for the UI restyle).
- `diagram` slots (`.svg`) are drawn later as code from each slot's `diagram_spec`.
- Check a session's work with `node docs/library/visuals/check-session.mjs`.
- License: CC BY-SA 4.0, like the library text (see `../LICENSE.md`).
