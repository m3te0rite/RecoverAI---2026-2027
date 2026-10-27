// ---------------------------------------------------------------
// TestModelIntegration – sanity‑check that the ONNX models load
// and produce outputs without errors.
// ---------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { predictRepetition } from '../shared/modelA';
import { runModelBAnalysis } from '../shared/modelB';

const syntheticRepetition = new Float32Array(30).fill(0.5); // dummy 30‑frame buffer

// 14‑day synthetic history – matches the CSV schema used for training
const syntheticHistory = [
    { rom: 120, totalReps: 8, compliantReps: 6, adherence: 0.80, smoothness: 85 },
    { rom: 122, totalReps: 9, compliantReps: 7, adherence: 0.85, smoothness: 86 },
    { rom: 124, totalReps: 9, compliantReps: 7, adherence: 0.88, smoothness: 87 },
    { rom: 125, totalReps: 10, compliantReps: 8, adherence: 0.90, smoothness: 88 },
    { rom: 127, totalReps: 10, compliantReps: 9, adherence: 0.92, smoothness: 89 },
    { rom: 128, totalReps: 11, compliantReps: 9, adherence: 0.93, smoothness: 90 },
    { rom: 129, totalReps: 11, compliantReps: 9, adherence: 0.94, smoothness: 90 },
    { rom: 130, totalReps: 12, compliantReps: 10, adherence: 0.95, smoothness: 91 },
    { rom: 131, totalReps: 12, compliantReps: 10, adherence: 0.95, smoothness: 92 },
    { rom: 132, totalReps: 13, compliantReps: 11, adherence: 0.96, smoothness: 92 },
    { rom: 133, totalReps: 13, compliantReps: 11, adherence: 0.96, smoothness: 93 },
    { rom: 134, totalReps: 14, compliantReps: 12, adherence: 0.97, smoothness: 94 },
    { rom: 135, totalReps: 14, compliantReps: 12, adherence: 0.97, smoothness: 94 },
    { rom: 136, totalReps: 15, compliantReps: 13, adherence: 0.98, smoothness: 95, dropout: 1 }, // dropout class
];

export default function TestModelIntegration() {
    const [repScore, setRepScore] = useState(null);
    const [bResult, setBResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isActive = true;
        async function runTests() {
            try {
                // ---- Model A (repetition) ----
                const prob = await predictRepetition(syntheticRepetition);
                if (!isActive) return;
                setRepScore(Number(prob.toFixed(4)));

                // ---- Model B (trajectory + dropout) ----
                const result = await runModelBAnalysis(syntheticHistory);
                if (!isActive) return;
                setBResult(result);
            } catch (e) {
                if (!isActive) return;
                setError(e?.message ?? String(e));
                console.error('❌ Test failed', e);
            }
        }
        runTests();
        return () => {
            isActive = false;
        };
    }, []);

    return (
        <section style={{ padding: '1rem', background: '#0a0a0a', color: '#e0e0e0' }}>
            <h2>🔬 Model‑integration sanity check</h2>
            {error && (
                <pre style={{ color: '#ff6b6b' }}>
                    ❗️ Error: {error}
                </pre>
            )}
            {repScore !== null && (
                <p>
                    ✔️ Model A (repetition) probability: <strong>{repScore}</strong>
                </p>
            )}
            {bResult && (
                <pre style={{ whiteSpace: 'pre-wrap' }}>
                    ✔️ Model B output (JSON):
                    {JSON.stringify(bResult, null, 2)}
                </pre>
            )}
        </section>
    );
}
