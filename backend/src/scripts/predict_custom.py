"""
Generic prediction script for custom models saved from Playground.
Receives JSON via stdin with:
  - model_path: path to the .sav file
  - algorithm: 'knn' | 'dt' | 'rf'
  - features: dict of input features
Returns JSON via stdout with prediction result.
"""

import sys
import json
import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime

CURRENT_YEAR = datetime.now().year


def fail(msg):
    print(json.dumps({"error": msg}))
    sys.exit(1)


try:
    raw = sys.stdin.read()
    payload = json.loads(raw)
except Exception as e:
    fail(f"Gagal membaca input: {e}")

model_path = payload.get('model_path')
algorithm = payload.get('algorithm', 'knn')
features = payload.get('features', {})
currency = payload.get('currency', 'INR')

if not model_path or not os.path.exists(model_path):
    fail(f"File model tidak ditemukan: {model_path}")

# Load model pipeline
try:
    pipeline = joblib.load(model_path)
except Exception as e:
    fail(f"Gagal load model: {e}")

# Build input DataFrame
try:
    base_columns = [
        'year', 'km_driven', 'fuel', 'seller_type', 'transmission', 'owner',
        'mileage', 'engine', 'max_power', 'seats',
        'torque_clean', 'rpm_min', 'rpm_max'
    ]

    row = {col: features.get(col, np.nan) for col in base_columns}
    df_input = pd.DataFrame([row])

    # Convert numeric columns
    numeric_cols = ['year', 'km_driven', 'mileage', 'engine', 'max_power',
                    'seats', 'torque_clean', 'rpm_min', 'rpm_max']
    for col in numeric_cols:
        df_input[col] = pd.to_numeric(df_input[col], errors='coerce')

    # Derived features (same as training)
    df_input['car_age'] = CURRENT_YEAR - df_input['year']
    df_input['km_per_year'] = df_input['km_driven'] / (df_input['car_age'] + 1)
    df_input['power_to_engine'] = df_input['max_power'] / df_input['engine']

except Exception as e:
    fail(f"Gagal menyiapkan input: {e}")

# Predict
try:
    y_pred = pipeline.predict(df_input)[0]

    # All custom models are trained with log1p target
    prediction = float(np.expm1(y_pred))

    algo_names = {
        'knn': 'KNN Regressor (Custom)',
        'dt': 'Decision Tree Regressor (Custom)',
        'rf': 'Random Forest Regressor (Custom)',
    }

    result = {
        "prediction": round(prediction, 2),
        "model_used": algo_names.get(algorithm, f"{algorithm} (Custom)"),
        "currency": currency
    }
    print(json.dumps(result))
except Exception as e:
    fail(f"Prediksi gagal: {e}")
