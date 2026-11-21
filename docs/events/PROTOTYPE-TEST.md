# Speech Events prototype: 5-judge lay test

Goal: learn if a parent judge can run a 6-speaker room with the prototype, with no help. This is the test in [DESIGN.md](DESIGN.md) §6 and [PLAN.md](PLAN.md) P2.

The prototype is throwaway. It has no AI, no network calls and no recording. It saves only in the browser on that device.

## Before the day

1. Find 5 lay judges. Lay means they judged 0 to 3 tournaments. No coaches.
2. Find 6 students who will each give a practice speech. The room uses Expository, which has a 5:00 limit. Ask five students to speak 2–3 minutes. Ask one student to speak about 5:40, so the judge sees the grace and over-grace stages. One room then takes about 30 minutes.
3. Use the "NSDA district rules" preset (30 s grace, no rank 1 past grace).
4. Load the prototype on the judge's own phone or laptop:
   - From the repo folder, run `python3 -m http.server 8765`, then open `http://<this computer's address>:8765/events/prototype/` on the judge's device (same Wi-Fi).
   - Or open `events/prototype/index.html` straight from disk on a laptop.
5. Write the room text on a card, the way Tabroom shows it. Give each judge the same text to paste or type.
6. Clear the device between judges: on the last screen, tap "New room", or clear the site data.

## Tasks (read each one aloud; do not show how)

1. "Set up the room for Expository. Here are the codes." Hand over the card.
2. "Time the first speaker. Write one strength and one thing to work on."
3. "The third speaker came late. Move them to the end."
4. "Time every speaker. Write a short note for each."
5. "Rank the room." (Do not mention the time rule. Watch if the judge tries to put the long speaker first.)
6. "Send the ranks to the tab room." (They copy the ranks. A text box can stand in for Tabroom.)
7. "Now copy each comment."

Say nothing while they work. If a judge is stuck for 60 seconds, give one hint and mark the task "helped".

## What to time and note

| Measure | How |
|---|---|
| Setup time | From "Here are the codes" to the room screen. |
| Time to first timer start | From the room screen to the first Start tap. |
| Missed timer starts | A speaker begins and the timer is not running within 5 seconds. |
| Rank time | From the last speaker's Stop to "Copy ranks". Goal: under 5 minutes. |
| Rule message | Did the judge try to put the over-grace speaker first? Did they understand the message? |
| Stuck points | Each place a judge stops for 10 seconds or more. Write the screen and what they said. |
| Done or helped | Per task: done alone, done with a hint, or not done. |

Also note the device (phone or laptop) and if the judge used drag, "Tap in order" or Up / Down to rank.

## 3 short questions (ask after the room)

1. "What was the hardest part?"
2. "Was anything on the screen confusing or in your way while a student was speaking?"
3. "Would you use this at your next tournament instead of paper? Why or why not?"

## What counts as a pass

- 4 of 5 judges finish tasks 1, 2, 5 and 6 with no hint.
- No judge misses a timer start because of the screen.
- 4 of 5 say yes to question 3.

Write the results in the shared notes folder. A fail on any line goes back into DESIGN.md before the real build.
