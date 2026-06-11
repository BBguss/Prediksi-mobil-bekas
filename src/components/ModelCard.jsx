import MetricsChart from './MetricsChart';

export default function ModelCard({ model }) {
  const isKnn = model.id === 'knn';
  const isRf  = model.id === 'rf';
  const accentColor = isKnn ? 'text-cyan-400' : isRf ? 'text-emerald-400' : 'text-amber-400';
  const borderColor = isKnn ? 'border-cyan-500/30' : isRf ? 'border-emerald-500/30' : 'border-amber-500/30';
  const bgHover = isKnn ? 'hover:border-cyan-500/60' : isRf ? 'hover:border-emerald-500/60' : 'hover:border-amber-500/60';
  const chartColor = isKnn ? '#00d4ff' : isRf ? '#10b981' : '#f59e0b';
  const hasMetrics = model.metrics && typeof model.metrics.r2 === 'number' && typeof model.metrics.rmse === 'number';

  return (
    <div className={`bg-[#1a1d27] rounded-xl border ${borderColor} ${bgHover} transition-colors overflow-hidden flex flex-col h-full`}>
      <div className="p-6 border-b border-gray-800">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1">{model.name}</h3>
            <span className={`text-xs font-mono px-2 py-1 rounded bg-gray-800 ${accentColor}`}>
              {model.algorithm}
            </span>
          </div>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed">
          {model.description}
        </p>
      </div>

      <div className="p-6 flex-grow flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Kelebihan
            </h4>
            <ul className="space-y-2">
              {model.pros.map((pro, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              Kekurangan
            </h4>
            <ul className="space-y-2">
              {model.cons.map((con, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
          <div className="bg-[#0f1117] p-4 rounded-lg border border-gray-800">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              Parameter Terbaik
            </h4>
            <div className="space-y-1 font-mono text-xs">
              {Object.entries(model.hyperparameters).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-500">{key}:</span>
                  <span className="text-gray-300">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#0f1117] p-4 rounded-lg border border-gray-800">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              Metrik
            </h4>
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Skor R²:</span>
                <span className="text-emerald-400">{hasMetrics ? model.metrics.r2.toFixed(2) : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">RMSE:</span>
                <span className="text-gray-300">{hasMetrics ? model.metrics.rmse.toLocaleString() : 'N/A'}</span>
              </div>
            </div>
            {hasMetrics ? (
              <div className="mt-3 h-16">
                <MetricsChart r2={model.metrics.r2} color={chartColor} />
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-red-400/80 leading-relaxed">
                Metrik realtime belum tersedia. Pastikan Python dan model file terpasang.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
