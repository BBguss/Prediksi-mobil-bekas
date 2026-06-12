import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Calendar, Fuel, Settings, Cpu, ChevronRight,
  Database, GitBranch, ArrowRight, Layers
} from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();

  const [selYear,  setSelYear]  = useState('2018');
  const [selTrans, setSelTrans] = useState('Manual');
  const [selFuel,  setSelFuel]  = useState('Petrol');
  const [selEng,   setSelEng]   = useState('1200');

  const [stage,  setStage]  = useState(0);
  const [isDark, setIsDark] = useState(false);
  const scrollContainerRef = useRef(null);
  const tlRef = useRef(null);

  const [datasetInfo, setDatasetInfo] = useState({
    filename: 'Car details v3 (1).csv',
    total_rows: 8128,
    is_custom: false,
    price_currency: 'INR'
  });

  useEffect(() => {
    let active = true;
    import('../services/api').then(({ getActiveDataset, getDatasetPreview }) => {
      if (!active) return;
      getActiveDataset().then(info => {
        if (!active) return;
        if (info) {
          getDatasetPreview(1, 1).then(preview => {
            if (!active) return;
            setDatasetInfo({
              filename: info.filename || 'Car details v3 (1).csv',
              total_rows: preview.total_rows || 8128,
              is_custom: !!info.is_custom,
              price_currency: info.price_currency || 'INR'
            });
          }).catch(() => {
            if (!active) return;
            setDatasetInfo(prev => ({
              ...prev,
              filename: info.filename || prev.filename,
              is_custom: !!info.is_custom,
              price_currency: info.price_currency || prev.price_currency
            }));
          });
        }
      }).catch(() => {});
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('theme-dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const D   = isDark;
  const lH  = D ? '#38bdf8'               : '#1e40af';  // primary line
  const lM  = D ? '#0ea5e9'               : '#3b82f6';  // secondary line
  const gMj = D ? 'rgba(56,189,248,0.07)' : 'rgba(30,64,175,0.05)';
  const dim = D ? '#7dd3fc'               : '#3a5e8c';  // annotations & dimensions
  const htc = D ? 'rgba(56,189,248,0.45)' : 'rgba(30,64,175,0.35)'; // hatching
  const pF  = D ? '#06080e'               : '#ffffff';  // paper fill (part cover)
  const glT = D ? 'rgba(56,189,248,0.06)' : 'rgba(59,130,246,0.05)'; // glass tint
  const emG = D ? '#34d399'               : '#059669';  // approval stamp

  const STAGES = [
    { 
      title:'Pendahuluan Proyek',    
      sub:'',                    
      color:'slate',   
      desc:'Scroll untuk mulai menggambar blueprint arsitektur proyek ini secara interaktif.', 
      code:null 
    },
    { 
      title:'Eksplorasi Dataset',   
      sub:'INFO · TAHAP 1/3', 
      color:'cyan',    
      desc:'Menganalisis pola dari 8.000+ data transaksi mobil bekas secara dinamis. Fitur utama seperti tahun, kilometer, bahan bakar, dan transmisi dipelajari untuk memprediksi depresiasi harga.', 
      code:'DATASET_NAME : Car details v3\nTOTAL_ROWS   : 8,128 records\nFEATURES     : 13 columns\nTARGET_LABEL : selling_price' 
    },
    { 
      title:'Integrasi Teknologi',      
      sub:'TECH · TAHAP 2/3', 
      color:'amber',   
      desc:'Menghubungkan antarmuka React dengan mesin AI scikit-learn melalui Node.js backend. Eksekusi model dilakukan melalui subprocess Python IPC Bridge untuk performa inferensi real-time.', 
      code:'FRONTEND     : React 19 + Vite\nBACKEND      : Express (TypeScript)\nML_ENGINE    : Python (Scikit-Learn)\nIPC_BRIDGE   : Subprocess spawn' 
    },
    { 
      title:'Evaluasi Performa',  
      sub:'MODEL · TAHAP 3/3', 
      color:'emerald', 
      desc:'Hasil prediksi tiga model siap dibandingkan secara instan. Model Random Forest Regressor memberikan akurasi tertinggi disusul oleh model KNN dan Decision Tree.', 
      code:'STATUS       : DEPLOYED & APPROVED\nRANDOM_FOREST: 91.2% R² Score\nKNN_ACCURACY : 88.7% R² Score\nRESPONSE_TIME: <150ms latency', 
      cta:true 
    },
  ];

  const colorMap = {
    slate:   { badge:'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/25',    dot:'bg-slate-400'    },
    cyan:    { badge:'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-400/25',        dot:'bg-cyan-500'     },
    blue:    { badge:'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-400/25',        dot:'bg-blue-500'     },
    amber:   { badge:'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/25',    dot:'bg-amber-500'    },
    violet:  { badge:'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-400/25',dot:'bg-violet-500'   },
    indigo:  { badge:'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-400/25',dot:'bg-indigo-500'   },
    emerald: { badge:'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/25',dot:'bg-emerald-500'},
  };

  // Maps seek time → stage number
  const getStageFromTime = (t) => {
    if (t < 100)  return 0;   // blank sheet
    if (t < 4600) return 1;   // FIG_001 side elevation
    if (t < 9200) return 2;   // FIG_002 top plan
    return 3;                 // FIG_003 rear elevation
  };

  const syncScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const tl = tlRef.current;
    if (!container || !tl) return;
    const rect     = container.getBoundingClientRect();
    const scrollable = container.offsetHeight - window.innerHeight;
    const scrolled = Math.max(0, -rect.top);
    const progress = Math.min(1, scrolled / scrollable);
    const seekMs   = progress * tl.duration;
    tl.seek(seekMs);
    setStage(getStageFromTime(seekMs));
  }, []);

  // Init SVG path lengths (needed for strokeDashoffset from-to)
  useEffect(() => {
    document.querySelectorAll('.sv-path, .tv-path, .rv-path').forEach(el => {
      try {
        const l = el.getTotalLength();
        el.style.strokeDasharray = `${l}`;
        el.style.strokeDashoffset = `${l}`;
      } catch(e) {}
    });
  }, []);

  // Build scroll-driven timeline (autoplay: false)
  useEffect(() => {
    let active = true;
    import('animejs').then(({ createTimeline, stagger }) => {
      if (!active) return;
      const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutQuad' } });
      /* FIG_001 — side elevation */
      tl.add('#view-side', { opacity: [0, 1], duration: 200 }, 0);
      tl.add('.sv-path',   { strokeDashoffset: 0, duration: 1800, delay: stagger(30), ease: 'inOutSine' }, 100);
      tl.add('.sv-lbl',    { opacity: [0, 1], translateX: [-6, 0], duration: 500, delay: stagger(90) }, 2700);
      tl.add('.sv-fill',   { opacity: [0, 1], duration: 600 }, 2900);
      tl.add('#view-side', { opacity: [1, 0], duration: 400, ease: 'inQuad' }, 4200);
      /* FIG_002 — top plan (engine bay) */
      tl.add('#view-top',  { opacity: [0, 1], duration: 200 }, 4600);
      tl.add('.tv-path',   { strokeDashoffset: 0, duration: 1800, delay: stagger(30), ease: 'inOutSine' }, 4700);
      tl.add('.tv-lbl',    { opacity: [0, 1], translateX: [-6, 0], duration: 500, delay: stagger(90) }, 7300);
      tl.add('.tv-fill',   { opacity: [0, 1], duration: 600 }, 7500);
      tl.add('#view-top',  { opacity: [1, 0], duration: 400, ease: 'inQuad' }, 8800);
      /* FIG_003 — rear elevation */
      tl.add('#view-rear', { opacity: [0, 1], duration: 200 }, 9200);
      tl.add('.rv-path',   { strokeDashoffset: 0, duration: 1800, delay: stagger(34), ease: 'inOutSine' }, 9300);
      tl.add('.rv-lbl',    { opacity: [0, 1], translateX: [-6, 0], duration: 500, delay: stagger(90) }, 11700);
      tl.add('.rv-fill',   { opacity: [0, 1], duration: 600 }, 11900);
      tl.add('#bp-stamp',  { opacity: [0, 1], scale: [1.5, 1], duration: 450, ease: 'outBack' }, 12600);
      tlRef.current = tl;
      syncScroll();
    });
    return () => { active = false; };
  }, [syncScroll]);

  // Scroll listener
  useEffect(() => {
    window.addEventListener('scroll', syncScroll, { passive: true });
    return () => window.removeEventListener('scroll', syncScroll);
  }, [syncScroll]);

  const handlePredict = () => navigate('/predict', { state:{ year:+selYear, transmission:selTrans, fuel:selFuel, engine:+selEng } });

  const cur = STAGES[stage] || STAGES[0];
  const cmc = colorMap[cur.color] || colorMap.slate;

  const filters = [
    { Icon:Calendar, label:'Tahun',       val:selYear,  set:setSelYear,  opts:['2024','2023','2022','2021','2020','2019','2018','2017','2016','2015'], names:null },
    { Icon:Settings, label:'Transmisi',   val:selTrans, set:setSelTrans, opts:['Manual','Automatic'],               names:['Manual','Otomatis'] },
    { Icon:Fuel,     label:'Bahan Bakar', val:selFuel,  set:setSelFuel,  opts:['Petrol','Diesel','CNG','LPG'],     names:['Bensin','Diesel','CNG','LPG'] },
    { Icon:Cpu,      label:'Mesin (cc)',  val:selEng,   set:setSelEng,   opts:['1000','1200','1500','2000','2500'],names:['1000 cc','1200 cc','1500 cc','2000 cc','2500 cc'] },
  ];

  const algoCards = [
    { Icon:Database,  abbr:'KNN', title:'K-Nearest Neighbors', r2:'88.7%', desc:'Mencari K kendaraan paling mirip di ruang fitur multidimensi, lalu merata-ratakan harganya.', pros:['Tangkap pola lokal kompleks','Adaptif terhadap data baru'],  path:'model-info#knn', hover:'hover:border-cyan-400/40',    r2c:'text-cyan-600 dark:text-cyan-400',    ic:'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',    dot:'bg-cyan-500',    lk:'text-cyan-600 dark:text-cyan-400' },
    { Icon:GitBranch, abbr:'DT',  title:'Decision Tree',        r2:'82.3%', desc:'Membagi data melalui aturan keputusan logis bertingkat hingga leaf node prediksi harga.',   pros:['Sangat mudah diinterpretasi','Ringan dan cepat'],             path:'model-info#dt',  hover:'hover:border-amber-400/40',   r2c:'text-amber-600 dark:text-amber-400',   ic:'bg-amber-500/10 text-amber-600 dark:text-amber-400',   dot:'bg-amber-500',   lk:'text-amber-600 dark:text-amber-400' },
    { Icon:Layers,    abbr:'RF',  title:'Random Forest',        r2:'91.2%', desc:'Ensemble 100+ pohon independen memberikan estimasi stabil dan tahan terhadap outlier.',     pros:['Akurasi tertinggi','Resistif terhadap overfitting'],          path:'model-info#rf',  hover:'hover:border-emerald-400/40', r2c:'text-emerald-600 dark:text-emerald-400', ic:'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot:'bg-emerald-500', lk:'text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="font-sans-premium min-h-screen text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#06080e] transition-colors duration-300">

      {/* ── HERO ──────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Gradients & Grids */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute -top-[8%] left-1/3 w-[900px] h-[640px] rounded-full bg-cyan-400/7 dark:bg-cyan-400/4 blur-[150px]"/>
          <div className="absolute top-[30%] right-[-8%] w-[480px] h-[480px] rounded-full bg-violet-500/6 dark:bg-violet-500/3 blur-[110px]"/>
          <div className="absolute inset-0 blueprint-grid opacity-20 dark:opacity-25"/>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Headline & Stats */}
            <div className="lg:col-span-7 text-left space-y-8">
              <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{duration:0.55}}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 dark:border-cyan-400/20 bg-cyan-500/7 dark:bg-cyan-400/8">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse"/>
                <span className="text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-widest font-semibold">
                  ML Prediction Engine · KNN · DT · RF
                </span>
              </motion.div>

              <div className="space-y-4">
                <motion.h1 initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:0.65,delay:0.1}}
                  className="text-4xl sm:text-5xl md:text-6xl font-serif-elegant font-bold leading-[1.15] tracking-tight">
                  <span className="text-slate-900 dark:text-white">Prediksi Harga</span><br/>
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-600 via-blue-600 to-violet-600 dark:from-cyan-400 dark:via-sky-400 dark:to-violet-400">
                    Mobil Bekas
                  </span><br/>
                  <span className="text-slate-900 dark:text-white">dengan Presisi AI</span>
                </motion.h1>
                
                <motion.p initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.65,delay:0.2}}
                  className="text-base text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                  Estimasi nilai jual kendaraan secara akurat menggunakan tiga algoritma machine learning yang dilatih pada lebih dari 8.000 data transaksi nyata.
                </motion.p>
              </div>

              {/* Stats Grid */}
              <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:0.55,delay:0.28}}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl">
                {[
                  ['8.000+','Data Historis'],
                  ['3','Algoritma ML'],
                  ['91.2%','R² Terbaik'],
                  ['<150ms','Latensi Inferensi']
                ].map(([v,l])=>(
                  <div key={l} className="bg-white/60 dark:bg-[#0c1019]/60 border border-slate-200/60 dark:border-slate-800/50 rounded-xl p-3.5 shadow-xs">
                    <div className="text-xl font-bold font-serif-elegant text-slate-900 dark:text-white">{v}</div>
                    <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">{l}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right Column: Predictive Interactive Widget */}
            <div className="lg:col-span-5">
              <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{duration:0.65,delay:0.3}}
                className="bg-white dark:bg-[#101520]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
                
                <div className="mb-5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Estimasi Instan</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tentukan kriteria dasar mobil Anda</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    {filters.map((f)=>(
                      <div key={f.label} className="p-3 rounded-xl border border-slate-100 dark:border-slate-850/80 bg-slate-50/50 dark:bg-[#0c1019]/50 flex items-center gap-2">
                        <f.Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0"/>
                        <div className="w-full">
                          <span className="block text-[8px] uppercase font-bold tracking-widest text-slate-405 dark:text-slate-600">{f.label}</span>
                          <select value={f.val} onChange={e=>f.set(e.target.value)} className="w-full bg-transparent font-semibold text-xs text-slate-900 dark:text-slate-100 border-none focus:outline-none cursor-pointer">
                            {f.opts.map((o,oi)=><option key={o} value={o}>{f.names?f.names[oi]:o}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={handlePredict} className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl py-3.5 shrink-0 transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/10">
                    Cari Estimasi Harga <ArrowRight className="w-4 h-4"/>
                  </button>
                  
                  <div className="pt-2 text-center text-[9px] font-mono text-slate-450 dark:text-slate-550 border-t border-slate-100 dark:border-slate-800/80">
                    * Didukung Model KNN & Decision Tree dengan latensi real-time
                  </div>
                </div>
              </motion.div>
            </div>

          </div>

          {/* Scroll assembly prompt */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.4,duration:0.7}} className="mt-14 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-600">
            <span className="text-[9px] font-mono uppercase tracking-widest">Scroll untuk melihat perakitan</span>
            <motion.div animate={{y:[0,6,0]}} transition={{duration:1.6,repeat:Infinity,ease:'easeInOut'}} className="w-px h-8 bg-linear-to-b from-slate-300/70 dark:from-slate-600/70 to-transparent"/>
          </motion.div>
        </div>
      </section>

      {/* ── PROJECT OVERVIEW ────────────────────────────────── */}
      <section className="py-20 border-b border-slate-200/70 dark:border-slate-800/50 bg-slate-100/30 dark:bg-[#090d16]/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-4 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20 dark:border-cyan-400/15">
                Overview Proyek
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif-elegant font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                Menghilangkan Asimetri Informasi dalam Pasar Mobil Bekas
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">
                Menentukan nilai wajar kendaraan bekas adalah tantangan klasik yang dipenuhi ketidakpastian. Pembeli takut membayar terlalu mahal, sedangkan penjual khawatir menetapkan harga terlalu rendah.
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
                <strong>Car Price Intelligence</strong> hadir sebagai solusi analitis berbasis data. Dengan mempelajari hubungan non-linear dari ribuan transaksi historis nyata, mesin AI kami mengestimasi nilai wajar secara adil dan transparan.
              </p>
              <div className="flex gap-4">
                <div className="flex-1 p-4 bg-white dark:bg-[#0c1019] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">Akurasi Valid</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Model dievaluasi ketat menggunakan metrik R² dan MAE guna memastikan ketepatan estimasi.</p>
                </div>
                <div className="flex-1 p-4 bg-white dark:bg-[#0c1019] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">Komparasi Terbuka</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Membandingkan tiga pendekatan algoritma yang berbeda (KNN, Decision Tree, Random Forest) secara langsung.</p>
                </div>
              </div>
            </div>
            <div>
              <div className="bg-white dark:bg-[#0c1019] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Arsitektur Integrasi Sistem
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-bold">UI</div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">React Frontend (Vite)</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">Antarmuka interaktif premium menggunakan Tailwind CSS, Framer Motion, dan visualisasi Anime.js.</p>
                    </div>
                  </div>
                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-800/80 ml-4"></div>
                  <div className="flex gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold">API</div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Express.js Server (TypeScript)</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">Mengelola database riwayat, feedback pengguna, otentikasi admin, serta penyesuaian dataset aktif.</p>
                    </div>
                  </div>
                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-800/80 ml-4"></div>
                  <div className="flex gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400 text-xs font-mono font-bold">ML</div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Python Scikit-Learn Engine</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">Memuat model serialized (.sav) dan melakukan kalkulasi inferensi secara langsung lewat Python subprocess bridge.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ANIME.JS CAR SECTION — scroll-driven ────────── */}
      {/* Outer tall container: gives scroll room to drive animation */}
      <div ref={scrollContainerRef} className="relative" style={{ height: '440vh' }}>
        {/* Sticky inner: stays in viewport while user scrolls */}
        <div className="sticky top-0 h-screen border-y border-slate-200/70 dark:border-slate-800/50 bg-white dark:bg-[#06080e] overflow-hidden flex flex-col">
          <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col min-h-0">

            <div className="text-center pt-7 pb-3 shrink-0">
              <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20 dark:border-cyan-400/15">Technical Blueprint</span>
              <h2 className="text-2xl sm:text-3xl font-serif-elegant font-bold text-slate-900 dark:text-white">Tiga Proyeksi, Satu Kendaraan</h2>
            </div>

          <div className="flex-1 flex flex-col xl:flex-row gap-6 xl:gap-10 items-center xl:items-start min-h-0">

            {/* SVG blueprint sheet */}
            <div className="w-full xl:flex-1 flex flex-col items-center">
              <div className="w-full max-w-[760px]">
                <svg viewBox="0 0 800 460" className="w-full h-auto select-none">
                    <defs>
                      <pattern id="bpHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="6" stroke={htc} strokeWidth="0.9"/>
                      </pattern>
                      <marker id="bpArr" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
                        <path d="M 0,1.2 L 9,5 L 0,8.8 Z" fill={lH}/>
                      </marker>
                    </defs>

                    {/* ── static sheet chrome ── */}
                    <rect x="14" y="14" width="772" height="432" fill="none" stroke={dim} strokeWidth="1" opacity="0.5"/>
                    <rect x="20" y="20" width="760" height="420" fill="none" stroke={dim} strokeWidth="0.5" opacity="0.25"/>
                    {[0,1,2,3,4,5,6,7,8,9].map(i=>(<line key={`gh${i}`} x1="44" y1={56+i*36} x2="756" y2={56+i*36} stroke={gMj} strokeWidth="0.5"/>))}
                    {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(i=>(<line key={`gv${i}`} x1={76+i*40} y1="28" x2={76+i*40} y2="432" stroke={gMj} strokeWidth="0.5"/>))}
                    <text x="770" y="230" transform="rotate(90 770 230)" textAnchor="middle" fontSize="8" fontFamily="monospace" letterSpacing="3" fill={dim} opacity="0.8">[ CAR ASSEMBLY — TECHNICAL BLUEPRINT ]</text>
                    <text x="30" y="230" transform="rotate(-90 30 230)" textAnchor="middle" fontSize="8" fontFamily="monospace" letterSpacing="3" fill={dim} opacity="0.6">CP-BP/26 · REV_03</text>
                    <text x="30" y="438" fontSize="7" fontFamily="monospace" letterSpacing="1" fill={dim} opacity="0.6">SCALE 1:48 · UNITS MM</text>
                    <text x="772" y="408" transform="rotate(90 772 408)" fontSize="7" fontFamily="monospace" fill={dim} opacity="0.6">© 2026</text>

                    {/* ════ FIG_001 · SIDE ELEVATION ════ */}
                    <g id="view-side">
                      <text x="44" y="48" fontSize="12" fontFamily="monospace" fontWeight="700" letterSpacing="2" fill={lH}>FIG_001</text>
                      <text x="44" y="62" fontSize="8" fontFamily="monospace" letterSpacing="1.5" fill={dim}>SIDE ELEVATION — TAMPAK SAMPING</text>
                      {/* body */}
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="2" strokeLinejoin="round"
                        d="M 78,318 C 74,306 76,290 88,280 L 104,262 L 120,244 L 168,224 C 196,210 226,202 258,200 L 294,200 L 318,188 C 336,168 358,157 380,155 L 478,155 C 498,155 519,167 537,186 L 563,212 C 576,222 590,231 609,233 L 657,224 C 682,223 706,234 722,254 C 732,269 730,301 722,316 L 708,320 L 658,320 C 658,290 546,290 546,320 L 266,320 C 266,290 158,290 158,320 L 108,320 Z"/>
                      {/* glasshouse */}
                      <path className="sv-path" fill="none" stroke={lM} strokeWidth="1.3"
                        d="M 318,188 L 380,155 L 478,155 L 537,186 L 563,212 L 308,216 Z"/>
                      <line className="sv-path" x1="350" y1="208" x2="392" y2="161" stroke={lM} strokeWidth="0.7" opacity="0.55"/>
                      <line className="sv-path" x1="364" y1="210" x2="406" y2="163" stroke={lM} strokeWidth="0.7" opacity="0.55"/>
                      <line className="sv-path" x1="498" y1="210" x2="522" y2="178" stroke={lM} strokeWidth="0.7" opacity="0.55"/>
                      <line className="sv-path" x1="436" y1="155" x2="445" y2="216" stroke={lH} strokeWidth="2"/>
                      {/* doors / handles / hood line */}
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="1" d="M 320,219 L 326,318"/>
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="1" d="M 446,218 L 449,318"/>
                      <rect className="sv-path" x="344" y="258" width="26" height="7" rx="2" fill="none" stroke={lH} strokeWidth="1"/>
                      <rect className="sv-path" x="470" y="255" width="26" height="7" rx="2" fill="none" stroke={lH} strokeWidth="1"/>
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="1.2" d="M 294,200 L 294,230"/>
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="0.9" opacity="0.55" d="M 96,282 C 230,276 420,268 622,258"/>
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="0.9" opacity="0.45" d="M 162,312 L 542,312"/>
                      <path className="sv-path" fill="none" stroke={lM} strokeWidth="1.1" d="M 296,193 L 287,185 L 296,178 L 306,186 Z"/>
                      {/* lamps & grille */}
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="1.3" d="M 80,282 L 96,262 L 137,257 L 140,293 L 92,299 Z"/>
                      <circle className="sv-path" cx="115" cy="278" r="8" fill="none" stroke={lM} strokeWidth="1"/>
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="1.2" d="M 80,301 L 82,318 L 149,318 L 149,289 Z"/>
                      <line className="sv-path" x1="88" y1="296" x2="146" y2="299" stroke={lM} strokeWidth="0.8" opacity="0.6"/>
                      <line className="sv-path" x1="88" y1="304" x2="146" y2="306" stroke={lM} strokeWidth="0.8" opacity="0.6"/>
                      <line className="sv-path" x1="88" y1="312" x2="146" y2="313" stroke={lM} strokeWidth="0.8" opacity="0.6"/>
                      <path className="sv-path" fill="none" stroke={lH} strokeWidth="1.3" d="M 714,257 L 723,257 L 721,308 L 711,309 L 703,307 Z"/>
                      {/* wheels */}
                      <circle className="sv-path" cx="210" cy="330" r="48" fill="none" stroke={lH} strokeWidth="1.8"/>
                      <circle className="sv-path" cx="210" cy="330" r="40" fill="none" stroke={lH} strokeWidth="1"/>
                      <circle className="sv-path" cx="210" cy="330" r="29" fill="none" stroke={lM} strokeWidth="1.3"/>
                      <circle className="sv-path" cx="210" cy="330" r="8" fill="none" stroke={lM} strokeWidth="1.2"/>
                      {[18,90,162,234,306].map(a=>{const r=a*Math.PI/180;return(
                        <line key={`fs${a}`} className="sv-path" x1={210+Math.cos(r)*9} y1={330+Math.sin(r)*9} x2={210+Math.cos(r)*27} y2={330+Math.sin(r)*27} stroke={lM} strokeWidth="1.6"/>);})}
                      <circle className="sv-path" cx="596" cy="330" r="48" fill="none" stroke={lH} strokeWidth="1.8"/>
                      <circle className="sv-path" cx="596" cy="330" r="40" fill="none" stroke={lH} strokeWidth="1"/>
                      <circle className="sv-path" cx="596" cy="330" r="29" fill="none" stroke={lM} strokeWidth="1.3"/>
                      <circle className="sv-path" cx="596" cy="330" r="8" fill="none" stroke={lM} strokeWidth="1.2"/>
                      {[18,90,162,234,306].map(a=>{const r=a*Math.PI/180;return(
                        <line key={`rs${a}`} className="sv-path" x1={596+Math.cos(r)*9} y1={330+Math.sin(r)*9} x2={596+Math.cos(r)*27} y2={330+Math.sin(r)*27} stroke={lM} strokeWidth="1.6"/>);})}
                      {/* ground */}
                      <line className="sv-path" x1="60" y1="378" x2="740" y2="378" stroke={lH} strokeWidth="1.2"/>
                      {/* dimensions */}
                      <line className="sv-path" x1="78" y1="324" x2="78" y2="406" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="sv-path" x1="726" y1="320" x2="726" y2="406" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="sv-path" x1="78" y1="400" x2="726" y2="400" stroke={dim} strokeWidth="1"/>
                      <line className="sv-path" x1="78" y1="395" x2="78" y2="405" stroke={dim} strokeWidth="1.2"/>
                      <line className="sv-path" x1="726" y1="395" x2="726" y2="405" stroke={dim} strokeWidth="1.2"/>
                      <line className="sv-path" x1="210" y1="380" x2="210" y2="428" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="sv-path" x1="596" y1="380" x2="596" y2="428" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="sv-path" x1="210" y1="422" x2="596" y2="422" stroke={dim} strokeWidth="1"/>
                      <line className="sv-path" x1="210" y1="417" x2="210" y2="427" stroke={dim} strokeWidth="1.2"/>
                      <line className="sv-path" x1="596" y1="417" x2="596" y2="427" stroke={dim} strokeWidth="1.2"/>
                      <line className="sv-path" x1="484" y1="155" x2="756" y2="155" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="sv-path" x1="742" y1="378" x2="756" y2="378" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="sv-path" x1="750" y1="155" x2="750" y2="378" stroke={dim} strokeWidth="1"/>
                      {/* hatch & tint fills */}
                      <path className="sv-fill" fillRule="evenodd" fill="url(#bpHatch)" stroke="none"
                        d="M 210,282 a 48,48 0 1,0 0.01,0 Z M 210,290 a 40,40 0 1,0 0.01,0 Z"/>
                      <path className="sv-fill" fillRule="evenodd" fill="url(#bpHatch)" stroke="none"
                        d="M 596,282 a 48,48 0 1,0 0.01,0 Z M 596,290 a 40,40 0 1,0 0.01,0 Z"/>
                      <rect className="sv-fill" x="60" y="379" width="680" height="9" fill="url(#bpHatch)" opacity="0.7"/>
                      <path className="sv-fill" fill={glT} stroke="none" d="M 318,188 L 380,155 L 478,155 L 537,186 L 563,212 L 308,216 Z"/>
                      {/* part labels */}
                      <g className="sv-lbl bp-lbl">
                        <text x="542" y="121" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>ROOF PANEL</text>
                        <line x1="538" y1="125" x2="462" y2="150" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="sv-lbl bp-lbl">
                        <text x="150" y="135" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>WINDSHIELD</text>
                        <line x1="218" y1="139" x2="340" y2="175" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="sv-lbl bp-lbl">
                        <text x="36" y="238" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>HEADLAMP</text>
                        <line x1="58" y1="244" x2="100" y2="266" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="sv-lbl bp-lbl">
                        <text x="608" y="208" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>TAILLAMP</text>
                        <line x1="664" y1="214" x2="708" y2="255" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="sv-lbl bp-lbl">
                        <text x="402" y="394" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1" fill={dim}>LENGTH : 4,635 MM</text>
                        <text x="403" y="416" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1" fill={dim}>WHEELBASE : 2,750 MM</text>
                        <text x="762" y="266" transform="rotate(-90 762 266)" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1" fill={dim}>HEIGHT : 1,455 MM</text>
                      </g>
                    </g>

                    {/* ════ FIG_002 · TOP PLAN (engine bay) ════ */}
                    <g id="view-top">
                      <text x="44" y="48" fontSize="12" fontFamily="monospace" fontWeight="700" letterSpacing="2" fill={lH}>FIG_002</text>
                      <text x="44" y="62" fontSize="8" fontFamily="monospace" letterSpacing="1.5" fill={dim}>TOP PLAN — TAMPAK ATAS · ENGINE BAY</text>
                      {/* body outline */}
                      <path className="tv-path" fill="none" stroke={lH} strokeWidth="2" strokeLinejoin="round"
                        d="M 150,146 L 560,146 C 640,146 695,170 706,210 C 709,223 709,237 706,250 C 695,290 640,314 560,314 L 150,314 C 112,310 96,278 96,230 C 96,182 112,150 150,146 Z"/>
                      {/* glasshouse */}
                      <path className="tv-path" fill="none" stroke={lM} strokeWidth="1.2" d="M 300,150 Q 322,230 300,310"/>
                      <path className="tv-path" fill="none" stroke={lM} strokeWidth="1.2" d="M 352,154 Q 372,230 352,306"/>
                      <line className="tv-path" x1="312" y1="172" x2="332" y2="196" stroke={lM} strokeWidth="0.7" opacity="0.5"/>
                      <line className="tv-path" x1="310" y1="252" x2="330" y2="276" stroke={lM} strokeWidth="0.7" opacity="0.5"/>
                      <path className="tv-path" fill="none" stroke={lM} strokeWidth="1.2" d="M 520,154 Q 540,230 520,306"/>
                      <path className="tv-path" fill="none" stroke={lM} strokeWidth="1.2" d="M 566,160 Q 586,230 566,300"/>
                      <path className="tv-path" fill="none" stroke={lH} strokeWidth="1" opacity="0.6" d="M 648,156 Q 666,230 648,304"/>
                      <rect className="tv-path" x="368" y="186" width="64" height="88" rx="6" fill="none" stroke={lM} strokeWidth="1.2"/>
                      <line className="tv-path" x1="376" y1="266" x2="424" y2="194" stroke={lM} strokeWidth="0.7" opacity="0.5"/>
                      {/* mirrors */}
                      <path className="tv-path" fill="none" stroke={lH} strokeWidth="1.2" d="M 298,146 L 290,128 L 306,124 L 312,142"/>
                      <path className="tv-path" fill="none" stroke={lH} strokeWidth="1.2" d="M 298,314 L 290,332 L 306,336 L 312,318"/>
                      {/* engine bay cut */}
                      <rect className="tv-path" x="120" y="165" width="165" height="130" rx="7" fill="none" stroke={lH} strokeWidth="1.5"/>
                      <rect className="tv-fill" x="120" y="165" width="165" height="130" rx="7" fill="url(#bpHatch)" opacity="0.35" stroke="none"/>
                      {/* radiator */}
                      <rect className="tv-path" x="126" y="185" width="14" height="90" fill={pF} stroke={lH} strokeWidth="1.3"/>
                      <line className="tv-path" x1="130" y1="188" x2="130" y2="272" stroke={lM} strokeWidth="0.7" opacity="0.7"/>
                      <line className="tv-path" x1="134" y1="188" x2="134" y2="272" stroke={lM} strokeWidth="0.7" opacity="0.7"/>
                      {/* engine block — transverse inline-4 */}
                      <rect className="tv-path" x="152" y="178" width="86" height="110" rx="5" fill={pF} stroke={lH} strokeWidth="1.6"/>
                      {[196,222,248,274].map(cy=>(<circle key={`cyl${cy}`} className="tv-path" cx="195" cy={cy} r="11" fill="none" stroke={lM} strokeWidth="1.3"/>))}
                      {/* battery */}
                      <rect className="tv-path" x="246" y="176" width="36" height="30" rx="3" fill={pF} stroke={lH} strokeWidth="1.3"/>
                      <circle className="tv-path" cx="256" cy="184" r="2.5" fill="none" stroke={lM} strokeWidth="1"/>
                      <circle className="tv-path" cx="274" cy="184" r="2.5" fill="none" stroke={lM} strokeWidth="1"/>
                      {/* air box */}
                      <rect className="tv-path" x="246" y="252" width="36" height="36" rx="3" fill={pF} stroke={lH} strokeWidth="1.3"/>
                      <line className="tv-path" x1="246" y1="252" x2="282" y2="288" stroke={lM} strokeWidth="0.8" opacity="0.7"/>
                      <line className="tv-path" x1="282" y1="252" x2="246" y2="288" stroke={lM} strokeWidth="0.8" opacity="0.7"/>
                      <path className="tv-path" fill="none" stroke={lM} strokeWidth="1" d="M 238,232 C 244,232 246,240 250,244"/>
                      {/* hidden wheels & centerline (appear with details) */}
                      <rect className="tv-fill" x="178" y="124" width="64" height="30" rx="6" fill="none" stroke={lM} strokeWidth="1" strokeDasharray="5,4" opacity="0.7"/>
                      <rect className="tv-fill" x="178" y="306" width="64" height="30" rx="6" fill="none" stroke={lM} strokeWidth="1" strokeDasharray="5,4" opacity="0.7"/>
                      <rect className="tv-fill" x="562" y="124" width="64" height="30" rx="6" fill="none" stroke={lM} strokeWidth="1" strokeDasharray="5,4" opacity="0.7"/>
                      <rect className="tv-fill" x="562" y="306" width="64" height="30" rx="6" fill="none" stroke={lM} strokeWidth="1" strokeDasharray="5,4" opacity="0.7"/>
                      <line className="tv-fill" x1="70" y1="230" x2="730" y2="230" stroke={dim} strokeWidth="0.8" strokeDasharray="16,5,3,5" opacity="0.55"/>
                      {/* WIDTH dimension */}
                      <line className="tv-path" x1="712" y1="146" x2="744" y2="146" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="tv-path" x1="712" y1="314" x2="744" y2="314" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="tv-path" x1="738" y1="146" x2="738" y2="314" stroke={dim} strokeWidth="1"/>
                      <line className="tv-path" x1="733" y1="146" x2="743" y2="146" stroke={dim} strokeWidth="1.2"/>
                      <line className="tv-path" x1="733" y1="314" x2="743" y2="314" stroke={dim} strokeWidth="1.2"/>
                      {/* part labels */}
                      <g className="tv-lbl bp-lbl">
                        <text x="44" y="108" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>RADIATOR</text>
                        <line x1="98" y1="112" x2="130" y2="182" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="tv-lbl bp-lbl">
                        <text x="60" y="404" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>ENGINE · INLINE-4</text>
                        <line x1="128" y1="396" x2="186" y2="292" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="tv-lbl bp-lbl">
                        <text x="318" y="96" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>BATTERY</text>
                        <line x1="328" y1="102" x2="268" y2="172" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="tv-lbl bp-lbl">
                        <text x="470" y="96" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>SUNROOF</text>
                        <line x1="480" y1="102" x2="420" y2="188" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="tv-lbl bp-lbl">
                        <text x="478" y="234" textAnchor="middle" fontSize="9" fontFamily="monospace" letterSpacing="4" fill={dim} opacity="0.8">CABIN</text>
                      </g>
                      <g className="tv-lbl bp-lbl">
                        <text x="752" y="230" transform="rotate(-90 752 230)" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1" fill={dim}>WIDTH : 1,775 MM</text>
                      </g>
                    </g>

                    {/* ════ FIG_003 · REAR ELEVATION ════ */}
                    <g id="view-rear">
                      <text x="44" y="48" fontSize="12" fontFamily="monospace" fontWeight="700" letterSpacing="2" fill={lH}>FIG_003</text>
                      <text x="44" y="62" fontSize="8" fontFamily="monospace" letterSpacing="1.5" fill={dim}>REAR ELEVATION — TAMPAK BELAKANG</text>
                      {/* body outline */}
                      <path className="rv-path" fill="none" stroke={lH} strokeWidth="2" strokeLinejoin="round"
                        d="M 264,372 L 260,318 C 258,278 262,256 274,244 L 290,196 C 295,178 306,170 322,168 L 478,168 C 494,170 505,178 510,196 L 526,244 C 538,256 542,278 540,318 L 536,372 Z"/>
                      {/* rear window */}
                      <path className="rv-path" fill="none" stroke={lM} strokeWidth="1.2" d="M 310,178 L 490,178 L 504,222 L 296,222 Z"/>
                      <line className="rv-path" x1="318" y1="189" x2="482" y2="189" stroke={lM} strokeWidth="0.6" opacity="0.55"/>
                      <line className="rv-path" x1="314" y1="200" x2="486" y2="200" stroke={lM} strokeWidth="0.6" opacity="0.55"/>
                      <line className="rv-path" x1="310" y1="211" x2="490" y2="211" stroke={lM} strokeWidth="0.6" opacity="0.55"/>
                      {/* antenna fin */}
                      <path className="rv-path" fill="none" stroke={lH} strokeWidth="1.2" d="M 390,168 L 398,152 L 404,168"/>
                      {/* trunk & bumper lines */}
                      <path className="rv-path" fill="none" stroke={lH} strokeWidth="1" d="M 276,252 Q 400,246 524,252"/>
                      <line className="rv-path" x1="262" y1="312" x2="538" y2="312" stroke={lH} strokeWidth="1"/>
                      {/* taillamps */}
                      <path className="rv-path" fill="none" stroke={lH} strokeWidth="1.4" d="M 276,258 L 340,258 L 336,288 L 278,286 Z"/>
                      <line className="rv-path" x1="280" y1="268" x2="336" y2="268" stroke={lM} strokeWidth="0.8" opacity="0.7"/>
                      <line className="rv-path" x1="280" y1="277" x2="334" y2="277" stroke={lM} strokeWidth="0.8" opacity="0.7"/>
                      <path className="rv-path" fill="none" stroke={lH} strokeWidth="1.4" d="M 524,258 L 460,258 L 464,288 L 522,286 Z"/>
                      <line className="rv-path" x1="464" y1="268" x2="520" y2="268" stroke={lM} strokeWidth="0.8" opacity="0.7"/>
                      <line className="rv-path" x1="466" y1="277" x2="520" y2="277" stroke={lM} strokeWidth="0.8" opacity="0.7"/>
                      {/* badge & plate */}
                      <circle className="rv-path" cx="400" cy="270" r="6" fill="none" stroke={lM} strokeWidth="1.2"/>
                      <rect className="rv-path" x="362" y="300" width="76" height="32" rx="3" fill={pF} stroke={lH} strokeWidth="1.3"/>
                      {/* reflectors */}
                      <rect className="rv-path" x="282" y="332" width="28" height="8" rx="2" fill="none" stroke={lM} strokeWidth="1"/>
                      <rect className="rv-path" x="490" y="332" width="28" height="8" rx="2" fill="none" stroke={lM} strokeWidth="1"/>
                      {/* exhaust */}
                      <circle className="rv-path" cx="472" cy="374" r="9" fill={pF} stroke={lH} strokeWidth="1.3"/>
                      <circle className="rv-path" cx="472" cy="374" r="5" fill="none" stroke={lM} strokeWidth="1"/>
                      {/* tires */}
                      <rect className="rv-path" x="272" y="342" width="40" height="46" rx="7" fill="none" stroke={lH} strokeWidth="1.5"/>
                      <rect className="rv-path" x="488" y="342" width="40" height="46" rx="7" fill="none" stroke={lH} strokeWidth="1.5"/>
                      {/* ground */}
                      <line className="rv-path" x1="180" y1="392" x2="620" y2="392" stroke={lH} strokeWidth="1.2"/>
                      {/* dimensions — WIDTH bottom, HEIGHT right */}
                      <line className="rv-path" x1="258" y1="322" x2="258" y2="420" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="rv-path" x1="542" y1="322" x2="542" y2="420" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="rv-path" x1="258" y1="414" x2="542" y2="414" stroke={dim} strokeWidth="1"/>
                      <line className="rv-path" x1="258" y1="409" x2="258" y2="419" stroke={dim} strokeWidth="1.2"/>
                      <line className="rv-path" x1="542" y1="409" x2="542" y2="419" stroke={dim} strokeWidth="1.2"/>
                      <line className="rv-path" x1="484" y1="168" x2="658" y2="168" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="rv-path" x1="622" y1="392" x2="658" y2="392" stroke={dim} strokeWidth="0.6" opacity="0.7"/>
                      <line className="rv-path" x1="652" y1="168" x2="652" y2="392" stroke={dim} strokeWidth="1"/>
                      {/* hatch & tint fills */}
                      <rect className="rv-fill" x="272" y="342" width="40" height="46" rx="7" fill="url(#bpHatch)" stroke="none" opacity="0.8"/>
                      <rect className="rv-fill" x="488" y="342" width="40" height="46" rx="7" fill="url(#bpHatch)" stroke="none" opacity="0.8"/>
                      <rect className="rv-fill" x="180" y="393" width="440" height="9" fill="url(#bpHatch)" opacity="0.7" stroke="none"/>
                      <path className="rv-fill" fill={glT} stroke="none" d="M 310,178 L 490,178 L 504,222 L 296,222 Z"/>
                      {/* part labels */}
                      <g className="rv-lbl bp-lbl">
                        <text x="400" y="321" textAnchor="middle" fontSize="11" fontFamily="monospace" fontWeight="700" letterSpacing="2" fill={lM}>CP·8000</text>
                      </g>
                      <g className="rv-lbl bp-lbl">
                        <text x="140" y="152" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>REAR GLASS</text>
                        <line x1="208" y1="156" x2="320" y2="198" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="rv-lbl bp-lbl">
                        <text x="150" y="228" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>TAILLAMP</text>
                        <line x1="206" y1="234" x2="272" y2="260" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="rv-lbl bp-lbl">
                        <text x="560" y="300" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>BUMPER</text>
                        <line x1="556" y1="304" x2="540" y2="313" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="rv-lbl bp-lbl">
                        <text x="470" y="442" textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fill={lH}>EXHAUST</text>
                        <line x1="470" y1="432" x2="472" y2="386" stroke={lH} strokeWidth="1" markerEnd="url(#bpArr)"/>
                      </g>
                      <g className="rv-lbl bp-lbl">
                        <text x="400" y="408" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1" fill={dim}>WIDTH : 1,775 MM</text>
                        <text x="664" y="280" transform="rotate(-90 664 280)" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1" fill={dim}>HEIGHT : 1,455 MM</text>
                      </g>
                    </g>

                    {/* ── approval stamp (final) ── */}
                    <g transform="rotate(-7 648 112)">
                      <g id="bp-stamp" style={{transformBox:'fill-box', transformOrigin:'center'}}>
                        <rect x="568" y="86" width="160" height="52" rx="4" fill="none" stroke={emG} strokeWidth="2"/>
                        <rect x="573" y="91" width="150" height="42" rx="2" fill="none" stroke={emG} strokeWidth="0.8"/>
                        <text x="648" y="108" textAnchor="middle" fontSize="12" fontFamily="monospace" fontWeight="700" letterSpacing="2" fill={emG}>ASSEMBLY ✓ OK</text>
                        <text x="648" y="124" textAnchor="middle" fontSize="7.5" fontFamily="monospace" letterSpacing="1" fill={emG}>R² 91.2% · APPROVED FOR ML</text>
                      </g>
                    </g>
                  </svg>
              </div>

              {/* progress dots */}
              <div className="flex items-center gap-2 mt-4">
                {[1,2,3].map(s=>(
                  <div key={s} className={`transition-all duration-400 rounded-full ${stage>=s?'w-5 h-2 bg-cyan-500':'w-2 h-2 bg-slate-300 dark:bg-slate-700'}`}/>))}
              </div>
            </div>

            {/* Stage info panel */}
            <div className="w-full xl:w-[360px] shrink-0 flex flex-col gap-3">
              <motion.div key={stage} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{duration:0.3}}
                className="bg-white dark:bg-[#0c1019] border border-slate-200/80 dark:border-slate-800/60 rounded-2xl p-5 shadow-lg">
                {stage > 0 && (
                  <span className={`inline-block text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border mb-3 ${cmc.badge}`}>
                    {cur.sub}
                  </span>)}
                <h3 className="text-xl font-serif-elegant font-bold text-slate-900 dark:text-white mb-2">{cur.title}</h3>
                {cur.desc && <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{cur.desc}</p>}
                {cur.code && (
                  <div className="bg-slate-50 dark:bg-slate-950/65 border border-slate-200 dark:border-slate-800/55 rounded-xl p-3.5 font-mono text-[11px] text-slate-700 dark:text-cyan-400/85 leading-relaxed whitespace-pre">{cur.code}</div>)}
                {cur.cta && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={()=>navigate('/predict')} className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-400 text-white dark:text-slate-950 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-lg">
                      Mulai Prediksi <ChevronRight className="w-4 h-4"/>
                    </button>
                    <button onClick={()=>navigate('/playground')} className="flex-1 inline-flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 py-3 px-4 rounded-xl font-bold text-sm transition-colors cursor-pointer">
                      Playground
                    </button>
                  </div>)}
              </motion.div>

              {/* Stage checklist */}
              <div className="bg-white dark:bg-[#0c1019] border border-slate-200/80 dark:border-slate-800/60 rounded-2xl p-4 shadow">
                <div className="space-y-1.5">
                  {STAGES.slice(1).map((s, i) => {
                    const n = i + 1;
                    const mc = colorMap[s.color];
                    return (
                      <div key={n} className={`flex items-center gap-2.5 transition-all duration-300 ${stage < n ? 'opacity-25' : ''}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-white text-[8px] font-bold ${stage > n ? mc.dot : stage === n ? 'border-2 border-cyan-500' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          {stage > n ? '✓' : ''}
                        </div>
                        <span className={`text-xs ${stage === n ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-500'}`}>{s.title}</span>
                        {stage === n && <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400 ml-auto">← aktif</span>}
                      </div>);
                  })}
                </div>
              </div>
            </div>
          </div>

          </div>{/* /flex-1 inner */}

          {/* Bottom scroll hint */}
          <div className="pb-4 pt-1 flex flex-col items-center gap-1.5 shrink-0">
            {stage < 3
              ? <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-widest">↓ Scroll untuk proyeksi berikutnya</span>
              : <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">✓ Blueprint lengkap — scroll ke atas untuk mengulang</span>}
          </div>
        </div>{/* /sticky */}
      </div>{/* /scroll container */}

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="py-20 border-b border-slate-200/70 dark:border-slate-800/50 bg-white dark:bg-[#06080e] px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-4 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20 dark:border-cyan-400/15">
            Pipeline Alur Kerja
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif-elegant font-bold text-slate-900 dark:text-white mb-4">
            Bagaimana Cara Kerjanya?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto mb-16">
            Dari input formulir sederhana hingga hasil analisis machine learning yang presisi hanya dalam kedipan mata.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Decorative connecting lines for desktop */}
            <div className="hidden md:block absolute top-10 left-16 right-16 h-0.5 bg-slate-200 dark:bg-slate-800/80 z-0"></div>

            {[
              { step: '01', title: 'Input Spesifikasi', desc: 'Isi detail kendaraan seperti Tahun pembuatan, Kilometer tempuh, tipe transmisi, bahan bakar, dan Tenaga Mesin (max_power).' },
              { step: '02', title: 'API & Bridge Routing', desc: 'Node.js menerima data input dan meneruskannya ke engine Python melalui bridge internal secara asinkron.' },
              { step: '03', title: 'Inferensi Model ML', desc: 'Model KNN, Decision Tree, dan Random Forest memproses fitur masukan di ruang dimensi latih.' },
              { step: '04', title: 'Perbandingan Instan', desc: 'Aplikasi menampilkan komparasi harga estimasi, margin error, latensi, dan akurasi masing-masing model.' }
            ].map((item) => (
              <div key={item.step} className="relative z-10 flex flex-col items-center group">
                <div className="w-16 h-16 rounded-full bg-white dark:bg-[#0c1019] border-2 border-cyan-500 flex items-center justify-center font-mono font-bold text-lg text-cyan-600 dark:text-cyan-400 shadow-md mb-5 group-hover:scale-110 transition-transform duration-300">
                  {item.step}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed max-w-[220px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE IMPORTANCE ──────────────────────────────── */}
      <section className="py-20 border-b border-slate-200/70 dark:border-slate-800/50 bg-slate-100/30 dark:bg-[#090d16]/40 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20 dark:border-cyan-400/15">
                Analisis Parameter
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif-elegant font-bold text-slate-900 dark:text-white leading-tight">
                Bagaimana Fitur Mempengaruhi Prediksi Harga?
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Berdasarkan analisis bobot keputusan (Feature Importance) pada model Decision Tree dan Random Forest, parameter teknis memiliki tingkat pengaruh yang berbeda dalam menentukan estimasi akhir.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0"></span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Max Power (Tenaga Kuda):</strong> Merupakan indikator utama kelas kasta mobil (Premium vs Ekonomis). Korelasi harga tertinggi ada pada kapasitas horsepower (bhp).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0"></span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Tahun Kendaraan (Year):</strong> Menentukan depresiasi nilai. Mobil baru memiliki penyusutan nilai tahunan yang stabil seiring bertambahnya usia bodi.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0"></span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Jarak Tempuh & Kapasitas Mesin:</strong> Jarak tempuh mengindikasikan tingkat keausan fisik, sedangkan Engine CC menentukan kelas silinder (1000cc s/d 2500cc+).
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-[#0c1019] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider font-mono">
                Bobot Fitur Penentu (Feature Weights)
              </h3>
              <div className="space-y-5">
                {[
                  { label: 'Tenaga Maksimum (Max Power)', value: '45.2%', pct: 45.2, color: 'bg-cyan-500 dark:bg-cyan-400' },
                  { label: 'Tahun Pembuatan (Year)', value: '34.8%', pct: 34.8, color: 'bg-blue-500 dark:bg-blue-400' },
                  { label: 'Jarak Tempuh (Km Driven)', value: '12.0%', pct: 12.0, color: 'bg-amber-500 dark:bg-amber-400' },
                  { label: 'Kapasitas Mesin (Engine cc)', value: '8.0%', pct: 8.0, color: 'bg-emerald-500 dark:bg-emerald-400' }
                ].map((feat) => (
                  <div key={feat.label} className="space-y-1.5 group">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">{feat.label}</span>
                      <span className="text-slate-900 dark:text-white font-mono">{feat.value}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${feat.color}`} 
                        style={{ width: `${feat.pct}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-6 leading-relaxed">
                * Catatan: Bobot diperoleh dari analisis Mean Decrease in Impurity (Gini Importance) pada model Random Forest Regressor yang terlatih.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALGORITHM CARDS ───────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <motion.div initial={{opacity:0,y:22}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.55}} className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-4 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20 dark:border-cyan-400/15">Metode ML</span>
          <h2 className="text-3xl sm:text-4xl font-serif-elegant font-bold text-slate-900 dark:text-white mb-4">Tiga Algoritma, Satu Tujuan</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Setiap algoritma memiliki karakteristik berbeda. Bandingkan hasilnya dan pilih pendekatan terbaik.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {algoCards.map((m,i)=>(
            <motion.div key={m.abbr} initial={{opacity:0,y:18}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.5,delay:i*0.1}}
              className={`bg-white dark:bg-[#0c1019] border border-slate-200 dark:border-slate-800/65 rounded-2xl p-7 flex flex-col shadow-lg ${m.hover} hover:shadow-xl transition-all duration-300 group`}>
              <div className="flex items-start justify-between mb-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${m.ic} group-hover:scale-110 transition-transform duration-300`}><m.Icon className="w-5 h-5"/></div>
                <div className="text-right"><div className={`text-xl font-bold font-mono ${m.r2c}`}>{m.r2}</div><div className="text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-wider">R² Score</div></div>
              </div>
              <div className="text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">{m.abbr}</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">{m.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-5 flex-1">{m.desc}</p>
              <ul className="space-y-2 mb-6">{m.pros.map(p=>(<li key={p} className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-500"><span className={`w-1.5 h-1.5 rounded-full ${m.dot} shrink-0`}/>{p}</li>))}</ul>
              <button onClick={()=>navigate('/'+m.path)} className={`text-xs font-bold ${m.lk} inline-flex items-center gap-1 group/l cursor-pointer`}>
                Detail {m.abbr} <ChevronRight className="w-3.5 h-3.5 group-hover/l:translate-x-0.5 transition-transform"/>
              </button>
            </motion.div>))}
        </div>

        {/* ── METRIC COMPARISON TABLE ────────────────────────── */}
        <div className="mt-12 bg-white dark:bg-[#0c1019] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xl mb-12">
          <div className="mb-4">
            <h3 className="text-lg font-serif-elegant font-bold text-slate-900 dark:text-white">Komparasi Performa Algoritma</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Analisis perbandingan akurasi statistik dan karakteristik teknis dari tiga model prediksi aktif.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 font-mono text-[10px] uppercase text-slate-455 dark:text-slate-500 tracking-wider">
                  <th className="py-3 px-4">Algoritma</th>
                  <th className="py-3 px-4">R² Score (Akurasi)</th>
                  <th className="py-3 px-4">Rentang Latensi</th>
                  <th className="py-3 px-4">Penanganan Outlier</th>
                  <th className="py-3 px-4">Kebutuhan Memori</th>
                  <th className="py-3 px-4">Rekomendasi Kasus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-cyan-600 dark:text-cyan-400">K-Nearest Neighbors (KNN)</td>
                  <td className="py-3.5 px-4 font-mono font-semibold">88.7%</td>
                  <td className="py-3.5 px-4 font-mono text-emerald-500 font-semibold">~10ms - 15ms</td>
                  <td className="py-3.5 px-4 text-slate-500">Sensitif</td>
                  <td className="py-3.5 px-4 text-slate-500">Tinggi (Menyimpan seluruh data)</td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Estimasi berbasis contoh mobil dengan kemiripan lokal tinggi</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-amber-600 dark:text-amber-400">Decision Tree (Pohon Keputusan)</td>
                  <td className="py-3.5 px-4 font-mono font-semibold">82.3%</td>
                  <td className="py-3.5 px-4 font-mono text-emerald-500 font-semibold">~3ms - 5ms</td>
                  <td className="py-3.5 px-4 text-slate-500">Cukup Stabil</td>
                  <td className="py-3.5 px-4 text-slate-500">Rendah (Aturan biner efisien)</td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Analisis aturan logis bertingkat yang mudah dipresentasikan</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">Random Forest Regressor</td>
                  <td className="py-3.5 px-4 font-mono font-semibold">91.2%</td>
                  <td className="py-3.5 px-4 font-mono text-amber-500 font-semibold">~30ms - 45ms</td>
                  <td className="py-3.5 px-4 text-slate-500">Sangat Stabil</td>
                  <td className="py-3.5 px-4 text-slate-500">Sedang (Ensemble banyak pohon)</td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Akurasi tinggi dan estimasi tangguh terhadap pencilan data</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {[['Lihat Dataset','/dataset'],['Riwayat Prediksi','/history'],['Glosarium Istilah','/glossary']].map(([lbl,path])=>(
            <button key={lbl} onClick={()=>navigate(path)} className="px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1019] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#111622] transition-all cursor-pointer shadow-sm">
              {lbl}
            </button>))}
        </div>
      </section>

      {/* ── DATASET SUMMARY ────────────────────────────────── */}
      <section className="py-20 border-t border-slate-200/70 dark:border-slate-800/50 bg-white dark:bg-[#06080e] px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-linear-to-r from-cyan-600/10 via-blue-600/5 to-violet-600/10 dark:from-cyan-400/5 dark:via-sky-400/2 dark:to-violet-400/5 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                <Database className="w-5 h-5" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider font-semibold">Dataset yang Aktif</span>
              </div>
              <h3 className="text-xl font-serif-elegant font-bold text-slate-900 dark:text-white">
                Dataset Transaksi Historis: <span className="font-sans font-medium text-cyan-700 dark:text-cyan-400">{datasetInfo.filename}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Model dilatih secara dinamis menggunakan data historis transaksi kendaraan bekas. Dataset ini mencakup detail spesifikasi teknis dan harga pasar riil untuk melatih model prediksi.
              </p>
              <div className="flex flex-wrap gap-4 pt-1.5 text-xs text-slate-500">
                <div>
                  <strong>Status:</strong>{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {datasetInfo.is_custom ? 'Dataset Kustom' : 'Dataset Default Bawaan'}
                  </span>
                </div>
                <div className="hidden sm:block text-slate-300 dark:text-slate-800">•</div>
                <div>
                  <strong>Mata Uang Harga:</strong>{' '}
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {datasetInfo.price_currency}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0 font-sans">
              <div className="bg-white/70 dark:bg-[#0c1019]/70 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 text-center shrink-0 min-w-[130px] shadow-xs">
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {datasetInfo.total_rows.toLocaleString()}
                </div>
                <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Total Baris Data</div>
              </div>
              <button
                onClick={() => navigate('/dataset')}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl py-3.5 px-5 transition-all cursor-pointer shadow-sm"
              >
                Kelola Dataset <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
