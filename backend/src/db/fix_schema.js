/**
 * fix_schema.js — Jalankan sekali untuk update tabel yang sudah ada
 * Usage: node backend/src/db/fix_schema.js
 */
import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host    : process.env.DB_HOST     || 'localhost',
  port    : parseInt(process.env.DB_PORT || '3306'),
  user    : process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'prediksi_mobil',
});

const fixes = [
  // admin_retrains — kolom yang mungkin belum ada
  `ALTER TABLE admin_retrains ADD COLUMN selected_count  INT         NOT NULL DEFAULT 0`,
  `ALTER TABLE admin_retrains ADD COLUMN replaced_builtin TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE admin_retrains ADD COLUMN r2_before        DOUBLE`,
  `ALTER TABLE admin_retrains ADD COLUMN r2_after         DOUBLE`,
  `ALTER TABLE admin_retrains ADD COLUMN rmse_before      DOUBLE`,
  `ALTER TABLE admin_retrains ADD COLUMN rmse_after       DOUBLE`,
  // predictions — kolom yang mungkin belum ada
  `ALTER TABLE predictions ADD COLUMN selected_for_training TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE predictions ADD COLUMN selected_at           DATETIME`,
];

console.log('Menjalankan schema fixes...');
for (const sql of fixes) {
  try {
    await pool.execute(sql);
    console.log(`✅  ${sql.slice(0, 70)}...`);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log(`⏭️  Sudah ada: ${sql.slice(0, 70)}...`);
    } else {
      console.error(`❌  ERROR: ${err.message}`);
      console.error(`    SQL: ${sql}`);
    }
  }
}

await pool.end();
console.log('\nSelesai. Restart server sekarang.');
process.exit(0);
