# Speech Events: release notes

What changes for judges in each Speech Events release, newest first.

**Status:** the beta code is on main and the hosting config is ready. The app is not live yet.

## How a release is named

Each build gets a release id. Settings, About shows it, and the "Send feedback" email and the backup file carry it.

- **Online:** the first 7 characters of the commit the build came from, then the day it was built, for example
  `1a2b3c4 2026-01-15`. The build writes them to `version.json` (`{ "sha", "builtAt" }`, the same shape as the debate
  app). A `+` after the commit means the build had changes that were not committed.
- **Offline:** the page cannot read `version.json`, so it shows the release the service worker saved on the device,
  for example `offline 387a7ee`. That name is a hash of every file the page loads (`events/sw-files.js`).
- **Neither:** `unknown`.

`version.json` is never cached: `events/_headers` says `no-cache` for it, and the service worker does not list it.

## Beta

The first beta. Speech Events stores rounds on the judge's device. There is no sign-in and no sync. AI clean-up is
optional and uses the judge's own key.

- **Install.** The page can be added to the home screen and opens with no internet once it is ready for offline.
- **Keep my rounds.** The page asks the browser to keep its data, and Settings says plainly whether the browser keeps
  it.
- **Backup reminder.** When the judging day is over and something changed since the last backup, My day offers to
  download one.
- **Clear this device.** Settings removes every Speech Events value on a shared computer, with an Undo while the tab
  is open. Tabula Debate data is not touched.
- **Congress (beta).** Chambers and sessions for Student Congress, marked as beta.
- **Security headers.** The host sends a strict Content-Security-Policy and other safety headers, so only this site's
  scripts run next to a judge's saved AI key.
- **Source code.** Settings, About links to the source code (AGPL).
- **Release id.** Settings, About shows which release the device runs, and backup files name it.
- **Safe updates.** A new release waits while a round is open or a clock runs. When the page is quiet, it says
  "Update ready. It starts when you reload." with a Reload button. The page never reloads by itself.
  Known limits: while an update waits, the release id online names the waiting release, not the one that runs (the
  offline id names the running one). A browser with no BroadcastChannel (Safari before 15.4), or a tab the browser
  has paused, cannot report an open round in that tab unless a clock runs there; that tab is never reloaded.
- **Send feedback.** Settings, About opens an email to support with the release id and the browser family filled in,
  and a reminder not to include student names. Nothing is sent until the judge sends it. A Known issues link sits
  next to it.
