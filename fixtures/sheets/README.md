# Copy and print sheet golden output

`golden.json` is the HTML that debate's copy sheet and print sheet code made **before** step C10
(docs/events/LANDING.md §3), captured once from the old `js/decide.js` templates (commit `90b41eb`) for a few
sample rounds, with HTML special characters in the text. `core/sheets.test.mjs` checks that the shared
`core/sheets.js` builders make exactly this HTML, so moving the code changed nothing a judge prints or copies.

Do not regenerate it to make a test pass. A real change to the sheets gets a new, reviewed fixture.
