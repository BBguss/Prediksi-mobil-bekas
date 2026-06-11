"""
evaluate_model.py — Evaluasi KNN / DT / RF dengan dataset asli.
Pipeline identik dengan train_all_models.py:
  RobustScaler + log1p + torque/rpm + fitur turunan + IQR 2.5x
Input  : JSON via stdin
Output : JSON via stdout
"""
import json, os, re, sys, warnings
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.tree import DecisionTreeRegressor

warnings.filterwarnings('ignore')

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..', '..')
DEFAULT_CSV  = os.path.join(PROJECT_ROOT, 'Car details v3 (1).csv')
CURRENT_YEAR = datetime.now().year

try:
    from dataset_helper import get_active_dataset_path, get_active_currency
    CSV_PATH       = get_active_dataset_path()
    ACTIVE_CURRENCY = get_active_currency()
except Exception:
    CSV_PATH       = DEFAULT_CSV
    ACTIVE_CURRENCY = 'INR'


def fail(msg):
    print(json.dumps({'error': msg}))
    sys.exit(1)


def clamp_int(v, default, lo, hi):
    try: return max(lo, min(hi, int(v)))
    except Exception: return default


def clamp_float(v, default, lo, hi):
    try: return max(lo, min(hi, float(v)))
    except Exception: return default


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


def normalize_algorithm(v):
    text = str(v or '').strip().lower()
    mapping = {
        'knn':'knn','k-nearest neighbors':'knn','k nearest neighbors':'knn',
        'dt':'dt','decision tree':'dt','decision-tree':'dt',
        'rf':'rf','random forest':'rf','random-forest':'rf','randomforest':'rf',
    }
    return mapping.get(text, text)


# ── Parse input ───────────────────────────────────────────────────────────────
try:
    raw = sys.stdin.read() or '{}'
    payload = json.loads(raw)
except Exception as e:
    fail(f'Gagal membaca input: {e}')

algorithm = normalize_algorithm(
    payload.get('algorithm') or payload.get('model') or 'knn'
)
if algorithm not in ['knn', 'dt', 'rf']:
    fail(f'Algoritma tidak valid: {algorithm}. Gunakan knn, dt, atau rf.')

hp          = payload.get('hyperparameters', payload.get('hyperparams', {})) or {}
test_size   = clamp_float(payload.get('test_size', 0.3), 0.3, 0.1, 0.5)
random_state = clamp_int(payload.get('random_state', 15), 15, 0, 100000)
CSV_PATH    = payload.get('dataset_path') or CSV_PATH

if not os.path.exists(CSV_PATH):
    fail(f'Dataset tidak ditemukan: {CSV_PATH}')

# ── Load & preprocess ─────────────────────────────────────────────────────────
try:
    df = pd.read_csv(CSV_PATH)
except Exception as e:
    fail(f'Gagal membaca dataset: {e}')

raw_total_rows = int(len(df))
df.columns = df.columns.str.strip().str.lower()

required = ['selling_price','year','km_driven','fuel','seller_type',
            'transmission','owner','mileage','engine','max_power','seats','torque']
missing  = [c for c in required if c not in df.columns]
if missing:
    fail(f'Kolom dataset tidak lengkap: {missing}')

df['mileage']   = pd.to_numeric(df['mileage'].astype(str).str.replace('kmpl','').str.replace('km/kg','').str.strip(), errors='coerce')
df['engine']    = pd.to_numeric(df['engine'].astype(str).str.replace('cc','',flags=re.IGNORECASE).str.strip(), errors='coerce')
df['max_power'] = pd.to_numeric(df['max_power'].astype(str).str.replace('bhp','').str.strip(), errors='coerce')
df['selling_price'] = pd.to_numeric(df['selling_price'], errors='coerce')

df[['torque_clean','rpm_min','rpm_max']] = df['torque'].apply(
    lambda x: pd.Series(extract_torque_rpm(x))
)
df = df.drop(columns=['name','torque'], errors='ignore')

# Isi missing numerik dengan median
for col in df.select_dtypes(include='number').columns:
    df[col] = df[col].fillna(df[col].median())

# Outlier IQR 2.5x — sama untuk semua model
q1, q3 = df['selling_price'].quantile([0.25, 0.75])
iqr = q3 - q1
df = df[(df['selling_price'] >= q1-2.5*iqr) & (df['selling_price'] <= q3+2.5*iqr)]

# Fitur turunan — dinamis pakai CURRENT_YEAR
df['car_age']         = CURRENT_YEAR - df['year']
df['km_per_year']     = df['km_driven'] / (df['car_age'] + 1)
df['power_to_engine'] = df['max_power'] / df['engine']

if len(df) < 50:
    fail('Data terlalu sedikit setelah preprocessing (< 50 baris).')

X = df.drop('selling_price', axis=1)
y = np.log1p(df['selling_price'])  # log1p untuk semua model

# ── Split ─────────────────────────────────────────────────────────────────────
try:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state
    )
except Exception as e:
    fail(f'Gagal split train-test: {e}')

# ── Preprocessor — identik untuk semua model ──────────────────────────────────
num_cols = X_train.select_dtypes(include=['int64','float64']).columns.tolist()
cat_cols = X_train.select_dtypes(include=['object']).columns.tolist()

preprocessor = ColumnTransformer([
    ('num', Pipeline([
        ('imp', SimpleImputer(strategy='median')),
        ('sc',  RobustScaler()),
    ]), num_cols),
    ('cat', Pipeline([
        ('imp', SimpleImputer(strategy='most_frequent')),
        ('ohe', OneHotEncoder(handle_unknown='ignore')),
    ]), cat_cols),
])

# ── Build model ───────────────────────────────────────────────────────────────
try:
    if algorithm == 'knn':
        estimator = KNeighborsRegressor(
            n_neighbors = clamp_int(hp.get('n_neighbors', 5), 5, 1, 100),
            weights     = hp.get('weights','distance') if hp.get('weights','distance') in ['uniform','distance'] else 'distance',
            p           = clamp_int(hp.get('p', 1), 1, 1, 2),
        )
    elif algorithm == 'dt':
        estimator = DecisionTreeRegressor(
            max_depth        = clamp_int(hp.get('max_depth', 10), 10, 1, 100),
            min_samples_split= clamp_int(hp.get('min_samples_split', 5), 5, 2, 200),
            min_samples_leaf = clamp_int(hp.get('min_samples_leaf', 2), 2, 1, 100),
            criterion        = 'friedman_mse',
            random_state     = random_state,
        )
    else:
        raw_depth = hp.get('max_depth', None)
        max_depth = None if raw_depth in [None, 'None', 'none', '', 0, '0'] else clamp_int(raw_depth, 20, 1, 100)
        estimator = RandomForestRegressor(
            n_estimators     = clamp_int(hp.get('n_estimators', 300), 300, 50, 1000),
            max_depth        = max_depth,
            min_samples_split= clamp_int(hp.get('min_samples_split', 5), 5, 2, 200),
            min_samples_leaf = clamp_int(hp.get('min_samples_leaf', 2), 2, 1, 100),
            random_state     = random_state,
            n_jobs           = -1,
        )
except Exception as e:
    fail(f'Gagal membuat model: {e}')

pipeline = Pipeline([('preprocessor', preprocessor), ('model', estimator)])

# ── Train & predict ───────────────────────────────────────────────────────────
try:
    pipeline.fit(X_train, y_train)
    y_pred_train = pipeline.predict(X_train)
    y_pred_test  = pipeline.predict(X_test)
except Exception as e:
    fail(f'Gagal training/prediksi: {e}')

# Semua model pakai log1p → expm1 untuk prediction_curve display
y_test_display      = np.expm1(np.array(y_test, dtype=float))
y_pred_test_display = np.expm1(np.array(y_pred_test, dtype=float))

# ── Prediction curve ──────────────────────────────────────────────────────────
try:
    plot_limit  = clamp_int(payload.get('plot_limit', 60), 60, 20, 200)
    plot_count  = min(plot_limit, len(y_test_display))
    prediction_curve = [
        {'index': int(i), 'real': round(float(y_test_display[i]),2), 'prediction': round(float(y_pred_test_display[i]),2)}
        for i in range(plot_count)
    ]
except Exception:
    prediction_curve = []

# ── Metrics ───────────────────────────────────────────────────────────────────
r2_train   = float(r2_score(y_train, y_pred_train))
r2_test    = float(r2_score(y_test, y_pred_test))
mse_train  = float(mean_squared_error(y_train, y_pred_train))
mse_test   = float(mean_squared_error(y_test, y_pred_test))
rmse_train = float(np.sqrt(mse_train))
rmse_test  = float(np.sqrt(mse_test))

print(json.dumps({
    'train': {'r2': round(r2_train,4), 'mse': round(mse_train,4), 'rmse': round(rmse_train,4)},
    'test' : {'r2': round(r2_test,4),  'mse': round(mse_test,4),  'rmse': round(rmse_test,4)},
    'dataset_info': {
        'raw_rows'   : raw_total_rows,
        'total_rows' : int(len(df)),
        'train_rows' : int(len(X_train)),
        'test_rows'  : int(len(X_test)),
        'test_size'  : float(test_size),
        'random_state': int(random_state),
        'current_year': CURRENT_YEAR,
        'preprocessing': {
            'strategy'       : 'median_imputation + robustscaler',
            'outlier_filter' : 'iqr_2.5x_selling_price',
            'log_transform'  : True,
            'derived_features': ['car_age','km_per_year','power_to_engine'],
        },
    },
    'algorithm'       : algorithm,
    'hyperparameters' : hp,
    'prediction_curve': prediction_curve,
    'currency'        : ACTIVE_CURRENCY,
}))
