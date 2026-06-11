import { useState } from 'react';
import { evaluateModel, trainAndSaveModel } from '../services/api';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  LineChart, Line
} from 'recharts';
import { TERM_EXPLANATIONS } from '../data/glossary';

function SvgIcon({ children, className = '', size = 16 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function Settings2Icon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </SvgIcon>
  );
}

function PlusIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </SvgIcon>
  );
}

function XIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </SvgIcon>
  );
}

function ActivityIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </SvgIcon>
  );
}

function CpuIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </SvgIcon>
  );
}

function TargetIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </SvgIcon>
  );
}

function AlertCircleIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </SvgIcon>
  );
}

function DatabaseIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
      <path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
    </SvgIcon>
  );
}

function HelpCircleIcon({ className = '', size = 16 }) {
  return (
    <SvgIcon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </SvgIcon>
  );
}


// ── Konstanta warna ──────────────────────────────────────────────────────────
const COLOR_TRAIN = '#06b6d4'; // cyan
const COLOR_TEST  = '#f59e0b'; // amber
const COLOR_THIRD = '#10b981'; // emerald

// ── Helper format angka ───────────────────────────────────────────────────────
const fmtRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

// Threshold khusus KNN: weights='distance' secara struktural selalu memiliki
// gap train-test yang besar karena titik train diprediksi hampir sempurna.
// Threshold dilonggarkan agar interpretasi tidak menyesatkan.
const KNN_GAP_THRESHOLD_GREAT  = 0.18; // normal: 0.08
const KNN_GAP_THRESHOLD_GOOD   = 0.25; // normal: 0.12
const KNN_RATIO_THRESHOLD_GREAT = 3.0;  // normal: 1.2
const KNN_RATIO_THRESHOLD_GOOD  = 6.0;  // normal: 1.35
const KNN_RATIO_THRESHOLD_BAD   = 12.0; // normal: 1.6

function getVisualizationAssessment(metrics, algorithm = '') {
  const r2Test = metrics.test.r2;
  const rmseTrain = metrics.train.rmse;
  const rmseTest = metrics.test.rmse;
  const r2Gap = Math.abs(metrics.train.r2 - metrics.test.r2);
  const rmseRatio = rmseTrain > 0 ? rmseTest / rmseTrain : 1;
  const isKnn = algorithm === 'knn';

  // Gunakan threshold yang sudah disesuaikan untuk KNN
  const gapGreat  = isKnn ? KNN_GAP_THRESHOLD_GREAT  : 0.08;
  const gapGood   = isKnn ? KNN_GAP_THRESHOLD_GOOD   : 0.12;
  const ratGreat  = isKnn ? KNN_RATIO_THRESHOLD_GREAT : 1.2;
  const ratGood   = isKnn ? KNN_RATIO_THRESHOLD_GOOD  : 1.35;
  const ratBad    = isKnn ? KNN_RATIO_THRESHOLD_BAD   : 1.6;

  let label = 'Kurang Optimal';
  let toneClass = 'text-amber-300 bg-amber-900/20 border-amber-500/30';

  if (r2Test >= 0.9 && r2Gap <= gapGreat && rmseRatio <= ratGreat) {
    label = 'Sangat Baik';
    toneClass = 'text-green-300 bg-green-900/20 border-green-500/30';
  } else if (r2Test >= 0.8 && r2Gap <= gapGood && rmseRatio <= ratGood) {
    label = 'Baik';
    toneClass = 'text-cyan-300 bg-cyan-900/20 border-cyan-500/30';
  } else if (r2Test < 0.7 || rmseRatio > ratBad) {
    label = 'Buruk';
    toneClass = 'text-red-300 bg-red-900/20 border-red-500/30';
  }

  let summary = 'Model cukup stabil, tetapi masih ada ruang perbaikan untuk generalisasi.';
  if (label === 'Sangat Baik') {
    summary = isKnn
      ? 'Model KNN menunjukkan akurasi tinggi. Gap train-test yang terlihat adalah perilaku normal karena weights=distance — bukan indikasi masalah.'
      : 'Model menunjukkan akurasi tinggi dan konsistensi train-test yang sangat baik.';
  } else if (label === 'Baik') {
    summary = isKnn
      ? 'Model KNN sudah baik. Gap train-test pada KNN dengan weights=distance memang lebih besar dari model berbasis pohon — ini wajar secara arsitektur.'
      : 'Model sudah baik untuk digunakan, dengan gap train-test yang masih terkendali.';
  } else if (label === 'Buruk') {
    summary = isKnn
      ? 'Akurasi test rendah. Coba tuning n_neighbors atau ganti weights ke uniform untuk mengurangi overfitting.'
      : 'Performa model masih lemah. Perlu tuning parameter atau fitur tambahan.';
  } else {
    summary = isKnn
      ? 'Model KNN cukup baik. Gap train-test yang besar pada KNN dengan weights=distance adalah hal yang normal secara teknis.'
      : 'Model cukup stabil, tetapi masih ada ruang perbaikan untuk generalisasi.';
  }

  const accuracyLevel = r2Test >= 0.9 ? 'tinggi' : r2Test >= 0.8 ? 'cukup baik' : r2Test >= 0.7 ? 'sedang' : 'rendah';
  const stabilityLevel = r2Gap <= gapGreat && rmseRatio <= ratGreat ? 'sangat stabil'
    : r2Gap <= gapGood && rmseRatio <= ratGood ? 'stabil'
    : isKnn ? 'normal untuk KNN' : 'kurang stabil';

  return {
    label,
    toneClass,
    summary,
    r2Test,
    r2Gap,
    rmseRatio,
    accuracyLevel,
    stabilityLevel,
    isKnn,
  };
}

function getOverfittingAnalysis(metrics, algorithm = '') {
  const r2Gap = Math.abs(metrics.train.r2 - metrics.test.r2);
  const rmseTrain = metrics.train.rmse;
  const rmseTest = metrics.test.rmse;
  const rmseRatio = rmseTrain > 0 ? rmseTest / rmseTrain : 1;
  const isKnn = algorithm === 'knn';

  if (isKnn) {
    // KNN dengan weights='distance': titik train diprediksi hampir sempurna
    // (jarak ke dirinya sendiri ~0, bobot tak terhingga), sehingga rasio RMSE
    // dan gap R² secara struktural selalu jauh lebih besar dibanding DT/RF.
    // Level 'Tinggi' hanya jika r2 test JUGA rendah (< 0.65) atau rasio sangat ekstrem.
    const knnReallyBad = r2Test => r2Test < 0.65;
    const r2Test = metrics.test.r2;
    if (knnReallyBad(r2Test) || rmseRatio > KNN_RATIO_THRESHOLD_BAD) {
      return {
        level: 'Tinggi',
        toneClass: 'text-red-300 bg-red-900/20 border-red-500/30',
        message: `Gap R² ${(r2Gap * 100).toFixed(2)}pp dan rasio RMSE ${rmseRatio.toFixed(2)}x — akurasi test terlalu rendah untuk KNN.`,
        reason: 'Coba tuning n_neighbors lebih besar atau ganti weights ke uniform untuk mengurangi overfitting.',
        r2Gap,
        rmseRatio,
      };
    }
    // Gap besar tapi r2 test bagus → normal untuk KNN weights=distance
    return {
      level: 'Normal (KNN)',
      toneClass: 'text-cyan-300 bg-cyan-900/20 border-cyan-500/30',
      message: `Gap R² ${(r2Gap * 100).toFixed(2)}pp dan rasio RMSE ${rmseRatio.toFixed(2)}x — ini wajar untuk KNN weights=distance.`,
      reason: 'KNN dengan weights=distance memprediksi data train hampir sempurna (jarak 0 ke dirinya sendiri), sehingga metrik train selalu jauh lebih baik dari test. Fokus utama tetap pada akurasi test.',
      r2Gap,
      rmseRatio,
    };
  }

  // DT / RF: threshold standar
  const severe = r2Gap > 0.15 || rmseRatio > 1.6;
  const moderate = r2Gap > 0.08 || rmseRatio > 1.3;

  if (severe) {
    return {
      level: 'Tinggi',
      toneClass: 'text-red-300 bg-red-900/20 border-red-500/30',
      message: `Indikasi overfitting tinggi: gap R² ${(r2Gap * 100).toFixed(2)}pp dan rasio RMSE test/train ${rmseRatio.toFixed(2)}x.`,
      reason: 'Model terlalu menyesuaikan data train sehingga performa turun pada data test.',
      r2Gap,
      rmseRatio,
    };
  }

  if (moderate) {
    return {
      level: 'Sedang',
      toneClass: 'text-amber-300 bg-amber-900/20 border-amber-500/30',
      message: `Ada indikasi overfitting sedang: gap R² ${(r2Gap * 100).toFixed(2)}pp dan rasio RMSE test/train ${rmseRatio.toFixed(2)}x.`,
      reason: 'Model masih generalisasi, tetapi mulai menunjukkan gap train-test yang perlu diawasi.',
      r2Gap,
      rmseRatio,
    };
  }

  return {
    level: 'Rendah',
    toneClass: 'text-green-300 bg-green-900/20 border-green-500/30',
    message: `Generalisasi baik: gap R² ${(r2Gap * 100).toFixed(2)}pp dan rasio RMSE test/train ${rmseRatio.toFixed(2)}x.`,
    reason: 'Performa train dan test konsisten sehingga risiko overfitting kecil.',
    r2Gap,
    rmseRatio,
  };
}

// ── Info Tip ─────────────────────────────────────────────────────────────────
function InfoTip({ text }) {
  return (
    <div className="group relative inline-block ml-1">
      <HelpCircleIcon size={14} className="text-gray-500 hover:text-gray-300 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 bg-gray-800 text-xs text-gray-200 p-2 rounded shadow-lg group-hover:block z-10">
        {text}
      </div>
    </div>
  );
}

function TermTooltip({ term, label = null, textClass = '', tipClass = '' }) {
  const explanation = TERM_EXPLANATIONS[term] || 'Istilah ini dipakai pada evaluasi model.';
  const displayLabel = label || term;
  return (
    <span className="group relative inline-flex items-center gap-1 normal-case tracking-normal font-normal">
      <span className={`underline decoration-dotted underline-offset-2 cursor-help font-normal normal-case tracking-normal ${textClass}`}>{displayLabel}</span>
      <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-56 rounded-md border border-gray-700 bg-[#0f1117] p-2 text-[11px] font-normal normal-case tracking-normal leading-relaxed text-gray-200 shadow-lg group-hover:block z-20 ${tipClass}`}>
        {explanation}
      </span>
    </span>
  );
}


// ── Komponen MetricCard ───────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, labelTerm = null, trainVal, testVal }) {
  return (
    <div className="bg-[#0f1117] px-4 py-3.5 rounded-xl border border-gray-800 min-w-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-gray-400 text-[11px] uppercase tracking-[0.14em] mb-3 flex items-center gap-1.5 font-medium">
        <Icon size={13} />
        {labelTerm ? <TermTooltip term={labelTerm} textClass="text-gray-400" /> : label}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-[#121722] rounded-lg px-3 py-2.5 min-w-0 border border-cyan-500/10">
          <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-medium">
            <TermTooltip term="train" textClass="text-cyan-400" />
          </div>
          <div className="text-sm font-semibold text-gray-100 leading-tight tabular-nums wrap-break-word min-w-0 mt-1">
            {trainVal}
          </div>
        </div>
        <div className="bg-[#121722] rounded-lg px-3 py-2.5 min-w-0 border border-amber-500/10">
          <div className="text-[10px] text-amber-400 uppercase tracking-wider font-medium">
            <TermTooltip term="test" textClass="text-amber-400" />
          </div>
          <div className="text-sm font-semibold text-gray-100 leading-tight tabular-nums wrap-break-word min-w-0 mt-1">
            {testVal}
          </div>
        </div>
      </div>
    </div>
  );
}

function InterpretationPanel({ metrics, vizAssessment, overfit }) {
  const prep = metrics?.dataset_info?.preprocessing;
  const hasPrep = Boolean(prep);

  return (
    <div className={`p-4 rounded-xl border text-sm ${vizAssessment.toneClass}`}>
      <div className="font-semibold mb-2">Interpretasi Hasil: {vizAssessment.label}</div>
      <p className="leading-relaxed wrap-break-word">{vizAssessment.summary}</p>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-black/20 border border-white/10 px-3 py-2">
          <div className="opacity-80">Akurasi (R² Test)</div>
          <div className="font-semibold mt-0.5">{(vizAssessment.r2Test * 100).toFixed(2)}% ({vizAssessment.accuracyLevel})</div>
        </div>
        <div className="rounded-md bg-black/20 border border-white/10 px-3 py-2">
          <div className="opacity-80">Gap Train-Test</div>
          <div className="font-semibold mt-0.5">{(vizAssessment.r2Gap * 100).toFixed(2)}pp</div>
        </div>
        <div className="rounded-md bg-black/20 border border-white/10 px-3 py-2">
          <div className="opacity-80">Rasio RMSE Test/Train</div>
          <div className="font-semibold mt-0.5">{vizAssessment.rmseRatio.toFixed(2)}x ({vizAssessment.stabilityLevel})</div>
        </div>
      </div>

      <div className="mt-3 text-xs opacity-95 leading-relaxed wrap-break-word">
        {vizAssessment.isKnn
          ? 'Catatan KNN: threshold gap train-test dan rasio RMSE dilonggarkan karena KNN dengan weights=distance secara arsitektur selalu memiliki metrik train yang jauh lebih baik dari test. Fokus penilaian utama pada akurasi test (R² Test).'
          : 'Dasar keputusan: kategori akhir ditentukan dari kombinasi akurasi test, stabilitas gap train-test, dan rasio error test terhadap train.'}
      </div>

      {hasPrep && (
        <div className="mt-3 text-xs leading-relaxed bg-black/20 border border-white/10 rounded-md px-3 py-2">
          Catatan preprocessing: strategi {prep.strategy}, outlier filter {prep.outlier_filter}, raw rows {metrics.dataset_info?.raw_rows?.toLocaleString()} ke evaluasi {metrics.dataset_info?.total_rows?.toLocaleString()}.
        </div>
      )}

      <div className="mt-2 text-xs leading-relaxed bg-black/20 border border-white/10 rounded-md px-3 py-2">
        Status overfitting: {overfit.level}. {overfit.reason}
      </div>
    </div>
  );
}

// ── Komponen Overview Metrik LineChart ───────────────────────────────────────
function OverviewLineChart({ m, className = '' }) {
  const data = Array.isArray(m.prediction_curve) ? m.prediction_curve : [];
  const hasCurve = data.length > 1;
  return (
    <div className={`bg-[#1a1d27] p-5 rounded-xl border border-gray-800 flex flex-col gap-3 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-300"><TermTooltip term="real_prediction" textClass="text-gray-300" /> (Test Set)</h3>
         <InfoTip text="Grafik menampilkan nilai aktual (real) dan hasil prediksi model pada data test. Semakin menempel, semakin baik." />
      </div>
      <div className="h-64 xl:h-72">
        {hasCurve ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="index" tick={{ fill: '#9ca3af', fontSize: 11 }} tickMargin={8} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={70} tickFormatter={(v) => Number(v).toLocaleString('id-ID')} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0f1117', borderColor: '#374151', color: '#fff' }}
                labelStyle={{ color: '#d1d5db' }}
                formatter={(v, name) => [fmtRp(Math.round(v)), name === 'real' ? 'real' : 'prediction']}
                labelFormatter={(label) => `Index: ${label}`}
              />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '12px' }} />
              <Line type="linear" dataKey="real" name="real" stroke="#2563eb" strokeWidth={1.8} dot={{ r: 2.2 }} activeDot={{ r: 4 }} />
              <Line type="linear" dataKey="prediction" name="prediction" stroke="#ef4444" strokeWidth={1.8} dot={{ r: 2.2 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full rounded-lg border border-dashed border-gray-700 grid place-items-center text-sm text-gray-500">
            Data kurva real vs prediction belum tersedia.
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeArray(values, lowerIsBetter = false) {
  const nums = values.map((v) => (Number.isFinite(v) ? Number(v) : 0));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  if (!Number.isFinite(range) || Math.abs(range) < 1e-9) return nums.map(() => 50);
  return nums.map((v) => {
    const score = lowerIsBetter ? ((max - v) / range) * 100 : ((v - min) / range) * 100;
    return Number(score.toFixed(1));
  });
}

function buildMultiModelComparison(models) {
  const metrics = models.map((m) => m.metrics);
  const names = models.map((m) => m.name);
  const labels = models.map((m) => getVisualizationAssessment(m.metrics).label);
  const statusRank = { 'Sangat Baik': 4, 'Baik': 3, 'Kurang Optimal': 2, 'Buruk': 1 };

  const r2Vals = metrics.map((m) => m.test.r2);
  const rmseVals = metrics.map((m) => m.test.rmse);
  const mseVals = metrics.map((m) => m.test.mse);
  const gapVals = metrics.map((m) => Math.abs(m.train.r2 - m.test.r2));
  const ratioVals = metrics.map((m) => (m.train.rmse > 0 ? m.test.rmse / m.train.rmse : 1));
  const speedVals = metrics.map((m) => (Number.isFinite(m.elapsed_ms) ? m.elapsed_ms : 0));

  const r2Score = normalizeArray(r2Vals, false);
  const rmseScore = normalizeArray(rmseVals, true);
  const mseScore = normalizeArray(mseVals, true);
  const gapScore = normalizeArray(gapVals, true);
  const ratioScore = normalizeArray(ratioVals, true);
  const speedScore = normalizeArray(speedVals, true);

  const categoryRows = [
    { metric: 'Akurasi (R² Test)', values: r2Score },
    { metric: 'Generalisasi', values: gapScore },
    { metric: 'RMSE Rendah', values: rmseScore },
    { metric: 'MSE Rendah', values: mseScore },
    { metric: 'Stabilitas Error', values: ratioScore },
    { metric: 'Kecepatan Evaluasi', values: speedScore },
  ];

  const chartData = categoryRows.map((row) => ({
    metric: row.metric,
    m1: row.values[0],
    m2: row.values[1],
    m3: row.values[2],
  }));

  const totals = models.map((_, idx) => (
    (r2Score[idx] * 0.24)
    + (rmseScore[idx] * 0.2)
    + (mseScore[idx] * 0.1)
    + (gapScore[idx] * 0.15)
    + (ratioScore[idx] * 0.21)
    + (speedScore[idx] * 0.1)
  ));

  const ranked = models.map((m, idx) => ({
    name: m.name,
    total: totals[idx],
    qualityRank: statusRank[labels[idx]] || 0,
  })).sort((a, b) => {
    if (b.qualityRank !== a.qualityRank) return b.qualityRank - a.qualityRank;
    return b.total - a.total;
  });

  const best = ranked[0];
  const second = ranked[1];
  const scoreGap = Math.abs(best.total - second.total);
  const tie = scoreGap < 4;

  const modelWins = models.map((m) => ({ name: m.name, categories: [] }));
  categoryRows.forEach((row) => {
    const maxVal = Math.max(...row.values);
    row.values.forEach((v, idx) => {
      if (Math.abs(v - maxVal) < 1e-9) {
        modelWins[idx].categories.push(row.metric);
      }
    });
  });

  const categorySummary = modelWins
    .map((m) => `${m.name} unggul di ${m.categories.length ? m.categories.join(', ') : 'belum ada kategori dominan'}`)
    .join(' | ');

  const reasons = [];
  if ((best.qualityRank || 0) > (second.qualityRank || 0)) reasons.push('Status kualitas model lebih baik');
  if (best.total >= second.total) reasons.push('Skor komposit multidimensi lebih tinggi');

  return {
    chartData,
    names,
    isTie: tie,
    winnerName: tie ? null : best.name,
    scoreGapPct: scoreGap,
    reasons,
    summary: tie
      ? 'Performa antar model sangat dekat. Belum ada pemenang mutlak.'
      : `Model ${best.name} lebih unggul secara agregat pada metrik evaluasi data real.`,
    categorySummary,
  };
}

function CompareLineChart({ models }) {
  const cmp = buildMultiModelComparison(models);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={cmp.chartData} margin={{ top: 8, right: 14, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={70} />
        <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
        <RechartsTooltip
          contentStyle={{ backgroundColor: '#0f1117', borderColor: '#374151', color: '#fff' }}
          labelStyle={{ color: '#d1d5db' }}
          formatter={(v, name) => [`${v}%`, name]}
        />
        <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '12px' }} />
        <Line type="linear" dataKey="m1" name={cmp.names[0]} stroke={COLOR_TRAIN} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="linear" dataKey="m2" name={cmp.names[1]} stroke={COLOR_TEST} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="linear" dataKey="m3" name={cmp.names[2]} stroke={COLOR_THIRD} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function getComparisonInterpretation(models) {
  return buildMultiModelComparison(models);
}


// ── Default state model ───────────────────────────────────────────────────────
const defaultModel1 = () => ({
  name: 'Model A (KNN)', algorithm: 'knn',
  knnParams: { n_neighbors: 5, weights: 'distance', p: 1 },
  dtParams:  { max_depth: 7, min_samples_split: 5, min_samples_leaf: 2 },
  rfParams:  { n_estimators: 200, max_depth: 12, min_samples_split: 2, min_samples_leaf: 1 },
  testSize: 20, randomState: 42,
  metrics: null, error: null,
});

const normalizeAlgorithm = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['knn', 'k-nearest neighbors', 'k nearest neighbors', 'knearestneighbors'].includes(text)) return 'knn';
  if (['dt', 'decision tree', 'decision-tree', 'decisiontree'].includes(text)) return 'dt';
  if (['rf', 'random forest', 'random-forest', 'randomforest'].includes(text)) return 'rf';
  return text;
};
const defaultModel2 = () => ({
  name: 'Model B (Decision Tree)', algorithm: 'dt',
  knnParams: { n_neighbors: 3, weights: 'uniform', p: 2 },
  dtParams:  { max_depth: 5, min_samples_split: 10, min_samples_leaf: 4 },
  rfParams:  { n_estimators: 250, max_depth: 10, min_samples_split: 4, min_samples_leaf: 2 },
  testSize: 20, randomState: 42,
  metrics: null, error: null,
});

const defaultModel3 = () => ({
  name: 'Model C (Random Forest)', algorithm: 'rf',
  knnParams: { n_neighbors: 7, weights: 'distance', p: 2 },
  dtParams:  { max_depth: 8, min_samples_split: 6, min_samples_leaf: 2 },
  rfParams:  { n_estimators: 300, max_depth: 12, min_samples_split: 2, min_samples_leaf: 1 },
  testSize: 20, randomState: 42,
  metrics: null, error: null,
});

// ── Main Component ────────────────────────────────────────────────────────────
export default function PlaygroundPage() {
  const [isComparing, setIsComparing]     = useState(false);
  const [trainingState, setTrainingState] = useState('idle'); // idle | training | done
  const [model1, setModel1] = useState(defaultModel1);
  const [model2, setModel2] = useState(defaultModel2);
  const [model3, setModel3] = useState(defaultModel3);

  const inputClass = "w-full bg-[#0f1117] border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider";

  const updateModel = (num, field, value, paramType = null) => {
    const set = num === 1 ? setModel1 : num === 2 ? setModel2 : setModel3;
    set(prev => {
      if (paramType) return { ...prev, [paramType]: { ...prev[paramType], [field]: value } };
      return { ...prev, [field]: value };
    });
  };

  // ── Panggil backend evaluasi asli ─────────────────────────────────────────
  const runEvaluate = async (modelConf) => {
    const algorithm = normalizeAlgorithm(modelConf.algorithm);
    const hp = algorithm === 'knn'
      ? modelConf.knnParams
      : algorithm === 'rf'
        ? (modelConf.rfParams || { n_estimators: 200, max_depth: null, min_samples_split: 2, min_samples_leaf: 1 })
        : modelConf.dtParams;

    const startedAt = performance.now();
    const result = await evaluateModel(
      algorithm,
      hp,
      modelConf.testSize / 100,
      modelConf.randomState
    );
    const elapsedMs = Number((performance.now() - startedAt).toFixed(1));
    return {
      ...result,
      elapsed_ms: elapsedMs,
    };
  };

  const extractApiError = (error) => {
    if (!error) {
      return 'Evaluasi gagal tanpa detail.';
    }

    return (
      error.response?.data?.details
      || error.response?.data?.error
      || error.message
      || 'Evaluasi gagal tanpa detail.'
    );
  };

  const handleTrain = async () => {
    setTrainingState('training');
    setModel1(p => ({ ...p, metrics: null, error: null }));
    setModel2(p => ({ ...p, metrics: null, error: null }));
    setModel3(p => ({ ...p, metrics: null, error: null }));

    if (!isComparing) {
      try {
        const result = await runEvaluate(model1);
        if (result?.error) {
          setModel1(p => ({ ...p, metrics: null, error: result.error }));
        } else {
          setModel1(p => ({ ...p, metrics: result, error: null }));
        }
      } catch (err) {
        setModel1(p => ({ ...p, metrics: null, error: extractApiError(err) }));
      }

      setTrainingState('done');
      return;
    }

    const [result1, result2, result3] = await Promise.allSettled([
      runEvaluate(model1),
      runEvaluate(model2),
      runEvaluate(model3),
    ]);

    if (result1.status === 'fulfilled' && !result1.value?.error) {
      setModel1(p => ({ ...p, metrics: result1.value, error: null }));
    } else if (result1.status === 'fulfilled') {
      setModel1(p => ({ ...p, metrics: null, error: result1.value.error || 'Evaluasi model 1 gagal.' }));
    } else {
      setModel1(p => ({ ...p, metrics: null, error: extractApiError(result1.reason) }));
    }

    if (result2.status === 'fulfilled' && !result2.value?.error) {
      setModel2(p => ({ ...p, metrics: result2.value, error: null }));
    } else if (result2.status === 'fulfilled') {
      setModel2(p => ({ ...p, metrics: null, error: result2.value.error || 'Evaluasi model 2 gagal.' }));
    } else {
      setModel2(p => ({ ...p, metrics: null, error: extractApiError(result2.reason) }));
    }

    if (result3.status === 'fulfilled' && !result3.value?.error) {
      setModel3(p => ({ ...p, metrics: result3.value, error: null }));
    } else if (result3.status === 'fulfilled') {
      setModel3(p => ({ ...p, metrics: null, error: result3.value.error || 'Evaluasi model 3 gagal.' }));
    } else {
      setModel3(p => ({ ...p, metrics: null, error: extractApiError(result3.reason) }));
    }

    setTrainingState('done');
  };

  const handleSave = async (modelConf) => {
    const algorithm = normalizeAlgorithm(modelConf.algorithm);
    const hp = algorithm === 'knn'
      ? modelConf.knnParams
      : algorithm === 'rf'
        ? modelConf.rfParams
        : modelConf.dtParams;

    try {
      const result = await trainAndSaveModel(algorithm, hp, modelConf.name);
      if (result?.success) {
        alert(`✅ ${modelConf.name} berhasil disimpan sebagai model baru! Bisa dipakai di halaman Prediksi.`);
      } else {
        alert('Gagal menyimpan model: ' + (result?.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Gagal menyimpan model: ' + (err.response?.data?.error || err.message));
    }
  };


  // ── Render konfigurasi model ───────────────────────────────────────────────
  const renderConfig = (num, modelConf) => {
    const accent  = num === 1 ? 'text-cyan-400' : num === 2 ? 'text-amber-400' : 'text-emerald-400';
    const border  = num === 1 ? 'border-cyan-500/30' : num === 2 ? 'border-amber-500/30' : 'border-emerald-500/30';
    return (
      <div className={`bg-[#1a1d27] p-6 rounded-xl border ${border}`}>
        <h2 className={`text-xl font-semibold mb-6 border-b border-gray-800 pb-4 ${accent}`}>
          Konfigurasi Model {num}
        </h2>
        <div className="space-y-5">
          {/* Nama */}
          <div>
            <label className={labelClass}>Nama Model</label>
            <input type="text" value={modelConf.name}
              onChange={e => updateModel(num, 'name', e.target.value)} className={inputClass} />
          </div>
          {/* Algoritma */}
          <div>
            <label className={labelClass}>Algoritma</label>
            <select value={modelConf.algorithm}
              onChange={e => { updateModel(num, 'algorithm', e.target.value); setTrainingState('idle'); }}
              className={inputClass}>
              <option value="knn">K-Nearest Neighbors</option>
              <option value="dt">Decision Tree</option>
              <option value="rf">Random Forest</option>
            </select>
          </div>
          {/* Hyperparameter */}
          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-4"><TermTooltip term="hyperparameter" textClass="text-gray-300" /></h3>
            {modelConf.algorithm === 'knn' ? (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelClass}>
                    <TermTooltip term="n_neighbors" label="n_neighbors" textClass="text-gray-400" /> (1–20)
                  </label>
                  <input type="number" min="1" max="20" value={modelConf.knnParams.n_neighbors}
                    onChange={e => updateModel(num, 'n_neighbors', Number(e.target.value), 'knnParams')}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>
                    <TermTooltip term="weights" label="weights" textClass="text-gray-400" />
                  </label>
                  <select value={modelConf.knnParams.weights}
                    onChange={e => updateModel(num, 'weights', e.target.value, 'knnParams')}
                    className={inputClass}>
                    <option value="uniform">uniform</option>
                    <option value="distance">distance</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    <TermTooltip term="p_distance_metric" label="p (distance metric)" textClass="text-gray-400" />
                  </label>
                  <select value={modelConf.knnParams.p}
                    onChange={e => updateModel(num, 'p', Number(e.target.value), 'knnParams')}
                    className={inputClass}>
                    <option value="1">1 — Manhattan</option>
                    <option value="2">2 — Euclidean</option>
                  </select>
                </div>
              </div>
            ) : modelConf.algorithm === 'dt' ? (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelClass}>
                    <TermTooltip term="max_depth" label="max_depth" textClass="text-gray-400" /> (1–20)
                  </label>
                  <input type="number" min="1" max="20" value={modelConf.dtParams.max_depth}
                    onChange={e => updateModel(num, 'max_depth', Number(e.target.value), 'dtParams')}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>
                    <TermTooltip term="min_samples_split" label="min_samples_split" textClass="text-gray-400" />
                  </label>
                  <input type="number" min="2" max="50" value={modelConf.dtParams.min_samples_split}
                    onChange={e => updateModel(num, 'min_samples_split', Number(e.target.value), 'dtParams')}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>
                    <TermTooltip term="min_samples_leaf" label="min_samples_leaf" textClass="text-gray-400" />
                  </label>
                  <input type="number" min="1" max="50" value={modelConf.dtParams.min_samples_leaf}
                    onChange={e => updateModel(num, 'min_samples_leaf', Number(e.target.value), 'dtParams')}
                    className={inputClass} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelClass}>n_estimators (50–1000)</label>
                  <input type="number" min="50" max="1000" value={modelConf.rfParams?.n_estimators ?? 200}
                    onChange={e => updateModel(num, 'n_estimators', Number(e.target.value), 'rfParams')}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>max_depth (kosong = tanpa batas)</label>
                  <input type="number" min="1" max="100" value={modelConf.rfParams?.max_depth ?? ''}
                    onChange={e => updateModel(num, 'max_depth', e.target.value === '' ? null : Number(e.target.value), 'rfParams')}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>min_samples_split</label>
                  <input type="number" min="2" max="100" value={modelConf.rfParams?.min_samples_split ?? 2}
                    onChange={e => updateModel(num, 'min_samples_split', Number(e.target.value), 'rfParams')}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>min_samples_leaf</label>
                  <input type="number" min="1" max="100" value={modelConf.rfParams?.min_samples_leaf ?? 1}
                    onChange={e => updateModel(num, 'min_samples_leaf', Number(e.target.value), 'rfParams')}
                    className={inputClass} />
                </div>
              </div>
            )}
          </div>
          {/* Dataset split */}
          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <DatabaseIcon size={14} /> <TermTooltip term="split_dataset" textClass="text-gray-300" />
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Data Test (%)</label>
                <input type="number" min="10" max="50" value={modelConf.testSize}
                  onChange={e => updateModel(num, 'testSize', Number(e.target.value))}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}><TermTooltip term="random_state" textClass="text-gray-400" /></label>
                <input type="number" min="0" value={modelConf.randomState}
                  onChange={e => updateModel(num, 'randomState', Number(e.target.value))}
                  className={inputClass} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ── Render hasil evaluasi satu model ──────────────────────────────────────
  const renderResult = (modelConf, accentColor, borderColor) => {
    if (modelConf.error) {
      return (
        <div className={`bg-[#1a1d27] p-6 rounded-xl border ${borderColor}`}>
          <div className="flex items-center gap-2 text-red-400 mb-2"><AlertCircleIcon size={18}/> Evaluasi Gagal</div>
          <p className="text-sm text-gray-400">{modelConf.error}</p>
        </div>
      );
    }
    if (!modelConf.metrics) return null;
    const m = modelConf.metrics;
    const algorithm = normalizeAlgorithm(modelConf.algorithm);
    const vizAssessment = getVisualizationAssessment(m, algorithm);
    const overfit = getOverfittingAnalysis(m, algorithm);
    return (
      <div className={`bg-[#1a1d27] p-4 sm:p-6 rounded-xl border ${borderColor} space-y-6`}>
        <h2 className={`text-xl font-bold flex items-center gap-2 ${accentColor}`}>
          <ActivityIcon size={20}/> Hasil: {modelConf.name}
        </h2>
        {/* Info dataset */}
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1.5">
          <span><DatabaseIcon size={10} className="inline mr-1"/>Total: {m.dataset_info?.total_rows?.toLocaleString()} baris</span>
          <span>Train: {m.dataset_info?.train_rows?.toLocaleString()}</span>
          <span>Test: {m.dataset_info?.test_rows?.toLocaleString()}</span>
        </div>
        {/* Metrik kartu */}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3.5 sm:gap-4">
          <MetricCard icon={TargetIcon}   label="R² Score" labelTerm="r2" trainVal={`${(m.train.r2*100).toFixed(2)}%`} testVal={`${(m.test.r2*100).toFixed(2)}%`} />
          <MetricCard icon={ActivityIcon} label="RMSE"     labelTerm="rmse" trainVal={fmtRp(Math.round(m.train.rmse))}  testVal={fmtRp(Math.round(m.test.rmse))} />
          <MetricCard icon={CpuIcon}      label="MSE"      labelTerm="mse" trainVal={fmtRp(Math.round(m.train.mse))}   testVal={fmtRp(Math.round(m.test.mse))} />
        </div>
        
        {/* Grafik LineChart Train vs Test */}
        <OverviewLineChart m={m} />

        {/* Ringkasan visualisasi */}
        <InterpretationPanel metrics={m} vizAssessment={vizAssessment} overfit={overfit} />

        {/* Kartu Analisis Gap (di bawah grafik) */}
        <div className="bg-[#0f1117] p-4 sm:p-5 rounded-xl border border-gray-800 text-sm min-w-0">
          <h3 className="font-semibold text-gray-300 mb-3 flex items-center justify-between">
            Analisis <TermTooltip term="overfitting" textClass="text-gray-300" /> <InfoTip text="Perbedaan kinerja antara data yang dilihat (Train) vs belum dilihat (Test)." />
          </h3>

          <div className="mb-4">
            <div className="text-gray-400 mb-1"><TermTooltip term="r2" textClass="text-gray-400" /> <TermTooltip term="train" textClass="text-gray-400" />-<TermTooltip term="test" textClass="text-gray-400" /> Gap:</div>
            <div className={`text-2xl font-bold ${overfit.level === 'Tinggi' ? 'text-red-400' : overfit.level === 'Sedang' ? 'text-amber-400' : 'text-green-400'}`}>
              {(overfit.r2Gap * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Rasio <TermTooltip term="rmse" textClass="text-gray-500" /> <TermTooltip term="test" textClass="text-gray-500" />/<TermTooltip term="train" textClass="text-gray-500" />: {overfit.rmseRatio.toFixed(2)}x</div>
          </div>

          <div className={`p-3 rounded-lg border text-xs sm:text-sm leading-relaxed wrap-break-word ${overfit.toneClass}`}>
            {overfit.message}
          </div>
        </div>

        <button onClick={() => handleSave(modelConf)}
          className={`w-full py-3 px-4 rounded-md font-medium border transition-colors ${accentColor === 'text-cyan-400' ? 'border-cyan-600 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-50' : accentColor === 'text-emerald-400' ? 'border-emerald-600 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-50' : 'border-amber-600 bg-amber-600/20 hover:bg-amber-600/40 text-amber-50'}`}>
          Simpan {modelConf.name}
        </button>
      </div>
    );
  };


  // ── Render utama ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Playground Model</h1>
          <p className="text-gray-400">
            Eksperimen hyperparameter secara real-time. Evaluasi menggunakan dataset asli — bukan simulasi.
          </p>
        </div>
        <button
          onClick={() => { setIsComparing(!isComparing); setTrainingState('idle'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${isComparing
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30'}`}
        >
          {isComparing ? <><XIcon size={18}/> Batal Bandingkan</> : <><PlusIcon size={18}/> Bandingkan 3 Model</>}
        </button>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5 mb-8">
        <h2 className="text-lg font-semibold mb-2">Overview Halaman Playground</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Halaman ini digunakan untuk eksperimen model secara interaktif: ubah hyperparameter, jalankan evaluasi pada dataset asli,
          bandingkan tiga model secara multidimensi, dan baca interpretasi performa serta overfitting secara otomatis.
        </p>
      </div>

      {/* Konfigurasi */}
      <div className={`grid grid-cols-1 ${isComparing ? 'lg:grid-cols-3' : 'max-w-3xl mx-auto'} gap-6 sm:gap-8 mb-8`}>
        {renderConfig(1, model1)}
        {isComparing && renderConfig(2, model2)}
        {isComparing && renderConfig(3, model3)}
      </div>

      {/* Tombol Train */}
      <div className="flex justify-center mb-8 sm:mb-10">
        <button onClick={handleTrain} disabled={trainingState === 'training'}
          className="w-full max-w-md py-4 px-6 rounded-lg font-bold text-white text-lg flex justify-center items-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition-all">
          <Settings2Icon className={trainingState === 'training' ? 'animate-spin' : ''} />
          {trainingState === 'training'
            ? 'Mengevaluasi model dengan data asli...'
            : isComparing ? 'Latih & Bandingkan 3 Model' : 'Latih Model'}
        </button>
      </div>

      {/* Hasil */}
      {trainingState === 'done' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Satu model */}
          {!isComparing && renderResult(model1, 'text-cyan-400', 'border-cyan-500/30')}

          {/* Dua model: radar + kartu + hasil masing-masing */}
          {isComparing && model1.metrics && model2.metrics && model3.metrics && (
            <div className="bg-linear-to-br from-[#1a1d27] to-[#0f1117] p-5 sm:p-8 rounded-xl border border-gray-800 overflow-hidden">
              {(() => {
                const cmp = getComparisonInterpretation([model1, model2, model3]);
                return (
                  <div className="mb-5 p-4 rounded-xl border border-indigo-500/30 bg-indigo-900/20 text-sm text-indigo-100">
                    <div className="font-semibold text-indigo-100">Interpretasi Perbandingan Multidimensi (Data Real)</div>
                    {!cmp.isTie ? (
                      <p className="mt-1 leading-relaxed wrap-break-word">
                        Model yang saat ini paling unggul: <strong>{cmp.winnerName}</strong>. Keunggulan didasarkan pada metrik evaluasi nyata (R² test, RMSE test, MSE test, stabilitas gap train-test, dan kecepatan evaluasi), bukan data template.
                      </p>
                    ) : (
                      <p className="mt-1 leading-relaxed wrap-break-word">
                        Belum ada model yang unggul mutlak. Tiga model masih terlalu berdekatan sehingga keputusan pemenang ditahan untuk menghindari interpretasi yang menyesatkan.
                      </p>
                    )}
                    <p className="mt-1 text-xs opacity-90">
                      Selisih skor komposit: {cmp.scoreGapPct.toFixed(2)} poin.
                    </p>
                    <p className="mt-2 text-xs opacity-90">
                      Alasan utama: {cmp.reasons.length ? cmp.reasons.join(', ') : cmp.summary}
                    </p>
                    <p className="mt-2 text-xs opacity-90">
                      Kategori unggul per model: {cmp.categorySummary}
                    </p>
                  </div>
                );
              })()}

              <h2 className="text-2xl font-bold mb-6 text-indigo-300 flex items-center gap-2">
                <ActivityIcon size={24}/> Perbandingan Multidimensi
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 xl:gap-10">
                <div className="lg:col-span-3 min-h-80">
                  <CompareLineChart models={[model1, model2, model3]} />
                </div>
                <div className="lg:col-span-2 flex flex-col gap-4 justify-center min-w-0">
                  {[
                    { m: model1, accent: 'text-cyan-400', border: 'border-cyan-500/30', btn: 'border-cyan-600 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-50' },
                    { m: model2, accent: 'text-amber-400', border: 'border-amber-500/30', btn: 'border-amber-600 bg-amber-600/20 hover:bg-amber-600/40 text-amber-50' },
                    { m: model3, accent: 'text-emerald-400', border: 'border-emerald-500/30', btn: 'border-emerald-600 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-50' },
                  ].map(({ m, accent, border, btn }) => (
                    <div key={m.name} className={`bg-[#0f1117] p-4 sm:p-5 rounded-xl border ${border} min-w-0 comparison-model-card`}>
                      <h3 className={`font-bold mb-3 ${accent}`}>{m.name}</h3>
                      <div className="space-y-1.5 text-sm mb-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-400">R² Train / Test:</span>
                          <span className="font-medium text-gray-100 tabular-nums wrap-break-word">
                            {(m.metrics.train.r2*100).toFixed(2)}% / {(m.metrics.test.r2*100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-400">RMSE Test:</span>
                          <span className="font-medium text-gray-100 tabular-nums wrap-break-word">{fmtRp(Math.round(m.metrics.test.rmse))}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-400">Kecepatan Evaluasi:</span>
                          <span className="font-medium text-gray-100 tabular-nums wrap-break-word">{m.metrics.elapsed_ms?.toFixed(1)} ms</span>
                        </div>
                      </div>
                      <button onClick={() => handleSave(m)}
                        className={`w-full py-2 px-4 rounded-md font-medium border transition-colors text-sm ${btn}`}>
                        Simpan {m.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Hasil per model (detail bar chart) */}
          {isComparing
            ? <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 xl:gap-10">
                {renderResult(model1, 'text-cyan-400',  'border-cyan-500/30')}
                {renderResult(model2, 'text-amber-400', 'border-amber-500/30')}
                {renderResult(model3, 'text-emerald-400', 'border-emerald-500/30')}
              </div>
            : null}

        </div>
      )}
    </div>
  );
}
