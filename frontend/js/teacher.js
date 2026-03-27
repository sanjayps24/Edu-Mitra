/**
 * teacher.js — Teacher Dashboard logic for EduMitra.
 * Handles student CRUD, risk charts, alerts, sorting/filtering.
 */

// ── Demo Data ─────────────────────────────────────────────────────────────────
const DEMO_STUDENTS = [
  { id:"s1", name:"Alex Johnson",   email:"alex@uni.edu",    attendance_pct:74, assignment_avg:82, midterm_score:58, final_score:65, quiz_avg:70, risk_level:"Medium", confidence:0.79, semester:"Semester 4", department:"CS" },
  { id:"s2", name:"Priya Sharma",   email:"priya@uni.edu",   attendance_pct:91, assignment_avg:88, midterm_score:76, final_score:80, quiz_avg:84, risk_level:"Low",    confidence:0.92, semester:"Semester 4", department:"CS" },
  { id:"s3", name:"Mohammed Ali",   email:"ali@uni.edu",     attendance_pct:51, assignment_avg:45, midterm_score:38, final_score:42, quiz_avg:46, risk_level:"High",   confidence:0.88, semester:"Semester 4", department:"CS" },
  { id:"s4", name:"Sarah Williams", email:"sarah@uni.edu",   attendance_pct:83, assignment_avg:79, midterm_score:72, final_score:75, quiz_avg:78, risk_level:"Low",    confidence:0.85, semester:"Semester 4", department:"CS" },
  { id:"s5", name:"Raj Patel",      email:"raj@uni.edu",     attendance_pct:62, assignment_avg:58, midterm_score:49, final_score:55, quiz_avg:60, risk_level:"Medium", confidence:0.73, semester:"Semester 4", department:"CS" },
  { id:"s6", name:"Fatima Khan",    email:"fatima@uni.edu",  attendance_pct:44, assignment_avg:39, midterm_score:32, final_score:36, quiz_avg:40, risk_level:"High",   confidence:0.91, semester:"Semester 4", department:"CS" },
  { id:"s7", name:"James Lee",      email:"james@uni.edu",   attendance_pct:88, assignment_avg:93, midterm_score:89, final_score:91, quiz_avg:88, risk_level:"Low",    confidence:0.97, semester:"Semester 4", department:"CS" },
  { id:"s8", name:"Ananya Reddy",   email:"ananya@uni.edu",  attendance_pct:69, assignment_avg:63, midterm_score:55, final_score:59, quiz_avg:65, risk_level:"Medium", confidence:0.71, semester:"Semester 4", department:"CS" },
];

// ── State ──────────────────────────────────────────────────────────────────────
let allStudents = [];
let filteredStudents = [];
let sortField = "name";
let sortDir = "asc";
let deleteTargetId = null;
let donutInst = null, classBarInst = null, attDistInst = null, scoreDistInst = null, perfOverviewInst = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["teacher", "admin"])) return;
  const user = getUser();
  document.getElementById("sidebarName").textContent = user?.name || "Teacher";
  document.getElementById("topName").textContent = user?.name || "—";
  document.getElementById("avatarText").textContent = (user?.name || "T")[0].toUpperCase();
  await loadStudents();
});

async function loadStudents() {
  try {
    if (isDemoMode()) throw new Error("demo");
    const data = await apiCall("/dashboard/teacher");
    allStudents = data.students || [];
  } catch {
    allStudents = DEMO_STUDENTS.map(s => ({
      ...s,
      exam_avg: (s.midterm_score + s.final_score) / 2,
    }));
  }
  filteredStudents = [...allStudents];
  renderOverviewStats();
  renderStudentTable();
  renderAlerts();
}

async function refreshData() {
  allStudents = [];
  document.getElementById("studentTableBody").innerHTML =
    '<tr><td colspan="6" class="text-center text-slate-500 py-12">Refreshing...</td></tr>';
  await loadStudents();
}

// ── Section Navigation ────────────────────────────────────────────────────────
function showSection(section) {
  ["overview","students","alerts","addStudent","analytics"].forEach(s => {
    document.getElementById(`section-${s}`).classList.toggle("hidden", s !== section);
    const nav = document.getElementById(`nav-${s}`);
    if (nav) nav.className = `sidebar-link${s === section ? " active" : ""}`;
  });
  const titles = {
    overview:   ["Teacher Dashboard",   "Class Performance Overview"],
    students:   ["My Students",         "Full class roster with risk levels"],
    alerts:     ["High-Risk Alerts",    "Students requiring immediate attention"],
    addStudent: ["Add Student Record",  "Enter new academic data"],
    analytics:  ["Class Analytics",     "Performance distribution charts"],
  };
  document.getElementById("pageTitle").textContent = titles[section][0];
  document.getElementById("pageSubtitle").textContent = titles[section][1];
  if (section === "analytics") renderAnalyticsCharts();
}

// ── Overview Stats ────────────────────────────────────────────────────────────
function renderOverviewStats() {
  const total = allStudents.length;
  const low  = allStudents.filter(s => s.risk_level === "Low").length;
  const med  = allStudents.filter(s => s.risk_level === "Medium").length;
  const high = allStudents.filter(s => s.risk_level === "High").length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statLow").textContent = low;
  document.getElementById("statMedium").textContent = med;
  document.getElementById("statHigh").textContent = high;
  document.getElementById("pctLow").textContent    = total ? `${((low/total)*100).toFixed(0)}% of class` : "—";
  document.getElementById("pctMedium").textContent = total ? `${((med/total)*100).toFixed(0)}% of class` : "—";
  document.getElementById("pctHigh").textContent   = total ? `${((high/total)*100).toFixed(0)}% of class` : "—";

  // Alert count badge in sidebar
  const alertCount = document.getElementById("alertCount");
  if (high > 0) {
    alertCount.textContent = high;
    alertCount.classList.remove("hidden");
  }

  // Alert banner
  if (high > 0) {
    document.getElementById("alertBanner").classList.remove("hidden");
    document.getElementById("alertBannerText").textContent =
      `${high} student${high > 1 ? "s are" : " is"} classified as High Risk and need${high === 1 ? "s" : ""} your attention.`;
  }

  // Render donut chart
  if (!donutInst) {
    donutInst = createDoughnutChart("riskDonutChart",
      ["Low Risk", "Medium Risk", "High Risk"],
      [low, med, high],
      ["#10b981", "#f59e0b", "#ef4444"]
    );
  }

  // Class avg bar
  if (!classBarInst) {
    const avgAtt   = avg(allStudents, "attendance_pct");
    const avgAssign= avg(allStudents, "assignment_avg");
    const avgMid   = avg(allStudents, "midterm_score");
    const avgFinal = avg(allStudents, "final_score");

    classBarInst = createBarChart("classBarChart",
      ["Attendance", "Assignments", "Midterm", "Final Exam"],
      [{ label: "Class Average", data: [avgAtt, avgAssign, avgMid, avgFinal], color: "#10b981" }]
    );
  }
}

// ── Student Table ─────────────────────────────────────────────────────────────
function renderStudentTable() {
  const tbody = document.getElementById("studentTableBody");
  document.getElementById("tableCount").textContent =
    `Showing ${filteredStudents.length} of ${allStudents.length} students`;

  if (!filteredStudents.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-500 py-12">No students match your filter.</td></tr>';
    return;
  }

  const riskBadge = r =>
    `<span class="px-2.5 py-1 rounded-full text-xs font-semibold ${r==="Low"?"badge-low":r==="High"?"badge-high":"badge-medium"}">${r}</span>`;

  tbody.innerHTML = filteredStudents.map(s => {
    const examAvg = s.exam_avg ?? ((s.midterm_score + s.final_score) / 2);
    const attColor = s.attendance_pct < 60 ? "text-red-400" : s.attendance_pct < 75 ? "text-yellow-400" : "text-emerald-400";
    return `<tr>
      <td>
        <div class="font-medium text-white">${s.name}</div>
        <div class="text-xs text-slate-500">${s.email}</div>
      </td>
      <td class="${attColor} font-semibold">${s.attendance_pct}%</td>
      <td>${s.assignment_avg}/100</td>
      <td>${examAvg.toFixed(1)}/100</td>
      <td>${riskBadge(s.risk_level)}</td>
      <td>
        <div class="flex items-center gap-2">
          <button onclick="viewStudent('${s.id}')" title="View"
            class="w-8 h-8 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors text-sm">👁</button>
          <button onclick="editStudent('${s.id}')" title="Edit"
            class="w-8 h-8 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors text-sm">✏️</button>
          <button onclick="promptDelete('${s.id}','${s.name.replace(/'/g, "\\'")}')" title="Delete"
            class="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Sorting ────────────────────────────────────────────────────────────────────
function sortTable(field) {
  if (sortField === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else { sortField = field; sortDir = "asc"; }

  filteredStudents.sort((a, b) => {
    let va = a[field], vb = b[field];
    if (field === "exam_avg") {
      va = (a.midterm_score + a.final_score) / 2;
      vb = (b.midterm_score + b.final_score) / 2;
    }
    if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === "asc" ? va - vb : vb - va;
  });
  renderStudentTable();
}

// ── Filtering ─────────────────────────────────────────────────────────────────
function filterStudents() {
  const query  = document.getElementById("searchInput").value.toLowerCase();
  const risk   = document.getElementById("riskFilter").value;
  filteredStudents = allStudents.filter(s => {
    const matchText = s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query);
    const matchRisk = !risk || s.risk_level === risk;
    return matchText && matchRisk;
  });
  renderStudentTable();
}

// ── Alerts ────────────────────────────────────────────────────────────────────
function renderAlerts() {
  const highRisk = allStudents.filter(s => s.risk_level === "High");
  document.getElementById("alertCountBadge").textContent = highRisk.length;
  const container = document.getElementById("alertsList");

  if (!highRisk.length) {
    container.innerHTML = '<div class="p-8 text-center text-slate-500">✅ No high-risk students. Great work!</div>';
    return;
  }

  container.innerHTML = highRisk.map(s => `
    <div class="p-5 flex items-center gap-4">
      <div class="w-10 h-10 bg-red-500/15 rounded-full flex items-center justify-center text-red-400 font-bold flex-shrink-0">
        ${s.name[0].toUpperCase()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-white">${s.name}</div>
        <div class="text-xs text-slate-400 mt-0.5 flex gap-4 flex-wrap">
          <span>📅 ${s.attendance_pct}% attendance</span>
          <span>📝 ${s.assignment_avg}/100 assignments</span>
          <span>🎯 ${((s.midterm_score+s.final_score)/2).toFixed(0)}/100 exam avg</span>
        </div>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        <span class="px-3 py-1 badge-high rounded-full text-xs font-bold">${(s.confidence*100).toFixed(0)}% conf.</span>
        <button onclick="viewStudent('${s.id}')"
          class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          View →
        </button>
      </div>
    </div>`
  ).join("");
}

// ── View / Edit Modals ─────────────────────────────────────────────────────────
function viewStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  const examAvg = ((s.midterm_score + s.final_score) / 2).toFixed(1);
  const riskClass = { Low: "badge-low", Medium: "badge-medium", High: "badge-high" };
  document.getElementById("viewModalContent").innerHTML = `
    <div class="flex items-center gap-4 mb-6">
      <div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-xl font-black">
        ${s.name[0].toUpperCase()}
      </div>
      <div>
        <div class="text-xl font-bold text-white">${s.name}</div>
        <div class="text-sm text-slate-400">${s.email}</div>
        <div class="text-xs text-slate-500 mt-1">${s.department || ""} · ${s.semester || ""}</div>
      </div>
      <span class="ml-auto px-4 py-2 rounded-xl font-bold text-sm border ${riskClass[s.risk_level]}">${s.risk_level} Risk</span>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
      ${[
        ["📅 Attendance",   s.attendance_pct + "%",   s.attendance_pct >= 75 ? "text-emerald-400":"text-red-400"],
        ["📝 Assignments",  s.assignment_avg + "/100", "text-blue-400"],
        ["📚 Midterm",      s.midterm_score + "/100",  "text-yellow-400"],
        ["🎯 Final Exam",   s.final_score + "/100",    "text-purple-400"],
        ["🧠 Quiz Avg",     (s.quiz_avg||70) + "/100", "text-cyan-400"],
        ["📊 Exam Avg",     examAvg + "/100",           "text-white"],
      ].map(([l,v,c])=>`
        <div class="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <div class="text-xs text-slate-400">${l}</div>
          <div class="text-xl font-bold ${c} mt-1">${v}</div>
        </div>`).join("")}
    </div>
    <div class="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
      <div class="text-xs font-semibold text-slate-400 mb-2">Confidence Score</div>
      <div class="flex items-center gap-3">
        <div class="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-2 rounded-full ${s.risk_level==="High"?"bg-red-500":s.risk_level==="Medium"?"bg-yellow-500":"bg-emerald-500"}"
            style="width:${(s.confidence||0.75)*100}%"></div>
        </div>
        <span class="text-white font-bold text-sm">${((s.confidence||0.75)*100).toFixed(0)}%</span>
      </div>
    </div>`;
  document.getElementById("viewModal").classList.remove("hidden");
}

function editStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  document.getElementById("edit_id").value    = s.id;
  document.getElementById("edit_name").value  = s.name;
  document.getElementById("edit_email").value = s.email;
  document.getElementById("edit_att").value   = s.attendance_pct;
  document.getElementById("edit_assign").value= s.assignment_avg;
  document.getElementById("edit_mid").value   = s.midterm_score;
  document.getElementById("edit_final").value = s.final_score;
  document.getElementById("edit_quiz").value  = s.quiz_avg || 70;
  document.getElementById("edit_sem").value   = s.semester || "Semester 4";
  document.getElementById("editError").classList.add("hidden");
  document.getElementById("editModal").classList.remove("hidden");
}

async function handleEditStudent(e) {
  e.preventDefault();
  const id = document.getElementById("edit_id").value;
  const updates = {
    attendance_pct: +document.getElementById("edit_att").value,
    assignment_avg: +document.getElementById("edit_assign").value,
    midterm_score:  +document.getElementById("edit_mid").value,
    final_score:    +document.getElementById("edit_final").value,
    quiz_avg:       +document.getElementById("edit_quiz").value,
    semester:       document.getElementById("edit_sem").value,
  };

  try {
    if (!isDemoMode()) await apiCall(`/students/${id}/update`, "PUT", updates);
    // Update local demo state
    const idx = allStudents.findIndex(s => s.id === id);
    if (idx !== -1) {
      const risk = calcRisk(updates);
      allStudents[idx] = { ...allStudents[idx], ...updates, risk_level: risk, exam_avg: (updates.midterm_score + updates.final_score)/2 };
    }
    filteredStudents = [...allStudents];
    renderStudentTable();
    renderAlerts();
    closeEditModal();
    // Destroy and re-render overview charts
    if (donutInst) { donutInst.destroy(); donutInst = null; }
    if (classBarInst) { classBarInst.destroy(); classBarInst = null; }
    renderOverviewStats();
  } catch (err) {
    document.getElementById("editError").textContent = err.message || "Update failed.";
    document.getElementById("editError").classList.remove("hidden");
  }
}

function closeEditModal() { document.getElementById("editModal").classList.add("hidden"); }
function closeViewModal()  { document.getElementById("viewModal").classList.add("hidden"); }

function closeModal(e) {
  if (e.target.classList.contains("modal-overlay")) {
    closeEditModal(); closeViewModal();
    document.getElementById("deleteModal").classList.add("hidden");
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
function promptDelete(id, name) {
  deleteTargetId = id;
  document.getElementById("deleteStudentName").textContent = name;
  document.getElementById("deleteModal").classList.remove("hidden");
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  try {
    if (!isDemoMode()) await apiCall(`/students/${deleteTargetId}`, "DELETE");
    allStudents = allStudents.filter(s => s.id !== deleteTargetId);
    filteredStudents = [...allStudents];
    renderStudentTable();
    renderAlerts();
    if (donutInst) { donutInst.destroy(); donutInst = null; }
    if (classBarInst) { classBarInst.destroy(); classBarInst = null; }
    renderOverviewStats();
  } catch {}
  document.getElementById("deleteModal").classList.add("hidden");
  deleteTargetId = null;
}

// ── Add Student ────────────────────────────────────────────────────────────────
function updateLivePreview() {
  const att   = +document.getElementById("s_att").value   || 0;
  const assign= +document.getElementById("s_assign").value|| 0;
  const mid   = +document.getElementById("s_mid").value   || 0;
  const fin   = +document.getElementById("s_final").value || 0;
  const quiz  = +document.getElementById("s_quiz").value  || 0;
  const risk  = calcRisk({ attendance_pct: att, assignment_avg: assign, midterm_score: mid, final_score: fin, quiz_avg: quiz });
  const el    = document.getElementById("liveRiskPreview");
  el.textContent = `${risk} Risk`;
  el.className = `px-4 py-3 rounded-xl text-sm font-bold text-center border ${risk==="Low"?"badge-low":risk==="High"?"badge-high":"badge-medium"}`;
}

async function handleAddStudent(e) {
  e.preventDefault();
  const btn = document.getElementById("addBtn");
  btn.disabled = true;
  document.getElementById("addBtnText").textContent = "⏳ Adding...";

  const payload = {
    name:           document.getElementById("s_name").value.trim(),
    email:          document.getElementById("s_email").value.trim(),
    department:     document.getElementById("s_dept").value.trim(),
    semester:       document.getElementById("s_sem").value,
    attendance_pct: +document.getElementById("s_att").value,
    assignment_avg: +document.getElementById("s_assign").value,
    midterm_score:  +document.getElementById("s_mid").value,
    final_score:    +document.getElementById("s_final").value,
    quiz_avg:       +document.getElementById("s_quiz").value,
  };

  document.getElementById("addError").classList.add("hidden");
  document.getElementById("addSuccess").classList.add("hidden");

  try {
    if (!isDemoMode()) {
      const result = await apiCall("/students/add", "POST", payload);
      payload.id = result.student_id || "new-" + Date.now();
      payload.risk_level = result.risk_level;
    } else {
      payload.id = "demo-" + Date.now();
      payload.risk_level = calcRisk(payload);
      payload.confidence = 0.80;
    }
    payload.exam_avg = (payload.midterm_score + payload.final_score) / 2;
    allStudents.push(payload);
    filteredStudents = [...allStudents];

    document.getElementById("addSuccess").textContent = `✅ ${payload.name} added successfully! Risk: ${payload.risk_level}`;
    document.getElementById("addSuccess").classList.remove("hidden");
    document.getElementById("addStudentForm").reset();
    updateLivePreview();
    if (donutInst) { donutInst.destroy(); donutInst = null; }
    if (classBarInst) { classBarInst.destroy(); classBarInst = null; }
    renderOverviewStats();
    renderStudentTable();
    renderAlerts();
  } catch (err) {
    document.getElementById("addError").textContent = err.message || "Failed to add student. Check your input and try again.";
    document.getElementById("addError").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    document.getElementById("addBtnText").textContent = "➕ Add Student";
  }
}

// ── Analytics Charts ──────────────────────────────────────────────────────────
function renderAnalyticsCharts() {
  if (attDistInst) return; // Already rendered

  // Attendance distribution (buckets: <60, 60-75, 75-85, 85+)
  const attBuckets = [0, 0, 0, 0];
  allStudents.forEach(s => {
    if (s.attendance_pct < 60) attBuckets[0]++;
    else if (s.attendance_pct < 75) attBuckets[1]++;
    else if (s.attendance_pct < 85) attBuckets[2]++;
    else attBuckets[3]++;
  });
  attDistInst = createBarChart("attDistChart",
    ["< 60%", "60-75%", "75-85%", "85%+"],
    [{ label: "Students", data: attBuckets, color: "#3b82f6" }]
  );

  // Score distribution
  const avgScores = [
    avg(allStudents, "assignment_avg"),
    avg(allStudents, "midterm_score"),
    avg(allStudents, "final_score"),
    avg(allStudents, "quiz_avg"),
  ];
  scoreDistInst = createBarChart("scoreDistChart",
    ["Assignments", "Midterm", "Final Exam", "Quiz Avg"],
    [{ label: "Class Average", data: avgScores, color: "#f59e0b" }]
  );

  // Performance overview (all students, sorted by exam avg)
  const sorted = [...allStudents].sort((a, b) => {
    const ea = (a.midterm_score + a.final_score) / 2;
    const eb = (b.midterm_score + b.final_score) / 2;
    return eb - ea;
  }).slice(0, 8);

  perfOverviewInst = createBarChart("perfOverviewChart",
    sorted.map(s => s.name.split(" ")[0]),
    [
      { label: "Attendance %",    data: sorted.map(s => s.attendance_pct), color: "#3b82f6" },
      { label: "Assignment Avg",  data: sorted.map(s => s.assignment_avg), color: "#10b981" },
      { label: "Exam Avg",        data: sorted.map(s => ((s.midterm_score+s.final_score)/2).toFixed(1)), color: "#f59e0b" },
    ]
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function avg(arr, field) {
  if (!arr.length) return 0;
  return +(arr.reduce((s, x) => s + (x[field] || 0), 0) / arr.length).toFixed(1);
}

function calcRisk({ attendance_pct, assignment_avg, midterm_score, final_score, quiz_avg }) {
  const c = 0.25*attendance_pct + 0.20*assignment_avg + 0.25*midterm_score + 0.20*final_score + 0.10*(quiz_avg||70);
  return c >= 65 ? "Low" : c >= 45 ? "Medium" : "High";
}
