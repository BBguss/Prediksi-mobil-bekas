import express from 'express';
import { enqueueEvaluation, getQueueStatus } from '../services/evaluateQueue.js';
import { getActivePath } from '../services/datasetConfig.js';
import { insertTrainingLog } from '../db/database.js';

const router = express.Router();

function normalizeAlgorithm(v) {
  const t = String(v ?? '').trim().toLowerCase();
  const map = {
    'knn':'knn','k-nearest neighbors':'knn','k nearest neighbors':'knn','knearestneighbors':'knn',
    'dt':'dt','decision tree':'dt','decision-tree':'dt','decisiontree':'dt',
    'rf':'rf','random forest':'rf','random-forest':'rf','randomforest':'rf',
  };
  return map[t] ?? t;
}

function uid() { return `train_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }

router.post('/', async (req, res) => {
  const body      = req.body || {};
  const algorithm = normalizeAlgorithm(body.algorithm ?? body.model ?? body.algorithm_type ?? body.model_type);
  const hp        = body.hyperparameters ?? body.hyperparams ?? body.params ?? {};
  const test_size    = body.test_size  ?? body.testSize;
  const random_state = body.random_state ?? body.randomState ?? body.seed;

  if (!algorithm || !['knn','dt','rf'].includes(algorithm)) {
    return res.status(400).json({ error: 'Algoritma tidak valid. Gunakan "knn", "dt", atau "rf".', received: body.algorithm ?? null });
  }

  try {
    const result = await enqueueEvaluation({ algorithm, hyperparameters: hp, test_size, random_state, dataset_path: getActivePath() });

    // Simpan training log ke MySQL (non-blocking)
    insertTrainingLog({
      id          : uid(),
      algorithm,
      hyperparams : hp,
      r2_train    : result?.train?.r2    ?? null,
      r2_test     : result?.test?.r2     ?? null,
      rmse_train  : result?.train?.rmse  ?? null,
      rmse_test   : result?.test?.rmse   ?? null,
      dataset_rows: result?.dataset_info?.total_rows ?? null,
      elapsed_ms  : result?.elapsed_ms   ?? null,
      source      : 'playground',
    }).catch(err => console.warn('[evaluate] DB insert failed (non-fatal):', err.message));

    res.json(result);
  } catch (err) {
    console.error('[evaluate] Evaluation failed:', err.message);
    res.status(500).json({ error: 'Evaluasi gagal', details: err.message });
  }
});

router.get('/status', (req, res) => res.json(getQueueStatus()));

export default router;
