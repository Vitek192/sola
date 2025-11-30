

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Token, AIAnalysisResult, JournalEntry, AIConfig, AIKey, AIProvider, SecurityLog, AISecurityReport, TechnicalAnalysis } from "../types";

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

const getJournalPrompt = (cohorts: any, targetCohort?: string) => `
  You are the Chief Algo-Architect for a Solana Trading System.
  ${targetCohort 
    ? `PERFORM DEEP GRADIENT ANALYTICS ON SPECIFIC COHORT: "${targetCohort}".` 
    : 'Perform a broad Gradient Analysis of the market data below.'}

  The goal is to find actionable algorithmic rules to filter winners from losers ${targetCohort ? `specifically for tokens aged ${targetCohort}` : 'at each life stage'}.

  **Cohort Data (Winners vs Losers):**
  ${JSON.stringify(cohorts, null, 2)}

  **Tasks:**
  1. **Pattern Recognition**: Group tokens into behavioral categories (Death, Scam, Organic, etc.).
  2. **Gradient Analysis**: ${targetCohort ? `Focus ONLY on ${targetCohort}.` : 'For each time cohort,'} identify specific metric thresholds that separate profitable tokens from failed ones.
  3. **Rule Generation**: Formulate strictly structured rules for the "Correlation DB". 
     - Example: "If Age > ${targetCohort || '6h'} AND TxCount < 50 THEN Zombie/Death".
     - Example: "If Age > ${targetCohort || '1d'} AND Liquidity > 50000 THEN Organic Growth".
     - **CRITICAL**: The rule must be specific and programmable.

  **Output Language**: Russian (for summary and descriptions).
  **Output Format**: Strictly Valid JSON matching the schema.
`;

const getSecurityPrompt = (logs: SecurityLog[]) => `
  You are a Cybersecurity Expert AI (SOC Analyst).
  Analyze the following system authentication logs for potential threats.
  
  Logs:
  ${JSON.stringify(logs)}

  Look for:
  1. Brute Force patterns (multiple failures from same IP/User).
  2. Distributed attacks (failures from different IPs targeting one user).
  3. Admin account targeting.
  4. Anomalous timing.

  Output strictly valid JSON in Russian:
  {
    "threatLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "summary": "Short explanation of findings",
    "threats": ["List of specific suspicious patterns detected"],
    "recommendations": ["Actionable steps to fix"]
  }
`;

const getTechnicalAnalysisPrompt = (token: Token, candles: any[]) => `
  You are a Professional Technical Analyst (Chartist).
  Analyze the price action data for token ${token.symbol}.
  
  Price Data (Sequential):
  ${JSON.stringify(candles)}

  Perform a deep "Candlestick Analysis":
  1. Identify the CANDLE PATTERN formed in the last few intervals (e.g., Doji, Hammer, Engulfing, Three White Soldiers, Head & Shoulders).
  2. Determine the current TREND (Bullish, Bearish, Sideways/Consolidation).
  3. Estimate Support and Resistance levels based on the price history provided.
  4. Check for RSI status (Approximate based on price moves: sudden jumps = overbought, drops = oversold).
  
  Output in RUSSIAN language for the 'summary' and 'candlePattern' names.
  Format as strict JSON.
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
    },
    suggestedRules: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                cohort: { type: Type.STRING, description: "e.g., '1h', '6h', '1d'" },
                ruleName: { type: Type.STRING },
                metric: { type: Type.STRING, enum: ['PRICE_CHANGE_5M', 'PRICE_CHANGE_1H', 'LIQUIDITY', 'VOLUME_24H', 'NET_VOLUME', 'VOL_LIQ_RATIO', 'TX_COUNT'] },
                condition: { type: Type.STRING, enum: ['GT', 'LT', 'EQ'] },
                value: { type: Type.NUMBER },
                explanation: { type: Type.STRING }
            },
            required: ['cohort', 'ruleName', 'metric', 'condition', 'value', 'explanation']
        }
    }
  },
  required: ['summary', 'patterns', 'suggestedRules']
};

const GEMINI_SECURITY_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        threatLevel: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        summary: { type: Type.STRING },
        threats: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ['threatLevel', 'summary', 'threats', 'recommendations']
};

const GEMINI_TA_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        trend: { type: Type.STRING, enum: ['BULLISH', 'BEARISH', 'SIDEWAYS'] },
        candlePattern: { type: Type.STRING },
        strength: { type: Type.STRING, enum: ['STRONG', 'WEAK', 'NEUTRAL'] },
        supportLevel: { type: Type.NUMBER },
        resistanceLevel: { type: Type.NUMBER },
        rsiStatus: { type: Type.STRING, enum: ['OVERSOLD', 'OVERBOUGHT', 'NEUTRAL'] },
        summary: { type: Type.STRING }
    },
    required: ['trend', 'candlePattern', 'strength', 'supportLevel', 'resistanceLevel', 'rsiStatus', 'summary']
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
                const idLower = m.id ? m.id.toLowerCase() : "";
                
                const isFree = idLower.endsWith(':free') || 
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
            { "role": "system", "content": "You are a specialized AI assistant. Output strictly valid JSON." },
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

// --- DATA PREPARATION FOR GRADIENT ANALYSIS ---

const prepareCohortData = (tokens: Token[]) => {
    const now = Date.now();
    // Granular Buckets
    const cohorts: Record<string, { winners: any[], losers: any[] }> = {
        '0h-1h': { winners: [], losers: [] },
        '1h-6h': { winners: [], losers: [] },
        '6h-12h': { winners: [], losers: [] },
        '12h-18h': { winners: [], losers: [] },
        '18h-24h': { winners: [], losers: [] },
        'Day 2 (24-48h)': { winners: [], losers: [] },
        'Day 3 (48-72h)': { winners: [], losers: [] },
        'Day 4 (72-96h)': { winners: [], losers: [] },
        'Day 5 (96-120h)': { winners: [], losers: [] },
        'Day 6 (120-144h)': { winners: [], losers: [] },
        'Day 7 (144-168h)': { winners: [], losers: [] },
        'Week 1+': { winners: [], losers: [] }
    };

    tokens.forEach(t => {
        const ageMs = now - t.createdAt;
        const ageHours = ageMs / 3600000;
        const last = t.history[t.history.length - 1];
        if (!last) return;

        let bucket = 'Week 1+';
        if (ageHours < 1) bucket = '0h-1h';
        else if (ageHours < 6) bucket = '1h-6h';
        else if (ageHours < 12) bucket = '6h-12h';
        else if (ageHours < 18) bucket = '12h-18h';
        else if (ageHours < 24) bucket = '18h-24h';
        else if (ageHours < 48) bucket = 'Day 2 (24-48h)';
        else if (ageHours < 72) bucket = 'Day 3 (48-72h)';
        else if (ageHours < 96) bucket = 'Day 4 (72-96h)';
        else if (ageHours < 120) bucket = 'Day 5 (96-120h)';
        else if (ageHours < 144) bucket = 'Day 6 (120-144h)';
        else if (ageHours < 168) bucket = 'Day 7 (144-168h)';

        // simplified metric for AI context saving
        const simple = {
            s: t.symbol,
            priceChange: ((last.price - t.history[0].price)/t.history[0].price * 100).toFixed(1),
            liq: Math.round(last.liquidity),
            tx: t.txCount,
            makers: t.history[t.history.length-1].makers,
            vol: Math.round(last.volume24h)
        };

        const isWinner = parseFloat(simple.priceChange) > 10 && simple.liq > 1000;
        
        if (isWinner) {
            cohorts[bucket].winners.push(simple);
        } else {
            cohorts[bucket].losers.push(simple);
        }
    });

    // Reduce data size if too large for prompt
    Object.keys(cohorts).forEach(k => {
        // We allow slightly more data for deep analysis
        cohorts[k].winners = cohorts[k].winners.slice(0, 10); 
        cohorts[k].losers = cohorts[k].losers.slice(0, 10); 
    });

    return cohorts;
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

export const generateDailyJournal = async (tokens: Token[], config: AIConfig, targetCohort?: string): Promise<Omit<JournalEntry, 'id' | 'date'>> => {
  if (!config.enabled) {
      throw new Error("AI is disabled.");
  }

  const cohorts = prepareCohortData(tokens);
  
  // If targetCohort is specified, we filter the data passed to the prompt to maximize context relevance
  let dataForPrompt = cohorts;
  if (targetCohort && cohorts[targetCohort]) {
      dataForPrompt = { [targetCohort]: cohorts[targetCohort] };
  }

  const prompt = getJournalPrompt(dataForPrompt, targetCohort);

  return executeWithFailover(config, async (key) => {
      if (key.provider === 'GEMINI') {
          return await callGemini(key, prompt, GEMINI_JOURNAL_SCHEMA);
      } else {
          return await callOpenRouter(key, prompt);
      }
  });
};

// NEW: Security Analysis
export const analyzeSecurityLogs = async (logs: SecurityLog[], config: AIConfig): Promise<AISecurityReport> => {
    if (!config.enabled) {
        throw new Error("AI is disabled.");
    }
    
    // Filter last 50 relevant logs to save tokens
    const recentLogs = logs.slice(0, 50);
    const prompt = getSecurityPrompt(recentLogs);

    return executeWithFailover(config, async (key) => {
        if (key.provider === 'GEMINI') {
            return await callGemini(key, prompt, GEMINI_SECURITY_SCHEMA);
        } else {
            return await callOpenRouter(key, prompt);
        }
    });
};

// NEW: Technical Analysis
export const generateTechnicalAnalysis = async (token: Token, config: AIConfig): Promise<TechnicalAnalysis> => {
    if (!config.enabled) {
        throw new Error("AI is disabled.");
    }

    // Get last 50 data points for TA
    const candles = token.history.slice(-50).map(h => ({
        time: new Date(h.timestamp).toISOString(),
        price: h.price,
        vol: h.volume24h
    }));

    const prompt = getTechnicalAnalysisPrompt(token, candles);

    const result: TechnicalAnalysis = await executeWithFailover(config, async (key) => {
        if (key.provider === 'GEMINI') {
            return await callGemini(key, prompt, GEMINI_TA_SCHEMA);
        } else {
            return await callOpenRouter(key, prompt);
        }
    });
    
    return { ...result, timestamp: Date.now() };
};

export interface ComprehensiveReport {
    signal: AIAnalysisResult;
    technical: TechnicalAnalysis;
}

// NEW: Comprehensive Report (Parallel Execution)
export const generateComprehensiveReport = async (token: Token, config: AIConfig): Promise<ComprehensiveReport> => {
    if (!config.enabled) throw new Error("AI is disabled");

    // Run both analyses in parallel for speed
    const [signal, technical] = await Promise.all([
        analyzeTokenWithGemini(token, config),
        generateTechnicalAnalysis(token, config)
    ]);

    return { signal, technical };
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
