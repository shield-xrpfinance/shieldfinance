import { useState, useEffect } from "react";
import shieldLogoLight from "@assets/shield_logo_1763761188895.png";
import shieldLogoDark from "@assets/icon_darkbg_1764335756787.png";

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => 
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

interface ShieldLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function ShieldLogo({ size = 32, className = "", alt = "Shield Finance" }: ShieldLogoProps) {
  const isDarkMode = useIsDarkMode();
  const logoSrc = isDarkMode ? shieldLogoDark : shieldLogoLight;

  return (
    <img
      src={logoSrc}
      alt={alt}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      data-testid="shield-logo"
    />
  );
}

export function useShieldLogo() {
  const isDarkMode = useIsDarkMode();
  return isDarkMode ? shieldLogoDark : shieldLogoLight;
}
