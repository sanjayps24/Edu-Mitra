/**
 * auth.js — Authentication utilities for Edu-Mitra frontend.
 * Handles API login/register calls, JWT storage, and session management.
 */

const API_BASE = 'http://localhost:8000';

// ── Token Management ──────────────────────────────────────────────────────────

function saveSession(data) {
  localStorage.setItem('edu_token', data.access_token || data.token);
  localStorage.setItem('edu_user', JSON.stringify({
    id: data.user_id,
    name: data.name,
    role: data.role,
    email: data.email,
  }));
}

function getToken() {
  return localStorage.getItem('edu_token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('edu_user'));
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return !!getToken() && !!getUser();
}

function logout() {
  localStorage.removeItem('edu_token');
  localStorage.removeItem('edu_user');
  window.location.href = 'login.html';
}

/** Guard: redirect to login if not authenticated or wrong role. */
function requireAuth(allowedRoles = []) {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  const user = getUser();
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const redirectMap = { student: 'student_dashboard.html', teacher: 'teacher_dashboard.html', admin: 'admin_dashboard.html' };
    window.location.href = redirectMap[user.role] || 'login.html';
    return false;
  }
  return true;
}

// ── API Call Helper ───────────────────────────────────────────────────────────

async function apiCall(endpoint, method = 'GET', body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token && !token.startsWith('demo-')) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'API error');
  return data;
}

// ── Auth API Calls ────────────────────────────────────────────────────────────

async function authLogin(email, password, role) {
  try {
    const data = await apiCall('/auth/login', 'POST', { email, password }, false);
    saveSession(data);
    return { success: true, role: data.role };
  } catch (err) {
    // Demo mode fallback
    return demLogin(email, password, role);
  }
}

async function authRegister({ name, email, password, role, department }) {
  try {
    const data = await apiCall('/auth/register', 'POST', { name, email, password, role, department }, false);
    return { success: true, ...data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ── Demo Mode ─────────────────────────────────────────────────────────────────

const DEMO_USERS = {
  'student@demo.com': { role: 'student', name: 'Alex Johnson', id: 'demo-s1', email: 'student@demo.com' },
  'teacher@demo.com': { role: 'teacher', name: 'Prof. Sarah Chen', id: 'demo-t1', email: 'teacher@demo.com' },
  'admin@demo.com':   { role: 'admin',   name: 'Admin User',    id: 'demo-a1', email: 'admin@demo.com' },
};

function demLogin(email, password, role) {
  // Allow any email with password length >= 6 in demo mode, mapped to the role tab selected
  const demoUser = DEMO_USERS[email] || {
    role: role || 'student',
    name: email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    id: 'demo-' + Math.random().toString(36).slice(2, 8),
    email,
  };
  if (password.length < 6) return { success: false, message: 'Password too short.' };
  localStorage.setItem('edu_token', 'demo-token-' + demoUser.role);
  localStorage.setItem('edu_user', JSON.stringify(demoUser));
  return { success: true, role: demoUser.role };
}

function isDemoMode() {
  const t = getToken();
  return t && t.startsWith('demo-');
}
