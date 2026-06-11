"""Provide dataset preview and metadata for frontend dataset info page."""

import json
import math
import os
import sys

import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..', '..')
DEFAULT_CSV_PATH = os.path.join(PROJECT_ROOT, 'Car details v3 (1).csv')


def fail(message):
    print(json.dumps({'error': message}))
    sys.exit(1)


def clamp_int(value, default, min_value, max_value):
    try:
        parsed = int(value)
    except Exception:
        parsed = default
    return max(min_value, min(max_value, parsed))


try:
    payload = json.loads(sys.stdin.read() or '{}')
except Exception as exc:
    fail(f'Gagal membaca input: {exc}')

page = clamp_int(payload.get('page', 1), 1, 1, 100000)
limit = clamp_int(payload.get('limit', 20), 20, 5, 100)

CSV_PATH = payload.get('dataset_path') or DEFAULT_CSV_PATH
if not os.path.exists(CSV_PATH):
    fail(f'Dataset tidak ditemukan di: {CSV_PATH}')

try:
    df = pd.read_csv(CSV_PATH)
except Exception as exc:
    fail(f'Gagal membaca dataset: {exc}')

if df.empty:
    fail('Dataset kosong.')

df.columns = [str(c).strip() for c in df.columns]

total_rows = int(len(df))
total_pages = int(max(1, math.ceil(total_rows / limit)))
page = min(page, total_pages)
start = (page - 1) * limit
end = start + limit

page_df = df.iloc[start:end].copy()
page_df = page_df.replace({np.nan: None})

label_column = 'selling_price' if 'selling_price' in df.columns else None
feature_columns = [c for c in df.columns if c != label_column]

column_descriptions = {
    'name': 'Nama/model kendaraan.',
    'year': 'Tahun kendaraan diproduksi.',
    'selling_price': 'Harga jual kendaraan (label target prediksi).',
    'km_driven': 'Total jarak tempuh kendaraan (kilometer).',
    'fuel': 'Jenis bahan bakar kendaraan.',
    'seller_type': 'Tipe penjual (individu/dealer).',
    'transmission': 'Jenis transmisi kendaraan.',
    'owner': 'Riwayat kepemilikan kendaraan.',
    'mileage': 'Efisiensi bahan bakar (kmpl atau km/kg).',
    'engine': 'Kapasitas mesin (cc).',
    'max_power': 'Daya maksimum mesin (bhp).',
    'torque': 'Torsi mesin dari spesifikasi kendaraan.',
    'seats': 'Jumlah kursi.',
}

columns_meta = [
    {
        'name': col,
        'is_label': bool(label_column and col == label_column),
        'description': column_descriptions.get(col.lower(), 'Kolom fitur dari dataset kendaraan.'),
    }
    for col in df.columns
]

print(json.dumps({
    'dataset_name': payload.get('dataset_name') or os.path.basename(CSV_PATH),
    'total_rows': total_rows,
    'page': page,
    'limit': limit,
    'total_pages': total_pages,
    'label_column': label_column,
    'feature_columns': feature_columns,
    'columns': columns_meta,
    'rows': page_df.to_dict(orient='records'),
}))
