import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCsvPrediction } from '../services/pythonBridge.js';
import { getAllModels } from '../services/modelStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const BUILTIN_MODEL_DIR = path.join(__dirname, '..', 'models');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/upload/predict
 * Upload CSV and get batch predictions.
 * Body: raw CSV text in field "csv_content" + "model" (model ID)
 */
router.post('/predict', async (req, res) => {
  const { csv_content, model } = req.body || {};

  if (!csv_content || typeof csv_content !== 'string') {
    return res.status(400).json({ error: 'Field "csv_content" wajib berupa string CSV.' });
  }

  if (!model) {
    return res.status(400).json({ error: 'Field "model" wajib diisi.' });
  }

  // Write CSV to temp file
  const tempFile = path.join(UPLOAD_DIR, `upload_${Date.now()}.csv`);
  try {
    fs.writeFileSync(tempFile, csv_content, 'utf-8');
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menyimpan file CSV sementara.' });
  }

  // Resolve model path
  let modelPath;
  let algorithm;
  const builtinIds = { knn: 'knn', dt: 'dt', rf: 'rf' };

  if (builtinIds[model]) {
    modelPath = model; // predict_csv.py handles builtin IDs
    algorithm = model;
  } else {
    const allModels = getAllModels();
    const customModel = allModels.find((m) => m.id === model && !m.builtin);
    if (!customModel || !customModel.model_path) {
      cleanup(tempFile);
      return res.status(404).json({ error: `Model '${model}' tidak ditemukan atau belum memiliki file .sav.` });
    }
    modelPath = customModel.model_path;
    algorithm = normalizeAlgorithm(customModel.algorithm);
  }

  try {
    const result = await runCsvPrediction({
      model_path: modelPath,
      csv_path: tempFile,
      algorithm,
    });
    cleanup(tempFile);
    res.json(result);
  } catch (err) {
    cleanup(tempFile);
    console.error('[upload/predict] Error:', err.message);
    res.status(500).json({ error: 'Prediksi batch gagal', details: err.message });
  }
});

function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}

function normalizeAlgorithm(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('knn') || text.includes('nearest')) return 'knn';
  if (text.includes('decision') || text === 'dt') return 'dt';
  if (text.includes('random') || text.includes('forest') || text === 'rf') return 'rf';
  return 'knn';
}

export default router;
