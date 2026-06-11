"""
train_all_models.py — Latih ulang KNN, DT, dan RF dari awal dengan pipeline identik.

Pipeline standar (semua model pakai ini):
  - Features: year, km_driven, fuel, seller_type, transmission, owner,
               mileage, engine, max_power, seats, torque_clean, rpm_min, rpm_max
  - Derived : car_age, km_per_year, power_to_engine
  - Scaler  : RobustScaler (numerik), OneHotEncoder (kategori)
  - Target  : np.log1p(selling_price)  → prediksi pakai np.expm1()
  - Outlier : IQR 2.5x pada selling_price
  - Split   : 70/30, random_state=15

Jalankan dari root project:
    python backend/src/scripts/train_all_models.py

Atau latih satu model saja:
    python backend/src/scripts/train_all_models.py knn
    python backend/src/scripts/train_all_models.py dt
    python backend/src/scripts/train_all_models.py rf
"""

import os, sys, re, json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler
from sklearn.tree import DecisionTreeRegressor

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..', '..')
CSV_PATH     = os.path.join(PROJECT_ROOT, 'Car details v3 (1).csv')
MODELS_DIR   = os.path.join(SCRIPT_DIR, '..', 'models')
CURRENT_YEAR = datetime.now().year

os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_PATHS = {
    'knn': os.path.join(MODELS_DIR, 'car_price_knn_model.sav'),
    'dt' : os.path.join(MODELS_DIR, 'car_price_DT_model.sav'),
    'rf' : os.path.join(MODELS_DIR, 'car_price_rf_model.sav'),
}

# ── helpers ──────────────────────────────────────────────────────────────────

def extract_torque_rpm(x):
    try:
        text = str(x).lower().replace(',', '')
        nums = re.findall(r'\d+\.?\d*', text)
        if not nums:
            return np.nan, np.nan, np.nan
        torque = float(nums[0])
        if 'kgm' in text:
            torque *= 9.8
        rpm_min = float(nums[1]) if len(nums) >= 2 else np.nan
        rpm_max = float(nums[2]) if len(nums) >= 3 else rpm_min
        return torque, rpm_min, rpm_max
    except Exception:
        return np.nan, np.nan, np.nan


def load_and_preprocess():
    print(f"\n[data] Loading: {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print(f"[data] ERROR: Dataset tidak ditemukan di {CSV_PATH}")
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip().str.lower()
    print(f"[data] Loaded {len(df)} baris, {len(df.columns)} kolom")

    # Bersihkan unit
    df['mileage']   = pd.to_numeric(df['mileage'].astype(str).str.replace('kmpl','').str.replace('km/kg','').str.strip(), errors='coerce')
    df['engine']    = pd.to_numeric(df['engine'].astype(str).str.replace('cc','',flags=re.IGNORECASE).str.strip(), errors='coerce')
    df['max_power'] = pd.to_numeric(df['max_power'].astype(str).str.replace('bhp','').str.strip(), errors='coerce')
    df['selling_price'] = pd.to_numeric(df['selling_price'], errors='coerce')

    # Torque & RPM
    df[['torque_clean','rpm_min','rpm_max']] = df['torque'].apply(
        lambda x: pd.Series(extract_torque_rpm(x))
    )
    df = df.drop(columns=['name','torque'], errors='ignore')

    # Isi missing numerik dengan median
    for col in df.select_dtypes(include='number').columns:
        df[col] = df[col].fillna(df[col].median())

    # Outlier removal IQR 2.5x
    q1, q3 = df['selling_price'].quantile([0.25, 0.75])
    iqr = q3 - q1
    before = len(df)
    df = df[(df['selling_price'] >= q1 - 2.5*iqr) & (df['selling_price'] <= q3 + 2.5*iqr)]
    print(f"[data] Setelah outlier removal: {len(df)} baris (hapus {before - len(df)})")

    # Fitur turunan — pakai CURRENT_YEAR dinamis
    df['car_age']         = CURRENT_YEAR - df['year']
    df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
    df['power_to_engine'] = df['max_power'] / df['engine']

    X = df.drop('selling_price', axis=1)
    y = np.log1p(df['selling_price'])

    return X, y


def build_preprocessor(X_train):
    num_cols = X_train.select_dtypes(include=['int64','float64']).columns.tolist()
    cat_cols = X_train.select_dtypes(include=['object','category']).columns.tolist()
    print(f"[prep] Numerik ({len(num_cols)}): {num_cols}")
    print(f"[prep] Kategori ({len(cat_cols)}): {cat_cols}")

    return ColumnTransformer([
        ('num', Pipeline([
            ('imp', SimpleImputer(strategy='median')),
            ('sc',  RobustScaler()),
        ]), num_cols),
        ('cat', Pipeline([
            ('imp', SimpleImputer(strategy='most_frequent')),
            ('ohe', OneHotEncoder(handle_unknown='ignore')),
        ]), cat_cols),
    ]), num_cols, cat_cols


def evaluate(model, X_tr, y_tr, X_te, y_te, label):
    yp_tr = model.predict(X_tr)
    yp_te = model.predict(X_te)
    r2_tr  = r2_score(y_tr, yp_tr)
    r2_te  = r2_score(y_te, yp_te)
    rmse_tr = float(np.sqrt(mean_squared_error(y_tr, yp_tr)))
    rmse_te = float(np.sqrt(mean_squared_error(y_te, yp_te)))

    # Skala asli
    r2_real  = r2_score(np.expm1(y_te), np.expm1(yp_te))
    rmse_real = float(np.sqrt(mean_squared_error(np.expm1(y_te), np.expm1(yp_te))))

    print(f"\n[{label}] === Evaluasi (log-space) ===")
    print(f"  R²  Train: {r2_tr:.4f}  |  Test: {r2_te:.4f}")
    print(f"  RMSE Train: {rmse_tr:.4f}  |  Test: {rmse_te:.4f}")
    print(f"[{label}] === Evaluasi (skala asli INR) ===")
    print(f"  R²  Test : {r2_real:.4f}")
    print(f"  RMSE Test: {rmse_real:,.0f} INR")
    return {'r2_train': r2_tr, 'r2_test': r2_te, 'rmse_train': rmse_tr, 'rmse_test': rmse_te, 'r2_real': r2_real}


# ── KNN ───────────────────────────────────────────────────────────────────────

def train_knn(X_tr, y_tr, X_te, y_te, prep):
    print("\n" + "="*50)
    print("[KNN] Mulai training...")
    pipeline = Pipeline([('preprocessor', prep), ('model', KNeighborsRegressor(
        n_neighbors=5, weights='distance', p=1
    ))])
    pipeline.fit(X_tr, y_tr)
    metrics = evaluate(pipeline, X_tr, y_tr, X_te, y_te, 'KNN')
    path = MODEL_PATHS['knn']
    joblib.dump(pipeline, path)
    print(f"[KNN] ✅ Disimpan ke: {path}  ({os.path.getsize(path)/1024:.1f} KB)")
    return metrics


# ── DT ────────────────────────────────────────────────────────────────────────

def train_dt(X_tr, y_tr, X_te, y_te, prep):
    print("\n" + "="*50)
    print("[DT] Mulai training...")
    pipeline = Pipeline([('preprocessor', prep), ('model', DecisionTreeRegressor(
        max_depth=10, min_samples_split=5, min_samples_leaf=2,
        criterion='friedman_mse', random_state=15
    ))])
    pipeline.fit(X_tr, y_tr)
    metrics = evaluate(pipeline, X_tr, y_tr, X_te, y_te, 'DT')
    path = MODEL_PATHS['dt']
    joblib.dump(pipeline, path)
    print(f"[DT]  ✅ Disimpan ke: {path}  ({os.path.getsize(path)/1024:.1f} KB)")
    return metrics


# ── RF ────────────────────────────────────────────────────────────────────────

def train_rf(X_tr, y_tr, X_te, y_te, prep):
    print("\n" + "="*50)
    print("[RF] Mulai training (ini butuh ~2-5 menit)...")
    pipeline = Pipeline([('preprocessor', prep), ('model', RandomForestRegressor(
        n_estimators=300, max_depth=20, min_samples_split=5,
        min_samples_leaf=2, random_state=15, n_jobs=-1
    ))])
    pipeline.fit(X_tr, y_tr)
    metrics = evaluate(pipeline, X_tr, y_tr, X_te, y_te, 'RF')
    path = MODEL_PATHS['rf']
    joblib.dump(pipeline, path)
    print(f"[RF]  ✅ Disimpan ke: {path}  ({os.path.getsize(path)/1024:.1f} KB)")
    return metrics


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else ['knn', 'dt', 'rf']
    targets = [t.lower() for t in targets if t.lower() in ('knn', 'dt', 'rf')]
    if not targets:
        print("Usage: python train_all_models.py [knn] [dt] [rf]")
        sys.exit(1)

    print(f"\n{'='*50}")
    print(f"TRAIN: {targets}")
    print(f"CURRENT_YEAR used for car_age: {CURRENT_YEAR}")
    print(f"{'='*50}")

    X, y = load_and_preprocess()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, random_state=15)
    print(f"\n[split] Train: {len(X_tr)}  Test: {len(X_te)}")

    # Preprocessor difit dari training set — sama untuk semua model
    prep, num_cols, cat_cols = build_preprocessor(X_tr)

    results = {}
    if 'knn' in targets:
        results['knn'] = train_knn(X_tr, y_tr, X_te, y_te, prep)
    if 'dt'  in targets:
        results['dt']  = train_dt (X_tr, y_tr, X_te, y_te, prep)
    if 'rf'  in targets:
        results['rf']  = train_rf (X_tr, y_tr, X_te, y_te, prep)

    print("\n" + "="*50)
    print("RINGKASAN HASIL")
    print("="*50)
    for algo, m in results.items():
        print(f"  {algo.upper():3s}  R²-test={m['r2_test']:.4f}  RMSE-test={m['rmse_test']:.4f}  R²-real={m['r2_real']:.4f}")

    # Simpan metadata training
    meta_path = os.path.join(MODELS_DIR, 'training_meta.json')
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
    for algo, m in results.items():
        meta[algo] = {
            'trained_at': datetime.now().isoformat(),
            'current_year_used': CURRENT_YEAR,
            'metrics': m,
        }
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f"\n[meta] Metadata disimpan ke: {meta_path}")
    print("\n✅ SELESAI")

if __name__ == '__main__':
    main()
