import sys
import json
import os
import re
import time
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler, StandardScaler
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, '..', '..', '..', 'Car details v3 (1).csv')

def extract_torque_rpm(x):
    try:
        x = str(x).lower().replace(',', '')
        numbers = re.findall(r'\d+\.?\d*', x)
        torque = float(numbers[0])
        if 'kgm' in x:
            torque *= 9.8
        rpm_min = float(numbers[1]) if len(numbers) >= 2 else None
        rpm_max = float(numbers[2]) if len(numbers) >= 3 else rpm_min
        return torque, rpm_min, rpm_max
    except:
        return None, None, None

def clamp_int(value, default, min_value, max_value):
    try:
        parsed = int(value)
    except Exception:
        return default
    return max(min_value, min(max_value, parsed))

def clamp_float(value, default, min_value, max_value):
    try:
        parsed = float(value)
    except Exception:
        return default
    return max(min_value, min(max_value, parsed))

try:
    payload = json.loads(sys.stdin.read() or '{}')
except Exception as exc:
    print(json.dumps({'error': f'Payload tidak valid: {exc}'}))
    sys.exit(1)

algorithm = payload.get('algorithm', 'knn')
params = payload.get('hyperparameters', {}) or {}
training_options = payload.get('trainingOptions', {}) or {}
test_size_percent = clamp_float(training_options.get('test_size', 20), 20, 10, 40)
test_size = test_size_percent / 100.0
random_state = clamp_int(training_options.get('random_state', 42), 42, 0, 9999)

if not os.path.exists(DATASET_PATH):
    print(json.dumps({'error': f'Dataset tidak ditemukan: {DATASET_PATH}'}))
    sys.exit(1)

try:
    df = pd.read_csv(DATASET_PATH)
except Exception as exc:
    print(json.dumps({'error': f'Gagal membaca dataset: {exc}'}))
    sys.exit(1)

# Cleaning
df['mileage'] = df['mileage'].str.replace('kmpl', '', regex=False).str.replace('km/kg', '', regex=False)
df['mileage'] = pd.to_numeric(df['mileage'], errors='coerce')
df['engine'] = df['engine'].str.replace('CC', '', regex=False)
df['engine'] = pd.to_numeric(df['engine'], errors='coerce')
df['max_power'] = df['max_power'].str.replace('bhp', '', regex=False)
df['max_power'] = pd.to_numeric(df['max_power'], errors='coerce')

# Extract Torque & RPM
df[['torque_clean', 'rpm_min', 'rpm_max']] = df['torque'].apply(
    lambda x: pd.Series(extract_torque_rpm(x))
)

# Feature Engineering
from datetime import datetime
CURRENT_YEAR = datetime.now().year
df['car_age']         = CURRENT_YEAR - df['year']
df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
df['power_to_engine'] = df['max_power'] / df['engine']

# Drop unused
df = df.drop(columns=['torque', 'name'], errors='ignore')

# Handle missing values for features (playground uses median imputer in pipeline, but we need to drop Y nan)
work = df.dropna(subset=['selling_price']).copy()

if len(work) < 100:
    print(json.dumps({'error': 'Jumlah data valid terlalu sedikit untuk training.'}))
    sys.exit(1)

# Categorical and Numeric features
numeric_features = work.select_dtypes(include=['int64', 'float64']).columns.tolist()
if 'selling_price' in numeric_features:
    numeric_features.remove('selling_price')
categorical_features = work.select_dtypes(include=['object']).columns.tolist()

X = work[numeric_features + categorical_features]
y = work['selling_price']

# Use log transform for Random Forest and Decision Tree to match main scripts
use_log = (algorithm == 'random_forest' or algorithm == 'dt')
if use_log:
    y = np.log1p(y)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=test_size, random_state=random_state
)

if algorithm == 'knn':
    model = KNeighborsRegressor(
        n_neighbors=clamp_int(params.get('n_neighbors', 5), 5, 1, 50),
        weights=params.get('weights', 'distance') if params.get('weights') in ['uniform', 'distance'] else 'distance',
        p=clamp_int(params.get('p', 1), 1, 1, 2),
    )
    scaler = StandardScaler()
elif algorithm == 'random_forest':
    model = RandomForestRegressor(
        n_estimators=clamp_int(params.get('n_estimators', 100), 100, 10, 500),
        max_depth=clamp_int(params.get('max_depth', 20), 20, 1, 100) if params.get('max_depth') is not None else None,
        min_samples_split=clamp_int(params.get('min_samples_split', 2), 2, 2, 100),
        min_samples_leaf=clamp_int(params.get('min_samples_leaf', 1), 1, 1, 100),
        random_state=42,
    )
    scaler = RobustScaler()
else: # Decision Tree
    model = DecisionTreeRegressor(
        max_depth=clamp_int(params.get('max_depth', 7), 7, 1, 50),
        min_samples_split=clamp_int(params.get('min_samples_split', 5), 5, 2, 100),
        min_samples_leaf=clamp_int(params.get('min_samples_leaf', 2), 2, 1, 50),
        random_state=15, # Matching DT notebook seed
    )
    scaler = RobustScaler() # DT in notebook uses RobustScaler

# Preprocessor
num_steps = [('imputer', SimpleImputer(strategy='median'))]
if scaler:
    num_steps.append(('scaler', scaler))

preprocessor = ColumnTransformer([
    ('num', Pipeline(steps=num_steps), numeric_features),
    ('cat', Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ]), categorical_features)
])

pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('model', model),
])

try:
    fit_start = time.perf_counter()
    pipeline.fit(X_train, y_train)
    fit_seconds = time.perf_counter() - fit_start

    y_train_pred = pipeline.predict(X_train)
    y_pred = pipeline.predict(X_test)

    # Calculate metrics in original scale if log was used
    if use_log:
        y_train_orig = np.expm1(y_train)
        y_train_pred_orig = np.expm1(y_train_pred)
        y_test_orig = np.expm1(y_test)
        y_pred_orig = np.expm1(y_pred)
        
        r2_train = float(r2_score(y_train, y_train_pred)) # R2 usually better in log scale for distribution
        mse_train = float(mean_squared_error(y_train_orig, y_train_pred_orig))
        r2 = float(r2_score(y_test, y_pred))
        mse = float(mean_squared_error(y_test_orig, y_pred_orig))
    else:
        r2_train = float(r2_score(y_train, y_train_pred))
        mse_train = float(mean_squared_error(y_train, y_train_pred))
        r2 = float(r2_score(y_test, y_pred))
        mse = float(mean_squared_error(y_test, y_pred))

    rmse_train = float(np.sqrt(mse_train))
    rmse = float(np.sqrt(mse))

    test_rows = max(len(X_test), 1)
    rows_per_second = test_rows / max(time.perf_counter() - fit_start - fit_seconds, 1e-9)
    speed = int(max(1, min(100, round(rows_per_second / 30))))
    
    generalization_gap = abs(r2_train - r2)
    efficiency = int(max(1, min(100, round((max(r2, 0.0) * 100) - (generalization_gap * 100)))))

    result = {
        'metrics': {
            'r2_train': round(r2_train, 4),
            'r2': round(r2, 4),
            'mse_train': int(round(mse_train)),
            'mse': int(round(mse)),
            'rmse_train': int(round(rmse_train)),
            'rmse': int(round(rmse)),
            'speed': speed,
            'efficiency': efficiency,
            'fit_seconds': round(fit_seconds, 3)
        },
        'meta': {
            'samples_total': int(len(work)),
            'samples_train': int(len(X_train)),
            'samples_test': int(len(X_test)),
            'algorithm': algorithm,
            'use_log': use_log
        }
    }
    print(json.dumps(result))
except Exception as exc:
    print(json.dumps({'error': f'Training gagal: {exc}'}))
    sys.exit(1)
