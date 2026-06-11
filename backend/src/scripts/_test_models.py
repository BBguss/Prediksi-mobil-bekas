"""
Script diagnosa — cek kompatibilitas semua model .sav
Jalankan: python backend/src/scripts/_test_models.py
"""
import os, sys, json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(SCRIPT_DIR, '..', 'models')
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..', '..')
CSV_PATH    = os.path.join(PROJECT_ROOT, 'Car details v3 (1).csv')

# ── Fitur yang dipakai setiap model ──────────────────────────────────────────
MODELS = {
    'knn': os.path.join(MODELS_DIR, 'car_price_knn_model.sav'),
    'dt' : os.path.join(MODELS_DIR, 'car_price_DT_model.sav'),
    'rf' : os.path.join(MODELS_DIR, 'car_price_rf_model.sav'),
}

CURRENT_YEAR = datetime.now().year

# ── Input test — satu baris sample ───────────────────────────────────────────
base_features = {
    'year'         : 2019,
    'km_driven'    : 45000,
    'fuel'         : 'Petrol',
    'seller_type'  : 'Individual',
    'transmission' : 'Manual',
    'owner'        : 'First Owner',
    'mileage'      : 18.5,
    'engine'       : 1197.0,
    'max_power'    : 82.0,
    'seats'        : 5.0,
    'torque_clean' : 113.0,
    'rpm_min'      : 4200.0,
    'rpm_max'      : 5200.0,
}

def make_df(features):
    df = pd.DataFrame([features])
    df['car_age']         = CURRENT_YEAR - df['year']
    df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
    df['power_to_engine'] = df['max_power'] / df['engine']
    return df

def probe_model_columns(model_obj, df):
    """Coba deteksi kolom yang dipakai model via pipeline internals."""
    try:
        prep = model_obj.named_steps.get('preprocessor')
        if prep is None:
            return "pipeline tidak ada 'preprocessor'"
        transformers = prep.transformers
        used_cols = []
        for name, _, cols in transformers:
            used_cols.extend(cols)
        return used_cols
    except Exception as e:
        return f"tidak bisa probe: {e}"

print("=" * 60)
print("DIAGNOSA MODEL — Prediksi_Model")
print("=" * 60)

for key, path in MODELS.items():
    print(f"\n[{key.upper()}] Path: {path}")
    if not os.path.exists(path):
        print(f"  ❌ FILE TIDAK ADA")
        continue

    size_kb = os.path.getsize(path) / 1024
    print(f"  Ukuran: {size_kb:.1f} KB")

    try:
        model = joblib.load(path)
        print(f"  ✅ Load berhasil. Tipe: {type(model).__name__}")
    except Exception as e:
        print(f"  ❌ Load GAGAL: {e}")
        continue

    # Probe kolom yang dipakai
    df_test = make_df(base_features)
    cols_used = probe_model_columns(model, df_test)
    print(f"  Kolom terdaftar di pipeline: {cols_used}")

    # Cek apakah kolom df_test cocok
    if isinstance(cols_used, list):
        missing = [c for c in cols_used if c not in df_test.columns]
        extra   = [c for c in df_test.columns if c not in cols_used]
        if missing:
            print(f"  ⚠️  Kolom KURANG di df: {missing}")
        if extra:
            print(f"  ℹ️  Kolom LEBIH di df (akan di-ignore pipeline): {extra}")

    # Coba predict
    try:
        raw_pred = model.predict(df_test)[0]
        # Cek apakah output perlu expm1
        if raw_pred < 50:
            final = float(np.expm1(raw_pred))
            print(f"  🔢 Pred (log-space): {raw_pred:.4f} → expm1 → INR {final:,.0f}")
        else:
            final = float(raw_pred)
            print(f"  🔢 Pred (direct):    INR {final:,.0f}")
        print(f"  ✅ PREDIKSI BERHASIL")
    except Exception as e:
        print(f"  ❌ Predict GAGAL: {e}")
        # Coba dengan subset kolom
        print(f"     Kolom di df: {list(df_test.columns)}")

print("\n" + "=" * 60)
print("SELESAI")
print("=" * 60)
