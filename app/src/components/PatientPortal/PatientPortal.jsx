import { useState, useEffect, useRef, useCallback } from 'react';
import * as ort from 'onnxruntime-web';
import {
  Icon, PROTOCOL, FRAMES, FEATURES, calcAngle, calcTrunkTilt, resampleToFrames,
} from '../../shared/shared.jsx';
import { getRehabState, recordRepetition, addMessage, clearTodaySession } from '../../shared/storage.js';
import { runModelBAnalysis, runModelBONNXInference } from '../../shared/modelB.js';
import { voiceCoach } from '../../shared/voice.js';
import { SimulatedPatientEngine } from '../../shared/simulation.js';
import { exportSessionCSV } from '../../shared/exportCSV.js';
import ReportModal from '../ReportModal/ReportModal.jsx';
import './PatientPortal.css';

export default function PatientPortal({ user, onLogout }) {
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

  // App Navigation View: 'exercise' | 'progress' | 'schedule' | 'messages'
  const [activeTab, setActiveTab] = useState('exercise');

  // Shared state from storage
  const [rehabState, setRehabState] = useState(getRehabState);
  const [modelB, setModelB] = useState(() => runModelBAnalysis(rehabState.history14Days));

  // Running mode: 'camera' | 'simulation'
  const [feedMode, setFeedMode] = useState('camera');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [modelReady, setModelReady] = useState(false);

  // Live session telemetry
  const [liveAngle, setLiveAngle] = useState(null);
  const [peakAngle, setPeakAngle] = useState(null);
  const [feedback, setFeedback] = useState({
    title: 'Ready to start your exercise!',
    body: 'Stand 1.5–2 meters back in good lighting. Click "Start Exercise" or switch to "Simulated Demo" to test hands-free.',
    type: 'idle',
  });

  // Chat message input in Messages tab
  const [chatText, setChatText] = useState('');
  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);

  // Sync state changes from storage
  useEffect(() => {
    const handleStateUpdate = (e) => {
      const updated = e.detail || getRehabState();
      setRehabState(updated);
      setModelB(runModelBAnalysis(updated.history14Days));
      runModelBONNXInference(updated.history14Days).then(res => {
        if (res) setModelB(res);
      });
    };

    window.addEventListener('recoverai_state_changed', handleStateUpdate);
    window.addEventListener('storage', handleStateUpdate);
    return () => {
      window.removeEventListener('recoverai_state_changed', handleStateUpdate);
      window.removeEventListener('storage', handleStateUpdate);
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
      .catch(e => console.error('[RecoverAI] ONNX error:', e));
  }, []);

  // Voice coach sync
  const toggleVoice = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    voiceCoach.setEnabled(nextVal);
  };

  // Evaluate 30-frame sequence with ONNX model
  const evaluate = useCallback(async (seq, compMeta = {}) => {
    if (!modelRef.current) return;
    try {
      const input = new ort.Tensor('float32', new Float32Array(seq), [1, FRAMES, FEATURES]);
      const result = await modelRef.current.run({ input });
      const logits = result.output.data;
      const expA = Math.exp(logits[0]), expB = Math.exp(logits[1]);
      const sumE = expA + expB;
      const confCorrect = expB / sumE;
      const pass = confCorrect > 0.5;
      const conf = Math.round((pass ? confCorrect : expA / sumE) * 100);
      const peak = Math.round(Math.max(...seq));

      setPeakAngle(peak);

      const isComp = !!compMeta.compensation;
      const tiltDeg = compMeta.tiltDeg || 0;

      // Record in shared storage so DoctorPortal immediately updates!
      const updatedState = recordRepetition({ pass, peak, conf, compensation: isComp, tiltDeg });
      setRehabState(updatedState);
      setModelB(runModelBAnalysis(updatedState.history14Days));
      runModelBONNXInference(updatedState.history14Days).then(res => {
        if (res) setModelB(res);
      });

      // Voice announcement
      voiceCoach.announceRep(updatedState.todaySession.totalReps, peak, pass);

      if (isComp) {
        setFeedback({
          title: 'Trunk lean detected! ⚠️',
          body: `You reached ${peak}°, but leaned your torso by ${tiltDeg}°. Keep your spine upright to isolate shoulder muscles.`,
          type: 'warn',
        });
      } else if (pass) {
        setFeedback({
          title: 'Great job! 💪',
          body: `You reached ${peak}° with upright posture — excellent functional range of motion!`,
          type: 'good',
        });
      } else {
        setFeedback({
          title: 'Almost there! 🎯',
          body: `You reached ${peak}° — try to raise your arm a bit higher next time. Aim for 150° or more!`,
          type: 'warn',
        });
      }
    } catch (e) {
      console.error('[RecoverAI] Evaluation error:', e);
    }
  }, []);

  // Start exercise session
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
        title: 'Simulated Patient Active 🤖',
        body: 'Generating synthetic stroke kinematics with automated posture compensation detection. Real-time ONNX scoring active.',
        type: 'idle',
      });
      return;
    }

    // Camera mode
    const PoseClass = window.Pose;
    const CameraClass = window.Camera;
    if (!PoseClass || !CameraClass) {
      alert('Camera system loading. Please wait 3 seconds and try again.');
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
        ctx.lineWidth = 4;
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
          ctx.lineWidth = 3;
          ctx.arc(p.x * W, p.y * H, 6, 0, 2 * Math.PI);
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

        // Posture / Trunk Tilt HUD card
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

        // Prominent visual alert if compensating (positioned to the right of HUD card)
        if (tiltData.isCompensating) {
          ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
          ctx.beginPath();
          ctx.roundRect(186, 18, Math.max(200, W - 204), 34, 6);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`⚠️ TRUNK COMPENSATION (${tiltData.tiltDeg}°) — KEEP SPINE UPRIGHT`, 186 + (W - 204) / 2, 39);
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
    setFeedback({
      title: 'Exercise started! 🚀',
      body: 'Raise your arm as high as you can, then lower it. The AI will track your movement and give you feedback.',
      type: 'idle',
    });
  }, [evaluate, feedMode]);

  // Stop session
  const stopSession = () => {
    if (simEngineRef.current) {
      simEngineRef.current.stop();
      simEngineRef.current = null;
    }
    if (cameraInstanceRef.current) {
      try { cameraInstanceRef.current.stop(); } catch (e) { console.error(e); }
      cameraInstanceRef.current = null;
    }
    setIsSessionActive(false);
    setLiveAngle(null);
  };

  // Switch feed mode
  const handleModeChange = (mode) => {
    if (isSessionActive) stopSession();
    setFeedMode(mode);
  };

  // Handle chat sending
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    const updated = addMessage(user.name, 'patient', chatText);
    setRehabState(updated);
    setChatText('');
  };

  const todaySession = rehabState.todaySession || {};
  const totalReps = todaySession.totalReps || 0;
  const compliantReps = todaySession.compliantReps || 0;
  const sessionPeak = todaySession.sessionPeak || 0;
  const repLog = todaySession.repLog || [];
  const compliance = totalReps > 0 ? Math.round((compliantReps / totalReps) * 100) : null;
  const angleClass = liveAngle === null ? '' : liveAngle >= 150 ? 'good' : liveAngle >= 100 ? 'warn' : 'crit';
  const now = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="pp-shell">
      {/* Top Navbar */}
      <nav className="pp-topbar">
        <div className="pp-topbar-logo" onClick={() => setActiveTab('exercise')}>
          <Icon.Logo size={22} />
          <div>
            <div className="pp-topbar-name">Recover<span>AI</span></div>
            <div className="pp-topbar-tag">Your Rehabilitation Journey</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="pp-topbar-nav">
          <div
            className={`pp-topbar-nav-item ${activeTab === 'exercise' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercise')}
          >
            Exercise
          </div>
          <div
            className={`pp-topbar-nav-item ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            My Progress
          </div>
          <div
            className={`pp-topbar-nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule
          </div>
          <div
            className={`pp-topbar-nav-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            Messages {rehabState.messages?.length > 0 && `(${rehabState.messages.length})`}
          </div>
        </div>

        {/* Topbar Right Controls */}
        <div className="pp-topbar-right">
          <button
            className={`pp-btn-pill ${voiceEnabled ? 'active' : ''}`}
            onClick={toggleVoice}
            title={voiceEnabled ? 'Voice Guidance Active' : 'Voice Guidance Muted'}
          >
            {voiceEnabled ? <Icon.Volume2 size={13} /> : <Icon.VolumeX size={13} />}
            {voiceEnabled ? 'Voice On' : 'Voice Off'}
          </button>

          <button
            className="pp-btn-pill"
            onClick={() => exportSessionCSV(rehabState.patient, repLog, rehabState.history14Days)}
            title="Download raw repetition and longitudinal data in CSV format"
          >
            <Icon.Download size={13} /> Export CSV
          </button>

          <button
            className="pp-btn-pill pulse"
            onClick={() => setShowReportModal(true)}
            title="Export 14-day rehabilitation summary"
          >
            <Icon.FileText size={13} /> Share Report
          </button>

          <span className="pp-user-name">Hi, {user.name.split(' ')[0]}!</span>
          <div className="pp-topbar-user" title={user.name}>{user.initials}</div>
          <button className="pp-logout" onClick={onLogout} title="Sign out">
            <Icon.Logout size={14} />
          </button>
        </div>
      </nav>

      {/* Main Content Area based on Active Tab */}
      <div className="pp-main">
        {/* VIEW 1: EXERCISE VIEW */}
        {activeTab === 'exercise' && (
          <div className="pp-workspace">
            {/* Camera / Simulation Column */}
            <div className="pp-camera-col">
              <div className="pp-section-header">
                <div className="pp-section-title">
                  <Icon.Camera size={14} /> Today's Exercise: Shoulder Flexion
                </div>

                <div className="pp-header-controls">
                  {/* Mode Selector */}
                  <div className="pp-mode-selector">
                    <button
                      className={`pp-mode-btn ${feedMode === 'camera' ? 'active' : ''}`}
                      onClick={() => handleModeChange('camera')}
                      title="Use physical webcam"
                    >
                      <Icon.Camera size={12} /> Live Webcam
                    </button>
                    <button
                      className={`pp-mode-btn ${feedMode === 'simulation' ? 'active' : ''}`}
                      onClick={() => handleModeChange('simulation')}
                      title="Run automated synthetic stroke patient demo"
                    >
                      <Icon.Video size={12} /> Simulated Demo
                    </button>
                  </div>

                  <div className={`pp-model-status ${modelReady ? 'ready' : 'loading'}`}>
                    <div className="pp-dot" />
                    {modelReady ? 'Model A Ready (ONNX)' : 'Loading ONNX...'}
                  </div>
                </div>
              </div>

              {/* Video / Canvas Viewport */}
              <div className="pp-video-wrap">
                <video ref={videoRef} style={{ display: 'none' }} playsInline />
                <canvas ref={canvasRef} className="pp-canvas" width="640" height="480" />

                {!isSessionActive && (
                  <div className="pp-camera-overlay">
                    <div className="pp-camera-idle-icon">
                      {feedMode === 'simulation' ? <Icon.Video size={28} /> : <Icon.Camera size={28} />}
                    </div>
                    <div className="pp-camera-idle-label">
                      {feedMode === 'simulation'
                        ? 'Simulated Mode: Runs an automated kinematic stroke patient model through full & impaired arm raises so judges can test on-device ONNX inference hands-free.'
                        : 'Stand about 1.5–2 meters from the camera in a well-lit room. Make sure your full left arm and torso are visible.'}
                    </div>
                    <button className="pp-btn-start" onClick={startSession} disabled={!modelReady}>
                      <Icon.Play size={14} />
                      {modelReady ? (feedMode === 'simulation' ? 'Start Simulated Demo' : 'Start Camera Exercise') : 'Loading Model...'}
                    </button>
                  </div>
                )}
              </div>

              {isSessionActive && (
                <div style={{ padding: '8px 20px', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pp-border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--pp-muted)' }}>
                    {feedMode === 'simulation' ? 'Running Biomechanical Synthesis (30fps)' : 'Live MediaPipe Pose v2 Active'}
                  </span>
                  <button className="pp-btn-stop" onClick={stopSession}>
                    Stop Session
                  </button>
                </div>
              )}

              {/* Motivational metrics */}
              <div className="pp-metrics-strip">
                <div className="pp-metric-card">
                  <div className="pp-metric-icon"><Icon.Activity size={16} /></div>
                  <div className="pp-metric-label">Current Angle</div>
                  <div className={`pp-metric-value ${angleClass}`}>
                    {liveAngle !== null ? `${liveAngle}°` : '—'}
                  </div>
                </div>
                <div className="pp-metric-card">
                  <div className="pp-metric-icon"><Icon.Trophy size={16} /></div>
                  <div className="pp-metric-label">Best Today</div>
                  <div className="pp-metric-value good">{sessionPeak > 0 ? `${sessionPeak}°` : '—'}</div>
                </div>
                <div className="pp-metric-card">
                  <div className="pp-metric-icon"><Icon.Star size={16} /></div>
                  <div className="pp-metric-label">Great Reps</div>
                  <div className="pp-metric-value good">{compliantReps}</div>
                </div>
                <div className="pp-metric-card">
                  <div className="pp-metric-icon"><Icon.Heart size={16} /></div>
                  <div className="pp-metric-label">Score</div>
                  <div className={`pp-metric-value ${compliance === null ? '' : compliance >= 70 ? 'good' : 'warn'}`}>
                    {compliance !== null ? `${compliance}%` : '—'}
                  </div>
                </div>
              </div>

              {/* Encouraging feedback */}
              <div className="pp-feedback-card">
                <div className={`pp-feedback-icon ${feedback.type}`}>
                  {feedback.type === 'good' ? <Icon.Check size={16} /> : feedback.type === 'warn' ? <Icon.Alert size={16} /> : <Icon.Info size={16} />}
                </div>
                <div className="pp-feedback-content">
                  <div className="pp-feedback-title">{feedback.title}</div>
                  <div className="pp-feedback-body">{feedback.body}</div>
                </div>
              </div>
            </div>

            {/* Right Column - Today's Summary & Rep Log */}
            <div className="pp-right-col">
              <div className="pp-card">
                <div className="pp-card-header">
                  <div className="pp-card-title"><Icon.Chart size={14} />Today's Goal</div>
                </div>
                <div className="pp-progress-section">
                  <div className="pp-progress-label">Goal: 10 completed reps</div>
                  <div className="pp-progress-bar-wrap">
                    <div className="pp-progress-bar" style={{ width: `${Math.min((totalReps / 10) * 100, 100)}%` }} />
                  </div>
                  <div className="pp-progress-text">{totalReps} / 10 reps ({compliantReps} compliant)</div>
                </div>
                <div className="pp-progress-section">
                  <div className="pp-progress-label">Weekly streak: 5 days 🔥</div>
                  <div className="pp-streak-days">
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <div key={d} className={`pp-streak-day ${d <= 5 ? 'active' : ''}`}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'][d - 1]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pp-card">
                <div className="pp-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="pp-card-title"><Icon.Clipboard size={14} />Live Rep Log</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => {
                        const reset = clearTodaySession();
                        setRehabState(reset);
                        setModelB(runModelBAnalysis(reset.history14Days));
                        runModelBONNXInference(reset.history14Days).then(res => {
                          if (res) setModelB(res);
                        });
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                      title="Reset today's recorded repetitions back to 0"
                    >
                      Reset Log
                    </button>
                    <button
                      onClick={() => exportSessionCSV(rehabState.patient, repLog, rehabState.history14Days)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--pp-teal)', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Download raw repetition data in CSV format"
                    >
                      <Icon.Download size={11} /> Export CSV
                    </button>
                  </div>
                </div>
                {repLog.length === 0 ? (
                  <div className="pp-empty-state">Complete your first rep to see your history!</div>
                ) : (
                  repLog.map(r => (
                    <div className="pp-rep-item" key={r.repN}>
                      <div className={`pp-rep-badge ${r.compensation ? 'comp' : r.pass ? 'pass' : 'fail'}`}>
                        {r.compensation ? '⚠️' : r.pass ? <Icon.Check size={10} /> : <Icon.Alert size={10} />}
                      </div>
                      <div className="pp-rep-details">
                        <div className="pp-rep-angle">
                          {r.peak}°
                          {r.compensation && (
                            <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 700, marginLeft: 6 }}>
                              Trunk Lean ({r.tiltDeg || 14}°)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pp-muted)' }}>
                          {r.pass ? 'Compliant (≥150°)' : 'Limited ROM'} · {r.conf}% conf
                        </div>
                        <div className="pp-rep-time">{r.ts}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pp-card">
                <div className="pp-card-header">
                  <div className="pp-card-title"><Icon.Info size={14} />Your Therapist</div>
                </div>
                <div className="pp-therapist-info">
                  <div className="pp-therapist-avatar">SP</div>
                  <div className="pp-therapist-details">
                    <div className="pp-therapist-name">Dr. Sunita Patel</div>
                    <div className="pp-therapist-credentials">PT, DPT · Neuro Rehab</div>
                    <div className="pp-therapist-site">University Health</div>
                  </div>
                  <button className="pp-message-btn" onClick={() => setActiveTab('messages')}>
                    <Icon.MessageSquare size={12} /> Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MY PROGRESS VIEW (Longitudinal Trend & Model B) */}
        {activeTab === 'progress' && (
          <div className="pp-subview-container">
            <div className="pp-view-header">
              <div>
                <h2>Rehabilitation Progress & Kinematics</h2>
                <p>14-day longitudinal motor recovery trajectory and clinical AI analytics</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="pp-btn-pill"
                  onClick={() => exportSessionCSV(rehabState.patient, repLog, rehabState.history14Days)}
                  title="Export raw time-series kinematics CSV"
                >
                  <Icon.Download size={13} /> Export CSV Data
                </button>
                <button className="pp-btn-pill active" onClick={() => setShowReportModal(true)}>
                  <Icon.FileText size={14} /> Export Doctor Summary
                </button>
              </div>
            </div>

            {/* Model B Alert Card */}
            <div className={`pp-model-card ${modelB.trajectory === 'Declining' ? 'declining' : 'improving'}`}>
              <div className="pp-model-header">
                <div className="pp-model-title">
                  <Icon.Alert size={16} /> Model B Trajectory Predictor: <strong>{modelB.trajectory} Recovery Trajectory</strong>
                </div>
                <span className={`pp-risk-pill ${modelB.dropoutRisk === 'High' ? 'high' : 'low'}`}>
                  Dropout Risk: {modelB.dropoutRisk} ({modelB.riskScore}%)
                </span>
              </div>
              <div className="pp-model-desc">
                {modelB.alert?.details} {modelB.alert?.recommendation}
              </div>
              <div className="pp-model-metrics">
                <div className="pp-model-metric-item">
                  <span className="pp-model-metric-lbl">ROM 14-Day Change</span>
                  <span className="pp-model-metric-val" style={{ color: modelB.romDelta < 0 ? '#DC2626' : '#059669' }}>
                    {modelB.romDelta > 0 ? '+' : ''}{modelB.romDelta}%
                  </span>
                </div>
                <div className="pp-model-metric-item">
                  <span className="pp-model-metric-lbl">Adherence Trajectory</span>
                  <span className="pp-model-metric-val" style={{ color: modelB.adhDelta < 0 ? '#DC2626' : '#059669' }}>
                    {modelB.w1Adh}% → {modelB.w2Adh}% ({modelB.adhDelta}%)
                  </span>
                </div>
                <div className="pp-model-metric-item">
                  <span className="pp-model-metric-lbl">Model Confidence</span>
                  <span className="pp-model-metric-val">AUC: 0.810 ({modelB.confidence}%)</span>
                </div>
              </div>
            </div>

            {/* 14-Day Kinematic Trend Chart */}
            <div className="pp-graph-card">
              <div className="pp-card-header" style={{ padding: '0 0 16px', borderBottom: '1px solid #E2E8F0' }}>
                <div className="pp-card-title">
                  <Icon.Chart size={15} /> 14-Day Shoulder Flexion Peak ROM Trajectory (Degrees)
                </div>
                <div style={{ fontSize: 11, color: '#0B7EA3', fontWeight: 600 }}>
                  Target Line: 150° Overhead Functional Reach
                </div>
              </div>
              <div style={{ padding: '16px 0' }}>
                <svg width="100%" height="160" viewBox="0 0 700 160">
                  {/* Grid Lines */}
                  {[40, 80, 120].map(y => (
                    <line key={y} x1="40" y1={y} x2="680" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                  ))}
                  {/* Target 150 deg line */}
                  <line x1="40" y1="35" x2="680" y2="35" stroke="#0EA5C9" strokeWidth="1.5" strokeDasharray="4 4" />
                  <text x="45" y="30" fill="#0EA5C9" fontSize="10" fontWeight="600">150° Target Threshold</text>

                  {/* Connecting line */}
                  <polyline
                    fill="none"
                    stroke="#0B7EA3"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={rehabState.history14Days.map((d, i) => {
                      const x = 50 + (i / (rehabState.history14Days.length - 1)) * 620;
                      const y = 140 - (d.rom / 180) * 110;
                      return `${x},${y}`;
                    }).join(' ')}
                  />

                  {/* Dots */}
                  {rehabState.history14Days.map((d, i) => {
                    const x = 50 + (i / (rehabState.history14Days.length - 1)) * 620;
                    const y = 140 - (d.rom / 180) * 110;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="5" fill="#FFF" stroke="#0B7EA3" strokeWidth="2.5" />
                        <text x={x} y="155" textAnchor="middle" fill="#64748B" fontSize="9">{d.date}</text>
                        <text x={x} y={y - 8} textAnchor="middle" fill="#0A2540" fontSize="9" fontWeight="700">{d.rom}°</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: SCHEDULE VIEW */}
        {activeTab === 'schedule' && (
          <div className="pp-subview-container">
            <div className="pp-view-header">
              <div>
                <h2>Prescribed Therapy Schedule</h2>
                <p>Custom protocol ordered by Dr. Sunita Patel (PT Order #2847)</p>
              </div>
            </div>

            <div className="pp-schedule-grid">
              <div className="pp-schedule-card">
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--pp-navy)', marginBottom: 14 }}>
                  Assigned Daily Protocols
                </h3>
                {PROTOCOL.map((p, i) => (
                  <div className="pp-exercise-item" key={i} style={{ padding: '14px 0' }}>
                    <div className={`pp-exercise-status ${p.status}`}>
                      {p.status === 'done' ? <Icon.Check size={12} /> : i + 1}
                    </div>
                    <div className="pp-exercise-info">
                      <div className="pp-exercise-name" style={{ fontSize: 14 }}>{p.name}</div>
                      <div className="pp-exercise-detail" style={{ fontSize: 12 }}>{p.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pp-schedule-card">
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--pp-navy)', marginBottom: 14 }}>
                  Upcoming Check-in
                </h3>
                <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0B7EA3', textTransform: 'uppercase' }}>
                    Telehealth Video Evaluation
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pp-navy)', margin: '4px 0' }}>
                    Thursday, Oct 22 · 10:30 AM
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--pp-muted)' }}>
                    With Dr. Sunita Patel, PT, DPT
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--pp-muted)', lineHeight: 1.5 }}>
                  <strong>Reminder:</strong> Please ensure at least 3 daily exercise logs are submitted prior to this appointment so kinematics can be reviewed.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: MESSAGES VIEW */}
        {activeTab === 'messages' && (
          <div className="pp-subview-container">
            <div className="pp-view-header">
              <div>
                <h2>Clinical Communications</h2>
                <p>Direct secure messaging with your physical therapist</p>
              </div>
            </div>

            <div className="pp-messages-shell">
              <div className="pp-messages-header">
                <div className="pp-therapist-avatar">SP</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pp-navy)' }}>Dr. Sunita Patel, PT, DPT</div>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>● Active on Neuro Rehab Telehealth</div>
                </div>
              </div>

              <div className="pp-messages-body">
                {rehabState.messages.map((m) => (
                  <div key={m.id} className={`pp-msg-bubble ${m.role}`}>
                    <div>{m.text}</div>
                    <div className="pp-msg-meta">
                      <span>{m.sender}</span>
                      <span>{m.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <form className="pp-messages-footer" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="pp-chat-input"
                  placeholder="Ask Dr. Patel a question about your shoulder exercises..."
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                />
                <button type="submit" className="pp-btn-send">
                  <Icon.Send size={13} /> Send
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="pp-statusbar">
        <span>{now}</span>
        <span>Mode: {feedMode === 'simulation' ? 'Synthetic Kinematic Simulation' : 'Live Camera'}</span>
        <span>Audio: {voiceEnabled ? 'Voice Guidance Active' : 'Muted'}</span>
        <span className="pp-grow" />
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
