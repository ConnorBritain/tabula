// Runs the live-flow eval on OpenRouter: each model flows each case, then a blind AI judge grades it.
//
//   node evals/live-flow/run.mjs                 # all models, 2 repeats, $15 cap
//   node evals/live-flow/run.mjs --reps 1 --budget 5 --models anthropic/claude-haiku-5.5
//   node evals/live-flow/run.mjs --dry           # no calls: shows the plan and the estimate
//
// The key is read from OPENROUTER_API_KEY or ~/.config/tabula/openrouter.env. It is never printed or saved.
// Output (git-ignored): evals/.data/live-flow/run/<variant>/results.jsonl and traces/, one variant dir per model.
// Re-running resumes: finished case/rep pairs are skipped, and money already spent counts toward the cap.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { validateFlow, quality, inCrossSample, RUBRIC_ITEMS, MODELS, variantOf as variantFor } from './lib.mjs';
const require = createRequire(import.meta.url);
const L = require('../../logic.js');
const P = require('../../providers.js');

const JUDGE = 'anthropic/claude-sonnet-5.5';
const CROSS_JUDGE = 'openai/gpt-6.2-sol';
const FLOW_CAP = P.outputCap('flow'); // the same output cap the app uses

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : dflt; };
const REPS = Number(arg('reps', 2));
const BUDGET = Number(arg('budget', 15));
const DRY = process.argv.includes('--dry');
const CONCURRENCY = Number(arg('concurrency', 4));
const models = arg('models', '') ? arg('models').split(',') : MODELS;

const root = new URL('../.data/live-flow/', import.meta.url);
const runDir = new URL('run/', root);
const cases = readFileSync(new URL('cases.jsonl', root), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const variantOf = (model) => variantFor(model, models);

function readKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  const f = homedir() + '/.config/tabula/openrouter.env';
  if (!existsSync(f)) return '';
  const m = readFileSync(f, 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m);
  return m ? m[1].trim() : '';
}

// ---------- spend tracking (the cap covers generation and judging, across runs) ----------
const spendFile = new URL('spend.json', runDir);
let spent = 0;
function loadSpend() { try { spent = JSON.parse(readFileSync(spendFile, 'utf8')).usd || 0; } catch { spent = 0; } }
function addSpend(usd) { spent += usd || 0; writeFileSync(spendFile, JSON.stringify({ usd: Math.round(spent * 1e6) / 1e6 })); }
class BudgetError extends Error {}
function checkBudget(estimate) { if (spent + estimate > BUDGET) throw new BudgetError('budget cap reached: $' + spent.toFixed(2) + ' spent of $' + BUDGET); }

// ---------- OpenRouter ----------
async function chat(key, body, tries = 4) {
  for (let i = 0; ; i++) {
    const t0 = Date.now();
    let res, j;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'X-Title': 'Tabula eval' },
        body: JSON.stringify({ ...body, usage: { include: true } }),
        signal: AbortSignal.timeout(180000),
      });
      j = await res.json().catch(() => ({}));
    } catch (err) { if (i + 1 < tries) { await sleep(2000 * 2 ** i); continue; } throw err; }
    const latency = (Date.now() - t0) / 1000;
    if (res.ok && !j.error) return { j, latency };
    const status = res.status || (j.error && j.error.code);
    if ((status === 429 || status >= 500) && i + 1 < tries) { await sleep(2000 * 2 ** i + Math.random() * 1000); continue; }
    const e = new Error('OpenRouter ' + status + ': ' + String((j.error && j.error.message) || '').slice(0, 300)); e.status = status; throw e;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const costOf = (j) => Number((j.usage && j.usage.cost) || 0);

// One live-flow call, as the app makes it: the system prompt, the case prompt, the JSON schema, low effort, the flow cap.
async function generate(key, model, c) {
  checkBudget(model.includes('opus') ? 0.08 : model.includes('sonnet') ? 0.04 : 0.02);
  const { j, latency } = await chat(key, {
    model,
    messages: [{ role: 'system', content: L.LIVE_FLOW_SYSTEM }, { role: 'user', content: c.prompt }],
    max_tokens: FLOW_CAP,
    reasoning: { effort: 'low' },
    response_format: { type: 'json_schema', json_schema: { name: 'reply', strict: true, schema: L.LIVE_FLOW_SCHEMA } },
  });
  addSpend(costOf(j));
  const ch = (j.choices || [])[0] || {};
  const text = (ch.message && ch.message.content) || '';
  let parsed = null, gate = { ok: false, reason: '' };
  if (ch.finish_reason === 'length') gate.reason = 'cut off at the flow cap';
  else { try { parsed = P.extractJson(text); gate = validateFlow(parsed); } catch (err) { gate.reason = 'not valid JSON'; } }
  return { text, parsed, gate, served: j.model || model, cost: costOf(j), latency, in_tokens: (j.usage || {}).prompt_tokens || 0, out_tokens: (j.usage || {}).completion_tokens || 0, finish: ch.finish_reason };
}

// ---------- the judge ----------
const JUDGE_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(RUBRIC_ITEMS.flatMap((k) => [[k, { type: 'integer', enum: [0, 1, 2, 3] }], [k + '_why', { type: 'string' }]])),
  required: RUBRIC_ITEMS.flatMap((k) => [k, k + '_why']),
  additionalProperties: false,
};
const JUDGE_SYSTEM = [
  'You grade an AI-made live flow of a high school policy debate speech for a judge. You do not know which AI made it.',
  'You get the input the AI saw (the flow of earlier speeches and the transcript of the current speech so far) and the AI\'s flow.',
  'The transcript comes from speech-to-text and has errors. The speech may be unfinished. Judge against what was said so far, not the whole speech.',
  'Score each item 0, 1, 2 or 3, and give a reason of one or two short sentences:',
  '- coverage: 3 = every argument and card in the transcript so far is on the flow. 2 = one or two minor ones missing. 1 = several missing. 0 = most missing.',
  '- faithful: 3 = nothing invented; authors, years and numbers match what was said; unclear parts marked "??". 2 = a small slip. 1 = a wrong author, number or claim. 0 = an invented argument, card or number.',
  '- placement: 3 = each argument on the right sheet (the 1AC on "Case", each off-case position on its own named sheet), answers line up with what they answer, existing sheet names reused exactly. 2 = one misplacement. 1 = several. 0 = wrong sheets or duplicate sheets throughout.',
  '- judge_ready: 3 = flow shorthand in numbered lines; "brief" is truly brief; "detailed" has the warrants; all three levels cover the same arguments in the same order. 2 = one level weak. 1 = mostly prose or levels mismatch. 0 = unusable for a judge.',
  'Be strict and consistent. Do not reward length for its own sake.',
].join('\n');
function judgePrompt(c, parsed) {
  const flow = (parsed.sheets || []).map((s) => '### ' + s.sheet + '\n[brief]\n' + s.brief + '\n[standard]\n' + s.standard + '\n[detailed]\n' + s.detailed).join('\n\n');
  return 'INPUT THE AI SAW\n================\n' + c.prompt + '\n\nTHE AI\'S FLOW FOR THE CURRENT SPEECH\n=====================================\n' + flow;
}
async function grade(key, judgeModel, c, parsed) {
  checkBudget(judgeModel.includes('sol') ? 0.05 : 0.04);
  const { j } = await chat(key, {
    model: judgeModel,
    messages: [{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: judgePrompt(c, parsed) }],
    max_tokens: 4000,
    reasoning: { effort: 'medium' },
    response_format: { type: 'json_schema', json_schema: { name: 'grade', strict: true, schema: JUDGE_SCHEMA } },
  });
  addSpend(costOf(j));
  const g = P.extractJson(((j.choices || [])[0] || {}).message.content);
  return { scores: Object.fromEntries(RUBRIC_ITEMS.map((k) => [k, g[k]])), why: Object.fromEntries(RUBRIC_ITEMS.map((k) => [k, g[k + '_why']])), cost: costOf(j) };
}

// ---------- main ----------
async function main() {
  const jobs = [];
  for (const model of models) for (const c of cases) for (let rep = 0; rep < REPS; rep++) jobs.push({ model, c, rep });
  const v = (m) => new URL(variantOf(m) + '/', runDir);
  const done = new Set();
  for (const model of models) {
    const f = new URL('results.jsonl', v(model));
    if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); done.add(model + '|' + r.prompt_id + '|' + r.rep); }
  }
  const todo = jobs.filter((x) => !done.has(x.model + '|' + x.c.id + '|' + x.rep));
  console.log(`${models.length} models × ${cases.length} cases × ${REPS} reps = ${jobs.length} runs; ${todo.length} still to do. Cap $${BUDGET}.`);
  if (DRY) { for (const m of models) console.log('  ' + variantOf(m).padEnd(9) + m); return; }
  const key = readKey();
  if (!key) { console.error('No OpenRouter key. Save it to ~/.config/tabula/openrouter.env (see evals/live-flow/README.md).'); process.exit(2); }
  mkdirSync(runDir, { recursive: true });
  loadSpend();
  for (const m of models) {
    mkdirSync(new URL('traces/', v(m)), { recursive: true });
    writeFileSync(new URL('change.md', v(m)), m + '\n');
  }
  let stop = null, n = 0;
  const worker = async () => {
    while (todo.length && !stop) {
      const { model, c, rep } = todo.shift();
      const id = c.id.replace('@', '_at');
      try {
        const out = await generate(key, model, c);
        let main = null, cross = null;
        if (out.gate.ok) {
          main = await grade(key, JUDGE, c, out.parsed);
          if (inCrossSample(model + '|' + c.id + '|' + rep)) cross = await grade(key, CROSS_JUDGE, c, out.parsed);
        }
        const row = {
          prompt_id: c.id, rep, tags: [c.speech], model: out.served,
          status: out.finish === 'length' ? 'truncated' : 'ok',
          grade: { quality: quality(main && main.scores, out.gate.ok), gate: out.gate.ok ? 1 : 0, ...(main ? main.scores : {}) },
          explanation: main ? main.why : { gate: out.gate.reason },
          cross: cross ? cross.scores : undefined,
          cost_usd: out.cost, judge_cost_usd: (main ? main.cost : 0) + (cross ? cross.cost : 0),
          latency_s: out.latency, in_tokens: out.in_tokens, out_tokens: out.out_tokens,
        };
        writeFileSync(new URL('traces/' + id + '_rep' + rep + '.json', v(model)), JSON.stringify({ case: c.id, model, output: out.text, gate: out.gate, grade: main, cross }, null, 1));
        appendFileSync(new URL('results.jsonl', v(model)), JSON.stringify(row) + '\n');
        n++;
        if (n % 10 === 0) console.log(`  ${n} done, $${spent.toFixed(2)} spent`);
      } catch (err) {
        if (err instanceof BudgetError) { stop = err.message; break; }
        appendFileSync(new URL('errors.jsonl', v(model)), JSON.stringify({ prompt_id: c.id, rep, failure_class: err.status ? 'http_' + err.status : 'error', message: String(err.message).slice(0, 300) }) + '\n');
        console.log(`  error on ${model} ${c.id} rep ${rep}: ${String(err.message).slice(0, 120)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(stop ? 'Stopped: ' + stop : 'Finished.', `$${spent.toFixed(2)} spent in total. Next: node evals/live-flow/report.mjs`);
}
main().catch((err) => { console.error(String(err && err.message || err)); process.exit(1); });
