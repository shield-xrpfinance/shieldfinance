import React, { createContext, useContext, useState, useEffect } from "react";

export type Currency = "USD" | "EUR" | "GBP" | "JPY" | "CAD";

interface ExchangeRates {
  USD: number;
  EUR: number;
  GBP: number;
  JPY: number;
  CAD: number;
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
  };
  return names[currency];
}
