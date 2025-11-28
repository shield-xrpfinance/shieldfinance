import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Xumm } from "xumm";

interface XAppContextType {
  isXApp: boolean;
  isLoading: boolean;
}

const XAppContext = createContext<XAppContextType>({
  isXApp: false,
  isLoading: true,
});

export function XAppProvider({ children }: { children: ReactNode }) {
  const [isXApp, setIsXApp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectXApp = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hasXAppToken = urlParams.has('xAppToken') || urlParams.has('ott') || urlParams.has('xApp');
        const hasReactNativeWebView = typeof (window as any).ReactNativeWebView !== 'undefined';
        
        if (hasXAppToken || hasReactNativeWebView) {
          console.log('📱 xApp context detected via URL/WebView');
          setIsXApp(true);
          setIsLoading(false);
          return;
        }

        const apiKey = import.meta.env.VITE_XUMM_API_KEY;
        if (apiKey) {
          try {
            const xummSdk = new Xumm(apiKey);
            const environment = await xummSdk.environment;
            const isXappContext = !!(environment as any)?.jwt;
            
            if (isXappContext) {
              console.log('📱 xApp context detected via SDK');
              setIsXApp(true);
            }
          } catch (error) {
            console.log('Not in xApp context (SDK check failed)');
          }
        }
      } catch (error) {
        console.error('xApp detection error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    detectXApp();
  }, []);

  return (
    <XAppContext.Provider value={{ isXApp, isLoading }}>
      {children}
    </XAppContext.Provider>
  );
}

export function useXApp() {
  return useContext(XAppContext);
}
