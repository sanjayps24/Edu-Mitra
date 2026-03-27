/**
 * charts.js — Chart.js wrapper helpers for Edu-Mitra dashboards.
 * Provides pre-styled chart factories for performance trends, risk distribution, etc.
 */

const CHART_COLORS = {
  blue:   '#3b82f6',
  green:  '#10b981',
  yellow: '#f59e0b',
  red:    '#ef4444',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
  slate:  '#64748b',
};

const CHART_DEFAULTS = {
  color: '#94a3b8',
  font: { family: 'Inter', size: 12 },
};

/** Minimal Chart.js defaults for dark theme */
function applyDarkDefaults() {
  Chart.defaults.color = CHART_DEFAULTS.color;
  Chart.defaults.font.family = CHART_DEFAULTS.font.family;
  Chart.defaults.font.size = CHART_DEFAULTS.font.size;
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
}

// ── Line Chart ─────────────────────────────────────────────────────────────

/**
 * Create a smooth line chart for performance trends.
 * @param {string} canvasId - Canvas element ID
 * @param {string[]} labels - X-axis labels (e.g. semesters)
 * @param {Array} datasets - Array of { label, data, color } objects
 */
function createLineChart(canvasId, labels, datasets) {
  applyDarkDefaults();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color || CHART_COLORS.blue,
        backgroundColor: hexToRgba(ds.color || CHART_COLORS.blue, 0.1),
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: ds.color || CHART_COLORS.blue,
        pointHoverRadius: 6,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b' }
        },
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', callback: v => v + '%' }
        }
      }
    }
  });
}

// ── Bar Chart ──────────────────────────────────────────────────────────────

function createBarChart(canvasId, labels, datasets, xLabel = '', yLabel = '') {
  applyDarkDefaults();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: hexToRgba(ds.color || CHART_COLORS.blue, 0.75),
        borderColor: ds.color || CHART_COLORS.blue,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
}

// ── Doughnut Chart ─────────────────────────────────────────────────────────

function createDoughnutChart(canvasId, labels, data, colors) {
  applyDarkDefaults();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors || [CHART_COLORS.green, CHART_COLORS.yellow, CHART_COLORS.red],
        borderColor: '#0f172a',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', usePointStyle: true, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      }
    }
  });
}

// ── Radar Chart (feature importance) ──────────────────────────────────────

function createRadarChart(canvasId, labels, data, label = 'Feature Score') {
  applyDarkDefaults();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: CHART_COLORS.blue,
        backgroundColor: hexToRgba(CHART_COLORS.blue, 0.15),
        borderWidth: 2,
        pointBackgroundColor: CHART_COLORS.blue,
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8' } },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      },
      scales: {
        r: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          pointLabels: { color: '#94a3b8', font: { size: 11 } },
          ticks: { display: false },
        }
      }
    }
  });
}

// ── Horizontal Bar (feature importance) ───────────────────────────────────

function createHorizontalBar(canvasId, labels, data, colors) {
  applyDarkDefaults();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors || data.map(() => hexToRgba(CHART_COLORS.blue, 0.7)),
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          min: 0, max: 1,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        }
      }
    }
  });
}

// ── Utility ────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getRiskColor(riskLevel) {
  const map = { Low: CHART_COLORS.green, Medium: CHART_COLORS.yellow, High: CHART_COLORS.red };
  return map[riskLevel] || CHART_COLORS.slate;
}

function getRiskBadgeClass(riskLevel) {
  const map = {
    Low:    'bg-green-500/15 text-green-400 border border-green-500/30',
    Medium: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    High:   'bg-red-500/15 text-red-400 border border-red-500/30',
  };
  return map[riskLevel] || 'bg-slate-700 text-slate-300';
}
