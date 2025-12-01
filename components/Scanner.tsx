
import React, { useState, useMemo } from 'react';
import { Token, DeletedToken, AIConfig, StrategyConfig } from '../types';
import { generateComprehensiveReport, ComprehensiveReport } from '../services/gemini';

interface Props {
  tokens: Token[];
  onSelectToken: (t: Token) => void;
  onRemoveToken: (t: Token) => void; // New prop
  deletedTokens?: DeletedToken[];
  aiConfig?: AIConfig;
  onNotify?: (msg: string) => void;
  strategy?: StrategyConfig;
}

// Disjoint buckets for precise daily tracking
type TimeFilter = 'ALL' | '1H' | '1D' | '2D' | '3D' | '4D' | '5D' | '6D' | '7D';
type SortKey = 'symbol' | 'createdAt' | 'price' | 'growth' | 'change5m' | 'txCount' | 'liquidity' | 'marketCap' | 'netVolume';
type SortDirection = 'asc' | 'desc';

// Helper Logic for Potential Tokens (Extracted for performance)
const isPotentialToken = (t: Token) => {
    const latest = t.history[t.history.length - 1];
    const first = t.history[0];
    
    if (!latest) return false;

    // 1. Makers Increasing (Organic Interest)
    const makersGrowth = latest.makers > (first?.makers || 0);
    
    // 2. Not Dumping Hard (Price Stability)
    const stablePrice = (t.priceChange5m || 0) > -2.5;

    // 3. Healthy Vol/Liq Ratio (Not dead, not insane)
    const healthyVol = t.volLiqRatio > 0.05;

    return makersGrowth && stablePrice && healthyVol;
};

export const Scanner: React.FC<Props> = ({ tokens, onSelectToken, onRemoveToken, deletedTokens = [], aiConfig, onNotify, strategy }) => {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('ALL');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [showPotentialOnly, setShowPotentialOnly] = useState(false);
  
  // UI State for Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Sorting State - Default MCAP Descending
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
      key: 'marketCap', 
      direction: 'desc' 
  });

  // Analysis State
  const [analyzingTokenId, setAnalyzingTokenId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{ token: Token; data: ComprehensiveReport } | null>(null);

  const handleSort = (key: SortKey) => {
      let direction: SortDirection = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
  };

  const handleCopyAddress = (e: React.MouseEvent, address: string, id: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(address);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenPhantom = (e: React.MouseEvent, address: string) => {
      e.stopPropagation();
      // Direct Jupiter Link
      const targetUrl = `https://jup.ag/swap/SOL-${address}`;
      window.open(targetUrl, '_blank');
  };

  const handleAnalyze = async (token: Token, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!aiConfig || !aiConfig.enabled || !aiConfig.keys.some(k => k.enabled)) {
          alert("⚠️ AI ключи не активны. Проверьте настройки.");
          return;
      }
      
      setAnalyzingTokenId(token.id);
      try {
          const report = await generateComprehensiveReport(token, aiConfig);
          setReportData({ token, data: report });
          
          if (onNotify) {
              const icon = report.signal.action === 'BUY' ? '🚀' : report.signal.action === 'SELL' ? '🔻' : '🔮';
              onNotify(`${icon} *AI Prediction: ${token.symbol}*\nVerdict: *${report.signal.action}* (${report.signal.confidence}%)\nPattern: ${report.technical.candlePattern} + ${report.signal.patternDetected}\n[View](https://dexscreener.com/solana/${token.address})`);
          }

      } catch (err: any) {
          alert("Analysis Failed: " + err.message);
      } finally {
          setAnalyzingTokenId(null);
      }
  };

  const formatAge = (createdAt: number) => {
      const now = Date.now();
      const diffMs = now - createdAt;
      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ${hours % 24}h`;
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      return `${minutes}m`;
  };

  // --- CSV EXPORT FUNCTION (Excel Friendly) ---
  const handleExportCSV = () => {
      if (processedTokens.length === 0) return;
      
      // Byte Order Mark (BOM) allows Excel to open UTF-8 CSVs correctly (displaying emojis/Russian text)
      const BOM = "\uFEFF"; 
      
      const headers = [
          'Symbol (Тикер)', 
          'Name (Название)',
          'Mint Address (Адрес Контракта)', 
          'Price USD (Цена)', 
          'Liquidity (Ликвидность $)', 
          'Market Cap (Капитализация $)', 
          'Volume 24h (Объем $)', 
          'Transactions (Транзакции)', 
          'Makers (Уник. Кошельки)', 
          'Created Date (Дата Создания)',
          'Age (Возраст)',
          'AI Verdict (Вердикт ИИ)',
          'AI Confidence (Уверенность)',
          'Platform (Платформа)'
      ];

      // Helper to escape CSV fields (wrap in quotes if contains comma)
      const escape = (val: any) => {
          if (val === undefined || val === null) return '""';
          const str = String(val);
          // If string contains comma, quote, or newline, escape quotes and wrap in quotes
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
             return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
      };

      const rows = processedTokens.map(t => {
          const latest = t.history[t.history.length-1];
          const createdAtDate = new Date(t.createdAt).toLocaleString();
          
          return [
              t.symbol,
              t.name,
              t.tokenAddress || t.address,
              latest.price.toFixed(10), // High precision for prices
              latest.liquidity.toFixed(2),
              latest.marketCap.toFixed(2),
              latest.volume24h.toFixed(2),
              t.txCount,
              latest.makers,
              createdAtDate,
              formatAge(t.createdAt),
              t.aiAnalysis ? t.aiAnalysis.action : 'N/A',
              t.aiAnalysis ? `${t.aiAnalysis.confidence}%` : '-',
              t.isPumpFun ? 'Pump.Fun' : 'Standard'
          ].map(escape).join(',');
      });

      // Combine BOM + Headers + Rows
      const csvContent = BOM + [headers.join(','), ...rows].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `solana_sniper_report_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const formatPrice = (price: number) => {
    if (price === undefined || isNaN(price)) return '$0.00';
    if (price === 0) return '$0.00'; 
    if (price < 0.0000000001) { 
        return `$${price.toExponential(2)}`; 
    }
    if (price < 0.000001) return `$${price.toFixed(12).replace(/\.?0+$/, '')}`;
    if (price < 0.0001) return `$${price.toFixed(9)}`; 
    if (price < 0.01) return `$${price.toFixed(6)}`; 
    if (price < 1) return `$${price.toFixed(4)}`; 
    return `$${price.toFixed(2)}`;
  };

  const formatCompact = (num: number) => {
      if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (Math.abs(num) >= 1000) return (num / 1000).toFixed(0) + 'k';
      return num.toFixed(0);
  };

  const checkAge = (createdAt: number, filter: TimeFilter): boolean => {
      const now = Date.now();
      const ageMs = now - createdAt;
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * oneHour;

      switch(filter) {
          case 'ALL': return true;
          case '1H': return ageMs < oneHour;
          case '1D': return ageMs < oneDay; 
          case '2D': return ageMs >= oneDay && ageMs < 2 * oneDay;
          case '3D': return ageMs >= 2 * oneDay && ageMs < 3 * oneDay;
          case '4D': return ageMs >= 3 * oneDay && ageMs < 4 * oneDay;
          case '5D': return ageMs >= 4 * oneDay && ageMs < 5 * oneDay;
          case '6D': return ageMs >= 5 * oneDay && ageMs < 6 * oneDay;
          case '7D': return ageMs >= 6 * oneDay && ageMs < 7 * oneDay;
          default: return true;
      }
  };

  const getCounts = (filter: TimeFilter) => {
      const active = tokens.filter(t => checkAge(t.createdAt, filter)).length;
      const dead = deletedTokens.filter(t => checkAge(t.createdAt, filter)).length;
      return { active, dead };
  };

  // Calculate potential count based on current filter
  const potentialCount = useMemo(() => {
      return tokens.filter(t => checkAge(t.createdAt, activeFilter) && isPotentialToken(t)).length;
  }, [tokens, activeFilter]);

  const processedTokens = useMemo(() => {
      let filtered = tokens.filter(t => checkAge(t.createdAt, activeFilter));
      if (selectedHour !== null) {
          filtered = filtered.filter(t => {
              const date = new Date(t.createdAt);
              return date.getHours() === selectedHour;
          });
      }

      // STRATEGIC POTENTIAL FILTER
      if (showPotentialOnly) {
          filtered = filtered.filter(isPotentialToken);
      }

      return filtered.sort((a, b) => {
          const latestA = a.history[a.history.length - 1];
          const latestB = b.history[b.history.length - 1];
          
          let valA: number | string = 0;
          let valB: number | string = 0;

          // Helper to get life growth
          const getGrowth = (t: Token, latest: any) => {
             const startPrice = t.history.length > 1 ? t.history[0].price : 0;
             if (startPrice > 0) return ((latest.price - startPrice) / startPrice) * 100;
             return t.priceChange24h || 0; // Fallback to API if local history is empty
          };

          switch(sortConfig.key) {
              case 'symbol': valA = a.symbol; valB = b.symbol; break;
              case 'createdAt': valA = a.createdAt; valB = b.createdAt; break;
              case 'price': valA = latestA.price; valB = latestB.price; break;
              case 'growth': valA = getGrowth(a, latestA); valB = getGrowth(b, latestB); break;
              case 'change5m': valA = a.priceChange5m || 0; valB = b.priceChange5m || 0; break;
              case 'txCount': valA = a.txCount || 0; valB = b.txCount || 0; break;
              case 'liquidity': valA = latestA.liquidity; valB = latestB.liquidity; break;
              case 'marketCap': valA = latestA.marketCap; valB = latestB.marketCap; break;
              case 'netVolume': valA = a.netVolume || 0; valB = b.netVolume || 0; break;
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });

  }, [tokens, activeFilter, selectedHour, sortConfig, showPotentialOnly]);

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
      if (sortConfig.key !== colKey) return <span className="ml-0.5 text-gray-700 opacity-0 group-hover:opacity-50 text-[9px]">⇅</span>;
      return <span className="ml-0.5 text-solana-green text-[9px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };
  
  const filters: { key: TimeFilter; label: string }[] = [
      { key: 'ALL', label: 'All' },
      { key: '1H', label: '< 1H' },
      { key: '1D', label: 'Day 1' },
      { key: '2D', label: 'Day 2' },
      { key: '3D', label: 'Day 3' },
      { key: '4D', label: 'Day 4' },
      { key: '5D', label: 'Day 5' },
      { key: '6D', label: 'Day 6' },
      { key: '7D', label: 'Day 7' },
  ];

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-750 shadow-xl flex flex-col w-full relative">
      
      {/* REPORT MODAL */}
      {reportData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setReportData(null)}>
              <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 border-b border-gray-700 flex justify-between items-start">
                      <div>
                          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                              🔮 AI Prophecy: {reportData.token.symbol}
                          </h2>
                          <div className="flex gap-2 mt-2">
                              <span className={`px-3 py-1 rounded text-xs font-bold uppercase ${reportData.data.signal.action === 'BUY' ? 'bg-green-600 text-white' : reportData.data.signal.action === 'SELL' ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                                  Verdict: {reportData.data.signal.action}
                              </span>
                              <span className="px-3 py-1 bg-purple-900/30 text-purple-300 rounded text-xs font-bold border border-purple-500/30">
                                  Confidence: {reportData.data.signal.confidence}%
                              </span>
                          </div>
                      </div>
                      <button onClick={() => setReportData(null)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Signal Analysis */}
                      <div className="space-y-3">
                          <h3 className="text-sm font-bold text-gray-400 uppercase border-b border-gray-800 pb-1">Signal Analysis</h3>
                          <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                              <div className="text-xs text-gray-500 mb-1">Reasoning (Russian)</div>
                              <p className="text-sm text-gray-300">{reportData.data.signal.reasoning}</p>
                          </div>
                          <div>
                              <span className="text-xs text-gray-500">Pattern Detected:</span>
                              <div className="font-mono text-solana-green text-sm">{reportData.data.signal.patternDetected}</div>
                          </div>
                      </div>

                      {/* Technical Analysis */}
                      <div className="space-y-3">
                          <h3 className="text-sm font-bold text-gray-400 uppercase border-b border-gray-800 pb-1">Technical Analysis (Candles)</h3>
                          <div className="grid grid-cols-2 gap-3">
                              <div className="bg-black/20 p-2 rounded">
                                  <div className="text-[10px] text-gray-500">Trend</div>
                                  <div className={`font-bold text-sm ${reportData.data.technical.trend === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>{reportData.data.technical.trend}</div>
                              </div>
                              <div className="bg-black/20 p-2 rounded">
                                  <div className="text-[10px] text-gray-500">Candle Pattern</div>
                                  <div className="font-bold text-sm text-yellow-400">{reportData.data.technical.candlePattern}</div>
                              </div>
                          </div>
                          <div className="text-xs space-y-1 mt-2">
                              <div className="flex justify-between"><span>Support:</span> <span className="text-green-400 font-mono">${reportData.data.technical.supportLevel}</span></div>
                              <div className="flex justify-between"><span>Resistance:</span> <span className="text-red-400 font-mono">${reportData.data.technical.resistanceLevel}</span></div>
                              <div className="flex justify-between"><span>RSI Status:</span> <span className="text-blue-300">{reportData.data.technical.rsiStatus}</span></div>
                          </div>
                      </div>
                  </div>

                  <div className="bg-gray-950 p-4 border-t border-gray-800 flex justify-end gap-3">
                      <button onClick={() => setReportData(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Close</button>
                      <button onClick={() => onSelectToken(reportData.token)} className="px-6 py-2 bg-solana-purple hover:bg-purple-600 text-white font-bold rounded shadow-lg text-sm">Full Chart</button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="bg-gray-900 border-b border-gray-750 rounded-t-xl">
        <div className="px-3 py-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Monitor</h2>
                <div className="flex items-center gap-1 text-[10px] bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                     <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-solana-green opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-solana-green"></span>
                     </span>
                     <span className="text-gray-300">Live</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-xs font-medium transition-colors"
                >
                    📥 Export Excel (CSV)
                </button>
                {/* POTENTIAL BUTTON */}
                <button 
                    onClick={() => setShowPotentialOnly(!showPotentialOnly)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        showPotentialOnly 
                        ? 'bg-gradient-to-r from-solana-green/20 to-solana-purple/20 border border-solana-green text-white shadow-[0_0_10px_rgba(20,241,149,0.2)]' 
                        : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                >
                    <span>{showPotentialOnly ? '💎' : '🎯'}</span>
                    {showPotentialOnly ? `Потенциальные: ${potentialCount} (ON)` : `Потенциальные (${potentialCount})`}
                </button>
            </div>
        </div>

        <div className="flex overflow-x-auto no-scrollbar border-b border-gray-800 bg-gray-950">
            {filters.map((filter) => {
                const { active, dead } = getCounts(filter.key);
                const isActive = activeFilter === filter.key;
                return (
                    <button
                        key={filter.key}
                        onClick={() => { setActiveFilter(filter.key); setSelectedHour(null); }}
                        className={`relative flex-1 min-w-[60px] py-2 flex flex-col items-center justify-center transition-all border-b-2 ${isActive ? 'border-solana-green bg-gray-800' : 'border-transparent hover:bg-gray-900 text-gray-500'}`}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-gray-400'}`}>{filter.label}</span>
                        <div className="flex items-center gap-1 text-[9px] font-mono mt-0.5">
                            <span className="text-solana-green">{active}</span><span className="text-gray-600">|</span><span className="text-red-500">{dead}</span>
                        </div>
                    </button>
                );
            })}
        </div>

        <div className={`bg-gray-900 border-b border-gray-800 transition-all duration-300 overflow-hidden ${activeFilter === 'ALL' ? 'max-h-0 opacity-50' : 'max-h-24 opacity-100'}`}>
            <div className="p-1 overflow-x-auto custom-scrollbar">
                <div className="flex items-center gap-0.5 min-w-max">
                    <button onClick={() => setSelectedHour(null)} className={`px-2 py-1 rounded text-[9px] font-bold uppercase border mr-1 ${selectedHour === null ? 'bg-gray-700 text-white border-gray-600' : 'bg-transparent text-gray-500 border-gray-800 hover:border-gray-600'}`}>All</button>
                    {Array.from({ length: 24 }).map((_, i) => {
                        const countInHour = tokens.filter(t => checkAge(t.createdAt, activeFilter) && new Date(t.createdAt).getHours() === i).length;
                        return (
                            <button key={i} onClick={() => setSelectedHour(i)} className={`flex flex-col items-center justify-center w-6 py-1 rounded border transition-all ${selectedHour === i ? 'bg-solana-green/20 border-solana-green text-white' : countInHour > 0 ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-transparent border-gray-800 text-gray-600 hover:bg-gray-800'}`}>
                                <span className="text-[9px] font-mono leading-none">{i}</span>
                                <div className={`w-3 h-0.5 mt-0.5 rounded-full ${selectedHour === i ? 'bg-solana-green' : countInHour > 0 ? 'bg-gray-500' : 'bg-gray-800'}`}></div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>
      
      {/* TABLE */}
      <div className="w-full">
        {processedTokens.length === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-gray-900/50">
                <p className="text-sm">
                    {showPotentialOnly ? 'No potential gems found matching strategy.' : 'No active tokens.'}
                </p>
            </div>
        ) : (
            <table className="w-full text-left whitespace-nowrap table-auto">
            <thead className="bg-gray-900 uppercase font-medium text-[10px] tracking-wider sticky top-16 z-10 shadow-lg">
                <tr>
                    <th onClick={() => handleSort('symbol')} className="pl-3 pr-1 py-2 bg-gray-900 border-b border-gray-800 cursor-pointer hover:bg-gray-800 group">Asset <SortIcon colKey="symbol" /></th>
                    <th onClick={() => handleSort('createdAt')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 cursor-pointer hover:bg-gray-800 group">Age <SortIcon colKey="createdAt" /></th>
                    <th onClick={() => handleSort('price')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 cursor-pointer hover:bg-gray-800 group text-right">Price <SortIcon colKey="price" /></th>
                    <th onClick={() => handleSort('growth')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 cursor-pointer hover:bg-gray-800 group text-right" title="Growth since detection (Or 24h% if new)">Life % <SortIcon colKey="growth" /></th>
                    <th onClick={() => handleSort('change5m')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 cursor-pointer hover:bg-gray-800 group text-right">Trend <SortIcon colKey="change5m" /></th>
                    <th onClick={() => handleSort('txCount')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 text-center cursor-pointer hover:bg-gray-800 group">Txns <SortIcon colKey="txCount" /></th>
                    <th onClick={() => handleSort('liquidity')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 text-right cursor-pointer hover:bg-gray-800 group">Liq <SortIcon colKey="liquidity" /></th>
                    <th onClick={() => handleSort('marketCap')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 text-right cursor-pointer hover:bg-gray-800 group">MCAP <SortIcon colKey="marketCap" /></th>
                    <th className="px-2 py-2 bg-gray-900 border-b border-gray-800 text-center">AI</th>
                    <th className="px-2 py-2 bg-gray-900 border-b border-gray-800"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
                {processedTokens.map((token) => {
                    const latest = token.history[token.history.length - 1];
                    if (!latest) return null;
                    const ageMinutes = (Date.now() - token.createdAt) / (1000 * 60);
                    const isNew = ageMinutes < 60;
                    
                    // Fixed Growth Logic: If we only have 1 data point locally, use the API's 24h change to avoid "0%"
                    let growth = 0;
                    if (token.history.length > 2) {
                        const startPrice = token.history[0].price;
                        if (startPrice > 0) growth = ((latest.price - startPrice) / startPrice) * 100;
                    } else {
                        growth = token.priceChange24h || 0;
                    }

                    const hasAlert = token.activeRisk !== undefined;
                    const isScanningThis = analyzingTokenId === token.id;

                    // Address to use for copying/trading: Token Mint Address if available, otherwise Pool Address (fallback)
                    const mintAddress = token.tokenAddress || token.address;

                    return (
                        <tr key={token.id} className={`hover:bg-gray-800/50 transition-colors group ${isNew ? 'bg-solana-green/5' : ''}`}>
                            <td className="pl-3 pr-1 py-2">
                                <div className="flex items-center gap-2">
                                    <a href={`https://www.geckoterminal.com/solana/pools/${token.address}`} target="_blank" rel="noreferrer" className="relative flex-shrink-0">
                                        <div className="h-8 w-8 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-white text-xs font-bold shadow-inner">{token.symbol[0]}</div>
                                        {isNew && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-solana-green opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-solana-green"></span></span>}
                                    </a>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-gray-200 text-xs truncate max-w-[80px]">{token.symbol}</span>
                                            {/* RICH TOOLTIP FOR RISK */}
                                            {hasAlert && (
                                                <div className="group/alert relative">
                                                    <span className="text-[10px] animate-pulse cursor-help">
                                                        {token.activeRisk?.severity === 'CRITICAL' ? '⛔' : '⚠️'}
                                                    </span>
                                                    <div className="absolute left-full top-0 ml-2 w-64 bg-gray-900 border border-red-500/50 p-3 rounded-lg shadow-xl z-50 hidden group-hover/alert:block">
                                                        <div className="text-xs font-bold text-red-400 border-b border-gray-700 pb-1 mb-1">{token.activeRisk?.type}</div>
                                                        <div className="text-[10px] text-gray-300">{token.activeRisk?.message}</div>
                                                        {token.activeRisk?.details && token.activeRisk.details.length > 0 && (
                                                            <ul className="mt-2 list-disc list-inside text-[9px] text-gray-400">
                                                                {token.activeRisk.details.map((d, i) => <li key={i}>{d}</li>)}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {token.isPumpFun && <a href={token.pumpFunUrl} target="_blank" rel="noreferrer" className="text-[8px] bg-pink-500/20 text-pink-400 px-1 rounded border border-pink-500/30">💊</a>}
                                        </div>
                                        {/* COPY & PHANTOM SHORTCUTS */}
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <button
                                                onClick={(e) => handleCopyAddress(e, mintAddress, token.id)}
                                                className="text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                                                title={`Copy Address: ${mintAddress}`}
                                            >
                                                {copiedId === token.id ? (
                                                    <span className="text-green-400 text-[9px] font-bold">Copied!</span>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => handleOpenPhantom(e, mintAddress)}
                                                className="text-purple-400 hover:text-white transition-colors"
                                                title="Open in Phantom / Jupiter"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                                                    <circle cx="9" cy="10" r="1.5"/>
                                                    <circle cx="15" cy="10" r="1.5"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-2 py-2"><div className="flex flex-col"><span className="text-white font-mono text-xs">{new Date(token.createdAt).getHours().toString().padStart(2,'0')}:{new Date(token.createdAt).getMinutes().toString().padStart(2,'0')}</span><span className="text-[9px] text-gray-500">{formatAge(token.createdAt)}</span></div></td>
                            <td className="px-2 py-2 text-right"><span className="font-mono text-gray-300 text-xs block">{formatPrice(latest.price)}</span></td>
                            <td className="px-2 py-2 text-right"><span className={`font-bold text-xs ${growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>{growth > 0 ? '+' : ''}{growth.toFixed(0)}%</span></td>
                            <td className="px-2 py-2 text-right"><div className="flex flex-col items-end gap-0.5"><span className={`text-[10px] font-bold ${token.priceChange5m >= 0 ? 'text-green-400' : 'text-red-400'}`}>5m: {token.priceChange5m > 0 ? '+' : ''}{token.priceChange5m?.toFixed(1)}%</span></div></td>
                            <td className="px-2 py-2 text-center"><div className="flex flex-col items-center gap-0.5"><div className="text-xs text-gray-300 font-mono">{token.txCount}</div></div></td>
                            <td className="px-2 py-2 text-right"><span className="text-xs font-mono text-gray-400">${formatCompact(latest.liquidity)}</span></td>
                            <td className="px-2 py-2 text-right"><span className="text-xs font-bold text-solana-purple font-mono">${formatCompact(latest.marketCap)}</span></td>
                            
                            {/* AI ANALYZE BUTTON */}
                            <td className="px-2 py-2 text-center">
                                <button 
                                    onClick={(e) => handleAnalyze(token, e)}
                                    disabled={isScanningThis}
                                    className={`text-[10px] border border-purple-500/30 px-2 py-1 rounded transition-all flex items-center justify-center mx-auto shadow-md ${isScanningThis ? 'bg-purple-900/50 cursor-wait' : 'bg-purple-900/20 hover:bg-purple-900/50 text-purple-300 hover:text-white hover:scale-105'}`}
                                    title="Run Full AI Scan"
                                >
                                    {isScanningThis ? (
                                        <svg className="animate-spin h-3 w-3 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : '🔮'}
                                </button>
                            </td>

                            <td className="px-2 py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onRemoveToken(token); }}
                                        className="text-[10px] bg-gray-900 border border-red-900/30 text-red-400 hover:text-white hover:bg-red-900/40 p-1.5 rounded transition-all"
                                        title="Remove (Dead)"
                                    >
                                        🗑️
                                    </button>
                                    <button onClick={() => onSelectToken(token)} className="text-[10px] bg-gray-800 border border-gray-700 hover:border-solana-green text-gray-300 hover:text-white px-2 py-1 rounded transition-all">View</button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
            </table>
        )}
      </div>
    </div>
  );
};
