import { useState } from 'react';

export default function PredictionForm({ selectedModel, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    year: 2018,
    km_driven: 45000,
    fuel: 'Petrol',
    seller_type: 'Individual',
    transmission: 'Manual',
    owner: 'First Owner',
    mileage: 18.5,
    engine: 1197,
    max_power: 82,
    seats: 5,
    torque_clean: 113,
    rpm_min: 4200,
    rpm_max: 5200,
  });

  // Semua model (knn, dt, rf) menggunakan pipeline identik dengan torque/rpm
  // Selalu tampilkan field torque
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const inputClass = "w-full bg-[#0f1117] border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider";
  const hintClass  = "mt-1 text-[11px] text-gray-500";

  const accentColor = selectedModel?.id === 'rf'
    ? 'bg-emerald-600 hover:bg-emerald-500'
    : selectedModel?.id === 'dt'
      ? 'bg-amber-600 hover:bg-amber-500'
      : 'bg-cyan-600 hover:bg-cyan-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* ── Tahun ── */}
        <div>
          <label className={labelClass}>Tahun kendaraan</label>
          <input type="number" name="year" min="1990" max="2025"
            value={formData.year} onChange={handleChange}
            className={inputClass} required />
          <p className={hintClass}>Tahun produksi atau tahun pembelian.</p>
        </div>

        {/* ── KM ── */}
        <div>
          <label className={labelClass}>Jarak tempuh (km)</label>
          <input type="number" name="km_driven" min="0"
            value={formData.km_driven} onChange={handleChange}
            className={inputClass} required />
        </div>

        {/* ── Fuel ── */}
        <div>
          <label className={labelClass}>Bahan bakar</label>
          <select name="fuel" value={formData.fuel} onChange={handleChange} className={inputClass}>
            <option value="Petrol">Bensin (Petrol)</option>
            <option value="Diesel">Diesel</option>
            <option value="CNG">CNG</option>
            <option value="LPG">LPG</option>
          </select>
        </div>

        {/* ── Transmisi ── */}
        <div>
          <label className={labelClass}>Transmisi</label>
          <select name="transmission" value={formData.transmission} onChange={handleChange} className={inputClass}>
            <option value="Manual">Manual</option>
            <option value="Automatic">Otomatis</option>
          </select>
        </div>

        {/* ── Seller type ── */}
        <div>
          <label className={labelClass}>Tipe penjual</label>
          <select name="seller_type" value={formData.seller_type} onChange={handleChange} className={inputClass}>
            <option value="Individual">Individu</option>
            <option value="Dealer">Dealer</option>
            <option value="Trustmark Dealer">Dealer Trustmark</option>
          </select>
        </div>

        {/* ── Owner ── */}
        <div>
          <label className={labelClass}>Status kepemilikan</label>
          <select name="owner" value={formData.owner} onChange={handleChange} className={inputClass}>
            <option value="First Owner">Tangan pertama</option>
            <option value="Second Owner">Tangan kedua</option>
            <option value="Third Owner">Tangan ketiga</option>
            <option value="Fourth & Above Owner">Tangan keempat &amp; lebih</option>
            <option value="Test Drive Car">Mobil test drive</option>
          </select>
        </div>

        {/* ── Mileage ── */}
        <div>
          <label className={labelClass}>Konsumsi BBM (km/l)</label>
          <input type="number" name="mileage" step="0.1" min="0"
            value={formData.mileage} onChange={handleChange}
            className={inputClass} required />
          <p className={hintClass}>Contoh: 18.5 untuk mobil 1200cc bensin.</p>
        </div>

        {/* ── Engine ── */}
        <div>
          <label className={labelClass}>Kapasitas mesin (cc)</label>
          <input type="number" name="engine" min="500" max="10000"
            value={formData.engine} onChange={handleChange}
            className={inputClass} required />
        </div>

        {/* ── Max power ── */}
        <div>
          <label className={labelClass}>Tenaga maksimum (bhp)</label>
          <input type="number" name="max_power" step="0.1" min="10"
            value={formData.max_power} onChange={handleChange}
            className={inputClass} required />
        </div>

        {/* ── Seats ── */}
        <div>
          <label className={labelClass}>Jumlah kursi</label>
          <input type="number" name="seats" min="2" max="10"
            value={formData.seats} onChange={handleChange}
            className={inputClass} required />
        </div>

        {/* ── Torque ── */}
        <div>
          <label className={labelClass}>Torsi bersih (Nm)</label>
          <input type="number" name="torque_clean" step="0.1" min="0"
            value={formData.torque_clean} onChange={handleChange}
            className={inputClass} required />
          <p className={hintClass}>Nilai torsi tanpa satuan teks. Contoh: 113 untuk Maruti Swift.</p>
        </div>

        {/* ── RPM min ── */}
        <div>
          <label className={labelClass}>RPM minimum</label>
          <input type="number" name="rpm_min" step="1" min="0"
            value={formData.rpm_min} onChange={handleChange}
            className={inputClass} required />
          <p className={hintClass}>RPM saat torsi maksimum pertama kali dicapai.</p>
        </div>

        {/* ── RPM max ── */}
        <div>
          <label className={labelClass}>RPM maksimum</label>
          <input type="number" name="rpm_max" step="1" min="0"
            value={formData.rpm_max} onChange={handleChange}
            className={inputClass} required />
          <p className={hintClass}>RPM batas atas (redline) atau RPM torsi puncak kedua.</p>
        </div>

      </div>

      {/* ── Submit ── */}
      <div className="pt-4 border-t border-gray-800">
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-md font-medium text-white transition-all flex justify-center items-center gap-2 cursor-pointer ${accentColor} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Memproses...
            </>
          ) : (
            'Prediksi Harga'
          )}
        </button>
      </div>
    </form>
  );
}
