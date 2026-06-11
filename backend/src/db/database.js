/**
 * database.js — MySQL layer via mysql2/promise
 * Tabel: admin_users, predictions, training_logs, admin_retrains
 */
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import 'dotenv/config';

let _pool = null;

export function getPool() {
  if (_pool) return _pool;
  _pool = mysql.createPool({
    host              : process.env.DB_HOST     || 'localhost',
    port              : parseInt(process.env.DB_PORT || '3306'),
    user              : process.env.DB_USER     || 'root',
    password          : process.env.DB_PASSWORD || '',
    database          : process.env.DB_NAME     || 'prediksi_mobil',
    waitForConnections: true,
    connectionLimit   : 10,
    queueLimit        : 0,
    timezone          : '+00:00',
  });
  return _pool;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Serialise value ke JSON string, null kalau undefined/null */
function j(v) { return v != null ? JSON.stringify(v) : null; }

/** Cast ke int — hindari string yang bikin mysql2 crash di LIMIT/OFFSET */
function int(v, def = 0) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; }

function parseRow(r) {
  if (!r) return r;
  for (const k of ['features', 'hyperparams', 'metrics']) {
    if (typeof r[k] === 'string') try { r[k] = JSON.parse(r[k]); } catch {}
  }
  return r;
}

// ── Migrations ────────────────────────────────────────────────────────────────

export async function runMigrations() {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id            VARCHAR(64)   NOT NULL PRIMARY KEY,
      username      VARCHAR(64)   NOT NULL UNIQUE,
      password_hash VARCHAR(128)  NOT NULL,
      created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login    DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS predictions (
      id                    VARCHAR(64)  NOT NULL PRIMARY KEY,
      created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      model_id              VARCHAR(128) NOT NULL,
      model_name            VARCHAR(255) NOT NULL,
      algorithm             VARCHAR(64)  NOT NULL,
      features              JSON         NOT NULL,
      prediction            DOUBLE,
      currency              VARCHAR(8)   NOT NULL DEFAULT 'INR',
      error                 TEXT,
      selected_for_training TINYINT(1)   NOT NULL DEFAULT 0,
      selected_at           DATETIME,
      INDEX idx_pred_created  (created_at DESC),
      INDEX idx_pred_model    (model_id),
      INDEX idx_pred_selected (selected_for_training)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try { await pool.execute(`ALTER TABLE predictions ADD COLUMN selected_for_training TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
  try { await pool.execute(`ALTER TABLE predictions ADD COLUMN selected_at DATETIME`); } catch {}

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS training_logs (
      id            VARCHAR(64)  NOT NULL PRIMARY KEY,
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      algorithm     VARCHAR(64)  NOT NULL,
      hyperparams   JSON         NOT NULL,
      r2_train      DOUBLE,
      r2_test       DOUBLE,
      rmse_train    DOUBLE,
      rmse_test     DOUBLE,
      dataset_rows  INT,
      elapsed_ms    DOUBLE,
      source        VARCHAR(32)  NOT NULL DEFAULT 'playground',
      model_name    VARCHAR(255),
      model_path    VARCHAR(512),
      INDEX idx_train_created (created_at DESC),
      INDEX idx_train_algo    (algorithm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_retrains (
      id               VARCHAR(64)  NOT NULL PRIMARY KEY,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      triggered_by     VARCHAR(64)  NOT NULL DEFAULT 'admin',
      algorithm        VARCHAR(64)  NOT NULL,
      hyperparams      JSON         NOT NULL,
      selected_count   INT          NOT NULL DEFAULT 0,
      status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
      model_id         VARCHAR(128),
      model_name       VARCHAR(255),
      model_path       VARCHAR(512),
      r2_before        DOUBLE,
      r2_after         DOUBLE,
      rmse_before      DOUBLE,
      rmse_after       DOUBLE,
      metrics          JSON,
      error            TEXT,
      completed_at     DATETIME,
      replaced_builtin TINYINT(1)   NOT NULL DEFAULT 0,
      INDEX idx_admin_created (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[existing]] = await pool.execute(`SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1`);
  if (!existing) {
    const defaultPass = process.env.ADMIN_PASSWORD || 'admin123';
    await pool.execute(
      `INSERT INTO admin_users (id, username, password_hash) VALUES (?, 'admin', ?)`,
      [`admin_${Date.now()}`, hashPassword(defaultPass)]
    );
    console.log(`[db] Admin default dibuat — username: admin, password: ${defaultPass}`);
  }

  console.log('[db] Migrasi selesai.');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain + (process.env.ADMIN_SALT || 'cp_salt_2026')).digest('hex');
}

export async function findAdminByUsername(username) {
  const [[row]] = await getPool().execute(`SELECT * FROM admin_users WHERE username = ?`, [username]);
  return row || null;
}

export async function updateAdminLastLogin(id) {
  await getPool().execute(`UPDATE admin_users SET last_login = NOW() WHERE id = ?`, [id]);
}

// ── predictions ───────────────────────────────────────────────────────────────

export async function insertPrediction({ id, model_id, model_name, algorithm, features, prediction, currency = 'INR', error = null }) {
  await getPool().execute(
    `INSERT IGNORE INTO predictions (id, model_id, model_name, algorithm, features, prediction, currency, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, model_id, model_name, algorithm, j(features), prediction ?? null, currency, error ?? null]
  );
}

export async function getPredictions({ limit = 100, offset = 0, model_id = null, selected_only = false } = {}) {
  const pool  = getPool();
  const conds = [];
  const args  = [];
  if (model_id)      { conds.push('model_id = ?');              args.push(model_id); }
  if (selected_only) { conds.push('selected_for_training = 1'); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  // Gunakan query() bukan execute() untuk LIMIT/OFFSET — lebih reliable dengan numeric
  const lim = int(limit, 100);
  const off = int(offset, 0);
  const [data]    = await pool.query(`SELECT * FROM predictions ${where} ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}`, args);
  const [[count]] = await pool.execute(`SELECT COUNT(*) as total FROM predictions ${where}`, args);

  return { data: data.map(parseRow), total: count.total };
}

export async function setPredictionSelected(ids, selected) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const selectedAt   = selected ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
  await getPool().execute(
    `UPDATE predictions SET selected_for_training = ?, selected_at = ? WHERE id IN (${placeholders})`,
    [selected ? 1 : 0, selectedAt, ...ids]
  );
}

export async function getSelectedPredictions() {
  const [rows] = await getPool().execute(
    `SELECT * FROM predictions WHERE selected_for_training = 1 AND prediction IS NOT NULL ORDER BY created_at DESC`
  );
  return rows.map(parseRow);
}

export async function getPredictionStats() {
  const pool = getPool();

  const [[tot]]    = await pool.execute('SELECT COUNT(*) as n FROM predictions');
  const [[sel]]    = await pool.execute('SELECT COUNT(*) as n FROM predictions WHERE selected_for_training = 1');
  const [[today]]  = await pool.execute("SELECT COUNT(*) as n FROM predictions WHERE DATE(created_at) = CURDATE()");
  const [[recent]] = await pool.execute('SELECT created_at FROM predictions ORDER BY created_at DESC LIMIT 1');

  const [byModel] = await pool.execute(`
    SELECT
      model_id,
      ANY_VALUE(model_name) AS model_name,
      algorithm,
      COUNT(*)              AS \`count\`,
      AVG(prediction)       AS avg_pred
    FROM predictions
    WHERE prediction IS NOT NULL
    GROUP BY model_id, algorithm
    ORDER BY \`count\` DESC
  `);

  return {
    total    : tot.n,
    today    : today.n,
    selected : sel.n,
    by_model : byModel,
    latest_at: recent?.created_at ?? null,
  };
}

// ── training_logs ─────────────────────────────────────────────────────────────

export async function insertTrainingLog({ id, algorithm, hyperparams = {}, r2_train, r2_test, rmse_train, rmse_test, dataset_rows, elapsed_ms, source = 'playground', model_name = null, model_path = null }) {
  await getPool().execute(
    `INSERT IGNORE INTO training_logs
       (id, algorithm, hyperparams, r2_train, r2_test, rmse_train, rmse_test, dataset_rows, elapsed_ms, source, model_name, model_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, algorithm, j(hyperparams), r2_train ?? null, r2_test ?? null, rmse_train ?? null, rmse_test ?? null, dataset_rows ?? null, elapsed_ms ?? null, source, model_name, model_path]
  );
}

export async function getTrainingLogs({ limit = 100, offset = 0, algorithm = null } = {}) {
  const pool  = getPool();
  const where = algorithm ? 'WHERE algorithm = ?' : '';
  const args  = algorithm ? [algorithm] : [];
  const lim   = int(limit, 100);
  const off   = int(offset, 0);

  const [data]    = await pool.query(`SELECT * FROM training_logs ${where} ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}`, args);
  const [[count]] = await pool.execute(`SELECT COUNT(*) as total FROM training_logs ${where}`, args);

  return { data: data.map(parseRow), total: count.total };
}

export async function getTrainingStats() {
  const pool    = getPool();
  const [[tot]] = await pool.execute('SELECT COUNT(*) as n FROM training_logs');
  const [byAlgo] = await pool.execute(`
    SELECT
      algorithm,
      COUNT(*)       AS \`count\`,
      MAX(r2_test)   AS best_r2_test,
      MIN(rmse_test) AS best_rmse_test
    FROM training_logs
    WHERE r2_test IS NOT NULL
    GROUP BY algorithm
    ORDER BY \`count\` DESC
  `);
  return { total: tot.n, by_algorithm: byAlgo };
}

// ── admin_retrains ────────────────────────────────────────────────────────────

export async function insertAdminRetrain({ id, algorithm, hyperparams = {}, selected_count = 0, triggered_by = 'admin' }) {
  await getPool().execute(
    `INSERT IGNORE INTO admin_retrains (id, triggered_by, algorithm, hyperparams, selected_count) VALUES (?, ?, ?, ?, ?)`,
    [id, triggered_by, algorithm, j(hyperparams), int(selected_count)]
  );
}

export async function updateAdminRetrain(id, { status, model_id, model_name, model_path, metrics, error, replaced_builtin = false }) {
  const m = metrics || {};
  await getPool().execute(
    `UPDATE admin_retrains
     SET status=?, model_id=?, model_name=?, model_path=?, metrics=?,
         r2_after=?, rmse_after=?, error=?, completed_at=NOW(), replaced_builtin=?
     WHERE id=?`,
    [
      status,
      model_id   ?? null,
      model_name ?? null,
      model_path ?? null,
      j(metrics),
      m.r2_test   != null ? Number(m.r2_test)   : null,
      m.rmse_test != null ? Number(m.rmse_test) : null,
      error      ?? null,
      replaced_builtin ? 1 : 0,
      id,
    ]
  );
}

export async function getAdminRetrains({ limit = 50, offset = 0 } = {}) {
  const pool = getPool();
  const lim  = int(limit, 50);
  const off  = int(offset, 0);

  const [data]    = await pool.query(`SELECT * FROM admin_retrains ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}`);
  const [[count]] = await pool.execute('SELECT COUNT(*) as total FROM admin_retrains');

  return { data: data.map(parseRow), total: count.total };
}
