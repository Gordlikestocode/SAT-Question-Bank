const ASSESSMENT_SAT = 99;
const SECTION_NAMES = {
  1: "Reading and Writing",
  2: "Math",
};
const DIFFICULTY_NAMES = {
  E: "Easy",
  M: "Medium",
  H: "Hard",
};

const state = {
  allQuestions: [],
  filteredQuestions: [],
  selectedId: null,
  selectedQuestion: null,
  selectedPayload: null,
  selectedAnswer: null,
  answerChecked: false,
  filters: {
    section: "all",
    difficulty: "all",
    domain: "all",
    skill: "all",
    active: "all",
    search: "",
  },
};

const elements = {
  sectionFilter: document.querySelector("#sectionFilter"),
  difficultyFilter: document.querySelector("#difficultyFilter"),
  domainFilter: document.querySelector("#domainFilter"),
  skillFilter: document.querySelector("#skillFilter"),
  activeFilter: document.querySelector("#activeFilter"),
  searchFilter: document.querySelector("#searchFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  questionList: document.querySelector("#questionList"),
  resultCount: document.querySelector("#resultCount"),
  resultSummary: document.querySelector("#resultSummary"),
  questionNumber: document.querySelector("#questionNumber"),
  viewerMeta: document.querySelector("#viewerMeta"),
  stimulusContent: document.querySelector("#stimulusContent"),
  questionContent: document.querySelector("#questionContent"),
  answerArea: document.querySelector("#answerArea"),
  checkAnswer: document.querySelector("#checkAnswer"),
  showRationale: document.querySelector("#showRationale"),
  rationaleArea: document.querySelector("#rationaleArea"),
  previousQuestion: document.querySelector("#previousQuestion"),
  nextQuestion: document.querySelector("#nextQuestion"),
  footerQuestion: document.querySelector("#footerQuestion"),
};

function parseHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return {};
  return Object.fromEntries(new URLSearchParams(hash));
}

function writeHash() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  if (state.selectedId) params.set("q", state.selectedId);
  const newHash = params.toString();
  const currentHash = window.location.hash.replace(/^#/, "");
  if (newHash !== currentHash) {
    history.replaceState(null, "", newHash ? `#${newHash}` : window.location.pathname);
  }
}

function difficultyLabel(value) {
  return DIFFICULTY_NAMES[value] || "Unknown";
}

function difficultyClass(value) {
  return {
    E: "easy",
    M: "medium",
    H: "hard",
  }[value] || "";
}

function normalizeForSearch(text) {
  return String(text || "").toLowerCase();
}

function getQuestionFileId(question) {
  return question.externalId || question.ibn || question.uid || question.questionId;
}

function normalizeIndexQuestion(rawQuestion, test) {
  const active = Boolean(rawQuestion.ibn);
  const id = `${test}:${rawQuestion.external_id || rawQuestion.ibn || rawQuestion.uId || rawQuestion.questionId}`;
  return {
    id,
    test,
    section: SECTION_NAMES[test] || `Section ${test}`,
    questionId: rawQuestion.questionId,
    uid: rawQuestion.uId,
    externalId: rawQuestion.external_id,
    ibn: rawQuestion.ibn,
    fileId: rawQuestion.external_id || rawQuestion.ibn,
    difficulty: rawQuestion.difficulty || "",
    skillCode: rawQuestion.skill_cd || "",
    skill: normalizeSkillName(rawQuestion.skill_desc || "Unknown skill"),
    domainCode: rawQuestion.primary_class_cd || "",
    domain: rawQuestion.primary_class_cd_desc || "Unknown domain",
    scoreBand: rawQuestion.score_band_range_cd,
    active,
    searchText: normalizeForSearch([
      rawQuestion.questionId,
      rawQuestion.uId,
      rawQuestion.external_id,
      rawQuestion.ibn,
      rawQuestion.skill_cd,
      rawQuestion.skill_desc,
      rawQuestion.primary_class_cd,
      rawQuestion.primary_class_cd_desc,
      rawQuestion.difficulty,
      SECTION_NAMES[test],
    ].join(" ")),
  };
}

function normalizeSkillName(skill) {
  return skill.replace("Cross-text Connections", "Cross-Text Connections").trim();
}

function sortQuestions(a, b) {
  return (
    a.test - b.test ||
    a.domain.localeCompare(b.domain) ||
    a.skill.localeCompare(b.skill) ||
    difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty) ||
    a.id.localeCompare(b.id)
  );
}

function difficultyOrder(value) {
  return { E: 0, M: 1, H: 2 }[value] ?? 9;
}

async function loadIndex() {
  elements.questionList.innerHTML = '<div class="loading">Loading SAT question index...</div>';
  try {
    const response = await fetch("archive/get-questions.json");
    if (!response.ok) throw new Error(`Could not load archive/get-questions.json (${response.status})`);
    const data = await response.json();
    const questions = [];

    Object.entries(data).forEach(([rawKey, rawQuestions]) => {
      const key = JSON.parse(rawKey);
      if (Number(key.asmtEventId) !== ASSESSMENT_SAT) return;
      rawQuestions.forEach((rawQuestion) => {
        questions.push(normalizeIndexQuestion(rawQuestion, Number(key.test)));
      });
    });

    state.allQuestions = questions.sort(sortQuestions);
    hydrateFiltersFromHash();
    applyFilters({ selectFirst: true });
  } catch (error) {
    elements.resultCount.textContent = "Unable to load";
    elements.resultSummary.textContent = "Run this app from a local web server, not directly from the file system.";
    elements.questionList.innerHTML = `<div class="error-message">${error.message}</div>`;
  }
}

function hydrateFiltersFromHash() {
  const params = parseHash();
  Object.keys(state.filters).forEach((key) => {
    if (params[key]) state.filters[key] = params[key];
  });
  state.selectedId = params.q || null;
  syncFilterControls();
}

function syncFilterControls() {
  elements.sectionFilter.value = state.filters.section;
  elements.difficultyFilter.value = state.filters.difficulty;
  elements.activeFilter.value = state.filters.active;
  elements.searchFilter.value = state.filters.search;
}

function uniqueOptions(questions, key, labelKey = key) {
  const map = new Map();
  questions.forEach((question) => {
    const value = question[key] || "unknown";
    const label = question[labelKey] || value;
    if (!map.has(value)) map.set(value, label);
  });
  return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function updateDomainAndSkillOptions() {
  const sectionQuestions = state.allQuestions.filter((question) => {
    return state.filters.section === "all" || String(question.test) === state.filters.section;
  });

  renderSelectOptions(elements.domainFilter, uniqueOptions(sectionQuestions, "domainCode", "domain"), "All domains");
  if (!elements.domainFilter.querySelector(`option[value="${CSS.escape(state.filters.domain)}"]`)) {
    state.filters.domain = "all";
  }
  elements.domainFilter.value = state.filters.domain;

  const skillBase = sectionQuestions.filter((question) => {
    return state.filters.domain === "all" || question.domainCode === state.filters.domain;
  });
  renderSelectOptions(elements.skillFilter, uniqueOptions(skillBase, "skillCode", "skill"), "All skills");
  if (!elements.skillFilter.querySelector(`option[value="${CSS.escape(state.filters.skill)}"]`)) {
    state.filters.skill = "all";
  }
  elements.skillFilter.value = state.filters.skill;
}

function renderSelectOptions(select, options, allLabel) {
  const current = select.value || "all";
  select.innerHTML = `<option value="all">${allLabel}</option>`;
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  select.value = current;
}

function applyFilters({ selectFirst = false } = {}) {
  updateDomainAndSkillOptions();
  const search = normalizeForSearch(state.filters.search);
  state.filteredQuestions = state.allQuestions.filter((question) => {
    if (state.filters.section !== "all" && String(question.test) !== state.filters.section) return false;
    if (state.filters.difficulty !== "all" && question.difficulty !== state.filters.difficulty) return false;
    if (state.filters.domain !== "all" && question.domainCode !== state.filters.domain) return false;
    if (state.filters.skill !== "all" && question.skillCode !== state.filters.skill) return false;
    if (state.filters.active === "active" && !question.active) return false;
    if (state.filters.active === "non" && question.active) return false;
    if (search && !question.searchText.includes(search)) return false;
    return true;
  });

  if (!state.filteredQuestions.some((question) => question.id === state.selectedId)) {
    state.selectedId = selectFirst && state.filteredQuestions[0] ? state.filteredQuestions[0].id : null;
  }

  renderQuestionList();
  renderStats();
  writeHash();

  if (state.selectedId) {
    selectQuestion(state.selectedId);
  } else {
    renderEmptyViewer();
  }
}

function renderStats() {
  const total = state.allQuestions.length;
  const activeCount = state.filteredQuestions.filter((question) => question.active).length;
  elements.resultCount.textContent = `${state.filteredQuestions.length.toLocaleString()} of ${total.toLocaleString()} SAT questions`;
  elements.resultSummary.textContent = `${activeCount.toLocaleString()} active in Bluebook; ${(state.filteredQuestions.length - activeCount).toLocaleString()} not active.`;
}

function renderQuestionList() {
  if (!state.filteredQuestions.length) {
    elements.questionList.innerHTML = '<div class="loading">No questions match those filters.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filteredQuestions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `question-card${question.id === state.selectedId ? " active" : ""}`;
    button.dataset.id = question.id;
    button.innerHTML = `
      <div class="card-top">
        <span class="card-number">${index + 1}</span>
        <span class="difficulty-pill ${difficultyClass(question.difficulty)}">${difficultyLabel(question.difficulty)}</span>
      </div>
      <p class="card-title">${escapeHtml(question.domain)}</p>
      <p class="card-subtitle">${escapeHtml(question.skill)}</p>
      <p class="card-subtitle">${escapeHtml(question.section)} · Score band ${escapeHtml(question.scoreBand || "-")}</p>
      <span class="pill ${question.active ? "active-status" : "inactive-status"}">${question.active ? "Bluebook active" : "Not active"}</span>
    `;
    button.addEventListener("click", () => selectQuestion(question.id));
    fragment.append(button);
  });

  elements.questionList.replaceChildren(fragment);
}

async function selectQuestion(id) {
  const question = state.filteredQuestions.find((item) => item.id === id) || state.allQuestions.find((item) => item.id === id);
  if (!question) return;

  state.selectedId = id;
  state.selectedQuestion = question;
  state.selectedPayload = null;
  state.selectedAnswer = null;
  state.answerChecked = false;
  writeHash();
  renderQuestionList();
  renderLoadingViewer(question);

  try {
    const payload = await fetchQuestionPayload(question);
    state.selectedPayload = normalizeQuestionPayload(payload, question);
    renderQuestionViewer();
  } catch (error) {
    renderQuestionError(question, error);
  }
}

async function fetchQuestionPayload(question) {
  const fileId = getQuestionFileId(question);
  if (!fileId) throw new Error("This question is missing an archive file identifier.");
  const response = await fetch(`archive/99/${question.test}/${encodeURIComponent(fileId)}.json`);
  if (!response.ok) throw new Error(`Could not load question file (${response.status}).`);
  return response.json();
}

function normalizeQuestionPayload(rawPayload, question) {
  if (Array.isArray(rawPayload)) {
    const item = rawPayload[0] || {};
    const answer = item.answer || {};
    const choices = answer.choices || {};
    const options = Object.entries(choices).map(([letter, choice]) => ({
      id: letter.toUpperCase(),
      label: letter.toUpperCase(),
      content: choice.body || "",
    }));
    const correct = answer.correct_choice ? [answer.correct_choice.toUpperCase()] : normalizeCorrectAnswers(answer.correct_answer || answer.answer);
    return {
      type: String(answer.style || "Multiple Choice").toLowerCase().includes("spr") ? "spr" : "mcq",
      stimulus: item.stimulus || "",
      stem: item.prompt || "",
      options,
      correct,
      rationale: answer.rationale || "",
      sourceLabel: question.ibn || item.item_id || question.fileId,
    };
  }

  const options = (rawPayload.answerOptions || []).map((option, index) => ({
    id: option.id,
    label: String.fromCharCode(65 + index),
    content: option.content || "",
  }));
  return {
    type: rawPayload.type || (options.length ? "mcq" : "spr"),
    stimulus: rawPayload.stimulus || "",
    stem: rawPayload.stem || "",
    options,
    correct: normalizeCorrectAnswers(rawPayload.correct_answer || rawPayload.keys),
    rationale: rawPayload.rationale || "",
    sourceLabel: rawPayload.externalid || question.externalId || question.fileId,
  };
}

function normalizeCorrectAnswers(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).toUpperCase());
  if (value === undefined || value === null) return [];
  return [String(value).toUpperCase()];
}

function renderLoadingViewer(question) {
  elements.questionNumber.textContent = getSelectedQuestionNumber();
  elements.viewerMeta.textContent = `${question.section} · ${question.domain} · ${question.skill}`;
  elements.stimulusContent.className = "question-html empty-state";
  elements.stimulusContent.textContent = "Loading question content...";
  elements.questionContent.innerHTML = "";
  elements.answerArea.innerHTML = "";
  elements.rationaleArea.hidden = true;
  elements.rationaleArea.innerHTML = "";
  elements.checkAnswer.disabled = true;
  elements.showRationale.disabled = true;
  updateFooter();
}

function renderQuestionError(question, error) {
  elements.viewerMeta.textContent = `${question.section} · ${question.domain} · ${question.skill}`;
  elements.stimulusContent.className = "question-html empty-state";
  elements.stimulusContent.textContent = "Question metadata is available, but the archived question body could not be loaded.";
  elements.questionContent.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`;
  elements.answerArea.innerHTML = "";
  updateFooter();
}

function renderQuestionViewer() {
  const question = state.selectedQuestion;
  const payload = state.selectedPayload;
  const hasStimulus = Boolean(payload.stimulus && payload.stimulus.trim());

  elements.questionNumber.textContent = getSelectedQuestionNumber();
  elements.viewerMeta.textContent = [
    question.section,
    difficultyLabel(question.difficulty),
    question.active ? "Bluebook active" : "Not active",
    payload.sourceLabel,
  ].filter(Boolean).join(" · ");

  if (hasStimulus) {
    elements.stimulusContent.className = "question-html";
    elements.stimulusContent.innerHTML = payload.stimulus;
    elements.questionContent.innerHTML = payload.stem;
  } else {
    elements.stimulusContent.className = "question-html empty-state";
    elements.stimulusContent.innerHTML = `
      <strong>${escapeHtml(question.domain)}</strong><br>
      ${escapeHtml(question.skill)}<br><br>
      This item does not include a separate passage pane, so the full prompt appears on the right.
    `;
    elements.questionContent.innerHTML = payload.stem;
  }

  renderAnswers(payload);
  elements.rationaleArea.hidden = true;
  elements.rationaleArea.innerHTML = "";
  elements.checkAnswer.disabled = false;
  elements.showRationale.disabled = !payload.rationale;
  updateFooter();
}

function renderAnswers(payload) {
  elements.answerArea.innerHTML = "";
  state.selectedAnswer = null;
  state.answerChecked = false;

  if (payload.type === "spr" || !payload.options.length) {
    const wrapper = document.createElement("label");
    wrapper.className = "spr-response";
    wrapper.innerHTML = `
      <strong>Student-produced response</strong>
      <span>Enter your answer exactly as a number or expression.</span>
      <input id="sprInput" type="text" autocomplete="off" inputmode="decimal" />
      <div id="sprFeedback"></div>
    `;
    elements.answerArea.append(wrapper);
    wrapper.querySelector("input").addEventListener("input", (event) => {
      state.selectedAnswer = event.target.value.trim();
    });
    return;
  }

  const fragment = document.createDocumentFragment();
  payload.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.dataset.answer = option.label;
    button.innerHTML = `
      <span class="choice-letter">${escapeHtml(option.label)}</span>
      <span class="question-html">${option.content}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedAnswer = option.label;
      state.answerChecked = false;
      document.querySelectorAll(".choice-button").forEach((choice) => {
        choice.classList.toggle("selected", choice === button);
        choice.classList.remove("correct", "incorrect");
      });
    });
    fragment.append(button);
  });
  elements.answerArea.append(fragment);
}

function checkSelectedAnswer() {
  const payload = state.selectedPayload;
  if (!payload) return;
  const correctAnswers = payload.correct.map((answer) => normalizeAnswer(answer));
  const selected = normalizeAnswer(state.selectedAnswer);
  const isCorrect = selected && correctAnswers.includes(selected);
  state.answerChecked = true;

  if (payload.type === "spr" || !payload.options.length) {
    const feedback = document.querySelector("#sprFeedback");
    if (!feedback) return;
    feedback.className = `feedback ${isCorrect ? "correct" : "incorrect"}`;
    feedback.textContent = isCorrect
      ? "Correct."
      : `Not quite. Correct answer: ${payload.correct.join(" or ")}`;
    return;
  }

  document.querySelectorAll(".choice-button").forEach((button) => {
    const value = normalizeAnswer(button.dataset.answer);
    button.classList.toggle("correct", correctAnswers.includes(value));
    button.classList.toggle("incorrect", value === selected && !correctAnswers.includes(value));
  });
}

function normalizeAnswer(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function showRationale() {
  if (!state.selectedPayload?.rationale) return;
  elements.rationaleArea.hidden = false;
  elements.rationaleArea.innerHTML = `
    <h3>Explanation</h3>
    <div class="question-html">${state.selectedPayload.rationale}</div>
  `;
}

function getSelectedQuestionNumber() {
  const index = state.filteredQuestions.findIndex((question) => question.id === state.selectedId);
  return index >= 0 ? index + 1 : "-";
}

function updateFooter() {
  const index = state.filteredQuestions.findIndex((question) => question.id === state.selectedId);
  const total = state.filteredQuestions.length;
  elements.footerQuestion.textContent = index >= 0 ? `Question ${index + 1} of ${total}` : "Question - of -";
  elements.previousQuestion.disabled = index <= 0;
  elements.nextQuestion.disabled = index < 0 || index >= total - 1;
}

function moveSelection(delta) {
  const index = state.filteredQuestions.findIndex((question) => question.id === state.selectedId);
  const next = state.filteredQuestions[index + delta];
  if (next) selectQuestion(next.id);
}

function renderEmptyViewer() {
  elements.questionNumber.textContent = "-";
  elements.viewerMeta.textContent = "Select a question to begin.";
  elements.stimulusContent.className = "question-html empty-state";
  elements.stimulusContent.textContent = "No question is selected.";
  elements.questionContent.innerHTML = "";
  elements.answerArea.innerHTML = "";
  elements.rationaleArea.hidden = true;
  elements.checkAnswer.disabled = true;
  elements.showRationale.disabled = true;
  updateFooter();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  const filterBindings = [
    [elements.sectionFilter, "section"],
    [elements.difficultyFilter, "difficulty"],
    [elements.domainFilter, "domain"],
    [elements.skillFilter, "skill"],
    [elements.activeFilter, "active"],
  ];

  filterBindings.forEach(([element, key]) => {
    element.addEventListener("change", () => {
      state.filters[key] = element.value;
      if (key === "section") {
        state.filters.domain = "all";
        state.filters.skill = "all";
      }
      if (key === "domain") state.filters.skill = "all";
      applyFilters({ selectFirst: true });
    });
  });

  elements.searchFilter.addEventListener("input", () => {
    state.filters.search = elements.searchFilter.value.trim();
    applyFilters({ selectFirst: true });
  });

  elements.resetFilters.addEventListener("click", () => {
    state.filters = {
      section: "all",
      difficulty: "all",
      domain: "all",
      skill: "all",
      active: "all",
      search: "",
    };
    syncFilterControls();
    applyFilters({ selectFirst: true });
  });

  document.querySelectorAll("[data-quick-active]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.active = button.dataset.quickActive;
      elements.activeFilter.value = state.filters.active;
      applyFilters({ selectFirst: true });
    });
  });

  document.querySelectorAll("[data-quick-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.difficulty = button.dataset.quickDifficulty;
      elements.difficultyFilter.value = state.filters.difficulty;
      applyFilters({ selectFirst: true });
    });
  });

  document.querySelectorAll("[data-quick-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.section = button.dataset.quickSection;
      state.filters.domain = "all";
      state.filters.skill = "all";
      elements.sectionFilter.value = state.filters.section;
      applyFilters({ selectFirst: true });
    });
  });

  elements.checkAnswer.addEventListener("click", checkSelectedAnswer);
  elements.showRationale.addEventListener("click", showRationale);
  elements.previousQuestion.addEventListener("click", () => moveSelection(-1));
  elements.nextQuestion.addEventListener("click", () => moveSelection(1));
}

bindEvents();
loadIndex();
