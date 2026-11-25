# Speech Events device check

Judges bring their own devices. Speech Events must work on these five:

| Device | Browser | Screen reader |
|---|---|---|
| iPhone | Safari | VoiceOver |
| Android phone | Chrome | TalkBack |
| School Chromebook | Chrome (Chrome OS) | ChromeVox |
| iPad | Safari | VoiceOver |
| Windows laptop | Edge | Narrator |

This page has two parts:

1. **Real-device checklist.** A tester with the real device works through it and fills in the result table.
   Status: **waiting for staging and testers.** The staging host is not live yet.
2. **Emulated pass.** A script opens the app in a desktop browser that copies each device's screen size, touch and
   user agent, walks one room and one chamber, and records layout problems. It runs now, on any commit. It does not
   replace the real-device checklist: it cannot test the lock screen, real clipboard prompts, installing to the home
   screen, real screen readers, or Safari's own engine (see "Limits" below).

---

## 1. Real-device checklist

Status: **waiting for staging and testers.**

### Before you start

- Charge the device. Update the browser if it asks.
- Write down: device model, OS version, browser version (Safari: Settings > Safari shows the iOS version; Chrome and
  Edge: menu > Settings > About).
- Write down the app release id: open the app, then Settings > "Ready for offline". If the release id is not shown
  there, write the date and time you opened the app.
- Use fake entries only: codes like 101 to 106 and made-up names. Never type a real student's name in a test.
- Do every step in the light theme first. Section J repeats key screens in dark.

### Steps

Mark each step pass or fail. On a fail, write what you saw and take a screenshot.

**A. Open the app**

1. Scan the staging QR code with the camera app, or type the staging URL.
2. The app opens on My day. Nothing is cut off at the sides. You do not need to scroll sideways.

**B. Install to the home screen**

| Device | How |
|---|---|
| iPhone, iPad | Share button > Add to Home Screen > Add. |
| Android | Chrome menu (three dots) > Add to Home screen (or Install app). |
| Chromebook | Chrome menu > Cast, save, and share > Install page as app (or Create shortcut, tick "Open as window"). |
| Windows | Edge menu (three dots) > Apps > Install this site as an app. |

3. Open the app from the new home-screen icon. Write down whether it opens in its own window (no address bar) or in
   a normal browser tab.
4. Use the home-screen icon for every step from here on.

**C. Set up a 6-entry room**

5. Tap Start a round > Humorous Interpretation.
6. Paste or type six lines: `101` to `106`. Set Round to `2`.
7. Tap Start room. The room shows six speakers, 101 first.

**D. Time a speaker**

8. Tap Start. The clock counts down.
9. Leave the device alone for 2 minutes. Does the screen stay awake? (It should while the timer runs.)
10. Lock the screen (power button) for 30 seconds, then unlock. Is the timer still running, with the right time?
11. Switch to another app (or another tab) for 30 seconds, then come back. Is the time still right?
12. Tap Stop. Type a comment. Tap Next speaker. Repeat steps 8 and 12 for all six speakers (short times are fine).

**E. Rank**

13. Tap Rank the room. Move one speaker up and one down with the arrow buttons. On a touch device, also try
    dragging a row.
14. Tap Review and copy.

**F. Copy ranks and comments**

15. Tap Copy ranks. Open a notes app and paste. The six codes and ranks are there, in a readable layout.
16. Back in the app, tap Copy comment on one speaker. Paste into notes. The comment is there.
17. Write down any permission prompt the browser showed ("Allow paste?" and similar).

**G. Offline**

18. Turn on airplane mode (Chromebook and Windows: turn Wi-Fi off).
19. Reload the app (pull down, or the reload button; on an installed app with no reload button, close and reopen it).
20. The app opens. The review screen still shows the ranks. The header shows "Offline. Saved on this device."
21. Nothing on the screen is cut off and you do not need to scroll sideways.
22. Turn the network back on.

**H. One Congress chamber**

23. Start a round > Congressional Debate. Paste eight codes, `201` to `208`. Add two docket lines.
24. Tap Start the chamber.
25. Log a speech: Next speech > pick 202 > give points > type a comment > End speech > Done. Log three more speeches.
    Then leave the Log screen alone for 2 minutes. Does the screen stay awake?
26. Start a PO term for 201. (Real hour: you may leave the app open for 61 minutes, or skip and write "skipped".)
    After one full hour, the app asks for the PO score. Give one.
27. Rank tab: fill all rank slots.
28. Review tab: Copy one speech. Copy ranks. Paste both into notes; both are readable.

**I. Settings backup**

29. Settings > Download backup. Find the file (Files app, Downloads folder). Write down the file name and where it
    went. Do not share the file: it holds the test rounds.

**J. Light and dark theme**

30. Settings > Theme > Dark. Open My day, the room, Rank, Review, and the Congress Log. Text is readable on every
    screen; nothing is invisible or low contrast.
31. Set Theme back to Match this device.

**K. Text zoom 200%**

| Device | How |
|---|---|
| iPhone, iPad | Settings > Accessibility > Display & Text Size > Larger Text: drag to the largest non-accessibility size, or use Safari's "aA" > 200%. |
| Android | Settings > Display > Font size: largest; Chrome menu > Settings > Accessibility > Text scaling 200%. |
| Chromebook, Windows | Ctrl and + until the zoom shows 200%. |

32. Open My day, the room, Rank and Review. All text is readable. No button text is cut off. No control is hidden
    behind another. Sideways scrolling is only allowed inside the speaker strip and wide tables.
33. Set the zoom back.

**L. Screen reader smoke test (one room)**

| Device | Turn on |
|---|---|
| iPhone, iPad | Settings > Accessibility > VoiceOver (or triple-click the side button if set up). |
| Android | Settings > Accessibility > TalkBack. |
| Chromebook | Ctrl + Alt + Z (ChromeVox). |
| Windows | Ctrl + Windows key + Enter (Narrator). |

34. With the screen reader on, set up a new 6-entry room, start and stop the timer once, write one comment, rank,
    and copy the ranks.
35. Every button says what it does. You hear the timer state change. You hear "Copied" (or similar) after a copy.
36. Write down any control that is read as just "button" with no name, or that you could not reach.

**M. Close and reopen after 3 days**

37. Close the app fully (swipe it away). Do not open it for 3 days.
38. Open it from the home-screen icon. Are the HI room and the Congress chamber still there, in History and My day?
39. If the data is gone, write that down: this is the most important result on this page.

Note for iPhone and iPad: Safari can clear a site's saved data when the site has not been opened for 7 days, unless
the site was added to the home screen. A full test of this needs 8 days without opening the app. If you can, keep a
second device with the app open only in a Safari tab (not installed) and check it after 8 days too.

### Result table

Fill one row for each device. Use one row for each section letter that failed, with the step number in Notes.

| Device | OS version | Browser version | App release id | Tester | Date | Sections passed | Pass / fail | Notes |
|---|---|---|---|---|---|---|---|---|
| iPhone (Safari) | | | | | | | waiting for staging and testers | |
| Android phone (Chrome) | | | | | | | waiting for staging and testers | |
| School Chromebook (Chrome) | | | | | | | waiting for staging and testers | |
| iPad (Safari) | | | | | | | waiting for staging and testers | |
| Windows laptop (Edge) | | | | | | | waiting for staging and testers | |

---

## 2. Emulated pass

Run on main at `8dfc458` (the branch adds only `events/tools/`, this page and one test file; no app file differs
from main). Run it again with:

```
node events/tools/device-pass.mjs                      # all 5 devices, light and dark (about 6 minutes)
node events/tools/device-pass.mjs --devices=iphone,android --themes=light
```

Output goes to `events/tools/out/` (gitignored): one folder of full-page screenshots for each device and theme,
`findings.json` and `summary.md`. Screenshots are not committed.

### What it does

For each device profile, in the light and then the dark theme (the browser's color-scheme setting, so the app's
"Match this device" theme follows it), it starts with empty storage and:

1. Opens `/events/`, waits for the offline worker, reloads once (the load the offline cache serves).
2. Speech room (Humorous Interpretation): setup with six entries, times all six speakers (fake clock: one speaker goes
   over grace), writes a comment for each, ranks (moves one row), opens Review, copies the ranks and one comment and
   reads the clipboard back, reloads, then turns the network off and reloads again.
3. Opens one room each for Original Oratory, United States Extemp and Pro Con Challenge, a rate-only room, History,
   Settings and the palette (Ctrl+K, or Cmd+K on Apple profiles).
4. Congress: setup with eight legislators and two docket items, logs four speeches with points and comments, starts a
   PO term, jumps one hour, scores the PO hour, fills all rank slots, copies the ranks and one speech, reloads, and
   reloads again offline.

On every screen it records console errors, uncaught exceptions, page-level sideways scroll, controls under 44x44
CSS px (links inside running text are skipped), and text that does not fit its box (visually hidden screen-reader
text and text inside a sideways scroller are skipped).

### Devices

| Profile | Size (CSS px) | Pixel ratio | Touch | Engine used |
|---|---|---|---|---|
| iPhone 15, Safari user agent | 393x659 | 3 | yes | Chromium (WebKit is not installed here) |
| Pixel 7, Chrome | 412x839 | 2.625 | yes | Chromium |
| School Chromebook, Chrome OS | 1366x768 | 1 | no | Chromium |
| iPad (10th gen), Safari (desktop user agent, as iPadOS sends) | 820x1180 | 2 | yes | Chromium (WebKit is not installed here) |
| Windows laptop, Edge user agent | 1920x1080 | 1 | no | Chromium |

### Result

All 10 runs (5 devices x 2 themes) walked all 23 screens. Every functional step passed on every run: the timer ran,
ranks and comments reached the clipboard, data was still there after a reload, and both the review screen and the
Congress chamber loaded offline. No console errors. No uncaught exceptions.

Screens covered (23): My day (empty and with rounds), Picker, Type page, Room setup, room screen for interp (HI),
public address (OO), limited prep (USX) and Pro Con Challenge (PCC), Rank, Rate, Review and copy, Review offline,
History, Settings, Palette, Congress setup, Congress log (speech open), Congress PO hour, Congress rank, Congress
review, Congress offline, Congress chambers list. Every one has a light-theme phone shot (iPhone and Pixel profiles)
in the output folder.

### Findings, by judge impact

1. **Offline, the header is wider than a phone (iPhone, Pixel; both themes).** The chip "Offline. Saved on this
   device." pushes My day / History / Settings past the edge: the whole page scrolls sideways by 96 to 115 px on every
   screen while offline. Judges are often offline in tournament buildings. Seen on Review offline and Congress offline.
2. **Type page: rule-set rows overlap at phone width (iPhone, Pixel).** In the Rules list, each closed row's title
   ("Rate only (no ranks)", "Comments only (no ranks)", "NSDA-style invitational") wraps into a narrow column and its
   summary text is drawn on top of it. Unreadable.
3. **Rate screen: rating buttons are 31 to 33 px wide (all devices).** Ten buttons in a row (1 to 10); a finger can
   hit the next number. Same on the Congress points and PO score chips (40x40).
4. **Rank: Move up / Move down are 32 px wide; the "read the comment" link is 24 px tall (all devices).**
5. **Room screen: the "About <event>" link is 24 px tall; the speaker "Change" button is 32x32 (all devices).**
6. **Form fields and selects are 40 px tall (all devices).** Setup, History filters, Congress setup and log, the
   extemp question and PCC topic boxes. 4 px short of 44; low impact, but on every form.
7. **Settings and the palette: theme radio labels are 32 px tall.**
8. **Laptop sizes (Chromebook, Windows): several buttons are 32 to 40 px tall** (Copy all, Print / PDF, Copy ranks,
   My day's Start a round and standby). Mouse users: low impact. Touch Chromebooks: worth fixing with the rest.
9. **Header brand link is 30x25 on phones (icon only).** It is the way home. Low impact: My day is next to it.
10. **Small text spills (2 to 4 px):** the Congress review's copy preview (`pre`) and a long comment in Review on the
    Pixel width. Not visible to a judge in the screenshots; listed for completeness.

Not problems (the check flags them, the design means them): the rank row's comment preview ends with "..." on
purpose (tap to read the full comment).

Found by reading the code during the pass, to confirm on a real device:

- The Congress screen does not ask the screen to stay awake (only the speech-room timer does). During a long
  chamber session a phone or Chromebook may dim and lock between speeches. Checklist step 25 covers it.
- The chamber redraws for a new PO hour only when the comment box does not have focus. A judge typing a comment as
  the hour passes will not see the PO score prompt until their next tap.
- A Congress speech timer that reaches exactly its limit shows "-0:00".

### Full table

| Screen | Devices | Theme | Problem | Examples |
|---|---|---|---|---|
| Header (every screen) | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | a "Tabula Speech Events" 30x25; a "Tabula Speech Events" 200.1x25; a "My day" 96.1x32 |
| Header (every screen) | android, iphone | dark, light | text overflows its box | a "History" by 14 px; a "Settings" by 106 px; a "Settings" by 87 px |
| My day | chromebook, windows | dark, light | tap target under 44x44 | a "Start a round" 141.7x40; button "I am on standby" 132.1x32 |
| Picker | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | input "HI, extemp, poetry…" 369x40; input "HI, extemp, poetry…" 388x40; input "HI, extemp, poetry…" 728x40 |
| Type page | chromebook, windows | dark, light | tap target under 44x44 | a "Start a round" 145.7x40 |
| Type page | android, iphone | dark, light | text overflows its box | span "NSDA-style invitational" by 19 px; span "Comments only (no ranks)" by 69 px; span "Comments only (no ranks)" by 50 px |
| Room setup | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | select "Pick the event Original Oratory (10 min) Informati" 369x40; select "NSDA district rules NSDA-style invitational Custom" 369x40; input "2" 369x40 |
| Room: interp (HI) | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | a "About Humorous Interpretation" 31.3x24; input "piece-title" 317x40; input "piece-author" 317x40 |
| Rank | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | button "Read the comment for 102: Clear characters and str" 175.8x24; button "Move 102 up" 32x44; button "Move 102 down" 32x44 |
| Rank | android, iphone | dark, light | text cut off | span "Clear characters and strong pops." by 89 px; span "Clear characters and strong pops." by 70 px |
| Review and copy | chromebook, windows | dark, light | tap target under 44x44 | button "Copy all" 99.9x32; button "Print / PDF" 117.3x32; button "Copy ranks" 130.8x40 |
| Review and copy | android | dark, light | text overflows its box | div "Clear characters and strong pops. Work on the intr" by 4 px |
| Review offline | android, iphone | dark, light | page scrolls sideways | 115 px wider than the screen; 96 px wider than the screen |
| Review offline | chromebook, windows | dark, light | tap target under 44x44 | button "Copy all" 99.9x32; button "Print / PDF" 117.3x32; button "Copy ranks again" 162.3x32 |
| Review offline | android | dark, light | text overflows its box | div "Clear characters and strong pops. Work on the intr" by 4 px |
| Room: public address (OO) | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | a "About Original Oratory" 38x24; a "Rank the room · 0 of 6" 193.7x32; button "Change 101" 32x32 |
| Room: limited prep (USX) | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | a "About United States Extemporaneous Speaking" 45.2x24; input "The question the speaker drew" 343x40; input "The question the speaker drew" 362x40 |
| Room: Pro Con Challenge (PCC) | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | a "About Pro Con Challenge" 45.5x24; input "The student's topic" 343x40; input "The student's topic" 362x40 |
| Rate | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | button "1" 30.7x44; button "2" 30.7x44; button "3" 30.7x44 |
| History | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | select "All events Humorous Interpretation Pro Con Challen" 369x40; select "All tournaments Winter Invitational" 369x40; label "Include names and comments" 226.1x32 |
| Settings | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | label "Match this device" 145.6x32; label "Light" 61.8x32; label "Dark" 60.1x32 |
| Palette | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | label "Match this device" 145.6x32; label "Light" 61.8x32; label "Dark" 60.1x32 |
| Congress setup | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | input "Winter Invitational" 369x40; input "204" 369x40; label "House" 82.2x40 |
| Congress log | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | select "A Bill to Fund High-Speed Rail A Resolution on Wat" 343x40; select "Authorship Sponsorship First negative Rebuttal Ext" 343x40; button "1" 40x40 |
| Congress PO hour | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | button "4" 40x40; button "5" 40x40; button "6" 40x40 |
| Congress rank | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | button "1 206" 182.5x42; button "2 204" 182.5x42; button "3 202" 182.5x42 |
| Congress review | chromebook, windows | dark, light | tap target under 44x44 | a "Chamber" 107.4x32; button "Copy" 69.6x40; button "Copy ranks" 110.8x40 |
| Congress review | android, iphone | dark, light | text overflows its box | pre "206 · A Bill to Fund High-Speed Rail · Aff · Rebut" by 2 px; pre "206 · A Bill to Fund High-Speed Rail · Aff · Rebut" by 3 px |
| Congress offline | android, iphone | dark, light | page scrolls sideways | 115 px wider than the screen; 96 px wider than the screen |
| Congress offline | chromebook, windows | dark, light | tap target under 44x44 | a "Chamber" 107.4x32; button "✓ Copied" 89.9x28; button "Copy" 69.6x40 |
| Congress offline | android, iphone | dark, light | text overflows its box | pre "206 · A Bill to Fund High-Speed Rail · Aff · Rebut" by 2 px; pre "206 · A Bill to Fund High-Speed Rail · Aff · Rebut" by 3 px |
| Congress chambers | chromebook, ipad, windows | dark, light | tap target under 44x44 | a "New chamber" 127.9x40; a "House · Winter Invitational · 204 8 legislators · " 694x24; a "House · Winter Invitational · 204 8 legislators · " 702x24 |
| My day (with rounds) | android, chromebook, ipad, iphone, windows | dark, light | tap target under 44x44 | a "About Original Oratory" 38x24; button "More for OO Untitled round" 32x48; a "About Humorous Interpretation" 31.3x24 |

### Limits of the emulated pass

- Chromium draws every profile. Safari's WebKit is not installed here, so the iPhone and iPad rows show Safari's
  screen size and user agent, not Safari's engine. Real Safari can differ (date inputs, clipboard prompts, `100vh`,
  storage rules).
- The clock is faked, so screen sleep, a locked screen and a backgrounded app are not tested. The real-device
  checklist covers them (steps 9 to 11).
- Installing to the home screen, real screen readers, text zoom and the 3-day reopen need the real devices.
- Clipboard checks run with the permission already granted. A real browser may prompt.
