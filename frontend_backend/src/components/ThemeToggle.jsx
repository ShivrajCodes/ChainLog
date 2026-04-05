import { useState, useEffect } from 'react';

function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('theme-dark') || 
                   !document.documentElement.classList.contains('theme-light');
    setIsLight(!isDark);
  }, []);

  const toggleTheme = (e) => {
    // Calculate click coordinates for the cinematic circle clip-path
    const x = e.clientX;
    const y = e.clientY;
    document.documentElement.style.setProperty('--click-x', `${x}px`);
    document.documentElement.style.setProperty('--click-y', `${y}px`);

    const nextMode = isLight ? 'dark' : 'light';

    if (!document.startViewTransition) {
      applyTheme(nextMode);
      return;
    }

    document.startViewTransition(() => {
      applyTheme(nextMode);
    });
  };

  const applyTheme = (mode) => {
    if (mode === 'light') {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
      setIsLight(true);
    } else {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
      setIsLight(false);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer items-center rounded-full border border-theme-border/20 bg-theme-surface/70 p-1 shadow-inner backdrop-blur hover:border-theme-border/30 focus:outline-none transition-colors duration-300 ease-in-out`}
      role="switch"
      aria-checked={isLight}
      aria-label="Toggle Theme"
    >
      <div className="absolute inset-x-0 flex justify-between px-2.5 pointer-events-none">
        {/* Sun Icon */}
        <svg className={`w-3.5 h-3.5 transition-colors duration-300 ${isLight ? 'text-amber-500' : 'text-slate-500'}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 3.22a1 1 0 011.415 0l.708.707a1 1 0 01-1.415 1.415l-.707-.708a1 1 0 010-1.414zm3.78 4.78a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-3.22a1 1 0 01-1.415 0l-.708-.707a1 1 0 011.415-1.415l.707.708a1 1 0 010 1.414zm-3.78-4.78a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM4 10a1 1 0 01-1-1H2a1 1 0 110 2h1a1 1 0 011-1zm3.22-4.22a1 1 0 010-1.415l-.708-.707a1 1 0 011.415-1.415l.707.708a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
          <path d="M10 5a5 5 0 100 10 5 5 0 000-10z"></path>
        </svg>
        {/* Moon Icon */}
        <svg className={`w-3.5 h-3.5 transition-colors duration-300 ${!isLight ? 'text-blue-300' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
        </svg>
      </div>
      
      <span
        aria-hidden="true"
        className={`pointer-events-none z-10 inline-block h-6 w-6 transform rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5 transition duration-[400ms] cubic-bezier(0.87, 0, 0.13, 1) ${isLight ? 'translate-x-[28px]' : 'translate-x-0'}`}
      />
    </button>
  );
}

export default ThemeToggle;
