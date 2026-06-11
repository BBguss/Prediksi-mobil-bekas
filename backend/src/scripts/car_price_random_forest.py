# -*- coding: utf-8 -*-
"""car_price_random_forest.ipynb

Prediksi Harga Mobil Bekas menggunakan Random Forest Regressor
Dataset: car_details_v3.csv
"""

# =============================================
# CELL 1: Load Library
# =============================================

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib
import re

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score

# =============================================
# CELL 2: Load Dataset
# =============================================

df = pd.read_csv('/content/drive/MyDrive/Dataset Ilmu Data/car_details_v3.csv')

print("Ukuran dataset:", df.shape)
print("\n5 data pertama:")
df.head()

# =============================================
# CELL 3: Preprocessing / Data Cleaning
# =============================================

# Bersihkan kolom mileage
df['mileage'] = df['mileage'].str.replace('kmpl', '', regex=False)
df['mileage'] = df['mileage'].str.replace('km/kg', '', regex=False)
df['mileage'] = pd.to_numeric(df['mileage'], errors='coerce')

# Bersihkan kolom engine
df['engine'] = df['engine'].str.replace('CC', '', regex=False)
df['engine'] = pd.to_numeric(df['engine'], errors='coerce')

# Bersihkan kolom max_power
df['max_power'] = df['max_power'].str.replace('bhp', '', regex=False)
df['max_power'] = pd.to_numeric(df['max_power'], errors='coerce')

# Bersihkan nama kolom (hapus spasi)
df.columns = df.columns.str.strip().str.lower()

print("Kolom setelah dibersihkan:", df.columns.tolist())
df.head()

# =============================================
# CELL 4: Ekstrak Torque & RPM
# =============================================

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

df[['torque_clean', 'rpm_min', 'rpm_max']] = df['torque'].apply(
    lambda x: pd.Series(extract_torque_rpm(x))
)

# Hapus kolom yang tidak dipakai
df = df.drop(columns=['torque', 'name'])

# Feature Engineering
df['car_age']         = 2026 - df['year']
df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
df['power_to_engine'] = df['max_power'] / df['engine']

print("Kolom sekarang:", df.columns.tolist())

# =============================================
# CELL 5: Handle Missing Value & Outlier
# =============================================

print("Missing value SEBELUM diisi:")
print(df.isnull().sum())

for col in df.select_dtypes(include='number').columns:
    df[col] = df[col].fillna(df[col].median())

print("\nMissing value SETELAH diisi:")
print(df.isnull().sum())

sebelum = len(df)

Q1 = df['selling_price'].quantile(0.25)
Q3 = df['selling_price'].quantile(0.75)
IQR = Q3 - Q1
batas_bawah = Q1 - 2.5 * IQR
batas_atas  = Q3 + 2.5 * IQR

df = df[(df['selling_price'] >= batas_bawah) & (df['selling_price'] <= batas_atas)]

sesudah = len(df)
print(f"\nData sebelum: {sebelum} baris")
print(f"Data sesudah hapus outlier: {sesudah} baris")
print(f"Outlier yang dihapus: {sebelum - sesudah} baris")

# =============================================
# CELL 6: Feature & Label
# =============================================

X = df.drop('selling_price', axis=1)
y = np.log1p(df['selling_price'])  # Log transform agar distribusi lebih normal

print("Bentuk X:", X.shape)
print("Bentuk y:", y.shape)

plt.figure(figsize=(10, 4))

plt.subplot(1, 2, 1)
plt.hist(df['selling_price'], bins=50, color='salmon')
plt.title('Distribusi Harga Asli')
plt.xlabel('Harga')

plt.subplot(1, 2, 2)
plt.hist(y, bins=50, color='skyblue')
plt.title('Distribusi Harga (Log Transform)')
plt.xlabel('Log Harga')

plt.tight_layout()
plt.show()

# =============================================
# CELL 7: Split Data Training (70%) dan Testing (30%)
# =============================================

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=15
)

print("X_train:", X_train.shape)
print("X_test :", X_test.shape)
print("y_train:", y_train.shape)
print("y_test :", y_test.shape)

# =============================================
# CELL 8: Pipeline Preprocessing & Model
# =============================================

numeric_features     = X_train.select_dtypes(include=['int64', 'float64']).columns.tolist()
categorical_features = X_train.select_dtypes(include=['object']).columns.tolist()

print("Fitur numerik  :", numeric_features)
print("Fitur kategori :", categorical_features)

# Pipeline untuk fitur numerik
numeric_pipeline = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', RobustScaler())
])

# Pipeline untuk fitur kategori
categorical_pipeline = Pipeline([
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('onehot', OneHotEncoder(handle_unknown='ignore'))
])

preprocessor = ColumnTransformer([
    ('num', numeric_pipeline, numeric_features),
    ('cat', categorical_pipeline, categorical_features)
])

pipeline_rf = Pipeline([
    ('preprocessor', preprocessor),
    ('model', RandomForestRegressor(random_state=42))
])

# =============================================
# CELL 9: Hyperparameter Tuning dengan GridSearchCV
# =============================================

param_grid = {
    'model__n_estimators'     : [100, 200, 300],       # jumlah pohon
    'model__max_depth'        : [None, 10, 20, 30],    # kedalaman maksimum pohon
    'model__min_samples_split': [2, 5, 10],            # minimum sampel untuk split
    'model__min_samples_leaf' : [1, 2, 4],             # minimum sampel di daun
}

grid_rf = GridSearchCV(
    pipeline_rf,
    param_grid,
    cv=5,           # 5-fold cross validation
    scoring='r2',
    verbose=1,
    n_jobs=-1       # pakai semua CPU agar lebih cepat
)

grid_rf.fit(X_train, y_train)

print("Best Params:", grid_rf.best_params_)
print("Best R2 (CV):", round(grid_rf.best_score_, 4))

# =============================================
# CELL 10: Evaluasi Model
# =============================================

y_pred = grid_rf.predict(X_test)

r2   = r2_score(y_test, y_pred)
mse  = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)

print("=" * 40)
print(f"R2 Score : {r2:.4f}")
print(f"MSE      : {mse:.4f}")
print(f"RMSE     : {rmse:.4f}")
print("=" * 40)

# Visualisasi Actual vs Predicted
plt.figure(figsize=(7, 5))
plt.scatter(y_test, y_pred, alpha=0.4, color='steelblue', label='Prediksi')
plt.plot([y_test.min(), y_test.max()],
         [y_test.min(), y_test.max()],
         color='red', linewidth=2, label='Ideal')
plt.xlabel("Harga Aktual (Log)")
plt.ylabel("Harga Prediksi (Log)")
plt.title(f"Actual vs Predicted  |  R² = {r2:.4f}")
plt.legend()
plt.tight_layout()
plt.show()

# =============================================
# CELL 11: Feature Importance
# (Bonus — tidak ada di versi KNN karena KNN tidak punya feature importance)
# =============================================

best_rf    = grid_rf.best_estimator_
rf_model   = best_rf.named_steps['model']
preprocessor_fitted = best_rf.named_steps['preprocessor']

# Ambil nama fitur setelah encoding
ohe_features  = preprocessor_fitted.named_transformers_['cat']['onehot'].get_feature_names_out(categorical_features).tolist()
all_features   = numeric_features + ohe_features

importances = rf_model.feature_importances_
indices     = np.argsort(importances)[::-1]

# Tampilkan top 15 fitur paling penting
top_n = 15
plt.figure(figsize=(10, 6))
plt.title(f"Top {top_n} Feature Importances - Random Forest")
plt.bar(range(top_n), importances[indices[:top_n]], color='steelblue')
plt.xticks(range(top_n), [all_features[i] for i in indices[:top_n]], rotation=45, ha='right')
plt.tight_layout()
plt.show()

print("\nTop 10 fitur terpenting:")
for i in range(10):
    print(f"  {i+1:2}. {all_features[indices[i]]:<30} {importances[indices[i]]:.4f}")

# =============================================
# CELL 12: Test Prediksi 1 Mobil
# =============================================

mobil = {
    'year'         : 2026,
    'km_driven'    : 80000,
    'fuel'         : 'Diesel',
    'seller_type'  : 'Individual',
    'transmission' : 'Automatic',
    'owner'        : 'Third Owner',
    'mileage'      : 1.0,
    'engine'       : 1500,
    'max_power'    : 100.0,
    'torque_clean' : 250.0,
    'rpm_min'      : 1750,
    'rpm_max'      : 5000,
    'seats'        : 2,
}

df_test = pd.DataFrame([mobil])

# Fitur turunan (wajib sama seperti training!)
df_test['car_age']         = 2026 - df_test['year']
df_test['km_per_year']     = df_test['km_driven'] / (df_test['car_age'] + 1)
df_test['power_to_engine'] = df_test['max_power'] / df_test['engine']

y_pred_log = grid_rf.predict(df_test)
y_pred_inr = np.expm1(y_pred_log)[0]
y_pred_idr = y_pred_inr * 190  # kurs 1 INR = Rp 190

print("=" * 45)
print("   🚗 HASIL PREDIKSI HARGA MOBIL")
print("=" * 45)
print(f"  Tahun        : {mobil['year']}")
print(f"  KM Tempuh    : {mobil['km_driven']:,} km")
print(f"  Bahan Bakar  : {mobil['fuel']}")
print(f"  Transmisi    : {mobil['transmission']}")
print(f"  Mesin        : {mobil['engine']} CC")
print(f"  Tenaga       : {mobil['max_power']} bhp")
print(f"  Pemilik      : {mobil['owner']}")
print("-" * 45)
print(f"  💰 Prediksi  : Rp {int(y_pred_idr):,}")
print("=" * 45)

# =============================================
# CELL 13: Simpan Model
# =============================================

joblib.dump(
    grid_rf.best_estimator_,
    '/content/drive/MyDrive/Dataset Ilmu Data/car_price_rf_model.sav'
)

print("✅ Model Random Forest berhasil disimpan!")
