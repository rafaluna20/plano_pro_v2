'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Cargar tema desde localStorage al montar
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('cad-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  // Aplicar tema al documento
  const applyTheme = (newTheme: 'light' | 'dark') => {
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  // Toggle tema
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('cad-theme', newTheme);
    applyTheme(newTheme);
  };

  // Atajo de teclado: Ctrl+Shift+T
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [theme]);

  // No renderizar hasta que esté montado (evita flash)
  if (!mounted) {
    return (
      <button className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-100 opacity-50">
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="group relative w-10 h-10 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors duration-200"
      title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'} (Ctrl+Shift+T)`}
      aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-gray-700 group-hover:text-gray-900 transition-transform group-hover:rotate-12" />
      ) : (
        <Sun className="w-5 h-5 text-yellow-400 group-hover:text-yellow-300 transition-transform group-hover:rotate-45" />
      )}
      
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
        {theme === 'light' ? '🌙 Tema Oscuro' : '☀️ Tema Claro'}
        <span className="block text-[10px] text-gray-400 mt-0.5">Ctrl+Shift+T</span>
      </span>
    </button>
  );
}
