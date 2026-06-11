"""
Train a model with given hyperparameters and SAVE the .sav file.
Used by Playground "Simpan Model" and retrain features.
Input via stdin JSON:
  - algorithm: 'knn' | 'dt' | 'rf'
  - hyperparameters: dict
  - save_path: where to save the .sav file
  - dataset_path: (optional) path to CSV, defaults to project CSV
  - extra_data: (optional) list of dicts with additional training rows
Output: JSON with metrics + saved model path
"""

import sys
import json
import os
import re
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor

CURRENT_YEAR = datetime.now().year
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.join(SCRIPT_DIR, '..', '..', '..', 'Car details v3 (1).csv')

# Resolve active dataset from config (used if dataset_path not explicitly provided)
try:
    from dataset_helper import get_active_dataset_path, get_active_currency
    ACTIVE_CSV = get_active_dataset_path()
    ACTIVE_CURRENCY = get_active_currency()
except Exception:
    ACTIVE_CSV = DEFAULT_CSV
    ACTIVE_CURRENCY = 'INR'


def fail(msg):
    print(json.dumps({'error': msg}))
    sys.exit(1)


def clamp_int(value, default, lo, hi):
    try:
        v = int(value)
    except Exception:
        return default
    return max(lo, min(hi, v))


def clamp_float(value, default, lo, hi):
    try:
        v = float(value)
    except Exception:
        return default
    return max(lo, min(hi, v))


def extract_torque_rpm(x):
    try:
        x = str(x).lower().replace(',', '')
        numbers = re.findall(r'\d+\.?\d*', x)
        if not numbers:
            return np.nan, np.nan, np.nan
        torque = float(numbers[0])
        if 'kgm' in x:
            torque *= 9.8
        rpm_min = float(numbers[1]) if len(numbers) >= 2 else np.nan
        rpm_max = float(numbers[2]) if len(numbers) >= 3 else rpm_min
        return torque, rpm_min, rpm_max
    except Exception:
        return np.nan, np.nan, np.nan


# ── Read input ───────────────────────────────────────────────────────────────
try:
    raw = sys.stdin.read() or '{}'
    payload = json.loads(raw)
except Exception as e:
    fail(f'Gagal membaca input: {e}')

algorithm = payload.get('algorithm', 'knn')
hyperparams = payload.get('hyperparameters', {}) or {}
save_path = payload.get('save_path')
dataset_path = payload.get('dataset_path', ACTIVE_CSV)
extra_data = payload.get('extra_data', [])
test_size = clamp_float(payload.get('test_size', 0.3), 0.3, 0.1, 0.5)
random_state = clamp_int(payload.get('random_state', 15), 15, 0, 100000)

# Currency detection: payload > active > INR
currency = payload.get('currency') or (ACTIVE_CURRENCY if dataset_path == ACTIVE_CSV else 'INR')

if not save_path:
    fail('save_path wajib diisi.')

if not os.path.exists(dataset_path):
    fail(f'Dataset tidak ditemukan: {dataset_path}')

# ── Load & preprocess dataset ────────────────────────────────────────────────
try:
    df = pd.read_csv(dataset_path)
except Exception as e:
    fail(f'Gagal membaca dataset: {e}')

df.columns = df.columns.str.strip().str.lower()

# Clean unit columns
df['mileage'] = pd.to_numeric(
    df['mileage'].astype(str).str.replace('kmpl', '').str.replace('km/kg', '').str.strip(),
    errors='coerce'
)
df['engine'] = pd.to_numeric(
    df['engine'].astype(str).str.replace('cc', '', regex=False).str.replace('CC', '', regex=False).str.strip(),
    errors='coerce'
)
df['max_power'] = pd.to_numeric(
    df['max_power'].astype(str).str.replace('bhp', '').str.strip(),
    errors='coerce'
)
df['selling_price'] = pd.to_numeric(df['selling_price'], errors='coerce')

# Extract torque
if 'torque' in df.columns:
    df[['torque_clean', 'rpm_min', 'rpm_max']] = df['torque'].apply(
        lambda x: pd.Series(extract_torque_rpm(x))
    )
    df = df.drop(columns=['torque'], errors='ignore')

df = df.drop(columns=['name'], errors='ignore')

# Append extra training data (from user feedback)
if extra_data and isinstance(extra_data, list) and len(extra_data) > 0:
    extra_df = pd.DataFrame(extra_data)
    extra_df.columns = extra_df.columns.str.strip().str.lower()
    # Ensure numeric types
    for col in ['year', 'km_driven', 'mileage', 'engine', 'max_power', 'seats',
                'torque_clean', 'rpm_min', 'rpm_max', 'selling_price']:
        if col in extra_df.columns:
            extra_df[col] = pd.to_numeric(extra_df[col], errors='coerce')
    df = pd.concat([df, extra_df], ignore_index=True)

# Fill missing numeric with median
for col in df.select_dtypes(include='number').columns:
    df[col] = df[col].fillna(df[col].median())

# Outlier removal IQR 2.5x
q1 = df['selling_price'].quantile(0.25)
q3 = df['selling_price'].quantile(0.75)
iqr = q3 - q1
df = df[(df['selling_price'] >= q1 - 2.5 * iqr) & (df['selling_price'] <= q3 + 2.5 * iqr)]

# Derived features
df['car_age'] = CURRENT_YEAR - df['year']
df['km_per_year'] = df['km_driven'] / (df['car_age'] + 1)
df['power_to_engine'] = df['max_power'] / df['engine']

if len(df) < 50:
    fail('Data terlalu sedikit setelah preprocessing.')

# ── Feature & target ─────────────────────────────────────────────────────────
feature_cols = [col for col in df.columns if col != 'selling_price']
X = df[feature_cols]
y = np.log1p(df['selling_price'])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=test_size, random_state=random_state
)

numeric_features = X_train.select_dtypes(include=['int64', 'float64']).columns.tolist()
categorical_features = X_train.select_dtypes(include=['object']).columns.tolist()

# ── Build pipeline ───────────────────────────────────────────────────────────
preprocessor = ColumnTransformer([
    ('num', Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', RobustScaler())
    ]), numeric_features),
    ('cat', Pipeline([
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ]), categorical_features),
])

if algorithm == 'knn':
    model = KNeighborsRegressor(
        n_neighbors=clamp_int(hyperparams.get('n_neighbors', 5), 5, 1, 100),
        weights=hyperparams.get('weights', 'distance') if hyperparams.get('weights') in ['uniform', 'distance'] else 'distance',
        p=clamp_int(hyperparams.get('p', 1), 1, 1, 2),
    )
elif algorithm == 'dt':
    model = DecisionTreeRegressor(
        max_depth=clamp_int(hyperparams.get('max_depth', 7), 7, 1, 100),
        min_samples_split=clamp_int(hyperparams.get('min_samples_split', 5), 5, 2, 200),
        min_samples_leaf=clamp_int(hyperparams.get('min_samples_leaf', 2), 2, 1, 100),
        random_state=random_state,
    )
elif algorithm == 'rf':
    raw_depth = hyperparams.get('max_depth', None)
    max_depth = None if raw_depth in [None, 'None', 'none', '', 0, '0'] else clamp_int(raw_depth, 12, 1, 100)
    model = RandomForestRegressor(
        n_estimators=clamp_int(hyperparams.get('n_estimators', 200), 200, 50, 1000),
        max_depth=max_depth,
        min_samples_split=clamp_int(hyperparams.get('min_samples_split', 2), 2, 2, 200),
        min_samples_leaf=clamp_int(hyperparams.get('min_samples_leaf', 1), 1, 1, 100),
        random_state=random_state,
        n_jobs=-1,
    )
else:
    fail(f'Algoritma tidak valid: {algorithm}')

pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('model', model),
])

# ── Train ────────────────────────────────────────────────────────────────────
try:
    pipeline.fit(X_train, y_train)
    y_pred_train = pipeline.predict(X_train)
    y_pred_test = pipeline.predict(X_test)
except Exception as e:
    fail(f'Training gagal: {e}')

# ── Metrics (log-space) ──────────────────────────────────────────────────────
r2_train = float(r2_score(y_train, y_pred_train))
r2_test = float(r2_score(y_test, y_pred_test))
rmse_train = float(np.sqrt(mean_squared_error(y_train, y_pred_train)))
rmse_test = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))

# ── Save model ───────────────────────────────────────────────────────────────
try:
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    joblib.dump(pipeline, save_path)
except Exception as e:
    fail(f'Gagal menyimpan model: {e}')

print(json.dumps({
    'success': True,
    'save_path': save_path,
    'file_size_kb': round(os.path.getsize(save_path) / 1024, 1),
    'metrics': {
        'r2_train': round(r2_train, 4),
        'r2_test': round(r2_test, 4),
        'rmse_train': round(rmse_train, 4),
        'rmse_test': round(rmse_test, 4),
    },
    'dataset_info': {
        'total_rows': int(len(df)),
        'train_rows': int(len(X_train)),
        'test_rows': int(len(X_test)),
        'extra_rows': len(extra_data) if extra_data else 0,
    },
    'algorithm': algorithm,
    'currency': currency,
}))
