import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTrainAndSave } from '../services/pythonBridge.js';
import { addCustomModel } from '../services/modelStore.js';
import { getTrainingData, getFeedbackStats } from '../services/feedbackStore.js';
import { getActivePath, getActiveCurrency } from '../services/datasetConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const MODELS_DIR = path.join(__dirname, '..', 'models');

/**
 * POST /api/retrain
 * Retrain model with feedback data → save as NEW model version.
 * Body: { algorithm, hyperparameters, name?, strict_label? }
 *   - strict_label=true → only use feedback with actual_price (Priority 3)
 */
router.post('/', async (req, res) => {
  const { algorithm, hyperparameters, name, strict_label } = req.body || {};

  if (!algorithm || !['knn', 'dt', 'rf'].includes(algorithm)) {
    return res.status(400).json({ error: 'Algoritma tidak valid. Gunakan "knn", "dt", atau "rf".' });
  }

  const datasetCurrency = getActiveCurrency();
  const stats = getFeedbackStats();
  const strictMode = Boolean(strict_label);

  // Filter feedback by dataset currency to avoid scale mismatch
  const extraData = getTrainingData({
    currency: datasetCurrency,
    strictLabel: strictMode,
  });

  if (extraData.length === 0) {
    return res.status(400).json({
      error: strictMode
        ? `Belum ada data feedback berlabel (currency ${datasetCurrency}) untuk retrain strict. Isi harga aktual dulu pada hasil prediksi.`
        : `Belum ada data feedback (currency ${datasetCurrency}) untuk retrain. Lakukan prediksi dan simpan feedback terlebih dahulu.`,
      stats,
      active_currency: datasetCurrency,
    });
  }

  const modelId = `retrained_${algorithm}_${Date.now()}`;
  const savePath = path.join(MODELS_DIR, `${modelId}.sav`);

  try {
    const result = await runTrainAndSave({
      algorithm,
      hyperparameters: hyperparameters || {},
      save_path: savePath,
      dataset_path: getActivePath(),
      extra_data: extraData,
      test_size: 0.3,
      random_state: 42,
    });

    const algoNames = {
      knn: 'KNN Regressor',
      dt: 'Decision Tree Regressor',
      rf: 'Random Forest Regressor',
    };

    const modelName = name || `${algoNames[algorithm]} (Retrained ${new Date().toLocaleDateString('id-ID')})`;
    const policyLabel = strictMode ? 'strict-label' : 'hybrid (actual + predicted fallback)';

    const savedModel = addCustomModel({
      id: modelId,
      name: modelName,
      algorithm: algoNames[algorithm],
      description: `Model retrained dengan ${extraData.length} data feedback (${policyLabel}) pada dataset currency ${datasetCurrency}.`,
      pros: ['Disesuaikan dengan data feedback user', 'Menggunakan data terbaru'],
      cons: strictMode
        ? ['Perlu validasi lebih lanjut']
        : ['Sebagian data tanpa harga aktual — bisa mengulang bias model lama'],
      hyperparameters: hyperparameters || {},
      metrics: result.metrics,
      model_path: savePath,
      currency: result.currency || datasetCurrency,
      features_used: ['year', 'km_driven', 'mileage', 'engine', 'max_power', 'seats', 'fuel', 'seller_type', 'transmission', 'owner', 'torque_clean', 'rpm_min', 'rpm_max'],
      retrain_info: {
        feedback_rows: extraData.length,
        with_actual_price: stats.with_actual_price,
        prediction_only: stats.prediction_only,
        policy: strictMode ? 'strict_label' : 'hybrid',
        retrained_at: new Date().toISOString(),
        dataset_currency: datasetCurrency,
      },
    });

    res.status(201).json({
      success: true,
      model: savedModel,
      training_result: result,
      policy: strictMode ? 'strict_label' : 'hybrid',
    });
  } catch (err) {
    console.error('[retrain] Error:', err.message);
    res.status(500).json({ error: 'Retrain gagal', details: err.message });
  }
});

/**
 * GET /api/retrain/status
 * Check if retrain is possible (enough feedback data).
 */
router.get('/status', (req, res) => {
  const stats = getFeedbackStats();
  const datasetCurrency = getActiveCurrency();
  const matchingCurrency = stats.by_currency?.[datasetCurrency] || 0;

  res.json({
    ...stats,
    active_currency: datasetCurrency,
    matching_currency_count: matchingCurrency,
    can_retrain: matchingCurrency > 0,
    can_retrain_strict: (stats.with_actual_price || 0) > 0,
    recommended: stats.with_actual_price >= 5,
    message: matchingCurrency === 0
      ? `Belum ada feedback dengan currency ${datasetCurrency}.`
      : stats.with_actual_price >= 5
        ? `${stats.with_actual_price} data berlabel — siap retrain.`
        : `${matchingCurrency} data currency ${datasetCurrency} terkumpul (${stats.with_actual_price} berlabel). Disarankan minimal 5 data berlabel.`,
  });
});

export default router;
