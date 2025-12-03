

import { ServerConfig, Token, DeletedToken, JournalEntry, StrategyConfig, TelegramConfig, CustomAlertRule, AIKey, AIConfig, AppState } from '../types';

const PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
];

const getBaseUrl = (config: ServerConfig) => {
    return config.url.replace(/\/$/, ""); 
};

// Get isolated key for user
const getStorageKey = (userId?: string) => {
    return userId ? `solana_sniper_state_${userId}` : 'solana_sniper_v2_state';
};

// --- CORE UTILS ---

export const saveLocalState = (state: Partial<AppState>, userId?: string) => {
    try {
        const cleanState = {
            ...state,
            tokens: state.tokens?.map(t => ({
                ...t,
                history: t.history.slice(-50) // Keep minimal history locally to save space
            })),
            deletedTokens: state.deletedTokens?.slice(0, 200)
        };
        localStorage.setItem(getStorageKey(userId), JSON.stringify(cleanState));
        return true;
    } catch (e) {
        console.warn("Local Save Failed:", e);
        return false;
    }
};

export const loadLocalState = (userId?: string): AppState | null => {
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.error("Local Load Failed:", e);
        return null;
    }
};

// --- SMART NETWORK LAYER ---

/**
 * Tries to fetch directly. If it fails (network error/mixed content), 
 * it automatically retries via a Secure Proxy.
 */
const fetchWithFallback = async (url: string, options: RequestInit): Promise<{ response: Response, mode: 'DIRECT' | 'PROXY' }> => {
    // 1. Try Direct Connection
    try {
        // Set a shorter timeout for direct attempt to fail fast
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        
        return { response: res, mode: 'DIRECT' };
    } catch (directError) {
        // 2. Fallback to Proxies
        // This usually catches Mixed Content errors (HTTP server on HTTPS app) or CORS issues
        console.warn("Direct connection failed, trying proxies...", directError);
        
        for (const proxy of PROXIES) {
            try {
                // If using AllOrigins, note it strips auth headers. 
                // However, for GET requests it might work for simple checks.
                // For POST/Auth, corsproxy.io is better.
                if (proxy.includes('allorigins') && options.headers && ('Authorization' in options.headers || 'X-User-ID' in options.headers)) {
                    continue; 
                }

                const proxyTarget = `${proxy}${encodeURIComponent(url)}`;
                const controllerProxy = new AbortController();
                const timeoutIdProxy = setTimeout(() => controllerProxy.abort(), 8000);

                const res = await fetch(proxyTarget, { ...options, signal: controllerProxy.signal });
                clearTimeout(timeoutIdProxy);
                
                if (res.ok || res.status === 404 || res.status === 403 || res.status === 500) {
                     return { response: res, mode: 'PROXY' };
                }
            } catch (proxyError) {
                continue;
            }
        }
        
        throw new Error("All connection methods failed");
    }
};

// --- SERVER TEST ---
export const testServerConnection = async (config: ServerConfig): Promise<{ success: boolean; message: string; mode?: 'DIRECT' | 'PROXY' }> => {
    if (!config.url) return { success: false, message: 'URL is empty' };
    
    try {
        const targetUrl = `${getBaseUrl(config)}/api/load`;
        
        const { response, mode } = await fetchWithFallback(targetUrl, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${config.apiKey}`,
                'X-User-ID': 'connection_test_probe'
            }
        });

        if (response.status === 403) {
            return { success: false, message: '🔐 Invalid Secret Key (403)' };
        }

        if (response.status === 500) {
            return { success: false, message: '🗄️ Database Error (500) - Check Postgres' };
        }
        
        if (response.ok || response.status === 404) {
            // 404 is fine (user not found), it means server is reachable and auth worked
            const msg = mode === 'DIRECT' ? '🟢 Online (Direct)' : '🛡️ Online (Secure Proxy)';
            return { success: true, message: msg, mode };
        }

        return { success: false, message: `Server Error: ${response.status}` };
    } catch (e: any) {
        if (e.name === 'AbortError') return { success: false, message: '⏱️ Timeout - Server Unreachable' };
        return { success: false, message: `🚫 Connection Failed (Blocked)` };
    }
};

// --- HYBRID SYNC ENGINE ---

export const saveHybridState = async (config: ServerConfig, state: AppState, userId?: string): Promise<'SERVER' | 'LOCAL' | 'FAILED'> => {
    // 1. Try Server (with Proxy Fallback)
    if (config.enabled && config.url) {
        try {
            const targetUrl = `${getBaseUrl(config)}/api/save`;
            const { response } = await fetchWithFallback(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                    'X-User-ID': userId || 'default'
                },
                body: JSON.stringify(state)
            });

            if (response.ok) {
                saveLocalState(state, userId);
                return 'SERVER';
            }
        } catch (e) {
            console.warn("Server save failed, falling back to local.");
        }
    }

    // 2. Fallback to Local
    const localSuccess = saveLocalState(state, userId);
    return localSuccess ? 'LOCAL' : 'FAILED';
};

export const loadHybridState = async (config: ServerConfig, userId?: string): Promise<{ data: AppState | null, source: 'SERVER' | 'LOCAL' | 'NONE' }> => {
    // 1. Try Server (with Proxy Fallback)
    if (config.enabled && config.url) {
        try {
            const targetUrl = `${getBaseUrl(config)}/api/load`;
            const { response } = await fetchWithFallback(targetUrl, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${config.apiKey}`,
                    'X-User-ID': userId || 'default'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return { data, source: 'SERVER' };
            }
        } catch (e) {
            console.warn("Server load failed, trying local.");
        }
    }

    // 2. Fallback to Local
    const localData = loadLocalState(userId);
    if (localData) {
        return { data: localData as AppState, source: 'LOCAL' };
    }

    return { data: null, source: 'NONE' };
};

// --- ADMIN FEATURES (LICENSE MANAGER) ---

export const getRemoteUserState = (userId: string): AppState | null => {
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
};

export const adminCheckUserHasKey = (userId: string, apiKey: string): boolean => {
    const state = getRemoteUserState(userId);
    if (!state || !state.aiConfig || !state.aiConfig.keys) return false;
    // Check if any key has the same API string
    return state.aiConfig.keys.some(k => k.apiKey === apiKey);
};

export const adminRevokeKey = (userId: string, apiKey: string) => {
    const keyName = getStorageKey(userId);
    const raw = localStorage.getItem(keyName);
    if (!raw) return;
    
    const state: AppState = JSON.parse(raw);
    if (!state.aiConfig || !state.aiConfig.keys) return;

    const initialLength = state.aiConfig.keys.length;
    // Remove keys that match the secret string
    state.aiConfig.keys = state.aiConfig.keys.filter(k => k.apiKey !== apiKey);
    
    if (state.aiConfig.keys.length !== initialLength) {
        state.lastUpdated = Date.now();
        localStorage.setItem(keyName, JSON.stringify(state));
    }
};

export const adminInjectKey = (targetUserId: string, key: AIKey) => {
    try {
        const keyName = getStorageKey(targetUserId);
        const raw = localStorage.getItem(keyName);
        
        // Initialize state if user has never logged in
        let state: AppState = raw ? JSON.parse(raw) : { 
            tokens: [], 
            deletedTokens: [], 
            journal: [], 
            strategy: { stages: [], correlations: [] } as any, 
            telegram: { enabled: false } as any, 
            lastUpdated: Date.now(), 
            aiConfig: { enabled: true, keys: [] } 
        };

        if (!state.aiConfig) {
            state.aiConfig = { enabled: true, keys: [] };
        }
        if (!state.aiConfig.keys) {
            state.aiConfig.keys = [];
        }

        // Prevent duplicates by API Key content
        const existingIndex = state.aiConfig.keys.findIndex(k => k.apiKey === key.apiKey);
        
        // Force shared flag, FORCE ENABLE, and ensure unique ID for the user's local instance
        const sharedKey: AIKey = { 
            ...key, 
            id: `shared_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
            isShared: true,
            enabled: true, // FORCE ACTIVATE
            name: `${key.name} (Admin Gift)`
        };
        
        if (existingIndex !== -1) {
            // Update existing if found (refresh details and force enable)
            const oldId = state.aiConfig.keys[existingIndex].id;
            state.aiConfig.keys[existingIndex] = { ...sharedKey, id: oldId };
        } else {
            // Add new
            state.aiConfig.keys.push(sharedKey);
        }
        
        // Ensure Global Switch is ON
        state.aiConfig.enabled = true;
        state.lastUpdated = Date.now();

        localStorage.setItem(keyName, JSON.stringify(state));
        return true;
    } catch (e) {
        console.error("Admin Inject Failed:", e);
        throw e;
    }
};
