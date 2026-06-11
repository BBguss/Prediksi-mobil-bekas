import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Daftar kandidat Python yang dicoba berurutan.
 * Prioritas:
 *   1. PYTHON_PATH dari .env (paling eksplisit)
 *   2. Path absolut umum di Windows
 *   3. Command PATH standar
 */
function getPythonCandidates() {
  const candidates = [];

  // 1. Dari .env — paling diutamakan
  if (process.env.PYTHON_PATH) {
    candidates.push(process.env.PYTHON_PATH);
  }

  if (process.platform === 'win32') {
    // 2. Path absolut umum Windows
    candidates.push(
      'E:\\Python\\python.exe',
      'C:\\Python313\\python.exe',
      'C:\\Python312\\python.exe',
      'C:\\Python311\\python.exe',
      'C:\\Python310\\python.exe',
      'C:\\Python39\\python.exe',
      'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Programs\\Python\\Python313\\python.exe',
      'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
      'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
    );
    // 3. Command PATH — taruh paling akhir karena di Windows sering trigger store dialog
    candidates.push('python3', 'python');
  } else {
    candidates.push('python3', 'python');
  }

  // Deduplikasi — jaga urutan
  return [...new Set(candidates)];
}

// Cache command Python yang berhasil agar tidak trial-error setiap request
let _workingPythonCmd = null;

async function detectWorkingPython() {
  if (_workingPythonCmd) return _workingPythonCmd;

  const candidates = getPythonCandidates();

  for (const cmd of candidates) {
    const ok = await testPythonCmd(cmd);
    if (ok) {
      console.log(`[pythonBridge] Python ditemukan: ${cmd}`);
      _workingPythonCmd = cmd;
      return cmd;
    }
  }

  throw new Error(
    `Python tidak ditemukan. Coba tambahkan ke .env:\n  PYTHON_PATH=C:\\Path\\To\\python.exe\n\nDicoba: ${candidates.join(', ')}`
  );
}

function testPythonCmd(cmd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--version']);
    let ok = false;

    proc.on('error', () => resolve(false));
    proc.stdout.on('data', () => { ok = true; });
    proc.stderr.on('data', () => { ok = true; }); // python --version kadang tulis ke stderr
    proc.on('close', (code) => resolve(ok && code === 0));

    // Timeout 3 detik untuk deteksi
    setTimeout(() => { try { proc.kill(); } catch {} resolve(false); }, 3000);
  });
}

function runScriptWithPython(pythonCmd, scriptPath, inputData, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonCmd, [scriptPath]);
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      pythonProcess.kill();
      resolve({
        ok: false,
        reason: `Timeout after ${timeoutMs / 1000}s using ${pythonCmd}`,
        stdout,
        stderr,
      });
    }, timeoutMs);

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, reason: `Failed to start ${pythonCmd}: ${err.message}`, stdout, stderr });
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        let errMsg = '';
        try {
          const parsed = JSON.parse(stdout.trim());
          errMsg = parsed?.error || '';
        } catch {
          errMsg = stdout.trim() || '';
        }
        resolve({
          ok: false,
          reason: errMsg
            ? `Exit code ${code} using ${pythonCmd}: ${errMsg}`
            : `Exit code ${code} using ${pythonCmd}`,
          stdout,
          stderr,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          resolve({ ok: false, reason: `Python error using ${pythonCmd}: ${result.error}`, stdout, stderr });
          return;
        }
        resolve({ ok: true, result, pythonCmd, stdout, stderr });
      } catch {
        resolve({ ok: false, reason: `Invalid JSON from ${pythonCmd}: ${stdout.slice(0, 200)}`, stdout, stderr });
      }
    });

    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();
  });
}

async function runWithFallback(scriptPath, inputData, timeoutMs = 30000) {
  const cmd = await detectWorkingPython();
  const attempt = await runScriptWithPython(cmd, scriptPath, inputData, timeoutMs);

  if (attempt.ok) {
    if (attempt.stderr?.trim()) {
      // Tampilkan stderr hanya kalau bukan warning sklearn biasa
      const nonFatal = attempt.stderr.includes('UserWarning') || attempt.stderr.includes('FutureWarning') || attempt.stderr.includes('DeprecationWarning');
      if (!nonFatal) console.warn(`[pythonBridge] stderr: ${attempt.stderr.trim()}`);
    }
    return attempt.result;
  }

  // Kalau gagal, reset cache dan lempar error
  _workingPythonCmd = null;
  throw new Error(attempt.reason + (attempt.stderr ? ` | stderr: ${attempt.stderr.trim()}` : ''));
}

// ── Public exports ────────────────────────────────────────────────────────────

export function runPythonPrediction(modelType, features) {
  const allowed = new Set(['knn', 'dt', 'rf']);
  if (!allowed.has(modelType)) {
    return Promise.reject(new Error(`Model '${modelType}' tidak didukung. Gunakan knn, dt, atau rf.`));
  }
  const scripts = { knn: 'predict_knn.py', dt: 'predict_dt.py', rf: 'predict_rf.py' };
  const scriptPath = path.join(__dirname, '..', 'scripts', scripts[modelType]);
  return runWithFallback(scriptPath, features);
}

export function runCustomPrediction(modelPath, algorithm, features, currency = 'INR') {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'predict_custom.py');
  return runWithFallback(scriptPath, { model_path: modelPath, algorithm, features, currency });
}

export function runTrainAndSave(options) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'train_and_save.py');
  return runWithFallback(scriptPath, options, 180000); // 3 menit untuk training
}

export function runCsvPrediction(options) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'predict_csv.py');
  return runWithFallback(scriptPath, options, 60000);
}
