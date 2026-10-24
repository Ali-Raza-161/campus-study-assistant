# Campus Study Assistant

A student study assistant website that runs entirely in your browser — no API key, no paid service, no backend server.

## The problem

Students often juggle three separate jobs while studying: keeping track of what is due, making sense of long notes, and testing themselves before an exam. Re-reading notes feels productive but is weak revision, and many study tools need an account or a paid AI subscription just to get started.

This project puts the practical parts in one offline-friendly page: plan the work, shrink the notes, quiz yourself on them, and get quick answers to common study questions.

## Features

1. **Study planner** — Add a task with a subject and due date, list tasks sorted by due date, mark them done (or undo), and delete them. Tasks persist in `localStorage`, so they survive a page refresh.
2. **Notes summariser** — Paste notes and get an extractive summary: the JavaScript scorer ranks sentences by word frequency, position, and length, then returns the most important sentences (up to 3) in their original order. Nothing is rewritten or invented.
3. **Quiz generator from notes** — The same pasted notes become fill-in-the-blank and multiple-choice questions. Fill-in-the-blank questions blank out a key word in a sentence; MCQ questions offer that word plus distractors taken from the notes. Answers can be checked in the page.
4. **Q&A on study topics** — A chat window answers questions from a local knowledge base in `data/topics.json`: study techniques (Pomodoro, revision, exam prep, notes, sleep) and subjects including maths (algebra, derivatives, Pythagoras), physics (Newton, energy, circuits), programming (variables, loops, functions), biology (cells, photosynthesis, DNA), and chemistry (periodic table, acids and bases). It includes a typing indicator, suggestion chips, and short session memory — for example, after asking about Newton's laws, "tell me more" repeats that topic.

## How to run

No build step, no install, no API key.

Option A — open the file directly:

```bash
# open index.html in any modern browser
```

Option B — serve it locally (recommended, so `data/topics.json` loads in full):

```bash
cd campus-study-assistant
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Note: if you open `index.html` via `file://`, some browsers block loading the local JSON file. The app still works in that case because a small built-in fallback knowledge base is included in `app.js`; serving over HTTP gives you the full 22-topic base.

## Sample questions and tasks

**Planner — try this:**
Add task "Revise calculus chapter 3", subject "Maths", due tomorrow. It should appear in the list sorted by date; click "Done" to strike it through, and "Delete" to remove it. Refresh the page: the task is still there (until deleted).

**Summariser — try this:**
Paste the sample notes (click "Load sample notes") and click "Summarise notes". Expected summary: "Photosynthesis is how plants make food using sunlight. The glucose is used for energy and growth, and the oxygen is released into the air. The rate of photosynthesis increases with light intensity up to a point, then levels off."

**Quiz — try this:**
With the same sample notes, click "Generate quiz". Expected first question: a fill-in-the-blank version of "Photosynthesis is how plants make food using sunlight" with the answer "photosynthesis" (checkable in the page). Later questions are MCQs with the correct word among options drawn from the notes.

**Chat Q&A — try these:**
- "How does the Pomodoro technique work?" → 25 minutes of focused study, 5-minute break, repeat; longer break after 4 rounds.
- "Explain Newton's laws of motion" → Inertia, F = ma, and action–reaction, with a walking example.
- "What is a loop in programming?" → A for loop repeats a set number of times; a while loop repeats while a condition is true.

## Honest note: what this is (and is not)

This is a **local, rule-based and extractive system**, not an AI model:

- The summariser picks existing sentences; it does not paraphrase or understand meaning, and it works best on clear, factual notes of at least 3–4 sentences.
- The quiz generator blanks out key words mechanically; it does not understand the notes, so question quality depends on how clear the notes are.
- The chatbot matches keywords against a fixed knowledge base; it cannot answer topics outside that base, do maths for arbitrary numbers, or check current exam dates or syllabuses. For unknown topics it says so and lists what it does cover.

## Future LLM upgrade path

The code is organised so an LLM can be added without rewriting the UI:

1. Keep the planner, summariser, and quiz UI exactly as they are.
2. Add an optional settings field for an API key (stored only in the browser, never in the code) and a `askLLM(question, context)` function in `app.js` that the chat calls only when a key is present.
3. Route "unknown topic" chat questions to the LLM first, and fall back to the local knowledge base when offline or when no key is set — so the app never stops working.
4. Later, use the LLM for abstractive summaries and better quiz distractors, keeping the current extractive/rule-based versions as the offline fallback.

## Files

- `index.html` — page structure: planner, notes, and chat sections
- `styles.css` — clean, mobile-friendly styling
- `app.js` — planner (localStorage), extractive summariser, quiz generator, and keyword Q&A
- `data/topics.json` — 22-topic study Q&A knowledge base
