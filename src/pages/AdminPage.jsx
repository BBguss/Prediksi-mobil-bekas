import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdminStats, getAdminPredictions, setAdminPredSelection,
  previewAdminRetrain, triggerAdminRetrain,
  getAdminTrainingLogs, getAdminRetrains, adminGetMe,
} from '../services/api';
import { CURRENCY_META, convertFromINR, getRatesFromINR } from '../services/currencyService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ text, color = 'gray' }) {
  const cls = {
    cyan  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    amber : 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    green : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    red   : 'bg-red-500/10 border-red-500/30 text-red-300',
    gray  : 'bg-gray-800 border-gray-700 text-gray-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${cls[color]||cls.gray}`}>{text}</span>;
}

function StatCard({ label, value, sub, accent = 'text-cyan-400' }) {
  return (
    <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${accent}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

const algoColor = (a = '') => {
  const t = a.toLowerCase();
  if (t.includes('knn') || t.includes('nearest')) return 'cyan';
  if (t.includes('forest') || t === 'rf') return 'green';
  if (t.includes('tree') || t === 'dt') return 'amber';
  return 'gray';
};
const statusColor = s => ({ success: 'green', failed: 'red', pending: 'amber' }[s] || 'gray');
const fmtDt = s => s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const ALGO_NAMES = { knn: 'KNN Regressor', dt: 'Decision Tree Regressor', rf: 'Random Forest Regressor' };
const VERDICT_COLOR = { excellent: 'text-green-400', good: 'text-cyan-400', fair: 'text-amber-400', poor: 'text-red-400' };

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const navigate = useNavigate();

  const [tab, setTab]       = useState('predictions');
  const [adminName, setAdminName] = useState('');
  const [stats, setStats]   = useState(null);
  const [preds, setPreds]   = useState({ data: [], total: 0 });
  const [trainLogs, setTrainLogs] = useState({ data: [], total: 0 });
  const [retrains, setRetrains]   = useState({ data: [], total: 0 });
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rates, setRates]   = useState(null);
  const [currency, setCurrency]   = useState('IDR');

  const [selected, setSelected]   = useState(new Set());
  const [predFilter, setPredFilter] = useState('');

  const [rtAlgo, setRtAlgo] = useState('rf');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rtRunning, setRtRunning] = useState(false);
  const [rtResult, setRtResult]   = useState(null);
  const [rtError, setRtError]     = useState('');

  // Selalu baca token fresh dari localStorage — tidak dari state/closure
  const getToken = () => localStorage.getItem('admin_token');

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    navigate('/admin/login', { replace: true });
  };

  const fmtPrice = useCallback((inr) => {
    if (!inr) return '—';
    const m = CURRENCY_META.find(c => c.code === currency) || CURRENCY_META[0];
    return `${m.symbol} ${Math.round(convertFromINR(inr, currency, rates)).toLocaleString(m.locale)}`;
  }, [currency, rates]);

  // Auth check saat mount
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate('/admin/login', { replace: true }); return; }
    setAdminName(localStorage.getItem('admin_username') || 'admin');
    adminGetMe().catch(() => {
      localStorage.removeItem('admin_token');
      navigate('/admin/login', { replace: true });
    });
  }, []); // eslint-disable-line

  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) { navigate('/admin/login', { replace: true }); return; }

    setLoading(true);
    setLoadError('');

    try {
      // Jalankan semua fetch — kalau ada yang error, tangkap individual
      const [statsRes, predsRes, trainRes, retrainsRes, ratesRes] = await Promise.allSettled([
        getAdminStats(),
        getAdminPredictions({ limit: 500 }),
        getAdminTrainingLogs({ limit: 100 }),
        getAdminRetrains({ limit: 50 }),
        getRatesFromINR(),
      ]);

      // Log semua error agar tidak silent
      const errors = [];

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        errors.push(`stats: ${statsRes.reason?.response?.data?.error || statsRes.reason?.message}`);
        console.error('[AdminPage] stats error:', statsRes.reason);
      }

      if (predsRes.status === 'fulfilled') {
        const data = predsRes.value?.data ?? [];
        setPreds({ data, total: predsRes.value?.total ?? 0 });
        // Sync checkbox state dari DB
        setSelected(new Set(data.filter(p => p.selected_for_training).map(p => p.id)));
      } else {
        errors.push(`predictions: ${predsRes.reason?.response?.data?.error || predsRes.reason?.message}`);
        console.error('[AdminPage] predictions error:', predsRes.reason);
      }

      if (trainRes.status === 'fulfilled') {
        setTrainLogs(trainRes.value);
      } else {
        errors.push(`training-logs: ${trainRes.reason?.response?.data?.error || trainRes.reason?.message}`);
      }

      if (retrainsRes.status === 'fulfilled') {
        setRetrains(retrainsRes.value);
      } else {
        errors.push(`retrains: ${retrainsRes.reason?.response?.data?.error || retrainsRes.reason?.message}`);
      }

      if (ratesRes.status === 'fulfilled') {
        setRates(ratesRes.value);
      }

      if (errors.length) {
        setLoadError(`Beberapa data gagal dimuat: ${errors.join(' | ')}`);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Load saat mount — tunggu sampai auth check selesai sebentar
  useEffect(() => {
    const token = getToken();
    if (token) loadAll();
  }, []); // eslint-disable-line

  async function reloadStats() {
    try {
      const s = await getAdminStats();
      setStats(s);
    } catch (e) {
      console.error('[AdminPage] reloadStats error:', e);
    }
  }

  async function toggleRow(id, currentlySelected) {
    const newVal = !currentlySelected;
    const next = new Set(selected);
    newVal ? next.add(id) : next.delete(id);
    setSelected(next);
    try {
      await setAdminPredSelection([id], newVal);
      await reloadStats();
    } catch (e) {
      // Rollback on error
      const rollback = new Set(selected);
      setSelected(rollback);
      console.error('toggleRow error:', e);
    }
  }

  async function toggleAll(check) {
    const ids = filtered.map(p => p.id);
    if (!ids.length) return;
    const next = new Set(selected);
    ids.forEach(id => check ? next.add(id) : next.delete(id));
    setSelected(next);
    try {
      await setAdminPredSelection(ids, check);
      await reloadStats();
    } catch (e) {
      console.error('toggleAll error:', e);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true); setPreviewResult(null); setRtError('');
    try {
      setPreviewResult(await previewAdminRetrain(rtAlgo));
    } catch (err) {
      setRtError(err.response?.data?.error || err.message);
    } finally { setPreviewLoading(false); }
  }

  async function handleRetrain() {
    if (!previewResult) return;
    setRtRunning(true); setRtResult(null); setRtError('');
    try {
      const res = await triggerAdminRetrain(rtAlgo);
      setRtResult(res);
      setPreviewResult(null);
      await loadAll();
    } catch (err) {
      setRtError(err.response?.data?.details || err.response?.data?.error || err.message || 'Retrain gagal');
    } finally { setRtRunning(false); }
  }

  const filtered = preds.data.filter(p =>
    !predFilter ||
    p.model_id?.toLowerCase().includes(predFilter.toLowerCase()) ||
    p.algorithm?.toLowerCase().includes(predFilter.toLowerCase())
  );
  const selectedCount = selected.size;
  const filteredSelectedCount = filtered.filter(p => selected.has(p.id)).length;

  const chartData = trainLogs.data.slice(0, 50).reverse().map((l, i) => ({
    i: i + 1,
    r2: l.r2_test != null ? parseFloat((l.r2_test * 100).toFixed(2)) : null,
  }));

  if (loading) return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        <p className="text-sm text-gray-400">Memuat panel admin...</p>
      </div>
    </div>
  );

  const tabs = [
    { key: 'predictions', label: `Data Prediksi (${preds.total})` },
    { key: 'retrain',     label: 'Retrain Model' },
    { key: 'training',    label: `Log Training (${trainLogs.total})` },
    { key: 'history',     label: `Riwayat Retrain (${retrains.total})` },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-400 font-medium uppercase tracking-wider">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Model & Data</h1>
          <p className="text-gray-500 text-sm mt-0.5">Masuk sebagai <span className="text-gray-300 font-medium">{adminName}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {CURRENCY_META.map(c => (
              <button key={c.code} onClick={() => setCurrency(c.code)}
                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                  currency === c.code ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}>{c.code}</button>
            ))}
          </div>
          <button onClick={loadAll} title="Refresh"
            className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <button onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={loadAll} className="underline whitespace-nowrap hover:no-underline">Coba lagi</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Prediksi"   value={stats?.predictions?.total}    sub={`${stats?.predictions?.today ?? 0} hari ini`} accent="text-cyan-400" />
        <StatCard label="Dipilih Training" value={stats?.predictions?.selected ?? 0} sub="dari seluruh prediksi" accent="text-amber-400" />
        <StatCard label="Training Runs"    value={stats?.training?.total}        sub="dari Playground" accent="text-purple-400" />
        <StatCard label="Total Retrains"   value={retrains.total}                sub="oleh admin" accent="text-emerald-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1d27] border border-gray-800 rounded-xl p-1 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-gray-400 hover:text-gray-200'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB: DATA PREDIKSI ── */}
      {tab === 'predictions' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-300 mb-1">Cara kerja</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Centang data prediksi yang hasilnya wajar → tab <strong className="text-gray-200">Retrain Model</strong> → preview metrik → jika bagus, klik Retrain.
              Model builtin otomatis diperbarui — user tidak tahu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input value={predFilter} onChange={e => setPredFilter(e.target.value)}
              placeholder="Filter model/algoritma..."
              className="bg-[#1a1d27] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500 w-52" />
            <span className="text-xs text-gray-500">{filtered.length} baris · {selectedCount} dipilih</span>
            <button onClick={() => toggleAll(true)}  className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors">Pilih Semua</button>
            <button onClick={() => toggleAll(false)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors">Hapus Pilihan</button>
          </div>

          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#0f1117] border-b border-gray-800">
                  <tr>
                    <th className="px-3 py-2.5 w-10">
                      <input type="checkbox"
                        checked={filtered.length > 0 && filteredSelectedCount === filtered.length}
                        onChange={e => toggleAll(e.target.checked)}
                        className="accent-amber-500" />
                    </th>
                    {['Waktu', 'Model', 'Algoritma', 'Prediksi', 'Tahun', 'KM', 'Bahan Bakar', 'Transmisi'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filtered.slice(0, 300).map(p => {
                    const isSel = selected.has(p.id);
                    return (
                      <tr key={p.id} onClick={() => toggleRow(p.id, isSel)}
                        className={`cursor-pointer transition-colors ${isSel ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-gray-800/30'}`}>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleRow(p.id, isSel)} className="accent-amber-500" />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDt(p.created_at)}</td>
                        <td className="px-3 py-2 text-gray-300 text-xs max-w-[140px] truncate">{p.model_name}</td>
                        <td className="px-3 py-2"><Badge text={p.algorithm?.toUpperCase()} color={algoColor(p.algorithm)} /></td>
                        <td className="px-3 py-2 font-semibold text-cyan-300 tabular-nums text-xs whitespace-nowrap">
                          {p.prediction ? fmtPrice(p.prediction) : <span className="text-red-400 text-xs">error</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-400 tabular-nums text-xs">{p.features?.year ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-400 tabular-nums text-xs">{p.features?.km_driven?.toLocaleString() ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{p.features?.fuel ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{p.features?.transmission ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="p-10 text-center space-y-2">
                <p className="text-gray-400 text-sm font-medium">Belum ada data prediksi</p>
                <p className="text-gray-600 text-xs">Lakukan prediksi di halaman Prediksi, lalu kembali ke sini dan klik Refresh.</p>
                <button onClick={loadAll} className="mt-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/20 transition-colors">
                  Refresh sekarang
                </button>
              </div>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-amber-300">
                <span className="font-bold">{selectedCount} data</span> dipilih untuk training.
              </p>
              <button onClick={() => setTab('retrain')}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm whitespace-nowrap transition-colors">
                Lanjut ke Retrain →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: RETRAIN MODEL ── */}
      {tab === 'retrain' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">

            <div className={`rounded-xl border p-4 ${selectedCount > 0 ? 'bg-amber-500/5 border-amber-500/30' : 'bg-[#1a1d27] border-gray-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${selectedCount > 0 ? 'bg-amber-400' : 'bg-gray-600'}`} />
                <span className="text-sm font-medium text-gray-300">Data Terpilih</span>
              </div>
              {selectedCount === 0
                ? <p className="text-xs text-gray-500">Belum ada data dipilih. Pergi ke tab <strong className="text-gray-300">Data Prediksi</strong> dan centang baris yang ingin dipakai.</p>
                : <p className="text-xs text-gray-400"><span className="text-amber-300 font-bold text-lg">{selectedCount}</span> data siap digabung dengan dataset asli.</p>
              }
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Algoritma</label>
              <div className="grid grid-cols-3 gap-2">
                {[['rf', 'Random Forest', 'emerald'], ['knn', 'KNN', 'cyan'], ['dt', 'Decision Tree', 'amber']].map(([key, label, color]) => (
                  <button key={key} onClick={() => { setRtAlgo(key); setPreviewResult(null); }}
                    className={`p-3 rounded-lg border text-center transition-colors ${rtAlgo === key
                      ? `bg-${color}-500/10 border-${color}-500/40 text-${color}-300`
                      : 'bg-[#0f1117] border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                    <div className="font-bold text-sm">{key.toUpperCase()}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">{label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 1 */}
            <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-300">1</span>
                <span className="text-sm font-medium text-gray-300">Preview Metrik</span>
              </div>
              <p className="text-xs text-gray-500">Evaluasi performa model <strong className="text-gray-300">{ALGO_NAMES[rtAlgo]}</strong> saat ini sebelum memutuskan retrain.</p>
              <button onClick={handlePreview} disabled={previewLoading || selectedCount === 0}
                className="w-full py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {previewLoading ? 'Mengevaluasi...' : selectedCount === 0 ? 'Pilih data dulu di tab Data Prediksi' : `Evaluasi Model ${ALGO_NAMES[rtAlgo]}`}
              </button>

              {previewResult && (
                <div className={`rounded-lg p-4 border space-y-2 ${
                  previewResult.verdict === 'excellent' || previewResult.verdict === 'good'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : previewResult.verdict === 'fair'
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Hasil Evaluasi</span>
                    <span className={`text-sm font-bold ${VERDICT_COLOR[previewResult.verdict]}`}>{previewResult.verdict_label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-[10px] text-gray-500 mb-1">R² Test</div>
                      <div className={`text-xl font-bold tabular-nums ${VERDICT_COLOR[previewResult.verdict]}`}>
                        {previewResult.metrics.r2_pct != null ? `${previewResult.metrics.r2_pct}%` : '—'}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-[10px] text-gray-500 mb-1">RMSE Test</div>
                      <div className="text-xl font-bold tabular-nums text-gray-200">
                        {previewResult.metrics.rmse != null ? previewResult.metrics.rmse.toFixed(4) : '—'}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{previewResult.recommendation}</p>
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-300">2</span>
                <span className="text-sm font-medium text-gray-300">Retrain & Replace Model</span>
              </div>
              <p className="text-xs text-gray-500">
                File model builtin <strong className="text-gray-300">{ALGO_NAMES[rtAlgo]}</strong> akan langsung diganti.
                User langsung dapat prediksi lebih akurat tanpa perlu tahu.
              </p>
              <div className="text-[11px] text-amber-400/70 bg-amber-900/10 border border-amber-500/10 rounded-lg px-3 py-2">
                RF ~3-5 menit · KNN ~30 detik · DT ~1 menit
              </div>
              <button onClick={handleRetrain} disabled={rtRunning || !previewResult || selectedCount === 0}
                className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {rtRunning
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Melatih ulang...</>
                  : `Retrain & Perbarui ${rtAlgo.toUpperCase()}`}
              </button>
            </div>

            {rtResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-1">
                <p className="font-semibold text-emerald-300">✅ Retrain berhasil!</p>
                <p className="text-sm text-gray-300">{rtResult.message}</p>
                {rtResult.metrics && (
                  <p className="text-xs text-gray-500">
                    R²: <span className="text-emerald-400">{rtResult.metrics.r2_test != null ? `${(rtResult.metrics.r2_test * 100).toFixed(2)}%` : '—'}</span>
                    {' · '}RMSE: {rtResult.metrics.rmse_test?.toFixed(4) ?? '—'}
                  </p>
                )}
              </div>
            )}
            {rtError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{rtError}</div>}
          </div>

          {/* R² trend chart */}
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Tren R² Test (50 training terakhir)</h2>
            {chartData.length > 1 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="i" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f1117', borderColor: '#374151' }} formatter={v => [`${v}%`, 'R² Test']} />
                    <Line type="monotone" dataKey="r2" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-600 text-sm">Belum ada data training dari Playground.</div>
            )}
            <p className="text-xs text-gray-600 mt-3">≥85% sangat baik · 70–85% cukup · &lt;70% perlu perbaikan</p>
          </div>
        </div>
      )}

      {/* ── TAB: LOG TRAINING ── */}
      {tab === 'training' && (
        <div className="bg-[#1a1d27] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#0f1117] border-b border-gray-800">
                <tr>
                  {['Waktu', 'Algoritma', 'R² Train', 'R² Test', 'RMSE Test', 'Rows', 'Durasi (ms)', 'Sumber'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {trainLogs.data.slice(0, 200).map(l => (
                  <tr key={l.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDt(l.created_at)}</td>
                    <td className="px-3 py-2"><Badge text={l.algorithm?.toUpperCase()} color={algoColor(l.algorithm)} /></td>
                    <td className="px-3 py-2 tabular-nums text-gray-300 text-xs">{l.r2_train != null ? `${(l.r2_train * 100).toFixed(1)}%` : '—'}</td>
                    <td className={`px-3 py-2 tabular-nums font-semibold text-xs ${l.r2_test >= 0.85 ? 'text-green-400' : l.r2_test >= 0.7 ? 'text-amber-400' : 'text-red-400'}`}>
                      {l.r2_test != null ? `${(l.r2_test * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-300 text-xs">{l.rmse_test != null ? l.rmse_test.toFixed(4) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-400 text-xs">{l.dataset_rows?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-400 text-xs">{l.elapsed_ms != null ? l.elapsed_ms.toFixed(0) : '—'}</td>
                    <td className="px-3 py-2"><Badge text={l.source || 'playground'} color={l.source === 'admin' ? 'purple' : 'gray'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trainLogs.data.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">Belum ada log training. Coba evaluasi model di Playground.</div>
          )}
        </div>
      )}

      {/* ── TAB: RIWAYAT RETRAIN ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {retrains.data.length === 0 && (
            <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">Belum ada riwayat retrain admin.</div>
          )}
          {retrains.data.map(r => (
            <div key={r.id} className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge text={r.algorithm?.toUpperCase()} color={algoColor(r.algorithm)} />
                  <Badge text={r.status} color={statusColor(r.status)} />
                  {r.replaced_builtin ? <Badge text="Builtin diperbarui" color="green" /> : null}
                </div>
                <span className="text-xs text-gray-500">{fmtDt(r.created_at)}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase mb-0.5">Data terpilih</div>
                  <div className="font-semibold text-gray-200">{r.selected_count ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase mb-0.5">R² Test</div>
                  <div className={`font-semibold ${r.r2_after >= 0.85 ? 'text-green-400' : r.r2_after >= 0.7 ? 'text-amber-400' : r.r2_after != null ? 'text-red-400' : 'text-gray-500'}`}>
                    {r.r2_after != null ? `${(r.r2_after * 100).toFixed(2)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase mb-0.5">RMSE</div>
                  <div className="font-semibold text-gray-200">{r.rmse_after != null ? r.rmse_after.toFixed(4) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase mb-0.5">Selesai</div>
                  <div className="text-xs text-gray-400">{fmtDt(r.completed_at)}</div>
                </div>
              </div>
              {r.error && <p className="text-xs text-red-400 mt-3 bg-red-500/5 border border-red-500/20 rounded px-3 py-2">{r.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
