"""
Script untuk melatih Random Forest Regressor dan menyimpan model ke .sav
Menggunakan alur baru dari car_price_random_forest.py (Log Transform + Advanced FE)
"""

import os
import sys
import pandas as pd
import numpy as np
import joblib
import re
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..', '..')
CSV_PATH = os.path.join(PROJECT_ROOT, 'Car details v3 (1).csv')
MODEL_OUT = os.path.join(SCRIPT_DIR, '..', 'models', 'car_price_rf_model.sav')

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

print(f"[train_rf] Loading dataset dari: {CSV_PATH}")
df = pd.read_csv(CSV_PATH)

# Preprocessing / Cleaning
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

# Drop unused columns
df = df.drop(columns=['torque', 'name'], errors='ignore')

# Feature Engineering
from datetime import datetime
CURRENT_YEAR = datetime.now().year
df['car_age']         = CURRENT_YEAR - df['year']
df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
df['power_to_engine'] = df['max_power'] / df['engine']

# Handle Missing Value (Median for numeric)
for col in df.select_dtypes(include='number').columns:
    df[col] = df[col].fillna(df[col].median())

# Outlier Removal (2.5 * IQR as per new script)
Q1 = df['selling_price'].quantile(0.25)
Q3 = df['selling_price'].quantile(0.75)
IQR = Q3 - Q1
batas_bawah = Q1 - 2.5 * IQR
batas_atas  = Q3 + 2.5 * IQR
df = df[(df['selling_price'] >= batas_bawah) & (df['selling_price'] <= batas_atas)]

# Feature & Label
X = df.drop('selling_price', axis=1)
y = np.log1p(df['selling_price']) # Log transform

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=15
)

numeric_features     = X_train.select_dtypes(include=['int64', 'float64']).columns.tolist()
categorical_features = X_train.select_dtypes(include=['object']).columns.tolist()

# Pipeline
numeric_pipeline = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', RobustScaler())
])

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

param_grid = {
    'model__n_estimators'     : [100, 200, 300],
    'model__max_depth'        : [None, 10, 20],
    'model__min_samples_split': [2, 5],
    'model__min_samples_leaf' : [1, 2],
}

print("[train_rf] Memulai GridSearchCV...")
grid_rf = GridSearchCV(pipeline_rf, param_grid, cv=5, scoring='r2', verbose=1, n_jobs=-1)
grid_rf.fit(X_train, y_train)

print(f"[train_rf] Best Params: {grid_rf.best_params_}")
print(f"[train_rf] Best R2 (CV): {grid_rf.best_score_:.4f}")

# Simpan Model
joblib.dump(grid_rf.best_estimator_, MODEL_OUT)
print(f"✅ Model disimpan ke: {MODEL_OUT}")
