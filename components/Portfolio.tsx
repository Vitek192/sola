
import React from 'react';
import { Token } from '../types';

interface Props {
  tokens: Token[];
  onSelectToken: (t: Token) => void;
}

export const Portfolio: React.FC<Props> = ({ tokens, onSelectToken }) => {
  const heldTokens = tokens.filter(t => t.isOwned);

  // Calculate Total PnL
  const totalPnL = heldTokens.reduce((acc, t) => {
    const currentPrice = t.history[t.history.length - 1].price;
    const entryPrice = t.entryPrice || currentPrice;
    const value = (currentPrice - entryPrice) / entryPrice; // Percentage
    // Assuming uniform $1000 bet for visualization
    return acc + (1000 * value);
  }, 0);

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                <p className="text-gray-500 text-sm">Active Positions</p>
                <p className="text-3xl font-bold text-white">{heldTokens.length}</p>
            </div>
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                <p className="text-gray-500 text-sm">Unrealized PnL (Simulated)</p>
                <p className={`text-3xl font-bold font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Based on fixed $1000 entry per coin</p>
            </div>
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                <p className="text-gray-500 text-sm">Notifications</p>
                <p className="text-white font-medium">Telegram Active ✅</p>
            </div>
        </div>

        <div className="bg-gray-850 rounded-xl border border-gray-750 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-750 bg-gray-900/50">
                <h2 className="text-xl font-bold text-white">Your Held Assets</h2>
            </div>
            
            {heldTokens.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                    <p>No active trades. Go to Scanner to find Gems.</p>
                </div>
            ) : (
                <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-900 uppercase font-medium text-xs tracking-wider">
                    <tr>
                    <th className="px-6 py-4">Asset</th>
                    <th className="px-6 py-4">Entry Price</th>
                    <th className="px-6 py-4">Current Price</th>
                    <th className="px-6 py-4">PnL %</th>
                    <th className="px-6 py-4">Time Held</th>
                    <th className="px-6 py-4">AI Recommendation</th>
                    <th className="px-6 py-4">Manage</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                    {heldTokens.map((token) => {
                        const currentPrice = token.history[token.history.length - 1].price;
                        const entryPrice = token.entryPrice || currentPrice;
                        const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
                        const holdTime = Date.now() - (token.entryTime || Date.now());
                        const holdHours = Math.floor(holdTime / (1000 * 60 * 60));

                        return (
                            <tr key={token.id} className="hover:bg-gray-800/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-white">{token.symbol}</td>
                                <td className="px-6 py-4 font-mono text-gray-300">${entryPrice.toFixed(8)}</td>
                                <td className="px-6 py-4 font-mono text-white">${currentPrice.toFixed(8)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded font-bold ${pnl >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4">{holdHours}h</td>
                                <td className="px-6 py-4">
                                    {token.aiAnalysis?.action === 'SELL' 
                                        ? <span className="text-red-500 font-bold animate-pulse">SELL NOW</span> 
                                        : <span className="text-gray-500">HOLD</span>
                                    }
                                </td>
                                <td className="px-6 py-4">
                                    <button 
                                        onClick={() => onSelectToken(token)}
                                        className="text-blue-400 hover:text-white underline"
                                    >
                                        Manage
                                    </button>
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
