import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;
const STRICT_MAX_REQUESTS = 20;

class RateLimiterStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.store.entries());
      for (const [key, entry] of entries) {
        if (now >= entry.resetTime) {
          this.store.delete(key);
        }
      }
    }, 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() >= entry.resetTime) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      entry.count++;
    }

    this.store.set(key, entry);
    return entry;
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

const globalStore = new RateLimiterStore();

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(xForwardedFor)) {
    return xForwardedFor[0].trim();
  }
  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string") {
    return xRealIp.trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    message = "Too many requests, please try again later.",
    keyGenerator = (req: Request) => getClientIp(req),
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const entry = globalStore.increment(key, windowMs);

    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - Date.now()) / 1000);

    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", resetSeconds.toString());

    if (entry.count > maxRequests) {
      res.setHeader("Retry-After", resetSeconds.toString());
      return res.status(429).json({
        error: "Too Many Requests",
        message,
        retryAfter: resetSeconds,
      });
    }

    next();
  };
}

export const globalRateLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  maxRequests: DEFAULT_MAX_REQUESTS,
  message: "Too many requests. Please wait before making more API calls.",
});

export const strictRateLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  maxRequests: STRICT_MAX_REQUESTS,
  message: "Rate limit exceeded for sensitive operations. Please wait before trying again.",
  keyGenerator: (req: Request) => `strict:${getClientIp(req)}`,
});

export { globalStore };
