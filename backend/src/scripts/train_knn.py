"""
Script untuk melatih KNN Regressor dan menyimpan model ke .sav
Pipeline baru: RobustScaler + log1p target + fitur turunan (car_age, km_per_year, power_to_engine)
"""

import os
import sys
import re
import numpy as np
import pandas as pd
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..', '..')
CSV_PATH = os.path.join(PROJECT_ROOT, 'Car details v3 (1).csv')
MODEL_OUT = os.path.join(SCRIPT_DIR, '..', 'models', 'car_price_knn_model.sav')


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


print(f"[train_knn] Loading dataset dari: {CSV_PATH}")
if not os.path.exists(CSV_PATH):
    print(f"[train_knn] ERROR: Dataset tidak ditemukan di {CSV_PATH}")
    sys.exit(1)

df = pd.read_csv(CSV_PATH)
print(f"[train_knn] Dataset loaded: {len(df)} baris")

# ── Cleaning kolom unit ──────────────────────────────────────────────────────
df.columns = df.columns.str.strip().str.lower()

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

# ── Extract Torque & RPM ────────────────────────────────────────────────────
df[['torque_clean', 'rpm_min', 'rpm_max']] = df['torque'].apply(
    lambda x: pd.Series(extract_torque_rpm(x))
)

# Drop unused columns
df = df.drop(columns=['name', 'torque'], errors='ignore')

# ── Isi missing value numerik dengan median ─────────────────────────────────
for col in df.select_dtypes(include='number').columns:
    df[col] = df[col].fillna(df[col].median())

# ── Hapus outlier dengan IQR 2.5x ──────────────────────────────────────────
q1 = df['selling_price'].quantile(0.25)
q3 = df['selling_price'].quantile(0.75)
iqr = q3 - q1
df = df[
    (df['selling_price'] >= q1 - 2.5 * iqr)
    & (df['selling_price'] <= q3 + 2.5 * iqr)
]
print(f"[train_knn] Setelah outlier removal: {len(df)} baris")

# ── Fitur turunan ───────────────────────────────────────────────────────────
from datetime import datetime
CURRENT_YEAR = datetime.now().year
df['car_age'] = CURRENT_YEAR - df['year']
df['km_per_year'] = df['km_driven'] / (df['car_age'] + 1)
df['power_to_engine'] = df['max_power'] / df['engine']

# ── Feature & Label ─────────────────────────────────────────────────────────
feature_cols = [col for col in df.columns if col != 'selling_price']
X = df[feature_cols]
y = np.log1p(df['selling_price'])  # Log transform target

print(f"[train_knn] Features: {len(feature_cols)} kolom")
print(f"[train_knn] Feature list: {feature_cols}")

# ── Train/Test Split ────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=15
)
print(f"[train_knn] Train: {len(X_train)}, Test: {len(X_test)}")

# ── Preprocessing Pipeline ──────────────────────────────────────────────────
numeric_features = X_train.select_dtypes(include=['int64', 'float64']).columns.tolist()
categorical_features = X_train.select_dtypes(include=['object']).columns.tolist()

print(f"[train_knn] Numeric features ({len(numeric_features)}): {numeric_features}")
print(f"[train_knn] Categorical features ({len(categorical_features)}): {categorical_features}")

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

# ── Model KNN ───────────────────────────────────────────────────────────────
model = KNeighborsRegressor(
    n_neighbors=5,
    weights='distance',
    p=1
)

pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('model', model),
])

# ── Training ────────────────────────────────────────────────────────────────
print("[train_knn] Training model...")
pipeline.fit(X_train, y_train)

# ── Evaluasi ────────────────────────────────────────────────────────────────
y_pred_train = pipeline.predict(X_train)
y_pred_test = pipeline.predict(X_test)

r2_train = r2_score(y_train, y_pred_train)
r2_test = r2_score(y_test, y_pred_test)
rmse_train = np.sqrt(mean_squared_error(y_train, y_pred_train))
rmse_test = np.sqrt(mean_squared_error(y_test, y_pred_test))

print(f"\n[train_knn] === Hasil Evaluasi (log-space) ===")
print(f"  R² Train: {r2_train:.4f}")
print(f"  R² Test:  {r2_test:.4f}")
print(f"  RMSE Train: {rmse_train:.4f}")
print(f"  RMSE Test:  {rmse_test:.4f}")

# Evaluasi di skala asli (INR)
y_test_real = np.expm1(y_test)
y_pred_real = np.expm1(y_pred_test)
r2_real = r2_score(y_test_real, y_pred_real)
rmse_real = np.sqrt(mean_squared_error(y_test_real, y_pred_real))

print(f"\n[train_knn] === Hasil Evaluasi (skala asli INR) ===")
print(f"  R² Test:  {r2_real:.4f}")
print(f"  RMSE Test: {rmse_real:.2f} INR")

# ── Simpan Model ────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
joblib.dump(pipeline, MODEL_OUT)
print(f"\n✅ Model KNN berhasil disimpan ke: {MODEL_OUT}")
print(f"   File size: {os.path.getsize(MODEL_OUT) / 1024:.1f} KB")
