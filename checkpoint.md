# Checkpoint #10 — Unifikasi Pipeline + Perbaikan RF
**Date:** 2026-06-11
**Triggered by:** user — pastikan RF jalan, 3 model akurat dan konsisten

## Files Changed
| File | Action |
|------|--------|
| `backend/src/scripts/predict_knn.py` | Rewrite bersih — pipeline konsisten |
| `backend/src/scripts/predict_dt.py` | Rewrite bersih — pipeline konsisten |
| `backend/src/scripts/predict_rf.py` | Rewrite bersih — pipeline konsisten |
| `backend/src/scripts/evaluate_model.py` | Rewrite total — pipeline identik semua model |
| `backend/src/scripts/train_all_models.py` | **BARU** — latih KNN+DT+RF sekaligus |
| `backend/src/scripts/verify_models.py` | **BARU** — verifikasi cepat semua .sav |
| `backend/src/scripts/_test_models.py` | **BARU** — diagnosa detail pipeline |
| `backend/src/services/modelStore.js` | Update features_used semua model |
| `src/components/PredictionForm.jsx` | Selalu tampilkan torque/rpm (semua model butuh) |

## Summary

### Masalah utama yang diselesaikan
1. **Pipeline inkonsisten** — KNN, DT, RF sebelumnya pakai preprocessing berbeda. Sekarang **semua model identik**:
   - `RobustScaler` + `OneHotEncoder`
   - Target: `np.log1p(selling_price)` → output: `np.expm1(pred)`
   - Outlier: IQR 2.5x
   - Fitur turunan: `car_age`, `km_per_year`, `power_to_engine`
   - `CURRENT_YEAR` dinamis (bukan hardcoded 2026)
   - Torque/RPM untuk semua model

2. **RF tidak punya .sav** → sekarang ada script `train_all_models.py` yang melatih ketiganya

3. **`evaluate_model.py` branch berbeda per model** → ditulis ulang dengan satu pipeline unified

### Pipeline standar (WAJIB sama antara train & predict)
```
Dataset → clean units → extract torque/rpm → fill median → IQR 2.5x outlier
→ derived features (car_age, km_per_year, power_to_engine)
→ train/test split 70/30 random_state=15
→ ColumnTransformer: RobustScaler (num) + OneHotEncoder (cat)
→ model.fit(X_train, log1p(y_train))
→ predict → expm1(output) = harga INR
```

## AKSI WAJIB setelah checkpoint ini

### Langkah 1 — Verifikasi .sav yang sudah ada
```bash
cd "E:\Workspace\Project Kolab\Prediksi_Model"
python backend/src/scripts/verify_models.py
```

**Jika semua ✅ OK** → tidak perlu retrain, langsung ke langkah 3.

**Jika ada ❌ FAIL atau ⚠️ WARNING** → lanjut ke langkah 2.

### Langkah 2 — Retrain model yang bermasalah
```bash
# Latih ulang semua (paling aman):
python backend/src/scripts/train_all_models.py

# Atau spesifik:
python backend/src/scripts/train_all_models.py rf
python backend/src/scripts/train_all_models.py knn dt
```
Estimasi waktu: KNN ~30 detik, DT ~1 menit, RF ~3-5 menit (pakai semua CPU).

### Langkah 3 — Verifikasi ulang setelah retrain
```bash
python backend/src/scripts/verify_models.py
```
Semua harus ✅ OK dengan harga dalam range 50K–50M INR.

### Langkah 4 — Jalankan server
```bash
npm run dev
```

## How to Restore
- Revert semua file yang diubah di checkpoint ini ke versi checkpoint #9
- Hapus `train_all_models.py`, `verify_models.py`, `_test_models.py`

---

## Checkpoint #9 — Interpretasi KNN-Aware di PlaygroundPage
*(lihat entri sebelumnya)*
