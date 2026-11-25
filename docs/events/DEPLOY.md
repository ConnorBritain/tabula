# Speech Events: hosting and deploy

Speech Events is static files on Cloudflare Workers static assets. There is no server code and no server storage:
everything a judge enters stays on their own device.

| Host | What | Config |
|---|---|---|
| events.tabulaspeech.com | production | `wrangler.events.jsonc` (route on the tabulaspeech.com zone) |
| events.tabulaspeech.dev | staging, behind Cloudflare Access | `wrangler.events.jsonc`, `--env staging` (custom domain) |
| forensics.tabulaspeech.com | 301 to events.tabulaspeech.com, same path and query | Cloudflare Redirect Rule (below) |

## The build

`node build-events.mjs` copies an allowlist of files into `dist/events/`, with the page at the root of the host:
`events/<x>` goes to `/<x>`, `core/` stays `/core/`, and only `assets/theme-boot.js` and `assets/fonts/` ship from
`assets/`. The page's `../core/` and `../assets/` links resolve to `/core/` and `/assets/`, so no source file is
changed. The build stops if the page or the service worker (`sw-files.js`) needs a file that is not in the output.
`build-events.test.mjs` checks the output.

`events/_headers` holds the security headers (CSP, HSTS, nosniff, no referrer, microphone off, no framing) and
no-cache for the page, `sw.js` and `sw-files.js`.

## Deploy

No deploys from Thursday noon to Saturday night while tournaments run: judges are using the tool.

1. One time: make sure events.tabulaspeech.com has a proxied DNS record in the tabulaspeech.com zone (a placeholder
   such as `AAAA 100::`, proxied, is enough). The Worker route answers in front of it.
2. One time: create the Cloudflare Access application for events.tabulaspeech.dev (same policy as the debate staging
   site) before the first staging deploy.
3. Staging: `npx wrangler deploy -c wrangler.events.jsonc --env staging`
4. Smoke check staging, with an Access service token in the environment:
   `CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=... node events/smoke-host.mjs https://events.tabulaspeech.dev`
5. Production: `npx wrangler deploy -c wrangler.events.jsonc`
6. Smoke check production: `node events/smoke-host.mjs https://events.tabulaspeech.com` (this also checks the
   forensics redirect).

The build command in the config runs `node --test` and `node check-publish.mjs` first, so a red gate stops a deploy.

## The forensics redirect

forensics.tabulaspeech.com is not routed to the Worker (the static files would answer there instead of redirecting).
Set it up once in the Cloudflare dashboard, zone tabulaspeech.com:

1. DNS: a proxied record for `forensics` (a placeholder such as `AAAA 100::`, proxied).
2. Rules, Redirect Rules, create a rule:
   - When incoming requests match: custom filter expression `(http.host eq "forensics.tabulaspeech.com")`
   - Then: Dynamic, expression `concat("https://events.tabulaspeech.com", http.request.uri.path)`,
     status code 301, Preserve query string on.

## Why these asset settings

`html_handling` is `none` so `/index.html` is served as is. The default mode answers `/index.html` with a redirect
to `/`; the service worker caches the page under `index.html`, and a browser will not show a cached page that came
from a redirect. With `none`, `/` matches no file, so `not_found_handling: single-page-application` serves
`index.html` for it. The page uses `#/` links only, so the fallback for other paths does no harm. The smoke check
flags any listed file that comes back as the HTML page.
