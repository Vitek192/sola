
import { ServerConfig, Token, DeletedToken, JournalEntry, StrategyConfig, TelegramConfig, CustomAlertRule } from '../types';

export interface AppState {
    tokens: Token[];
    deletedTokens: DeletedToken[];
    journal: JournalEntry[];
    strategy: StrategyConfig;
    telegram: TelegramConfig;
    customRules?: CustomAlertRule[];
    lastUpdated: number;
}

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
