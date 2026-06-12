import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage        from './pages/HomePage';
import PredictPage     from './pages/PredictPage';
import PlaygroundPage  from './pages/PlaygroundPage';
import ModelInfoPage   from './pages/ModelInfoPage';
import DatasetPage     from './pages/DatasetPage';
import HistoryPage     from './pages/HistoryPage';
import GlossaryPage    from './pages/GlossaryPage';
import AdminPage       from './pages/AdminPage';
import AdminLoginPage  from './pages/AdminLoginPage';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const active   = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <Link to={to} className={`text-sm font-medium transition-colors nav-link ${active ? 'text-cyan-400' : ''}`}>
      {children}
    </Link>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    document.documentElement.classList.remove('theme-light','theme-dark');
    document.documentElement.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="app-shell min-h-screen font-sans selection:bg-cyan-500/30">
        <nav className="nav-shell border-b backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-bold text-white text-sm">CP</div>
              <span className="font-semibold text-lg tracking-tight nav-title hidden sm:block">Prediksi Harga Mobil</span>
            </Link>

            <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-end">
              <NavLink to="/predict">Prediksi</NavLink>
              <NavLink to="/playground">Playground</NavLink>
              <NavLink to="/model-info">Info Model</NavLink>
              <NavLink to="/dataset">Dataset</NavLink>
              <NavLink to="/history">History</NavLink>
              <NavLink to="/glossary">Glosarium</NavLink>

              {/* Admin pill — arahkan ke login, bukan langsung ke /admin */}
              <Link to="/admin/login"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Admin
              </Link>

              <button type="button" onClick={() => setTheme(p => p==='dark'?'light':'dark')}
                className="theme-toggle-btn" aria-label="Toggle theme">
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2m-4.34 5.66-1.41 1.41M6.34 6.34 4.93 4.93"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3a6 6 0 1 0 9 9 8.5 8.5 0 1 1-9-9"/>
                  </svg>
                )}
                <span className="text-xs hidden sm:inline">{theme==='dark'?'Dark':'Light'}</span>
              </button>
            </div>
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/"             element={<HomePage />} />
            <Route path="/predict"      element={<PredictPage />} />
            <Route path="/playground"   element={<PlaygroundPage />} />
            <Route path="/model-info"   element={<ModelInfoPage />} />
            <Route path="/dataset"      element={<DatasetPage />} />
            <Route path="/history"      element={<HistoryPage />} />
            <Route path="/glossary"     element={<GlossaryPage />} />
            <Route path="/admin/login"  element={<AdminLoginPage />} />
            <Route path="/admin"        element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
