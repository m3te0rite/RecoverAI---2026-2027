# Using Real Data for Vision Model Training

This guide explains how to collect and use real patient data to train a production-ready movement quality model for RecoverAI.

## Overview

Currently, the app uses a synthetic model trained on generated data. For real-world deployment, you need to:

1. **Collect real patient movement data** via video recordings
2. **Extract pose landmarks** using MediaPipe
3. **Label the data** (correct vs incorrect movements)
4. **Train a robust model** on the real dataset
5. **Export to ONNX** for browser deployment

---

## Step 1: Data Collection

### Equipment Needed
- **Camera**: Any standard webcam or smartphone camera (minimum 720p, 30fps recommended)
- **Environment**: Well-lit room with consistent lighting
- **Positioning**: Patient positioned 1.5–2 meters from camera, full upper body visible

### Recording Protocol

#### For Correct Repetitions (Label: 1)
- Patient performs shoulder flexion reaching ≥150°
- Smooth, controlled movement
- Full range of motion (rest → overhead → rest)
- Record 10-20 repetitions per patient

#### For Incorrect Repetitions (Label: 0)
- Patient performs limited range (<120°)
- May include common compensation patterns (e.g., trunk leaning, scapular elevation)
- Record 10-20 repetitions per patient

### Data Storage Structure
```
data/
├── raw_videos/
│   ├── patient_001_correct_01.mp4
│   ├── patient_001_correct_02.mp4
│   ├── patient_001_incorrect_01.mp4
│   ├── patient_002_correct_01.mp4
│   └── ...
└── metadata.csv
```

### Metadata CSV Format
```csv
patient_id,video_file,label,diagnosis,age,gender,session_date
001,patient_001_correct_01.mp4,1,stroke_right_hemisphere,58,M,2026-10-11
001,patient_001_incorrect_01.mp4,0,stroke_right_hemisphere,58,M,2026-10-11
```

---

## Step 2: Pose Landmark Extraction

Use MediaPipe Pose to extract joint landmarks from each video frame.

### Python Script for Extraction

```python
import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from pathlib import Path

def extract_landmarks(video_path, output_dir):
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(video_path)
    landmarks_data = []
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(frame_rgb)

        if results.pose_landmarks:
            # Extract relevant landmarks (hips, shoulders, elbows, wrists)
            relevant_indices = [11, 12, 13, 14, 15, 16, 23, 24]  # MediaPipe landmark indices
            frame_landmarks = []

            for idx in relevant_indices:
                lm = results.pose_landmarks.landmark[idx]
                frame_landmarks.extend([lm.x, lm.y, lm.z, lm.visibility])

            landmarks_data.append(frame_landmarks)
            frame_count += 1

    cap.release()
    pose.close()

    # Save as numpy array
    output_path = Path(output_dir) / f"{Path(video_path).stem}_landmarks.npy"
    np.save(output_path, np.array(landmarks_data))
    return output_path, frame_count

# Batch process all videos
videos_dir = Path("data/raw_videos")
landmarks_dir = Path("data/landmarks")
landmarks_dir.mkdir(exist_ok=True)

metadata = pd.read_csv("data/metadata.csv")

for _, row in metadata.iterrows():
    video_path = videos_dir / row["video_file"]
    output_path, frames = extract_landmarks(video_path, landmarks_dir)
    print(f"Extracted {frames} frames from {row['video_file']}")
```

---

## Step 3: Feature Engineering

Calculate angles and kinematic features from the raw landmarks.

```python
def calculate_angle(a, b, c):
    """Calculate angle between three points (in degrees)"""
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)

    if angle > 180.0:
        angle = 360 - angle

    return angle

def extract_features(landmarks_array):
    """
    Extract features from landmark sequence
    landmarks_array: shape (frames, num_landmarks * 4) [x, y, z, visibility]
    Returns: shape (frames, features)
    """
    features = []

    for frame_landmarks in landmarks_array:
        # Reshape to (num_landmarks, 4)
        lm = frame_landmarks.reshape(-1, 4)

        # Extract key joints (indices from extraction step)
        # Order: shoulder_L(11), shoulder_R(12), elbow_L(13), elbow_R(14),
        #        wrist_L(15), wrist_R(16), hip_L(23), hip_R(24)
        shoulder_L = lm[0][:2]
        shoulder_R = lm[1][:2]
        elbow_L = lm[2][:2]
        elbow_R = lm[3][:2]
        wrist_L = lm[4][:2]
        wrist_R = lm[5][:2]
        hip_L = lm[6][:2]
        hip_R = lm[7][:2]

        # Calculate shoulder flexion angle (left side)
        shoulder_flexion_L = calculate_angle(hip_L, shoulder_L, elbow_L)

        # Calculate shoulder flexion angle (right side)
        shoulder_flexion_R = calculate_angle(hip_R, shoulder_R, elbow_R)

        # Calculate elbow extension (left)
        elbow_extension_L = calculate_angle(shoulder_L, elbow_L, wrist_L)

        # Calculate elbow extension (right)
        elbow_extension_R = calculate_angle(shoulder_R, elbow_R, wrist_R)

        # Trunk lean angle (hip-shoulder line vs vertical)
        trunk_lean = calculate_angle([hip_L[0], hip_L[1] + 1], hip_L, shoulder_L)

        # Feature vector for this frame
        frame_features = [
            shoulder_flexion_L,
            shoulder_flexion_R,
            elbow_extension_L,
            elbow_extension_R,
            trunk_lean
        ]

        features.append(frame_features)

    return np.array(features)

# Process all landmark files
features_dir = Path("data/features")
features_dir.mkdir(exist_ok=True)

for landmarks_file in landmarks_dir.glob("*.npy"):
    landmarks = np.load(landmarks_file)
    features = extract_features(landmarks)

    output_path = features_dir / f"{landmarks_file.stem}_features.npy"
    np.save(output_path, features)
    print(f"Extracted features: {features.shape}")
```

---

## Step 4: Dataset Preparation

Create a training dataset with fixed-length sequences.

```python
import torch
from torch.utils.data import Dataset, DataLoader

class MovementDataset(Dataset):
    def __init__(self, features_dir, metadata_csv, sequence_length=30):
        self.features_dir = Path(features_dir)
        self.metadata = pd.read_csv(metadata_csv)
        self.sequence_length = sequence_length
        self.samples = []

        # Build sample list
        for _, row in self.metadata.iterrows():
            feature_file = self.features_dir / f"{Path(row['video_file']).stem}_landmarks_features.npy"
            if feature_file.exists():
                self.samples.append({
                    'file': feature_file,
                    'label': row['label']
                })

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        sample = self.samples[idx]
        features = np.load(sample['file'])

        # Pad or truncate to fixed sequence length
        if len(features) >= self.sequence_length:
            # Take a random window
            start_idx = np.random.randint(0, len(features) - self.sequence_length + 1)
            sequence = features[start_idx:start_idx + self.sequence_length]
        else:
            # Pad with zeros
            padding = np.zeros((self.sequence_length - len(features), features.shape[1]))
            sequence = np.vstack([features, padding])

        # Use only shoulder flexion as primary feature (like current model)
        # Or use all features for more complex model
        input_data = sequence[:, 0]  # Shoulder flexion only
        # Or: input_data = sequence  # All features

        return {
            'input': torch.FloatTensor(input_data),
            'label': torch.LongTensor([sample['label']])
        }

# Create dataset
dataset = MovementDataset(
    features_dir="data/features",
    metadata_csv="data/metadata.csv",
    sequence_length=30
)

# Split into train/val/test
train_size = int(0.7 * len(dataset))
val_size = int(0.15 * len(dataset))
test_size = len(dataset) - train_size - val_size

train_dataset, val_dataset, test_dataset = torch.utils.data.random_split(
    dataset, [train_size, val_size, test_size]
)

train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=32)
test_loader = DataLoader(test_dataset, batch_size=32)
```

---

## Step 5: Model Training

### Enhanced Model Architecture

```python
import torch
import torch.nn as nn
import torch.optim as optim

class MovementQualityModel(nn.Module):
    def __init__(self, input_features=1, hidden_dims=[128, 64, 32], num_classes=2):
        super(MovementQualityModel, self).__init__()

        layers = []
        prev_dim = input_features * 30  # Flatten sequence

        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.3)
            ])
            prev_dim = hidden_dim

        layers.append(nn.Linear(prev_dim, num_classes))

        self.network = nn.Sequential(*layers)

    def forward(self, x):
        # x shape: (batch, sequence_length, features)
        batch_size = x.size(0)
        x = x.view(batch_size, -1)  # Flatten
        return self.network(x)

# Initialize model
model = MovementQualityModel(input_features=1, hidden_dims=[128, 64, 32])
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=5)

# Training loop
num_epochs = 100
best_val_loss = float('inf')

for epoch in range(num_epochs):
    # Training
    model.train()
    train_loss = 0.0
    train_correct = 0
    train_total = 0

    for batch in train_loader:
        inputs = batch['input']
        labels = batch['label'].squeeze()

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        train_total += labels.size(0)
        train_correct += (predicted == labels).sum().item()

    # Validation
    model.eval()
    val_loss = 0.0
    val_correct = 0
    val_total = 0

    with torch.no_grad():
        for batch in val_loader:
            inputs = batch['input']
            labels = batch['label'].squeeze()

            outputs = model(inputs)
            loss = criterion(outputs, labels)

            val_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            val_total += labels.size(0)
            val_correct += (predicted == labels).sum().item()

    train_acc = 100 * train_correct / train_total
    val_acc = 100 * val_correct / val_total

    print(f"Epoch {epoch+1}/{num_epochs}")
    print(f"  Train Loss: {train_loss/len(train_loader):.4f}, Acc: {train_acc:.2f}%")
    print(f"  Val Loss: {val_loss/len(val_loader):.4f}, Acc: {val_acc:.2f}%")

    # Save best model
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        torch.save(model.state_dict(), 'best_model.pth')
        print("  ✓ Saved best model")

    scheduler.step(val_loss)

# Load best model for evaluation
model.load_state_dict(torch.load('best_model.pth'))

# Test evaluation
model.eval()
test_correct = 0
test_total = 0

with torch.no_grad():
    for batch in test_loader:
        inputs = batch['input']
        labels = batch['label'].squeeze()

        outputs = model(inputs)
        _, predicted = torch.max(outputs.data, 1)
        test_total += labels.size(0)
        test_correct += (predicted == labels).sum().item()

test_acc = 100 * test_correct / test_total
print(f"\nTest Accuracy: {test_acc:.2f}%")
```

---

## Step 6: Export to ONNX

```python
import onnx
import onnxruntime as ort

# Load trained model
model = MovementQualityModel(input_features=1, hidden_dims=[128, 64, 32])
model.load_state_dict(torch.load('best_model.pth'))
model.eval()

# Export to ONNX
dummy_input = torch.randn(1, 30, 1)  # (batch, sequence, features)
onnx_path = "repetition_model.onnx"

torch.onnx.export(
    model,
    dummy_input,
    onnx_path,
    export_params=True,
    opset_version=12,
    do_constant_folding=True,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={
        'input': {0: 'batch_size'},
        'output': {0: 'batch_size'}
    }
)

# Verify ONNX model
onnx_model = onnx.load(onnx_path)
onnx.checker.check_model(onnx_model)

# Test ONNX runtime
ort_session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])

outputs = ort_session.run(
    None,
    {'input': dummy_input.numpy()}
)

print(f"ONNX model exported successfully to {onnx_path}")
print(f"Output shape: {outputs[0].shape}")

# Copy to app/public directory
import shutil
shutil.copy(onnx_path, "../app/public/repetition_model.onnx")
print("Model copied to app/public/")
```

---

## Step 7: Integration with RecoverAI

The ONNX model is already integrated in the app. Place the new model file at:

```
app/public/repetition_model.onnx
```

The app will automatically load and use this model for inference.

---

## Real Data Sources

### Clinical Research Datasets

If you don't have access to real patient data, consider these public datasets:

1. **Berkeley MHAD** - Multimodal Human Action Dataset
   - Includes motion capture data of rehabilitation exercises
   - https://tele-immersion.cbl.berkeley.edu/mhad/

2. **Kaggle Medical Imaging Datasets**
   - Various medical imaging and pose datasets
   - https://www.kaggle.com/datasets

3. **UCI Machine Learning Repository**
   - Human activity recognition datasets
   - https://archive.ics.uci.edu/ml/datasets.php

### Collaborations

For genuine patient data:
- Partner with physical therapy clinics
- Collaborate with university rehabilitation research labs
- Work with hospitals under IRB approval
- Ensure HIPAA compliance for US-based data

---

## Ethical Considerations

### Data Privacy
- Obtain informed consent from all participants
- De-identify all data (remove names, MRNs, faces)
- Store data securely with encryption
- Follow HIPAA/GDPR regulations

### Bias Mitigation
- Ensure diverse dataset (age, gender, ethnicity, body types)
- Include various movement impairments
- Test model across different populations
- Document model limitations

### Clinical Validation
- Validate model predictions against clinical assessments
- Have physical therapists review classifications
- Measure inter-rater reliability
- Document false positive/negative rates

---

## Next Steps

1. **Start small**: Collect data from 5-10 patients first
2. **Validate extraction**: Ensure pose landmarks are accurate
3. **Train baseline**: Train initial model and evaluate
4. **Iterate**: Collect more data, refine features, improve model
5. **Clinical testing**: Deploy in controlled environment with therapist supervision
6. **Regulatory**: Consider FDA clearance if used for clinical decision-making

---

## Contact

For questions about data collection or model training, refer to:
- MediaPipe documentation: https://google.github.io/mediapipe/
- PyTorch documentation: https://pytorch.org/docs/
- ONNX Runtime: https://onnxruntime.ai/docs/
