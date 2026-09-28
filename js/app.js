// ---- 과목 목록 페이지 (index.html) ----
async function loadSubjectList() {
  const grid = document.getElementById("subject-grid");
  try {
    const res = await fetch("data/subjects.json");
    const subjects = await res.json();
    grid.innerHTML = subjects
      .map(
        (s) => `
        <a class="subject-card" href="quiz.html?subject=${encodeURIComponent(s.id)}">
          <h3>${s.name}</h3>
          <span>문제 풀어보기 &rarr;</span>
        </a>`
      )
      .join("");
  } catch (e) {
    grid.innerHTML = `<p>과목 목록을 불러오지 못했습니다. (${e.message})</p>`;
  }
}

// ---- 퀴즈 페이지 (quiz.html) ----

const COUNT_TIERS = [
  { key: "entry", label: "Entry", count: 5 },
  { key: "gen", label: "Gen", count: 10 },
  { key: "air", label: "Air", count: 25 },
  { key: "pro", label: "Pro", count: 50 },
  { key: "duo", label: "Duo", count: 100 },
];

const TIME_TIERS = [
  { key: "gen", label: "Gen", minutes: 5 },
  { key: "mini", label: "Mini", minutes: 15 },
  { key: "air", label: "Air", minutes: 30 },
  { key: "pro", label: "Pro", minutes: 50 },
];

const state = {
  subjectId: null,
  subjectName: "",
  allQuestions: [],
  questions: [],
  current: 0,
  selectedIndex: null,
  answers: [], // { selected, correct }
  selectedCount: null,
  selectedMinutes: null,
  timerId: null,
  remainingSeconds: 0,
  timeUp: false,
};

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 문제문이 "지시문\n\n지문" 형태이면 지문을 별도 박스로 분리해 보여준다.
function renderQuestionText(question) {
  const parts = question.split(/\n\n+/);
  if (parts.length < 2) {
    return `<p class="question-text">${escapeHtml(question)}</p>`;
  }
  const instruction = parts[0];
  const passage = parts.slice(1).join("\n\n");
  return `
    <p class="question-text">${escapeHtml(instruction)}</p>
    <div class="passage-box">${escapeHtml(passage)}</div>
  `;
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function initQuiz() {
  const subjectId = getQueryParam("subject");
  const setupArea = document.getElementById("setup-area");

  if (!subjectId) {
    setupArea.innerHTML = "<p>과목이 지정되지 않았습니다. 목록으로 돌아가 과목을 선택해주세요.</p>";
    return;
  }

  try {
    const subjectsRes = await fetch("data/subjects.json");
    const subjects = await subjectsRes.json();
    const subject = subjects.find((s) => s.id === subjectId);

    if (!subject) {
      setupArea.innerHTML = "<p>존재하지 않는 과목입니다.</p>";
      return;
    }

    state.subjectId = subject.id;
    state.subjectName = subject.name;
    document.getElementById("subject-title").textContent = subject.name;
    document.title = `${subject.name} | 퀴즈`;

    const qRes = await fetch(`data/${subject.file}`);
    const questions = await qRes.json();
    state.allQuestions = questions;

    renderSetup();
  } catch (e) {
    setupArea.innerHTML = `<p>문제를 불러오지 못했습니다. (${e.message})</p>`;
  }
}

function renderSetup() {
  const setupArea = document.getElementById("setup-area");
  const quizArea = document.getElementById("quiz-area");
  const resultArea = document.getElementById("result-area");
  const progressBarWrap = document.getElementById("progress-bar-wrap");
  const timerText = document.getElementById("timer-text");

  quizArea.style.display = "none";
  resultArea.style.display = "none";
  progressBarWrap.style.display = "none";
  timerText.style.display = "none";
  document.getElementById("progress-text").textContent = "";

  const total = state.allQuestions.length;
  state.selectedCount = null;
  state.selectedMinutes = null;

  const countButtonsHtml = COUNT_TIERS.map((t) => {
    const disabled = t.count > total;
    return `<button class="select-btn" data-count="${t.count}" ${disabled ? "disabled" : ""}>
      <strong>${t.label}</strong>${t.count}문제${disabled ? "<br/><small>(문제 부족)</small>" : ""}
    </button>`;
  }).join("") + `<button class="select-btn random-btn" data-random="count">
      <strong>🎲 랜덤</strong>무작위 선택
    </button>`;

  const timeButtonsHtml = TIME_TIERS.map((t) => `
    <button class="select-btn" data-minutes="${t.minutes}">
      <strong>${t.label}</strong>${t.minutes}분
    </button>`).join("") + `<button class="select-btn random-btn" data-random="time">
      <strong>🎲 랜덤</strong>무작위 선택
    </button>`;

  setupArea.innerHTML = `
    <div class="setup-card">
      <h2>문제지 유형</h2>
      <p class="setup-hint">전체 ${total}문제 중 몇 문제를 풀어볼까요?</p>
      <div class="option-group" id="count-group">${countButtonsHtml}</div>
      <p class="setup-hint random-hint" id="count-random-hint" style="min-height: 1.2em;"></p>

      <h2>문제 풀이 시간</h2>
      <p class="setup-hint">제한 시간을 선택하세요. 시간이 끝나면 자동으로 채점됩니다.</p>
      <div class="option-group" id="time-group">${timeButtonsHtml}</div>
      <p class="setup-hint random-hint" id="time-random-hint" style="min-height: 1.2em;"></p>

      <button class="primary" id="start-quiz-btn" disabled style="width:100%;">문제 수와 시간을 선택하세요</button>
    </div>
  `;

  const countGroup = document.getElementById("count-group");
  const timeGroup = document.getElementById("time-group");
  const startBtn = document.getElementById("start-quiz-btn");
  const countRandomHint = document.getElementById("count-random-hint");
  const timeRandomHint = document.getElementById("time-random-hint");

  function selectCountButton(btn) {
    countGroup.querySelectorAll(".select-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  }

  function selectTimeButton(btn) {
    timeGroup.querySelectorAll(".select-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  }

  countGroup.querySelectorAll(".select-btn[data-count]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectCountButton(btn);
      state.selectedCount = Number(btn.dataset.count);
      countRandomHint.textContent = "";
      updateStartButton();
    });
  });

  timeGroup.querySelectorAll(".select-btn[data-minutes]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectTimeButton(btn);
      state.selectedMinutes = Number(btn.dataset.minutes);
      timeRandomHint.textContent = "";
      updateStartButton();
    });
  });

  const countRandomBtn = countGroup.querySelector('[data-random="count"]');
  countRandomBtn.addEventListener("click", () => {
    const choices = COUNT_TIERS.filter((t) => t.count <= total);
    const picked = choices[Math.floor(Math.random() * choices.length)];
    const targetBtn = countGroup.querySelector(`[data-count="${picked.count}"]`);
    selectCountButton(targetBtn);
    state.selectedCount = picked.count;
    countRandomHint.textContent = `🎲 문제지 유형: ${picked.label}(${picked.count}문제)로 랜덤 선택되었습니다.`;
    updateStartButton();
  });

  const timeRandomBtn = timeGroup.querySelector('[data-random="time"]');
  timeRandomBtn.addEventListener("click", () => {
    const picked = TIME_TIERS[Math.floor(Math.random() * TIME_TIERS.length)];
    const targetBtn = timeGroup.querySelector(`[data-minutes="${picked.minutes}"]`);
    selectTimeButton(targetBtn);
    state.selectedMinutes = picked.minutes;
    timeRandomHint.textContent = `🎲 문제 풀이 시간: ${picked.label}(${picked.minutes}분)으로 랜덤 선택되었습니다.`;
    updateStartButton();
  });

  function updateStartButton() {
    if (state.selectedCount && state.selectedMinutes) {
      startBtn.disabled = false;
      startBtn.textContent = `${state.selectedCount}문제 · ${state.selectedMinutes}분 시작하기`;
    } else {
      startBtn.disabled = true;
      startBtn.textContent = "문제 수와 시간을 선택하세요";
    }
  }

  startBtn.addEventListener("click", beginQuiz);
}

function beginQuiz() {
  const setupArea = document.getElementById("setup-area");
  const quizArea = document.getElementById("quiz-area");
  const progressBarWrap = document.getElementById("progress-bar-wrap");
  const timerText = document.getElementById("timer-text");

  const count = Math.min(state.selectedCount, state.allQuestions.length);
  state.questions = shuffleArray(state.allQuestions).slice(0, count);
  state.answers = new Array(state.questions.length).fill(null);
  state.current = 0;
  state.timeUp = false;

  setupArea.innerHTML = "";
  quizArea.style.display = "block";
  progressBarWrap.style.display = "block";
  timerText.style.display = "inline-block";

  startTimer(state.selectedMinutes * 60);
  renderQuestion();
}

function startTimer(seconds) {
  stopTimer();
  state.remainingSeconds = seconds;
  updateTimerDisplay();
  state.timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    updateTimerDisplay();
    if (state.remainingSeconds <= 0) {
      stopTimer();
      state.timeUp = true;
      renderResult();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimerDisplay() {
  const timerText = document.getElementById("timer-text");
  const m = Math.max(0, Math.floor(state.remainingSeconds / 60));
  const s = Math.max(0, state.remainingSeconds % 60);
  timerText.textContent = `⏱ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  timerText.classList.toggle("warning", state.remainingSeconds <= 30);
}

function renderQuestion() {
  const quizArea = document.getElementById("quiz-area");
  const resultArea = document.getElementById("result-area");
  resultArea.style.display = "none";
  quizArea.style.display = "block";

  const total = state.questions.length;
  const q = state.questions[state.current];
  const savedAnswer = state.answers[state.current];

  document.getElementById("progress-text").textContent = `${state.current + 1} / ${total}`;
  document.getElementById("progress-fill").style.width = `${((state.current + 1) / total) * 100}%`;

  const optionsHtml = q.options
    .map((opt, i) => `<button class="option-btn" data-index="${i}">${opt}</button>`)
    .join("");

  quizArea.innerHTML = `
    <div class="question-card">
      <div class="question-number">문제 ${state.current + 1}</div>
      ${renderQuestionText(q.question)}
      <div class="options" id="options-container">${optionsHtml}</div>
      <div class="explanation" id="explanation">${q.explanation ? `<strong>해설:</strong> ${q.explanation}` : ""}</div>
      <div class="nav-buttons">
        <button class="secondary" id="prev-btn" ${state.current === 0 ? "disabled" : ""}>이전</button>
        <button class="primary" id="next-btn" disabled>${state.current === total - 1 ? "결과 보기" : "다음 문제"}</button>
      </div>
    </div>
  `;

  const optionButtons = quizArea.querySelectorAll(".option-btn");
  optionButtons.forEach((btn) => {
    btn.addEventListener("click", () => selectOption(Number(btn.dataset.index)));
  });

  document.getElementById("prev-btn").addEventListener("click", () => {
    if (state.current > 0) {
      state.current -= 1;
      renderQuestion();
    }
  });

  document.getElementById("next-btn").addEventListener("click", () => {
    if (state.current < total - 1) {
      state.current += 1;
      renderQuestion();
    } else {
      renderResult();
    }
  });

  // 이미 답한 문제라면 선택 상태 복원
  if (savedAnswer !== null) {
    applyAnswerStyles(savedAnswer.selected);
    document.getElementById("next-btn").disabled = false;
  }
}

function selectOption(index) {
  const q = state.questions[state.current];
  if (state.answers[state.current] !== null) return; // 이미 답변함

  const isCorrect = index === q.answer;
  state.answers[state.current] = { selected: index, correct: isCorrect };

  applyAnswerStyles(index);
  document.getElementById("next-btn").disabled = false;
}

function applyAnswerStyles(selectedIndex) {
  const q = state.questions[state.current];
  const buttons = document.querySelectorAll(".option-btn");

  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) {
      btn.classList.add("correct");
    } else if (i === selectedIndex && i !== q.answer) {
      btn.classList.add("wrong");
    }
    if (i === selectedIndex) {
      btn.classList.add("selected");
    }
  });

  const explanation = document.getElementById("explanation");
  if (explanation.textContent.trim() !== "") {
    explanation.classList.add("show");
  }
}

function renderResult() {
  stopTimer();

  const quizArea = document.getElementById("quiz-area");
  const resultArea = document.getElementById("result-area");
  const timerText = document.getElementById("timer-text");
  quizArea.style.display = "none";
  resultArea.style.display = "block";
  timerText.style.display = "none";

  const total = state.questions.length;
  const correctCount = state.answers.filter((a) => a && a.correct).length;
  const percent = Math.round((correctCount / total) * 100);

  const listHtml = state.questions
    .map((q, i) => {
      const a = state.answers[i];
      const isCorrect = a && a.correct;
      return `
        <div class="result-item ${isCorrect ? "correct" : "wrong"}">
          <strong>문제 ${i + 1}.</strong> ${q.question}<br/>
          내 답: ${a ? q.options[a.selected] : "(응답 없음)"} ${isCorrect ? "✅" : `❌ (정답: ${q.options[q.answer]})`}
        </div>`;
    })
    .join("");

  const timeUpNoticeHtml = state.timeUp
    ? `<p style="color: var(--wrong); font-weight: 600;">⏰ 제한 시간이 종료되어 자동으로 채점되었습니다.</p>`
    : "";

  resultArea.innerHTML = `
    <div class="result-card">
      <p>${state.subjectName} · ${state.selectedCount ? COUNT_TIERS.find((t) => t.count === Math.min(state.selectedCount, state.allQuestions.length))?.label ?? "" : ""}</p>
      ${timeUpNoticeHtml}
      <div class="result-score">${correctCount} / ${total} (${percent}점)</div>
      <p style="color: var(--muted);">${percent >= 80 ? "훌륭해요! 🎉" : percent >= 50 ? "조금만 더 복습해봐요 💪" : "처음부터 다시 도전해봐요 📚"}</p>
      <button class="primary" id="retry-btn" style="margin-top: 16px;">다른 유형으로 다시 풀기</button>
      <div class="result-list">${listHtml}</div>
    </div>
  `;

  document.getElementById("progress-fill").style.width = "100%";
  document.getElementById("progress-text").textContent = `${total} / ${total} 완료`;

  document.getElementById("retry-btn").addEventListener("click", () => {
    document.getElementById("result-area").style.display = "none";
    document.getElementById("setup-area").style.display = "block";
    renderSetup();
  });
}
