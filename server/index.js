// server/index.js – tiny Express API for state persistence
// server/index.js – tiny Express API for state persistence (ES module version)
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const STATE_FILE = path.join(__dirname, 'state.json');

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading state file:', e);
  }
  return {};
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing state file:', e);
    return false;
  }
}

app.get('/api/state', (req, res) => {
  const state = readState();
  res.json(state);
});

app.post('/api/state', (req, res) => {
  const newState = req.body;
  if (writeState(newState)) {
    res.json({ ok: true });
  } else {
    res.status(500).json({ ok: false, error: 'Failed to write state' });
  }
});

app.listen(PORT, () => {
  console.log(`RecoverAI server listening on http://localhost:${PORT}`);
});
