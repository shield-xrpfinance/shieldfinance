import { useEffect, useRef, useState, useLayoutEffect } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Check if element is already in viewport on mount (for above-the-fold content)
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || isVisible) return;

    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    
    // Element is in viewport if its top is within the visible area
    // Using a generous threshold to catch elements near the top
    const isInViewport = rect.top < windowHeight && rect.bottom > 0;
    
    if (isInViewport) {
      // Small delay to ensure CSS animations trigger properly after initial render
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [isVisible]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If already visible (set by layoutEffect), don't need observer
    if (isVisible && triggerOnce) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce, isVisible]);

  return { ref, isVisible };
}
