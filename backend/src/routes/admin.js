/**
 * admin.js — Semua route /api/admin/* dilindungi JWT
 *
 * GET  /api/admin/stats
 * GET  /api/admin/predictions          — list semua prediksi user
 * POST /api/admin/predictions/select   — centang/uncentang data untuk training
 * GET  /api/admin/predictions/selected — data yang sudah dipilih
 * POST /api/admin/preview-retrain      — evaluasi model pakai data terpilih (dry-run, tidak simpan)
 * POST /api/admin/retrain              — retrain + replace builtin model
 * GET  /api/admin/training-logs
 * GET  /api/admin/retrains
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAdmin } from '../middleware/authMiddleware.js';
import {
  getPredictions, getPredictionStats,
  setPredictionSelected, getSelectedPredictions,
  getTrainingLogs, getTrainingStats,
  getAdminRetrains, insertAdminRetrain, updateAdminRetrain,
} from '../db/database.js';
import { enqueueEvaluation } from '../services/evaluateQueue.js';
import { runTrainAndSave } from '../services/pythonBridge.js';
import { getActivePath, getActiveCurrency } from '../services/datasetConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const MODELS_DIR = path.join(__dirname, '..', 'models');
const BUILTIN_SAV = {
  knn: path.join(MODELS_DIR, 'car_price_knn_model.sav'),
  dt : path.join(MODELS_DIR, 'car_price_DT_model.sav'),
  rf : path.join(MODELS_DIR, 'car_price_rf_model.sav'),
};

const router = express.Router();
router.use(requireAdmin); // semua route di bawah butuh JWT

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [predStats, trainStats, retrains] = await Promise.all([
      getPredictionStats(),
      getTrainingStats(),
      getAdminRetrains({ limit: 5 }),
    ]);
    res.json({ predictions: predStats, training: trainStats, latest_retrains: retrains.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/predictions ────────────────────────────────────────────────
router.get('/predictions', async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit  || '200'), 1000);
    const offset   = parseInt(req.query.offset || '0');
    const model_id = req.query.model_id || null;
    res.json(await getPredictions({ limit, offset, model_id }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/predictions/select ───────────────────────────────────────
// Body: { ids: string[], selected: boolean }
router.post('/predictions/select', async (req, res) => {
  const { ids, selected } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids harus array tidak kosong.' });
  }
  try {
    await setPredictionSelected(ids, Boolean(selected));
    const stats = await getPredictionStats();
    res.json({ ok: true, selected_total: stats.selected });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/predictions/selected ──────────────────────────────────────
router.get('/predictions/selected', async (req, res) => {
  try {
    const rows = await getSelectedPredictions();
    res.json({ data: rows, total: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/preview-retrain ──────────────────────────────────────────
// Evaluasi model dengan data terpilih (tidak simpan .sav) — untuk cek RMSE/R² dulu
router.post('/preview-retrain', async (req, res) => {
  const { algorithm } = req.body || {};
  if (!algorithm || !['knn','dt','rf'].includes(algorithm)) {
    return res.status(400).json({ error: 'Algoritma tidak valid.' });
  }

  const selected = await getSelectedPredictions();
  if (!selected.length) {
    return res.status(400).json({ error: 'Belum ada data yang dipilih untuk training.' });
  }

  try {
    const result = await enqueueEvaluation({
      algorithm,
      hyperparameters: {},
      test_size: 0.2,
      random_state: 42,
      dataset_path: getActivePath(),
    });

    const r2    = result?.test?.r2   ?? null;
    const rmse  = result?.test?.rmse ?? null;
    const r2pct = r2 != null ? parseFloat((r2 * 100).toFixed(2)) : null;

    // Penilaian otomatis
    let verdict = 'poor';
    let verdictLabel = 'Kurang baik';
    let verdictColor = 'red';
    if (r2 >= 0.90) { verdict = 'excellent'; verdictLabel = 'Sangat bagus'; verdictColor = 'green'; }
    else if (r2 >= 0.80) { verdict = 'good'; verdictLabel = 'Bagus'; verdictColor = 'cyan'; }
    else if (r2 >= 0.70) { verdict = 'fair'; verdictLabel = 'Cukup'; verdictColor = 'amber'; }

    res.json({
      algorithm,
      selected_count: selected.length,
      metrics: { r2, rmse, r2_pct: r2pct },
      verdict, verdict_label: verdictLabel, verdict_color: verdictColor,
      recommendation: verdict === 'poor'
        ? 'R² terlalu rendah. Tambah lebih banyak data prediksi berkualitas sebelum retrain.'
        : verdict === 'fair'
          ? 'Model cukup stabil. Retrain bisa dilakukan tapi tambah data lebih baik.'
          : 'Model sudah baik. Aman untuk retrain.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Preview gagal', details: err.message });
  }
});

// ── POST /api/admin/retrain ───────────────────────────────────────────────────
// Retrain → replace file .sav builtin → user langsung dapat model lebih baik
router.post('/retrain', async (req, res) => {
  const { algorithm, hyperparameters = {} } = req.body || {};
  if (!algorithm || !['knn','dt','rf'].includes(algorithm)) {
    return res.status(400).json({ error: 'Algoritma tidak valid.' });
  }

  const selected = await getSelectedPredictions();
  if (!selected.length) {
    return res.status(400).json({ error: 'Belum ada data yang dipilih untuk training.' });
  }

  const id       = `admin_retrain_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const tmpPath  = path.join(MODELS_DIR, `${id}_tmp.sav`);
  const builtinPath = BUILTIN_SAV[algorithm];

  await insertAdminRetrain({ id, algorithm, hyperparams: hyperparameters, selected_count: selected.length });

  // Bentuk extra_data dari data terpilih — format yang dipahami train_and_save.py
  const extraData = selected
    .filter(p => p.prediction != null)
    .map(p => ({ ...p.features, selling_price: p.prediction }));

  try {
    const ALGO_NAMES = { knn: 'KNN Regressor', dt: 'Decision Tree Regressor', rf: 'Random Forest Regressor' };
    const modelName  = `${ALGO_NAMES[algorithm]} (Retrain ${new Date().toLocaleDateString('id-ID')})`;

    const result = await runTrainAndSave({
      algorithm,
      hyperparameters,
      save_path   : tmpPath,
      dataset_path: getActivePath(),
      extra_data  : extraData,
      test_size   : 0.2,
      random_state: 42,
    });

    // Backup builtin lama, replace dengan model baru
    const backupPath = `${builtinPath}.bak_${Date.now()}`;
    if (fs.existsSync(builtinPath)) {
      fs.copyFileSync(builtinPath, backupPath);
    }
    fs.renameSync(tmpPath, builtinPath);

    await updateAdminRetrain(id, {
      status        : 'success',
      model_id      : algorithm,
      model_name    : modelName,
      model_path    : builtinPath,
      metrics       : result.metrics,
      error         : null,
      replaced_builtin: true,
    });

    res.status(201).json({
      success      : true,
      retrain_id   : id,
      algorithm,
      model_name   : modelName,
      replaced_builtin: true,
      metrics      : result.metrics,
      selected_count: selected.length,
      message      : `Model ${ALGO_NAMES[algorithm]} berhasil diperbarui. User akan langsung mendapat prediksi lebih akurat.`,
    });
  } catch (err) {
    // Bersihkan tmp kalau ada
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}

    await updateAdminRetrain(id, {
      status: 'failed', error: err.message,
      model_id: null, model_name: null, model_path: null, metrics: null, replaced_builtin: false,
    });
    console.error('[admin/retrain]', err.message);
    res.status(500).json({ error: 'Retrain gagal', details: err.message });
  }
});

// ── GET /api/admin/training-logs ──────────────────────────────────────────────
router.get('/training-logs', async (req, res) => {
  try {
    const limit     = Math.min(parseInt(req.query.limit || '100'), 500);
    const offset    = parseInt(req.query.offset || '0');
    const algorithm = req.query.algorithm || null;
    res.json(await getTrainingLogs({ limit, offset, algorithm }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/retrains ───────────────────────────────────────────────────
router.get('/retrains', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || '50'), 200);
    const offset = parseInt(req.query.offset || '0');
    res.json(await getAdminRetrains({ limit, offset }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
