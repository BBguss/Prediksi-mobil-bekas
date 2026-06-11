"""
predict_dt.py — Inference script Decision Tree Regressor
Pipeline: RobustScaler + log1p target + torque/rpm + fitur turunan
Input  : JSON via stdin
Output : JSON via stdout  { prediction, model_used, currency }
"""
import sys, json, os
import joblib, pandas as pd, numpy as np
from datetime import datetime

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(SCRIPT_DIR, '..', 'models', 'car_price_DT_model.sav')
CURRENT_YEAR = datetime.now().year

def fail(msg):
    print(json.dumps({"error": msg}))
    sys.exit(1)

try:
    features = json.loads(sys.stdin.read())
except Exception as e:
    fail(f"Gagal membaca input: {e}")

try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    fail(f"Gagal load model Decision Tree: {e}")

try:
    row = {
        'year'         : float(features.get('year', 2019)),
        'km_driven'    : float(features.get('km_driven', 45000)),
        'fuel'         : str(features.get('fuel', 'Petrol')),
        'seller_type'  : str(features.get('seller_type', 'Individual')),
        'transmission' : str(features.get('transmission', 'Manual')),
        'owner'        : str(features.get('owner', 'First Owner')),
        'mileage'      : float(features.get('mileage', 18.5)),
        'engine'       : float(features.get('engine', 1197.0)),
        'max_power'    : float(features.get('max_power', 82.0)),
        'seats'        : float(features.get('seats', 5.0)),
        'torque_clean' : float(features.get('torque_clean', 113.0)),
        'rpm_min'      : float(features.get('rpm_min', 4200.0)),
        'rpm_max'      : float(features.get('rpm_max', 5200.0)),
    }
    df = pd.DataFrame([row])
    df['car_age']         = CURRENT_YEAR - df['year']
    df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
    df['power_to_engine'] = df['max_power'] / df['engine']
except Exception as e:
    fail(f"Gagal menyiapkan input: {e}")

try:
    raw = model.predict(df)[0]
    # Model dilatih dengan y = log1p(selling_price), balik dengan expm1
    pred_inr = float(np.expm1(raw))
    print(json.dumps({
        "prediction": round(pred_inr, 2),
        "model_used": "Decision Tree Regressor",
        "currency"  : "INR"
    }))
except Exception as e:
    fail(f"Prediksi gagal: {e}")
