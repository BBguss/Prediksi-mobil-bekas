/**
 * debug.js — Route diagnostik sementara
 * GET  /api/debug/db-test
 * GET  /api/debug/predictions
 * GET  /api/debug/admin-stats   — simulasi getAdminStats tanpa JWT
 * DELETE /api/debug/cleanup
 */
import express from 'express';
import { getPool, insertPrediction, getPredictions, getPredictionStats, getTrainingStats, getAdminRetrains } from '../db/database.js';

const router = express.Router();

router.get('/db-test', async (req, res) => {
  const results = {};
  try {
    const pool = getPool();
    const [[ping]] = await pool.execute('SELECT 1 as ok');
    results.connection = ping.ok === 1 ? 'OK' : 'FAILED';
    const [[tbl]] = await pool.execute(`SELECT COUNT(*) as n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'predictions'`);
    results.table_exists = tbl.n > 0;
    const [cols] = await pool.execute(`SHOW COLUMNS FROM predictions`);
    results.columns = cols.map(c => c.Field);
    const dummyId = `debug_${Date.now()}`;
    await pool.execute(`INSERT INTO predictions (id, model_id, model_name, algorithm, features, prediction, currency) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dummyId, 'debug', 'Debug Test', 'knn', JSON.stringify({ year: 2020 }), 99999, 'INR']);
    results.insert = `OK — id: ${dummyId}`;
    const [[row]] = await pool.execute('SELECT * FROM predictions WHERE id = ?', [dummyId]);
    results.select = row ? `OK — row: ${JSON.stringify({ id: row.id, prediction: row.prediction })}` : 'NOT FOUND';
    const helperId = `helper_${Date.now()}`;
    await insertPrediction({ id: helperId, model_id: 'debug', model_name: 'Debug Helper', algorithm: 'knn', features: { year: 2021, km_driven: 10000 }, prediction: 88888, currency: 'INR' });
    const [[helperRow]] = await pool.execute('SELECT id, prediction FROM predictions WHERE id = ?', [helperId]);
    results.insert_via_helper = helperRow ? `OK — id: ${helperId}` : 'NOT FOUND';
    const [[cnt]] = await pool.execute('SELECT COUNT(*) as n FROM predictions');
    results.total_rows = cnt.n;
    res.json({ status: 'OK', ...results });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message, stack: err.stack, partial: results });
  }
});

// Lihat data predictions langsung tanpa JWT
router.get('/predictions', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT id, model_id, model_name, algorithm, prediction, currency, created_at, error FROM predictions WHERE model_id != "debug" ORDER BY created_at DESC LIMIT 20');
    const [[cnt]] = await pool.execute('SELECT COUNT(*) as n FROM predictions WHERE model_id != "debug"');
    res.json({ total: cnt.n, rows });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Simulasi getAdminStats tanpa JWT — untuk isolasi bug
router.get('/admin-stats', async (req, res) => {
  try {
    const predStats  = await getPredictionStats();
    const trainStats = await getTrainingStats();
    const retrains   = await getAdminRetrains({ limit: 5 });
    res.json({ predStats, trainStats, retrains_count: retrains.total });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Simulasi getPredictions tanpa JWT
router.get('/admin-predictions', async (req, res) => {
  try {
    const result = await getPredictions({ limit: 200, offset: 0 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.delete('/cleanup', async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.execute("DELETE FROM predictions WHERE model_id = 'debug'");
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
