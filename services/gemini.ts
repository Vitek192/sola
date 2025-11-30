
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Token, AIAnalysisResult, JournalEntry, AIConfig, AIKey, AIProvider } from "../types";

// --- PROMPTS ---
const getAnalysisPrompt = (token: Token, history: any[]) => `
  Analyze this Solana token for a Swing Trade (1-7 day hold).
  Token: ${token.symbol} (${token.name})
  Created: ${new Date(token.createdAt).toLocaleString()}
  
  Data (Last 10h): ${JSON.stringify(history)}

  Rules for Action:
  - BUY: ONLY if Makers are increasing AND Price is stable or slowly rising AND Liquidity > 3000. This is "Accumulation" or "Organic Growth".
  - SELL: If Price drops > 10% with high volume, or Liquidity drops.
  - AVOID: If Makers < 5 but Volume > 10000 (Bot activity).

  IMPORTANT: 
  1. Write the 'reasoning' in RUSSIAN language. Explain EXACTLY why it is a BUY or AVOID (mention specific metrics like "Makers grew from X to Y").
  2. If Action is BUY, confidence must be high (>80). If metrics are weak, set Action to WAIT.
  3. Output strictly valid JSON matching the schema: { sentiment, riskScore, confidence, patternDetected, reasoning, action }.
`;

const getJournalPrompt = (summary: any[]) => `
  You are the Chief Analyst for a Solana Trading Algorithm. 
  It is midnight. Analyze the performance of these tracked tokens today.

  Token Summaries:
  ${JSON.stringify(summary)}

  Task:
  1. Group tokens into behavioral categories (Death, Scam, Organic, PumpDump, Accumulation).
  2. Identify correlation signals.
  3. Create a journal entry.

  IMPORTANT: Output valid JSON content strictly in RUSSIAN language for values.
  Schema: { summary: string, patterns: [{ category, description, detectedTokens: [], keyIndicators: [] }] }
`;

// --- GEMINI SPECIFIC SCHEMA ---
const GEMINI_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sentiment: { type: Type.STRING, enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
    riskScore: { type: Type.NUMBER },
    confidence: { type: Type.NUMBER },
    patternDetected: { type: Type.STRING },
    reasoning: { type: Type.STRING },
    action: { type: Type.STRING, enum: ['BUY', 'SELL', 'WAIT', 'AVOID'] }
  },
  required: ['sentiment', 'riskScore', 'confidence', 'patternDetected', 'reasoning', 'action']
};

const GEMINI_JOURNAL_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    patterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ['TOKEN_DEATH', 'SCAM_MANIPULATION', 'ORGANIC_GROWTH', 'PUMP_DUMP', 'ACCUMULATION'] },
          description: { type: Type.STRING },
          detectedTokens: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyIndicators: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['category', 'description', 'detectedTokens', 'keyIndicators']
      }
    }
  },
  required: ['summary', 'patterns']
};

// --- API HELPERS (Low Level) ---

export interface ModelInfo {
    id: string;
    name: string;
    isFree: boolean;
    pricing?: string;
    contextLength?: string; // e.g. "128k"
}

// Fetch available models from Providers
export const fetchModels = async (provider: AIProvider, apiKey?: string): Promise<ModelInfo[]> => {
    if (provider === 'OPENROUTER') {
        try {
            const headers: any = {
                "Content-Type": "application/json"
            };
            if (apiKey) {
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            const response = await fetch("https://openrouter.ai/api/v1/models", {
                method: "GET",
                headers: headers
            });
            
            if (!response.ok) {
                console.error("OpenRouter Fetch Failed:", response.status, await response.text());
                return [];
            }
            
            const rawData = await response.json();
            const dataList = rawData.data || [];
            
            if (!Array.isArray(dataList)) return [];

            const list = dataList.map((m: any) => {
                // Securely parse pricing (can be string or number)
                let priceInput = 0;
                let priceOutput = 0;
                
                if (m.pricing) {
                    priceInput = Number(m.pricing.input) || 0;
                    priceOutput = Number(m.pricing.output) || 0;
                }

                // Robust Free Check: ID suffix OR Zero Pricing OR explicit flag
                const isFree = (m.id && m.id.toLowerCase().endsWith(':free')) || 
                               (priceInput === 0 && priceOutput === 0) || 
                               m.free === true;
                
                // Format context length (e.g. 131072 -> 128k)
                const ctx = m.context_length ? Math.round(m.context_length / 1024) + 'k' : '?';

                return {
                    id: m.id,
                    name: m.name || m.id,
                    isFree: isFree,
                    priceValue: priceInput, // For sorting
                    contextLength: ctx
                };
            });

            // Sort: FREE models first, then by Price (Low to High), then Alphabetical
            return list.sort((a: any, b: any) => {
                // 1. Free vs Paid
                if (a.isFree && !b.isFree) return -1;
                if (!a.isFree && b.isFree) return 1;
                
                // 2. Price (Cheap first)
                if (!a.isFree && !b.isFree) {
                    if (a.priceValue !== b.priceValue) return a.priceValue - b.priceValue;
                }
                
                // 3. Alphabetical
                return a.name.localeCompare(b.name);
            });
        } catch (e) {
            console.error("Failed to fetch OpenRouter models", e);
            return [];
        }
    }
    return [];
};

const callOpenRouter = async (key: AIKey, prompt: string) => {
    let url = "https://openrouter.ai/api/v1/chat/completions";
    
    // OpenRouter Specific Headers
    let headers: any = {
        "Authorization": `Bearer ${key.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin, 
        "X-Title": "SolanaSniper AI" 
    };

    if (key.provider === 'OPENAI') {
        url = "https://api.openai.com/v1/chat/completions";
        headers = { "Authorization": `Bearer ${key.apiKey}`, "Content-Type": "application/json" };
    } else if (key.provider === 'DEEPSEEK') {
        url = "https://api.deepseek.com/chat/completions";
        headers = { "Authorization": `Bearer ${key.apiKey}`, "Content-Type": "application/json" };
    }

    // Do NOT force response_format: json_object for generic models as many don't support it
    const payload: any = {
        "model": key.modelId || "meta-llama/llama-3-8b-instruct:free",
        "messages": [
            { "role": "system", "content": "You are a financial analyst. Output strictly valid JSON." },
            { "role": "user", "content": prompt }
        ]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Provider Error (${key.provider}): ${response.status} - ${errText}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from Provider");

    // Robust JSON Extraction
    try {
        let cleanContent = content.trim();
        // Regex to extract content between ```json and ``` or just ``` and ```
        const match = cleanContent.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (match && match[1]) {
            cleanContent = match[1];
        } else {
            // Fallback: Try to find outer braces
            const firstBrace = cleanContent.indexOf('{');
            const lastBrace = cleanContent.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
            }
        }
        return JSON.parse(cleanContent);
    } catch (e) {
        console.error("JSON Parse Error. Raw content:", content);
        throw new Error("AI returned invalid JSON. Try a smarter model.");
    }
};

const callGemini = async (key: AIKey, prompt: string, schema: Schema) => {
    const ai = new GoogleGenAI({ apiKey: key.apiKey });
    const model = key.modelId || 'gemini-2.5-flash';
    
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });
    
    return JSON.parse(response.text || '{}');
};

// --- FAILOVER LOGIC ---

const executeWithFailover = async (config: AIConfig, task: (key: AIKey) => Promise<any>) => {
    const enabledKeys = config.keys.filter(k => k.enabled);
    
    if (enabledKeys.length === 0) {
        throw new Error("No active AI keys found. Check Settings.");
    }

    let lastError;

    // Loop through keys (Priority Queue)
    for (const key of enabledKeys) {
        try {
            console.log(`🤖 AI Attempt using: ${key.provider} (${key.name || 'Unnamed'})`);
            const result = await task(key);
            return result; // Success!
        } catch (error: any) {
            console.warn(`⚠️ Key Failed (${key.provider}):`, error.message);
            lastError = error;
            // Continue to next key...
        }
    }

    throw new Error(`All AI keys failed. Last error: ${lastError?.message}`);
};

// --- PUBLIC METHODS ---

export const analyzeTokenWithGemini = async (token: Token, config: AIConfig): Promise<AIAnalysisResult> => {
  if (!config.enabled) {
      throw new Error("AI Analysis is globally disabled.");
  }

  const simplifiedHistory = token.history.slice(-20).map(h => ({
    time: new Date(h.timestamp).toLocaleTimeString(),
    price: h.price.toFixed(8),
    liquidity: h.liquidity.toFixed(0),
    buys: h.buys,
    sells: h.sells,
    makers: h.makers
  }));

  const prompt = getAnalysisPrompt(token, simplifiedHistory);

  return executeWithFailover(config, async (key) => {
      if (key.provider === 'GEMINI') {
          return await callGemini(key, prompt, GEMINI_ANALYSIS_SCHEMA);
      } else {
          return await callOpenRouter(key, prompt);
      }
  });
};

export const generateDailyJournal = async (tokens: Token[], config: AIConfig): Promise<Omit<JournalEntry, 'id' | 'date'>> => {
  if (!config.enabled) {
      throw new Error("AI is disabled.");
  }

  const tokensSummary = tokens.map(t => {
      const first = t.history[0];
      const last = t.history[t.history.length - 1];
      const priceChange = ((last.price - first.price) / first.price) * 100;
      return {
        symbol: t.symbol,
        ageHours: ((Date.now() - t.createdAt) / 3600000).toFixed(1),
        priceChangePercent: priceChange.toFixed(2),
        currentLiquidity: last.liquidity,
        makersTrend: last.makers - first.makers,
        buySellRatio: (last.buys / (last.sells || 1)).toFixed(2)
      };
  });

  const prompt = getJournalPrompt(tokensSummary);

  return executeWithFailover(config, async (key) => {
      if (key.provider === 'GEMINI') {
          return await callGemini(key, prompt, GEMINI_JOURNAL_SCHEMA);
      } else {
          return await callOpenRouter(key, prompt);
      }
  });
};

// --- TEST CONNECTIVITY ---
export const testKeyConnectivity = async (key: AIKey): Promise<{ success: boolean; message: string }> => {
    try {
        if (key.provider === 'GEMINI') {
            const ai = new GoogleGenAI({ apiKey: key.apiKey });
            const model = key.modelId || 'gemini-2.5-flash';
            await ai.models.generateContent({
                model: model,
                contents: "Test connection",
            });
            return { success: true, message: "Connected to Gemini" };
        } else {
            // OpenRouter/OpenAI/DeepSeek Test
            let url = "https://openrouter.ai/api/v1/chat/completions";
            let headers: any = { 
                "Authorization": `Bearer ${key.apiKey}`, 
                "Content-Type": "application/json",
                // REQUIRED FOR OPENROUTER COMPLIANCE
                "HTTP-Referer": window.location.origin, 
                "X-Title": "SolanaSniper AI"
            };
            
            if (key.provider === 'OPENAI') {
                url = "https://api.openai.com/v1/chat/completions";
                headers = { "Authorization": `Bearer ${key.apiKey}`, "Content-Type": "application/json" };
            }
            if (key.provider === 'DEEPSEEK') {
                url = "https://api.deepseek.com/chat/completions";
                headers = { "Authorization": `Bearer ${key.apiKey}`, "Content-Type": "application/json" };
            }

            const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    "model": key.modelId || "meta-llama/llama-3-8b-instruct:free",
                    "messages": [{ "role": "user", "content": "Hi. Return JSON: {\"status\":\"ok\"}" }],
                    "max_tokens": 10
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                // Extract error message cleanly if JSON
                try {
                    const jsonErr = JSON.parse(errText);
                    throw new Error(jsonErr.error?.message || errText);
                } catch {
                    throw new Error(`${res.status}: ${errText.substring(0, 100)}`);
                }
            }
            return { success: true, message: `Connected to ${key.provider}` };
        }
    } catch (e: any) {
        return { success: false, message: e.message || "Unknown Connection Error" };
    }
};
