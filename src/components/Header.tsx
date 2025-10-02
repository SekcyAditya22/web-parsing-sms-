import type React from "react"
import { useEffect, useState } from "react"

const Header: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    const root = document.documentElement;
    if (next === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try { localStorage.setItem('theme', next); } catch {}
  };
  return (
    <header className="bg-gradient-to-r from-slate-100 via-purple-100 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 shadow-xl relative overflow-hidden transition-colors">
      <div className="absolute inset-0 hidden dark:block bg-black opacity-20"></div>
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-2 left-8 w-2 h-2 bg-purple-400/70 dark:bg-purple-400 opacity-60 rounded-full animate-pulse"></div>
        <div className="absolute top-4 right-12 w-1 h-1 bg-blue-500/60 dark:bg-blue-400 opacity-40 rounded-full animate-ping"></div>
        <div className="absolute bottom-2 left-1/3 w-1.5 h-1.5 bg-indigo-500/60 dark:bg-indigo-400 opacity-50 rounded-full animate-bounce"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg overflow-hidden">
              <img 
                src="/aizen.jpg" 
                alt="Azien Logo" 
                className="w-10 h-10 object-cover rounded-lg"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gabuttt</h1>
              <p className="text-purple-700 dark:text-purple-300 text-xs font-medium">Testtt</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 rounded-full px-3 py-1.5 backdrop-blur-sm border border-slate-900/10 dark:border-white/10 bg-white/50 dark:bg-black/20">
              <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <span className="text-slate-900 dark:text-white text-sm font-medium">OKEE</span>
            </div>
            <button
              onClick={toggleTheme}
              className="relative inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 text-slate-800 dark:text-white transition-colors backdrop-blur-sm"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.64 13a1 1 0 00-1.05-.14 8 8 0 01-10.45-10.45 1 1 0 00-.14-1.05A1 1 0 008.5 1a10 10 0 1014 14 1 1 0 00.14-1.05z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.76 4.84l-1.8-1.79-1.42 1.41 1.79 1.8 1.43-1.42zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zm9-10v-2h-3v2h3zm-3.34 7.66l1.79 1.8 1.42-1.42-1.8-1.79-1.41 1.41zM13 1h-2v3h2V1zm-7.66 16.66l-1.8 1.79 1.42 1.42 1.79-1.8-1.41-1.41zM12 6a6 6 0 100 12A6 6 0 0012 6z"/>
                </svg>
              )}
              <span className="ml-2 text-xs hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
