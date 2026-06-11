"""
Batch prediction from uploaded CSV file.
Input via stdin JSON:
  - model_path: path to .sav model file (or 'knn'/'dt'/'rf' for builtin)
  - csv_path: path to the uploaded CSV file
  - algorithm: 'knn' | 'dt' | 'rf'
Output: JSON with predictions array
"""

import sys
import json
import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime

CURRENT_YEAR = datetime.now().year
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

BUILTIN_MODELS = {
    'knn': os.path.join(SCRIPT_DIR, '..', 'models', 'car_price_knn_model.sav'),
    'dt': os.path.join(SCRIPT_DIR, '..', 'models', 'car_price_DT_model.sav'),
    'rf': os.path.join(SCRIPT_DIR, '..', 'models', 'car_price_rf_model.sav'),
}


def fail(msg):
    print(json.dumps({"error": msg}))
    sys.exit(1)


try:
    raw = sys.stdin.read()
    payload = json.loads(raw)
except Exception as e:
    fail(f"Gagal membaca input: {e}")

model_path = payload.get('model_path', '')
csv_path = payload.get('csv_path', '')
algorithm = payload.get('algorithm', 'knn')

# Resolve model path
if model_path in BUILTIN_MODELS:
    model_path = BUILTIN_MODELS[model_path]

if not model_path or not os.path.exists(model_path):
    fail(f"File model tidak ditemukan: {model_path}")

if not csv_path or not os.path.exists(csv_path):
    fail(f"File CSV tidak ditemukan: {csv_path}")

# Load model
try:
    pipeline = joblib.load(model_path)
except Exception as e:
    fail(f"Gagal load model: {e}")

# Load CSV
try:
    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()
except Exception as e:
    fail(f"Gagal membaca CSV: {e}")

# Clean columns if they have units
if 'mileage' in df.columns:
    df['mileage'] = pd.to_numeric(
        df['mileage'].astype(str).str.replace('kmpl', '').str.replace('km/kg', '').str.strip(),
        errors='coerce'
    )
if 'engine' in df.columns:
    df['engine'] = pd.to_numeric(
        df['engine'].astype(str).str.replace('cc', '', regex=False).str.replace('CC', '', regex=False).str.strip(),
        errors='coerce'
    )
if 'max_power' in df.columns:
    df['max_power'] = pd.to_numeric(
        df['max_power'].astype(str).str.replace('bhp', '').str.strip(),
        errors='coerce'
    )

# Handle torque if present as raw string
import re
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

if 'torque' in df.columns and 'torque_clean' not in df.columns:
    df[['torque_clean', 'rpm_min', 'rpm_max']] = df['torque'].apply(
        lambda x: pd.Series(extract_torque_rpm(x))
    )
    df = df.drop(columns=['torque'], errors='ignore')

df = df.drop(columns=['name', 'selling_price'], errors='ignore')

# Ensure numeric types
numeric_cols = ['year', 'km_driven', 'mileage', 'engine', 'max_power',
                'seats', 'torque_clean', 'rpm_min', 'rpm_max']
for col in numeric_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

# Fill missing with median
for col in df.select_dtypes(include='number').columns:
    df[col] = df[col].fillna(df[col].median())

# Derived features
if 'year' in df.columns:
    df['car_age'] = CURRENT_YEAR - df['year']
    df['km_per_year'] = df['km_driven'] / (df['car_age'] + 1) if 'km_driven' in df.columns else 0
    df['power_to_engine'] = df['max_power'] / df['engine'] if 'engine' in df.columns and 'max_power' in df.columns else 0

# Predict
try:
    predictions_log = pipeline.predict(df)
    predictions = np.expm1(predictions_log)

    results = []
    for i, pred in enumerate(predictions):
        row_data = df.iloc[i].to_dict()
        # Convert numpy types to native Python
        clean_row = {}
        for k, v in row_data.items():
            if pd.isna(v):
                clean_row[k] = None
            elif isinstance(v, (np.integer,)):
                clean_row[k] = int(v)
            elif isinstance(v, (np.floating,)):
                clean_row[k] = round(float(v), 2)
            else:
                clean_row[k] = v
        results.append({
            'index': i,
            'prediction': round(float(pred), 2),
            'features': clean_row,
        })

    print(json.dumps({
        'success': True,
        'total_rows': len(results),
        'predictions': results,
        'currency': 'INR',
        'model_used': algorithm,
    }))
except Exception as e:
    fail(f"Prediksi batch gagal: {e}")
