// Pulls one top-level function's source text out of a page part, so a test can run that one function with stubs.
// The page parts touch the DOM at load, so they cannot be required in node; one function on its own can be.
// fnSource(text, 'name') -> 'function name(...) { ... }' (braces matched; strings with braces are not expected).
function fnSource(text, name) {
  const start = text.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('no function ' + name);
  let i = text.indexOf('{', start), depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('unbalanced function ' + name);
}
module.exports = { fnSource };
