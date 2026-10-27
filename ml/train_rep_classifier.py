# train_rep_classifier.py – trains 1-D CNN repetition classifier on real kinematics and exports ONNX
import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import numpy as np

# Robust path resolution – works regardless of where the script is executed
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
DATA_PATH = os.path.join(SCRIPT_DIR, 'data', 'rep_classifier.npz')
APP_PUBLIC = os.path.join(PROJECT_ROOT, 'app', 'public')
ONNX_OUT = os.path.join(APP_PUBLIC, 'repetition_model.onnx')

print(f"Loading repetition dataset from: {DATA_PATH}")
npz = np.load(DATA_PATH)
X_np = npz['X']  # (N, 30)
y_np = npz['y']  # (N,)

if X_np.ndim == 2:
    X_np = np.expand_dims(X_np, axis=-1)  # (N, 30, 1)

print(f"Dataset shape: X={X_np.shape}, y={y_np.shape} (Positives: {np.sum(y_np==1)}, Negatives: {np.sum(y_np==0)})")

# Train/Test Split (80% train, 20% validation)
X_train, X_val, y_train, y_val = train_test_split(
    X_np, y_np, test_size=0.20, random_state=42, stratify=y_np
)

X_train_t = torch.tensor(X_train, dtype=torch.float32)
y_train_t = torch.tensor(y_train, dtype=torch.long)
X_val_t   = torch.tensor(X_val, dtype=torch.float32)
y_val_t   = torch.tensor(y_val, dtype=torch.long)

batch_size = 64
train_loader = DataLoader(TensorDataset(X_train_t, y_train_t), batch_size=batch_size, shuffle=True)

class RepNet(nn.Module):
    """
    1-D Convolutional Neural Network for Repetition Compliance Classification.
    Input: (Batch, 30, 1) - 30-frame joint angle sequence
    Output: (Batch, 2) - Logits for [Sub-threshold, Compliant]
    """
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(in_channels=1, out_channels=16, kernel_size=3, padding=1),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.Conv1d(in_channels=16, out_channels=32, kernel_size=3, padding=1),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten(),
            nn.Dropout(0.2),
            nn.Linear(32, 2)
        )

    def forward(self, x):
        # x is (B, 30, 1) -> permute to (B, 1, 30) for Conv1d
        x = x.permute(0, 2, 1)
        return self.net(x)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = RepNet().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)

epochs = 15
print("Training Repetition Compliance Classifier (Model A)...")
for epoch in range(1, epochs + 1):
    model.train()
    total_loss = 0.0
    for xb, yb in train_loader:
        xb, yb = xb.to(device), yb.to(device)
        optimizer.zero_grad()
        logits = model(xb)
        loss = criterion(logits, yb)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    if epoch % 3 == 0 or epoch == epochs:
        model.eval()
        with torch.no_grad():
            val_logits = model(X_val_t.to(device))
            val_preds = val_logits.argmax(dim=1).cpu().numpy()
            val_acc = accuracy_score(y_val, val_preds) * 100
        print(f"Epoch {epoch:2d}/{epochs} - Train Loss: {total_loss/len(train_loader):.4f} - Val Accuracy: {val_acc:.1f}%")

# Final Validation Evaluation
model.eval()
with torch.no_grad():
    val_logits = model(X_val_t.to(device))
    val_preds = val_logits.argmax(dim=1).cpu().numpy()

print("\n--- Final Model A Evaluation Report ---")
print(classification_report(y_val, val_preds, target_names=["Sub-threshold (<150 deg)", "Compliant (>=150 deg)"]))

# Export to ONNX format for on-device browser inference
cpu_model = model.to('cpu').eval()
dummy = torch.randn(1, 30, 1, dtype=torch.float32)

os.makedirs(APP_PUBLIC, exist_ok=True)

# Export using legacy exporter (dynamo=False) to ensure a single self-contained .onnx file
torch.onnx.export(
    cpu_model,
    dummy,
    ONNX_OUT,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
    opset_version=18,
    dynamo=False
)

print(f"\nModel A successfully exported to ONNX: {ONNX_OUT} ({os.path.getsize(ONNX_OUT)} bytes)")
