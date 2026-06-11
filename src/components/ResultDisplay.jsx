import { useEffect, useState } from 'react';
import { submitFeedback } from '../services/api';
import { convertFromINR, CURRENCY_META } from '../services/currencyService';

export default function ResultDisplay({ result, isLoading, model, features, rates }) {
  const [displayValue, setDisplayValue]   = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState('IDR');
  const [actualPrice, setActualPrice]     = useState('');
  const [feedbackSent, setFeedbackSent]   = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const baseCurrency    = result?.currency || model?.currency || 'INR';
  const curMeta         = CURRENCY_META.find(c => c.code === selectedCurrency) || CURRENCY_META[0];

  const convertedPrediction = (() => {
    if (!result?.prediction) return 0;
    if (baseCurrency === selectedCurrency) return result.prediction;
    // Base is always INR for builtin models
    return convertFromINR(result.prediction, selectedCurrency, rates);
  })();

  useEffect(() => { setFeedbackSent(false); setActualPrice(''); }, [result]);

  // Count-up animation
  useEffect(() => {
    if (!result?.prediction) { setDisplayValue(0); return; }
    const end       = convertedPrediction;
    let start       = 0;
    const duration  = 700;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setDisplayValue(end); clearInterval(timer); }
      else setDisplayValue(start);
    }, 16);
    return () => clearInterval(timer);
  }, [result, selectedCurrency, rates]);

  const handleFeedback = async () => {
    if (!features || !result?.prediction) return;
    setFeedbackLoading(true);
    try {
      await submitFeedback(features, actualPrice ? Number(actualPrice) : null, result.prediction, model?.id, baseCurrency);
      setFeedbackSent(true);
    } catch { alert('Gagal mengirim feedback.'); }
    finally { setFeedbackLoading(false); }
  };

  // Warna aksen per model
  const isKnn      = model?.id === 'knn' || (model?.algorithm||'').toLowerCase().includes('nearest');
  const isRf       = model?.id === 'rf'  || (model?.algorithm||'').toLowerCase().includes('forest');
  const bgAccent   = isKnn ? 'bg-cyan-500'   : isRf ? 'bg-emerald-500'   : 'bg-amber-500';
  const ringAccent = isKnn
    ? 'border-cyan-500 text-cyan-300 bg-cyan-500/20'
    : isRf
      ? 'border-emerald-500 text-emerald-300 bg-emerald-500/20'
      : 'border-amber-500 text-amber-300 bg-amber-500/20';

  const formatDisplay = (v) => Math.floor(v || 0).toLocaleString(curMeta.locale);

  const rateDisplay = rates
    ? `1 INR = ${curMeta.symbol} ${convertFromINR(1, selectedCurrency, rates).toFixed(selectedCurrency === 'IDR' ? 1 : 4)}`
    : null;

  if (!result && !isLoading) {
    return (
      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-8 h-full flex flex-col items-center justify-center text-center min-h-100">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
            <path d="M6 3h12"/><path d="M6 8h12"/><path d="M6 13l8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>
          </svg>
        </div>
        <h3 className="text-xl font-medium text-gray-300 mb-2">Menunggu Input</h3>
        <p className="text-sm text-gray-500 max-w-xs">Isi spesifikasi kendaraan dan klik prediksi untuk melihat perkiraan harga pasar.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-8 h-full flex flex-col relative overflow-hidden">
      <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-10 ${bgAccent}`}/>

      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Perkiraan Harga Pasar</h3>

      {/* Currency selector */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {CURRENCY_META.map(c => (
          <button key={c.code} onClick={() => setSelectedCurrency(c.code)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              selectedCurrency === c.code ? ringAccent : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
            }`}>
            {c.symbol} {c.code}
          </button>
        ))}
      </div>

      <div className="grow flex flex-col justify-center mb-8">
        {isLoading ? (
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-16 w-48 bg-gray-800 rounded-lg mb-4"/>
            <div className="h-4 w-32 bg-gray-800 rounded"/>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-2 font-mono">{curMeta.label}</div>
            <div className="flex items-center justify-center text-4xl sm:text-5xl font-bold font-mono tracking-tight mb-3 break-all">
              <span className="mr-2 text-3xl">{curMeta.symbol}</span>
              {formatDisplay(displayValue)}
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/50 border border-gray-700 text-xs font-medium mb-2">
              <span className={`w-2 h-2 rounded-full ${bgAccent}`}/>
              {result?.model_used}
            </div>

            {/* Kurs info */}
            {rateDisplay && selectedCurrency !== 'INR' && (
              <div className="text-[11px] text-gray-600 mt-1">{rateDisplay}</div>
            )}

            {selectedCurrency !== baseCurrency && result?.prediction && (
              <div className="text-[11px] text-gray-600 mt-0.5">
                Setara {baseCurrency === 'INR' ? '₹' : 'Rp'} {Math.floor(result.prediction).toLocaleString(baseCurrency === 'INR' ? 'en-IN' : 'id-ID')} {baseCurrency}
              </div>
            )}
          </div>
        )}
      </div>

      {result && !isLoading && (
        <div className="border-t border-gray-800 pt-6 mt-auto space-y-4">
          {/* Range bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-2 font-mono">
              <span>-15% ({curMeta.symbol} {formatDisplay(convertedPrediction * 0.85)})</span>
              <span>+15% ({curMeta.symbol} {formatDisplay(convertedPrediction * 1.15)})</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
              <div className="absolute top-0 bottom-0 left-1/4 right-1/4 bg-gray-700"/>
              <div className={`absolute top-0 bottom-0 left-1/2 w-1 -ml-0.5 ${bgAccent}`}/>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">Rentang Harga yang Diharapkan</p>
          </div>

          {/* Feedback */}
          <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Feedback Harga Aktual</h4>
            {feedbackSent ? (
              <div className="text-sm text-green-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
                Data tersimpan. Terima kasih atas feedback-nya!
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-500">Tahu harga aslinya? Masukkan di sini untuk membantu model belajar.</p>
                <div className="flex gap-2">
                  <input type="number" placeholder={`Harga aktual (${baseCurrency})`} value={actualPrice} onChange={e=>setActualPrice(e.target.value)}
                    className="flex-1 bg-[#1a1d27] border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500" />
                  <button onClick={handleFeedback} disabled={feedbackLoading}
                    className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium disabled:opacity-50 whitespace-nowrap">
                    {feedbackLoading ? '...' : actualPrice ? 'Kirim' : 'Simpan Prediksi'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600">
                  {actualPrice ? `Harga aktual (${baseCurrency}) akan dipakai sebagai label training.` : `Tanpa harga aktual, prediksi model dipakai sebagai fallback.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
