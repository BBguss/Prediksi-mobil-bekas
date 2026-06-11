"""
verify_models.py — Verifikasi cepat apakah semua .sav bisa predict dengan benar.

Jalankan dari root project:
    python backend/src/scripts/verify_models.py

Kalau ada model yang FAIL → jalankan retrain:
    python backend/src/scripts/train_all_models.py knn dt rf
"""
import os, sys, json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR   = os.path.join(SCRIPT_DIR, '..', 'models')
CURRENT_YEAR = datetime.now().year

MODELS = {
    'KNN': os.path.join(MODELS_DIR, 'car_price_knn_model.sav'),
    'DT' : os.path.join(MODELS_DIR, 'car_price_DT_model.sav'),
    'RF' : os.path.join(MODELS_DIR, 'car_price_rf_model.sav'),
}

# Input test standar
TEST_INPUT = {
    'year': 2019, 'km_driven': 45000,
    'fuel': 'Petrol', 'seller_type': 'Individual',
    'transmission': 'Manual', 'owner': 'First Owner',
    'mileage': 18.5, 'engine': 1197.0,
    'max_power': 82.0, 'seats': 5.0,
    'torque_clean': 113.0, 'rpm_min': 4200.0, 'rpm_max': 5200.0,
}

def make_df(inp):
    df = pd.DataFrame([inp])
    df['car_age']         = CURRENT_YEAR - df['year']
    df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
    df['power_to_engine'] = df['max_power'] / df['engine']
    return df

print("=" * 60)
print(f"  VERIFIKASI MODEL — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
print("=" * 60)

all_ok = True
results = {}

for name, path in MODELS.items():
    print(f"\n[{name}]")
    if not os.path.exists(path):
        print(f"  ❌  FILE TIDAK ADA: {path}")
        all_ok = False
        results[name] = 'MISSING'
        continue

    size_kb = os.path.getsize(path) / 1024
    print(f"  File: {os.path.basename(path)}  ({size_kb:.0f} KB)")

    try:
        model = joblib.load(path)
        print(f"  Load: OK  [{type(model).__name__}]")
    except Exception as e:
        print(f"  ❌  Load GAGAL: {e}")
        all_ok = False
        results[name] = 'LOAD_ERROR'
        continue

    # Cek struktur pipeline
    if not hasattr(model, 'predict'):
        print(f"  ❌  Objek tidak punya .predict()")
        all_ok = False
        results[name] = 'NO_PREDICT'
        continue

    try:
        df = make_df(TEST_INPUT)
        raw = model.predict(df)[0]
        # Semua model pipeline baru pakai log1p → cek apakah output perlu expm1
        if raw < 20:
            pred_inr = float(np.expm1(raw))
            mode = 'log-space → expm1'
        else:
            pred_inr = float(raw)
            mode = 'direct (model lama tanpa log)'

        pred_idr = pred_inr * 190.5
        print(f"  Predict ({mode}): INR {pred_inr:,.0f}  ≈  IDR {pred_idr:,.0f}")

        # Sanity check — harga wajar 50k–50M INR
        if pred_inr < 50_000 or pred_inr > 50_000_000:
            print(f"  ⚠️  Harga di luar range wajar (50K–50M INR). Mungkin pipeline mismatch.")
            results[name] = 'RANGE_WARNING'
        else:
            print(f"  ✅  OK — harga dalam range wajar")
            results[name] = 'OK'

    except Exception as e:
        print(f"  ❌  Predict GAGAL: {e}")
        all_ok = False
        results[name] = f'PREDICT_ERROR: {e}'
        # Print kolom yang diharapkan
        try:
            prep = model.named_steps.get('preprocessor')
            if prep:
                expected = []
                for _, _, cols in prep.transformers:
                    expected.extend(cols)
                print(f"  Model expect kolom: {expected}")
                got = list(make_df(TEST_INPUT).columns)
                print(f"  Kita kirim kolom  : {got}")
                missing = [c for c in expected if c not in got]
                extra   = [c for c in got if c not in expected]
                if missing: print(f"  Kurang: {missing}")
                if extra:   print(f"  Lebih : {extra}")
        except Exception:
            pass

print("\n" + "=" * 60)
print("RINGKASAN:")
for name, status in results.items():
    icon = "✅" if status == "OK" else ("⚠️ " if "WARNING" in status else "❌")
    print(f"  {icon}  {name}: {status}")

if all_ok and all(v == 'OK' for v in results.values()):
    print("\n✅  Semua model siap digunakan!")
else:
    print("\n⚠️  Ada model yang bermasalah.")
    print("    Jalankan: python backend/src/scripts/train_all_models.py")
    failed = [k for k,v in results.items() if v != 'OK']
    args = ' '.join(k.lower() for k in failed)
    print(f"    Atau spesifik: python backend/src/scripts/train_all_models.py {args}")
print("=" * 60)
