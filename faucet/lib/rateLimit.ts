const RATE_LIMIT_HOURS = 12;
const RATE_LIMIT_KEY = 'shield-faucet-claims';

interface ClaimRecord {
  [walletAddress: string]: {
    [tokenSymbol: string]: number;
  };
}

export function getClaimRecords(): ClaimRecord {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function setClaimRecord(walletAddress: string, tokenSymbol: string): void {
  if (typeof window === 'undefined') return;
  
  const records = getClaimRecords();
  
  if (!records[walletAddress.toLowerCase()]) {
    records[walletAddress.toLowerCase()] = {};
  }
  
  records[walletAddress.toLowerCase()][tokenSymbol.toUpperCase()] = Date.now();
  
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(records));
}

export function canClaim(walletAddress: string, tokenSymbol: string): boolean {
  const records = getClaimRecords();
  const lastClaim = records[walletAddress.toLowerCase()]?.[tokenSymbol.toUpperCase()];
  
  if (!lastClaim) return true;
  
  const hoursSinceClaim = (Date.now() - lastClaim) / (1000 * 60 * 60);
  return hoursSinceClaim >= RATE_LIMIT_HOURS;
}

export function getTimeUntilNextClaim(walletAddress: string, tokenSymbol: string): string {
  const records = getClaimRecords();
  const lastClaim = records[walletAddress.toLowerCase()]?.[tokenSymbol.toUpperCase()];
  
  if (!lastClaim) return '0';
  
  const msUntilClaim = lastClaim + (RATE_LIMIT_HOURS * 60 * 60 * 1000) - Date.now();
  
  if (msUntilClaim <= 0) return '0';
  
  const hours = Math.floor(msUntilClaim / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilClaim % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((msUntilClaim % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export function getRateLimitHours(): number {
  return RATE_LIMIT_HOURS;
}

interface ServerClaimRecord {
  timestamp: number;
  walletAddress: string;
  tokenSymbol: string;
  ip: string;
}

const serverClaimRecords: Map<string, ServerClaimRecord> = new Map();

const CLEANUP_INTERVAL = 60 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredRecords(): void {
  const now = Date.now();
  const expirationTime = RATE_LIMIT_HOURS * 60 * 60 * 1000;
  
  for (const [key, record] of serverClaimRecords.entries()) {
    if (now - record.timestamp > expirationTime) {
      serverClaimRecords.delete(key);
    }
  }
  
  lastCleanup = now;
}

function maybeCleanup(): void {
  if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
    cleanupExpiredRecords();
  }
}

function getServerClaimKey(walletAddress: string, tokenSymbol: string): string {
  return `${walletAddress.toLowerCase()}:${tokenSymbol.toUpperCase()}`;
}

function getIpClaimKey(ip: string, tokenSymbol: string): string {
  return `ip:${ip}:${tokenSymbol.toUpperCase()}`;
}

export function canClaimServer(walletAddress: string, tokenSymbol: string, ip: string): boolean {
  maybeCleanup();
  
  const walletKey = getServerClaimKey(walletAddress, tokenSymbol);
  const walletRecord = serverClaimRecords.get(walletKey);
  
  if (walletRecord) {
    const hoursSinceClaim = (Date.now() - walletRecord.timestamp) / (1000 * 60 * 60);
    if (hoursSinceClaim < RATE_LIMIT_HOURS) {
      return false;
    }
  }
  
  if (ip && ip !== 'unknown') {
    const ipKey = getIpClaimKey(ip, tokenSymbol);
    const ipRecord = serverClaimRecords.get(ipKey);
    
    if (ipRecord) {
      const hoursSinceClaim = (Date.now() - ipRecord.timestamp) / (1000 * 60 * 60);
      if (hoursSinceClaim < RATE_LIMIT_HOURS) {
        return false;
      }
    }
  }
  
  return true;
}

export function setClaimRecordServer(walletAddress: string, tokenSymbol: string, ip: string): void {
  const timestamp = Date.now();
  
  const walletKey = getServerClaimKey(walletAddress, tokenSymbol);
  serverClaimRecords.set(walletKey, {
    timestamp,
    walletAddress: walletAddress.toLowerCase(),
    tokenSymbol: tokenSymbol.toUpperCase(),
    ip,
  });
  
  if (ip && ip !== 'unknown') {
    const ipKey = getIpClaimKey(ip, tokenSymbol);
    serverClaimRecords.set(ipKey, {
      timestamp,
      walletAddress: walletAddress.toLowerCase(),
      tokenSymbol: tokenSymbol.toUpperCase(),
      ip,
    });
  }
}

export function getTimeUntilNextClaimServer(walletAddress: string, tokenSymbol: string, ip: string): string {
  const walletKey = getServerClaimKey(walletAddress, tokenSymbol);
  const walletRecord = serverClaimRecords.get(walletKey);
  
  let earliestNextClaim = 0;
  
  if (walletRecord) {
    const nextClaimTime = walletRecord.timestamp + (RATE_LIMIT_HOURS * 60 * 60 * 1000);
    if (nextClaimTime > earliestNextClaim) {
      earliestNextClaim = nextClaimTime;
    }
  }
  
  if (ip && ip !== 'unknown') {
    const ipKey = getIpClaimKey(ip, tokenSymbol);
    const ipRecord = serverClaimRecords.get(ipKey);
    
    if (ipRecord) {
      const nextClaimTime = ipRecord.timestamp + (RATE_LIMIT_HOURS * 60 * 60 * 1000);
      if (nextClaimTime > earliestNextClaim) {
        earliestNextClaim = nextClaimTime;
      }
    }
  }
  
  if (earliestNextClaim === 0) return '0';
  
  const msUntilClaim = earliestNextClaim - Date.now();
  
  if (msUntilClaim <= 0) return '0';
  
  const hours = Math.floor(msUntilClaim / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilClaim % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export function getServerClaimStats(): { totalRecords: number; walletRecords: number; ipRecords: number } {
  let walletRecords = 0;
  let ipRecords = 0;
  
  for (const key of serverClaimRecords.keys()) {
    if (key.startsWith('ip:')) {
      ipRecords++;
    } else {
      walletRecords++;
    }
  }
  
  return {
    totalRecords: serverClaimRecords.size,
    walletRecords,
    ipRecords,
  };
}
