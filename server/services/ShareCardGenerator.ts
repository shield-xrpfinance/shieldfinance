import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { z } from 'zod';

const ShareCardDataSchema = z.object({
  referralCode: z.string()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9\-_]+$/, 'Invalid referral code format'),
  points: z.number().int().min(0).max(999999999),
  tier: z.enum(['bronze', 'silver', 'gold', 'diamond']),
});

export type ShareCardData = z.infer<typeof ShareCardDataSchema>;

const CACHE_DIR = path.join(process.cwd(), 'generated-cards');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 500; // Max cached images
const BROWSER_LAUNCH_TIMEOUT = 30000;
const MAX_LAUNCH_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface CacheEntry {
  path: string;
  timestamp: number;
}

export class ShareCardGenerator {
  private static instance: ShareCardGenerator;
  private browser: Browser | null = null;
  private browserLaunchPromise: Promise<Browser> | null = null;
  private isShuttingDown = false;
  private cache = new Map<string, CacheEntry>();

  private constructor() {
    this.setupCleanupHandlers();
    this.loadCacheFromDisk();
  }

  public static getInstance(): ShareCardGenerator {
    if (!ShareCardGenerator.instance) {
      ShareCardGenerator.instance = new ShareCardGenerator();
    }
    return ShareCardGenerator.instance;
  }

  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log('[ShareCardGenerator] Cleaning up...');
      await this.cleanup();
    };

    process.on('beforeExit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  private loadCacheFromDisk(): void {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.png')) {
          const filePath = path.join(CACHE_DIR, file);
          const stats = fs.statSync(filePath);
          const cacheKey = file.replace('.png', '');
          
          if (Date.now() - stats.mtimeMs < CACHE_TTL) {
            this.cache.set(cacheKey, {
              path: filePath,
              timestamp: stats.mtimeMs,
            });
          } else {
            fs.unlinkSync(filePath);
          }
        }
      }
      console.log(`[ShareCardGenerator] Loaded ${this.cache.size} cached cards from disk`);
    } catch (error) {
      console.error('[ShareCardGenerator] Failed to load cache from disk:', error);
    }
  }

  private pruneCache(): void {
    const now = Date.now();
    
    // Remove expired entries
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > CACHE_TTL) {
        try {
          if (fs.existsSync(entry.path)) {
            fs.unlinkSync(entry.path);
          }
          this.cache.delete(key);
        } catch (error) {
          console.error(`[ShareCardGenerator] Failed to prune cache entry ${key}:`, error);
        }
      }
    }

    // If still over limit, remove oldest entries (proper LRU)
    if (this.cache.size > MAX_CACHE_SIZE) {
      const freshEntries = Array.from(this.cache.entries());
      freshEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const countToRemove = this.cache.size - MAX_CACHE_SIZE;
      
      for (let i = 0; i < countToRemove && i < freshEntries.length; i++) {
        const [key, entry] = freshEntries[i];
        try {
          if (fs.existsSync(entry.path)) {
            fs.unlinkSync(entry.path);
          }
          this.cache.delete(key);
        } catch (error) {
          console.error(`[ShareCardGenerator] Failed to remove old cache entry ${key}:`, error);
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getChromiumPath(): string {
    // Try to find system chromium
    try {
      const chromiumPath = execSync('which chromium', { encoding: 'utf-8' }).trim();
      if (chromiumPath && fs.existsSync(chromiumPath)) {
        return chromiumPath;
      }
    } catch (e) {
      // which failed, try common paths
    }
    
    // Common Nix paths
    const commonPaths = [
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      '/run/current-system/sw/bin/chromium',
      process.env.PUPPETEER_EXECUTABLE_PATH || '',
    ].filter(Boolean);
    
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    throw new Error('Could not find Chromium. Please install chromium system package.');
  }

  private async getBrowser(): Promise<Browser> {
    if (this.isShuttingDown) {
      throw new Error('ShareCardGenerator is shutting down');
    }

    if (this.browser?.connected) {
      return this.browser;
    }

    if (this.browserLaunchPromise) {
      return this.browserLaunchPromise;
    }

    const executablePath = this.getChromiumPath();
    console.log(`[ShareCardGenerator] Using Chromium at: ${executablePath}`);

    this.browserLaunchPromise = (async () => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= MAX_LAUNCH_RETRIES; attempt++) {
        try {
          console.log(`[ShareCardGenerator] Launching browser (attempt ${attempt}/${MAX_LAUNCH_RETRIES})...`);
          this.browser = await puppeteer.launch({
            headless: true,
            executablePath,
            timeout: BROWSER_LAUNCH_TIMEOUT,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--single-process',
              '--no-zygote',
            ],
          });

          this.browser.on('disconnected', () => {
            console.log('[ShareCardGenerator] Browser disconnected');
            this.browser = null;
            this.browserLaunchPromise = null;
          });

          console.log('[ShareCardGenerator] Browser launched successfully');
          return this.browser;
        } catch (error) {
          lastError = error as Error;
          console.error(`[ShareCardGenerator] Launch attempt ${attempt} failed:`, error);
          
          if (attempt < MAX_LAUNCH_RETRIES) {
            await this.delay(RETRY_DELAY_MS * attempt); // Exponential backoff
          }
        }
      }
      
      this.browserLaunchPromise = null;
      throw lastError || new Error('Failed to launch browser after retries');
    })();

    return this.browserLaunchPromise;
  }

  private generateHTML(data: ShareCardData): string {
    const tierColors: Record<string, string> = {
      bronze: '#CD7F32',
      silver: '#C0C0C0',
      gold: '#FFD700',
      diamond: '#00FFFF',
    };

    const tierColor = tierColors[data.tier] || '#00FFFF';
    const formattedTier = data.tier.charAt(0).toUpperCase() + data.tier.slice(1);
    const escapedCode = data.referralCode.replace(/[<>&"']/g, (c) => {
      const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
      return entities[c] || c;
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 800px;
      height: 800px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a3a4a 0%, #0d1f2d 50%, #1a3a4a 100%);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .card {
      width: 720px;
      height: 720px;
      background: linear-gradient(180deg, #0a1628 0%, #0d1f2d 30%, #0a1628 100%);
      border-radius: 32px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
    }
    
    .circuit-pattern {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: 
        radial-gradient(circle at 20% 20%, rgba(0, 255, 255, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(0, 255, 255, 0.03) 0%, transparent 50%);
      pointer-events: none;
    }
    
    .circuit-lines {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0.4;
    }
    
    .circuit-lines::before,
    .circuit-lines::after {
      content: '';
      position: absolute;
      background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.3), transparent);
      height: 1px;
    }
    
    .circuit-lines::before {
      top: 15%;
      left: 0;
      right: 0;
    }
    
    .circuit-lines::after {
      bottom: 20%;
      left: 0;
      right: 0;
    }
    
    .hex-pattern {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 200px;
      background: repeating-conic-gradient(
        from 30deg,
        transparent 0deg 60deg,
        rgba(0, 255, 255, 0.02) 60deg 120deg
      );
      background-size: 40px 40px;
      opacity: 0.5;
    }
    
    .shield-container {
      position: relative;
      width: 200px;
      height: 200px;
      margin-bottom: 20px;
      z-index: 10;
    }
    
    .shield-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 180px;
      height: 180px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 255, 255, 0.3) 0%, transparent 70%);
    }
    
    .shield-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 160px;
      height: 160px;
      border: 2px solid rgba(0, 255, 255, 0.6);
      border-radius: 50%;
      box-shadow: 
        0 0 20px rgba(0, 255, 255, 0.4),
        inset 0 0 20px rgba(0, 255, 255, 0.1);
    }
    
    .shield-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100px;
      height: 120px;
      background: linear-gradient(180deg, #00d4d4 0%, #006666 100%);
      clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
    }
    
    .shield-inner {
      width: 60px;
      height: 60px;
      background: linear-gradient(180deg, #00ffff 0%, #008888 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
      color: #0a1628;
    }
    
    .coin {
      position: absolute;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2a3a4a 0%, #1a2a3a 100%);
      border: 2px solid rgba(100, 120, 140, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: rgba(150, 170, 190, 0.7);
      z-index: 5;
    }
    
    .coin-1 { top: 80px; left: 40px; }
    .coin-2 { top: 60px; right: 40px; }
    .coin-3 { bottom: 180px; left: 30px; }
    .coin-4 { bottom: 200px; right: 30px; }
    
    .title {
      font-size: 42px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 30px;
      text-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
      z-index: 10;
    }
    
    .referral-box {
      background: linear-gradient(90deg, #00b8b8 0%, #00d4d4 50%, #00b8b8 100%);
      border-radius: 16px;
      padding: 18px 50px;
      margin-bottom: 30px;
      box-shadow: 
        0 0 30px rgba(0, 255, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
      z-index: 10;
    }
    
    .referral-code {
      font-size: 36px;
      font-weight: 800;
      color: #0a1628;
      letter-spacing: 2px;
    }
    
    .stats {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 25px;
      z-index: 10;
    }
    
    .stat {
      font-size: 26px;
      font-weight: 600;
      color: #00ffff;
    }
    
    .stat-divider {
      width: 2px;
      height: 24px;
      background: rgba(0, 255, 255, 0.5);
    }
    
    .tier-text {
      color: ${tierColor};
    }
    
    .cta {
      font-size: 22px;
      color: rgba(200, 220, 240, 0.8);
      z-index: 10;
    }
    
    .circuit-dot {
      position: absolute;
      width: 6px;
      height: 6px;
      background: rgba(0, 255, 255, 0.6);
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(0, 255, 255, 0.8);
    }
    
    .dot-1 { top: 100px; left: 100px; }
    .dot-2 { top: 150px; right: 80px; }
    .dot-3 { bottom: 150px; left: 80px; }
    .dot-4 { bottom: 100px; right: 100px; }
    .dot-5 { top: 50%; left: 20px; }
    .dot-6 { top: 50%; right: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="circuit-pattern"></div>
    <div class="circuit-lines"></div>
    <div class="hex-pattern"></div>
    
    <div class="circuit-dot dot-1"></div>
    <div class="circuit-dot dot-2"></div>
    <div class="circuit-dot dot-3"></div>
    <div class="circuit-dot dot-4"></div>
    <div class="circuit-dot dot-5"></div>
    <div class="circuit-dot dot-6"></div>
    
    <div class="coin coin-1">F</div>
    <div class="coin coin-2">X</div>
    <div class="coin coin-3">X</div>
    <div class="coin coin-4">F</div>
    
    <div class="shield-container">
      <div class="shield-glow"></div>
      <div class="shield-ring"></div>
      <div class="shield-icon">
        <div class="shield-inner">S</div>
      </div>
    </div>
    
    <h1 class="title">Shield Finance</h1>
    
    <div class="referral-box">
      <span class="referral-code">${escapedCode}</span>
    </div>
    
    <div class="stats">
      <span class="stat">${data.points.toLocaleString()} Points</span>
      <div class="stat-divider"></div>
      <span class="stat tier-text">${formattedTier} Tier</span>
    </div>
    
    <p class="cta">Earn 50 points per referral!</p>
  </div>
</body>
</html>
    `;
  }

  private getCacheKey(data: ShareCardData): string {
    return `${data.referralCode}-${data.points}-${data.tier}`;
  }

  async generateCard(rawData: unknown): Promise<Buffer> {
    if (this.isShuttingDown) {
      throw new Error('ShareCardGenerator is shutting down');
    }

    const validationResult = ShareCardDataSchema.safeParse(rawData);
    if (!validationResult.success) {
      throw new Error(`Invalid share card data: ${validationResult.error.message}`);
    }
    
    const data = validationResult.data;
    const cacheKey = this.getCacheKey(data);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      if (fs.existsSync(cached.path)) {
        console.log(`[ShareCardGenerator] Cache hit for ${data.referralCode}`);
        // Update timestamp for proper LRU behavior
        cached.timestamp = Date.now();
        return fs.readFileSync(cached.path);
      }
      this.cache.delete(cacheKey);
    }

    console.log(`[ShareCardGenerator] Generating new card for ${data.referralCode}`);
    
    this.pruneCache();
    
    const browser = await this.getBrowser();
    
    // Guard against shutdown during render
    if (this.isShuttingDown || !browser?.connected) {
      throw new Error('Browser unavailable');
    }
    
    let page: Page | null = null;
    
    try {
      page = await browser.newPage();
      await page.setViewport({ width: 800, height: 800 });
      
      const html = this.generateHTML(data);
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: false,
      });

      const filePath = path.join(CACHE_DIR, `${cacheKey}.png`);
      fs.writeFileSync(filePath, screenshot);
      
      this.cache.set(cacheKey, { path: filePath, timestamp: Date.now() });

      return screenshot as Buffer;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  async cleanup(): Promise<void> {
    console.log('[ShareCardGenerator] Shutting down...');
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('[ShareCardGenerator] Error closing browser:', error);
      }
      this.browser = null;
    }
    this.browserLaunchPromise = null;
  }
}

export const shareCardGenerator = ShareCardGenerator.getInstance();
