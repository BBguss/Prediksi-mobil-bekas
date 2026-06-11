import { GLOSSARY_ITEMS } from '../data/glossary';

export default function GlossaryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Glosarium Istilah</h1>
        <p className="text-gray-400 mt-2">Kumpulan istilah non-umum yang dipakai di halaman Prediksi, Playground, Model, Dataset, dan History.</p>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-2">Overview Halaman Glosarium</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Halaman ini dibuat agar user non-teknis bisa memahami istilah machine learning dan dataset tanpa harus membuka dokumentasi terpisah.
        </p>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GLOSSARY_ITEMS.map(([term, explanation]) => (
            <div key={term} className="bg-[#0f1117] border border-gray-800 rounded-lg px-3 py-2.5">
              <div className="text-sm font-semibold text-cyan-300 mb-1">{term}</div>
              <div className="text-sm text-gray-300 leading-relaxed">{explanation}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
