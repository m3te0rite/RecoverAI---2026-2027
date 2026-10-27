import { useState, useEffect, useRef, useCallback } from 'react';
import * as ort from 'onnxruntime-web';
import {
  Icon, ASSESSMENT_SCORES, PROTOCOL,
  FRAMES, FEATURES, calcAngle, calcTrunkTilt, resampleToFrames,
} from '../../shared/shared.jsx';
import { getRehabState, recordRepetition, clearTodaySession } from '../../shared/storage.js';
import { runModelBAnalysis, runModelBONNXInference } from '../../shared/modelB.js';
import { voiceCoach } from '../../shared/voice.js';
import { SimulatedPatientEngine } from '../../shared/simulation.js';
import { exportSessionCSV } from '../../shared/exportCSV.js';
import ReportModal from '../ReportModal/ReportModal.jsx';
import './DoctorPortal.css';

export default function DoctorPortal({ user, onLogout }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const modelRef  = useRef(null);
  const repStateRef = useRef({
    phase: 'idle',
    frames: [],
    peak: 0,
    maxTilt: 0,
    compensation: false,
    startTime: 0,
    lastRepTime: 0,
  });
  const simEngineRef = useRef(null);
  const cameraInstanceRef = useRef(null);
  const compensationRef = useRef({ detected: false, tiltDeg: 0 });

  // Active navigation tab
  // 'analysis' | 'records' | 'outcomes' | 'history' | 'reports'
  const [activeTab, setActiveTab] = useState('analysis');

  // Shared store data
  const [rehabState, setRehabState] = useState(getRehabState);
  const [modelB, setModelB] = useState(() => runModelBAnalysis(rehabState.history14Days));

  // Running mode & hardware controls
  const [feedMode, setFeedMode] = useState('camera');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [modelReady, setModelReady] = useState(false);

  // Live session kinematics
  const [liveAngle, setLiveAngle] = useState(null);
  const [peakAngle, setPeakAngle] = useState(null);
  const [feedback, setFeedback] = useState({
    title: 'Clinical kinematic monitoring ready.',
    body:  'Position the patient 1.5–2m away or switch to "Simulated Demo" to test edge inference on synthetic patient data.',
    type:  'idle',
  });

  // Modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Storage listener for real-time doctor/patient sync
  useEffect(() => {
    const handleSync = (e) => {
      const updated = e.detail || getRehabState();
      setRehabState(updated);
      setModelB(runModelBAnalysis(updated.history14Days));
      runModelBONNXInference(updated.history14Days).then(res => {
        if (res) setModelB(res);
      });
    };

    window.addEventListener('recoverai_state_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('recoverai_state_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Run on-device Model B ONNX inference whenever 14-day history changes
  useEffect(() => {
    let active = true;
    runModelBONNXInference(rehabState.history14Days).then(res => {
      if (active && res) setModelB(res);
    });
    return () => { active = false; };
  }, [rehabState.history14Days]);

  // Initialize ONNX runtime model
  useEffect(() => {
    ort.env.wasm.numThreads = 1;
    ort.InferenceSession
      .create('/repetition_model.onnx', { executionProviders: ['wasm'] })
      .then(s => {
        modelRef.current = s;
        setModelReady(true);
      })
      .catch(e => console.error('[DoctorPortal] ONNX error:', e));
  }, []);

  const toggleVoice = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    voiceCoach.setEnabled(nextVal);
  };

  // Evaluate rep
  const evaluate = useCallback(async (seq, compMeta = {}) => {
    if (!modelRef.current) return;
    try {
      const input  = new ort.Tensor('float32', new Float32Array(seq), [1, FRAMES, FEATURES]);
      const result = await modelRef.current.run({ input });
      const logits = result.output.data;
      const expA = Math.exp(logits[0]), expB = Math.exp(logits[1]);
      const sumE  = expA + expB;
      const confCorrect = expB / sumE;
      const pass  = confCorrect > 0.5;
      const conf  = Math.round((pass ? confCorrect : expA / sumE) * 100);
      const peak  = compMeta.peak || Math.round(Math.max(...seq));

      setPeakAngle(peak);

      const isComp = !!compMeta.compensation;
      const tiltDeg = compMeta.tiltDeg || 0;

      // Save to shared storage
      const updatedState = recordRepetition({ pass, peak, conf, compensation: isComp, tiltDeg });
      setRehabState(updatedState);
      setModelB(runModelBAnalysis(updatedState.history14Days));
      runModelBONNXInference(updatedState.history14Days).then(res => {
        if (res) setModelB(res);
      });

      // Spoken cue
      voiceCoach.announceRep(updatedState.todaySession.totalReps, peak, pass);

      if (isComp) {
        setFeedback({
          title: 'Compensatory trunk lean detected! ⚠️',
          body: `Peak ROM: ${peak}°, but patient leaned trunk by ${tiltDeg}°. Deltoid isolation compromised by spinal substitution.`,
          type: 'warn',
        });
      } else if (pass) {
        setFeedback({
          title: 'Repetition within therapeutic range.',
          body: `Peak ROM: ${peak}° meets functional threshold (≥ 150°) with upright posture. Model confidence: ${conf}%.`,
          type: 'good',
        });
      } else {
        setFeedback({
          title: 'Sub-threshold range of motion.',
          body: `Peak ROM: ${peak}° is below 150° threshold. Model confidence: ${conf}%. Suspected muscle fatigue or spasticity barrier.`,
          type: 'warn',
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Start live analysis
  const startSession = useCallback(() => {
    compensationRef.current = { detected: false, tiltDeg: 0 };

    if (feedMode === 'simulation') {
      if (!canvasRef.current) return;
      simEngineRef.current = new SimulatedPatientEngine(
        canvasRef.current,
        setLiveAngle,
        (seq, meta) => evaluate(seq, meta)
      );
      simEngineRef.current.start();
      setIsSessionActive(true);
      voiceCoach.announceStart();
      setFeedback({
        title: 'Synthetic Patient Kinematic Feed Active',
        body: 'Simulating stroke motor recovery pattern with automated posture compensation detection. Edge ONNX inference active.',
        type: 'idle',
      });
      return;
    }

    // Camera mode
    const PoseClass = window.Pose;
    const CameraClass = window.Camera;
    if (!PoseClass || !CameraClass) {
      alert('MediaPipe is loading. Please wait a moment and try again.');
      return;
    }

    const pose = new PoseClass({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(results => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.poseLandmarks) {
        const hip = results.poseLandmarks[23];
        const rHip = results.poseLandmarks[24];
        const sho = results.poseLandmarks[11];
        const rSho = results.poseLandmarks[12];
        const elb = results.poseLandmarks[13];
        const wrist = results.poseLandmarks[15];

        const deg = calcAngle(hip, sho, elb);
        setLiveAngle(Math.round(deg));

        // Evaluate compensatory trunk lean
        const tiltData = calcTrunkTilt(sho, rSho, hip, rHip);
        if (tiltData.isCompensating) {
          compensationRef.current = { detected: true, tiltDeg: tiltData.tiltDeg };
          voiceCoach.announceCompensation();
        }

        const W = canvasRef.current.width;
        const H = canvasRef.current.height;
        const pts = [hip, sho, elb, wrist];

        ctx.beginPath();
        ctx.strokeStyle = tiltData.isCompensating ? '#EF4444' : deg >= 150 ? '#10B981' : deg >= 100 ? '#F59E0B' : '#EF4444';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        pts.forEach((p, i) => {
          const x = p.x * W, y = p.y * H;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        pts.forEach(p => {
          ctx.beginPath();
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = tiltData.isCompensating ? '#EF4444' : '#0B7EA3';
          ctx.lineWidth = 2;
          ctx.arc(p.x * W, p.y * H, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });

        // Shoulder flexion angle HUD card (safe margin x=18, y=18)
        ctx.fillStyle = 'rgba(10, 37, 64, 0.88)';
        ctx.beginPath();
        ctx.roundRect(18, 18, 156, 62, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        ctx.fillText('SHOULDER FLEXION', 30, 38);

        ctx.fillStyle = deg >= 150 ? '#10B981' : deg >= 100 ? '#F59E0B' : '#EF4444';
        ctx.font = '700 26px JetBrains Mono, monospace';
        ctx.fillText(`${Math.round(deg)}°`, 30, 68);

        // Posture / Tilt HUD card
        ctx.fillStyle = tiltData.isCompensating ? 'rgba(220, 38, 38, 0.94)' : 'rgba(10, 37, 64, 0.88)';
        ctx.beginPath();
        ctx.roundRect(18, 86, 156, 32, 6);
        ctx.fill();
        ctx.strokeStyle = tiltData.isCompensating ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 10px Inter, system-ui, sans-serif';
        ctx.fillText(tiltData.isCompensating ? `⚠️ TRUNK LEAN: ${tiltData.tiltDeg}°` : `POSTURE: UPRIGHT (${tiltData.tiltDeg}°)`, 28, 106);

        // Prominent Alert Banner on canvas if compensating (positioned to the right of HUD card)
        if (tiltData.isCompensating) {
          ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
          ctx.beginPath();
          ctx.roundRect(186, 18, Math.max(200, W - 204), 34, 6);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`⚠️ TRUNK COMPENSATION DETECTED (${tiltData.tiltDeg}°) — REPOSITION PATIENT`, 186 + (W - 204) / 2, 39);
          ctx.textAlign = 'left';
        }

        // --- Clinical Repetition Tracking State Machine ---
        const rep = repStateRef.current;
        const now = performance.now();

        if (tiltData.isCompensating) {
          rep.compensation = true;
          rep.maxTilt = Math.max(rep.maxTilt, tiltData.tiltDeg);
        }

        if (rep.phase === 'idle') {
          // Patient begins lifting arm (crosses 50° with 800ms cooldown)
          if (deg >= 50 && (now - rep.lastRepTime > 800)) {
            rep.phase = 'up';
            rep.frames = [deg];
            rep.peak = deg;
            rep.maxTilt = tiltData.tiltDeg;
            rep.compensation = tiltData.isCompensating;
            rep.startTime = now;
          }
        } else if (rep.phase === 'up') {
          rep.frames.push(deg);
          if (deg > rep.peak) {
            rep.peak = deg;
          }

          // Patient returns arm down to rest (below 42°)
          if (deg <= 42) {
            // Valid repetition: reached at least 65° peak and took at least 0.6 seconds
            if (rep.peak >= 65 && (now - rep.startTime >= 600)) {
              const sampledSeq = resampleToFrames(rep.frames, FRAMES);
              evaluate(sampledSeq, {
                compensation: rep.compensation,
                tiltDeg: rep.maxTilt,
                peak: Math.round(rep.peak),
              });
              rep.lastRepTime = now;
            }
            rep.phase = 'idle';
            rep.frames = [];
            rep.peak = 0;
            rep.maxTilt = 0;
            rep.compensation = false;
          }
        }
      }
      ctx.restore();
    });

    const camera = new CameraClass(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) await pose.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });
    camera.start();
    cameraInstanceRef.current = camera;
    setIsSessionActive(true);
    voiceCoach.announceStart();
  }, [evaluate, feedMode]);

  const stopSession = () => {
    if (simEngineRef.current) {
      simEngineRef.current.stop();
      simEngineRef.current = null;
    }
    if (cameraInstanceRef.current) {
      try { cameraInstanceRef.current.stop(); } catch (e) { console.error(e); }
      cameraInstanceRef.current = null;
    }
    repStateRef.current = {
      phase: 'idle',
      frames: [],
      peak: 0,
      maxTilt: 0,
      compensation: false,
      startTime: 0,
      lastRepTime: 0,
    };
    setIsSessionActive(false);
    setLiveAngle(null);
  };

  const handleModeChange = (mode) => {
    if (isSessionActive) stopSession();
    setFeedMode(mode);
  };

  const todaySession = rehabState.todaySession || {};
  const totalReps = todaySession.totalReps || 0;
  const compliantReps = todaySession.compliantReps || 0;
  const sessionPeak = todaySession.sessionPeak || 0;
  const repLog = todaySession.repLog || [];
  const compliance = totalReps > 0 ? Math.round((compliantReps / totalReps) * 100) : null;
  const angleClass = liveAngle === null ? '' : liveAngle >= 150 ? 'good' : liveAngle >= 100 ? 'warn' : 'crit';
  const now = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

  // Other demo patients for clinical roster view
  const PATIENT_ROSTER = [
    {
      id: 'john-d',
      name: 'John D.',
      age: 58,
      gender: 'M',
      dx: 'Ischemic Stroke (MCA)',
      chronicity: 'Day 42',
      adherence: `${modelB.w2Adh}%`,
      romChange: `${modelB.romDelta > 0 ? '+' : ''}${modelB.romDelta}%`,
      status: modelB.dropoutRisk === 'High' ? 'crit' : 'good',
      statusText: modelB.dropoutRisk === 'High' ? 'High Risk: Adherence Slump' : 'On Track',
      peakRom: `${sessionPeak || 68}°`,
    },
    {
      id: 'maria-s',
      name: 'Maria Santos',
      age: 64,
      gender: 'F',
      dx: 'Hemorrhagic Stroke (Basal Ganglia)',
      chronicity: 'Day 28',
      adherence: '92%',
      romChange: '+14.5%',
      status: 'good',
      statusText: 'Improving Trajectory',
      peakRom: '142°',
    },
    {
      id: 'robert-c',
      name: 'Robert Chen',
      age: 71,
      gender: 'M',
      dx: 'Ischemic Stroke (PCA)',
      chronicity: 'Day 65',
      adherence: '74%',
      romChange: '+2.1%',
      status: 'warn',
      statusText: 'Motor Plateau',
      peakRom: '118°',
    },
  ];

  return (
    <div className="dp-shell">
      {/* Topbar */}
      <nav className="dp-topbar">
        <div className="dp-topbar-logo" onClick={() => setActiveTab('analysis')}>
          <Icon.Logo size={22} />
          <div>
            <div className="dp-topbar-name">Recover<span>AI</span></div>
            <div className="dp-topbar-tag">Rehabilitation Intelligence Platform</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="dp-topbar-nav">
          <div
            className={`dp-topbar-nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            Movement Analysis
          </div>
          <div
            className={`dp-topbar-nav-item ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            Patient Records
          </div>
          <div
            className={`dp-topbar-nav-item ${activeTab === 'outcomes' ? 'active' : ''}`}
            onClick={() => setActiveTab('outcomes')}
          >
            Outcome Measures {modelB.dropoutRisk === 'High' && '⚠️'}
          </div>
          <div
            className={`dp-topbar-nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Session History
          </div>
          <div
            className={`dp-topbar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </div>
        </div>

        {/* Topbar Controls */}
        <div className="dp-topbar-right">
          <button
            className={`dp-btn-pill ${voiceEnabled ? 'active' : ''}`}
            onClick={toggleVoice}
            title={voiceEnabled ? 'Audio Cue Guidance Active' : 'Audio Cues Muted'}
          >
            {voiceEnabled ? <Icon.Volume2 size={12} /> : <Icon.VolumeX size={12} />}
            {voiceEnabled ? 'Audio On' : 'Muted'}
          </button>

          <button
            className="dp-btn-pill"
            onClick={() => exportSessionCSV(rehabState.patient, repLog, rehabState.history14Days)}
            title="Download raw repetition and longitudinal data in CSV format"
          >
            <Icon.Download size={12} /> Export CSV
          </button>

          <button
            className="dp-btn-pill"
            onClick={() => setShowReportModal(true)}
            title="Export 14-day rehabilitation summary"
          >
            <Icon.Printer size={12} /> Export EMR Report
          </button>

          <span className="dp-topbar-badge">Clinician Portal</span>
          <span className="dp-user-name">{user.name}, {user.credentials}</span>
          <div className="dp-topbar-user" title={user.name}>{user.initials}</div>
          <button className="dp-logout" onClick={onLogout} title="Sign out">
            <Icon.Logout size={14} />
          </button>
        </div>
      </nav>

      {/* Model B Automated Clinical Alert Bar (Persistent across portals if high risk) */}
      {modelB.dropoutRisk === 'High' && (
        <div className="dp-alert-bar">
          <div className="dp-alert-content">
            <Icon.Alert size={16} />
            <div>
              <strong>Model B Clinical Decision Support Alert:</strong> {modelB.alert?.headline} — Active ROM decreased by {Math.abs(modelB.romDelta)}% with {modelB.w2Adh}% adherence.
            </div>
          </div>
          <button className="dp-alert-action-btn" onClick={() => setActiveTab('outcomes')}>
            Review Longitudinal Analytics →
          </button>
        </div>
      )}

      {/* Patient Banner */}
      <div className="dp-patient-banner">
        <div className="dp-patient-avatar">JD</div>
        <div className="dp-patient-info">
          <div className="dp-patient-name">
            John D.
            <span className="dp-pchip dp-pchip-dx">Ischemic Stroke (MCA, Right Hemisphere)</span>
            <span className="dp-pchip dp-pchip-day">Post-Stroke Day 42</span>
            <span className="dp-pchip dp-pchip-therapist">Dr. S. Patel, PT, DPT</span>
          </div>
          <div className="dp-patient-dob">
            <span>DoB: 03/18/1968 | 58M</span>
            <span>MRN-20261004</span>
            <span>University Health – Neuro Rehab Unit</span>
          </div>
        </div>
        <div className="dp-patient-vitals">
          <div className="dp-pvital">
            <div className="dp-pvital-val">{totalReps}</div>
            <div className="dp-pvital-lbl">Total Reps</div>
            <div className="dp-pvital-sub">synced from patient</div>
          </div>
          <div className="dp-pvital">
            <div className="dp-pvital-val">{compliance !== null ? `${compliance}%` : '—'}</div>
            <div className="dp-pvital-lbl">Compliance</div>
            <div className="dp-pvital-sub">ROM threshold ≥ 150°</div>
          </div>
          <div className="dp-pvital">
            <div className="dp-pvital-val">{sessionPeak > 0 ? `${sessionPeak}°` : '—'}</div>
            <div className="dp-pvital-lbl">Peak ROM</div>
            <div className="dp-pvital-sub">vs. 150° functional target</div>
          </div>
        </div>
      </div>

      {/* Main Body View Switcher */}
      {activeTab === 'analysis' && (
        <div className="dp-workspace">
          {/* Camera / Kinematic Column */}
          <div className="dp-camera-col">
            <div className="dp-section-header">
              <div className="dp-section-title">
                <Icon.Camera size={13} /> Live Kinematic Capture — Left Upper Extremity
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Mode Selector */}
                <div className="dp-mode-selector">
                  <button
                    className={`dp-mode-btn ${feedMode === 'camera' ? 'active' : ''}`}
                    onClick={() => handleModeChange('camera')}
                  >
                    <Icon.Camera size={11} /> Live Camera
                  </button>
                  <button
                    className={`dp-mode-btn ${feedMode === 'simulation' ? 'active' : ''}`}
                    onClick={() => handleModeChange('simulation')}
                  >
                    <Icon.Video size={11} /> Simulated Patient
                  </button>
                </div>

                <div className={`dp-model-status ${modelReady ? 'ready' : 'loading'}`}>
                  <div className="dp-dot" />
                  {modelReady ? 'PyTorch MLP (ONNX Web)' : 'Loading ONNX...'}
                </div>
              </div>
            </div>

            <div className="dp-video-wrap">
              <video ref={videoRef} style={{ display: 'none' }} playsInline />
              <canvas ref={canvasRef} className="dp-canvas" width="640" height="480" />
              {!isSessionActive && (
                <div className="dp-camera-overlay">
                  <div className="dp-camera-idle-icon">
                    {feedMode === 'simulation' ? <Icon.Video size={22} /> : <Icon.Camera size={22} />}
                  </div>
                  <div className="dp-camera-idle-label">
                    {feedMode === 'simulation'
                      ? 'Simulated Mode: Runs on-device synthetic stroke kinematic stream with real ONNX inference for competition demonstration.'
                      : 'Position patient 1.5–2 m from camera. Ensure left arm and torso are fully visible.'}
                  </div>
                  <button className="dp-btn-start" onClick={startSession} disabled={!modelReady}>
                    <Icon.Play size={13} />
                    {modelReady ? (feedMode === 'simulation' ? 'Start Simulated Demo' : 'Begin Kinematic Capture') : 'Loading Model...'}
                  </button>
                </div>
              )}
            </div>

            {isSessionActive && (
              <div style={{ padding: '6px 20px', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--dp-border)' }}>
                <span style={{ fontSize: 11, color: 'var(--dp-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {feedMode === 'simulation' ? 'FEED: SYNTHETIC BIOMECHANICAL MODEL (60FPS)' : 'FEED: MEDIAPIPE POSE V2 (WEBCAM)'}
                </span>
                <button className="dp-btn-stop" onClick={stopSession}>
                  Stop Capture
                </button>
              </div>
            )}

            {/* Metrics Strip */}
            <div className="dp-metrics-strip">
              {[
                { lbl: 'Live Angle', val: liveAngle !== null ? `${liveAngle}°` : '—', cls: angleClass, sub: 'Shoulder flexion (L)' },
                { lbl: 'Peak ROM', val: peakAngle !== null ? `${peakAngle}°` : '—', cls: peakAngle >= 150 ? 'good' : peakAngle ? 'warn' : '', sub: 'Last rep · norm 180°' },
                { lbl: 'Compliant Reps', val: compliantReps, cls: 'good', sub: 'Reps ≥ 150° ROM' },
                { lbl: 'Compliance Rate', val: compliance !== null ? `${compliance}%` : '—', cls: compliance === null ? '' : compliance >= 70 ? 'good' : 'warn', sub: 'Session target ≥ 80%' },
              ].map(m => (
                <div className="dp-metric-cell" key={m.lbl}>
                  <div className="dp-metric-lbl"><Icon.Activity size={12} />{m.lbl}</div>
                  <div className={`dp-metric-val ${m.cls}`}>{m.val}</div>
                  <div className="dp-metric-sub">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* ROM Progression Bars */}
            <div className="dp-rom-section">
              <div className="dp-rom-title">
                <span>Range of Motion — Session Progression</span>
                <span style={{ color: 'var(--dp-muted)', fontWeight: 400 }}>Soucie et al., J Rehab Med</span>
              </div>
              {[
                { name: 'Shoulder Flexion (L)', val: sessionPeak || 0, color: sessionPeak >= 150 ? 'var(--dp-green)' : 'var(--dp-teal)' },
                { name: 'Pre-treatment baseline', val: 0, color: 'var(--dp-muted)' },
                { name: 'Unaffected side (R)', val: 158, color: '#6D28D9' },
              ].map(r => (
                <div className="dp-rom-bar-row" key={r.name}>
                  <div className="dp-rom-bar-name">{r.name}</div>
                  <div className="dp-rom-bar-track">
                    <div className="dp-rom-bar-fill" style={{ width: `${(r.val / 180) * 100}%`, background: r.color }} />
                  </div>
                  <div className="dp-rom-bar-val">{r.val > 0 ? `${r.val}°` : '0°'}</div>
                  <div className="dp-rom-bar-norm">/ 180°</div>
                </div>
              ))}
            </div>

            {/* Feedback */}
            <div className="dp-feedback-area">
              <div className={`dp-feedback-icon-wrap ${feedback.type}`}>
                {feedback.type === 'good' ? <Icon.Check size={11} /> : feedback.type === 'warn' ? <Icon.Alert size={11} /> : <Icon.Info size={11} />}
              </div>
              <div>
                <div className="dp-feedback-title">{feedback.title}</div>
                <div className="dp-feedback-body">{feedback.body}</div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="dp-right-col">
            {/* Assessment Scores */}
            <div className="dp-ccard">
              <div className="dp-ccard-header">
                <div className="dp-ccard-title"><Icon.Clipboard size={13} />Clinical Assessment Scores</div>
                <div className="dp-ccard-action" onClick={() => setActiveTab('outcomes')}>View longitudinal</div>
              </div>
              {ASSESSMENT_SCORES.map(s => {
                const pct = s.invert ? (1 - s.value / s.norm) * 100 : (s.value / s.norm) * 100;
                const delta = s.value - s.prev;
                const improved = s.invert ? delta < 0 : delta > 0;
                return (
                  <div className="dp-score-row" key={s.name}>
                    <div className="dp-score-name">
                      {s.name}
                      <div className="dp-score-scale">{s.scale}</div>
                    </div>
                    <div className="dp-score-bar-mini">
                      <div className="dp-score-bar-mini-fill" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                    <div className="dp-score-value">
                      {s.value}
                      <span style={{ fontSize: 9, color: 'var(--dp-subtle)' }}>{s.scale}</span>
                    </div>
                    <div className={`dp-score-trend ${improved ? 'up' : delta === 0 ? 'eq' : 'dn'}`}>
                      {improved ? <Icon.TrendUp size={11} /> : delta === 0 ? '—' : <Icon.TrendDown size={11} />}
                      {delta !== 0 ? ` ${improved ? '+' : ''}${delta}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rep Log */}
            <div className="dp-ccard">
              <div className="dp-ccard-header">
                <div className="dp-ccard-title"><Icon.Chart size={13} />Session Log — Rep-by-Rep</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span
                    className="dp-ccard-action"
                    onClick={() => {
                      const reset = clearTodaySession();
                      setRehabState(reset);
                      setModelB(runModelBAnalysis(reset.history14Days));
                      runModelBONNXInference(reset.history14Days).then(res => {
                        if (res) setModelB(res);
                      });
                    }}
                    style={{ color: '#EF4444' }}
                    title="Reset today's recorded repetitions back to 0"
                  >
                    Reset
                  </span>
                  <span
                    className="dp-ccard-action"
                    onClick={() => exportSessionCSV(rehabState.patient, repLog, rehabState.history14Days)}
                    title="Export session data directly to CSV"
                  >
                    <Icon.Download size={11} /> CSV
                  </span>
                  <span className="dp-ccard-action" onClick={() => setShowReportModal(true)}>
                    Report
                  </span>
                </div>
              </div>
              <div className="dp-rep-log-row dp-rep-log-header">
                <span>#</span><span>Classification</span><span>Peak</span><span>Conf.</span><span>Time</span>
              </div>
              {repLog.length === 0 ? (
                <div className="dp-rep-log-empty">No repetitions recorded. Begin session or perform reps in patient portal.</div>
              ) : (
                repLog.map(r => (
                  <div className="dp-rep-log-row" key={r.repN}>
                    <span className="dp-rep-num">{r.repN}</span>
                    <span>
                      <span className={`dp-rep-badge ${r.compensation ? 'comp' : r.pass ? 'pass' : 'fail'}`}>
                        {r.compensation ? '⚠️ Trunk Lean' : r.pass ? <><Icon.Check size={10} /> Compliant</> : <><Icon.Alert size={10} /> Sub-thresh</>}
                      </span>
                    </span>
                    <span className="dp-rep-peak">{r.peak}°</span>
                    <span className="dp-rep-conf">{r.conf}%</span>
                    <span style={{ fontSize: 10, color: 'var(--dp-subtle)' }}>{r.ts}</span>
                  </div>
                ))
              )}
            </div>

            {/* Protocol */}
            <div className="dp-ccard">
              <div className="dp-ccard-header">
                <div className="dp-ccard-title"><Icon.Protocol size={13} />Active Orders — PT #2847</div>
              </div>
              {PROTOCOL.map((p, i) => (
                <div className="dp-protocol-item" key={i}>
                  <div className={`dp-protocol-number ${p.status}`}>{p.status === 'done' ? <Icon.Check size={10} /> : i + 1}</div>
                  <div>
                    <div className="dp-protocol-name">{p.name}</div>
                    <div className="dp-protocol-detail">{p.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: PATIENT RECORDS ROSTER */}
      {activeTab === 'records' && (
        <div className="dp-subview-container">
          <div className="dp-view-header">
            <div>
              <h2>Rehabilitation Patient Roster</h2>
              <p>Active telerehabilitation monitoring cohort — Neuro Rehab Service</p>
            </div>
            <button className="dp-btn-pill active" onClick={() => setShowReportModal(true)}>
              <Icon.FileText size={13} /> Generate Cohort Summary
            </button>
          </div>

          <div className="dp-table-card">
            <table className="dp-roster-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Diagnosis / Distribution</th>
                  <th>Chronicity</th>
                  <th>14-Day Adherence</th>
                  <th>ROM Trend</th>
                  <th>Session Peak</th>
                  <th>Model B Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {PATIENT_ROSTER.map(p => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: 10, color: 'var(--dp-muted)' }}>{p.age}{p.gender} · {p.id === 'john-d' ? 'Active Selected' : 'Enrolled'}</div>
                    </td>
                    <td>{p.dx}</td>
                    <td>{p.chronicity}</td>
                    <td><strong>{p.adherence}</strong></td>
                    <td style={{ color: p.romChange.startsWith('-') ? '#DC2626' : '#059669', fontWeight: 600 }}>
                      {p.romChange}
                    </td>
                    <td><strong>{p.peakRom}</strong></td>
                    <td>
                      <span className={`dp-status-tag ${p.status}`}>
                        {p.status === 'crit' && <Icon.Alert size={10} />}
                        {p.statusText}
                      </span>
                    </td>
                    <td>
                      <button
                        className="dp-btn-pill"
                        style={{ background: '#0B7EA3', color: '#fff', border: 'none' }}
                        onClick={() => {
                          if (p.id === 'john-d') setActiveTab('analysis');
                          else alert(`Opening records for ${p.name}`);
                        }}
                      >
                        Open Telemetry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: OUTCOME MEASURES & MODEL B DASHBOARD */}
      {activeTab === 'outcomes' && (
        <div className="dp-subview-container">
          <div className="dp-view-header">
            <div>
              <h2>Longitudinal Outcome Measures & Model B Analysis</h2>
              <p>Multi-variate predictive time-series modeling for therapy dropout & motor plateau</p>
            </div>
            <button className="dp-btn-pill active" onClick={() => setShowReportModal(true)}>
              <Icon.Printer size={13} /> Export EMR Report
            </button>
          </div>

          {/* Model B Deep Dive Card */}
          <div style={{ background: '#FFF', border: '1px solid var(--dp-border)', borderRadius: 10, padding: 20, marginBottom: 20, borderLeft: '5px solid #EF4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--dp-navy)' }}>
                <Icon.Alert size={18} /> Model B Dropout & Non-Adherence Predictor
              </div>
              <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                High Dropout Risk (Score: {modelB.riskScore}/100)
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, margin: '6px 0 12px' }}>
              <strong>Clinical Assessment:</strong> {modelB.alert?.details} {modelB.alert?.clinicalInsight}
            </p>
            <div style={{ background: '#FEF2F2', padding: 12, borderRadius: 6, fontSize: 12, color: '#7F1D1D', marginBottom: 14 }}>
              <strong>Prescribed Clinical Action:</strong> {modelB.alert?.recommendation}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: '#F8FAFC', padding: 14, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Kinematic Slope</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#DC2626' }}>{modelB.slope}°/day</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>Downward trajectory</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Week 1 vs 2 ROM</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#DC2626' }}>{modelB.w1Rom}° → {modelB.w2Rom}° ({modelB.romDelta}%)</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>Statistical decline</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Adherence Delta</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#DC2626' }}>{modelB.adhDelta}%</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>W1: {modelB.w1Adh}% / W2: {modelB.w2Adh}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>14-Day ONNX Forecast</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: modelB.predictedRomDelta < 0 ? '#DC2626' : '#059669' }}>
                  {modelB.predictedRomDelta > 0 ? '+' : ''}{modelB.predictedRomDelta}° ROM
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>modelB_trajectory.onnx</div>
              </div>
            </div>
          </div>

          {/* 14-Day Trajectory Graph */}
          <div style={{ background: '#FFF', border: '1px solid var(--dp-border)', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dp-navy)' }}>
                14-Day Active ROM Trajectory with 150° Target Threshold
              </div>
              <div style={{ fontSize: 11, color: '#0EA5C9', fontWeight: 600 }}>
                ● 150° Functional Target Line · ■ Patient Peak ROM
              </div>
            </div>

            <svg width="100%" height="160" viewBox="0 0 700 160">
              {[40, 80, 120].map(y => (
                <line key={y} x1="40" y1={y} x2="680" y2={y} stroke="#F1F5F9" strokeWidth="1" />
              ))}
              <line x1="40" y1="35" x2="680" y2="35" stroke="#0EA5C9" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x="45" y="30" fill="#0EA5C9" fontSize="10" fontWeight="600">150° Target Threshold</text>

              <polyline
                fill="none"
                stroke="#DC2626"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={rehabState.history14Days.map((d, i) => {
                  const x = 50 + (i / (rehabState.history14Days.length - 1)) * 620;
                  const y = 140 - (d.rom / 180) * 110;
                  return `${x},${y}`;
                }).join(' ')}
              />

              {rehabState.history14Days.map((d, i) => {
                const x = 50 + (i / (rehabState.history14Days.length - 1)) * 620;
                const y = 140 - (d.rom / 180) * 110;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="5" fill="#FFF" stroke="#DC2626" strokeWidth="2.5" />
                    <text x={x} y="155" textAnchor="middle" fill="#64748B" fontSize="9">{d.date}</text>
                    <text x={x} y={y - 8} textAnchor="middle" fill="#0A2540" fontSize="9" fontWeight="700">{d.rom}°</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* VIEW 4: SESSION HISTORY */}
      {activeTab === 'history' && (
        <div className="dp-subview-container">
          <div className="dp-view-header">
            <div>
              <h2>Complete Session History — John D.</h2>
              <p>Daily breakdown of completed repetitions, functional compliance, and peak elevation</p>
            </div>
            <button
              className="dp-btn-pill active"
              onClick={() => exportSessionCSV(rehabState.patient, repLog, rehabState.history14Days)}
              title="Download 14-day history and session telemetry CSV"
            >
              <Icon.Download size={13} /> Export Longitudinal CSV
            </button>
          </div>

          <div className="dp-table-card">
            <table className="dp-roster-table">
              <thead>
                <tr>
                  <th>Session Day</th>
                  <th>Date</th>
                  <th>Prescribed Protocol</th>
                  <th>Target Reps</th>
                  <th>Completed Reps</th>
                  <th>Compliant (≥150°)</th>
                  <th>Peak ROM</th>
                  <th>Adherence</th>
                </tr>
              </thead>
              <tbody>
                {rehabState.history14Days.map(h => (
                  <tr key={h.day}>
                    <td><strong>Day {h.day}</strong></td>
                    <td>{h.date}</td>
                    <td>Shoulder Flexion — Active ROM</td>
                    <td>{h.targetReps}</td>
                    <td><strong>{h.completedReps}</strong></td>
                    <td><span style={{ color: '#059669', fontWeight: 600 }}>{h.compliantReps}</span></td>
                    <td><strong>{h.rom}°</strong></td>
                    <td>
                      <span className={`dp-status-tag ${h.adherence >= 80 ? 'good' : h.adherence >= 60 ? 'warn' : 'crit'}`}>
                        {h.adherence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: REPORTS REPOSITORY */}
      {activeTab === 'reports' && (
        <div className="dp-subview-container">
          <div className="dp-view-header">
            <div>
              <h2>Clinical Reports & EMR Exports</h2>
              <p>Generated summaries formatted for electronic medical record integration and insurance reviews</p>
            </div>
            <button className="dp-btn-pill active" onClick={() => setShowReportModal(true)}>
              <Icon.FileText size={13} /> Open Active 14-Day Report
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div style={{ background: '#FFF', border: '1px solid var(--dp-border)', borderRadius: 10, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--dp-navy)' }}>
                <Icon.FileText size={16} /> 14-Day Stroke Rehabilitation Motor Summary
              </div>
              <div style={{ fontSize: 11, color: 'var(--dp-muted)', margin: '4px 0 12px' }}>
                Window: Oct 05 – Today · John D. (MRN-20261004)
              </div>
              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                Comprehensive summary compiling 108 repetitions, Model B trajectory assessment (-11.2% ROM change), and validated outcome metrics (Fugl-Meyer +6, MAS Grade 1).
              </p>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button className="dp-btn-pill" style={{ background: '#0B7EA3', color: '#fff', border: 'none' }} onClick={() => setShowReportModal(true)}>
                  <Icon.Printer size={12} /> View & Print PDF
                </button>
              </div>
            </div>

            <div style={{ background: '#FFF', border: '1px solid var(--dp-border)', borderRadius: 10, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--dp-navy)' }}>
                <Icon.FileText size={16} /> Initial Baseline Kinematic Evaluation
              </div>
              <div style={{ fontSize: 11, color: 'var(--dp-muted)', margin: '4px 0 12px' }}>
                Recorded Oct 01 · Post-Stroke Day 38
              </div>
              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                Initial baseline assessment upon hospital discharge to home physical therapy. Established primary MCA deficit and baseline Fugl-Meyer score of 28/66.
              </p>
              <div style={{ marginTop: 16 }}>
                <button className="dp-btn-pill" style={{ background: '#F1F5F9', color: '#1E293B', border: '1px solid var(--dp-border)' }} onClick={() => alert('Viewing archived baseline record.')}>
                  View Archived Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="dp-statusbar">
        <span className="dp-statusbar-live"><span className="dp-live-dot" />TELEMETRY ACTIVE</span>
        <span>{now}</span>
        <span>Feed: {feedMode === 'simulation' ? 'Synthetic Kinematic Simulation' : 'Physical Webcam'}</span>
        <span>AI: ONNX Web Runtime + Model B Time-Series</span>
        <span className="dp-grow" />
        <span>RecoverAI v1.0 · Congressional App Challenge 2026–27</span>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        patient={rehabState.patient}
        history14Days={rehabState.history14Days}
        modelBResult={modelB}
      />
    </div>
  );
}
