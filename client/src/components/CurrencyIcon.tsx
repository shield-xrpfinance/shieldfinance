import { getCurrencyColor, type Currency } from "@/lib/currencyContext";

interface CurrencyIconProps {
  currency: Currency;
  showLabel?: boolean;
}

export function CurrencyIcon({ currency, showLabel = false }: CurrencyIconProps) {
  const currencyCodes: Record<Currency, string> = {
    USD: "US",
    EUR: "EU",
    GBP: "GB",
    JPY: "JP",
    CAD: "CA",
    AUD: "AU",
    AED: "AE",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${getCurrencyColor(currency)} rounded px-2 py-1 font-semibold text-xs`}>
        {currencyCodes[currency]}
      </div>
      {showLabel && <span className="text-sm">{currency}</span>}
    </div>
  );
}
