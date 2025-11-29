
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Token, AIAnalysisResult, JournalEntry, JournalCategoryType } from "../types";

const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sentiment: { type: Type.STRING, enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
    riskScore: { type: Type.NUMBER, description: "0 to 100, where 100 is extremely risky" },
    confidence: { type: Type.NUMBER, description: "0 to 100 confidence in the prediction" },
    patternDetected: { type: Type.STRING, description: "Name of the chart pattern (e.g. Organic Growth, Bot Manipulation, Rug Pull)" },
    reasoning: { type: Type.STRING, description: "Analysis of Buys/Sells ratio, Makers growth, and Price action." },
    action: { type: Type.STRING, enum: ['BUY', 'SELL', 'WAIT', 'AVOID'] }
  },
  required: ['sentiment', 'riskScore', 'confidence', 'patternDetected', 'reasoning', 'action']
};

const JOURNAL_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Executive summary of the market day for Solana tokens." },
    patterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ['TOKEN_DEATH', 'SCAM_MANIPULATION', 'ORGANIC_GROWTH', 'PUMP_DUMP', 'ACCUMULATION'] },
          description: { type: Type.STRING, description: "Description of why this pattern occurred today and what metrics signaled it." },
          detectedTokens: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of Token Symbols that matched this pattern." },
          keyIndicators: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Bullet points of exact metric thresholds (e.g., 'Vol > 50k but Makers < 10')." }
        },
        required: ['category', 'description', 'detectedTokens', 'keyIndicators']
      }
    }
  },
  required: ['summary', 'patterns']
};

const getApiKey = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return apiKey;
};

export const analyzeTokenWithGemini = async (token: Token): Promise<AIAnalysisResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const simplifiedHistory = token.history
      .slice(-20) 
      .map(h => ({
        time: new Date(h.timestamp).toLocaleTimeString(),
        price: h.price.toFixed(8),
        liquidity: h.liquidity.toFixed(0),
        buys: h.buys,
        sells: h.sells,
        makers: h.makers
      }));

    const prompt = `
      Analyze this Solana token for a Swing Trade (1-7 day hold).
      Token: ${token.symbol} (${token.name})
      Created: ${new Date(token.createdAt).toLocaleString()}
      
      Data (Last 10h): ${JSON.stringify(simplifiedHistory)}

      Rules for Action:
      - BUY: ONLY if Makers are increasing AND Price is stable or slowly rising AND Liquidity > 3000. This is "Accumulation" or "Organic Growth".
      - SELL: If Price drops > 10% with high volume, or Liquidity drops.
      - AVOID: If Makers < 5 but Volume > 10000 (Bot activity).

      IMPORTANT: 
      1. Write the 'reasoning' in RUSSIAN language. Explain EXACTLY why it is a BUY or AVOID (mention specific metrics like "Makers grew from X to Y").
      2. If Action is BUY, confidence must be high (>80). If metrics are weak, set Action to WAIT.
      
      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA,
      }
    });

    return JSON.parse(response.text || '{}') as AIAnalysisResult;
  } catch (error) {
    console.error("Gemini Token Analysis Failed", error);
    return {
      sentiment: 'NEUTRAL',
      riskScore: 50,
      confidence: 0,
      patternDetected: 'Ошибка ИИ',
      reasoning: 'Сервис временно недоступен',
      action: 'WAIT'
    };
  }
};

export const generateDailyJournal = async (tokens: Token[]): Promise<Omit<JournalEntry, 'id' | 'date'>> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    // Prepare a summary payload. We can't send full history for all tokens due to token limits.
    // We send the "Day Summary" for each token.
    const tokensSummary = tokens.map(t => {
      const first = t.history[0];
      const last = t.history[t.history.length - 1];
      const priceChange = ((last.price - first.price) / first.price) * 100;
      
      return {
        symbol: t.symbol,
        ageHours: ((Date.now() - t.createdAt) / 3600000).toFixed(1),
        priceChangePercent: priceChange.toFixed(2),
        currentLiquidity: last.liquidity,
        makersTrend: last.makers - first.makers, // Positive = growth, Negative = loss
        buySellRatio: (last.buys / (last.sells || 1)).toFixed(2)
      };
    });

    const prompt = `
      You are the Chief Analyst for a Solana Trading Algorithm. 
      It is midnight. Analyze the performance of these tracked tokens today to improve our future strategy.

      Token Summaries:
      ${JSON.stringify(tokensSummary)}

      Task:
      1. Group tokens into behavioral categories (Death, Scam, Organic, PumpDump, Accumulation).
      2. Identify the *exact* correlation signals for each group (e.g., "Tokens that died all had liquidity < $500").
      3. Create a journal entry to teach the user.

      IMPORTANT: Output the JSON content (summary, description, keyIndicators) strictly in RUSSIAN language.
      The keys of the JSON object must remain in English (e.g., "summary", "patterns"), but the text inside must be Russian.

      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: JOURNAL_SCHEMA,
      }
    });

    return JSON.parse(response.text || '{}');

  } catch (error) {
    console.error("Gemini Journal Generation Failed", error);
    throw error;
  }
};
