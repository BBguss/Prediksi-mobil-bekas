import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTrainAndSave } from '../services/pythonBridge.js';
import { addCustomModel } from '../services/modelStore.js';
import { getActiveCurrency, getActivePath } from '../services/datasetConfig.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.join(__dirname, '..', 'models');

function runTraining(payload) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'train_playground.py');
    const pythonCandidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

    const attempt = (idx) => {
      if (idx >= pythonCandidates.length) {
        reject(new Error('Semua command Python gagal dijalankan.'));
        return;
      }

      const cmd = pythonCandidates[idx];
      const proc = spawn(cmd, [scriptPath]);
      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        proc.kill();
        attempt(idx + 1);
      }, 30000);

      proc.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        attempt(idx + 1);
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          if (idx < pythonCandidates.length - 1) {
            attempt(idx + 1);
            return;
          }

          try {
            const errJson = JSON.parse(stdout.trim());
            reject(new Error(errJson.error || stderr || `Exit code ${code}`));
          } catch {
            reject(new Error(stderr || stdout || `Exit code ${code}`));
          }
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.error) {
            reject(new Error(parsed.error));
            return;
          }
          resolve(parsed);
        } catch {
          reject(new Error(`Output Python tidak valid: ${stdout}`));
        }
      });

      proc.stdin.write(JSON.stringify(payload || {}));
      proc.stdin.end();
    };

    attempt(0);
  });
}

router.post('/train', async (req, res) => {
  try {
    const { algorithm, hyperparameters, trainingOptions } = req.body || {};

    if (!['knn', 'dt', 'rf'].includes(algorithm)) {
      return res.status(400).json({ error: 'Algoritma tidak valid. Gunakan knn, dt, atau rf.' });
    }

    const result = await runTraining({
      algorithm,
      hyperparameters: hyperparameters || {},
      trainingOptions: trainingOptions || {},
    });

    res.json(result);
  } catch (error) {
    console.error('[playground/train] error:', error.message);
    res.status(500).json({ error: 'Gagal training model playground', details: error.message });
  }
});

/**
 * POST /api/playground/train-save
 * Train model with given hyperparameters AND save .sav file.
 * Returns saved model metadata that can be used for prediction.
 */
router.post('/train-save', async (req, res) => {
  try {
    const { algorithm, hyperparameters, name } = req.body || {};

    if (!algorithm || !['knn', 'dt', 'rf'].includes(algorithm)) {
      return res.status(400).json({ error: 'Algoritma tidak valid. Gunakan knn, dt, atau rf.' });
    }

    const modelId = `custom_${algorithm}_${Date.now()}`;
    const savePath = path.join(MODELS_DIR, `${modelId}.sav`);
    const datasetCurrency = getActiveCurrency();

    const result = await runTrainAndSave({
      algorithm,
      hyperparameters: hyperparameters || {},
      save_path: savePath,
      dataset_path: getActivePath(),
      test_size: 0.3,
      random_state: 15,
    });

    const algoNames = {
      knn: 'K-Nearest Neighbors (Kustom)',
      dt: 'Decision Tree (Kustom)',
      rf: 'Random Forest (Kustom)',
    };

    const modelName = name || `${algoNames[algorithm]} ${new Date().toLocaleDateString('id-ID')}`;

    const savedModel = addCustomModel({
      id: modelId,
      name: modelName,
      algorithm: algoNames[algorithm],
      description: `Model kustom dari Playground. Algoritma: ${algorithm.toUpperCase()}. Dilatih pada dataset currency ${datasetCurrency}.`,
      pros: ['Disesuaikan oleh pengguna', 'File .sav tersimpan — bisa dipakai prediksi'],
      cons: ['Belum divalidasi secara ekstensif'],
      hyperparameters: hyperparameters || {},
      metrics: result.metrics,
      model_path: savePath,
      currency: result.currency || datasetCurrency,
      features_used: ['year', 'km_driven', 'mileage', 'engine', 'max_power', 'seats', 'fuel', 'seller_type', 'transmission', 'owner', 'torque_clean', 'rpm_min', 'rpm_max'],
    });

    res.status(201).json({
      success: true,
      model: savedModel,
      training_result: result,
    });
  } catch (error) {
    console.error('[playground/train-save] error:', error.message);
    res.status(500).json({ error: 'Gagal training & simpan model', details: error.message });
  }
});

export default router;
