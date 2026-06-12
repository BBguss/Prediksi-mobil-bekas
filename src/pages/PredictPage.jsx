import { useRef, useState, useEffect, useCallback } from 'react';
import {
  getModels, predict, getFeedbackStats, triggerRetrain,
  getActiveDataset, uploadCsvPredict,
} from '../services/api';
import { getRatesFromINR, convertFromINR, CURRENCY_META } from '../services/currencyService';
import ModelSelector from '../components/ModelSelector';
import PredictionForm from '../components/PredictionForm';
import ResultDisplay from '../components/ResultDisplay';
import { addPredictionHistory } from '../services/history';
import { Link } from 'react-router-dom';

// Builtin models — tampil sebelum API selesai sehingga halaman tidak blank
const BUILTIN_MODELS = [
  { id: 'knn', name: 'KNN Regressor',          algorithm: 'K-Nearest Neighbors', builtin: true },
  { id: 'dt',  name: 'Decision Tree Regressor', algorithm: 'Decision Tree',       builtin: true },
  { id: 'rf',  name: 'Random Forest Regressor', algorithm: 'Random Forest',       builtin: true },
];

const BATCH_REQUIRED = [
  'year','km_driven','fuel','seller_type','transmission',
  'owner','mileage','engine','max_power','seats',
];

// ── Dataset Banner ────────────────────────────────────────────────────────────
function DatasetBanner({ info }) {
  if (!info) return null;
  return (
    <Link to="/dataset" className="block">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors hover:opacity-80 ${
        info.is_custom ? 'bg-purple-500/5 border-purple-500/20 text-purple-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'
      }`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
        </svg>
        <span>
          Dataset aktif: <span className="font-medium text-gray-200">{info.filename}</span>
          {info.is_custom && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">kustom</span>}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto opacity-50">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </Link>
  );
}

// ── Batch Predict Panel ───────────────────────────────────────────────────────
function BatchPredictPanel({ models, activeDataset, rates }) {
  const fileRef     = useRef(null);
  const [dragging, setDragging]   = useState(false);
  const [csvFile, setCsvFile]     = useState(null);
  const [csvContent, setCsvContent] = useState('');
  const [csvInfo, setCsvInfo]     = useState(null);
  const [csvError, setCsvError]   = useState('');
  const [selectedModelId, setSelectedModelId] = useState('knn');
  const [predicting, setPredicting] = useState(false);
  const [results, setResults]     = useState(null);
  const [apiError, setApiError]   = useState('');
  const [currency, setCurrency]   = useState('IDR');
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 20;

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];

  function parseAndValidateCsv(text, filename) {
    setCsvError(''); setCsvInfo(null); setResults(null); setApiError('');
    const lines   = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { setCsvError('File CSV minimal 2 baris (header + 1 data).'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
    const missing = BATCH_REQUIRED.filter(c => !headers.includes(c));
    setCsvContent(text);
    setCsvInfo({ rows: lines.length - 1, columns: headers, missing, filename });
    if (missing.length > 0) setCsvError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`);
  }

  function handleFile(f) {
    if (!f) return;
    if (!f.name.endsWith('.csv')) { setCsvError('Hanya file .csv yang didukung.'); return; }
    setCsvFile(f);
    const reader = new FileReader();
    reader.onload = e => parseAndValidateCsv(e.target.result || '', f.name);
    reader.readAsText(f);
  }

  function handleDrop(e) { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }

  function resetFile() {
    setCsvFile(null); setCsvContent(''); setCsvInfo(null); setCsvError(''); setResults(null); setApiError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleBatchPredict() {
    if (!csvContent || !selectedModelId || csvInfo?.missing?.length > 0) return;
    setPredicting(true); setApiError(''); setResults(null); setPage(1);
    try {
      setResults(await uploadCsvPredict(csvContent, selectedModelId));
    } catch (err) {
      setApiError(err.response?.data?.error || err.message || 'Prediksi batch gagal.');
    } finally { setPredicting(false); }
  }

  function fmtPrice(inr, code) {
    const meta = CURRENCY_META.find(c => c.code === code) || CURRENCY_META[0];
    return `${meta.symbol} ${Math.round(convertFromINR(inr, code, rates)).toLocaleString(meta.locale)}`;
  }

  function exportCsv() {
    if (!results?.predictions) return;
    const header = ['No','year','km_driven','fuel','transmission','owner',`predicted_price_${currency}`].join(',');
    const rows   = results.predictions.map((r,i) => [i+1,r.features?.year??'',r.features?.km_driven??'',r.features?.fuel??'',r.features?.transmission??'',r.features?.owner??'',Math.round(convertFromINR(r.prediction,currency,rates))].join(','));
    const blob   = new Blob([header+'\n'+rows.join('\n')],{type:'text/csv'});
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a'); a.href=url; a.download=`batch_predictions_${selectedModelId}_${currency}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const preds      = results?.predictions || [];
  const pStart     = (page-1)*PAGE_SIZE;
  const paginated  = preds.slice(pStart,pStart+PAGE_SIZE);
  const totalPages = Math.ceil(preds.length/PAGE_SIZE);
  const prices     = preds.map(r=>r.prediction);
  const avg        = prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : 0;

  return (
    <div className="space-y-6">
      {activeDataset && (
        <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Dataset aktif</p>
          <p className="text-sm font-medium text-gray-200">{activeDataset.filename}</p>
          <p className="text-xs text-gray-500 mt-0.5">{activeDataset.is_custom ? 'Dataset kustom' : 'Dataset bawaan'} · <Link to="/dataset" className="text-cyan-400 hover:underline">Ganti dataset</Link></p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">1. Pilih Model Prediksi</p>
        <ModelSelector models={models} selectedId={selectedModelId} onSelect={id => { setSelectedModelId(id); setResults(null); }} />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">2. Upload File CSV</p>
        {!csvFile ? (
          <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging?'border-cyan-400 bg-cyan-500/5':'border-gray-700 hover:border-gray-500 hover:bg-gray-800/30'}`}>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>handleFile(e.target.files[0])} />
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div>
                <p className="text-sm text-gray-300 font-medium">Seret file CSV ke sini, atau klik untuk memilih</p>
                <p className="text-xs text-gray-500 mt-1">Kolom wajib: {BATCH_REQUIRED.slice(0,5).join(', ')} + {BATCH_REQUIRED.length-5} lainnya</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">{csvInfo?.filename}</p>
                  <p className="text-xs text-gray-500">{csvInfo?.rows?.toLocaleString()} baris · {csvInfo?.columns?.length} kolom</p>
                </div>
              </div>
              <button onClick={resetFile} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors">Ganti</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {csvInfo?.columns?.map(c => (
                <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full border ${BATCH_REQUIRED.includes(c)?'bg-cyan-500/10 border-cyan-500/30 text-cyan-300':'bg-gray-800 border-gray-700 text-gray-500'}`}>{c}</span>
              ))}
            </div>
            {csvError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">{csvError}</div>}
          </div>
        )}
      </div>

      {csvFile && !csvError && (
        <button onClick={handleBatchPredict} disabled={predicting}
          className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {predicting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/> Memprediksi {csvInfo?.rows} baris...</> : <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Prediksi {csvInfo?.rows?.toLocaleString()} Baris dengan {selectedModel?.name}
          </>}
        </button>
      )}

      {apiError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{apiError}</div>}

      {results && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Total Baris', value:results.total_rows?.toLocaleString(), sub:'data diprediksi' },
              { label:'Rata-rata',   value:fmtPrice(avg,currency), sub:'harga prediksi' },
              { label:'Terendah',    value:fmtPrice(Math.min(...prices),currency), sub:'harga prediksi' },
              { label:'Tertinggi',   value:fmtPrice(Math.max(...prices),currency), sub:'harga prediksi' },
            ].map(s => (
              <div key={s.label} className="bg-[#1a1d27] border border-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-sm font-bold text-gray-100 truncate">{s.value}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Mata uang:</span>
              <div className="flex gap-1">
                {CURRENCY_META.map(c => (
                  <button key={c.code} onClick={()=>setCurrency(c.code)}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${currency===c.code?'bg-cyan-500/20 border-cyan-500/50 text-cyan-300':'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}>
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>

          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-800 bg-[#0f1117]">
                  <tr>{['#','Tahun','KM','Bahan Bakar','Transmisi','Pemilik','Mesin (cc)','Power (bhp)','Prediksi Harga'].map(h=>(
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {paginated.map(r => (
                    <tr key={r.index} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-2 text-xs text-gray-600 tabular-nums">{r.index+1}</td>
                      <td className="px-3 py-2 text-gray-300 tabular-nums">{r.features?.year??'-'}</td>
                      <td className="px-3 py-2 text-gray-300 tabular-nums">{r.features?.km_driven?.toLocaleString()??'-'}</td>
                      <td className="px-3 py-2 text-gray-300">{r.features?.fuel??'-'}</td>
                      <td className="px-3 py-2 text-gray-300">{r.features?.transmission??'-'}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{r.features?.owner??'-'}</td>
                      <td className="px-3 py-2 text-gray-300 tabular-nums">{r.features?.engine?.toLocaleString()??'-'}</td>
                      <td className="px-3 py-2 text-gray-300 tabular-nums">{r.features?.max_power??'-'}</td>
                      <td className="px-3 py-2 font-semibold text-cyan-300 tabular-nums whitespace-nowrap">{fmtPrice(r.prediction,currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-[#0f1117]">
                <span className="text-xs text-gray-500">{pStart+1}–{Math.min(pStart+PAGE_SIZE,preds.length)} dari {preds.length} baris</span>
                <div className="flex gap-2">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="px-3 py-1 rounded border border-gray-700 text-xs text-gray-400 disabled:opacity-40 hover:border-gray-500 transition-colors">← Prev</button>
                  <span className="px-3 py-1 text-xs text-gray-400">{page}/{totalPages}</span>
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} className="px-3 py-1 rounded border border-gray-700 text-xs text-gray-400 disabled:opacity-40 hover:border-gray-500 transition-colors">Next →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PredictPage() {
  // Mulai dengan BUILTIN_MODELS langsung — halaman tidak akan blank
  const [models, setModels]               = useState(BUILTIN_MODELS);
  const [selectedModelId, setSelectedModelId] = useState('knn');
  const [modelsLoaded, setModelsLoaded]   = useState(false);
  const [predicting, setPredicting]       = useState(false);
  const [result, setResult]               = useState(null);
  const [lastFeatures, setLastFeatures]   = useState(null);
  const [error, setError]                 = useState(null);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [retraining, setRetraining]       = useState(false);
  const [retrainResult, setRetrainResult] = useState(null);
  const [activeDataset, setActiveDataset] = useState(null);
  const [mode, setMode]                   = useState('manual');
  const [rates, setRates]                 = useState(null);
  const [ratesSource, setRatesSource]     = useState('');

  // Fetch models + dataset + rates secara paralel — background, tidak block UI
  useEffect(() => {
    Promise.allSettled([
      getModels(),
      getActiveDataset(),
      getRatesFromINR(),
      getFeedbackStats(),
    ]).then(([modelsRes, datasetRes, ratesRes, statsRes]) => {
      if (modelsRes.status === 'fulfilled') { setModels(modelsRes.value); setModelsLoaded(true); }
      if (datasetRes.status === 'fulfilled') setActiveDataset(datasetRes.value);
      if (ratesRes.status === 'fulfilled') { setRates(ratesRes.value); setRatesSource(ratesRes.value._source); }
      if (statsRes.status === 'fulfilled') setFeedbackStats(statsRes.value);
    });
  }, []);

  useEffect(() => {
    if (models.length > 0 && !models.some(m => m.id === selectedModelId))
      setSelectedModelId(models[0].id);
  }, [models, selectedModelId]);

  const handlePredict = useCallback(async (features) => {
    setPredicting(true); setError(null); setLastFeatures(features);
    try {
      const data = await predict(selectedModelId, features);
      setResult(data);
      const mdl = models.find(m => m.id === selectedModelId);
      addPredictionHistory({
        id        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt : new Date().toISOString(),
        modelId   : selectedModelId,
        modelName : mdl?.name || selectedModelId,
        features,
        prediction: data?.prediction ?? null,
        modelUsed : data?.model_used || mdl?.algorithm || selectedModelId,
      });
      getFeedbackStats().then(setFeedbackStats).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Prediksi gagal');
    } finally { setPredicting(false); }
  }, [selectedModelId, models]);

  const handleRetrain = async (strictLabel = false) => {
    setRetraining(true); setRetrainResult(null);
    try {
      const mdl = models.find(m => m.id === selectedModelId) || models[0];
      const res = await triggerRetrain(mdl?.algorithm || selectedModelId, mdl?.hyperparameters || {}, null, strictLabel);
      setRetrainResult(res);
      getModels().then(setModels).catch(() => {});
      getFeedbackStats().then(setFeedbackStats).catch(() => {});
    } catch (err) {
      setRetrainResult({ error: err.response?.data?.error || err.message });
    } finally { setRetraining(false); }
  };

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Mesin Prediksi Harga</h1>
          <p className="text-gray-400 text-sm">Prediksi harga kendaraan secara manual atau batch dari file CSV.</p>
        </div>
        {/* Live rate badge */}
        {rates && (
          <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-gray-700 text-gray-400">
            <span className={`w-1.5 h-1.5 rounded-full ${ratesSource === 'live' ? 'bg-green-400' : 'bg-amber-400'}`}/>
            Kurs {ratesSource === 'live' ? 'live' : 'fallback'} · 1 INR = Rp {rates.IDR?.toFixed(1) ?? '–'}
          </div>
        )}
      </div>

      <div className="mb-4"><DatasetBanner info={activeDataset} /></div>

      {/* Mode tabs */}
      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-1.5 flex gap-1.5 mb-6">
        {[
          { key:'manual', label:'Prediksi Manual', icon:<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
          { key:'batch',  label:'Prediksi Batch CSV', icon:<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setMode(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === tab.key ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Manual mode */}
      {mode === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-5">
            <ModelSelector models={models} selectedId={selectedModelId} onSelect={setSelectedModelId} />
            <div className="bg-[#1a1d27] p-6 rounded-xl border border-gray-800">
              <h2 className="text-lg font-semibold mb-5 border-b border-gray-800 pb-3">Spesifikasi Kendaraan</h2>
              {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-400 text-sm">{error}</div>}
              <PredictionForm selectedModel={selectedModel} onSubmit={handlePredict} isLoading={predicting} />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-4">
              <ResultDisplay result={result} isLoading={predicting} model={selectedModel} features={lastFeatures} rates={rates} />

              {feedbackStats && feedbackStats.total > 0 && (
                <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-1.5">Perbarui Model dari Feedback</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    {feedbackStats.with_actual_price} data berlabel + {feedbackStats.prediction_only} prediksi terkumpul.
                    {feedbackStats.with_actual_price >= 5 ? ' Siap retrain.' : ' Disarankan min. 5 berlabel.'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleRetrain(false)} disabled={retraining || feedbackStats.total === 0}
                      className="py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                      {retraining ? 'Melatih...' : 'Hybrid'}
                    </button>
                    <button onClick={() => handleRetrain(true)} disabled={retraining || feedbackStats.with_actual_price === 0}
                      className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                      {retraining ? 'Melatih...' : 'Strict Label'}
                    </button>
                  </div>
                  {retrainResult && (
                    <div className={`mt-2 text-xs ${retrainResult.error ? 'text-red-400' : 'text-emerald-400'}`}>
                      {retrainResult.error || `✅ Model "${retrainResult.model?.name}" berhasil dibuat!`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'batch' && <BatchPredictPanel models={models} activeDataset={activeDataset} rates={rates} />}
    </div>
  );
}
