import express from 'express';
import { getAllModels, addCustomModel, deleteCustomModel } from '../services/modelStore.js';
import { enqueueEvaluation } from '../services/evaluateQueue.js';

const router = express.Router();

async function evaluateMetricsRealtime(algorithm, hyperparameters) {
  try {
    const result = await enqueueEvaluation({
      algorithm,
      hyperparameters,
      test_size: 0.2,
      random_state: 42,
    });
    return {
      r2: result?.test?.r2 ?? null,
      mse: result?.test?.mse ?? null,
      rmse: result?.test?.rmse ?? null,
    };
  } catch (err) {
    return {
      r2: null,
      mse: null,
      rmse: null,
      error: err.message,
    };
  }
}

router.get('/', async (req, res) => {
  const models = getAllModels();

  // Evaluasi metrik secara paralel via queue
  const evaluated = await Promise.all(
    models.map(async (model) => {
      const metrics = await evaluateMetricsRealtime(model.id, model.hyperparameters);
      return { ...model, metrics };
    })
  );

  res.json(evaluated);
});

router.post('/', (req, res) => {
  const newModel = req.body;

  if (!newModel || !newModel.name) {
    return res.status(400).json({ error: 'Data model tidak valid. Field "name" wajib.' });
  }

  const saved = addCustomModel(newModel);
  res.status(201).json(saved);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteCustomModel(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Model tidak ditemukan atau merupakan model bawaan.' });
  }

  res.json({ success: true, message: `Model '${id}' berhasil dihapus.` });
});

export default router;
