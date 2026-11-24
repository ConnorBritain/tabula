# Legal update 9, draft 1: make the Privacy Policy match the code

2026-11-23. Draft for the owner and the lawyer. Not live.

Source: a code audit by the Programs legal chat (`private/programs/legal/security/CLAIMS-AUDIT.md`, rows 5 and 8). The legal chat checked it against the code on 2026-11-23:
- No Turnstile code is in tabula-sites, tabula-cloud or debate. Sign-in is protected by rate limits (5 requests a minute per IP address, 5 emails per address per hour, 5 code guesses).
- The tabula-cloud server calls only OpenAI and Anthropic for Hosted AI, through Cloudflare AI Gateway. It does not call Google (Gemini), xAI, Groq or Workers AI.
- Google (Gemini), xAI, OpenRouter, OpenAI and Anthropic are reached from the browser only with Your Own Key. Privacy §6 already says these requests go straight from the browser to the provider and do not pass through our servers.

The fixes only remove claims or make them narrower. They add no new use of data.

## Publish gate

1. ~~The owner picks.~~ **Done 2026-11-23:** fix the text (owner, lead chat: "Yes to all, A on both picks"). Turnstile may be built later by the security session; then add a true Turnstile line back.
2. The lawyer sees it (FYI; accuracy only).
3. The owner types yes in the marketing chat.
4. Use the live text as the "Before" on the publish day. If update 4 or 5B goes live first, start from that text.

## Privacy Policy (`sites/speech/pages/privacy.html`)

**A1. Cookies and similar tools (replace one item)**
- Before: "Our sign-in forms use Cloudflare Turnstile to block automated abuse. Turnstile checks the browser for signs of a bot. It does not track you across sites."
- After: "We limit how often sign-in can be tried, to block automated abuse. These limits use your IP address and email address and set no cookies."

**A2. §10, Cloudflare row (replace the Purpose cell)**
- Before: "Hosting, database, email routing, bot protection (Turnstile), Hosted AI processing (Workers AI)"
- After: "Hosting, database, email routing, and routing of Hosted AI requests to the AI providers below (AI Gateway)"
- Data cell: add "content of Hosted AI requests (speaker labels, not names)".

**A3. §10, remove three rows:** Google (Gemini), xAI and Groq. Add after the table: "Providers that you reach with Your Own Key (Section 6) are not our subprocessors. Your requests go to them directly, under their terms."

**A4. §10, Resend row:** the approved L12 change ("Email delivery (sign-in, receipts, reminders and setup emails)"; data "Email address, email content"), unless update 4 or 5B already made it.

**A5. Name fix (L13):** "the Plans page" becomes "the Pricing page (tabulaspeech.com/pricing/)" in the Terms (§6.1 twice, "Payment") and the Refund Policy (§4). The link text "Plans" becomes "Pricing". The URL moved to /pricing/ (tabula-sites PR 21). After this, the owner may rename the page title "Plans and pricing" (a test in pricing.test.mjs pins it).

## Rules for later

- Before any server path to Google (Gemini) or xAI: the Gemini Developer API terms bar apps likely used by people under 18, and xAI needs zero data retention before any personal data. Never send school data to them. Add a provider to §10 before the server uses it.
- `LEGAL-FACTS.md` rows "Sign-in" and "Subprocessors" change on the publish day.

## For the lawyer

- Accuracy only: we remove a Turnstile claim and three AI providers that our servers do not use. Own-key providers stay covered by §6 and are named as not our subprocessors. Please confirm.
