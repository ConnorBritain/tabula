# Policy Judge

A local judging tool for high school policy (CX) debate. NSDA 8-3-5 format with 8 minutes of prep.

## Start it

```bash
node bridge.mjs   # run this in the Tabula folder
```

Then open http://localhost:8765 in Chrome. (The bridge serves the app and lets it use a Claude or ChatGPT subscription. A plain `python3 -m http.server 8765` also works, without subscriptions.)

## AI: keys or subscriptions

On first open, a welcome screen offers three paths: connect an AI key, use a subscription, or skip and just flow.

| Provider | AI tools (flow, Live Eval, analysis, decision, ballot) | Transcription | Get a key |
|---|---|---|---|
| Google Gemini | yes | yes | https://aistudio.google.com/apikey (turn on billing: free-tier data may be used by Google) |
| OpenAI | yes | yes | https://platform.openai.com/api-keys |
| Anthropic Claude | yes | no (uses browser transcription) | https://console.anthropic.com/settings/keys |
| xAI Grok | yes (text docs only, not PDFs) | yes | https://console.x.ai |
| OpenRouter | yes (text docs only, not PDFs) | no | https://openrouter.ai/keys |
| Claude subscription (via Claude Code) | yes, through `node bridge.mjs` | no | sign in with `claude` |
| ChatGPT subscription (via Codex) | yes, through `node bridge.mjs` | no | sign in with `codex` |
| Browser (Chrome) | — | yes, free | nothing to set up |

Paste any key into **AI + Keys → Connect AI**. The app recognizes the provider, tests the key, and picks a model from the provider's live model list.

## Tabs

- **Setup**: round info, reading level (Expert or Plain), round documents, prep length.
- **Timer + Transcript**: speech and prep clocks, gap-free transcription while the clock runs.
- **Flow**: your flow, and an AI flow with Brief / Standard / Detailed levels. Edit any AI cell: your edit sticks, and you can choose "Use AI" or "Keep mine" when the AI has something newer.
- **Live Eval**: leaning, key issues, what to listen for, feedback so far.
- **Analysis**: Paradigm Lens (with your pasted Tabroom paradigm), Impact Calculus, Round Map (a flow sheet you can edit and draw by hand; AI redraws keep your work).
- **AI + Keys**: connections, settings, decision draft.
- **Ballot**: AI ballot filler (never overwrites fields you typed; "Tell the AI" box), points, ranks, RFD, Tabroom comment boxes.
- **History**: saved ballots, copy for Google Sheets.

Data stays in this browser. AI calls go to the provider you chose.

## Tests

```bash
node --test   # run this in the Tabula folder
```

## License

Tabula is free software under the GNU Affero General Public License v3.0 (AGPL-3.0). See [LICENSE](LICENSE).
Build the Debate Library pages with `node build-learn.mjs` (Markdown in `docs/library/` becomes HTML in `learn/`).
The Debate Library text in `docs/library/` is licensed separately under CC BY-SA 4.0 (see [docs/library/LICENSE.md](docs/library/LICENSE.md)).
Copyright © 2026 Pattern Engine LLC. Inter Tight font: SIL Open Font License (see assets/fonts/LICENSE.txt).
