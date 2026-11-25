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
12. Tap Stop. Type a comment. Tap Next speaker. Repeat steps 8, 12 for all six speakers (short times are fine).

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
| iPhone | | Safari | | | | | waiting for staging and testers | |
| Android phone | | Chrome | | | | | waiting for staging and testers | |
| School Chromebook | | Chrome | | | | | waiting for staging and testers | |
| iPad | | Safari | | | | | waiting for staging and testers | |
| Windows laptop | | Edge | | | | | waiting for staging and testers | |

---

## 2. Emulated pass

EMULATED_PASS_PLACEHOLDER
