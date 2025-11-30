
import React, { useState, useEffect, useRef } from 'react';
import { AppView, StrategyConfig, Token, TelegramConfig, JournalEntry, SystemLog, DeletedToken, RiskAlert, ServerConfig, CustomAlertRule, LifecycleStage, CorrelationRule, User, AIConfig } from './types';
import { fetchNewSolanaPools, fetchTokenHistory, fetchTokensBatch } from './services/solanaApi'; 
import { saveHybridState, loadHybridState } from './services/persistence';
import { getCurrentUser, logout, updateUserProfile } from './services/auth'; 
import { Scanner } from './components/Scanner';
import { TokenDetail } from './components/TokenDetail';
import { StrategyView } from './components/StrategyView';
import { TelegramSettings } from './components/TelegramSettings';
import { ServerSettings } from './components/ServerSettings';
import { AISettings } from './components/AISettings'; // New Import
import { Portfolio } from './components/Portfolio';
import { PatternJournal } from './components/PatternJournal';
import { SignalFeed } from './components/SignalFeed';
import { SystemLogs } from './components/SystemLogs';
import { Graveyard } from './components/Graveyard';
import { RiskFeed } from './components/RiskFeed';
import { AuthScreen } from './components/AuthScreen';
import { AdminPanel } from './components/AdminPanel';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  useEffect(() => {
      const user = getCurrentUser();
      if (user) setCurrentUser(user);
  }, []);

  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<'ONLINE' | 'LOCAL' | 'ERROR'>('LOCAL');
  
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [deletedTokens, setDeletedTokens] = useState<DeletedToken[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  
  const defaultCustomRules: CustomAlertRule[] = [
      { id: 'rule_pump', name: '🚀 Pump Alert', metric: 'PRICE_CHANGE_5M', condition: 'GT', value: 30, enabled: true },
      { id: 'rule_dump', name: '📉 Dump Alert', metric: 'PRICE_CHANGE_5M', condition: 'LT', value: -20, enabled: true },
      { id: 'rule_whale', name: '🐋 Whale Volume', metric: 'NET_VOLUME', condition: 'GT', value: 50000, enabled: true }
  ];

  const [customRules, setCustomRules] = useState<CustomAlertRule[]>(defaultCustomRules);
  
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
  
  const defaultServerConfig: ServerConfig = { 
      url: 'http://46.32.79.231:3002', 
      apiKey: 'solana-sniper-secret-2024', 
      autoSave: true, 
      enabled: true 
  };
  const [serverConfig, setServerConfig] = useState<ServerConfig>(defaultServerConfig);

  // --- AI CONFIG ---
  // Default to EMPTY keys for security and user customization
  const defaultAIConfig: AIConfig = {
      enabled: true,
      keys: [] 
  };
  const [aiConfig, setAIConfig] = useState<AIConfig>(defaultAIConfig);

  const defaultStages: LifecycleStage[] = [
      { id: 'stage_launch', enabled: true, name: '🚀 Launch Zone (0-1h)', description: 'High risk tolerance.', startAgeMinutes: 0, minLiquidity: 500, maxLiquidity: 1000000, minMcap: 0, maxMcap: 10000000, minHolders: 0, maxHolders: 100000, maxTop10Holding: 100 },
      { id: 'stage_growth', enabled: false, name: '📈 Growth Zone (1h-24h)', description: 'Require higher liquidity.', startAgeMinutes: 60, minLiquidity: 2000, maxLiquidity: 5000000, minMcap: 5000, maxMcap: 50000000, minHolders: 10, maxHolders: 100000, maxTop10Holding: 95 },
      { id: 'stage_mature', enabled: false, name: '🏰 Mature Zone (>24h)', description: 'Established tokens.', startAgeMinutes: 1440, minLiquidity: 5000, maxLiquidity: 10000000, minMcap: 10000, maxMcap: 100000000, minHolders: 50, maxHolders: 100000, maxTop10Holding: 80 }
  ];

  const defaultCorrelations: CorrelationRule[] = [
      { id: 'zombie_1', enabled: true, name: 'Zombie Coin', description: 'No trades in 5m but old enough', metric: 'TX_COUNT', condition: 'EQ', value: 0, minAgeMinutes: 30 }
  ];

  const defaultStrategy: StrategyConfig = {
    minAIConfidence: 75,
    trackingDays: 7,
    trackingHours: 0,
    stages: defaultStages,
    correlations: defaultCorrelations
  };

  const [strategy, setStrategy] = useState<StrategyConfig>(defaultStrategy);

  const [isScanning, setIsScanning] = useState(true);

  // Refs
  const telegramConfigRef = useRef(telegramConfig);
  const serverConfigRef = useRef(serverConfig);
  const aiConfigRef = useRef(aiConfig);
  const tokensRef = useRef(tokens);
  const strategyRef = useRef(strategy);
  const deletedTokensRef = useRef(deletedTokens);
  const customRulesRef = useRef(customRules);
  const journalRef = useRef(journalEntries);

  useEffect(() => { telegramConfigRef.current = telegramConfig; }, [telegramConfig]);
  useEffect(() => { serverConfigRef.current = serverConfig; }, [serverConfig]);
  useEffect(() => { aiConfigRef.current = aiConfig; }, [aiConfig]);
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  useEffect(() => { strategyRef.current = strategy; }, [strategy]);
  useEffect(() => { deletedTokensRef.current = deletedTokens; }, [deletedTokens]);
  useEffect(() => { customRulesRef.current = customRules; }, [customRules]);
  useEffect(() => { journalRef.current = journalEntries; }, [journalEntries]);

  useEffect(() => {
    if (!currentUser) return;

    const initApp = async () => {
        addLog('INFO', `Loading profile for ${currentUser.username}...`);
        
        const result = await loadHybridState(serverConfig, currentUser.id);
        
        if (result.data) {
            const s = result.data;
            if (s.tokens) setTokens(s.tokens);
            if (s.deletedTokens) setDeletedTokens(s.deletedTokens);
            if (s.strategy) setStrategy(s.strategy);
            if (s.telegram) setTelegramConfig(s.telegram);
            if (s.customRules) setCustomRules(s.customRules);
            if (s.journal) setJournalEntries(s.journal);
            // Ideally load AI Config here too, but types need consistent update in AppState.
            // For now, we keep defaults or rely on local storage behavior of component if separated.
        } else {
            setTokens([]);
            setStrategy(defaultStrategy);
            addLog('INFO', 'New user workspace initialized.');
        }
    };
    initApp();
  }, [currentUser]); 

  const triggerAutoSave = async () => {
      if (!currentUser) return;

      const state = {
          tokens: tokensRef.current,
          deletedTokens: deletedTokensRef.current,
          journal: journalRef.current,
          strategy: strategyRef.current,
          telegram: telegramConfigRef.current,
          customRules: customRulesRef.current,
          lastUpdated: Date.now()
      };

      const status = await saveHybridState(serverConfigRef.current, state, currentUser.id);
      
      if (status === 'SERVER') setSyncStatus('ONLINE');
      else if (status === 'LOCAL') setSyncStatus('LOCAL');
      else setSyncStatus('ERROR');
  };

  useEffect(() => {
      if (currentUser) {
          const timer = setTimeout(triggerAutoSave, 2000);
          return () => clearTimeout(timer);
      }
  }, [strategy, telegramConfig, customRules, currentUser, aiConfig]); 

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
    if (!isScanning || !currentUser) return;
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
        await triggerAutoSave();
        
    } catch (e: any) {
        if (tokens.length === 0) setApiError(e.message);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => { 
      const interval = setInterval(runMarketCycle, 60000); 
      return () => clearInterval(interval);
  }, [isScanning, currentUser]);

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

  const handleFactoryReset = () => {
      if(window.confirm("⚠️ RESET TO DEFAULTS?\nThis will revert Strategy, Rules, and Server Config to original settings. Your Token list will be preserved.")) {
          setStrategy(defaultStrategy);
          setCustomRules(defaultCustomRules);
          setServerConfig(defaultServerConfig);
          setAIConfig(defaultAIConfig);
          addLog('WARNING', 'System settings reset to Factory Defaults.');
      }
  };

  const handleChangePassword = () => {
      if (!currentUser) return;
      const newPass = prompt("Enter new password:");
      if (newPass) {
          updateUserProfile(currentUser.id, { passwordHash: newPass });
          alert("Password updated");
      }
  };

  const handleLogout = () => {
      logout();
      setCurrentUser(null);
      setTokens([]);
  };

  if (!currentUser) {
      return <AuthScreen onLoginSuccess={setCurrentUser} />;
  }

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
              <div className="hidden sm:flex flex-col">
                  <span className="font-bold text-xl tracking-tight text-white leading-none">SolanaSniper<span className="text-solana-purple">AI</span></span>
                  <span className="text-[10px] text-gray-500 leading-none">User: {currentUser.username} {currentUser.role === 'ADMIN' && '(Super)'}</span>
              </div>
            </div>
            
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-[50vw]">
                {[AppView.DASHBOARD, AppView.STRATEGY, AppView.SIGNALS, AppView.PORTFOLIO, AppView.ALERTS, AppView.JOURNAL, AppView.GRAVEYARD, AppView.LOGS, AppView.SETTINGS].map(view => (
                    <button key={view} onClick={() => { setSelectedTokenId(null); setCurrentView(view); }} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${currentView === view ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                        {view === AppView.DASHBOARD ? 'Scanner' : view.charAt(0) + view.slice(1).toLowerCase()}
                        {view === AppView.ALERTS && riskAlerts.length > 0 && <span className="ml-1 bg-red-500 text-[10px] px-1.5 rounded-full">{riskAlerts.length}</span>}
                    </button>
                ))}
                {currentUser.role === 'ADMIN' && (
                    <button onClick={() => setCurrentView(AppView.ADMIN_PANEL)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap text-purple-400 hover:text-purple-300 ${currentView === AppView.ADMIN_PANEL ? 'bg-purple-900/50' : ''}`}>
                        Admin
                    </button>
                )}
            </div>

            <div className="flex items-center space-x-3">
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
                
                <button onClick={handleLogout} className="bg-gray-800 hover:bg-gray-700 p-2 rounded text-gray-400 hover:text-white" title="Logout">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedToken ? (
            <TokenDetail token={selectedToken} onUpdateToken={handleUpdateToken} onBack={() => setSelectedTokenId(null)} aiConfig={aiConfig} />
        ) : (
            <>
                {currentView === AppView.DASHBOARD && <Scanner tokens={tokens} onSelectToken={handleDeepScan} deletedTokens={deletedTokens} />}
                {currentView === AppView.STRATEGY && <StrategyView config={strategy} setConfig={setStrategy} />}
                {currentView === AppView.SIGNALS && <SignalFeed tokens={tokens} onUpdateToken={handleUpdateToken} onSelectToken={handleDeepScan} minConfidence={strategy.minAIConfidence} aiConfig={aiConfig} />}
                {currentView === AppView.PORTFOLIO && <Portfolio tokens={tokens} onSelectToken={handleDeepScan} />}
                {currentView === AppView.ALERTS && <RiskFeed alerts={riskAlerts} onClear={() => setRiskAlerts([])} rules={customRules} onAddRule={(r) => setCustomRules([...customRules, r])} onDeleteRule={(id) => setCustomRules(customRules.filter(r => r.id !== id))} onToggleRule={(id) => setCustomRules(customRules.map(r => r.id === id ? {...r, enabled: !r.enabled} : r))} />}
                {currentView === AppView.JOURNAL && <PatternJournal tokens={tokens} entries={journalEntries} onAddEntry={handleAddJournalEntry} aiConfig={aiConfig} />}
                {currentView === AppView.LOGS && <SystemLogs logs={logs} />}
                {currentView === AppView.GRAVEYARD && <Graveyard deletedTokens={deletedTokens} />}
                {currentView === AppView.ADMIN_PANEL && <AdminPanel />}
                {currentView === AppView.SETTINGS && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 shadow-lg">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                👤 My Profile
                            </h2>
                            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                                <div className="mb-4 md:mb-0">
                                    <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Current Session</p>
                                    <p className="text-white font-bold text-lg flex items-center gap-2">
                                        {currentUser.username} 
                                        <span className="text-gray-500 text-sm font-normal">({currentUser.email})</span>
                                        {currentUser.role === 'ADMIN' && <span className="bg-purple-900/50 text-purple-300 text-[10px] px-2 py-0.5 rounded border border-purple-800">SUPER ADMIN</span>}
                                    </p>
                                </div>
                                <button onClick={handleChangePassword} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm text-gray-200 border border-gray-700 transition-all hover:border-gray-500">
                                    Change Password
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            
                            {/* NEW: AI Settings Card */}
                            <div className="h-full">
                                <AISettings config={aiConfig} onSave={setAIConfig} />
                            </div>

                            <div className="h-full">
                                <TelegramSettings config={telegramConfig} onSave={setTelegramConfig} />
                            </div>

                            <div className="h-full xl:col-span-2">
                                <ServerSettings 
                                    config={serverConfig} 
                                    onSave={setServerConfig} 
                                    onForceLoad={() => {
                                        loadHybridState(serverConfig, currentUser.id).then(res => {
                                            if(res.data) {
                                                setTokens(res.data.tokens);
                                                setDeletedTokens(res.data.deletedTokens);
                                                setStrategy(res.data.strategy);
                                                setCustomRules(res.data.customRules || defaultCustomRules);
                                                addLog('SUCCESS', 'Manual Load Complete');
                                            }
                                        });
                                    }} 
                                    onForceSave={triggerAutoSave} 
                                />
                            </div>
                        </div>
                        
                        <div className="bg-red-900/5 border border-red-900/20 p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg shadow-red-900/5">
                            <div className="flex items-center gap-4">
                                <div className="bg-red-900/20 p-3 rounded-full text-2xl border border-red-900/30">⚠️</div>
                                <div>
                                    <h3 className="text-red-400 font-bold text-lg">Danger Zone</h3>
                                    <p className="text-gray-500 text-sm">Reset strategy, rules, and server to default settings. Cannot be undone.</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleFactoryReset}
                                className="px-6 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/50 rounded-lg font-bold transition-all whitespace-nowrap shadow-inner"
                            >
                                ♻️ Reset to Defaults
                            </button>
                        </div>
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};

export default App;
