/**
 * Persistent storage untuk feedback data (harga aktual dari user).
 * Opsi C (Hybrid): simpan semua input user. Jika user isi harga aktual → pakai itu.
 * Jika tidak → pakai prediksi sebagai fallback.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'feedback_data.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readFeedback() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function writeFeedback(data) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Tambah feedback entry.
 * @param {object} entry - { features, actual_price?, predicted_price, model_id, currency, source }
 */
export function addFeedback(entry) {
  const data = readFeedback();
  const newEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    features: entry.features,
    actual_price: entry.actual_price || null,
    predicted_price: entry.predicted_price || null,
    model_id: entry.model_id || null,
    currency: entry.currency || 'INR',
    source: entry.source || 'prediction', // 'prediction' | 'csv_upload'
    has_label: Boolean(entry.actual_price),
  };
  data.push(newEntry);
  writeFeedback(data);
  return newEntry;
}

/**
 * Get all feedback data.
 */
export function getAllFeedback() {
  return readFeedback();
}

/**
 * Get feedback stats.
 */
export function getFeedbackStats() {
  const data = readFeedback();
  const withLabel = data.filter((d) => d.has_label);
  const withoutLabel = data.filter((d) => !d.has_label);
  const byCurrency = {};
  data.forEach((d) => {
    const c = d.currency || 'INR';
    byCurrency[c] = (byCurrency[c] || 0) + 1;
  });
  return {
    total: data.length,
    with_actual_price: withLabel.length,
    prediction_only: withoutLabel.length,
    by_currency: byCurrency,
  };
}

/**
 * Get training-ready data (features + selling_price).
 *
 * @param {object} [options]
 * @param {string} [options.currency]     - Filter: only include feedback in this currency.
 * @param {boolean} [options.strictLabel] - If true, skip entries without actual_price.
 */
export function getTrainingData(options = {}) {
  const { currency, strictLabel = false } = options;
  const data = readFeedback();
  return data
    .filter((d) => {
      if (!d.features) return false;
      if (strictLabel && !d.actual_price) return false;
      if (!strictLabel && !d.actual_price && !d.predicted_price) return false;
      if (currency && (d.currency || 'INR') !== currency) return false;
      return true;
    })
    .map((d) => ({
      ...d.features,
      selling_price: d.actual_price || d.predicted_price,
    }));
}

/**
 * Clear all feedback data.
 */
export function clearFeedback() {
  writeFeedback([]);
}
