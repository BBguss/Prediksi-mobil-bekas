/**
 * Tracks the active dataset path.
 * Falls back to the original bundled CSV if no custom dataset has been uploaded.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR     = path.join(__dirname, '..', 'data');
const CONFIG_PATH  = path.join(DATA_DIR, 'dataset_config.json');
const UPLOADS_DIR  = path.join(DATA_DIR, 'uploads');
const DEFAULT_CSV  = path.join(__dirname, '..', '..', '..', 'Car details v3 (1).csv');

// Required columns for any uploaded dataset
export const REQUIRED_COLUMNS = [
  'year', 'selling_price', 'km_driven', 'fuel',
  'seller_type', 'transmission', 'owner',
  'mileage', 'engine', 'max_power', 'seats',
];
export const RECOMMENDED_COLUMNS = ['torque', 'name'];

function ensureDirs() {
  [DATA_DIR, UPLOADS_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) || {};
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  ensureDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

/**
 * Auto-detect currency from CSV based on selling_price range.
 * India (INR): typical range 50,000 – 9,000,000
 * Indonesia (IDR): typical range 50,000,000 – 3,000,000,000
 * Returns 'INR' | 'IDR' | 'UNKNOWN'
 */
function detectCurrency(csvContent) {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return 'UNKNOWN';

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const priceIdx = headers.indexOf('selling_price');
  if (priceIdx < 0) return 'UNKNOWN';

  // Sample up to 100 rows
  const samples = [];
  for (let i = 1; i < Math.min(lines.length, 101); i++) {
    const cols = lines[i].split(',');
    const val = parseFloat((cols[priceIdx] || '').replace(/"/g, '').trim());
    if (Number.isFinite(val) && val > 0) samples.push(val);
  }

  if (samples.length === 0) return 'UNKNOWN';

  const median = samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];

  // IDR median typically >= 50,000,000; INR median typically < 10,000,000
  if (median >= 10_000_000) return 'IDR';
  if (median >= 1000 && median < 10_000_000) return 'INR';
  return 'UNKNOWN';
}

/** Returns the active dataset currency ('INR' | 'IDR'). */
export function getActiveCurrency() {
  const cfg = readConfig();
  if (cfg.active_path && fs.existsSync(cfg.active_path) && cfg.price_currency) {
    return cfg.price_currency;
  }
  // Default dataset (India) = INR
  return 'INR';
}

/** Returns the absolute path to the currently active dataset CSV. */
export function getActivePath() {
  const cfg = readConfig();
  if (cfg.active_path && fs.existsSync(cfg.active_path)) {
    return cfg.active_path;
  }
  return DEFAULT_CSV;
}

/** Returns metadata about the active dataset. */
export function getActiveInfo() {
  const cfg = readConfig();
  const isCustom = !!(cfg.active_path && fs.existsSync(cfg.active_path));
  const activePath = isCustom ? cfg.active_path : DEFAULT_CSV;
  return {
    is_custom: isCustom,
    filename: isCustom ? (cfg.original_name || path.basename(activePath)) : 'Car details v3 (1).csv',
    uploaded_at: cfg.uploaded_at || null,
    active_path: activePath,
    default_path: DEFAULT_CSV,
    price_currency: getActiveCurrency(),
  };
}

/**
 * Save an uploaded CSV as the active dataset.
 * @param {string} csvContent - Raw CSV text
 * @param {string} originalName - Original file name from user
 * @param {string} [currency] - Explicit currency ('INR' | 'IDR'). If omitted, auto-detect.
 * @returns {{ ok: boolean, error?: string, warnings?: string[], info?: object }}
 */
export function setActiveDataset(csvContent, originalName, currency) {
  ensureDirs();

  // Parse headers from first line
  const firstLine = csvContent.split('\n')[0] || '';
  const headers = firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `CSV tidak valid. Kolom wajib yang hilang: ${missing.join(', ')}`,
    };
  }

  const warnings = RECOMMENDED_COLUMNS
    .filter((c) => !headers.includes(c))
    .map((c) => `Kolom "${c}" tidak ditemukan — beberapa fitur mungkin menggunakan nilai default.`);

  // Determine currency: user input > auto-detect > default INR
  let priceCurrency = (currency || '').toUpperCase();
  if (!['INR', 'IDR', 'USD'].includes(priceCurrency)) {
    const detected = detectCurrency(csvContent);
    if (detected !== 'UNKNOWN') {
      priceCurrency = detected;
      warnings.push(`Currency terdeteksi otomatis: ${detected}. Kamu bisa ganti via parameter "currency".`);
    } else {
      priceCurrency = 'INR';
      warnings.push('Currency tidak bisa dideteksi — defaulting ke INR. Sebaiknya kirim parameter "currency" secara eksplisit.');
    }
  }

  const filename = `dataset_${Date.now()}.csv`;
  const savePath = path.join(UPLOADS_DIR, filename);

  try {
    fs.writeFileSync(savePath, csvContent, 'utf-8');
  } catch (err) {
    return { ok: false, error: `Gagal menyimpan file: ${err.message}` };
  }

  const cfg = readConfig();

  // Remove old uploaded file if it exists and isn't the default
  if (cfg.active_path && cfg.active_path !== DEFAULT_CSV && fs.existsSync(cfg.active_path)) {
    try { fs.unlinkSync(cfg.active_path); } catch { /* ignore */ }
  }

  writeConfig({
    ...cfg,
    active_path: savePath,
    original_name: originalName || filename,
    uploaded_at: new Date().toISOString(),
    price_currency: priceCurrency,
  });

  // Count rows (lines minus header)
  const rowCount = csvContent.split('\n').filter((l) => l.trim()).length - 1;

  return {
    ok: true,
    warnings,
    info: {
      filename: originalName || filename,
      row_count: rowCount,
      columns: headers,
      uploaded_at: new Date().toISOString(),
      price_currency: priceCurrency,
    },
  };
}

/** Reset to the original bundled dataset. */
export function resetToDefault() {
  const cfg = readConfig();
  if (cfg.active_path && cfg.active_path !== DEFAULT_CSV && fs.existsSync(cfg.active_path)) {
    try { fs.unlinkSync(cfg.active_path); } catch { /* ignore */ }
  }
  writeConfig({ ...cfg, active_path: null, original_name: null, uploaded_at: null, price_currency: 'INR' });
}
