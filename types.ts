
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  STRATEGY = 'STRATEGY',
  PORTFOLIO = 'PORTFOLIO',
  JOURNAL = 'JOURNAL',
  SETTINGS = 'SETTINGS',
  SIGNALS = 'SIGNALS',
  LOGS = 'LOGS',
  GRAVEYARD = 'GRAVEYARD',
  ALERTS = 'ALERTS',
  ADMIN_PANEL = 'ADMIN_PANEL'
}

export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  email?: string;
  createdAt: number;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface ServerConfig {
  url: string;
  apiKey: string;
  autoSave: boolean;
  enabled: boolean;
}

// --- AI CONFIGURATION ---
export type AIProvider = 'GEMINI' | 'OPENROUTER' | 'OPENAI' | 'DEEPSEEK';

export interface AIKey {
    id: string;
    provider: AIProvider;
    apiKey: string;
    modelId: string;
    name: string;
    enabled: boolean;
}

export interface AIConfig {
  enabled: boolean; // Global Master Switch
  keys: AIKey[];    // Keyring for failover
}

export interface TokenMetrics {
  price: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  marketCap: number;
  timestamp: number;
  buys: number;   
  sells: number;  
  makers: number; 
}

export type PatternType = 'RUG' | 'MOON' | 'STABLE' | 'VOLATILE';

export interface Token {
  id: string;
  symbol: string;
  name: string;
  address: string;
  tokenAddress: string;
  createdAt: number;
  history: TokenMetrics[]; 
  status: 'TRACKING' | 'FILTERED_OUT' | 'BUY_SIGNAL' | 'SELL_SIGNAL';
  patternType: PatternType; 
  aiAnalysis?: AIAnalysisResult;
  
  isPumpFun: boolean;
  pumpFunUrl?: string;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  netVolume: number;
  buyVolume: number;
  sellVolume: number;
  fdv: number;
  txCount: number;
  volLiqRatio: number;

  activeRisk?: {
      type: 'LOW_LIQUIDITY' | 'SCAM_RISK' | 'HIGH_VOLATILITY' | 'WHALE_RISK' | 'CUSTOM_RULE' | 'STAGE_FAIL' | 'CORRELATION';
      severity: 'WARNING' | 'CRITICAL';
      message: string;
      details?: string[];
  };

  isOwned?: boolean;
  entryPrice?: number;
  entryTime?: number;
  
  strategyOverride?: Partial<LifecycleStage>; 
}

export interface DeletedToken extends Token {
  deletedAt: number;
  deletionReason: string;
}

export interface RiskAlert {
  id: string;
  timestamp: number;
  tokenSymbol: string;
  tokenAddress: string;
  type: 'LOW_LIQUIDITY' | 'RUG_PULL' | 'SCAM_RISK' | 'HIGH_VOLATILITY' | 'WHALE_RISK' | 'CUSTOM_RULE' | 'STAGE_FAIL' | 'CORRELATION';
  message: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  value: string;
}

export type AlertMetric = 'PRICE_CHANGE_5M' | 'PRICE_CHANGE_1H' | 'LIQUIDITY' | 'VOLUME_24H' | 'NET_VOLUME' | 'VOL_LIQ_RATIO' | 'TX_COUNT';

export interface CustomAlertRule {
    id: string;
    name: string;
    metric: AlertMetric;
    condition: 'GT' | 'LT';
    value: number;
    enabled: boolean;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
}

export interface AIAnalysisResult {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  riskScore: number; 
  confidence: number; 
  patternDetected: string;
  reasoning: string;
  action: 'BUY' | 'SELL' | 'WAIT' | 'AVOID';
}

export interface CorrelationRule {
    id: string;
    enabled: boolean;
    name: string;
    description: string;
    metric: AlertMetric;
    condition: 'GT' | 'LT' | 'EQ'; 
    value: number;
    minAgeMinutes: number;
}

export interface LifecycleStage {
    id: string;
    enabled: boolean;
    name: string;
    description: string;
    startAgeMinutes: number; 
    minLiquidity: number;
    maxLiquidity: number;
    minMcap: number;
    maxMcap: number;
    minHolders: number;
    maxHolders: number;
    maxTop10Holding: number;
}

export interface StrategyConfig {
  minAIConfidence: number; 
  trackingDays: number;
  trackingHours: number;
  stages: LifecycleStage[];
  correlations: CorrelationRule[];
}

export enum JournalCategoryType {
  TOKEN_DEATH = 'TOKEN_DEATH',
  SCAM_MANIPULATION = 'SCAM_MANIPULATION',
  ORGANIC_GROWTH = 'ORGANIC_GROWTH',
  PUMP_DUMP = 'PUMP_DUMP',
  ACCUMULATION = 'ACCUMULATION'
}

export interface JournalPattern {
  category: JournalCategoryType;
  description: string;
  detectedTokens: string[];
  keyIndicators: string[];
}

export interface JournalEntry {
  id: string;
  date: number;
  summary: string;
  patterns: JournalPattern[];
}
