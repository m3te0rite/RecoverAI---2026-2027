// src/shared/api.js – thin wrapper around the Express persistence layer
export async function loadState() {
  try {
    const resp = await fetch('http://localhost:3001/api/state');
    if (!resp.ok) return null;
    const data = await resp.json();
    return data;
  } catch (e) {
    console.warn('[RecoverAI API] Failed to load state from server:', e);
    return null;
  }
}

export async function saveState(state) {
  try {
    const resp = await fetch('http://localhost:3001/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    return resp.ok;
  } catch (e) {
    console.warn('[RecoverAI API] Failed to save state to server:', e);
    return false;
  }
}
