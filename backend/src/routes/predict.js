import express from 'express';
import { runPythonPrediction, runCustomPrediction } from '../services/pythonBridge.js';
import { getAllModels } from '../services/modelStore.js';
import { insertPrediction } from '../db/database.js';

const router    = express.Router();
const BUILTIN   = new Set(['knn', 'dt', 'rf']);
const ALGO_NAME = { knn: 'KNN Regressor', dt: 'Decision Tree Regressor', rf: 'Random Forest Regressor' };

function uid() { return `pred_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }

function normalizeAlgorithm(value) {
  const t = String(value || '').trim().toLowerCase();
  if (['knn','k-nearest neighbors','k-nearest neighbors (kustom)'].some(k => t.includes(k))) return 'knn';
  if (['dt','decision tree'].some(k => t.includes(k))) return 'dt';
  if (['rf','random forest'].some(k => t.includes(k))) return 'rf';
  return 'knn';
}

router.post('/', async (req, res) => {
  const { model: modelId, features } = req.body || {};
  if (!modelId)  return res.status(400).json({ error: 'Model tidak valid atau tidak ada.' });
  if (!features || typeof features !== 'object') return res.status(400).json({ error: 'Objek fitur tidak ada atau tidak valid.' });

  const id = uid();

  try {
    let result, modelName, algorithm;

    if (BUILTIN.has(modelId)) {
      result    = await runPythonPrediction(modelId, features);
      modelName = ALGO_NAME[modelId];
      algorithm = modelId;
    } else {
      const customModel = getAllModels().find(m => m.id === modelId && !m.builtin);
      if (!customModel)            return res.status(404).json({ error: `Model '${modelId}' tidak ditemukan.` });
      if (!customModel.model_path) return res.status(400).json({ error: `Model '${modelId}' belum memiliki file .sav.` });
      algorithm = normalizeAlgorithm(customModel.algorithm);
      result    = await runCustomPrediction(customModel.model_path, algorithm, features, customModel.currency || 'INR');
      modelName = customModel.name;
    }

    // Simpan ke DB — await langsung agar error tidak hilang diam-diam
    try {
      await insertPrediction({
        id,
        model_id  : modelId,
        model_name: modelName,
        algorithm,
        features,
        prediction: result?.prediction ?? null,
        currency  : result?.currency ?? 'INR',
      });
      console.log(`[predict] Saved to DB — id: ${id}, model: ${modelId}, prediction: ${result?.prediction}`);
    } catch (dbErr) {
      // DB error tidak membatalkan response ke user, tapi dicatat dengan jelas
      console.error('[predict] DB INSERT FAILED:', dbErr.message);
      console.error('[predict] DB error detail:', dbErr);
    }

    return res.json({ ...result, _id: id });
  } catch (error) {
    // Catat prediksi yang gagal ke DB juga
    try {
      await insertPrediction({
        id,
        model_id  : modelId,
        model_name: ALGO_NAME[modelId] || modelId,
        algorithm : modelId,
        features,
        prediction: null,
        currency  : 'INR',
        error     : error.message,
      });
    } catch (dbErr) {
      console.error('[predict] DB error insert (on fail):', dbErr.message);
    }
    console.error('[predict] Prediction error:', error.message);
    res.status(500).json({ error: 'Gagal menjalankan prediksi', details: error.message });
  }
});

export default router;
