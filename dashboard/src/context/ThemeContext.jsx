import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Theme Mode: 'light' | 'dark' | 'system'
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('netra-theme-mode') || localStorage.getItem('netra-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch (e) {}
    return 'system';
  });

  // Track system OS color-scheme preference
  const [systemTheme, setSystemTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Reactively listen for OS theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Effective resolved theme: 'light' | 'dark'
  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    try {
      localStorage.setItem('netra-theme-mode', themeMode);
      localStorage.setItem('netra-theme', resolvedTheme); // keep legacy key in sync
    } catch (e) {}

    // Reflect override in <meta name="color-scheme">
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'color-scheme';
      document.head.appendChild(meta);
    }
    meta.content = themeMode === 'system' ? 'light dark' : resolvedTheme;
  }, [themeMode, resolvedTheme]);

  // Synchronize across browser tabs via storage event
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'netra-theme-mode' && (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system')) {
        setThemeMode(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Cycle toggle for backwards-compatibility or keyboard shortcuts
  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, []);

  // Currency state: USD | INR
  const [currency, setCurrency] = useState(() => {
    try {
      return localStorage.getItem('netra-currency') || 'USD';
    } catch (e) {
      return 'USD';
    }
  });

  // Static benchmark exchange rate USD -> INR (85.00 INR per 1 USD)
  const [exchangeRate, setExchangeRate] = useState(85.00);

  useEffect(() => {
    try {
      localStorage.setItem('netra-currency', currency);
    } catch (e) {}
  }, [currency]);

  useEffect(() => {
    fetch('/admin/currency/rate')
      .then(res => res.json())
      .then(data => {
        if (data && data.rate) {
          setExchangeRate(Number(data.rate));
        }
      })
      .catch(() => {
        // Fallback static benchmark default (85.00 INR per 1 USD)
        setExchangeRate(85.00);
      });
  }, []);

  const toggleCurrency = () => {
    setCurrency(prev => (prev === 'USD' ? 'INR' : 'USD'));
  };

  /**
   * Single-denomination currency formatting
   * e.g. $0.000014 or $14.20, or ₹0.0012 or ₹1,242.50
   */
  const formatCurrency = (usdAmount, maxDecimals = 6) => {
    const val = Number(usdAmount) || 0;
    if (currency === 'INR') {
      const inrVal = val * exchangeRate;
      if (inrVal === 0) return '₹0.00';
      if (inrVal < 0.01) return `₹${inrVal.toFixed(4)}`;
      return `₹${inrVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      if (val === 0) return '$0.00';
      if (val < 0.01) return `$${val.toFixed(maxDecimals)}`;
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme: resolvedTheme,
      themeMode,
      setThemeMode,
      systemTheme,
      toggleTheme,
      currency,
      toggleCurrency,
      exchangeRate,
      formatCurrency
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
