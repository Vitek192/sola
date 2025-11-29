
import { Token, TokenMetrics } from '../types';

const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';
// We use a proxy as a fallback if direct connection is blocked by browser policies
const PROXY_URL = 'https://corsproxy.io/?';

// Helper to fetch with auto-proxy fallback
const safeFetch = async (url: string) => {
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' }});
        if (res.ok) return res;
        throw new Error(`Direct Fetch Failed: ${res.status}`);
    } catch (e) {
        // Fallback to proxy
        try {
            const proxyRes = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`);
            return proxyRes;
        } catch (proxyError) {
            console.error("Proxy fetch failed:", proxyError);
            throw e;
        }
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

const mapPoolToToken = (pool: GeckoPool, existingHistory: TokenMetrics[] = []): Token | null => {
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

  const latestMetric: TokenMetrics = {
    timestamp: Date.now(),
    price: price,
    liquidity: liquidity,
    volume24h: totalVolume,
    holders: 0, // Not provided in this endpoint usually
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
    console.error("Failed to fetch pools:", error);
    throw error;
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
            const url = `${GECKO_BASE}/networks/solana/pools/multi/${addressStr}?include=base_token`;
            const response = await safeFetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data.data) {
                    const mapped = data.data.map((pool: any) => {
                        const existing = existingTokens.find(t => t.address === pool.attributes.address);
                        return mapPoolToToken(pool, existing ? existing.history : []);
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
