// Pure helpers for the live-flow eval: gates, the quality score, the judge sample, and the Pareto frontier.
// No network and no files here, so lib.test.mjs can check them.
import { createHash } from 'node:crypto';

// Variant dirs must be baseline / v1 / v2 ... for the report builder; baseline = today's app default for Claude keys.
export const MODELS = [
  'anthropic/claude-haiku-5.5',
  'deepseek/deepseek-v4-flash',
  'openai/gpt-oss-120b',
  'openai/gpt-6-luna',
  'qwen/qwen3.8-flash',
  'z-ai/glm-5.3-flash',
  'mistralai/mistral-small-2603',
  'google/gemini-3.8-flash',
  'x-ai/grok-4.3',
  'anthropic/claude-sonnet-5.5',
  'anthropic/claude-opus-5.5',
];
// The report builder wants variant dirs named baseline / v1 / v2 ...; a model off the list gets v900+.
export function variantOf(model, extra = []) {
  const i = MODELS.indexOf(model);
  return i === 0 ? 'baseline' : 'v' + (i < 0 ? 900 + Math.max(0, extra.indexOf(model)) : i);
}

// Gate 1: the reply matches LIVE_FLOW_SCHEMA (what applyLiveFlow in the app needs).
export function validateFlow(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, reason: 'not an object' };
  const extra = Object.keys(obj).filter((k) => k !== 'sheets');
  if (extra.length) return { ok: false, reason: 'extra keys: ' + extra.join(', ') };
  if (!Array.isArray(obj.sheets)) return { ok: false, reason: 'sheets is not a list' };
  if (!obj.sheets.length) return { ok: false, reason: 'no sheets' };
  for (const [i, s] of obj.sheets.entries()) {
    if (!s || typeof s !== 'object') return { ok: false, reason: 'sheet ' + i + ' is not an object' };
    for (const k of ['sheet', 'brief', 'standard', 'detailed']) {
      if (typeof s[k] !== 'string') return { ok: false, reason: 'sheet ' + i + ': ' + k + ' is not text' };
    }
    if (!s.sheet.trim()) return { ok: false, reason: 'sheet ' + i + ' has no name' };
    const bad = Object.keys(s).filter((k) => !['sheet', 'brief', 'standard', 'detailed'].includes(k));
    if (bad.length) return { ok: false, reason: 'sheet ' + i + ' extra keys: ' + bad.join(', ') };
  }
  return { ok: true, reason: '' };
}

export const RUBRIC_ITEMS = ['coverage', 'faithful', 'placement', 'judge_ready'];

// Quality 0-100 = (coverage + 2 x faithful + placement + judge_ready) / 15 x 100. A failed gate is 0.
export function quality(scores, gateOk) {
  if (!gateOk || !scores) return 0;
  const v = (k) => Math.max(0, Math.min(3, Number(scores[k]) || 0));
  return Math.round(((v('coverage') + 2 * v('faithful') + v('placement') + v('judge_ready')) / 15) * 1000) / 10;
}

// The second judge re-grades a fixed, repeatable 1-in-5 sample (same pick on every run and resume).
export function inCrossSample(key, rate = 0.2) {
  const h = createHash('sha256').update(String(key)).digest();
  return h.readUInt32BE(0) / 0xffffffff < rate;
}

// Mean and a 95% interval (normal approximation) of a list of numbers.
export function meanCI(xs) {
  const n = xs.length;
  if (!n) return { mean: null, lo: null, hi: null, n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const half = n > 1 ? (1.96 * sd) / Math.sqrt(n) : 0;
  return { mean, lo: mean - half, hi: mean + half, n };
}

// Pareto frontier: a model is on it when no other model is both cheaper (or equal) and better (or equal),
// with at least one strictly. points: [{ id, cost, quality }]. Returns the ids on the frontier, cheapest first.
export function paretoFrontier(points) {
  const ok = points.filter((p) => Number.isFinite(p.cost) && Number.isFinite(p.quality));
  const front = ok.filter((p) => !ok.some((q) => q !== p && q.cost <= p.cost && q.quality >= p.quality && (q.cost < p.cost || q.quality > p.quality)));
  return front.sort((a, b) => a.cost - b.cost).map((p) => p.id);
}

// Agreement between two judges on the same outputs: share of rubric items within 1 point, and the mean gap in quality.
export function judgeAgreement(pairs) {
  if (!pairs.length) return { n: 0, within1: null, qualityGap: null };
  let within = 0, items = 0, gap = 0;
  for (const { a, b } of pairs) {
    for (const k of RUBRIC_ITEMS) { items++; if (Math.abs((a[k] || 0) - (b[k] || 0)) <= 1) within++; }
    gap += Math.abs(quality(a, true) - quality(b, true));
  }
  return { n: pairs.length, within1: within / items, qualityGap: gap / pairs.length };
}
