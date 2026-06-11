/**
 * Queue system untuk evaluate requests.
 * Menjalankan evaluasi secara paralel dengan concurrency limit.
 * Mencegah server overload saat banyak request evaluasi masuk bersamaan.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Concurrency limit — jumlah evaluasi Python yang bisa berjalan bersamaan
const MAX_CONCURRENT = 3;
const TIMEOUT_MS = 60000;

let running = 0;
const queue = [];

/**
 * Internal: proses item berikutnya dari queue jika slot tersedia.
 */
function processNext() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    running++;
    executeJob(job)
      .then((result) => job.resolve(result))
      .catch((err) => job.reject(err))
      .finally(() => {
        running--;
        processNext();
      });
  }
}

/**
 * Internal: jalankan satu job evaluasi Python.
 */
function executeJob(job) {
  const { payload, scriptPath } = job;
  const pythonCandidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

  return new Promise(async (resolve, reject) => {
    const attempts = [];

    for (const command of pythonCandidates) {
      const attempt = await runPythonEvaluate(command, scriptPath, payload);
      if (attempt.ok) {
        return resolve(attempt.result);
      }
      attempts.push({ command, reason: attempt.reason });
    }

    const details = attempts.map((a) => `[${a.command}] ${a.reason}`).join(' | ');
    reject(new Error(details));
  });
}

/**
 * Internal: spawn Python process untuk evaluasi.
 */
function runPythonEvaluate(command, scriptPath, payload) {
  return new Promise((resolve) => {
    const pythonProcess = spawn(command, [scriptPath]);
    let outputData = '';
    let errorData = '';
    let finished = false;

    const done = (result) => {
      if (finished) return;
      finished = true;
      resolve(result);
    };

    const timeout = setTimeout(() => {
      pythonProcess.kill();
      done({ ok: false, reason: `Timeout after ${TIMEOUT_MS / 1000}s using ${command}` });
    }, TIMEOUT_MS);

    pythonProcess.stdout.on('data', (d) => {
      outputData += d.toString();
    });

    pythonProcess.stderr.on('data', (d) => {
      errorData += d.toString();
    });

    pythonProcess.on('error', (err) => {
      clearTimeout(timeout);
      done({ ok: false, reason: `Gagal menjalankan ${command}: ${err.message}` });
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        let parsedError = '';
        try {
          const parsed = JSON.parse(outputData.trim());
          parsedError = parsed?.error || '';
        } catch {
          // ignore
        }
        done({
          ok: false,
          reason: parsedError || errorData || `Python exited with code ${code}`,
        });
        return;
      }

      try {
        const result = JSON.parse(outputData.trim());
        if (result?.error) {
          done({ ok: false, reason: result.error });
          return;
        }
        done({ ok: true, result });
      } catch {
        done({ ok: false, reason: `Gagal parse output Python: ${outputData.slice(0, 200)}` });
      }
    });

    pythonProcess.stdin.write(JSON.stringify(payload));
    pythonProcess.stdin.end();
  });
}

/**
 * Enqueue evaluasi. Mengembalikan Promise yang resolve saat evaluasi selesai.
 * Jika slot tersedia, langsung dijalankan. Jika tidak, masuk antrian.
 *
 * @param {object} payload - Data yang dikirim ke Python script via stdin
 * @param {string} [script] - Path ke script Python (default: evaluate_model.py)
 * @returns {Promise<object>} Hasil evaluasi dari Python
 */
export function enqueueEvaluation(payload, script) {
  const scriptPath = script || path.join(__dirname, '..', 'scripts', 'evaluate_model.py');

  return new Promise((resolve, reject) => {
    queue.push({ payload, scriptPath, resolve, reject });
    processNext();
  });
}

/**
 * Status queue saat ini.
 */
export function getQueueStatus() {
  return {
    running,
    queued: queue.length,
    maxConcurrent: MAX_CONCURRENT,
  };
}
