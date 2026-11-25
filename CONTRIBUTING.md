# Contributing to Tabula

Thank you for your interest in Tabula.

## What we accept now

- **Issues are welcome.** Bug reports, format requests, event requests, and ideas help us.
- **Outside code contributions are not accepted before launch.** If you open a pull request, we will close it politely, with thanks. Please open an issue for your idea.
- When we accept the first outside pull request, we will ask contributors to sign a contributor license agreement (CLA). This file will tell you how.

## How to file a good issue

1. Search the open issues first. If your issue is there, add a comment.
2. Use a short, clear title. Example: "PF: Final Focus timer starts at the wrong time".
3. Say which app: Tabula Debate or Tabula Speech Events.
4. Write the steps to make the problem occur, what you expected, and what occurred.
5. Add the browser, its version, and the device.
6. For a format or event request, give the rules (speech order, times, prep, ballot) and a public link to the rules if you have one.

Do not put real student names, real ballots, or API keys in an issue. For a security problem, do not open an issue. Read [SECURITY.md](SECURITY.md).

## Run the gates

You need Node.js. In the repository folder:

```bash
node --test
node check-publish.mjs
```

`check-publish.mjs` needs the built Debate Library in `learn/`. To build it, run `node build-learn.mjs`.

## Conduct

Everyone who takes part must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
