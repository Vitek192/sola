


import React, { useState, useMemo } from 'react';
import { Token, DeletedToken } from '../types';

interface Props {
  tokens: Token[];
  onSelectToken: (t: Token) => void;
  deletedTokens?: DeletedToken[];
}

// Disjoint buckets for precise daily tracking
type TimeFilter = 'ALL' | '1H' | '1D' | '2D' | '3D' | '4D' | '5D' | '6D' | '7D';
type SortKey = 'symbol' | 'createdAt' | 'price' | 'growth' | 'change5m' | 'txCount' | 'liquidity' | 'marketCap' | 'netVolume';
type SortDirection = 'asc' | 'desc';

export const Scanner: React.FC<Props> = ({ tokens, onSelectToken, deletedTokens = [] }) => {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('ALL');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  // Sorting State - Default MCAP Descending
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
      key: 'marketCap', 
      direction: 'desc' 
  });

  const handleSort = (key: SortKey) => {
      let direction: SortDirection = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
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

  const processedTokens = useMemo(() => {
      let filtered = tokens.filter(t => checkAge(t.createdAt, activeFilter));
      if (selectedHour !== null) {
          filtered = filtered.filter(t => {
              const date = new Date(t.createdAt);
              return date.getHours() === selectedHour;
          });
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

  }, [tokens, activeFilter, selectedHour, sortConfig]);

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
    <div className="bg-gray-850 rounded-xl border border-gray-750 shadow-xl flex flex-col w-full">
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
            <div className="p-8 text-center text-gray-500 bg-gray-900/50"><p className="text-sm">No active tokens.</p></div>
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
                    <th onClick={() => handleSort('netVolume')} className="px-2 py-2 bg-gray-900 border-b border-gray-800 text-right cursor-pointer hover:bg-gray-800 group">Net Vol <SortIcon colKey="netVolume" /></th>
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
                            <td className="px-2 py-2 text-right"><span className={`text-xs font-bold ${token.netVolume >= 0 ? 'text-green-400' : 'text-red-400'}`}>{token.netVolume >= 0 ? '+' : ''}${formatCompact(Math.abs(token.netVolume))}</span></td>
                            <td className="px-2 py-2 text-right"><button onClick={() => onSelectToken(token)} className="text-[10px] bg-gray-800 border border-gray-700 hover:border-solana-green text-gray-300 hover:text-white px-2 py-1 rounded transition-all">View</button></td>
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
