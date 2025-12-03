

import { Token, TokenMetrics, ChainInfo } from '../types';

const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';

// Robust Proxy List
const PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=' // Note: AllOrigins strips custom headers, good for public GETs only
];

// Helper to fetch with auto-proxy fallback
const safeFetch = async (url: string, headers: any = {}) => {
    // 1. Try Direct Connection
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json', ...headers }});
        
        // If 403/429/5xx, it might be IP blocking, so we might want to try proxy.
        // If 401 (Unauthorized), proxy won't fix it (bad key).
        // If 200, return.
        if (res.ok) return res;
        if (res.status === 401) return res; // Bad Key, don't proxy
        if (res.status === 429) throw new Error("Rate Limited"); // Let caller handle
        
        // If 403 or other error, throw to trigger proxy fallback
        throw new Error(`Direct failed: ${res.status}`);
    } catch (directError: any) {
        // If AbortError (Timeout) or Rate Limit, rethrow
        if (directError.message === "Rate Limited") throw directError;

        // 2. Try Proxies
        // We only use proxies that support headers if we have custom headers (like 'token')
        const hasCustomHeaders = 'token' in headers || 'Authorization' in headers;
        
        for (const proxyBase of PROXIES) {
            // Skip AllOrigins if we need custom headers (it strips them)
            if (hasCustomHeaders && proxyBase.includes('allorigins')) continue;

            try {
                const target = proxyBase + encodeURIComponent(url);
                const proxyRes = await fetch(target, { headers });
                if (proxyRes.ok) return proxyRes;
            } catch (e) {
                console.warn(`Proxy ${proxyBase} failed.`);
            }
        }
        
        // If all fail, throw the original or a generic error
        console.error(`All fetch attempts failed for ${url}`);
        throw new Error("Network Unreachable");
    }
};

interface GeckoPool {
  id: string;
  attributes: {
    address: string;
    name: string;
    symbol?: string; // Optional in API response
    pool_created_at: string;
    price_in_usd?: string;
    base_token_price_usd?: string; // Fallback price field
    reserve_in_usd: string; // Liquidity
    volume_usd: { h1?: string; h24?: string };
    market_cap_usd: string;
    fdv_usd: string;
    price_change_percentage: { m5?: string; h1?: string; h6?: string; h24?: string };
    transactions: { h1?: { buys: number; sells: number }, m5?: { buys: number; sells: number }, h24?: { buys: number; sells: number } };
  };
  relationships?: {
      base_token?: { data?: { id?: string } };
      quote_token?: { data?: { id?: string } };
  }
}

// NEW: Fetch Chain Info (TPS, Price)
export const fetchChainInfo = async (solscanApiKey?: string): Promise<ChainInfo | null> => {
    try {
        let solPrice = 0;
        let tps = 0;
        let epoch = 0;
        let totalTransactions = 0;

        // 1. Fetch SOL Price (Gecko is reliable for this)
        try {
            const priceRes = await safeFetch(`${GECKO_BASE}/simple/networks/solana/token_price/So11111111111111111111111111111111111111112`);
            if (priceRes.ok) {
                const data = await priceRes.json();
                const price = data.data?.attributes?.token_prices?.['So11111111111111111111111111111111111111112'];
                if (price) solPrice = parseFloat(price);
            }
        } catch (e) { console.warn("SOL Price fetch failed"); }

        // 2. Fetch Network Stats (Solscan V2 or Public)
        let url = 'https://api.solscan.io/chaininfo'; // Public API fallback
        const headers: any = { 'Accept': 'application/json' };

        if (solscanApiKey) {
            // Pro API V2: /v2.0/chain/info returns TPS, Epoch, etc (but NOT price usually)
            url = 'https://pro-api.solscan.io/v2.0/chain/info';
            headers['token'] = solscanApiKey;
        }

        const response = await safeFetch(url, headers);
        if (response.ok) {
            const data = await response.json();
            const info = data.data || data; // Auto-unwrap V2 data structure
            
            tps = info.tps || 0;
            epoch = info.epoch || info.currentEpoch || 0;
            totalTransactions = info.totalTransaction || info.transactionCount || 0;
        }

        return { solPrice, tps, epoch, totalTransactions };
    } catch (e) {
        // Silent fail for chain info
        return null;
    }
};

// NEW: Fetch Token Meta (Logos) from Solscan V2
export const fetchTokenMeta = async (mint: string, solscanApiKey: string): Promise<{ image?: string, name?: string } | null> => {
    if (!solscanApiKey) return null;
    try {
        const url = `https://pro-api.solscan.io/v2.0/token/meta?address=${mint}`;
        const response = await safeFetch(url, { 'token': solscanApiKey });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                return {
                    image: data.data.icon,
                    name: data.data.name
                };
            }
        }
    } catch (e) {
        // console.error("Solscan Meta Fetch Error:", e);
    }
    return null;
};

// NEW: Robust RPC Fetcher for Holders
const fetchHoldersViaRPC = async (mint: string, rpcUrl: string): Promise<number | null> => {
    try {
        // We use 'getProgramAccounts' with filters to count accounts holding the token
        // Optimization: dataSlice { length: 0 } requests only keys, no data, saving bandwidth.
        const body = JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getProgramAccounts",
            "params": [
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token Program ID
                {
                    "encoding": "jsonParsed",
                    "dataSlice": { "offset": 0, "length": 0 }, // We only need the count
                    "filters": [
                        { "dataSize": 165 }, // Standard Token Account size
                        {
                            "memcmp": {
                                "offset": 0, // Mint address is at offset 0
                                "bytes": mint
                            }
                        }
                    ]
                }
            ]
        });

        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });

        if (response.ok) {
            const json = await response.json();
            if (json.result && Array.isArray(json.result)) {
                return json.result.length;
            }
        }
        return null;
    } catch (e) {
        console.error("RPC Holder Fetch Error:", e);
        return null;
    }
};

// NEW: Fetch Holders from Solscan (Pro) or SolanaTracker (Public/Free) or Custom RPC
export const fetchTokenHolders = async (mint: string, solscanApiKey?: string, rpcUrl?: string): Promise<number | null> => {
    
    // 1. Try Solscan Pro if API Key provided (Most Accurate & Fast)
    if (solscanApiKey) {
        try {
            const url = `https://pro-api.solscan.io/v2.0/token/holders?address=${mint}`;
            const response = await safeFetch(url, { 'token': solscanApiKey });
            if (response.ok) {
                const data = await response.json();
                if (data.data && typeof data.data.total === 'number') {
                    return data.data.total;
                }
            }
        } catch (e) { /* Fallback */ }
    }

    // 2. Try Custom RPC (If configured) - Direct Blockchain Query
    if (rpcUrl) {
        const count = await fetchHoldersViaRPC(mint, rpcUrl);
        if (count !== null) return count;
    }

    // 3. Fallback to SolanaTracker public data
    try {
        const url = `https://data.solanatracker.io/tokens/${mint}`;
        const response = await safeFetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && data.token && typeof data.token.holders === 'number') {
                return data.token.holders;
            }
        }
    } catch (e) { /* ignore */ }
    
    return null;
};

export const testSolscanConnection = async (apiKey: string): Promise<boolean> => {
    try {
        const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const url = `https://pro-api.solscan.io/v2.0/token/holders?address=${usdc}`;
        const response = await safeFetch(url, { 'token': apiKey });
        return response.ok;
    } catch (e) { return false; }
};

export const testRpcConnection = async (rpcUrl: string): Promise<boolean> => {
    try {
        const body = JSON.stringify({
            "jsonrpc": "2.0", "id": 1, "method": "getHealth"
        });
        const res = await fetch(rpcUrl, { method: 'POST', headers: {'Content-Type': 'application/json'}, body });
        return res.ok;
    } catch { return false; }
};

const mapPoolToToken = (pool: GeckoPool, existingHistory: TokenMetrics[] = [], existingMeta?: { logoUrl?: string }): Token | null => {
  if (!pool || !pool.attributes) return null;

  const attrs = pool.attributes;
  
  // 1. EXTRACT IDs
  const baseTokenIdWithNetwork = pool.relationships?.base_token?.data?.id || "";
  // "solana_Address" -> "Address"
  const tokenAddress = baseTokenIdWithNetwork.replace("solana_", ""); 
  
  // 2. PARSING IDENTITY
  const rawName = attrs.name || 'Unknown Pool';
  let symbol = attrs.symbol;

  if (!symbol) {
      if (rawName.includes('/')) {
          const parts = rawName.split('/');
          symbol = parts[0].trim();
      } else {
          symbol = rawName.split(' ')[0].trim();
      }
  }
  symbol = (symbol || 'UNK').toUpperCase();

  // 3. PUMP.FUN DETECTION
  const isPumpFun = baseTokenIdWithNetwork.includes("pump");
  const pumpFunUrl = isPumpFun ? `https://pump.fun/${tokenAddress}` : undefined;

  // 4. METRICS CALCULATION
  // Try multiple price fields
  let price = parseFloat(attrs.price_in_usd || '0');
  if (price === 0 && attrs.base_token_price_usd) {
      price = parseFloat(attrs.base_token_price_usd);
  }
  
  const liquidity = parseFloat(attrs.reserve_in_usd) || 0;
  
  // Market Cap Logic: Use FDV if MCAP is missing
  let mcap = parseFloat(attrs.market_cap_usd || '0');
  const fdv = parseFloat(attrs.fdv_usd || '0');
  if (mcap === 0) {
      mcap = fdv;
  }

  // Price Changes
  const priceChange5m = parseFloat(attrs.price_change_percentage?.m5 || '0');
  const priceChange1h = parseFloat(attrs.price_change_percentage?.h1 || '0');
  const priceChange24h = parseFloat(attrs.price_change_percentage?.h24 || '0');

  // Transactions (Prefer 24h, fallback to h1)
  const txData = attrs.transactions?.h24 || attrs.transactions?.h1 || { buys: 0, sells: 0 };
  const buys = txData.buys || 0;
  const sells = txData.sells || 0;
  const txCount = buys + sells;

  // Volume Math
  const totalVolume = parseFloat(attrs.volume_usd?.h24 || '0');
  // Avoid division by zero
  const buyRatio = txCount > 0 ? buys / txCount : 0.5;
  const sellRatio = txCount > 0 ? sells / txCount : 0.5;
  
  const buyVolume = totalVolume * buyRatio;
  const sellVolume = totalVolume * sellRatio;
  const netVolume = buyVolume - sellVolume;

  // Vol / Liq Ratio
  const volLiqRatio = liquidity > 0 ? totalVolume / liquidity : 0;
  
  // Preserve existing holder count if available
  const existingHolders = existingHistory.length > 0 ? existingHistory[existingHistory.length - 1].holders : 0;

  const latestMetric: TokenMetrics = {
    timestamp: Date.now(),
    price: price,
    liquidity: liquidity,
    volume24h: totalVolume,
    holders: existingHolders, // Default to existing, will be updated by separate fetch
    marketCap: mcap,
    buys: buys,
    sells: sells,
    makers: buys + sells // Approximation
  };

  // Append to history
  const updatedHistory = [...existingHistory, latestMetric].slice(-50);

  return {
    id: pool.id || `pool_${attrs.address}`, 
    symbol: symbol,
    name: rawName,
    address: attrs.address || '',
    tokenAddress: tokenAddress,
    createdAt: attrs.pool_created_at ? new Date(attrs.pool_created_at).getTime() : Date.now(),
    history: updatedHistory, 
    status: 'TRACKING',
    patternType: 'VOLATILE', 
    isOwned: false,
    logoUrl: existingMeta?.logoUrl, // Persist logo
    
    // New Fields
    isPumpFun,
    pumpFunUrl,
    priceChange5m,
    priceChange1h,
    priceChange24h,
    netVolume,
    buyVolume,
    sellVolume,
    fdv,
    txCount,
    volLiqRatio
  };
};

export const fetchNewSolanaPools = async (): Promise<Token[]> => {
  try {
    const url = `${GECKO_BASE}/networks/solana/new_pools?page=1&limit=20&include=base_token,quote_token`;
    const response = await safeFetch(url);

    if (response.status === 429) {
        throw new Error("GeckoTerminal API Rate Limit (429). Please wait a moment.");
    }
    
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    
    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
        return [];
    }

    const tokens = data.data
        .map((pool: any) => mapPoolToToken(pool))
        .filter((t: Token | null): t is Token => t !== null && t.symbol !== 'UNK');

    return tokens;
  } catch (error) {
    console.warn("Failed to fetch pools:", error);
    // Don't throw loudly, return empty to keep app running
    return [];
  }
};

export const fetchTokensBatch = async (addresses: string[], existingTokens: Token[]): Promise<Token[]> => {
    if (addresses.length === 0) return [];

    try {
        const chunks = [];
        for (let i = 0; i < addresses.length; i += 30) {
            chunks.push(addresses.slice(i, i + 30));
        }

        let updatedTokens: Token[] = [];

        for (const chunk of chunks) {
            const addressStr = chunk.join(',');
            // If we are passing pool addresses
            const url = `${GECKO_BASE}/networks/solana/pools/multi/${addressStr}?include=base_token`;
            const response = await safeFetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data.data) {
                    const mapped = data.data.map((pool: any) => {
                        const existing = existingTokens.find(t => t.address === pool.attributes.address);
                        return mapPoolToToken(pool, existing ? existing.history : [], existing ? { logoUrl: existing.logoUrl } : undefined);
                    });
                    updatedTokens = [...updatedTokens, ...mapped];
                }
            }
        }
        return updatedTokens.filter(t => t !== null) as Token[];
    } catch (e) {
        console.error("Batch update failed:", e);
        return [];
    }
};

// NEW: Fetch Token by Mint Address (Finds best pool)
export const fetchTokenByMint = async (mintAddress: string, solscanApiKey?: string): Promise<Token | null> => {
    try {
        // Fetch pools for this token, sorted by liquidity usually by default or first one is best
        const url = `${GECKO_BASE}/networks/solana/tokens/${mintAddress}/pools?page=1&include=base_token`;
        const response = await safeFetch(url);

        if (!response.ok) {
            console.warn(`Token fetch failed for ${mintAddress}: ${response.status}`);
            return null;
        }
        const data = await response.json();

        if (!data.data || data.data.length === 0) return null;

        // Take the first pool (top pool)
        const topPool = data.data[0];
        const token = mapPoolToToken(topPool);
        
        // Enrich Data if token exists
        if (token) {
            // 1. Fetch Holders
            // NOTE: We do not pass RPC URL here yet, will be handled in main loop
            // But we can update it if we have Solscan Key
            const holders = await fetchTokenHolders(token.tokenAddress, solscanApiKey);
            if (holders !== null) {
                token.history[token.history.length - 1].holders = holders;
            }
            // 2. Fetch Logo (Meta) if key present
            if (solscanApiKey) {
                const meta = await fetchTokenMeta(token.tokenAddress, solscanApiKey);
                if (meta && meta.image) {
                    token.logoUrl = meta.image;
                }
            }
        }
        
        return token;
    } catch (e) {
        console.error("Fetch Token By Mint Failed:", e);
        return null;
    }
};

export const fetchTokenHistory = async (address: string): Promise<TokenMetrics[]> => {
  try {
    if (!address) return [];
    const url = `${GECKO_BASE}/networks/solana/pools/${address}/ohlcv/hour?limit=168`; 
    const response = await safeFetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const ohlcvList = data?.data?.attributes?.ohlcv_list; 
    if (!ohlcvList || !Array.isArray(ohlcvList)) return [];

    return ohlcvList.map((candle: number[]) => ({
        timestamp: candle[0] * 1000,
        price: candle[4],
        liquidity: 0, 
        volume24h: candle[5],
        holders: 0,
        marketCap: 0,
        buys: 0, 
        sells: 0, 
        makers: 0
    })).reverse(); 
  } catch (e) {
    return [];
  }
};
