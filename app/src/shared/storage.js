/* ─── RecoverAI Shared Storage & State Management ────────────────────────── */
// Provides real-time synchronization between Patient and Clinician portals via localStorage and custom window events.

const STORAGE_KEY = 'recoverai_shared_state_v1';

const INITIAL_STATE = {
  patient: {
    id: 'john-d',
    name: 'John D.',
    initials: 'JD',
    dob: '03/18/1968',
    age: 58,
    gender: 'M',
    mrn: 'MRN-20261004',
    dx: 'Ischemic Stroke (MCA, Right Hemisphere)',
    onset: 'Post-Stroke Day 42',
    affectedSide: 'Left Upper Extremity (Hemiparesis)',
    therapist: 'Dr. Sunita Patel, PT, DPT',
    site: 'University Health – Neuro Rehab Unit',
  },
  todaySession: {
    totalReps: 0,
    compliantReps: 0,
    sessionPeak: 0,
    repLog: [],
    lastUpdated: null,
  },
  // 14-Day Longitudinal Rehabilitation History (Reflecting the published clinical decline pattern)
  history14Days: [
    { day: 1,  date: 'Oct 05', rom: 82, adherence: 100, targetReps: 10, completedReps: 10, compliantReps: 9, smoothness: 84 },
    { day: 2,  date: 'Oct 06', rom: 84, adherence: 100, targetReps: 10, completedReps: 10, compliantReps: 9, smoothness: 85 },
    { day: 3,  date: 'Oct 07', rom: 81, adherence: 90,  targetReps: 10, completedReps: 9,  compliantReps: 8, smoothness: 82 },
    { day: 4,  date: 'Oct 08', rom: 83, adherence: 100, targetReps: 10, completedReps: 10, compliantReps: 8, smoothness: 81 },
    { day: 5,  date: 'Oct 09', rom: 80, adherence: 90,  targetReps: 10, completedReps: 9,  compliantReps: 8, smoothness: 80 },
    { day: 6,  date: 'Oct 10', rom: 82, adherence: 100, targetReps: 10, completedReps: 10, compliantReps: 8, smoothness: 82 },
    { day: 7,  date: 'Oct 11', rom: 79, adherence: 80,  targetReps: 10, completedReps: 8,  compliantReps: 6, smoothness: 78 },
    { day: 8,  date: 'Oct 12', rom: 78, adherence: 80,  targetReps: 10, completedReps: 8,  compliantReps: 6, smoothness: 76 },
    { day: 9,  date: 'Oct 13', rom: 76, adherence: 70,  targetReps: 10, completedReps: 7,  compliantReps: 5, smoothness: 74 },
    { day: 10, date: 'Oct 14', rom: 75, adherence: 70,  targetReps: 10, completedReps: 7,  compliantReps: 5, smoothness: 72 },
    { day: 11, date: 'Oct 15', rom: 73, adherence: 60,  targetReps: 10, completedReps: 6,  compliantReps: 4, smoothness: 69 },
    { day: 12, date: 'Oct 16', rom: 71, adherence: 60,  targetReps: 10, completedReps: 6,  compliantReps: 4, smoothness: 67 },
    { day: 13, date: 'Oct 17', rom: 70, adherence: 50,  targetReps: 10, completedReps: 5,  compliantReps: 3, smoothness: 65 },
    { day: 14, date: 'Today',  rom: 68, adherence: 60,  targetReps: 10, completedReps: 6,  compliantReps: 3, smoothness: 63 },
  ],
  messages: [
    {
      id: 'm1',
      sender: 'Dr. Sunita Patel',
      role: 'doctor',
      time: 'Oct 16, 09:15 AM',
      text: 'Good morning John. I reviewed your data from earlier this week. It looks like the shoulder elevation is becoming a bit more fatiguing. How is the spasticity feeling in the morning?',
    },
    {
      id: 'm2',
      sender: 'John D.',
      role: 'patient',
      time: 'Oct 16, 11:30 AM',
      text: 'Hi Dr. Patel. Yes, by rep 5 my shoulder feels quite tight and heavy. I had some trouble finishing the full 10 reps yesterday.',
    },
    {
      id: 'm3',
      sender: 'Dr. Sunita Patel',
      role: 'doctor',
      time: 'Oct 16, 01:45 PM',
      text: 'Thank you for letting me know. Try performing a gentle 3-minute warm-up stretch before opening RecoverAI. Continue what you can safely do and do not force through sharp pain.',
    },
  ],
  settings: {
    voiceEnabled: true,
    simulationMode: false,
  },
};

export function getRehabState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
      return INITIAL_STATE;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('[RecoverAI Storage] Error reading state:', err);
    return INITIAL_STATE;
  }
}

export function saveRehabState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('recoverai_state_changed', { detail: state }));
    // Persist to server (fire‑and‑forget)
    fetch('http://localhost:3001/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(err => console.warn('[RecoverAI Storage] Server sync failed:', err));
  } catch (err) {
    console.error('[RecoverAI Storage] Error saving state:', err);
  }
}

export function recordRepetition(repData) {
  const state = getRehabState();
  const session = state.todaySession;

  const newTotal = session.totalReps + 1;
  const newCompliant = repData.pass ? session.compliantReps + 1 : session.compliantReps;
  const newPeak = Math.max(session.sessionPeak, repData.peak);
  const newLog = [
    {
      repN: newTotal,
      pass: repData.pass,
      peak: repData.peak,
      conf: repData.conf,
      compensation: !!repData.compensation,
      tiltDeg: repData.tiltDeg || 0,
      ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
    },
    ...session.repLog,
  ].slice(0, 20);

  state.todaySession = {
    totalReps: newTotal,
    compliantReps: newCompliant,
    sessionPeak: newPeak,
    repLog: newLog,
    lastUpdated: new Date().toISOString(),
  };

  // Update Day 14 (Today's entry) in the longitudinal series
  const lastIndex = state.history14Days.length - 1;
  if (lastIndex >= 0) {
    const todayRec = state.history14Days[lastIndex];
    const totalTodayReps = todayRec.completedReps + 1;
    const compliantTodayReps = repData.pass ? todayRec.compliantReps + 1 : todayRec.compliantReps;
    todayRec.completedReps = totalTodayReps;
    todayRec.compliantReps = compliantTodayReps;
    todayRec.adherence = Math.min(100, Math.round((totalTodayReps / todayRec.targetReps) * 100));
    todayRec.rom = Math.max(todayRec.rom, repData.peak);
  }

  saveRehabState(state);
  return state;
}

export function addMessage(senderName, role, text) {
  const state = getRehabState();
  const newMsg = {
    id: `m_${Date.now()}`,
    sender: senderName,
    role: role,
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    text: text.trim(),
  };
  state.messages = [...state.messages, newMsg];
  saveRehabState(state);
  return state;
}

export function updateSettings(newSettings) {
  const state = getRehabState();
  state.settings = { ...state.settings, ...newSettings };
  saveRehabState(state);
  return state;
}

export function clearTodaySession() {
  const state = getRehabState();
  state.todaySession = {
    totalReps: 0,
    compliantReps: 0,
    sessionPeak: 0,
    repLog: [],
    lastUpdated: null,
  };
  const lastIndex = state.history14Days.length - 1;
  if (lastIndex >= 0) {
    state.history14Days[lastIndex].completedReps = 0;
    state.history14Days[lastIndex].compliantReps = 0;
    state.history14Days[lastIndex].adherence = 0;
    state.history14Days[lastIndex].rom = 0;
  }
  saveRehabState(state);
  return state;
}

export function resetToBaseline() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
  window.dispatchEvent(new CustomEvent('recoverai_state_changed', { detail: INITIAL_STATE }));
  return INITIAL_STATE;
}
