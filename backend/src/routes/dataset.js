import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getActivePath,
  getActiveInfo,
  getActiveCurrency,
  setActiveDataset,
  resetToDefault,
  REQUIRED_COLUMNS,
  RECOMMENDED_COLUMNS,
} from '../services/datasetConfig.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

function runDatasetPreview(command, scriptPath, payload) {
  return new Promise((resolve) => {
    const proc = spawn(command, [scriptPath]);
    let stdout = '';
    let stderr = '';
    let finished = false;

    const done = (value) => { if (!finished) { finished = true; resolve(value); } };
    const timeout = setTimeout(() => { proc.kill(); done({ ok: false, reason: `Timeout using ${command}` }); }, 60000);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => { clearTimeout(timeout); done({ ok: false, reason: `Failed using ${command}: ${err.message}` }); });
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        let parsedError = '';
        try { parsedError = JSON.parse(stdout.trim())?.error || ''; } catch { parsedError = ''; }
        done({ ok: false, reason: parsedError || stderr || `Exit code ${code}` });
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result?.error) { done({ ok: false, reason: result.error }); return; }
        done({ ok: true, result });
      } catch {
        done({ ok: false, reason: `Invalid JSON output: ${stdout}` });
      }
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

/** GET /api/dataset — paginated preview */
router.get('/', async (req, res) => {
  const page  = Number(req.query.page  || 1);
  const limit = Number(req.query.limit || 20);

  const activePath = getActivePath();
  const activeInfo = getActiveInfo();

  const scriptPath = path.join(__dirname, '..', 'scripts', 'dataset_preview.py');
  const payload = {
    page,
    limit,
    dataset_path: activePath,
    dataset_name: activeInfo.filename,
  };

  const pythonCandidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  const reasons = [];
  for (const command of pythonCandidates) {
    const attempt = await runDatasetPreview(command, scriptPath, payload);
    if (attempt.ok) {
      return res.json({ ...attempt.result, dataset_info: activeInfo });
    }
    reasons.push(`[${command}] ${attempt.reason}`);
  }

  res.status(500).json({ error: 'Gagal memuat preview dataset.', details: reasons.join(' | ') });
});

/** GET /api/dataset/active — info dataset aktif */
router.get('/active', (req, res) => {
  res.json(getActiveInfo());
});

/** GET /api/dataset/currency — currency dataset aktif */
router.get('/currency', (req, res) => {
  res.json({ currency: getActiveCurrency() });
});

/** GET /api/dataset/columns — daftar kolom yang dibutuhkan */
router.get('/columns', (req, res) => {
  res.json({ required: REQUIRED_COLUMNS, recommended: RECOMMENDED_COLUMNS });
});

/** POST /api/dataset/upload — replace active dataset dengan CSV baru */
router.post('/upload', (req, res) => {
  const { csv_content, filename, currency } = req.body || {};

  if (!csv_content || typeof csv_content !== 'string') {
    return res.status(400).json({ error: 'Field "csv_content" wajib berupa string CSV.' });
  }

  if (csv_content.trim().length < 10) {
    return res.status(400).json({ error: 'File CSV terlalu kecil atau kosong.' });
  }

  const result = setActiveDataset(csv_content, filename || 'dataset.csv', currency);

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json({
    success: true,
    message: 'Dataset berhasil diupload dan diaktifkan.',
    warnings: result.warnings || [],
    info: result.info,
  });
});

/** DELETE /api/dataset/reset — kembali ke dataset default */
router.delete('/reset', (req, res) => {
  resetToDefault();
  res.json({ success: true, message: 'Dataset direset ke default (Car details v3).', info: getActiveInfo() });
});

export default router;
