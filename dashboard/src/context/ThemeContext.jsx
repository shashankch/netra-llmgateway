import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Theme state: dark | light
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('netra-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Currency state: USD | INR
  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem('netra-currency') || 'USD';
  });

  // Live exchange rate USD -> INR
  const [exchangeRate, setExchangeRate] = useState(87.50);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('netra-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('netra-currency', currency);
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
        // Fallback default
        setExchangeRate(87.50);
      });
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

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
      theme,
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
