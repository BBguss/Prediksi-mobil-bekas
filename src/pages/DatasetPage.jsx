import { useEffect, useMemo, useRef, useState } from 'react';
import { getDatasetPreview, getActiveDataset, uploadDataset, resetDataset } from '../services/api';

function ImportPanel({ onImportSuccess }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging]       = useState(false);
  const [file, setFile]               = useState(null);
  const [status, setStatus]           = useState(null); // null | 'validating' | 'uploading' | 'done' | 'error'
  const [message, setMessage]         = useState('');
  const [warnings, setWarnings]       = useState([]);
  const [preview, setPreview]         = useState(null); // { rowCount, columns, detectedCurrency }
  const [currency, setCurrency]       = useState('auto'); // 'auto' | 'INR' | 'IDR' | 'USD'

  const REQUIRED = [
    'year','selling_price','km_driven','fuel','seller_type',
    'transmission','owner','mileage','engine','max_power','seats',
  ];

  function handleFile(f) {
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      setStatus('error');
      setMessage('Hanya file .csv yang didukung.');
      return;
    }
    setFile(f);
    setStatus('validating');
    setMessage('');
    setWarnings([]);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || '';
      const firstLine = text.split('\n')[0] || '';
      const headers = firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const missing = REQUIRED.filter((c) => !headers.includes(c));

      if (missing.length > 0) {
        setStatus('error');
        setMessage(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`);
        return;
      }

      const rowCount = text.split('\n').filter((l) => l.trim()).length - 1;

      // Auto-detect currency by sampling selling_price
      const priceIdx = headers.indexOf('selling_price');
      let detectedCurrency = null;
      if (priceIdx >= 0) {
        const lines = text.split('\n').filter((l) => l.trim());
        const samples = [];
        for (let i = 1; i < Math.min(lines.length, 50); i++) {
          const cols = lines[i].split(',');
          const val = parseFloat((cols[priceIdx] || '').replace(/"/g, '').trim());
          if (Number.isFinite(val) && val > 0) samples.push(val);
        }
        if (samples.length > 0) {
          samples.sort((a, b) => a - b);
          const median = samples[Math.floor(samples.length / 2)];
          detectedCurrency = median >= 10_000_000 ? 'IDR' : 'INR';
        }
      }

      setPreview({ rowCount, columns: headers, detectedCurrency });
      setStatus('ready');
      setMessage('');
    };
    reader.readAsText(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }

  async function handleUpload() {
    if (!file || status !== 'ready') return;
    setStatus('uploading');
    setMessage('');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const explicitCurrency = currency === 'auto' ? null : currency;
          const result = await uploadDataset(e.target.result, file.name, explicitCurrency);
          setStatus('done');
          setMessage(result.message || 'Dataset berhasil diupload!');
          setWarnings(result.warnings || []);
          onImportSuccess?.();
        } catch (err) {
          setStatus('error');
          setMessage(err.response?.data?.error || err.message || 'Upload gagal.');
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Gagal membaca file.');
    }
  }

  function reset() {
    setFile(null);
    setStatus(null);
    setMessage('');
    setWarnings([]);
    setPreview(null);
    setCurrency('auto');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-cyan-400 bg-cyan-500/5' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {file ? (
            <div>
              <p className="text-sm font-medium text-gray-200">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-300">Klik atau seret file CSV ke sini</p>
              <p className="text-xs text-gray-500 mt-1">Format: .csv dengan kolom standar dataset kendaraan</p>
            </div>
          )}
        </div>
      </div>

      {/* Status / preview */}
      {status === 'validating' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
          Memvalidasi kolom CSV...
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {message}
        </div>
      )}

      {status === 'done' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-300">
          {message}
          {warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-yellow-400 text-xs flex items-start gap-1">
                  <span className="mt-0.5">⚠</span> {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === 'ready' && preview && (
        <div className="bg-[#0f1117] border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Validasi Berhasil</span>
            <span className="text-xs text-emerald-400 font-medium">{preview.rowCount.toLocaleString()} baris data</span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1.5">Kolom terdeteksi:</p>
            <div className="flex flex-wrap gap-1">
              {preview.columns.map((c) => (
                <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  REQUIRED.includes(c)
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}>{c}</span>
              ))}
            </div>
          </div>

          {/* Currency selector */}
          <div className="border-t border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Mata Uang Harga</p>
              {preview.detectedCurrency && (
                <span className="text-[10px] text-emerald-400">
                  Terdeteksi: {preview.detectedCurrency}
                </span>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { code: 'auto', label: 'Otomatis' },
                { code: 'INR', label: 'INR (Rupee)' },
                { code: 'IDR', label: 'IDR (Rupiah)' },
                { code: 'USD', label: 'USD (Dollar)' },
              ].map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    currency === c.code
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Pilih mata uang kolom <code className="text-gray-400">selling_price</code>. Default "Otomatis" akan mendeteksi berdasarkan skala nilai.
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {file && status !== 'uploading' && (
          <button onClick={reset} className="px-4 py-2 rounded-md border border-gray-700 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors">
            Reset
          </button>
        )}
        <button
          onClick={handleUpload}
          disabled={status !== 'ready'}
          className="flex-1 py-2 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {status === 'uploading' ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Mengupload...</>
          ) : (
            'Aktifkan Dataset Ini'
          )}
        </button>
      </div>

      {/* Required columns info */}
      <div className="text-[11px] text-gray-600 leading-relaxed">
        <span className="text-cyan-400">Wajib:</span> {REQUIRED.join(', ')} &nbsp;|&nbsp;
        <span className="text-gray-500">Opsional:</span> torque, name
      </div>
    </div>
  );
}

export default function DatasetPage() {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [page, setPage]                 = useState(1);
  const [limit, setLimit]               = useState(20);
  const [data, setData]                 = useState(null);
  const [activeInfo, setActiveInfo]     = useState(null);
  const [showImport, setShowImport]     = useState(false);
  const [resetting, setResetting]       = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, info] = await Promise.all([
        getDatasetPreview(page, limit),
        getActiveDataset(),
      ]);
      setData(result);
      setActiveInfo(info);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat dataset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, limit]);

  const handleImportSuccess = () => {
    setShowImport(false);
    setPage(1);
    load();
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDataset();
      setPage(1);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mereset dataset.');
    } finally {
      setResetting(false);
    }
  };

  const rows    = data?.rows || [];
  const columns = useMemo(() => data?.columns?.map((c) => c.name) || [], [data]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Informasi Dataset</h1>
        <p className="text-gray-400 mt-2">Lihat, ganti, atau impor dataset baru untuk melatih semua model.</p>
      </div>

      {/* Active dataset banner */}
      {activeInfo && (
        <div className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
          activeInfo.is_custom
            ? 'bg-purple-500/5 border-purple-500/30'
            : 'bg-[#1a1d27] border-gray-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activeInfo.is_custom ? 'bg-purple-500/20' : 'bg-cyan-500/10'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeInfo.is_custom ? 'text-purple-400' : 'text-cyan-400'}>
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-200">{activeInfo.filename}</p>
              <p className="text-xs text-gray-500">
                {activeInfo.is_custom
                  ? `Dataset kustom · diupload ${new Date(activeInfo.uploaded_at).toLocaleDateString('id-ID')}`
                  : 'Dataset bawaan aplikasi'}
              </p>
              {activeInfo.price_currency && (
                <p className="text-[11px] text-emerald-400 mt-0.5">
                  Mata uang harga: <strong>{activeInfo.price_currency}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {activeInfo.is_custom && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-500 disabled:opacity-50 transition-colors"
              >
                {resetting ? 'Mereset...' : 'Pakai Default'}
              </button>
            )}
            <button
              onClick={() => setShowImport((v) => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showImport
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {showImport ? 'Tutup' : 'Import Dataset CSV'}
            </button>
          </div>
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
          <h2 className="text-base font-semibold mb-1">Import Dataset Baru</h2>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Upload file CSV untuk mengganti dataset aktif. Semua evaluasi, training Playground, dan retrain akan menggunakan dataset baru ini.
            Kolom yang dibutuhkan sama dengan dataset asli. Model prediksi bawaan (KNN/DT/RF) tidak terpengaruh karena sudah terlatih — hanya evaluasi dan model kustom baru yang dilatih ulang dari dataset ini.
          </p>
          <ImportPanel onImportSuccess={handleImportSuccess} />
        </div>
      )}

      {/* Metadata cards */}
      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Nama Dataset</div>
            <div className="font-medium truncate">{data?.dataset_name || '-'}</div>
          </div>
          <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Jumlah Baris</div>
            <div className="font-medium">{data?.total_rows?.toLocaleString() || '-'}</div>
          </div>
          <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Label Target</div>
            <div className="font-medium text-cyan-300">{data?.label_column || '-'}</div>
          </div>
        </div>

        <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Fitur Yang Tersedia</div>
          <div className="flex flex-wrap gap-2">
            {(data?.feature_columns || []).map((f) => (
              <span key={f} className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-200 border border-gray-700">{f}</span>
            ))}
          </div>
        </div>

        <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Penjelasan Kolom</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(data?.columns || []).map((c) => (
              <div key={c.name} className="text-xs text-gray-300 border border-gray-800 rounded-md px-2.5 py-2">
                <span className={`font-semibold ${c.is_label ? 'text-cyan-300' : 'text-gray-200'}`}>{c.name}</span>: {c.description}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">Preview Tabel Dataset</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Rows/Page</label>
            <select
              className="bg-[#0f1117] border border-gray-700 rounded-md px-2 py-1 text-sm"
              value={limit}
              onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
            >
              {[10, 20, 30, 50].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

        <div className="overflow-auto border border-gray-800 rounded-lg dataset-table-wrap">
          <table className="min-w-full text-sm dataset-table">
            <thead className="dataset-table-head">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs uppercase tracking-wider border-b whitespace-nowrap dataset-table-th">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-8 text-gray-400" colSpan={Math.max(columns.length, 1)}>Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-3 py-8 text-gray-400" colSpan={Math.max(columns.length, 1)}>Tidak ada data.</td></tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className={`dataset-table-row ${idx % 2 === 0 ? 'dataset-table-row-even' : 'dataset-table-row-odd'}`}>
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 border-b whitespace-nowrap dataset-table-td">
                        {row[col] === null || row[col] === undefined || row[col] === '' ? '-' : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Halaman {data?.page || page} dari {data?.total_pages || 1}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-md bg-[#0f1117] border border-gray-700 text-sm hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={(data?.page || page) <= 1 || loading}
            >
              Sebelumnya
            </button>
            <button
              className="px-3 py-1.5 rounded-md bg-[#0f1117] border border-gray-700 text-sm hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
              onClick={() => setPage((p) => p + 1)}
              disabled={(data?.page || page) >= (data?.total_pages || 1) || loading}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
