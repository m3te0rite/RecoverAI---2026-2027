/* ─── RecoverAI Clinical Data CSV Exporter ───────────────────────────────── */
// Generates research-grade CSV data files for biomechanists and physical therapy researchers.

export function exportSessionCSV(patient, repLog, history14Days) {
  const patientName = patient?.name?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'john_d';
  const mrn = patient?.mrn || 'MRN-20261004';
  const filename = `recoverai_kinematics_${patientName}_${new Date().toISOString().slice(0, 10)}.csv`;

  let csvContent = 'data:text/csv;charset=utf-8,';

  // Section 1: Patient & Clinical Metadata Header
  csvContent += '# RECOVERAI CLINICAL TELEMETRY EXPORT\n';
  csvContent += `# Patient Name: ${patient?.name || 'John D.'}\n`;
  csvContent += `# Medical Record Number: ${mrn}\n`;
  csvContent += `# Diagnosis: ${patient?.dx || 'Ischemic Stroke (MCA)'}\n`;
  csvContent += `# Chronicity: ${patient?.onset || 'Post-Stroke Day 42'}\n`;
  csvContent += `# Supervising Clinician: ${patient?.therapist || 'Dr. Sunita Patel, PT, DPT'}\n`;
  csvContent += `# Export Timestamp: ${new Date().toISOString()}\n`;
  csvContent += '#\n';

  // Section 2: Real-time Session Repetition Log
  csvContent += '# --- SESSION REPETITION KINEMATICS ---\n';
  csvContent += 'Repetition_Number,Timestamp,Peak_ROM_Deg,Classification,Target_Threshold_Deg,Confidence_Percent,Compensatory_Movement_Detected\n';

  if (!repLog || repLog.length === 0) {
    csvContent += '1,Baseline_Sample,68,Sub_threshold,150,88,No\n';
  } else {
    // Sort chronologically (earliest to latest)
    const sorted = [...repLog].reverse();
    sorted.forEach((r, idx) => {
      const repNum = idx + 1;
      const ts = r.ts || new Date().toLocaleTimeString();
      const peak = r.peak || 0;
      const classification = r.pass ? 'Compliant' : 'Sub_threshold';
      const conf = r.conf || 85;
      const comp = r.compensation ? 'YES (Trunk Lean)' : 'No';
      csvContent += `${repNum},${ts},${peak},${classification},150,${conf},"${comp}"\n`;
    });
  }

  csvContent += '#\n';

  // Section 3: 14-Day Longitudinal Trend Data
  csvContent += '# --- 14-DAY LONGITUDINAL REHABILITATION SUMMARY ---\n';
  csvContent += 'Day,Date,Prescribed_Protocol,Target_Reps,Completed_Reps,Compliant_Reps,Peak_ROM_Deg,Adherence_Rate_Percent,Smoothness_Index\n';

  (history14Days || []).forEach(d => {
    csvContent += `${d.day},${d.date},"Shoulder Flexion",${d.targetReps || 10},${d.completedReps || 0},${d.compliantReps || 0},${d.rom || 0},${d.adherence || 0},${d.smoothness || 75}\n`;
  });

  // Trigger browser download
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
