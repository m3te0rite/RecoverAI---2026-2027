/* ─── Web Speech Synthesis Audio Guidance Coach ──────────────────────────── */
// Provides clear spoken feedback for stroke rehabilitation patients with hemiparesis
// who cannot stand 6 feet away and easily read text on a small display.

class VoiceCoach {
  constructor() {
    this.enabled = true;
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  }

  setEnabled(val) {
    this.enabled = !!val;
    if (!this.enabled && this.synth) {
      this.synth.cancel();
    }
  }

  speak(text, priority = false) {
    if (!this.enabled || !this.synth) return;

    try {
      if (priority) {
        this.synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      // Select natural English voice if available
      const voices = this.synth.getVoices();
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
      if (preferred) utterance.voice = preferred;

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('[VoiceCoach] Speech error:', e);
    }
  }

  announceRep(repNumber, peakAngle, isPass) {
    if (isPass) {
      this.speak(`Repetition ${repNumber} completed. ${peakAngle} degrees. Excellent range of motion!`);
    } else {
      this.speak(`Repetition ${repNumber} recorded at ${peakAngle} degrees. Try to raise your arm a bit higher.`);
    }
  }

  announceStart() {
    this.speak('Exercise started. Stand clear and raise your arm steadily.', true);
  }

  announceReady() {
    this.speak('AI vision ready. Click Start Exercise whenever you are positioned.');
  }

  announceCompensation() {
    const now = Date.now();
    if (this.lastCompensationAlert && (now - this.lastCompensationAlert < 8000)) return;
    this.lastCompensationAlert = now;
    this.speak('Posture alert: trunk compensation detected. Please keep your spine upright.');
  }
}

export const voiceCoach = new VoiceCoach();
