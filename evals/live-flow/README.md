# Live-flow eval (draft for sign-off)

**Question:** which model gives a good enough live flow for the lowest cost?
**Output:** a Pareto chart. The x-axis is cost per round. The y-axis is flow quality. The models on the frontier are the only ones worth using.

## Inputs

- 21 cases from one real round: 7 speeches (1AC, 2AC, 2NC, 1NR, 1AR, 2NR, 2AR) × 3 points in each speech (35%, 70%, 100%). The app re-flows every 30 s, so the early, mid and final passes are all real calls.
- Each case is the exact prompt the app sends (`LIVE_FLOW_SYSTEM` + `buildLiveFlowPrompt` from `logic.js`), with the flow from earlier speeches as context.
- The 1NC is left out. It was flowed from the speech doc, and a backup does not hold docs.
- Names are replaced: debaters become 1A/2A/1N/2N, and teams, the tournament and the judge are replaced too. "Rob" and "Justin", heard in the room during the 2AR, become "someone". Card authors (Lawson, Rose, Toby) stay.
- The cases live in `evals/.data/live-flow/` (git-ignored, never published). Build them with:
  `node evals/live-flow/build-cases.mjs <backup.json> --scrub Rob,Justin`
- **Known limit:** one round, one topic. A model that is good on this round may be weaker on a round with very different arguments. Add 2 or 3 more rounds before you trust small gaps.

## Grading

**Gates (code, pass or fail).** A failed gate gives quality 0.
1. The reply is valid JSON that matches `LIVE_FLOW_SCHEMA`.
2. The reply was not cut off. Its output stays under the app's 6,000-token flow cap.

**Rubric (AI judge, 0–3 per item).** The judge sees the transcript, the flow so far, and the model's flow. It does not see which model wrote the flow.

| Item | 3 means | 0 means |
|---|---|---|
| **Coverage** | Every argument and card in the transcript so far is on the flow. | Most arguments are missing. |
| **Faithful** (counts double) | Nothing is invented. Authors, years and numbers match what was said. Unclear parts are marked "??". | An argument, card or number is invented. |
| **Placement** | Each argument is on the right sheet (Case, or a named off-case sheet). Answers line up with what they answer. Existing sheet names are reused exactly. | Arguments are on the wrong sheets, or duplicate sheets are made. |
| **Judge-ready** | Flow shorthand, numbered lines. Brief is truly brief, and Detailed has warrants. All 3 levels cover the same arguments. | Prose paragraphs, or the levels do not match. |

**Quality** = (Coverage + 2 × Faithful + Placement + Judge-ready) ÷ 15 × 100.

**Judge:** Claude Sonnet 5.5 grades every output. GPT-6.2 Sol, from another company, re-grades 1 in 5 outputs. The report shows how often the two judges agree, to check that the main judge does not favor Claude models. You also grade 10 outputs by hand, chosen at random. If you disagree with the judge on more than 2 of the 10, the rubric gets fixed before any result is trusted.

**Also recorded for each case:** cost (from OpenRouter), time to answer, output tokens, and whether the reply was cut off.

## Models (OpenRouter list prices, $ per million tokens in / out, 2026-11-19)

| Model | In | Out | Why it is in the test |
|---|---|---|---|
| deepseek/deepseek-v4-flash | 0.09 | 0.18 | cheapest strong option |
| openai/gpt-oss-120b | 0.09 | 0.36 | open-weight |
| openai/gpt-6-luna | 0.10 | 0.50 | app default for OpenAI keys |
| anthropic/claude-haiku-5.5 | 0.10 | 0.50 | app default for Claude keys |
| qwen/qwen3.8-flash | 0.15 | 0.47 | |
| z-ai/glm-5.3-flash | 0.15 | 0.50 | |
| mistralai/mistral-small-2603 | 0.15 | 0.60 | |
| google/gemini-3.8-flash | 0.825 | 4.125 | app default for Gemini keys |
| x-ai/grok-4.3 | 1.25 | 2.50 | cheapest Grok on OpenRouter |
| anthropic/claude-sonnet-5.5 | 2.00 | 10.00 | mid-tier reference |
| anthropic/claude-opus-5.5 | 4.00 | 20.00 | the old default; the quality ceiling |

## Cost (estimate)

- **Making the flows:** 11 models × 21 cases × 2 repeats ≈ $3 (most of it is Opus and Sonnet).
- **Judging:** about 460 grades by Sonnet, plus about 90 by Sol ≈ $10 to $12.
- **Total:** about $13 to $15. The runner stops on its own at **$15**, using OpenRouter's reported cost.
- Cost per round in the chart = cost per call × 60 live-flow calls (a typical round: 8 speeches, one pass every 30 s, plus a final pass per speech).
