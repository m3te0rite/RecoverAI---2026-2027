# generate_data.py – creates a tiny synthetic dataset for Model A
import numpy as np, os

np.random.seed(42)
N = 2000
# Simulate 30‑frame angle windows (values between 80 and 180 degrees)
X = np.random.uniform(80, 180, size=(N, 30)).astype(np.float32)
# Label: compliant (1) if max >= 150 and no simulated compensation flag
labels = (X.max(axis=1) >= 150).astype(np.int64)
# Introduce ~15% noisy negatives to simulate compensation errors
noise_idx = np.random.choice(N, size=int(0.15 * N), replace=False)
labels[noise_idx] = 0

# Save to npz (the training script expects this path)
os.makedirs(os.path.join('data'), exist_ok=True)
np.savez(os.path.join('data', 'rep_classifier.npz'), X=X, y=labels)
print(f'Synthetic dataset saved to {os.path.join("data", "rep_classifier.npz")} – {N} samples')
