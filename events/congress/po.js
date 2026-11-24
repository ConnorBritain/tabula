// Speech Events step S6 (docs/events/CONGRESS.md §4.2 PO card, §5.2): the presiding officer's terms and hour scores.
// Pure: no DOM, no storage; the clock (now) is passed in.
// A term: { legislatorId, startedAt, endedAt?, hourScores: [{ hour, points }], partHour }.
//   - The app counts full hours from the clock. At each full hour it asks for a PO score.
//   - Under poRule 'fullHourOnly' (NSDA), a part hour gets no score: when a term ends with a part hour left over, the
//     term keeps partHour: true, so the rule has a stored result.
//   - Under poRule 'parliScores' (TFA), the parliamentarian scores the PO, so the scorer has nothing to score.
// A new PO after a recess starts a new term.
export const HOUR_MS = 3600000;

export const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

// Start a term. A term still open ends first.
export function startTerm(session, legislatorId, now) {
  const s = session.poTerms.some((t) => t.endedAt == null) ? endTerm(session, now) : session;
  return Object.assign({}, s, { poTerms: s.poTerms.concat({ legislatorId, startedAt: now, endedAt: null, hourScores: [], partHour: false }) });
}

// End the open term. A part hour left over is flagged (it gets no score).
export function endTerm(session, now) {
  return Object.assign({}, session, { poTerms: session.poTerms.map((t) => {
    if (t.endedAt != null) return t;
    const ms = Math.max(0, now - t.startedAt);
    return Object.assign({}, t, { endedAt: now, partHour: ms % HOUR_MS > 0 });
  }) });
}

// Full hours a term has run (to its end, or to now while open).
export const fullHours = (term, now) => Math.floor(Math.max(0, (term.endedAt != null ? term.endedAt : now) - term.startedAt) / HOUR_MS);

// The hours of a term that need a score now: [1..fullHours] with no score yet. Empty under 'parliScores'.
export function hoursDue(term, now, profile) {
  if (profile.poRule === 'parliScores') return [];
  const out = [];
  for (let h = 1; h <= fullHours(term, now); h++) if (!term.hourScores.some((x) => x.hour === h && x.points != null)) out.push(h);
  return out;
}

// Score one full hour of a term (termIndex in session.poTerms). An hour the term has not finished is refused.
export function setHourScore(session, termIndex, hour, points, now) {
  const t = session.poTerms[termIndex];
  if (!t || !Number.isInteger(hour) || hour < 1 || hour > fullHours(t, now)) return session;
  const p = points === null || points === '' ? null : Number(points);
  const hourScores = t.hourScores.filter((x) => x.hour !== hour).concat(p == null || !Number.isInteger(p) ? [] : [{ hour, points: p }]).sort((a, b) => a.hour - b.hour);
  return Object.assign({}, session, { poTerms: session.poTerms.map((x, i) => (i === termIndex ? Object.assign({}, x, { hourScores }) : x)) });
}

// The first PO hour with no score in the session, or null. The rank step stays locked until it is null (§4.3:
// Tabroom will not take ranks before the PO points are in).
export function firstUnscored(session, now, profile) {
  for (let i = 0; i < session.poTerms.length; i++) {
    const due = hoursDue(session.poTerms[i], now, profile);
    if (due.length) return { termIndex: i, hour: due[0], legislatorId: session.poTerms[i].legislatorId };
  }
  return null;
}

// The line that says why Rank is locked, or ''. codeOf(legislatorId) gives the PO's code.
export function poLockLine(session, now, profile, codeOf) {
  const f = firstUnscored(session, now, profile);
  return f ? 'Score the PO’s ' + ordinal(f.hour) + ' hour first (' + codeOf(f.legislatorId) + ').' : '';
}

// The scored PO hours of each legislator: { legislatorId: [points...] }, for the rank pool and Review.
export function poHoursBy(session) {
  const out = {};
  for (const t of session.poTerms) for (const h of t.hourScores) if (h.points != null) (out[t.legislatorId] = out[t.legislatorId] || []).push(h.points);
  return out;
}

export const openTerm = (session) => session.poTerms.find((t) => t.endedAt == null) || null;

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressPO = Object.freeze({ HOUR_MS, ordinal, startTerm, endTerm, fullHours, hoursDue, setHourScore,
  firstUnscored, poLockLine, poHoursBy, openTerm });
