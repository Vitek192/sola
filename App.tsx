
import React, { useState, useEffect, useRef } from 'react';
import { AppView, StrategyConfig, Token, TelegramConfig, JournalEntry, SystemLog, DeletedToken, RiskAlert, ServerConfig, CustomAlertRule, LifecycleStage, CorrelationRule } from './types';
import { fetchNewSolanaPools, fetchTokenHistory, fetchTokensBatch } from './services/solanaApi'; 
import { saveHybridState, loadHybridState } from './services/persistence'; // NEW IMPORT
import { Scanner } from './components/Scanner';
import { TokenDetail } from './components/TokenDetail';
import { StrategyView } from './components/StrategyView';
import { TelegramSettings } from './components/TelegramSettings';
import { ServerSettings } from './components/ServerSettings';
import { Portfolio } from './components/Portfolio';
import { PatternJournal } from './components/PatternJournal';
import { SignalFeed } from './components/SignalFeed';
import { SystemLogs } from './components/SystemLogs';
import { Graveyard } from './components/Graveyard';
import { RiskFeed } from './components/RiskFeed';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Connection Status State
  const [syncStatus, setSyncStatus] = useState<'ONLINE' | 'LOCAL' | 'ERROR'>('LOCAL');
  
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [deletedTokens, setDeletedTokens] = useState<DeletedToken[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [customRules, setCustomRules] = useState<CustomAlertRule[]>([]);
  
  const addLog = (type: SystemLog['type'], message: string) => {
    const newLog: SystemLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        type,
        message
    };
    setLogs(prev => [...prev.slice(-199), newLog]); 
  };

  const addRiskAlert = (token: Token, type: RiskAlert['type'], message: string, severity: RiskAlert['severity'], value: string) => {
      if (deletedTokensRef.current.some(dt => dt.id === token.id)) return;
      const recentAlert = riskAlerts.find(a => a.tokenAddress === token.address && a.type === type && (Date.now() - a.timestamp < 10 * 60 * 1000));
      if (recentAlert) return;

      const newAlert: RiskAlert = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          type,
          message,
          severity,
          value
      };
      setRiskAlerts(prev => [newAlert, ...prev]);
      
      if (severity === 'CRITICAL' || type === 'CUSTOM_RULE' || type === 'CORRELATION') {
          sendTelegramNotification(`🚨 ${type}: ${token.symbol} \n${message} \nVal: ${value}`);
      }
  };

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  const handleAddJournalEntry = (entry: JournalEntry) => {
      const updated = [entry, ...journalEntries];
      setJournalEntries(updated);
  };

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({ botToken: '', chatId: '', enabled: false });
  const [serverConfig, setServerConfig] = useState<ServerConfig>({ url: 'http://localhost:3000', apiKey: 'my-secret', autoSave: true, enabled: false });

  const defaultStages: LifecycleStage[] = [
      { id: 'stage_launch', enabled: true, name: '🚀 Launch Zone (0-1h)', description: 'High risk tolerance.', startAgeMinutes: 0, minLiquidity: 500, maxLiquidity: 1000000, minMcap: 0, maxMcap: 10000000, minHolders: 0, maxHolders: 100000, maxTop10Holding: 100 },
      { id: 'stage_growth', enabled: true, name: '📈 Growth Zone (1h-24h)', description: 'Require higher liquidity.', startAgeMinutes: 60, minLiquidity: 2000, maxLiquidity: 5000000, minMcap: 5000, maxMcap: 50000000, minHolders: 10, maxHolders: 100000, maxTop10Holding: 95 },
      { id: 'stage_mature', enabled: true, name: '🏰 Mature Zone (>24h)', description: 'Established tokens.', startAgeMinutes: 1440, minLiquidity: 5000, maxLiquidity: 10000000, minMcap: 10000, maxMcap: 100000000, minHolders: 50, maxHolders: 100000, maxTop10Holding: 80 }
  ];

  const defaultCorrelations: CorrelationRule[] = [
      { id: 'zombie_1', enabled: true, name: 'Zombie Coin', description: 'No trades in 5m but old enough', metric: 'TX_COUNT', condition: 'EQ', value: 0, minAgeMinutes: 30 }
  ];

  const [strategy, setStrategy] = useState<StrategyConfig>({
    minAIConfidence: 75,
    trackingDays: 7,
    trackingHours: 0,
    stages: defaultStages,
    correlations: defaultCorrelations
  });

  const [isScanning, setIsScanning] = useState(true);

  // Refs for access inside intervals
  const telegramConfigRef = useRef(telegramConfig);
  const serverConfigRef = useRef(serverConfig);
  const tokensRef = useRef(tokens);
  const strategyRef = useRef(strategy);
  const deletedTokensRef = useRef(deletedTokens);
  const customRulesRef = useRef(customRules);
  const journalRef = useRef(journalEntries);

  useEffect(() => { telegramConfigRef.current = telegramConfig; }, [telegramConfig]);
  useEffect(() => { serverConfigRef.current = serverConfig; }, [serverConfig]);
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  useEffect(() => { strategyRef.current = strategy; }, [strategy]);
  useEffect(() => { deletedTokensRef.current = deletedTokens; }, [deletedTokens]);
  useEffect(() => { customRulesRef.current = customRules; }, [customRules]);
  useEffect(() => { journalRef.current = journalEntries; }, [journalEntries]);

  // --- HYBRID INIT ---
  useEffect(() => {
    const initApp = async () => {
        // First, check if we have server config in local storage to bootstrap connection
        // (Simplified: we assume default or previously loaded config)
        
        const result = await loadHybridState(serverConfig);
        
        if (result.data) {
            const s = result.data;
            if (s.tokens) setTokens(s.tokens);
            if (s.deletedTokens) setDeletedTokens(s.deletedTokens);
            if (s.strategy) setStrategy(s.strategy);
            if (s.telegram) setTelegramConfig(s.telegram);
            if (s.customRules) setCustomRules(s.customRules);
            if (s.journal) setJournalEntries(s.journal);
            
            if (result.source === 'SERVER') {
                setSyncStatus('ONLINE');
                addLog('SUCCESS', 'Connected to Ubuntu Server.');
            } else {
                setSyncStatus('LOCAL');
                addLog('WARNING', 'Server offline. Using Local Mode.');
            }
        }
    };
    initApp();
  }, []); // Run once

  // --- UNIFIED SAVE FUNCTION ---
  const triggerAutoSave = async () => {
      const state = {
          tokens: tokensRef.current,
          deletedTokens: deletedTokensRef.current,
          journal: journalRef.current,
          strategy: strategyRef.current,
          telegram: telegramConfigRef.current,
          customRules: customRulesRef.current,
          lastUpdated: Date.now()
      };

      const status = await saveHybridState(serverConfigRef.current, state);
      
      if (status === 'SERVER') setSyncStatus('ONLINE');
      else if (status === 'LOCAL') setSyncStatus('LOCAL');
      else setSyncStatus('ERROR');
  };

  // Auto-save on critical config changes (Debounced)
  useEffect(() => {
      const timer = setTimeout(triggerAutoSave, 2000);
      return () => clearTimeout(timer);
  }, [strategy, telegramConfig, customRules]);


  const sendTelegramNotification = async (message: string) => {
    const { botToken, chatId, enabled } = telegramConfigRef.current;
    if (!enabled || !botToken || !chatId) return;
    try {
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(telegramUrl)}`;
        await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        });
    } catch (error) { console.error("Telegram Error", error); }
  };

  const getActiveStage = (ageMs: number, stages: LifecycleStage[]): LifecycleStage => {
      const ageMinutes = ageMs / (1000 * 60);
      const enabledStages = stages.filter(s => s.enabled);
      if (enabledStages.length === 0) return stages[0];
      const sortedStages = [...enabledStages].sort((a, b) => b.startAgeMinutes - a.startAgeMinutes);
      const match = sortedStages.find(s => ageMinutes >= s.startAgeMinutes);
      return match || enabledStages[enabledStages.length - 1]; 
  };

  const processAndFilterTokens = (currentTokens: Token[]): Token[] => {
      const { trackingDays, trackingHours, stages, correlations } = strategyRef.current;
      const validTokens: Token[] = [];
      const newDeadTokens: DeletedToken[] = [];
      const maxAgeMs = (trackingDays * 24 * 60 * 60 * 1000) + (trackingHours * 60 * 60 * 1000);
      const now = Date.now();

      currentTokens.forEach(token => {
          // Reset only risk flags that are transient, but keep persistent ones if needed. 
          // For simplicity we rebuild risk state each cycle.
          token.activeRisk = undefined; 
          
          const latest = token.history[token.history.length - 1];
          const first = token.history[0];
          const ageMs = now - token.createdAt;
          const ageMin = ageMs / 60000;
          let deleteReason = '';

          const currentStage = getActiveStage(ageMs, stages);
          const minLiq = token.strategyOverride?.minLiquidity ?? currentStage.minLiquidity;
          const maxLiq = token.strategyOverride?.maxLiquidity ?? currentStage.maxLiquidity;
          const maxMcap = token.strategyOverride?.maxMcap ?? currentStage.maxMcap;

          // Correlation Logic
          if (correlations) {
              const triggeredDetails: string[] = [];
              correlations.forEach(corr => {
                  if (!corr.enabled) return;
                  if (ageMin < corr.minAgeMinutes) return;

                  let val = 0;
                  switch(corr.metric) {
                      case 'TX_COUNT': val = token.txCount || 0; break;
                      case 'PRICE_CHANGE_5M': val = token.priceChange5m || 0; break;
                      case 'NET_VOLUME': val = token.netVolume || 0; break;
                      case 'VOLUME_24H': val = latest.volume24h; break;
                  }

                  let hit = false;
                  if (corr.condition === 'GT' && val > corr.value) hit = true;
                  if (corr.condition === 'LT' && val < corr.value) hit = true;
                  if (corr.condition === 'EQ' && val === corr.value) hit = true;

                  if (hit) {
                      triggeredDetails.push(`${corr.name} (${val})`);
                      addRiskAlert(token, 'CORRELATION', `Pattern matched: ${corr.name}`, 'WARNING', val.toString());
                  }
              });

              if (triggeredDetails.length > 0) {
                  token.activeRisk = {
                      type: 'CORRELATION',
                      severity: 'WARNING',
                      message: 'Risk Pattern Detected',
                      details: triggeredDetails
                  };
              }
          }

          if (ageMs > maxAgeMs) deleteReason = `Expired (> ${trackingDays}d ${trackingHours}h)`;
          else if (latest.liquidity < minLiq) deleteReason = `Liq < Stage Minimum ($${minLiq})`;
          else if (latest.marketCap > maxMcap) deleteReason = `MCAP > Stage Max ($${maxMcap})`;
          else if (first && first.price > 0 && ((latest.price - first.price) / first.price) < -0.90) deleteReason = 'Rug Pull (-90%)';

          if (deleteReason && !token.isOwned) {
              newDeadTokens.push({ ...token, deletedAt: Date.now(), deletionReason: deleteReason });
          } else {
              validTokens.push(token);
          }
      });

      if (newDeadTokens.length > 0) {
          setDeletedTokens(prev => [...newDeadTokens, ...prev]);
          addLog('WARNING', `Removed ${newDeadTokens.length} tokens via Filters`);
      }
      return validTokens;
  };

  const runMarketCycle = async () => {
    if (!isScanning) return;
    setIsLoading(true);
    setApiError(null);
    
    try {
        const currentTokens = tokensRef.current;
        let updatedTokensMap = new Map<string, Token>();

        if (currentTokens.length > 0) {
            const addressesToUpdate = currentTokens.map(t => t.address);
            const refreshedTokens = await fetchTokensBatch(addressesToUpdate, currentTokens);
            refreshedTokens.forEach(t => {
                const original = currentTokens.find(ct => ct.id === t.id);
                if (original) {
                    t.isOwned = original.isOwned;
                    t.entryPrice = original.entryPrice;
                    t.entryTime = original.entryTime;
                    t.aiAnalysis = original.aiAnalysis;
                    t.strategyOverride = original.strategyOverride;
                }
                updatedTokensMap.set(t.id, t);
            });
        }

        const newPools = await fetchNewSolanaPools();
        newPools.forEach(newPool => {
            if (!updatedTokensMap.has(newPool.id)) updatedTokensMap.set(newPool.id, newPool);
        });

        let finalList = Array.from(updatedTokensMap.values());
        finalList = processAndFilterTokens(finalList);

        finalList.sort((a, b) => {
            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;
            return b.createdAt - a.createdAt;
        });

        setTokens(finalList);
        
        // --- TRIGGER SAVE AFTER SCAN ---
        await triggerAutoSave();
        
    } catch (e: any) {
        if (tokens.length === 0) setApiError(e.message);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => { runMarketCycle(); }, []);
  useEffect(() => { 
      const interval = setInterval(runMarketCycle, 60000); 
      return () => clearInterval(interval);
  }, [isScanning]);

  const handleDeepScan = async (token: Token) => {
      setSelectedTokenId(token.id);
      if (token.history.length < 5) {
          const history = await fetchTokenHistory(token.address);
          if (history.length > 0) {
            setTokens(prev => prev.map(t => t.id === token.id ? { ...t, history: history.map(h => ({...h, liquidity: t.history[t.history.length-1].liquidity})) } : t));
          }
      }
  };

  const handleUpdateToken = (updatedToken: Token) => {
    setTokens(prev => prev.map(t => t.id === updatedToken.id ? updatedToken : t));
  };

  const selectedToken = tokens.find(t => t.id === selectedTokenId) || null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans pb-20">
      <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setSelectedTokenId(null); setCurrentView(AppView.DASHBOARD); }}>
              <div className="bg-gradient-to-r from-solana-green to-solana-purple w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-solana-green/20">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-white hidden sm:block">SolanaSniper<span className="text-solana-purple">AI</span></span>
            </div>
            
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-[50vw]">
                {[AppView.DASHBOARD, AppView.STRATEGY, AppView.SIGNALS, AppView.PORTFOLIO, AppView.ALERTS, AppView.JOURNAL, AppView.GRAVEYARD, AppView.LOGS, AppView.SETTINGS].map(view => (
                    <button key={view} onClick={() => { setSelectedTokenId(null); setCurrentView(view); }} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${currentView === view ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                        {view === AppView.DASHBOARD ? 'Scanner' : view.charAt(0) + view.slice(1).toLowerCase()}
                        {view === AppView.ALERTS && riskAlerts.length > 0 && <span className="ml-1 bg-red-500 text-[10px] px-1.5 rounded-full">{riskAlerts.length}</span>}
                    </button>
                ))}
            </div>

            <div className="flex items-center space-x-3">
                {/* Connection Status Indicator */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] uppercase font-bold tracking-wide transition-all ${
                    syncStatus === 'ONLINE' ? 'bg-green-900/30 border-green-800 text-green-400' : 
                    syncStatus === 'LOCAL' ? 'bg-orange-900/30 border-orange-800 text-orange-400' :
                    'bg-red-900/30 border-red-800 text-red-400'
                }`}>
                    <span className={`w-2 h-2 rounded-full ${syncStatus === 'ONLINE' ? 'bg-green-400' : syncStatus === 'LOCAL' ? 'bg-orange-400' : 'bg-red-400'}`}></span>
                    {syncStatus === 'ONLINE' ? 'Cloud' : 'Local'}
                </div>

                <button onClick={() => setIsScanning(!isScanning)} className={`text-xs px-3 py-1 rounded border transition flex items-center gap-2 ${isScanning ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-red-900/30 border-red-800 text-red-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    {isScanning ? 'Live' : 'Paused'}
                </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedToken ? (
            <TokenDetail token={selectedToken} onUpdateToken={handleUpdateToken} onBack={() => setSelectedTokenId(null)} />
        ) : (
            <>
                {currentView === AppView.DASHBOARD && <Scanner tokens={tokens} onSelectToken={handleDeepScan} deletedTokens={deletedTokens} />}
                {currentView === AppView.STRATEGY && <StrategyView config={strategy} setConfig={setStrategy} />}
                {currentView === AppView.SIGNALS && <SignalFeed tokens={tokens} onUpdateToken={handleUpdateToken} onSelectToken={handleDeepScan} minConfidence={strategy.minAIConfidence} />}
                {currentView === AppView.PORTFOLIO && <Portfolio tokens={tokens} onSelectToken={handleDeepScan} />}
                {currentView === AppView.ALERTS && <RiskFeed alerts={riskAlerts} onClear={() => setRiskAlerts([])} rules={customRules} onAddRule={(r) => setCustomRules([...customRules, r])} onDeleteRule={(id) => setCustomRules(customRules.filter(r => r.id !== id))} onToggleRule={(id) => setCustomRules(customRules.map(r => r.id === id ? {...r, enabled: !r.enabled} : r))} />}
                {currentView === AppView.JOURNAL && <PatternJournal tokens={tokens} entries={journalEntries} onAddEntry={handleAddJournalEntry} />}
                {currentView === AppView.LOGS && <SystemLogs logs={logs} />}
                {currentView === AppView.GRAVEYARD && <Graveyard deletedTokens={deletedTokens} />}
                {currentView === AppView.SETTINGS && (
                    <div className="space-y-8">
                        <TelegramSettings config={telegramConfig} onSave={setTelegramConfig} />
                        <ServerSettings 
                            config={serverConfig} 
                            onSave={setServerConfig} 
                            onForceLoad={() => {
                                // Manual force load logic (Simplified)
                                loadHybridState(serverConfig).then(res => {
                                    if(res.data) {
                                        setTokens(res.data.tokens);
                                        setDeletedTokens(res.data.deletedTokens);
                                        // ... other state updates would go here in a full implementation
                                        addLog('SUCCESS', 'Manual Load Complete');
                                    }
                                });
                            }} 
                            onForceSave={triggerAutoSave} 
                        />
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};

export default App;
