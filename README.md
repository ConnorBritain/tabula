# Tabula

Tabula holds two judging apps that run in the browser:

- **Tabula Debate**: a judging app for debate rounds.
- **Tabula Speech Events**: a judging app for speech events, in [`events/`](events/).

Repository: https://github.com/TabulaSpeech/tabula

## Tabula Debate

The app is `index.html`, with page code in `js/` and pure logic in `logic/`. It supports these formats (files in `formats/`):

- Policy (CX)
- Lincoln-Douglas (LD)
- Public Forum (PF)

Places in the app:

- **Flow**: your flow, an optional AI flow, speech and prep clocks, and transcription while the clock runs.
- **Round**: round info, AI writing style, round documents, prep length.
- **Decide**: Live Eval (leaning, key issues), Analysis (Paradigm Lens, Impact Calculus, Round Map), and Ballot (points, ranks, RFD, comment boxes). The AI ballot filler does not overwrite fields you typed unless you choose to.
- **History**: saved ballots, copy for a spreadsheet, download as CSV.
- **Settings** (gear button): AI connections and app settings.

The Debate Library is a set of static pages in `learn/`, built from Markdown in `docs/library/` by `node build-learn.mjs`.

## Tabula Speech Events

Speech Events is a separate app in `events/` (`events/index.html`). It does not load the Debate app code in `js/`, `logic/` or `formats/`. It shares `core/`, and the theme script and fonts in `assets/`.

- Events are data files in `events/defs/`: Original Oratory, Informative, United States Extemp, International Extemp, Dramatic Interp, Humorous Interp, Duo Interp, Program Oral Interp, Extemporaneous Commentary, Prose, Poetry, Expository, Impromptu, Storytelling, Original Spoken Word Poetry, Declamation, Mixed Extemp, and Pro Con Challenge. A Custom event form covers local events.
- Ballot rules (ranks, ratings) are profile files in `events/profiles/`.
- Screens: My day, History, Settings, timer, ranked ballot, comments, and Congress chambers.
- An optional "Clean up my comments" AI step uses the judge's own key.

## Run it on your computer

You need Node.js. In the repository folder:

```bash
node bridge.mjs
```

Then open http://localhost:8765 for Tabula Debate. The bridge listens only on 127.0.0.1. It serves the Debate app, lets it use a Claude or ChatGPT subscription (see below), and helps the SpeechDrop document import.

`bridge.mjs` does not serve `events/`. To run Speech Events, use any static file server from the repository folder, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/events/. (This server also runs the Debate app, but without subscriptions or SpeechDrop import.)

## AI: keys or subscriptions

AI is optional. You can flow and fill a ballot with no AI.

| Option | AI tools | Transcription |
|---|---|---|
| Google Gemini key | yes | yes |
| OpenAI key | yes | yes |
| Anthropic Claude key | yes | no |
| xAI Grok key | yes (text documents, not PDFs) | yes |
| OpenRouter key | yes (text documents, not PDFs) | no |
| Claude subscription (through Claude Code, with `node bridge.mjs`) | yes | no |
| ChatGPT subscription (through Codex, with `node bridge.mjs`) | yes | no |
| Browser speech recognition (Chrome) | no | yes, free |

Paste a key in **Settings → Connect AI**. The app finds the provider, tests the key, and picks a model from the provider's live model list. The key stays in this browser: for this tab only, unless you turn on "Remember this key" (then it is saved in this browser as plain text). With a key, AI calls go straight to the provider you chose. In the text it sends, the app puts roles (for example 1A, 2N) in place of debater names. PDFs and audio go to the provider as they are.

The hosted sites can also offer AI through a Tabula account. That server is not in this repository.

## Tests and gates

Run both from the repository folder:

```bash
node --test
node check-publish.mjs
```

`node --test` runs every test. `node check-publish.mjs` checks public pages for placeholders and remote scripts. It reads `learn/`. After you edit `docs/library/`, rebuild it with `node build-learn.mjs`.

## Deploy

The maintainers run the hosted sites. This repository has no deploy steps for contributors.

## Repository map

| Folder | What it holds |
|---|---|
| `.claude/` | Settings for AI coding tools used on this repository |
| `assets/` | Logos, fonts, theme script, and Debate app boot scripts |
| `core/` | Shared modules used by both apps (store, clock, ranks, points, AI providers, tokens) |
| `demo/` | Sample rounds for the Debate app demo |
| `docs/` | Project notes and Debate Library source text |
| `evals/` | Scripts that measure AI output quality (raw eval data is not committed) |
| `events/` | Tabula Speech Events: app, event files, ballot profiles, tests |
| `fixtures/` | Test fixtures |
| `formats/` | Debate format files (Policy, LD, PF) |
| `js/` | Debate app page code |
| `learn/` | Built Debate Library pages |
| `logic/` | Debate app pure logic (no DOM, no network) |
| `vendor/` | Self-hosted third-party libraries (see `vendor/README.md`) |

The Debate Library source text is in [`docs/library/`](docs/library/).

## Security

To report a security problem, read [SECURITY.md](SECURITY.md). Do not open a public issue for it.

## Contributing

Issues and ideas are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Tabula is free software under the GNU Affero General Public License v3.0 (AGPL-3.0). See [LICENSE](LICENSE).

The Debate Library text in `docs/library/` has its own license, CC BY-SA 4.0 (see [docs/library/LICENSE.md](docs/library/LICENSE.md)). Inter Tight font: SIL Open Font License (see `assets/fonts/LICENSE.txt`).

Copyright © 2026 Pattern Engine LLC.
