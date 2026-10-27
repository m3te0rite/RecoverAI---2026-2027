/* ─── Shared SVG Icon Library ─────────────────────────────────────────────── */

export const Icon = {
  Activity: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Camera: (p = {}) => (
    <svg width={p.size||22} height={p.size||22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Play: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  Check: (p = {}) => (
    <svg width={p.size||11} height={p.size||11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: (p = {}) => (
    <svg width={p.size||12} height={p.size||12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  TrendUp: (p = {}) => (
    <svg width={p.size||11} height={p.size||11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  TrendDown: (p = {}) => (
    <svg width={p.size||11} height={p.size||11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
      <polyline points="17 18 23 18 23 12"/>
    </svg>
  ),
  Clipboard: (p = {}) => (
    <svg width={p.size||13} height={p.size||13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  ),
  Chart: (p = {}) => (
    <svg width={p.size||13} height={p.size||13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Protocol: (p = {}) => (
    <svg width={p.size||13} height={p.size||13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Info: (p = {}) => (
    <svg width={p.size||13} height={p.size||13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  Logo: (p = {}) => (
    <svg width={p.size||22} height={p.size||22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  User: (p = {}) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Lock: (p = {}) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Star: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Heart: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Share: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Logout: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Calendar: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Trophy: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="11"/>
      <path d="M7 4H17v7a5 5 0 0 1-10 0V4z"/>
      <path d="M7 8H3a2 2 0 0 0 2 2l2 .1"/><path d="M17 8h4a2 2 0 0 1-2 2l-2 .1"/>
    </svg>
  ),
  ArrowRight: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Volume2: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  ),
  VolumeX: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ),
  Printer: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
    </svg>
  ),
  Download: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  FileText: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Send: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  RefreshCw: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  X: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Video: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  MessageSquare: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Cpu: (p = {}) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
  ),
};

/* ─── Demo user accounts ─────────────────────────────────────────────────── */
export const DEMO_USERS = [
  {
    id: 'dr-patel',
    email: 'dr.patel@recoveryai.health',
    password: 'Rehab2026!',
    role: 'doctor',
    name: 'Dr. Sunita Patel',
    credentials: 'PT, DPT',
    initials: 'SP',
    site: 'University Health – Neuro Rehab Unit',
  },
  {
    id: 'john-d',
    email: 'john.d@email.com',
    password: 'Patient2026!',
    role: 'patient',
    name: 'John D.',
    initials: 'JD',
    dob: '03/18/1968',
    age: 58,
    dx: 'Ischemic Stroke (MCA, Right Hemisphere)',
    onset: 'Post-Stroke Day 42',
    therapist: 'Dr. Sunita Patel, PT, DPT',
  },
];

export function authenticate(email, password) {
  return DEMO_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  ) || null;
}

/* ─── Clinical data constants ────────────────────────────────────────────── */
export const ASSESSMENT_SCORES = [
  { name: 'Fugl-Meyer UE',  scale: '/66',  value: 34, prev: 28, norm: 66, color: '#0B7EA3'  },
  { name: 'Modified Ashworth (Biceps)', scale: '/4', value: 1, prev: 2, norm: 4, invert: true, color: '#0B6E4F' },
  { name: 'Barthel Index',  scale: '/100', value: 62, prev: 55, norm: 100, color: '#6D28D9' },
  { name: 'ARAT Score',     scale: '/57',  value: 21, prev: 17, norm: 57,  color: '#0B7EA3'  },
];

export const PROTOCOL = [
  { name: 'Shoulder Flexion — Active ROM',   detail: '3 × 10 reps · Full plane elevation',        status: 'done'   },
  { name: 'Shoulder Abduction — Active ROM', detail: '3 × 10 reps · 0°→180° target',              status: 'active' },
  { name: 'Elbow Extension — Gravity-Assist', detail: '2 × 15 reps · Spasticity Grade ≤ 2 MAS',  status: 'pending' },
  { name: 'Functional Reach — Forward',       detail: '5 trials · Baseline 24.3 cm',               status: 'pending' },
];

export const FRAMES   = 30;
export const FEATURES = 1;

export function calcAngle(a, b, c) {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * 180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

export function resampleToFrames(arr, targetLength = 30) {
  if (!arr || arr.length === 0) return new Float32Array(targetLength).fill(0);
  if (arr.length === targetLength) return Float32Array.from(arr);
  const result = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const t = (i / (targetLength - 1)) * (arr.length - 1);
    const low = Math.floor(t);
    const high = Math.min(low + 1, arr.length - 1);
    const frac = t - low;
    result[i] = arr[low] * (1 - frac) + arr[high] * frac;
  }
  return result;
}

export function calcTrunkTilt(lSho, rSho, lHip, rHip) {
  if (!lSho || !rSho) return { tiltDeg: 0, isCompensating: false };

  // True lateral spinal tilt: alignment of midpoint between shoulders vs midpoint between hips
  let spinalTilt = 0;
  const hasHips = lHip && rHip && (lHip.visibility ?? 1) > 0.35 && (rHip.visibility ?? 1) > 0.35;

  if (hasHips) {
    const midShoX = (lSho.x + rSho.x) / 2;
    const midShoY = (lSho.y + rSho.y) / 2;
    const midHipX = (lHip.x + rHip.x) / 2;
    const midHipY = (lHip.y + rHip.y) / 2;
    const dX = midShoX - midHipX;
    const dY = midHipY - midShoY; // Upward orientation
    if (Math.abs(dY) > 0.05) {
      spinalTilt = Math.abs(Math.atan2(dX, dY) * (180 / Math.PI));
    }
  }

  const tiltDeg = Math.round(spinalTilt);
  // In stroke rehabilitation, >= 14° lateral trunk lean indicates deltoid substitution compensation
  const isCompensating = hasHips && tiltDeg >= 14;
  return { tiltDeg, isCompensating, spinalTilt: tiltDeg };
}

// ---------- Persistent storage helpers ----------
export function saveSession(userId, session) {
  const key = `recoverai_${userId}_sessions`;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.unshift(session);
  localStorage.setItem(key, JSON.stringify(existing));
}

export function loadHistory(userId) {
  const key = `recoverai_${userId}_sessions`;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

export function exportCSV(userId) {
  const sessions = loadHistory(userId);
  if (!sessions.length) return;
  const header = ['timestamp','repN','pass','peak','confidence'];
  const rows = sessions.flatMap(s => s.repLog.map(r => [new Date(s.timestamp).toISOString(), r.repN, r.pass, r.peak, r.conf]));
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${userId}_recoverai_report.csv`;
  a.click();
}

// ---------- Graph‑metric implementation (client‑side) ----------
export async function runGraphMetrics(landmarks) {
  // Simple graph: each landmark is a node; edges connect sequential points.
  // landmarks: [{x:number,y:number}, ...]
  const n = landmarks.length;
  if (n === 0) return {};
  // Build adjacency list
  const adj = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n - 1; i++) {
    adj[i].add(i + 1);
    adj[i + 1].add(i);
  }
  // Degree centrality
  const degree_centrality = {};
  adj.forEach((neighbors, i) => {
    degree_centrality[i] = neighbors.size / (n - 1);
  });
  // Betweenness centrality (Brandes algorithm simplified)
  const betweenness_centrality = {};
  for (let s = 0; s < n; s++) {
    const stack = [];
    const pred = Array.from({ length: n }, () => []);
    const sigma = Array(n).fill(0);
    const dist = Array(n).fill(-1);
    sigma[s] = 1;
    dist[s] = 0;
    const queue = [s];
    while (queue.length) {
      const v = queue.shift();
      stack.push(v);
      adj[v].forEach(w => {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      });
    }
    const delta = Array(n).fill(0);
    while (stack.length) {
      const w = stack.pop();
      pred[w].forEach(v => {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      });
      if (w !== s) {
        betweenness_centrality[w] = (betweenness_centrality[w] || 0) + delta[w];
      }
    }
  }
  // Normalize betweenness
  const normFactor = 1 / ((n - 1) * (n - 2));
  Object.keys(betweenness_centrality).forEach(k => {
    betweenness_centrality[k] *= normFactor;
  });
  // Clustering coefficient (triangles for each node)
  const clustering_coefficient = {};
  for (let i = 0; i < n; i++) {
    const neighbors = Array.from(adj[i]);
    const k = neighbors.length;
    if (k < 2) {
      clustering_coefficient[i] = 0;
      continue;
    }
    let links = 0;
    for (let a = 0; a < k; a++) {
      for (let b = a + 1; b < k; b++) {
        if (adj[neighbors[a]].has(neighbors[b])) links++;
      }
    }
    clustering_coefficient[i] = (2 * links) / (k * (k - 1));
  }
  // Eigenvector centrality (power iteration)
  const eigenvector_centrality = {};
  let vec = Array(n).fill(1 / Math.sqrt(n));
  for (let iter = 0; iter < 20; iter++) {
    const next = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      adj[i].forEach(j => { next[i] += vec[j]; });
    }
    const norm = Math.sqrt(next.reduce((s, v) => s + v * v, 0));
    vec = next.map(v => v / norm);
  }
  vec.forEach((v, i) => { eigenvector_centrality[i] = v; });
  // Graph density
  const edges = adj.reduce((sum, s) => sum + s.size, 0) / 2;
  const graph_density = edges / (n * (n - 1) / 2);
  return {
    degree_centrality,
    betweenness_centrality,
    clustering_coefficient,
    eigenvector_centrality,
    graph_density,
  };
}

// ---------- Risk model stub ----------
export async function runRiskModel(features) {
  // Placeholder: always return "stable".
  // Replace with ONNX inference when a trained model is provided.
  return 'stable';
}

// End of file
