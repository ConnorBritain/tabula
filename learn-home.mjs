// Library home page layout (docs/library/index.md, built by build-learn.mjs).
// "Pick your path" becomes three connected choices: a row of small cards at the top names each path (who it is for,
// how long, how many pages) and jumps to it, and each path below sits in its own card. When a built guided track has
// exactly the same pages, in the same order, as a path's numbered list, the card links to it.

const text = (html) => html.replace(/<[^>]+>/g, '');

// One "### Heading (when)" block under "Pick your path".
function parseCard(part) {
  const head = /^<h3 id="([^"]+)">([\s\S]*?)<\/h3>/.exec(part);
  if (!head) throw new Error(`index.md "Pick your path": expected a "### " path heading, found: ${part.slice(0, 60)}`);
  const [, id, title] = head;
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(text(title));
  const name = m ? m[1] : text(title);
  const when = m ? m[2][0].toUpperCase() + m[2].slice(1) : '';
  const list = /<ol>([\s\S]*?)<\/ol>/.exec(part); // a numbered path; a "pick a branch" card has none
  const steps = list ? [...new Set([...list[1].matchAll(/<a href="([a-z0-9-]+)\/">/g)].map((x) => x[1]))] : [];
  return { id, name, when, steps, body: part.replace(head[0], `<h3 id="${id}">${name}</h3>${when ? `<p class="path-when">${when}</p>` : ''}`) };
}

export function renderPathCards(html, tracks, states, href) {
  const start = html.indexOf('<h2 id="pick-your-path">');
  if (start < 0) return html;
  const bodyStart = html.indexOf('</h2>', start) + 5;
  const next = html.indexOf('<h2', bodyStart);
  const end = next < 0 ? html.length : next;
  const section = html.slice(bodyStart, end);
  const first = section.indexOf('<h3 id="');
  const lead = first < 0 ? section : section.slice(0, first); // any intro text stays, above the choices
  if (/<h3\b/.test(lead)) parseCard(lead.slice(lead.search(/<h3\b/))); // a heading the builder cannot read stops the build
  const cards = first < 0 ? [] : section.slice(first).split(/(?=<h3 id=")/).map(parseCard);
  const sameSteps = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
  const cardHtml = cards.map((c) => {
    const track = tracks.find((t) => c.steps.length && sameSteps(t.steps, c.steps));
    const ready = track && states.get(track.id)?.ready;
    // Only a built track gets a line: no promise of tracks that do not exist yet.
    const trackLine = ready ? `<p class="path-track"><a href="${href(`tracks/${track.id}`)}">Take it as a guided track</a>, with a quick check after each page.</p>` : '';
    return `<section class="path-card" aria-labelledby="${c.id}">${c.body}${trackLine}</section>`;
  });
  const meta = (c) => [c.when, c.steps.length ? `${c.steps.length} pages` : ''].filter(Boolean).join(' · ');
  const chooser = cards.length ? `<nav class="path-chooser" aria-label="Choose a path">${cards.map((c) => `<a class="path-pick" href="#${c.id}"><span class="path-pick-name">${c.name}</span><span class="path-pick-meta">${meta(c)}</span></a>`).join('')}</nav>` : '';
  return html.slice(0, bodyStart) + lead + '\n' + chooser + '\n' + cardHtml.join('\n') + '\n' + html.slice(end);
}
