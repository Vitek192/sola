
import React, { useState } from 'react';
import { DeletedToken } from '../types';

interface Props {
  deletedTokens: DeletedToken[];
}

// Disjoint buckets matching Scanner
type GraveyardFilter = 'ALL' | '1H' | '1D' | '2D' | '3D' | '5D' | '7D';

export const Graveyard: React.FC<Props> = ({ deletedTokens }) => {
  const [filter, setFilter] = useState<GraveyardFilter>('ALL');

  // Helper for checking age (Same logic as Scanner)
  const checkAge = (createdAt: number, f: GraveyardFilter) => {
      const now = Date.now();
      const ageMs = now - createdAt;
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * oneHour;

      switch(f) {
          case 'ALL': return true;
          case '1H': return ageMs < oneHour;
          case '1D': return ageMs < oneDay; // 0 - 24 hours
          case '2D': return ageMs >= oneDay && ageMs < 2 * oneDay;
          case '3D': return ageMs >= 2 * oneDay && ageMs < 3 * oneDay;
          case '5D': return ageMs >= 4 * oneDay && ageMs < 5 * oneDay;
          case '7D': return ageMs >= 6 * oneDay && ageMs < 7 * oneDay;
          default: return true;
      }
  };

  const getCountFor = (f: GraveyardFilter) => {
      return deletedTokens.filter(t => checkAge(t.createdAt, f)).length;
  };

  const filtered = deletedTokens.filter(t => checkAge(t.createdAt, filter));

  const filters: { key: GraveyardFilter; label: string }[] = [
      { key: 'ALL', label: 'All Time' },
      { key: '1H', label: '< 1 Hour' },
      { key: '1D', label: 'Day 1' },
      { key: '2D', label: 'Day 2' },
      { key: '3D', label: 'Day 3' },
      { key: '5D', label: 'Day 5' },
      { key: '7D', label: 'Day 7' },
  ];

  return (
    <div className="space-y-6">
        {/* FUNNEL HEADER */}
        <div className="bg-gray-850 rounded-xl border border-red-900/30 overflow-hidden shadow-lg">
             <div className="p-6 bg-gradient-to-r from-red-900/20 to-gray-900 border-b border-red-900/20">
                 <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                     🪦 The Graveyard Funnel
                 </h2>
                 <p className="text-gray-400 text-sm mt-1">
                     Tokens that were removed due to Rug Pulls, Liquidity Drains, or failed strategy checks.
                 </p>
             </div>
             
             {/* Funnel Tabs */}
             <div className="flex overflow-x-auto bg-gray-900/50">
                 {filters.map((f) => {
                     const count = getCountFor(f.key);
                     const isActive = filter === f.key;
                     return (
                         <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`flex-1 min-w-[100px] py-4 flex flex-col items-center transition-colors border-b-2 ${
                                isActive 
                                ? 'bg-red-900/20 border-red-500' 
                                : 'bg-transparent border-transparent hover:bg-red-900/10'
                            }`}
                         >
                             <span className={`text-xs font-bold mb-1 uppercase ${isActive ? 'text-white' : 'text-gray-500'}`}>
                                 {f.label}
                             </span>
                             <span className="text-2xl font-mono text-red-500 font-bold">{count}</span>
                         </button>
                     )
                 })}
             </div>
        </div>

        {/* LIST */}
        <div className="bg-gray-850 rounded-xl border border-gray-750 overflow-hidden shadow-xl">
            {filtered.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                    <p>No dead tokens found in this time range.</p>
                </div>
            ) : (
                <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-900 uppercase font-medium text-xs tracking-wider sticky top-0 z-10">
                        <tr>
                        <th className="px-6 py-4 bg-gray-900">Token</th>
                        <th className="px-6 py-4 bg-gray-900">Age at Death</th>
                        <th className="px-6 py-4 bg-gray-900">Lifecycle PnL %</th>
                        <th className="px-6 py-4 bg-gray-900">Cause of Death</th>
                        <th className="px-6 py-4 bg-gray-900">Deleted At</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {filtered.map((token) => {
                            const lifespanMinutes = (token.deletedAt - token.createdAt) / (1000 * 60); 
                            
                            // Calculate Percentage Change (Launch vs Death)
                            const firstPrice = token.history[0]?.price || 0;
                            const lastPrice = token.history[token.history.length - 1]?.price || 0;
                            let percentChange = 0;
                            if (firstPrice > 0) {
                                percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;
                            }

                            return (
                                <tr key={token.id} className="hover:bg-red-900/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded bg-gray-800 flex items-center justify-center text-gray-500 font-bold mr-3 text-xs">
                                                {token.symbol[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-300">{token.symbol}</div>
                                                <div className="text-[10px] text-gray-600 font-mono">{token.address}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-gray-400">
                                        {lifespanMinutes < 60 
                                            ? `${lifespanMinutes.toFixed(0)} mins` 
                                            : `${(lifespanMinutes/60).toFixed(1)} hours`}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`font-bold font-mono ${percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-900/50">
                                            {token.deletionReason}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        {new Date(token.deletedAt).toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
};
