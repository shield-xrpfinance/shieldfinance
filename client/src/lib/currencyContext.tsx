import React, { createContext, useContext, useState, useEffect } from "react";

export type Currency = "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "AED";

interface ExchangeRates {
  USD: number;
  EUR: number;
  GBP: number;
  JPY: number;
  CAD: number;
  AUD: number;
  AED: number;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  exchangeRates: ExchangeRates;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Fixed exchange rates (relative to USD as base)
const FIXED_EXCHANGE_RATES: ExchangeRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CAD: 1.36,
  AUD: 1.52,
  AED: 3.67,
};

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem("selectedCurrency");
    return (saved as Currency) || "USD";
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(FIXED_EXCHANGE_RATES);
  const [isLoading, setIsLoading] = useState(false);

  // Save currency preference
  useEffect(() => {
    localStorage.setItem("selectedCurrency", currency);
  }, [currency]);

  // Fetch real exchange rates (optional - currently using fixed rates)
  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        // Optional: Implement real exchange rate fetching
        // For now, use fixed rates for stability
        setExchangeRates(FIXED_EXCHANGE_RATES);
      } catch (error) {
        console.error("Failed to fetch exchange rates:", error);
        setExchangeRates(FIXED_EXCHANGE_RATES);
      }
    };

    setIsLoading(true);
    fetchExchangeRates().finally(() => setIsLoading(false));
  }, []);

  const value: CurrencyContextType = {
    currency,
    setCurrency,
    exchangeRates,
    isLoading,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

export function convertToSelectedCurrency(usdAmount: number, selectedCurrency: Currency): number {
  return usdAmount * FIXED_EXCHANGE_RATES[selectedCurrency];
}

export function getCurrencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    AED: "د.إ",
  };
  return symbols[currency];
}

export function getCurrencyName(currency: Currency): string {
  const names: Record<Currency, string> = {
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    JPY: "Japanese Yen",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    AED: "UAE Dirham",
  };
  return names[currency];
}

export function getCurrencyColor(currency: Currency): string {
  const colors: Record<Currency, string> = {
    USD: "bg-green-500/20 text-green-700 dark:text-green-400",
    EUR: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    GBP: "bg-red-500/20 text-red-700 dark:text-red-400",
    JPY: "bg-pink-500/20 text-pink-700 dark:text-pink-400",
    CAD: "bg-red-600/20 text-red-700 dark:text-red-400",
    AUD: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    AED: "bg-green-600/20 text-green-700 dark:text-green-400",
  };
  return colors[currency];
}
