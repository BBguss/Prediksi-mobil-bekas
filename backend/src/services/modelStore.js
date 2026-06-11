/**
 * Persistent storage untuk custom models menggunakan file JSON.
 * File disimpan di backend/src/data/custom_models.json
 *
 * Semua model builtin menggunakan pipeline identik:
 *   RobustScaler + log1p(selling_price) + torque/rpm + fitur turunan + IQR 2.5x
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR  = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'custom_models.json');

const ALL_FEATURES = [
  'year','km_driven','mileage','engine','max_power','seats',
  'fuel','seller_type','transmission','owner',
  'torque_clean','rpm_min','rpm_max',
  'car_age','km_per_year','power_to_engine',
];

const BUILTIN_MODELS = [
  {
    id: 'knn',
    name: 'KNN Regressor',
    algorithm: 'K-Nearest Neighbors',
    description: 'Memprediksi harga mobil berdasarkan kemiripan fitur dengan data training. Menggunakan RobustScaler dan log-transform harga untuk akurasi optimal.',
    pros: ['Mudah dipahami', 'Tidak ada asumsi distribusi data', 'Mampu memodelkan hubungan non-linear'],
    cons: ['Komputasi mahal untuk dataset besar', 'Sensitif terhadap fitur tidak relevan', 'Membutuhkan penyimpanan seluruh dataset'],
    hyperparameters: { n_neighbors: 5, weights: 'distance', p: 1 },
    metrics: null,
    features_used: ALL_FEATURES,
    builtin: true,
  },
  {
    id: 'dt',
    name: 'Decision Tree Regressor',
    algorithm: 'Decision Tree',
    description: 'Memprediksi harga mobil lewat aturan if-else yang dipelajari dari data. Mudah diinterpretasikan dan efisien secara komputasi.',
    pros: ['Sangat mudah diinterpretasikan', 'Perlu sedikit persiapan data', 'Menangani fitur numerik dan kategorikal'],
    cons: ['Rentan overfitting', 'Tidak stabil dengan variasi data kecil', 'Prediksi tidak halus (fungsi tangga)'],
    hyperparameters: { max_depth: 10, min_samples_split: 5, min_samples_leaf: 2 },
    metrics: null,
    features_used: ALL_FEATURES,
    builtin: true,
  },
  {
    id: 'rf',
    name: 'Random Forest Regressor',
    algorithm: 'Random Forest',
    description: 'Model ensemble dari ratusan Decision Tree yang dilatih secara paralel. Sangat robust terhadap overfitting dan biasanya menghasilkan akurasi tertinggi.',
    pros: ['Sangat tahan overfitting', 'Performa konsisten tanpa banyak tuning', 'Menangani fitur numerik dan kategorikal dengan baik'],
    cons: ['Lebih lambat saat training dibanding single tree', 'Sulit diinterpretasikan secara individual', 'Membutuhkan lebih banyak memori'],
    hyperparameters: { n_estimators: 300, max_depth: 20, min_samples_split: 5, min_samples_leaf: 2 },
    metrics: null,
    features_used: ALL_FEATURES,
    builtin: true,
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readCustomModels() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeCustomModels(models) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(models, null, 2), 'utf-8');
}

export function getAllModels() {
  return [...BUILTIN_MODELS, ...readCustomModels()];
}

export function getBuiltinModels() {
  return BUILTIN_MODELS;
}

export function getCustomModels() {
  return readCustomModels();
}

export function addCustomModel(model) {
  const custom = readCustomModels();
  const newModel = {
    ...model,
    id: model.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: model.createdAt || new Date().toISOString(),
    builtin: false,
  };
  const existingIdx = custom.findIndex((m) => m.id === newModel.id);
  if (existingIdx >= 0) custom[existingIdx] = newModel;
  else custom.push(newModel);
  writeCustomModels(custom);
  return newModel;
}

export function updateCustomModel(id, updates) {
  const custom = readCustomModels();
  const idx = custom.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  custom[idx] = { ...custom[idx], ...updates, id, updatedAt: new Date().toISOString() };
  writeCustomModels(custom);
  return custom[idx];
}

export function deleteCustomModel(id) {
  const custom = readCustomModels();
  const filtered = custom.filter((m) => m.id !== id);
  if (filtered.length === custom.length) return false;
  writeCustomModels(filtered);
  return true;
}
