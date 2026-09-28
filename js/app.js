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
const state = {
  subjectId: null,
  subjectName: "",
  questions: [],
  current: 0,
  selectedIndex: null,
  answers: [], // { selected, correct }
};

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function initQuiz() {
  const subjectId = getQueryParam("subject");
  const quizArea = document.getElementById("quiz-area");

  if (!subjectId) {
    quizArea.innerHTML = "<p>과목이 지정되지 않았습니다. 목록으로 돌아가 과목을 선택해주세요.</p>";
    return;
  }

  try {
    const subjectsRes = await fetch("data/subjects.json");
    const subjects = await subjectsRes.json();
    const subject = subjects.find((s) => s.id === subjectId);

    if (!subject) {
      quizArea.innerHTML = "<p>존재하지 않는 과목입니다.</p>";
      return;
    }

    state.subjectId = subject.id;
    state.subjectName = subject.name;
    document.getElementById("subject-title").textContent = subject.name;
    document.title = `${subject.name} | 퀴즈`;

    const qRes = await fetch(`data/${subject.file}`);
    const questions = await qRes.json();
    state.questions = questions;
    state.answers = new Array(questions.length).fill(null);
    state.current = 0;
    state.selectedIndex = null;

    renderQuestion();
  } catch (e) {
    quizArea.innerHTML = `<p>문제를 불러오지 못했습니다. (${e.message})</p>`;
  }
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
      <p class="question-text">${q.question}</p>
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
  const quizArea = document.getElementById("quiz-area");
  const resultArea = document.getElementById("result-area");
  quizArea.style.display = "none";
  resultArea.style.display = "block";

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

  resultArea.innerHTML = `
    <div class="result-card">
      <p>${state.subjectName}</p>
      <div class="result-score">${correctCount} / ${total} (${percent}점)</div>
      <p style="color: var(--muted);">${percent >= 80 ? "훌륭해요! 🎉" : percent >= 50 ? "조금만 더 복습해봐요 💪" : "처음부터 다시 도전해봐요 📚"}</p>
      <button class="primary" id="retry-btn" style="margin-top: 16px;">다시 풀기</button>
      <div class="result-list">${listHtml}</div>
    </div>
  `;

  document.getElementById("progress-fill").style.width = "100%";
  document.getElementById("progress-text").textContent = `${total} / ${total} 완료`;

  document.getElementById("retry-btn").addEventListener("click", () => {
    state.answers = new Array(total).fill(null);
    state.current = 0;
    renderQuestion();
  });
}
