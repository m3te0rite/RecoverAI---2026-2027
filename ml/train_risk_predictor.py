# train_risk_predictor.py – trains ROM trajectory regressor and dropout classifier, then exports ONNX
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.metrics import mean_absolute_error, roc_auc_score
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

# ---------- Paths (relative to this script's location) ----------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_CSV = os.path.join(SCRIPT_DIR, 'data', '14day_history.csv')
# Output ONNX files will be placed in the app public folder
APP_PUBLIC = os.path.join(SCRIPT_DIR, '..', 'app', 'public')
OUT_TRAJ = os.path.join(APP_PUBLIC, 'modelB_trajectory.onnx')
OUT_DROP = os.path.join(APP_PUBLIC, 'modelB_dropout.onnx')

# ---------- Load data ----------
print('Loading CSV from', DATA_CSV)
df = pd.read_csv(DATA_CSV)

# Feature columns – we keep a small set that the front-end will send
feature_cols = ['rom', 'totalReps', 'compliantReps', 'adherence', 'smoothness']
X = df[feature_cols].astype(np.float32).values

# ------- Target 1 – 14-day ROM delta (regression) -------
# Compute ROM of the *future* day 14 steps ahead (if available), otherwise use 0
future_rom = df['rom'].shift(-14).fillna(df['rom']).values
y_rom = (future_rom - df['rom']).astype(np.float32)  # delta in degrees

# ------- Target 2 – dropout flag (binary classification) -------
# If the CSV doesn't already have a 'dropout' column, derive one from
# low adherence + low ROM as a heuristic proxy.
if 'dropout' not in df.columns:
    # Mark low-adherence, low-ROM rows as likely dropouts
    dropout_prob = (1 - df['adherence']) * 0.6 + (1 - df['rom'] / df['rom'].max()) * 0.4
    df['dropout'] = (dropout_prob > 0.65).astype(int)

y_dropout = df['dropout'].astype(np.int64).values

# Train-test split (20% hold-out)
X_train, X_test, y_rom_train, y_rom_test, y_drop_train, y_drop_test = train_test_split(
    X, y_rom, y_dropout, test_size=0.2, random_state=42, stratify=y_dropout
)

# ---------- Model 1: ROM trajectory regressor ----------
reg = GradientBoostingRegressor(n_estimators=300, learning_rate=0.05, max_depth=4, random_state=0)
reg.fit(X_train, y_rom_train)
pred_rom = reg.predict(X_test)
print('ROM regression MAE:', mean_absolute_error(y_rom_test, pred_rom))

# ---------- Model 2: Dropout classifier ----------
cls = GradientBoostingClassifier(n_estimators=300, learning_rate=0.05, max_depth=4, random_state=0)
cls.fit(X_train, y_drop_train)
proba = cls.predict_proba(X_test)[:, 1]
try:
    auc = roc_auc_score(y_drop_test, proba)
    print('Dropout AUC:', auc)
except ValueError:
    print('Dropout AUC: undefined (single class in test set)')

# ---------- Export to ONNX ----------
initial_type = [('input', FloatTensorType([None, X.shape[1]]))]

reg_onnx = convert_sklearn(reg, initial_types=initial_type)
options = {id(cls): {'zipmap': False}}
cls_onnx = convert_sklearn(cls, initial_types=initial_type, options=options)

# Ensure target directory exists
os.makedirs(os.path.dirname(OUT_TRAJ), exist_ok=True)

with open(OUT_TRAJ, 'wb') as f:
    f.write(reg_onnx.SerializeToString())
with open(OUT_DROP, 'wb') as f:
    f.write(cls_onnx.SerializeToString())

print('Model B exported ->', OUT_TRAJ)
print('Model B exported ->', OUT_DROP)
