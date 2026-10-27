import * as ort from 'onnxruntime-web';

let sessionInstance = null;
let sessionInitPromise = null;
let runQueue = Promise.resolve();

async function getSession() {
  if (sessionInstance) return sessionInstance;
  if (!sessionInitPromise) {
    ort.env.wasm.numThreads = 1;
    sessionInitPromise = ort.InferenceSession.create('/repetition_model.onnx', {
      executionProviders: ['wasm'],
    }).then((sess) => {
      sessionInstance = sess;
      return sess;
    }).catch((err) => {
      sessionInitPromise = null;
      throw err;
    });
  }
  return sessionInitPromise;
}

/**
 * Run inference on a 30-frame sequence using the on-device ONNX model.
 * Queued to ensure thread-safety on single-threaded WASM runtime.
 * @param {Float32Array|number[]} sequence - 30 joint angle values
 * @returns {Promise<number>} - Probability of compliance (0.0 to 1.0)
 */
export function predictRepetition(sequence) {
  return new Promise((resolve, reject) => {
    // Chain onto runQueue so concurrent calls never collide in WASM
    runQueue = runQueue
      .then(async () => {
        const session = await getSession();
        const arr = sequence instanceof Float32Array ? sequence : new Float32Array(sequence);
        const input = new ort.Tensor('float32', arr, [1, 30, 1]);
        const result = await session.run({ input });
        const logits = result.output.data;
        const expA = Math.exp(logits[0]);
        const expB = Math.exp(logits[1]);
        const prob = expB / (expA + expB);
        resolve(prob);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
