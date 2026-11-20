// Turns the run results into the Pareto answer: quality vs cost per round, per model.
//   node evals/live-flow/report.mjs
// Writes (git-ignored) evals/.data/live-flow/: pareto.md, pareto.svg, hand-grade.md, and run/_state.json.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { meanCI, paretoFrontier, judgeAgreement, inCrossSample, RUBRIC_ITEMS } from './lib.mjs';

const CALLS_PER_ROUND = 60; // 8 speeches, a pass every 30 s, plus a final pass per speech (see README)
const root = new URL('../.data/live-flow/', import.meta.url);
const runDir = new URL('run/', root);
if (!existsSync(runDir)) { console.error('No results yet. Run: node evals/live-flow/run.mjs'); process.exit(2); }

const variants = readdirSync(runDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^(baseline|v\d+)$/.test(d.name)).map((d) => d.name);
const rows = {}, models = {};
for (const v of variants) {
  const f = new URL(v + '/results.jsonl', runDir);
  rows[v] = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  models[v] = readFileSync(new URL(v + '/change.md', runDir), 'utf8').trim();
}

const stats = variants.filter((v) => rows[v].length).map((v) => {
  const r = rows[v];
  const q = meanCI(r.map((x) => x.grade.quality));
  const perCall = r.reduce((a, x) => a + (x.cost_usd || 0), 0) / r.length;
  const lat = r.map((x) => x.latency_s).sort((a, b) => a - b);
  const items = Object.fromEntries(RUBRIC_ITEMS.map((k) => [k, meanCI(r.filter((x) => x.grade.gate).map((x) => x.grade[k])).mean]));
  return {
    v, model: models[v], n: r.length, quality: q, gatePass: r.filter((x) => x.grade.gate).length / r.length,
    perCall, perRound: perCall * CALLS_PER_ROUND, latencyP50: lat[Math.floor(lat.length / 2)], latencyP90: lat[Math.floor(lat.length * 0.9)],
    items, cut: r.filter((x) => x.status === 'truncated').length,
  };
});
const front = new Set(paretoFrontier(stats.map((s) => ({ id: s.v, cost: s.perRound, quality: s.quality.mean }))));
const pairs = variants.flatMap((v) => rows[v].filter((x) => x.cross && x.grade.gate).map((x) => ({ a: x.grade, b: x.cross })));
const agree = judgeAgreement(pairs);
const spend = (() => { try { return JSON.parse(readFileSync(new URL('spend.json', runDir), 'utf8')).usd; } catch { return 0; } })();

// ---------- pareto.md ----------
const f2 = (x, d = 1) => (x == null ? '-' : x.toFixed(d));
const money = (x) => (x < 0.01 ? '$' + x.toFixed(4) : '$' + x.toFixed(3));
const sorted = [...stats].sort((a, b) => a.perRound - b.perRound);
const md = [
  '# Live-flow eval: quality vs cost', '',
  `Cases: ${new Set(variants.flatMap((v) => rows[v].map((x) => x.prompt_id))).size}. Total spent: $${f2(spend, 2)}. Cost per round = cost per call × ${CALLS_PER_ROUND}.`,
  `Judge agreement (Sonnet vs Sol on ${agree.n} outputs): ${agree.n ? f2(agree.within1 * 100, 0) + '% of rubric scores within 1 point; mean quality gap ' + f2(agree.qualityGap) + ' points' : 'no cross-graded outputs yet'}.`, '',
  '★ = on the Pareto frontier (nothing else is both cheaper and better).', '',
  '| | model | quality (95% CI) | valid | $ / call | $ / round | p50 s | p90 s | coverage | faithful | placement | judge-ready | cut off |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...sorted.map((s) => `| ${front.has(s.v) ? '★' : ''} | ${s.model} | ${f2(s.quality.mean)} (${f2(s.quality.lo)}–${f2(s.quality.hi)}) | ${f2(s.gatePass * 100, 0)}% | ${money(s.perCall)} | ${money(s.perRound)} | ${f2(s.latencyP50)} | ${f2(s.latencyP90)} | ${RUBRIC_ITEMS.map((k) => f2(s.items[k], 2)).join(' | ')} | ${s.cut} |`),
  '', 'Rubric items are means over valid replies (0–3). Quality counts an invalid reply as 0.',
].join('\n');
writeFileSync(new URL('pareto.md', root), md + '\n');

// ---------- pareto.svg (numbers and model ids only) ----------
const W = 760, H = 460, pad = { l: 64, r: 24, t: 24, b: 56 };
const xs = stats.map((s) => Math.log10(Math.max(s.perRound, 1e-4)));
const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
const yLo = Math.max(0, Math.floor(Math.min(...stats.map((s) => s.quality.lo)) / 10) * 10), yHi = 100;
const X = (c) => pad.l + ((Math.log10(Math.max(c, 1e-4)) - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
const Y = (q) => H - pad.b - ((q - yLo) / (yHi - yLo)) * (H - pad.t - pad.b);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const frontPts = stats.filter((s) => front.has(s.v)).sort((a, b) => a.perRound - b.perRound);
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif" font-size="11">`,
  `<rect width="${W}" height="${H}" fill="#fff"/>`,
  ...Array.from({ length: x1 - x0 + 1 }, (_, i) => { const c = 10 ** (x0 + i); const x = X(c); return `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${H - pad.b}" stroke="#eee"/><text x="${x}" y="${H - pad.b + 16}" text-anchor="middle" fill="#555">$${c >= 1 ? c : c.toPrecision(1)}</text>`; }),
  ...Array.from({ length: (yHi - yLo) / 10 + 1 }, (_, i) => { const q = yLo + i * 10; const y = Y(q); return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#eee"/><text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" fill="#555">${q}</text>`; }),
  `<text x="${(W + pad.l) / 2}" y="${H - 14}" text-anchor="middle" fill="#222">Cost per round (log scale)</text>`,
  `<text transform="translate(16 ${(H - pad.b + pad.t) / 2}) rotate(-90)" text-anchor="middle" fill="#222">Flow quality (0–100)</text>`,
  `<polyline fill="none" stroke="#0055b8" stroke-width="2" stroke-dasharray="5 4" points="${frontPts.map((s) => X(s.perRound) + ',' + Y(s.quality.mean)).join(' ')}"/>`,
  ...stats.map((s) => { const x = X(s.perRound), y = Y(s.quality.mean); const on = front.has(s.v);
    return `<line x1="${x}" y1="${Y(s.quality.lo)}" x2="${x}" y2="${Y(s.quality.hi)}" stroke="${on ? '#0055b8' : '#999'}"/><circle cx="${x}" cy="${y}" r="${on ? 6 : 4}" fill="${on ? '#0055b8' : '#999'}"/><text x="${x + 8}" y="${y - 6}" fill="${on ? '#0055b8' : '#555'}">${esc(s.model.split('/').pop())}</text>`; }),
  '</svg>'].join('\n');
writeFileSync(new URL('pareto.svg', root), svg);

// ---------- hand-grade.md: 10 outputs for the human check ----------
const pool = variants.flatMap((v) => rows[v].filter((x) => x.grade.gate).map((x) => ({ v, x })));
const pick = pool.filter(({ v, x }) => inCrossSample('hand|' + v + '|' + x.prompt_id + '|' + x.rep, 10 / Math.max(10, pool.length))).slice(0, 10);
const fence = '`'.repeat(6);
const hand = ['# Hand grading: 10 flows', '', 'Score each item 0–3 with the rubric in README.md, without looking at the judge scores (they are at the bottom). The model is hidden.', '',
  ...pick.flatMap(({ v, x }, i) => {
    const trace = JSON.parse(readFileSync(new URL(`${v}/traces/${x.prompt_id.replace('@', '_at')}_rep${x.rep}.json`, runDir), 'utf8'));
    return [`## Flow ${i + 1} (case ${x.prompt_id})`, '', fence, trace.output, fence, '', 'Your scores: coverage _ · faithful _ · placement _ · judge-ready _', ''];
  }),
  '---', '', '## Judge scores (read after you grade)', '',
  ...pick.map(({ v, x }, i) => `- Flow ${i + 1}: ${RUBRIC_ITEMS.map((k) => k + ' ' + x.grade[k]).join(', ')} (quality ${x.grade.quality}; ${models[v]})`)].join('\n');
writeFileSync(new URL('hand-grade.md', root), hand + '\n');

// ---------- _state.json for the per-case report viewer ----------
writeFileSync(new URL('_state.json', runDir), JSON.stringify({
  metrics: [{ id: 'quality', label: 'quality', kind: 'float', scale: 100 }, { id: 'gate', label: 'valid', kind: 'binary' },
    ...RUBRIC_ITEMS.map((k) => ({ id: k, kind: 'judge', scale: 3 }))],
  perf_fields: [{ id: 'cost_usd', unit: '$' }, { id: 'latency_s', unit: 's' }, { id: 'out_tokens' }],
}, null, 1));

console.log(md);
console.log('\nWrote evals/.data/live-flow/pareto.md, pareto.svg, hand-grade.md');
