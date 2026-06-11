import { useMemo, useState } from 'react';
import { clearPredictionHistory, getPredictionHistory, removePredictionHistoryItem } from '../services/history';

function formatPrice(price) {
  if (price === null || price === undefined) return '-';
  return Number(price).toLocaleString('en-IN');
}

export default function HistoryPage() {
  const [items, setItems] = useState(getPredictionHistory());
  const [compareIds, setCompareIds] = useState([]);

  const selectedItems = useMemo(
    () => items.filter((i) => compareIds.includes(i.id)).slice(0, 2),
    [items, compareIds]
  );

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleClear = () => {
    clearPredictionHistory();
    setItems([]);
    setCompareIds([]);
  };

  const featureKeys = useMemo(() => {
    if (selectedItems.length < 2) return [];
    const keys = new Set([...Object.keys(selectedItems[0].features || {}), ...Object.keys(selectedItems[1].features || {})]);
    return Array.from(keys);
  }, [selectedItems]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Riwayat Prediksi Manual</h1>
          <p className="text-gray-400 mt-2">Lihat ulang input prediksi yang pernah dibuat, lalu bandingkan agar tidak lupa.</p>
        </div>
        <button onClick={handleClear} className="px-4 py-2 rounded-md border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm disabled:opacity-40" disabled={items.length === 0}>
          Hapus Semua Riwayat
        </button>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-2">Overview Halaman History</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Halaman ini menyimpan jejak prediksi manual user agar bisa ditinjau ulang kapan saja. Kamu dapat membandingkan dua input sekaligus
          untuk melihat perbedaan fitur dan dampaknya ke hasil prediksi.
        </p>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
        {items.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada riwayat prediksi manual.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 pr-3">Bandingkan</th>
                  <th className="py-2 pr-3">Waktu</th>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Prediksi</th>
                  <th className="py-2 pr-3">Ringkasan Input</th>
                  <th className="py-2 pr-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/80">
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => toggleCompare(item.id)} />
                    </td>
                    <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{new Date(item.createdAt).toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-3 text-gray-200 whitespace-nowrap">{item.modelName}</td>
                    <td className="py-2 pr-3 text-cyan-300 whitespace-nowrap">Rs {formatPrice(item.prediction)}</td>
                    <td className="py-2 pr-3 text-gray-400 text-xs">
                      year {item.features?.year}, km {item.features?.km_driven}, fuel {item.features?.fuel}, power {item.features?.max_power}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        className="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-800"
                        onClick={() => {
                          const next = removePredictionHistoryItem(item.id);
                          setItems(next);
                          setCompareIds((prev) => prev.filter((id) => id !== item.id));
                        }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
        <h2 className="text-xl font-semibold mb-4">Perbandingan 2 Riwayat</h2>
        {selectedItems.length < 2 ? (
          <p className="text-sm text-gray-400">Centang 2 riwayat di atas untuk membandingkan detail input dan hasil prediksi.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedItems.map((item) => (
                <div key={item.id} className="bg-[#0f1117] border border-gray-800 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-100">{item.modelName}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(item.createdAt).toLocaleString('id-ID')}</div>
                  <div className="text-base text-cyan-300 mt-2">Rs {formatPrice(item.prediction)}</div>
                </div>
              ))}
            </div>

            <div className="overflow-auto border border-gray-800 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-[#111725]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">Fitur</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">Input A</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">Input B</th>
                  </tr>
                </thead>
                <tbody>
                  {featureKeys.map((key) => {
                    const a = selectedItems[0].features?.[key];
                    const b = selectedItems[1].features?.[key];
                    const different = String(a) !== String(b);
                    return (
                      <tr key={key} className="border-b border-gray-800 odd:bg-[#0f1117] even:bg-[#111725]">
                        <td className="px-3 py-2 text-gray-300">{key}</td>
                        <td className={`px-3 py-2 ${different ? 'text-amber-300' : 'text-gray-200'}`}>{a === undefined ? '-' : String(a)}</td>
                        <td className={`px-3 py-2 ${different ? 'text-amber-300' : 'text-gray-200'}`}>{b === undefined ? '-' : String(b)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
