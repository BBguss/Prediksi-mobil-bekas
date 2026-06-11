import { useState } from 'react';

function getAccentClasses(model) {
  const algo = (model.algorithm || '').toLowerCase();
  const isKnn = algo.includes('knn') || algo.includes('nearest');
  const isRf  = algo.includes('random') || algo.includes('forest');
  if (isKnn) return { active: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', dot: 'bg-cyan-400' };
  if (isRf)  return { active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' };
  return       { active: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' };
}

export default function ModelSelector({ models, selectedId, onSelect }) {
  const [showCustom, setShowCustom] = useState(false);

  const builtinModels = models.filter((m) => m.builtin);
  const customModels  = models.filter((m) => !m.builtin);

  const selectedIsCustom = customModels.some((m) => m.id === selectedId);

  return (
    <div className="bg-[#1a1d27] rounded-lg border border-gray-800 overflow-hidden">
      {/* Builtin model tabs */}
      <div className="p-1.5 flex flex-col sm:flex-row gap-1.5">
        {builtinModels.map((model) => {
          const isSelected = model.id === selectedId;
          const accent = getAccentClasses(model);
          return (
            <button
              key={model.id}
              onClick={() => onSelect(model.id)}
              className={`flex-1 text-left px-4 py-3 rounded-md border transition-all cursor-pointer ${
                isSelected
                  ? accent.active
                  : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-700/40 hover:text-gray-200'
              }`}
            >
              <div className="font-semibold text-sm mb-0.5">{model.name}</div>
              <div className="text-xs opacity-60 line-clamp-1">{model.algorithm}</div>
            </button>
          );
        })}
      </div>

      {/* Custom models section */}
      {customModels.length > 0 && (
        <div className="border-t border-gray-800">
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-700/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>
              </svg>
              MODEL KUSTOM
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${selectedIsCustom ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-700 text-gray-300'}`}>
                {customModels.length}
              </span>
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${showCustom ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {showCustom && (
            <div className="px-1.5 pb-1.5 flex flex-col gap-1">
              {customModels.map((model) => {
                const isSelected = model.id === selectedId;
                const accent = getAccentClasses(model);
                const isRetrained = model.id.startsWith('retrained_');
                return (
                  <button
                    key={model.id}
                    onClick={() => onSelect(model.id)}
                    className={`w-full text-left px-4 py-3 rounded-md border transition-all cursor-pointer ${
                      isSelected
                        ? accent.active
                        : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-700/40 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="font-semibold text-sm">{model.name}</div>
                      {isRetrained && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold uppercase tracking-wide">
                          retrained
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-60 line-clamp-1">{model.algorithm}</div>
                    {model.metrics && typeof model.metrics.r2_test === 'number' && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        R² test: {model.metrics.r2_test.toFixed(3)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Indicator kalau custom model sedang dipilih tapi panel tertutup */}
          {!showCustom && selectedIsCustom && (
            <div className="px-4 pb-2">
              <div className="text-[11px] text-purple-400 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                {customModels.find((m) => m.id === selectedId)?.name} sedang aktif
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
