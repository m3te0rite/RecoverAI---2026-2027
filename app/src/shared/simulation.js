/* ─── Simulated Patient Biomechanical Kinematic Engine ─────────────────────── */
// Allows judges, reviewers, and clinicians to test the full computer vision, posture
// compensation detection, and ONNX neural network pipeline hands-free without webcam hardware.

import { resampleToFrames } from './shared.jsx';

export class SimulatedPatientEngine {
  constructor(canvas, onAngleUpdate, onEvaluate) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d');
    this.onAngleUpdate = onAngleUpdate;
    this.onEvaluate = onEvaluate;
    this.running = false;
    this.animId = null;
    this.buffer = [];
    this.repCount = 0;
    this.phase = 0; // 0 to 1 progress of current rep
    this.targetPeak = 158;
    this.simulatedTilt = 0;
    this.isCompensatingThisRep = false;
    this.lastTimestamp = 0;
    this.frameCount = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.buffer = [];
    this.repCount = 0;
    this.phase = 0;
    this.targetPeak = 158;
    this.simulatedTilt = 0;
    this.isCompensatingThisRep = false;
    this.lastTimestamp = performance.now();
    this.loop = this.loop.bind(this);
    this.animId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.buffer = [];
  }

  loop(timestamp) {
    if (!this.running || !this.canvas || !this.ctx) return;

    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Advance rep cycle smoothly: 1 rep takes ~3.2 seconds
    this.phase += (dt / 3.2);

    if (this.phase >= 1.0) {
      this.phase = 0;
      this.repCount++;

      // Evaluate the completed repetition
      if (this.buffer.length >= 10 && this.onEvaluate) {
        const sampled = resampleToFrames(this.buffer, 30);
        this.onEvaluate(sampled, {
          peak: Math.round(this.targetPeak),
          compensation: this.isCompensatingThisRep,
          tiltDeg: this.isCompensatingThisRep ? 16 : 2,
        });
      }
      this.buffer = [];

      // Rep cycle pattern:
      // Rep 1: Compliant (156-162°), Upright (no compensation)
      // Rep 2: Incomplete (110-116°), Upright
      // Rep 3: Compensatory reach! (reaches 152°, but with 16° trunk lean compensation)
      const mode = this.repCount % 3;
      if (mode === 0) {
        this.targetPeak = 152 + Math.random() * 5;
        this.isCompensatingThisRep = true; // Trunk lean
      } else if (mode === 2) {
        this.targetPeak = 112 + Math.random() * 6; // Low ROM
        this.isCompensatingThisRep = false;
      } else {
        this.targetPeak = 158 + Math.random() * 6; // Clean compliant
        this.isCompensatingThisRep = false;
      }
    }

    // Bell-curve angular motion trajectory
    const restAngle = 22;
    const peakGain = this.targetPeak - restAngle;
    const progress = Math.sin(this.phase * Math.PI); // 0 -> 1 -> 0
    const tremor = (Math.sin(timestamp * 0.02) + Math.cos(timestamp * 0.035)) * 1.5;
    const currentAngle = Math.max(15, Math.min(180, restAngle + (progress * peakGain) + tremor));

    // Dynamic trunk tilt simulation: if compensating, tilt ramps up when lifting arm past 80°
    let activeTilt = 2; // normal baseline posture variation
    if (this.isCompensatingThisRep && currentAngle > 75) {
      const tiltFactor = (currentAngle - 75) / (this.targetPeak - 75);
      activeTilt = Math.min(18, Math.round(2 + tiltFactor * 15));
    }
    this.simulatedTilt = activeTilt;
    const isCurrentlyCompensating = activeTilt >= 14;

    this.frameCount++;
    // Sample frames during the rep
    if (this.frameCount % 2 === 0) {
      this.buffer.push(currentAngle);
    }

    if (this.onAngleUpdate) {
      this.onAngleUpdate(Math.round(currentAngle), {
        tiltDeg: activeTilt,
        isCompensating: isCurrentlyCompensating,
      });
    }

    this.renderFrame(currentAngle, activeTilt, isCurrentlyCompensating);

    this.animId = requestAnimationFrame(this.loop);
  }

  renderFrame(angleDeg, tiltDeg, isCompensating) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Background: Virtual clinical capture chamber
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0F1E2E');
    bgGrad.addColorStop(1, '#08131F');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 40; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Kinematic model coordinates
    // When trunk tilts, centerX at shoulders shifts laterally!
    const trunkShiftX = isCompensating ? (tiltDeg / 18) * 36 : 0;
    const trunkShiftY = isCompensating ? Math.abs(trunkShiftX * 0.2) : 0;

    const baseCenterX = W * 0.48;
    const centerX = baseCenterX + trunkShiftX;
    const headY = H * 0.22 + trunkShiftY;
    const shoulderY = H * 0.35 + trunkShiftY;
    const hipY = H * 0.68;
    const kneeY = H * 0.88;

    // Vertical alignment guide line (reference for posture)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([4, 4]);
    ctx.moveTo(baseCenterX, H * 0.15);
    ctx.lineTo(baseCenterX, hipY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Head
    ctx.beginPath();
    ctx.fillStyle = isCompensating ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.12)';
    ctx.strokeStyle = isCompensating ? '#EF4444' : 'rgba(14, 165, 201, 0.6)';
    ctx.lineWidth = 2;
    ctx.arc(centerX, headY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Torso spine
    ctx.beginPath();
    ctx.strokeStyle = isCompensating ? '#EF4444' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.moveTo(centerX, shoulderY);
    ctx.lineTo(baseCenterX, hipY);
    ctx.stroke();

    // Right arm (unaffected side, resting)
    const rShoX = centerX + 45;
    const rShoY = shoulderY - (isCompensating ? (tiltDeg * 0.6) : 0);
    const rElbX = rShoX + 10;
    const rElbY = rShoY + 65;
    const rWriX = rShoX + 12;
    const rWriY = rElbY + 65;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.moveTo(rShoX, rShoY);
    ctx.lineTo(rElbX, rElbY);
    ctx.lineTo(rWriX, rWriY);
    ctx.stroke();

    // Left arm (exercised side)
    const lHipX = baseCenterX - 35;
    const lHipY = hipY;
    const lShoX = centerX - 45;
    const lShoY = shoulderY + (isCompensating ? (tiltDeg * 0.6) : 0);

    const rad = (angleDeg - 90) * (Math.PI / 180);
    const upperArmLen = 78;
    const forearmLen = 74;

    const lElbX = lShoX - Math.cos(rad) * upperArmLen;
    const lElbY = lShoY - Math.sin(rad) * upperArmLen;

    const lWriX = lElbX - Math.cos(rad) * forearmLen;
    const lWriY = lElbY - Math.sin(rad) * forearmLen;

    // Legs
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3;
    ctx.moveTo(baseCenterX - 25, hipY); ctx.lineTo(baseCenterX - 28, kneeY);
    ctx.moveTo(baseCenterX + 25, hipY); ctx.lineTo(baseCenterX + 28, kneeY);
    ctx.stroke();

    // Active kinematic arm bones
    const isCompliant = angleDeg >= 150;
    const isWarn = angleDeg >= 100 && angleDeg < 150;
    const themeColor = isCompensating ? '#EF4444' : isCompliant ? '#10B981' : isWarn ? '#F59E0B' : '#EF4444';

    ctx.beginPath();
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lHipX, lHipY);
    ctx.lineTo(lShoX, lShoY);
    ctx.lineTo(lElbX, lElbY);
    ctx.lineTo(lWriX, lWriY);
    ctx.stroke();

    // Joints
    const joints = [
      { x: lHipX, y: lHipY, name: 'Hip' },
      { x: lShoX, y: lShoY, name: 'Shoulder' },
      { x: lElbX, y: lElbY, name: 'Elbow' },
      { x: lWriX, y: lWriY, name: 'Wrist' },
    ];

    joints.forEach(j => {
      ctx.beginPath();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = isCompensating ? '#EF4444' : '#0B7EA3';
      ctx.lineWidth = 3;
      ctx.arc(j.x, j.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Angle Arc indicator
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(14, 165, 201, 0.45)';
    ctx.lineWidth = 2;
    ctx.arc(lShoX, lShoY, 34, Math.PI * 0.5, Math.PI * 0.5 - (angleDeg * Math.PI / 180), true);
    ctx.stroke();

    // HUD overlays
    // 1. Simulation watermark badge (safe margin x=18, y=18)
    ctx.fillStyle = 'rgba(11, 126, 163, 0.9)';
    ctx.beginPath();
    ctx.roundRect(18, 18, 156, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px Inter, sans-serif';
    ctx.fillText('SIMULATED PATIENT FEED', 28, 34);

    // 2. Kinematic Metrics Box
    ctx.fillStyle = 'rgba(10, 37, 64, 0.88)';
    ctx.beginPath();
    ctx.roundRect(18, 46, 156, 60, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText('SHOULDER FLEXION (L)', 28, 64);

    ctx.fillStyle = themeColor;
    ctx.font = '700 26px JetBrains Mono, monospace';
    ctx.fillText(`${Math.round(angleDeg)}°`, 28, 94);

    // 3. Posture / Trunk Tilt HUD box
    ctx.fillStyle = isCompensating ? 'rgba(220, 38, 38, 0.94)' : 'rgba(10, 37, 64, 0.88)';
    ctx.beginPath();
    ctx.roundRect(18, 110, 156, 30, 6);
    ctx.fill();
    ctx.strokeStyle = isCompensating ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px Inter, sans-serif';
    ctx.fillText(
      isCompensating ? `⚠️ TRUNK LEAN: ${tiltDeg}°` : `POSTURE: UPRIGHT (${tiltDeg}°)`,
      28,
      129
    );

    // 4. Prominent Compensation Banner across top (positioned to the right of HUD card)
    if (isCompensating) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
      ctx.beginPath();
      ctx.roundRect(186, 18, Math.max(200, W - 204), 34, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ TRUNK COMPENSATION DETECTED — KEEP SPINE UPRIGHT', 186 + (W - 204) / 2, 39);
      ctx.textAlign = 'left';
    }
  }
}
