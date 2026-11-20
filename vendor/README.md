# Self-hosted libraries

Tabula serves these from its own site, so no script from another site runs next to judges' API keys
(see `_headers`). Downloaded on 2026-11-19. To update one, download the new version, update the
SHA-256 below and the file name in `app.js` and `bridge.mjs` (the tests read this table).
The SHA-256 values were taken from the downloaded files; they catch later changes, not a bad download.

| File | Source | License | SHA-256 |
|---|---|---|---|
| `mammoth-1.6.0.browser.min.js` | https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js | BSD-2-Clause | `596ef52239e52d8ee3cee10b2ee4a72596abf900d0e4f468593f956e9f1809b0` |
| `mermaid-10.9.1.min.js` | https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js | MIT | `61b335a46df05a7ce1c98378f60e5f3e77a7fb608a1056997e8a649304a936d6` |
| `anthropic-sdk-0.137.0.bundle.mjs` | https://esm.sh/@anthropic-ai/sdk@0.137.0/es2022/sdk.bundle.mjs (esm.sh bundle of @anthropic-ai/sdk 0.137.0) | MIT | `65f32f2cb97fc52dbd3f8fffe29fdb9ac990b705a3f8e236487d92c4a0fd198c` |
