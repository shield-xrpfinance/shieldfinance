import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface GeoContextType {
  isUAE: boolean;
  isLoading: boolean;
  detectionFailed: boolean;
  countryCode: string | null;
  hasAcknowledged: boolean;
  acknowledgeRestriction: () => void;
  retryDetection: () => void;
}

const GeoContext = createContext<GeoContextType>({
  isUAE: false,
  isLoading: true,
  detectionFailed: false,
  countryCode: null,
  hasAcknowledged: false,
  acknowledgeRestriction: () => {},
  retryDetection: () => {},
});

export function useGeo() {
  return useContext(GeoContext);
}

interface GeoProviderProps {
  children: ReactNode;
}

export function GeoProvider({ children }: GeoProviderProps) {
  const [isUAE, setIsUAE] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [detectionFailed, setDetectionFailed] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasAcknowledged, setHasAcknowledged] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('uae-geo-acknowledged') === 'true';
    }
    return false;
  });

  const detectCountry = async () => {
    setIsLoading(true);
    setDetectionFailed(false);
    
    try {
      const response = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(8000),
      });
      
      if (!response.ok) {
        throw new Error('Failed to detect location');
      }
      
      const data = await response.json();
      const code = data.country_code?.toUpperCase();
      
      setCountryCode(code || null);
      setIsUAE(code === 'AE');
      setDetectionFailed(false);
    } catch (error) {
      console.warn('Geo detection failed (fail-closed mode):', error);
      setDetectionFailed(true);
      setCountryCode(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    detectCountry();
  }, [retryCount]);

  const acknowledgeRestriction = () => {
    setHasAcknowledged(true);
    localStorage.setItem('uae-geo-acknowledged', 'true');
  };

  const retryDetection = () => {
    setRetryCount(prev => prev + 1);
  };

  return (
    <GeoContext.Provider
      value={{
        isUAE,
        isLoading,
        detectionFailed,
        countryCode,
        hasAcknowledged,
        acknowledgeRestriction,
        retryDetection,
      }}
    >
      {children}
    </GeoContext.Provider>
  );
}
