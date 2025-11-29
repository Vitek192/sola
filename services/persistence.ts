
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

const LOCAL_STORAGE_KEY = 'solana_sniper_v2_state';

const getBaseUrl = (config: ServerConfig) => {
    return config.url.replace(/\/$/, ""); 
};

// --- CORE UTILS ---

export const saveLocalState = (state: Partial<AppState>) => {
    try {
        const cleanState = {
            ...state,
            tokens: state.tokens?.map(t => ({
                ...t,
                history: t.history.slice(-50) // Keep minimal history locally to save space
            })),
            deletedTokens: state.deletedTokens?.slice(0, 200)
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanState));
        return true;
    } catch (e) {
        console.warn("Local Save Failed:", e);
        return false;
    }
};

export const loadLocalState = (): AppState | null => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.error("Local Load Failed:", e);
        return null;
    }
};

// --- HYBRID SYNC ENGINE ---

/**
 * Tries to save to Ubuntu Server first. 
 * If fails or disabled, saves to LocalStorage.
 * Returns 'SERVER' | 'LOCAL' | 'FAILED'
 */
export const saveHybridState = async (config: ServerConfig, state: AppState): Promise<'SERVER' | 'LOCAL' | 'FAILED'> => {
    // 1. Try Server
    if (config.enabled && config.url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout for fast UI

            const response = await fetch(`${getBaseUrl(config)}/api/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(state),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                // Also save local as backup cache, but don't block
                saveLocalState(state);
                return 'SERVER';
            }
        } catch (e) {
            console.warn("Server unreachable, falling back to local.");
        }
    }

    // 2. Fallback to Local
    const localSuccess = saveLocalState(state);
    return localSuccess ? 'LOCAL' : 'FAILED';
};

/**
 * Tries to load from Server first.
 * If fails, loads from LocalStorage.
 */
export const loadHybridState = async (config: ServerConfig): Promise<{ data: AppState | null, source: 'SERVER' | 'LOCAL' | 'NONE' }> => {
    // 1. Try Server
    if (config.enabled && config.url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${getBaseUrl(config)}/api/load`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
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
    const localData = loadLocalState();
    if (localData) {
        return { data: localData as AppState, source: 'LOCAL' };
    }

    return { data: null, source: 'NONE' };
};
