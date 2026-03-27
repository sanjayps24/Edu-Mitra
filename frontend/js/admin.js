/**
 * admin.js — Admin Dashboard logic for EduMitra.
 * System-wide stats, user management, bulk alerts, and analytics charts.
 */

// ── Demo Data ─────────────────────────────────────────────────────────────────
const DEMO_USERS = [
  { id:"u1", name:"Alex Johnson",   email:"alex@uni.edu",    role:"student", department:"CS",      status:"active" },
  { id:"u2", name:"Priya Sharma",   email:"priya@uni.edu",   role:"student", department:"CS",      status:"active" },
  { id:"u3", name:"Mohammed Ali",   email:"ali@uni.edu",     role:"student", department:"CS",      status:"active" },
  { id:"u4", name:"Sarah Williams", email:"sarah@uni.edu",   role:"student", department:"ECE",     status:"active" },
  { id:"u5", name:"Raj Patel",      email:"raj@uni.edu",     role:"student", department:"MECH",    status:"active" },
  { id:"u6", name:"Fatima Khan",    email:"fatima@uni.edu",  role:"student", department:"CS",      status:"active" },
  { id:"u7", name:"James Lee",      email:"james@uni.edu",   role:"student", department:"ECE",     status:"active" },
  { id:"u8", name:"Ananya Reddy",   email:"ananya@uni.edu",  role:"student", department:"MECH",    status:"active" },
  { id:"u9", name:"Prof. Sarah Chen", email:"teacher@demo.com", role:"teacher", department:"CS",   status:"active" },
  { id:"u10",name:"Dr. Ramesh Kumar", email:"ramesh@uni.edu",   role:"teacher", department:"ECE",  status:"active" },
  { id:"u11",name:"Admin User",       email:"admin@demo.com",   role:"admin",   department:"Admin",status:"active" },
];

const DEMO_STUDENTS = [
  { id:"s1", name:"Alex Johnson",   email:"alex@uni.edu",    attendance_pct:74, assignment_avg:82, midterm_score:58, final_score:65, quiz_avg:70, risk_level:"Medium", confidence:0.79, department:"CS" },
  { id:"s2", name:"Priya Sharma",   email:"priya@uni.edu",   attendance_pct:91, assignment_avg:88, midterm_score:76, final_score:80, quiz_avg:84, risk_level:"Low",    confidence:0.92, department:"CS" },
  { id:"s3", name:"Mohammed Ali",   email:"ali@uni.edu",     attendance_pct:51, assignment_avg:45, midterm_score:38, final_score:42, quiz_avg:46, risk_level:"High",   confidence:0.88, department:"CS" },
  { id:"s4", name:"Sarah Williams", email:"sarah@uni.edu",   attendance_pct:83, assignment_avg:79, midterm_score:72, final_score:75, quiz_avg:78, risk_level:"Low",    confidence:0.85, department:"ECE" },
  { id:"s5", name:"Raj Patel",      email:"raj@uni.edu",     attendance_pct:62, assignment_avg:58, midterm_score:49, final_score:55, quiz_avg:60, risk_level:"Medium", confidence:0.73, department:"MECH" },
  { id:"s6", name:"Fatima Khan",    email:"fatima@uni.edu",  attendance_pct:44, assignment_avg:39, midterm_score:32, final_score:36, quiz_avg:40, risk_level:"High",   confidence:0.91, department:"CS" },
  { id:"s7", name:"James Lee",      email:"james@uni.edu",   attendance_pct:88, assignment_avg:93, midterm_score:89, final_score:91, quiz_avg:88, risk_level:"Low",    confidence:0.97, department:"ECE" },
  { id:"s8", name:"Ananya Reddy",   email:"ananya@uni.edu",  attendance_pct:69, assignment_avg:63, midterm_score:55, final_score:59, quiz_avg:65, risk_level:"Medium", confidence:0.71, department:"MECH" },
];

// ── State ─────────────────────────────────────────────────────────────────────
let allUsers = [];
let allStudents = [];
let filteredUsers = [];
let filteredStudents = [];
let deleteUserId = null;
let riskChartInst = null, trendChartInst = null;
let deptChartInst = null, monthlyChartInst = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth(["admin"])) return;
  const user = getUser();
  document.getElementById("sidebarName").textContent = user?.name || "Admin";
  document.getElementById("topName").textContent = user?.name || "—";
  document.getElementById("avatarText").textContent = (user?.name || "A")[0].toUpperCase();
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    if (isDemoMode()) throw new Error("demo");
    const data = await apiCall("/dashboard/admin");
    renderKPIs(data.stats);
    allStudents = data.recent_records || [];
  } catch {
    // Demo mode
    const students = DEMO_STUDENTS;
    const low  = students.filter(s => s.risk_level === "Low").length;
    const med  = students.filter(s => s.risk_level === "Medium").length;
    const high = students.filter(s => s.risk_level === "High").length;
    const avgAtt  = avg(students, "attendance_pct");
    const avgExam = avg(students, "midterm_score");
    renderKPIs({ total_students: 8, total_teachers: 2, high_risk_count: high, medium_risk_count: med, low_risk_count: low, avg_attendance: avgAtt, avg_exam_score: avgExam });
    allStudents = students;
  }

  allUsers = DEMO_USERS;
  filteredUsers = [...allUsers];
  filteredStudents = [...allStudents];

  renderOverviewCharts();
  renderHighRiskTable();
}

async function refreshAll() {
  riskChartInst?.destroy(); riskChartInst = null;
  trendChartInst?.destroy(); trendChartInst = null;
  await loadDashboardData();
}

// ── Section Navigation ─────────────────────────────────────────────────────────
function showSection(section) {
  ["overview","users","students","alerts","analytics","settings"].forEach(s => {
    document.getElementById(`section-${s}`).classList.toggle("hidden", s !== section);
    const nav = document.getElementById(`nav-${s}`);
    if (nav) nav.className = `sidebar-link${s === section ? " active" : ""}`;
  });
  const titles = {
    overview:  ["Admin Dashboard",       "System-wide overview"],
    users:     ["User Management",       "Manage students and teachers"],
    students:  ["All Students",          "System-wide academic records"],
    alerts:    ["Alerts & Notifications","High-risk student notifications"],
    analytics: ["System Analytics",      "Advanced performance analytics"],
    settings:  ["System Settings",       "Configure platform behaviour"],
  };
  document.getElementById("pageTitle").textContent = titles[section][0];
  document.getElementById("pageSubtitle").textContent = titles[section][1];
  if (section === "users") renderUserTable();
  if (section === "students") renderAllStudentsTable();
  if (section === "analytics") renderAnalyticsCharts();
}

// ── KPI Rendering ─────────────────────────────────────────────────────────────
function renderKPIs(stats) {
  document.getElementById("kpiStudents").textContent  = stats.total_students;
  document.getElementById("kpiTeachers").textContent  = stats.total_teachers;
  document.getElementById("kpiHighRisk").textContent  = stats.high_risk_count;
  document.getElementById("kpiAttendance").textContent= stats.avg_attendance + "%";
  document.getElementById("kpiLow").textContent       = stats.low_risk_count;
  document.getElementById("kpiMedium").textContent    = stats.medium_risk_count;
  document.getElementById("kpiAvgScore").textContent  = stats.avg_exam_score + "%";

  const total = stats.total_students || 1;
  const pct = ((stats.high_risk_count / total) * 100).toFixed(0);
  document.getElementById("kpiHighRiskPct").textContent = pct + "% of students";

  // Update sidebar badge
  const badge = document.getElementById("highRiskCount");
  if (stats.high_risk_count > 0) {
    badge.textContent = stats.high_risk_count;
    badge.classList.remove("hidden");
  }
  document.getElementById("hrCount").textContent = stats.high_risk_count;
}

// ── Overview Charts ───────────────────────────────────────────────────────────
function renderOverviewCharts() {
  const students = allStudents.length ? allStudents : DEMO_STUDENTS;
  const low  = students.filter(s => s.risk_level === "Low").length;
  const med  = students.filter(s => s.risk_level === "Medium").length;
  const high = students.filter(s => s.risk_level === "High").length;

  if (!riskChartInst) {
    riskChartInst = createDoughnutChart("adminRiskChart",
      ["Low Risk", "Medium Risk", "High Risk"],
      [low, med, high],
      ["#10b981", "#f59e0b", "#ef4444"]
    );
  }

  if (!trendChartInst) {
    trendChartInst = createLineChart("riskTrendChart",
      ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
      [
        { label: "High Risk",   data: [4, 5, 3, 6, 4, high], color: "#ef4444" },
        { label: "Medium Risk", data: [8, 7, 9, 6, 8, med],  color: "#f59e0b" },
        { label: "Low Risk",    data: [12, 11, 13, 10, 12, low], color: "#10b981" },
      ]
    );
  }
}

// ── User Table ─────────────────────────────────────────────────────────────────
function renderUserTable() {
  const tbody = document.getElementById("userTableBody");
  document.getElementById("userCount").textContent =
    `Showing ${filteredUsers.length} of ${allUsers.length} users`;

  if (!filteredUsers.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-slate-500">No users found.</td></tr>';
    return;
  }

  const roleBadge = r =>
    `<span class="px-2.5 py-1 rounded-full text-xs font-semibold badge-${r}">${r.charAt(0).toUpperCase()+r.slice(1)}</span>`;

  tbody.innerHTML = filteredUsers.map(u => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            ${u.role==="student"?"bg-blue-500/20 text-blue-400":u.role==="teacher"?"bg-emerald-500/20 text-emerald-400":"bg-purple-500/20 text-purple-400"}">
            ${u.name[0].toUpperCase()}
          </div>
          <div>
            <div class="font-medium text-white">${u.name}</div>
            <div class="text-xs text-slate-500">${u.email}</div>
          </div>
        </div>
      </td>
      <td>${roleBadge(u.role)}</td>
      <td class="text-slate-400">${u.department || "—"}</td>
      <td><span class="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Active</span></td>
      <td>
        <button onclick="promptDeleteUser('${u.id}','${u.name.replace(/'/g,"\\'")}','${u.role}')"
          class="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm">
          🗑️
        </button>
      </td>
    </tr>`
  ).join("");
}

function filterUsers() {
  const q    = document.getElementById("userSearch").value.toLowerCase();
  const role = document.getElementById("roleFilter").value;
  filteredUsers = allUsers.filter(u =>
    (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
    (!role || u.role === role)
  );
  renderUserTable();
}

// ── All Students Table ────────────────────────────────────────────────────────
function renderAllStudentsTable() {
  const tbody = document.getElementById("allStudentTableBody");
  document.getElementById("studentCount").textContent =
    `Showing ${filteredStudents.length} of ${allStudents.length} students`;

  if (!filteredStudents.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500">No students found.</td></tr>';
    return;
  }

  const riskBadge = r =>
    `<span class="px-2.5 py-1 rounded-full text-xs font-semibold badge-${r.toLowerCase()}">${r}</span>`;
  const attColor = v => v < 60 ? "text-red-400" : v < 75 ? "text-yellow-400" : "text-emerald-400";

  tbody.innerHTML = filteredStudents.map(s => {
    const examAvg = ((s.midterm_score + s.final_score) / 2).toFixed(1);
    return `<tr>
      <td>
        <div class="font-medium text-white">${s.name}</div>
        <div class="text-xs text-slate-500">${s.email}</div>
      </td>
      <td class="${attColor(s.attendance_pct)} font-semibold">${s.attendance_pct}%</td>
      <td>${s.assignment_avg}/100</td>
      <td>${examAvg}/100</td>
      <td>${riskBadge(s.risk_level)}</td>
      <td class="text-slate-400">${s.department || "—"}</td>
    </tr>`;
  }).join("");
}

function filterAllStudents() {
  const q    = document.getElementById("studentSearch").value.toLowerCase();
  const risk = document.getElementById("studentRiskFilter").value;
  filteredStudents = allStudents.filter(s =>
    (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) &&
    (!risk || s.risk_level === risk)
  );
  renderAllStudentsTable();
}

// ── High-Risk Table ────────────────────────────────────────────────────────────
function renderHighRiskTable() {
  const highRisk = allStudents.filter(s => s.risk_level === "High");
  document.getElementById("hrCount").textContent = highRisk.length;
  const tbody = document.getElementById("highRiskTable");

  if (!highRisk.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">✅ No high-risk students found.</td></tr>';
    return;
  }

  tbody.innerHTML = highRisk.map(s => `
    <tr>
      <td>
        <div class="font-medium text-white">${s.name}</div>
        <div class="text-xs text-slate-500">${s.email}</div>
      </td>
      <td class="${s.attendance_pct < 60 ? "text-red-400 font-bold" : "text-yellow-400"}">${s.attendance_pct}%</td>
      <td class="text-red-400">${s.assignment_avg}/100</td>
      <td>
        <div class="flex items-center gap-2">
          <div class="h-1.5 w-20 bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full bg-red-500 rounded-full" style="width:${(s.confidence*100).toFixed(0)}%"></div>
          </div>
          <span class="text-xs text-red-400 font-semibold">${(s.confidence*100).toFixed(0)}%</span>
        </div>
      </td>
      <td class="text-slate-400">${s.department || "—"}</td>
    </tr>`
  ).join("");
}

// ── Bulk Alert Sending ────────────────────────────────────────────────────────
async function sendBulkAlerts() {
  const btn    = document.getElementById("alertBtn");
  const status = document.getElementById("alertStatus");
  btn.disabled = true;
  btn.textContent = "⏳ Sending...";
  status.classList.remove("hidden");
  status.textContent = "Sending alert emails to teachers...";
  status.className = "text-sm text-yellow-400";

  try {
    if (!isDemoMode()) {
      const result = await apiCall("/alerts/notify", "POST");
      status.textContent = `✅ ${result.message}`;
    } else {
      await new Promise(r => setTimeout(r, 1500));
      const highCount = allStudents.filter(s => s.risk_level === "High").length;
      status.textContent = `✅ Demo: Alerts queued for ${highCount} high-risk student(s) across 2 teacher(s).`;
    }
    status.className = "text-sm text-emerald-400";
  } catch (err) {
    status.textContent = `❌ Failed: ${err.message}`;
    status.className = "text-sm text-red-400";
  } finally {
    btn.disabled = false;
    btn.textContent = "🔔 Send Alerts to All Teachers";
    status.classList.remove("hidden");
  }
}

// ── User Deletion ─────────────────────────────────────────────────────────────
function promptDeleteUser(id, name, role) {
  if (role === "admin") {
    alert("Cannot remove the admin account.");
    return;
  }
  deleteUserId = id;
  document.getElementById("deleteUserName").textContent = name;
  document.getElementById("deleteUserModal").classList.remove("hidden");
}

async function confirmDeleteUser() {
  if (!deleteUserId) return;
  allUsers = allUsers.filter(u => u.id !== deleteUserId);
  filteredUsers = [...allUsers];
  renderUserTable();
  document.getElementById("deleteUserModal").classList.add("hidden");
  deleteUserId = null;
}

// ── Analytics Charts ───────────────────────────────────────────────────────────
function renderAnalyticsCharts() {
  if (deptChartInst) return;

  // Department-wise risk (grouped bar)
  const depts = [...new Set(allStudents.map(s => s.department || "Unknown"))];
  const deptHigh   = depts.map(d => allStudents.filter(s => s.department === d && s.risk_level === "High").length);
  const deptMedium = depts.map(d => allStudents.filter(s => s.department === d && s.risk_level === "Medium").length);
  const deptLow    = depts.map(d => allStudents.filter(s => s.department === d && s.risk_level === "Low").length);

  deptChartInst = createBarChart("deptChart", depts, [
    { label: "High Risk",   data: deptHigh,   color: "#ef4444" },
    { label: "Medium Risk", data: deptMedium, color: "#f59e0b" },
    { label: "Low Risk",    data: deptLow,    color: "#10b981" },
  ]);

  // Monthly at-risk trend line
  monthlyChartInst = createLineChart("monthlyTrendChart",
    ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
    [
      { label: "High Risk Students",   data: [4, 5, 3, 6, 4, allStudents.filter(s => s.risk_level==="High").length],   color: "#ef4444" },
      { label: "Medium Risk Students", data: [8, 7, 9, 6, 8, allStudents.filter(s => s.risk_level==="Medium").length], color: "#f59e0b" },
    ]
  );

  // Scatter-like: attendance vs exam score (as bar pair)
  const sorted = [...allStudents].sort((a,b) => a.attendance_pct - b.attendance_pct);
  createBarChart("scatterChart",
    sorted.map(s => s.name.split(" ")[0]),
    [
      { label: "Attendance %",  data: sorted.map(s => s.attendance_pct), color: "#3b82f6" },
      { label: "Exam Avg",      data: sorted.map(s => ((s.midterm_score+s.final_score)/2).toFixed(1)), color: "#8b5cf6" },
    ]
  );
}

// ── Utility ────────────────────────────────────────────────────────────────────
function avg(arr, field) {
  if (!arr.length) return 0;
  return +(arr.reduce((s, x) => s + (x[field] || 0), 0) / arr.length).toFixed(1);
}
