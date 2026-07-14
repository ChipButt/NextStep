# Next Step

Next Step is a single-user, mobile-first Progressive Web App for executive dysfunction. It is not a conventional to-do list: it collects tasks, asks a few state questions, chooses one task, and gives one small physical next action.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints, usually:

```text
http://127.0.0.1:5173/
```

## Test And Build

```bash
npm test
npm run build
```

The decision engine tests cover scoring, exclusions, rejected tasks, deadlines, prerequisite creation, action validation, pause/resume, discovered tasks, determinism, storage persistence, and voice command parsing.

## Voice Use

Next Step can be used mainly by voice in browsers that support the Web Speech API.

1. Turn on **Voice mode** from the microphone panel or Settings.
2. The app will speak the current prompt.
3. Say short commands such as:

```text
add task reply to the venue email
help me start
yes
no
not sure
five minutes
medium
I cannot start
help me begin
done
I am stuck
I got distracted
I discovered another task buy stamps
pause
resume this task
repeat
exit session
```

If speech recognition is unavailable, use the **Type a voice command** field. Spoken prompts can also be enabled without continuous listening.

## Project Structure

```text
src/
  components/       Shared UI controls
  screens/          Start, session, task inbox, history, settings
  engine/           State machine, scoring, task breakdown, blocker responses
  storage/          Local storage import/export
  data/             Sample task data
  voice/            Speech command parsing and recognition hook
  tests/            Automated tests
```

All persistent data is stored locally in the browser. There is no login, external database, Firebase, paid API, or AI API in version 1.
