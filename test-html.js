// A small HTML tree for the AI gate tests (no packages): elements with their attributes, parent and children.
// It reads index.html as the browser would for these checks: script and style bodies are skipped, void elements
// have no children. Run nothing here; tests require it.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function parseAttrs(src) {
  const attrs = {};
  for (const m of src.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

// Returns the root node: { tag, attrs, parent, children }.
function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, parent: null, children: [] };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  for (const m of html.matchAll(re)) {
    if (m[1] || m[0].startsWith('<!--')) continue;
    if (m[2]) { // a closing tag: close up to the matching open element
      const tag = m[2].toLowerCase();
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent;
      continue;
    }
    const tag = m[3].toLowerCase();
    const node = { tag, attrs: parseAttrs(m[4] || ''), parent: cur, children: [] };
    cur.children.push(node);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[4] || '')) cur = node;
  }
  return root;
}

function* walk(n) { for (const c of n.children) { yield c; yield* walk(c); } }
const byId = (root, id) => { for (const n of walk(root)) if (n.attrs.id === id) return n; return null; };
function ancestorsAndSelf(n) { const out = []; for (let x = n; x && x.tag !== '#root'; x = x.parent) out.push(x); return out; }

module.exports = { parseHtml, walk, byId, ancestorsAndSelf };
