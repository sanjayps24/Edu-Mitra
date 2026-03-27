/**
 * student.js — Student Dashboard logic for EduMitra.
 * Handles data loading, section navigation, prediction calls, and chatbot.
 */

// ── Demo Data ─────────────────────────────────────────────────────────────────
const DEMO_STUDENT_DATA = {
  name: "Alex Johnson",
  email: "student@demo.com",
  attendance_pct: 74,
  assignment_avg: 82,
  midterm_score: 58,
  final_score: 65,
  quiz_avg: 70,
  semester: "Semester 4",
  department: "Computer Science",
  risk_level: "Medium",
  confidence: 0.79,
  recommendations: [
    "📅 Your attendance is 74% — below the 75% minimum. Make attending every class a priority.",
    "📚 Midterm score needs improvement. Review core concepts and practice past papers.",
    "📈 You're progressing but need focused effort to move to low risk.",
    "🔁 Review weak subjects daily for at least 30 minutes.",
    "💡 Use active recall and spaced repetition for better retention.",
    "🤝 Join a study group — collaborative learning significantly improves performance.",
  ],
  feature_importance: [
    { feature: "attendance_pct",  label: "Attendance %",     importance: 0.35, direction: "negative" },
    { feature: "midterm_score",   label: "Midterm Score",    importance: 0.28, direction: "negative" },
    { feature: "assignment_avg",  label: "Assignment Score", importance: 0.18, direction: "positive" },
    { feature: "final_score",     label: "Final Exam Score", importance: 0.12, direction: "positive" },
    { feature: "quiz_avg",        label: "Quiz Average",     importance: 0.07, direction: "positive" },
  ],
  trend: {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
    attendance: [80, 75, 72, 70, 74, 74],
    assignment:  [78, 80, 82, 85, 82, 82],
    midterm:     [60, 58, 55, 57, 58, 58],
  },
};

// ── App State ─────────────────────────────────────────────────────────────────
let studentData = null;
let trendChartInst = null;
let radarChartInst = null;
let compareChartInst = null;
let fiChartInst = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["student"])) return;
  const user = getUser();

  // Populate sidebar user info
  document.getElementById("sidebarName").textContent = user?.name || "Student";
  document.getElementById("topName").textContent = user?.name || "—";
  document.getElementById("topEmail").textContent = user?.email || "—";
  document.getElementById("avatarText").textContent = (user?.name || "S")[0].toUpperCase();

  await loadStudentData();
});

// ── Load Student Data ─────────────────────────────────────────────────────────
async function loadStudentData() {
  try {
    if (isDemoMode()) throw new Error("demo");
    const user = getUser();
    studentData = await apiCall(`/students/${user.id}/performance`);
  } catch {
    studentData = { ...DEMO_STUDENT_DATA, ...{ name: getUser()?.name || "Student" } };
  }
  renderOverview();
}

// ── Section Navigation ────────────────────────────────────────────────────────
function showSection(section) {
  const sections = ["overview", "performance", "prediction", "chatbot", "recommendations"];
  sections.forEach(s => {
    document.getElementById(`section-${s}`).classList.toggle("hidden", s !== section);
    const navEl = document.getElementById(`nav-${s}`);
    if (navEl) navEl.className = `sidebar-link${s === section ? " active" : ""}`;
  });

  const titles = {
    overview: ["My Dashboard", "Academic Performance Overview"],
    performance: ["Performance Trends", "Score trends over time"],
    prediction: ["Risk Prediction", "Run ML model on your data"],
    chatbot: ["AI Study Assistant", "Get personalized academic tips"],
    recommendations: ["Recommendations", "Personalized improvement tips"],
  };
  document.getElementById("pageTitle").textContent = titles[section][0];
  document.getElementById("pageSubtitle").textContent = titles[section][1];

  // Lazy-render charts
  if (section === "performance") renderPerformanceCharts();
  if (section === "recommendations") renderFullRecommendations();
}

// ── Render Overview ───────────────────────────────────────────────────────────
function renderOverview() {
  const d = studentData;
  if (!d) return;

  // Composite score
  const composite = (
    0.25 * d.attendance_pct +
    0.20 * d.assignment_avg +
    0.25 * d.midterm_score +
    0.20 * d.final_score +
    0.10 * (d.quiz_avg || 70)
  ).toFixed(1);
  document.getElementById("compositeScore").textContent = composite;

  // Risk level
  const risk = d.risk_level || "Medium";
  const conf = Math.round((d.confidence || 0.75) * 100);
  const riskColors = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444" };
  const riskClass = { Low: "risk-low", Medium: "risk-medium", High: "risk-high" };

  document.getElementById("riskLevelText").textContent = risk;
  document.getElementById("riskBadge").textContent = risk + " Risk";
  document.getElementById("riskBadge").className = `px-3 py-1.5 rounded-full text-sm font-bold border ${riskClass[risk] || ""}`;

  const ring = document.getElementById("riskRing");
  ring.style.borderColor = riskColors[risk];

  document.getElementById("confidenceText").textContent = conf + "%";
  setTimeout(() => {
    document.getElementById("confidenceBar").style.width = conf + "%";
    document.getElementById("confidenceBar").style.background = riskColors[risk];
    document.getElementById("barAttendance").style.width = d.attendance_pct + "%";
    document.getElementById("barAssignment").style.width = d.assignment_avg + "%";
    document.getElementById("barMidterm").style.width = d.midterm_score + "%";
    document.getElementById("barFinal").style.width = d.final_score + "%";
  }, 100);

  // Topbar badge
  const topBadge = document.getElementById("topRiskBadge");
  topBadge.textContent = risk + " Risk";
  topBadge.className = `px-3 py-1 rounded-full text-xs font-bold border ${riskClass[risk]}`;
  topBadge.classList.remove("hidden");

  // Stat values
  document.getElementById("statAttendance").textContent = d.attendance_pct + "%";
  document.getElementById("statAssignment").textContent = d.assignment_avg + "/100";
  document.getElementById("statMidterm").textContent = d.midterm_score + "/100";
  document.getElementById("statFinal").textContent = d.final_score + "/100";

  // Status labels
  const attLabel = d.attendance_pct >= 75 ? "✅ On target" : "⚠️ Below 75% minimum";
  document.getElementById("labelAttendance").textContent = attLabel;

  // Quick recs (top 3)
  const recs = d.recommendations || [];
  const recsEl = document.getElementById("quickRecs");
  recsEl.innerHTML = recs.slice(0, 3).map(r =>
    `<div class="flex items-start gap-2 text-sm text-slate-400 py-1.5 border-b border-slate-800/50">${r}</div>`
  ).join("") || '<div class="text-slate-500">No recommendations available.</div>';
}

// ── Performance Charts ────────────────────────────────────────────────────────
function renderPerformanceCharts() {
  const d = studentData;
  if (!d) return;

  // Trend chart
  if (!trendChartInst) {
    trendChartInst = createLineChart("trendChart",
      d.trend?.labels || ["W1", "W2", "W3", "W4", "W5", "W6"],
      [
        { label: "Attendance %",    data: d.trend?.attendance || [80,75,72,70,74,74], color: "#3b82f6" },
        { label: "Assignment Avg",  data: d.trend?.assignment  || [78,80,82,85,82,82], color: "#10b981" },
        { label: "Midterm Score",   data: d.trend?.midterm     || [60,58,55,57,58,58], color: "#f59e0b" },
      ]
    );
  }

  // Radar chart
  if (!radarChartInst) {
    radarChartInst = createRadarChart("radarChart",
      ["Attendance", "Assignments", "Midterm", "Final", "Quiz"],
      [d.attendance_pct, d.assignment_avg, d.midterm_score, d.final_score, d.quiz_avg || 70],
      "Your Scores"
    );
  }

  // Comparative bar (you vs class avg)
  if (!compareChartInst) {
    compareChartInst = createBarChart("compareChart",
      ["Attendance", "Assignments", "Midterm", "Final"],
      [
        { label: "You",        data: [d.attendance_pct, d.assignment_avg, d.midterm_score, d.final_score], color: "#3b82f6" },
        { label: "Class Avg",  data: [78, 72, 65, 68], color: "#475569" },
      ]
    );
  }
}

// ── Full Recommendations ──────────────────────────────────────────────────────
function renderFullRecommendations() {
  const recs = studentData?.recommendations || [];
  const icons = ["📅", "📝", "📚", "🎯", "🧠", "⚠️", "📈", "🔁", "💡", "🤝", "🕐", "✅", "🚀", "👨‍🏫"];

  const container = document.getElementById("fullRecs");
  container.innerHTML = recs.map((rec, i) => `
    <div class="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
      <div class="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-sm flex-shrink-0">${icons[i] || "✨"}</div>
      <div class="text-sm text-slate-300 leading-relaxed">${rec}</div>
    </div>`
  ).join("");
}

// ── Risk Prediction ───────────────────────────────────────────────────────────
async function runPrediction(e) {
  e.preventDefault();
  const btn = document.getElementById("predictBtn");
  btn.textContent = "⏳ Predicting...";
  btn.disabled = true;

  const payload = {
    attendance_pct: +document.getElementById("p_attendance").value,
    assignment_avg: +document.getElementById("p_assignment").value,
    midterm_score:  +document.getElementById("p_midterm").value,
    final_score:    +document.getElementById("p_final").value,
    quiz_avg:       +document.getElementById("p_quiz").value,
  };

  let result;
  try {
    if (isDemoMode()) throw new Error("demo");
    result = await apiCall("/predict", "POST", payload);
  } catch {
    result = demoPredict(payload);
  }

  renderPredictionResult(result, payload);
  btn.textContent = "🔮 Predict Risk";
  btn.disabled = false;
}

function demoPredict(payload) {
  const composite = (
    0.25 * payload.attendance_pct +
    0.20 * payload.assignment_avg +
    0.25 * payload.midterm_score +
    0.20 * payload.final_score +
    0.10 * payload.quiz_avg
  );
  const risk = composite >= 65 ? "Low" : composite >= 45 ? "Medium" : "High";
  const conf = Math.min(0.99, 0.65 + Math.abs(composite - (risk === "Low" ? 75 : risk === "Medium" ? 55 : 35)) / 100);

  const recs = {
    Low:    ["✅ Great performance! Keep maintaining your habits.", "🚀 Challenge yourself with advanced problems.", "👨‍🏫 Consider mentoring peers."],
    Medium: ["📈 Focus on your weakest subject daily.", "🔁 Use spaced repetition for revision.", "🤝 Join a study group."],
    High:   ["⚠️ Speak with your academic advisor immediately.", "📅 Improve attendance — aim for 85%+.", "🕐 Create a strict study schedule."],
  };

  return {
    risk_level: risk,
    confidence: +conf.toFixed(4),
    recommendations: recs[risk],
    feature_importance: [
      { feature: "attendance_pct", label: "Attendance %",     importance: 0.35, direction: payload.attendance_pct >= 75 ? "positive" : "negative" },
      { feature: "midterm_score",  label: "Midterm Score",    importance: 0.28, direction: payload.midterm_score >= 55 ? "positive" : "negative" },
      { feature: "assignment_avg", label: "Assignment Score", importance: 0.18, direction: payload.assignment_avg >= 60 ? "positive" : "negative" },
      { feature: "final_score",    label: "Final Exam Score", importance: 0.12, direction: payload.final_score >= 55 ? "positive" : "negative" },
      { feature: "quiz_avg",       label: "Quiz Average",     importance: 0.07, direction: payload.quiz_avg >= 55 ? "positive" : "negative" },
    ],
  };
}

function renderPredictionResult(result, payload) {
  const riskColors = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444" };
  const riskClass = { Low: "risk-low", Medium: "risk-medium", High: "risk-high" };
  const risk = result.risk_level;
  const conf = Math.round(result.confidence * 100);

  document.getElementById("predictionResult").classList.remove("hidden");
  document.getElementById("predRiskText").textContent = risk;
  document.getElementById("predRiskBadge").textContent = risk + " Risk";
  document.getElementById("predRiskBadge").className = `px-4 py-2 rounded-xl font-bold text-sm border ${riskClass[risk]}`;
  document.getElementById("predConfText").textContent = conf + "%";

  const bar = document.getElementById("predConfBar");
  bar.style.background = riskColors[risk];
  setTimeout(() => { bar.style.width = conf + "%"; }, 100);

  // Recommendations
  const recsEl = document.getElementById("predRecs");
  recsEl.innerHTML = (result.recommendations || []).map(r =>
    `<div class="text-sm text-slate-400 py-1.5 flex items-start gap-2 border-b border-slate-800/30">${r}</div>`
  ).join("");

  // Feature importance chart
  const fi = result.feature_importance || [];
  if (fiChartInst) { fiChartInst.destroy(); fiChartInst = null; }
  fiChartInst = createHorizontalBar(
    "fiChart",
    fi.map(f => f.label || f.feature),
    fi.map(f => f.importance),
    fi.map(f => f.direction === "positive" ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)")
  );

  document.getElementById("predictionResult").scrollIntoView({ behavior: "smooth" });
}

// ── Chatbot ───────────────────────────────────────────────────────────────────
const CHATBOT_RESPONSES = {
  attendance: [
    "📅 Attendance is one of the **strongest predictors** of academic success. Students with 85%+ attendance perform significantly better on exams.\n\n• Set phone reminders for every class\n• Partner with a classmate to hold each other accountable\n• Inform professors in advance if you must miss class\n• Review notes within 24 hours of attending",
    "Attending class consistently helps you: (1) stay up-to-date with material, (2) ask questions in real-time, and (3) avoid last-minute cramming. Even attending 5% more can improve your grade by a letter!"
  ],
  grades: [
    "📈 To improve your grades:\n\n1. **Active Study**: Don't just re-read — do practice problems\n2. **Spaced Repetition**: Study a little each day rather than cramming\n3. **Teach it**: Explain topics to someone else\n4. **Past Papers**: Solve 5 years of old exam papers\n5. **Ask for help**: Visit professor office hours",
    "Grades improve with consistent effort. Focus on understanding, not memorizing. Use the Feynman Technique: explain the concept in simple words — if you can't, go back and study that part again."
  ],
  study: [
    "🧠 Effective Study Tips:\n\n• **Pomodoro Technique**: 25 min focus + 5 min break\n• **Active Recall**: Test yourself instead of re-reading\n• **Spaced Repetition**: Use Anki flashcards\n• **Mind Maps**: Visualize complex topics\n• **Sleep 7-8 hours**: Memory consolidation happens during sleep",
    "The best study environment: quiet, well-lit, phone in another room. Study in the morning when your mind is fresh. Review notes within 24 hours of a lecture — this cuts forgetting by 60%!"
  ],
  time: [
    "⏰ Time Management Strategies:\n\n1. **Time Blocking**: Schedule study slots in advance\n2. **Priority Matrix**: Urgent+Important first\n3. **Weekly Review**: Every Sunday, plan the next week\n4. **Limit Social Media**: Use apps like Forest or Stay Focused\n5. **2-Minute Rule**: If a task takes <2 min, do it now",
    "Plan your week in advance. Assign specific subjects to specific days. Set a 'shutdown ritual' at night so your brain can rest. Remember: consistency beats intensity."
  ],
  exam: [
    "🎯 Exam Preparation:\n\n• Start revision 2 weeks before, not 2 days\n• Make a revision timetable and stick to it\n• Focus on high-weightage topics first\n• Do at least 3 mock tests under timed conditions\n• On exam day: sleep well, eat, arrive early, read questions fully before answering",
    "Solve past papers — they're the best predictor of what will be asked. For every topic, summarize it in one page. During the exam, tackle easy questions first to build confidence."
  ],
  risk: [
    `Based on your data, here's what typically influences risk level:\n\n🔴 **High Risk Factors**: Attendance below 60%, exam scores below 45%\n🟡 **Medium Risk**: Attendance 60-75%, scores 45-65%\n🟢 **Low Risk**: Attendance 75%+, scores 65%+\n\nFocus on improving your lowest scores first — they have the biggest impact on your classification.`,
  ],
  motivation: [
    "💪 Remember: every expert was once a beginner. Small consistent efforts compound over time.\n\n\"Success is the sum of small efforts repeated day in and day out.\" — Robert Collier\n\nYou have the ability to improve — the system is here to guide you. What specific area would you like help with?",
  ],
  default: [
    "I'm here to help with your academics! Ask me about:\n\n• Attendance improvement strategies\n• Study techniques and time management\n• Exam preparation tips\n• Understanding your risk level\n• Motivation and mindset",
  ]
};

function getKeyword(text) {
  const t = text.toLowerCase();
  if (t.match(/attend|class|miss|absent|present/)) return "attendance";
  if (t.match(/grade|mark|score|gpa|improve|better/)) return "grades";
  if (t.match(/study|learn|revise|revision|flashcard|note/)) return "study";
  if (t.match(/time|manage|schedule|plan|procrastinat/)) return "time";
  if (t.match(/exam|test|quiz|midsem|finals|preparation/)) return "exam";
  if (t.match(/risk|high.risk|medium.risk|low.risk|predict/)) return "risk";
  if (t.match(/motivat|discourag|stress|anxious|fail|give.up/)) return "motivation";
  return "default";
}

function addMessage(text, sender = "bot") {
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = `flex items-start gap-3 ${sender === "user" ? "flex-row-reverse" : ""}`;
  const avatar = sender === "user"
    ? `<div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">${(getUser()?.name || "S")[0].toUpperCase()}</div>`
    : `<div class="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm flex-shrink-0">🤖</div>`;
  const bubbleClass = sender === "user" ? "chatbot-bubble chatbot-user" : "chatbot-bubble chatbot-bot";
  const formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
  div.innerHTML = `${avatar}<div class="${bubbleClass}">${formattedText}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.id = "typingIndicator";
  div.className = "flex items-start gap-3";
  div.innerHTML = `
    <div class="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm flex-shrink-0">🤖</div>
    <div class="chatbot-bubble chatbot-bot flex gap-1.5 items-center py-3">
      <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  document.getElementById("typingIndicator")?.remove();
}

function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessage(text, "user");
  showTyping();
  const keyword = getKeyword(text);
  const responses = CHATBOT_RESPONSES[keyword] || CHATBOT_RESPONSES.default;
  const response = responses[Math.floor(Math.random() * responses.length)];
  setTimeout(() => {
    removeTyping();
    addMessage(response, "bot");
  }, 900 + Math.random() * 500);
}

function sendQuick(text) {
  document.getElementById("chatInput").value = text;
  sendChat();
}
