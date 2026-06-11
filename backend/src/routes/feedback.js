import express from 'express';
import { addFeedback, getAllFeedback, getFeedbackStats, clearFeedback } from '../services/feedbackStore.js';
import { getActiveCurrency } from '../services/datasetConfig.js';

const router = express.Router();

/**
 * POST /api/feedback
 * Submit feedback (harga aktual atau prediksi sebagai fallback).
 */
router.post('/', (req, res) => {
  const { features, actual_price, predicted_price, model_id, currency } = req.body || {};

  if (!features || typeof features !== 'object') {
    return res.status(400).json({ error: 'Field "features" wajib berupa object.' });
  }

  if (!actual_price && !predicted_price) {
    return res.status(400).json({ error: 'Minimal satu dari "actual_price" atau "predicted_price" harus diisi.' });
  }

  const entry = addFeedback({
    features,
    actual_price: actual_price ? Number(actual_price) : null,
    predicted_price: predicted_price ? Number(predicted_price) : null,
    model_id,
    currency: currency || getActiveCurrency(),
    source: 'prediction',
  });

  res.status(201).json(entry);
});

/**
 * GET /api/feedback
 * Get all feedback data.
 */
router.get('/', (req, res) => {
  const data = getAllFeedback();
  res.json(data);
});

/**
 * GET /api/feedback/stats
 * Get feedback statistics.
 */
router.get('/stats', (req, res) => {
  res.json(getFeedbackStats());
});

/**
 * DELETE /api/feedback
 * Clear all feedback data.
 */
router.delete('/', (req, res) => {
  clearFeedback();
  res.json({ success: true, message: 'Semua data feedback dihapus.' });
});

export default router;
