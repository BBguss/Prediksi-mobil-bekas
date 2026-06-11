import { useEffect, useState } from 'react';
import { getModels } from '../services/api';

const generalById = {
  knn: {
    title: 'Apa itu KNN (K-Nearest Neighbors)?',
    desc: 'KNN adalah algoritma yang memprediksi nilai dengan melihat sejumlah tetangga data terdekat. Prinsipnya sederhana: data yang mirip biasanya punya nilai yang mirip juga.',
    how: [
      'Model menghitung jarak data baru ke data-data lama.',
      'Model mengambil beberapa tetangga terdekat (n_neighbors).',
      'Nilai prediksi dibentuk dari tetangga tersebut (bisa rata-rata berbobot jarak).',
    ],
  },
  dt: {
    title: 'Apa itu Decision Tree?',
    desc: 'Decision Tree adalah algoritma berbasis aturan if-else berbentuk pohon. Model memecah data bertahap berdasarkan fitur yang paling membedakan nilai target.',
    how: [
      'Model memilih fitur terbaik untuk membagi data di setiap node.',
      'Proses pembagian berlanjut sampai batas tertentu (misalnya max_depth).',
      'Prediksi diambil dari nilai rata-rata pada node daun akhir.',
    ],
  },
};

const contextById = {
  knn: {
    title: 'KNN pada Konteks Dataset Mobil Saat Ini',
    points: [
      'KNN cocok saat ada banyak contoh mobil serupa di dataset.',
      'Fitur numerik seperti tahun, km_driven, engine, max_power, serta fitur turunan torque/rpm membantu model mencari kemiripan antar mobil.',
      'Jika data sangat bervariasi atau ada outlier ekstrem, KNN bisa sensitif terhadap pemilihan tetangga.',
    ],
  },
  dt: {
    title: 'Decision Tree pada Konteks Dataset Mobil Saat Ini',
    points: [
      'Decision Tree cocok untuk menangkap aturan harga berbasis kondisi fitur (misalnya tahun baru + km rendah).',
      'Model ini mudah ditafsirkan untuk melihat pola keputusan yang dominan.',
      'Jika pohon terlalu dalam, model bisa terlalu menyesuaikan data train (overfitting), sehingga butuh kontrol parameter.',
    ],
  },
};

const useCasesById = {
  knn: [
    'Cocok untuk estimasi harga dengan pola kendaraan yang mirip (case-based).',
    'Baik saat kamu ingin hasil yang mengikuti tetangga data terdekat.',
    'Ideal untuk eksplorasi awal sebelum tuning lanjutan.',
  ],
  dt: [
    'Cocok saat butuh model yang mudah dijelaskan dengan aturan keputusan.',
    'Baik untuk analisis faktor dominan karena struktur pohon lebih interpretatif.',
    'Ideal untuk kebutuhan presentasi insight ke non-teknis.',
  ],
};

export default function ModelInfoPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getModels();
        setModels(data);
      } catch {
        setError('Gagal memuat informasi model.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-gray-400">Memuat informasi model...</div>;
  }

  if (error) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-red-400">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Informasi Model</h1>
        <p className="text-gray-400 mt-2">Halaman ini menjelaskan model yang dipakai, manfaatnya, dan konteks penggunaan yang paling cocok.</p>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-2">Overview Halaman Info Model</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Halaman ini dipakai untuk memahami model secara konsep umum dulu, lalu melihat bagaimana model tersebut diterapkan
          pada konteks dataset mobil bekas di aplikasi ini. Tujuannya agar user tidak hanya melihat angka, tetapi juga paham karakter model.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {models.map((model) => (
          <div key={model.id} className="bg-[#1a1d27] border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-white">{model.name}</h2>
              <p className="text-sm text-cyan-300 mt-1">{model.algorithm}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-1">{generalById[model.id]?.title || 'Penjelasan Umum Model'}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {generalById[model.id]?.desc || model.description}
              </p>
              <ul className="text-sm text-gray-300 mt-2 space-y-1">
                {(generalById[model.id]?.how || []).map((step) => (
                  <li key={step}>- {step}</li>
                ))}
              </ul>
            </div>

            <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-cyan-300 mb-2 uppercase tracking-wider">
                {contextById[model.id]?.title || 'Konteks Dataset Saat Ini'}
              </h4>
              <ul className="text-sm text-gray-300 space-y-1">
                {(contextById[model.id]?.points || []).map((p) => (
                  <li key={p}>- {p}</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-emerald-300 mb-2 uppercase tracking-wider">Manfaat</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  {(model.pros || []).map((p) => (
                    <li key={p}>- {p}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-amber-300 mb-2 uppercase tracking-wider">Keterbatasan</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  {(model.cons || []).map((c) => (
                    <li key={c}>- {c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-blue-300 mb-2 uppercase tracking-wider">Kebutuhan Yang Cocok</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                {(useCasesById[model.id] || ['Cocok untuk eksperimen prediksi harga mobil bekas.']).map((u) => (
                  <li key={u}>- {u}</li>
                ))}
              </ul>
            </div>

            <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">Hyperparameter Default</h4>
              <pre className="text-xs text-gray-300 overflow-auto">{JSON.stringify(model.hyperparameters || {}, null, 2)}</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
