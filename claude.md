# Claude Project State — Prediksi_Model

## Project Overview
Aplikasi web prediksi harga mobil menggunakan ML model (KNN & Decision Tree). Stack: React (Vite) + Express (TypeScript) + Python inference scripts. Server berjalan unified via `server.ts` yang menggabungkan Express API dan Vite middleware.

## Architecture & Stack
- **Frontend:** React + Vite, Tailwind CSS, React Router, Recharts
  - Entry: `src/main.tsx` → `src/App.tsx`
  - Pages: `HomePage.jsx`, `PredictPage.jsx`, `PlaygroundPage.jsx`
  - API service: `src/services/api.js` (axios, baseURL dari `VITE_API_BASE_URL` atau `/api`)
- **Backend:** Express via `server.ts` (root)
  - Routes: `/api/models`, `/api/predict`, `/api/train-evaluate`
  - Python bridge: `backend/src/services/pythonBridge.js`
- **Python scripts:** `predict_knn.py`, `predict_dt.py`, `predict_rf.py`, `evaluate_model.py`, `train_rf.py`
- **Model files:** `backend/src/models/`
  - `car_price_knn_model.sav` (1.05 MB)
  - `car_price_DT_model.sav` (57 KB)
  - `car_price_rf_model.sav` (⚠️ belum ada — harus dilatih via `train_rf.py`)
  - `preprocessor_DT.sav` (1.12 KB)
- **Dataset:** `Car details v3 (1).csv` di root project

## Project State
- ✅ predict_knn.py: diupdate sesuai notebook baru (RobustScaler, log1p, fitur turunan, expm1)
- ✅ evaluate_model.py branch KNN: diupdate (RobustScaler, IQR 2.5x, log1p/expm1, fitur turunan)
- ✅ Inference scripts (predict_dt.py, predict_rf.py) sudah benar
- ✅ evaluate_model.py: mendukung knn, dt, dan rf
- ✅ PlaygroundPage: dropdown algoritma include Random Forest + panel hyperparameter RF
- ✅ ModelCard, ModelSelector: warna emerald untuk RF
- ✅ PredictPage: filter model include rf
- ✅ models.js: entry RF dengan deskripsi, pros, cons, hyperparameters
- ✅ pythonBridge.js: rf mapped ke predict_rf.py
- ⚠️ car_price_knn_model.sav WAJIB DILATIH ULANG dengan notebook baru (RobustScaler + log1p) — model lama tidak kompatibel
- ⚠️ car_price_rf_model.sav BELUM ADA — harus dilatih dulu via train_rf.py sebelum prediksi RF bisa berjalan
- ⚠️ PlaygroundPage "Simpan Model" hanya in-memory, reset saat server restart
- ⚠️ Evaluasi model di Playground melatih ulang dari awal (bukan load .sav) — ini by design
- ⚠️ playground.js route (train_playground.py) tidak didaftarkan di server.ts — route orphan, tidak bermasalah

## Known Issues / TODO
- [ ] **WAJIB: Latih model RF** — jalankan `python backend/src/scripts/train_rf.py` dari root project untuk generate `car_price_rf_model.sav`. Tanpa ini, prediksi RF akan gagal.
- [ ] Pastikan `pip install -r backend/src/scripts/requirements.txt` sudah dijalankan
- [ ] Pertimbangkan persistent storage untuk custom models

## Technical Decisions
- evaluate_model.py melatih model baru dari dataset asli dengan hyperparameter user, bukan load .sav — karena user bisa ubah hyperparameter sembarang yang tidak ada di .sav
- KNN di Playground tetap include torque/rpm agar konsisten dengan model asli; DT tanpa torque
- Deteksi overfitting otomatis: jika selisih R² train-test > 10pp, tampilkan peringatan
- Grafik Train vs Test menggunakan BarChart terpisah per metrik agar mudah dibandingkan secara visual

## Recent Changes
- **Checkpoint #9:** PlaygroundPage — interpretasi KNN-aware: threshold gap train-test & rasio RMSE dilonggarkan khusus KNN, label overfitting diganti 'Normal (KNN)', catatan kontekstual muncul di panel interpretasi
- **Checkpoint #8:** Update predict_knn.py & evaluate_model.py branch KNN — sesuaikan dengan notebook baru: RobustScaler, log1p target, fitur turunan (car_age/km_per_year/power_to_engine), IQR 2.5x, np.expm1() pada output
- **Checkpoint #7:** Tambah model Random Forest — predict_rf.py, train_rf.py, evaluate_model.py branch rf, models.js entry RF, UI emerald theme, Playground support RF
- **Checkpoint #6:** Fix parse error ResultDisplay
- **Checkpoint #5:** ResultDisplay — default Rp (IDR), tambah selector konversi USD/EUR/GBP/INR
- **Checkpoint #4:** Fix Rules of Hooks violation di PredictPage — useEffect kedua dipindah ke atas early return
- **Checkpoint #3:** Audit menyeluruh seluruh kode — tidak ada mock tersisa, semua path ke model real
- **Checkpoint #3:** Fix PredictionForm: tambah opsi `Manual` pada transmisi (sebelumnya hanya `Automatic`)
- **Checkpoint #3:** Fix PlaygroundPage `handleSave`: `features_used` untuk KNN kini include `torque_clean`, `rpm_min`, `rpm_max`
- **Checkpoint #2:** PlaygroundPage ditulis ulang total — simulasi JS diganti evaluasi Python asli
- **Checkpoint #2:** Tambah evaluate_model.py, route /api/train-evaluate, grafik Train vs Test
- **Checkpoint #1:** Tulis ulang predict_knn.py dan predict_dt.py sebagai inference scripts
- **Checkpoint #1:** Update pythonBridge.js dan requirements.txt
