

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  STRATEGY = 'STRATEGY', // New View
  PORTFOLIO = 'PORTFOLIO',
  JOURNAL = 'JOURNAL',
  SETTINGS = 'SETTINGS',
  SIGNALS = 'SIGNALS',
  LOGS = 'LOGS',
  GRAVEYARD = 'GRAVEYARD',
  ALERTS = 'ALERTS'
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface ServerConfig {
  url: string; // e.g., http://1.2.3.4:3000
  apiKey: string; // Simple security token
  autoSave: boolean;
  enabled: boolean;
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
  tokenAddress: string; // The base token address (not pool)
  createdAt: number;
  history: TokenMetrics[]; 
  status: 'TRACKING' | 'FILTERED_OUT' | 'BUY_SIGNAL' | 'SELL_SIGNAL';
  patternType: PatternType; 
  aiAnalysis?: AIAnalysisResult;
  
  // Extended Metrics from User Script
  isPumpFun: boolean;
  pumpFunUrl?: string;
  priceChange5m: number; // New
  priceChange1h: number;
  priceChange24h: number;
  netVolume: number; // Buy Vol - Sell Vol
  buyVolume: number;
  sellVolume: number;
  fdv: number;
  txCount: number; // New
  volLiqRatio: number; // New: Volume / Liquidity

  // Active Risk Alert for UI Display
  activeRisk?: {
      type: 'LOW_LIQUIDITY' | 'SCAM_RISK' | 'HIGH_VOLATILITY' | 'WHALE_RISK' | 'CUSTOM_RULE' | 'STAGE_FAIL' | 'CORRELATION';
      severity: 'WARNING' | 'CRITICAL';
      message: string;
      details?: string[]; // Multiple triggers
  };

  // Portfolio specifics
  isOwned?: boolean;
  entryPrice?: number;
  entryTime?: number;
  
  // Per-Token Strategy Override (Optional)
  strategyOverride?: Partial<LifecycleStage>; 
}

export interface DeletedToken extends Token {
  deletedAt: number;
  deletionReason: string;
}

// NEW: For Analytics Alerts similar to the screenshot
export interface RiskAlert {
  id: string;
  timestamp: number;
  tokenSymbol: string;
  tokenAddress: string;
  type: 'LOW_LIQUIDITY' | 'RUG_PULL' | 'SCAM_RISK' | 'HIGH_VOLATILITY' | 'WHALE_RISK' | 'CUSTOM_RULE' | 'STAGE_FAIL' | 'CORRELATION';
  message: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  value: string; // e.g. "$500 Liq"
}

// --- CUSTOM ALERT RULES ---
export type AlertMetric = 'PRICE_CHANGE_5M' | 'PRICE_CHANGE_1H' | 'LIQUIDITY' | 'VOLUME_24H' | 'NET_VOLUME' | 'VOL_LIQ_RATIO' | 'TX_COUNT';

export interface CustomAlertRule {
    id: string;
    name: string; // User defined name e.g. "Mega Pump"
    metric: AlertMetric;
    condition: 'GT' | 'LT'; // Greater Than / Less Than
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

// --- DYNAMIC STRATEGY & CORRELATIONS ---

export interface CorrelationRule {
    id: string;
    enabled: boolean;
    name: string; // e.g. "Zombie Mode"
    description: string;
    // Condition: IF metric meets condition for duration
    metric: AlertMetric;
    condition: 'GT' | 'LT' | 'EQ'; 
    value: number;
    minAgeMinutes: number; // Only apply if token is older than X
}

export interface LifecycleStage {
    id: string;
    enabled: boolean; // Toggle state
    name: string; // e.g. "Launch Phase", "Maturity"
    description: string;
    
    // Time condition to enter this stage (Age in minutes)
    startAgeMinutes: number; 
    
    // Rules for this specific stage
    minLiquidity: number;
    maxLiquidity: number;
    minMcap: number;
    maxMcap: number;
    minHolders: number;
    maxHolders: number;
    maxTop10Holding: number; // %
}

export interface StrategyConfig {
  // Global Settings
  minAIConfidence: number; 
  trackingDays: number;
  trackingHours: number;

  // Dynamic Stages
  stages: LifecycleStage[];
  
  // Correlation Patterns
  correlations: CorrelationRule[];
}

// --- JOURNAL TYPES ---

export enum JournalCategoryType {
  TOKEN_DEATH = 'TOKEN_DEATH',        // Liquidity drained, price zero
  SCAM_MANIPULATION = 'SCAM_MANIPULATION', // High vol, low holders, unnatural price
  ORGANIC_GROWTH = 'ORGANIC_GROWTH',  // Steady makers, higher lows
  PUMP_DUMP = 'PUMP_DUMP',            // Vertical spike followed by crash
  ACCUMULATION = 'ACCUMULATION'       // Flat price, rising makers
}

export interface JournalPattern {
  category: JournalCategoryType;
  description: string; // AI explanation of what defines this pattern today
  detectedTokens: string[]; // Symbols of tokens that fit this pattern
  keyIndicators: string[]; // e.g. "Liq < $1k", "Buys/Sells > 2.0"
}

export interface JournalEntry {
  id: string;
  date: number; // Timestamp
  summary: string; // Executive summary of the market day
  patterns: JournalPattern[];
}
