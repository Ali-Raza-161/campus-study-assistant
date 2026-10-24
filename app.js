'use strict';

// Campus Study Assistant — fully local, no API key, no backend.
// Pure logic is defined first (and exported for Node testing); DOM code
// only runs when `document` exists, so the same file passes `node --check`
// and can be smoke-tested in Node.

// ---------- Shared helpers ----------
var STOPWORDS = new Set(('a an the and or but of to in on for with by is are was were be been it its this that these those as at from into about over after before between through during each other some any no not only own same so than too very can will just should now he she they we you i his her their our your my me him us them').split(' '));

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 10; });
}

function contentWords(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function (w) { return w.length > 2 && !STOPWORDS.has(w); });
}

// ---------- 1. Extractive summariser ----------
function summarise(text, maxSentences) {
  var sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  if (sentences.length <= 2) return sentences;
  var freq = {};
  contentWords(text).forEach(function (w) { freq[w] = (freq[w] || 0) + 1; });
  var scored = sentences.map(function (s, i) {
    var words = contentWords(s);
    var score = words.reduce(function (acc, w) { return acc + (freq[w] || 0); }, 0);
    score += Math.max(0, 8 - i) * 0.5; // slight bonus for early sentences
    if (words.length >= 4 && words.length <= 30) score += 2; // prefer mid-length sentences
    return { sentence: s, score: score, index: i };
  });
  var keep = Math.max(1, Math.min(maxSentences || 3, sentences.length));
  return scored.sort(function (a, b) { return b.score - a.score; })
    .slice(0, keep)
    .sort(function (a, b) { return a.index - b.index; })
    .map(function (x) { return x.sentence; });
}

// ---------- 2. Quiz generator ----------
// Fill-in-the-blank: blank the longest content word (>=4 letters) in a sentence.
// MCQ: same blanked word as the answer, distractors drawn from other notes words.
function makeQuiz(text) {
  var sentences = splitSentences(text);
  var allWords = [];
  var seen = {};
  contentWords(text).forEach(function (w) { if (!seen[w]) { seen[w] = true; allWords.push(w); } });
  var questions = [];
  sentences.slice(0, 6).forEach(function (sentence, i) {
    var candidates = contentWords(sentence).filter(function (w) { return w.length >= 4; });
    if (candidates.length === 0) return;
    candidates.sort(function (a, b) { return b.length - a.length; });
    var answer = candidates[0];
    var blanked = sentence.replace(new RegExp(answer, 'i'), '______');
    if (i % 2 === 0) {
      questions.push({ type: 'fill', question: blanked, answer: answer });
    } else {
      var distractors = allWords.filter(function (w) { return w !== answer && w.length >= 4; }).slice(0, 3);
      while (distractors.length < 3) distractors.push('revision');
      var options = [answer].concat(distractors);
      // Deterministic shuffle by index so tests are stable.
      options.sort(function (a, b) { return (a.length - b.length) || a.localeCompare(b); });
      questions.push({ type: 'mcq', question: blanked, answer: answer, options: options });
    }
  });
  return questions;
}

// ---------- 3. Q&A over a local knowledge base ----------
var FALLBACK_TOPICS = [
  { id: 'pomodoro', title: 'Pomodoro technique', keywords: ['pomodoro', 'focus timer', 'concentration'], answer: 'The Pomodoro technique is: study for 25 minutes with no phone, take a 5-minute break, and repeat. After 4 rounds, take a longer 15–30 minute break.' },
  { id: 'newton', title: "Newton's laws", keywords: ['newton', 'force', 'inertia'], answer: "Newton's three laws: 1) Inertia — an object stays at rest or in steady motion unless a force acts on it. 2) F = ma — force equals mass × acceleration. 3) Action–reaction — every force has an equal and opposite force." },
  { id: 'loops', title: 'Programming loops', keywords: ['loop', 'for loop', 'while loop', 'iteration'], answer: 'A loop repeats code without writing it again. A for loop repeats a set number of times; a while loop repeats while a condition is true, so it must change something inside the loop or it will run forever.' },
  { id: 'photosynthesis', title: 'Photosynthesis', keywords: ['photosynthesis', 'chlorophyll'], answer: 'Photosynthesis is how plants make food using sunlight: carbon dioxide + water → (light, chlorophyll) → glucose + oxygen. It happens in chloroplasts.' },
  { id: 'revision', title: 'Effective revision', keywords: ['revision', 'revise', 'study tips', 'how to study'], answer: 'Effective revision is active, not just re-reading: close the book and write what you remember, test yourself, and space reviews over days instead of cramming.' }
];
var topics = FALLBACK_TOPICS.slice();
var lastTopic = null; // conversation memory within the session

function findAnswer(rawQuestion) {
  var q = String(rawQuestion || '').toLowerCase();
  if (!q.trim()) return 'Please type a question first — for example, "What is photosynthesis?"';
  var nameMatch = q.match(/my name is ([a-z]+)/);
  if (nameMatch) return 'Nice to meet you, ' + nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1) + '! What would you like to study today?';
  if (/\b(hi|hello|hey)\b/.test(q) && q.length < 30) return 'Hi! Ask me about a study technique or a subject — try "How does the Pomodoro technique work?" or "Explain Newton\'s laws".';
  if (/tell me more|more about|explain more|go on/.test(q) && lastTopic) return lastTopic.answer;
  var best = null; var bestScore = 0;
  topics.forEach(function (t) {
    var score = 0;
    t.keywords.forEach(function (kw) { if (q.indexOf(kw) !== -1) score += kw.split(' ').length * 2; });
    contentWords(t.title).forEach(function (w) { if (q.indexOf(w) !== -1) score += 1; });
    if (score > bestScore) { bestScore = score; best = t; }
  });
  if (best) { lastTopic = best; return best.answer; }
  return 'I don\'t have that topic in my local knowledge base yet. I can help with study techniques (Pomodoro, revision, exam prep), maths (algebra, derivatives, Pythagoras), physics (Newton, energy, circuits), programming (variables, loops, functions), biology (cells, photosynthesis, DNA), and chemistry (periodic table, acids and bases). Try one of those, or the suggestion chips above.';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { summarise: summarise, makeQuiz: makeQuiz, findAnswer: findAnswer, splitSentences: splitSentences };
}

// ---------- Browser-only UI ----------
if (typeof document !== 'undefined') {
  var STORAGE_KEY = 'campusStudyAssistantTasks';

  // --- Planner ---
  function loadTasks() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveTasks(tasks) { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  function renderTasks() {
    var tasks = loadTasks();
    tasks.sort(function (a, b) { return (a.due || '').localeCompare(b.due || ''); });
    var list = document.getElementById('task-list');
    var count = document.getElementById('task-count');
    var open = tasks.filter(function (t) { return !t.done; }).length;
    count.textContent = tasks.length === 0 ? 'No tasks yet — add your first one above.'
      : open + ' open task(s), ' + (tasks.length - open) + ' done.';
    list.innerHTML = '';
    tasks.forEach(function (t) {
      var li = document.createElement('li');
      if (t.done) li.className = 'done';
      var span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = t.title;
      var meta = document.createElement('span');
      meta.className = 'task-meta';
      meta.textContent = t.subject + ' · due ' + t.due;
      var actions = document.createElement('span');
      actions.className = 'task-actions';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = t.done ? 'Undo' : 'Done';
      toggle.addEventListener('click', function () {
        var all = loadTasks();
        var item = all.find(function (x) { return x.id === t.id; });
        if (item) item.done = !item.done;
        saveTasks(all); renderTasks();
      });
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'del'; del.textContent = 'Delete';
      del.addEventListener('click', function () {
        saveTasks(loadTasks().filter(function (x) { return x.id !== t.id; })); renderTasks();
      });
      actions.appendChild(toggle); actions.appendChild(del);
      li.appendChild(span); li.appendChild(meta); li.appendChild(actions);
      list.appendChild(li);
    });
  }
  document.getElementById('task-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = document.getElementById('task-title').value.trim();
    var subject = document.getElementById('task-subject').value.trim();
    var due = document.getElementById('task-due').value;
    if (!title || !subject || !due) return;
    var tasks = loadTasks();
    tasks.push({ id: Date.now(), title: title, subject: subject, due: due, done: false });
    saveTasks(tasks); renderTasks(); e.target.reset();
  });

  // --- Notes: summariser + quiz ---
  var SAMPLE_NOTES = 'Photosynthesis is how plants make food using sunlight. It happens in chloroplasts, in the green pigment chlorophyll. Carbon dioxide and water are turned into glucose and oxygen. The glucose is used for energy and growth, and the oxygen is released into the air. The rate of photosynthesis increases with light intensity up to a point, then levels off.';
  document.getElementById('sample-notes-btn').addEventListener('click', function () {
    document.getElementById('notes-input').value = SAMPLE_NOTES;
  });
  document.getElementById('summarise-btn').addEventListener('click', function () {
    var text = document.getElementById('notes-input').value;
    var out = document.getElementById('summary-output');
    var summary = summarise(text, 3);
    out.textContent = summary.length ? summary.join(' ') : 'Paste at least a couple of sentences of notes first.';
  });
  document.getElementById('quiz-btn').addEventListener('click', function () {
    var text = document.getElementById('notes-input').value;
    var out = document.getElementById('quiz-output');
    var quiz = makeQuiz(text);
    out.innerHTML = '';
    if (!quiz.length) { out.textContent = 'Paste at least a couple of sentences of notes first.'; return; }
    quiz.forEach(function (q, i) {
      var div = document.createElement('div'); div.className = 'quiz-q';
      var p = document.createElement('p'); p.textContent = (i + 1) + '. ' + q.question; div.appendChild(p);
      var ans = document.createElement('div'); ans.className = 'answer'; ans.textContent = 'Answer: ' + q.answer; div.appendChild(ans);
      if (q.type === 'fill') {
        var input = document.createElement('input'); input.type = 'text'; input.placeholder = 'Your answer…';
        var check = document.createElement('button'); check.type = 'button'; check.textContent = 'Check';
        check.addEventListener('click', function () {
          ans.className = 'answer show';
          ans.textContent = input.value.trim().toLowerCase() === q.answer.toLowerCase()
            ? 'Correct! The answer is: ' + q.answer
            : 'Not quite. The answer is: ' + q.answer;
        });
        div.appendChild(input); div.appendChild(check);
      } else {
        q.options.forEach(function (opt) {
          var label = document.createElement('label');
          var radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'q' + i; radio.value = opt;
          label.appendChild(radio); label.appendChild(document.createTextNode(' ' + opt)); div.appendChild(label);
        });
        var check = document.createElement('button'); check.type = 'button'; check.textContent = 'Check';
        check.addEventListener('click', function () {
          var picked = div.querySelector('input[type="radio"]:checked');
          ans.className = 'answer show';
          ans.textContent = picked && picked.value === q.answer
            ? 'Correct! The answer is: ' + q.answer
            : 'Not quite. The answer is: ' + q.answer;
        });
        div.appendChild(check);
      }
      out.appendChild(div);
    });
  });

  // --- Chat ---
  var chatWindow = document.getElementById('chat-window');
  function addMessage(text, who) {
    var div = document.createElement('div');
    div.className = 'msg ' + who; div.textContent = text;
    chatWindow.appendChild(div); chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
  }
  function askQuestion(question) {
    if (!question.trim()) return;
    addMessage(question, 'user');
    var typing = addMessage('Typing…', 'bot typing');
    setTimeout(function () {
      typing.remove();
      addMessage(findAnswer(question), 'bot');
    }, 450);
  }
  document.getElementById('chat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('chat-input');
    askQuestion(input.value); input.value = '';
  });
  document.querySelectorAll('.chips button').forEach(function (btn) {
    btn.addEventListener('click', function () { askQuestion(btn.getAttribute('data-q')); });
  });

  // Load the full knowledge base; fall back to the built-in set if the
  // page was opened via file:// (where fetch of a local JSON may be blocked).
  fetch('data/topics.json').then(function (r) { return r.json(); }).then(function (data) {
    if (data && Array.isArray(data.topics) && data.topics.length) topics = data.topics;
  }).catch(function () { /* keep FALLBACK_TOPICS */ });

  renderTasks();
  addMessage('Hi! I am your campus study assistant. Ask me a study question, or try a suggestion chip below.', 'bot');
}
