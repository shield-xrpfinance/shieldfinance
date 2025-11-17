import { useState, useEffect, useRef } from 'react';

interface UseStatusPollingOptions {
  interval?: number;
  enabled?: boolean;
}

interface UseStatusPollingResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

export function useStatusPolling<T>(
  url: string,
  options: UseStatusPollingOptions = {}
): UseStatusPollingResult<T> {
  const { interval = 2000, enabled = true } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    // Reset loading tracker when URL changes
    hasLoadedOnceRef.current = false;

    const fetchData = async () => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Only show loading spinner on FIRST request, not subsequent polls
        if (!hasLoadedOnceRef.current) {
          setIsLoading(true);
        }

        const response = await fetch(url, {
          credentials: 'include',
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const text = (await response.text()) || response.statusText;
          throw new Error(`${response.status}: ${text}`);
        }

        const result = await response.json();
        setData(result);
        setLastUpdated(new Date());
        setError(null);
        hasLoadedOnceRef.current = true;
      } catch (err) {
        // Ignore abort errors (occur during cleanup/cancellation)
        if (err instanceof Error && err.name === 'AbortError') {
          // Don't update error state for intentionally aborted requests
          return;
        }
        
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        // Always clear loading state, even after abort
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling interval
    const intervalId = setInterval(() => {
      fetchData();
    }, interval);

    // Cleanup function - runs on unmount or when dependencies change
    return () => {
      clearInterval(intervalId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [url, interval, enabled]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
  };
}
