import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-blue-500">
          Kecerdasan Prediktif untuk Harga Mobil
        </h1>
        <p className="text-lg text-gray-400 mb-8 leading-relaxed">
          Manfaatkan machine learning untuk memperkirakan harga mobil bekas dengan akurasi tinggi. 
          Bandingkan prediksi antara algoritma K-Nearest Neighbors dan Decision Tree yang dilatih 
          pada dataset komprehensif mobil bekas.
        </p>
        <button
          onClick={() => navigate('/predict')}
          className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-md font-medium transition-colors cursor-pointer"
        >
          Mulai Prediksi
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-6 mb-10">
        <h2 className="text-xl font-semibold mb-2">Overview Halaman</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Beranda ini memberikan gambaran umum sistem prediksi harga mobil. Dari sini kamu bisa menuju halaman Prediksi untuk mencoba input manual,
          Playground untuk eksperimen model, Info Model untuk teori singkat algoritma, Dataset untuk melihat data sumber, dan History untuk meninjau prediksi yang pernah dibuat.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-[#1a1d27] p-6 rounded-xl border border-gray-800 flex items-start gap-4">
          <div className="p-3 bg-gray-800/50 rounded-lg text-cyan-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Dataset Kuat</h3>
            <p className="text-sm text-gray-400">Dilatih pada ~8.000 data dunia nyata dengan rekayasa fitur yang ekstensif.</p>
          </div>
        </div>
        <div className="bg-[#1a1d27] p-6 rounded-xl border border-gray-800 flex items-start gap-4">
          <div className="p-3 bg-gray-800/50 rounded-lg text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Algoritma Ganda</h3>
            <p className="text-sm text-gray-400">Bandingkan prediksi berbasis jarak (KNN) vs berbasis aturan (Decision Tree).</p>
          </div>
        </div>
        <div className="bg-[#1a1d27] p-6 rounded-xl border border-gray-800 flex items-start gap-4">
          <div className="p-3 bg-gray-800/50 rounded-lg text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Akurasi Tinggi</h3>
            <p className="text-sm text-gray-400">Evaluasi dilakukan langsung terhadap dataset aktual untuk melihat performa model terbaru.</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
          Penjelasan Umum Model
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-6 space-y-3">
            <h3 className="text-xl font-semibold text-cyan-300">KNN (K-Nearest Neighbors)</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              KNN memprediksi harga dengan mencari kendaraan paling mirip di data lama, lalu mengambil nilai rata-ratanya.
              Cocok saat pola kemiripan antar kendaraan kuat.
            </p>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>- Kelebihan: sederhana, intuitif, fleksibel.</li>
              <li>- Tantangan: sensitif skala data dan outlier.</li>
            </ul>
          </div>

          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-6 space-y-3">
            <h3 className="text-xl font-semibold text-amber-300">Decision Tree</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Decision Tree belajar aturan keputusan bertingkat dari fitur kendaraan, lalu memprediksi harga berdasarkan cabang keputusan tersebut.
              Cocok saat butuh model yang mudah dijelaskan.
            </p>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>- Kelebihan: interpretatif, cepat dipahami non-teknis.</li>
              <li>- Tantangan: bisa overfitting jika pohon terlalu kompleks.</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={() => navigate('/model-info')}
            className="px-4 py-2 rounded-md border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-sm"
          >
            Lihat Info Model Detail
          </button>
          <button
            onClick={() => navigate('/dataset')}
            className="px-4 py-2 rounded-md border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 text-sm"
          >
            Lihat Informasi Dataset
          </button>
          <button
            onClick={() => navigate('/history')}
            className="px-4 py-2 rounded-md border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-sm"
          >
            Lihat History Prediksi
          </button>
        </div>
      </div>
    </div>
  );
}
