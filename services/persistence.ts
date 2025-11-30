
import { ServerConfig, Token, DeletedToken, JournalEntry, StrategyConfig, TelegramConfig, CustomAlertRule, AIKey, AIConfig, AppState } from '../types';

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

// --- HYBRID SYNC ENGINE ---

export const saveHybridState = async (config: ServerConfig, state: AppState, userId?: string): Promise<'SERVER' | 'LOCAL' | 'FAILED'> => {
    // 1. Try Server
    if (config.enabled && config.url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); 

            const response = await fetch(`${getBaseUrl(config)}/api/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                    'X-User-ID': userId || 'default'
                },
                body: JSON.stringify(state),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                saveLocalState(state, userId);
                return 'SERVER';
            }
        } catch (e) {
            console.warn("Server unreachable, falling back to local.");
        }
    }

    // 2. Fallback to Local
    const localSuccess = saveLocalState(state, userId);
    return localSuccess ? 'LOCAL' : 'FAILED';
};

export const loadHybridState = async (config: ServerConfig, userId?: string): Promise<{ data: AppState | null, source: 'SERVER' | 'LOCAL' | 'NONE' }> => {
    // 1. Try Server
    if (config.enabled && config.url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${getBaseUrl(config)}/api/load`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${config.apiKey}`,
                    'X-User-ID': userId || 'default'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

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
