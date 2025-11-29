
import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { Token } from '../types';
import { analyzeTokenWithGemini } from '../services/gemini';

interface Props {
  token: Token;
  onUpdateToken: (t: Token) => void;
  onBack: () => void;
}

export const TokenDetail: React.FC<Props> = ({ token, onUpdateToken, onBack }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [showGrowthChart, setShowGrowthChart] = useState(false); // Toggle between Price ($) and Growth (%)

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const analysis = await analyzeTokenWithGemini(token);
    onUpdateToken({ ...token, aiAnalysis: analysis, status: analysis.action === 'BUY' ? 'BUY_SIGNAL' : analysis.action === 'SELL' ? 'SELL_SIGNAL' : 'TRACKING' });
    setAnalyzing(false);
  };

  const togglePortfolio = () => {
    if (token.isOwned) {
        // Selling
        if (confirm("Close position? This simulates selling the token.")) {
            onUpdateToken({ ...token, isOwned: false, entryPrice: undefined, entryTime: undefined });
        }
    } else {
        // Buying
        const currentPrice = token.history[token.history.length - 1].price;
        onUpdateToken({ 
            ...token, 
            isOwned: true, 
            entryPrice: currentPrice,
            entryTime: Date.now()
        });
    }
  };

  const latest = token.history[token.history.length - 1];
  const formatTime = (time: number) => new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  // High precision formatter
  const formatPrice = (price: number) => {
    if (price === 0) return '$0.00';
    
    // Scientific for < 1e-10
    if (price < 0.0000000001) {
        return `$${price.toExponential(4)}`;
    }

    if (price < 0.000001) return price.toFixed(14).replace(/\.?0+$/, '');
    if (price < 0.0001) return price.toFixed(10);
    if (price < 0.01) return price.toFixed(8);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  // Helper to calculate Daily Logs
  const getDailyLogs = () => {
      const logs = [];
      const startTime = token.createdAt;
      const dayMs = 24 * 60 * 60 * 1000;
      const history = token.history;
      
      let currentDay = 1;
      let dayStartPrice = history[0]?.price || 0;
      let dayStartMakers = history[0]?.makers || 0;

      // Iterate through days since creation
      while (startTime + (currentDay - 1) * dayMs < Date.now()) {
          const dayEndTime = startTime + currentDay * dayMs;
          // Find the last data point before this day ended
          const dayDataPoints = history.filter(h => h.timestamp <= dayEndTime);
          const lastPoint = dayDataPoints[dayDataPoints.length - 1];
          
          if (lastPoint) {
              const priceChange = ((lastPoint.price - dayStartPrice) / dayStartPrice) * 100;
              const makerChange = lastPoint.makers - dayStartMakers;
              
              logs.push({
                  day: currentDay,
                  price: lastPoint.price,
                  change: priceChange,
                  volume: lastPoint.volume24h,
                  makers: lastPoint.makers,
                  makerChange: makerChange
              });

              // Reset for next loop
              dayStartPrice = lastPoint.price;
              dayStartMakers = lastPoint.makers;
          }
          currentDay++;
          if (currentDay > 14) break; // Limit to 2 weeks
      }
      return logs.reverse(); // Newest first
  };

  const dailyLogs = getDailyLogs();

  // Prepare data for Growth Chart (Normalized to %)
  const growthData = token.history.map(h => ({
      ...h,
      growth: ((h.price - token.history[0].price) / token.history[0].price) * 100
  }));

  // Reference lines for Days (24h markers)
  const dayMarkers = [];
  for(let i=1; i<=7; i++) {
      dayMarkers.push({
          time: token.createdAt + (i * 24 * 60 * 60 * 1000),
          label: `Day ${i}`
      });
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
        </button>
        <div className="flex gap-4">
             <div className="bg-gray-850 px-4 py-2 rounded-lg border border-gray-700">
                <span className="text-gray-400 text-xs uppercase block">Liquidity</span>
                <span className="text-white font-mono font-bold text-solana-green">${latest.liquidity.toLocaleString()}</span>
             </div>
             
             {/* Portfolio Action Button */}
             <button 
                onClick={togglePortfolio}
                className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-transform hover:scale-105 ${
                    token.isOwned 
                    ? 'bg-red-600 hover:bg-red-500 text-white' 
                    : 'bg-solana-green hover:bg-emerald-400 text-gray-900'
                }`}
             >
                {token.isOwned ? 'CLOSE POSITION (SELL)' : 'ADD TO PORTFOLIO (BUY)'}
             </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Charts */}
        <div className="flex-1 space-y-6">
            
            {/* Price Chart */}
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {token.name} 
                            {token.isOwned && <span className="bg-blue-600 text-xs px-2 py-1 rounded-full text-white">OWNED</span>}
                        </h2>
                        <div className="text-3xl font-mono text-solana-green font-bold my-1">
                            ${formatPrice(latest.price)}
                        </div>
                        <div className="flex gap-2 mt-2">
                             <a 
                                href={`https://dexscreener.com/solana/${token.address}`}
                                target="_blank"
                                rel="noreferrer" 
                                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded flex items-center gap-1"
                             >
                                🦅 DexScreener
                             </a>
                             <a 
                                href={`https://www.geckoterminal.com/solana/pools/${token.address}`}
                                target="_blank"
                                rel="noreferrer" 
                                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded flex items-center gap-1"
                             >
                                🦎 GeckoTerminal
                             </a>
                             <a 
                                href={`https://solscan.io/token/${token.address}`} 
                                target="_blank"
                                rel="noreferrer" 
                                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded flex items-center gap-1"
                             >
                                🔍 Solscan
                             </a>
                        </div>
                    </div>
                    
                    {/* Chart Toggle */}
                    <div className="flex bg-gray-800 rounded-lg p-1">
                        <button 
                            onClick={() => setShowGrowthChart(false)}
                            className={`px-3 py-1 text-xs font-bold rounded ${!showGrowthChart ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Price ($)
                        </button>
                        <button 
                            onClick={() => setShowGrowthChart(true)}
                            className={`px-3 py-1 text-xs font-bold rounded ${showGrowthChart ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Growth (%)
                        </button>
                    </div>
                </div>

                <div className="h-[350px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={showGrowthChart ? growthData : token.history}>
                        <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={showGrowthChart ? "#3b82f6" : "#14F195"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={showGrowthChart ? "#3b82f6" : "#14F195"} stopOpacity={0}/>
                        </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                        <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={formatTime} 
                            stroke="#718096" 
                            minTickGap={30} 
                        />
                        <YAxis 
                            domain={['auto', 'auto']} 
                            stroke="#718096" 
                            tickFormatter={showGrowthChart ? (val) => `${val.toFixed(0)}%` : formatPrice} 
                            width={85}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px' }}
                            labelFormatter={(label) => new Date(label).toLocaleString()}
                            formatter={(value: number) => [
                                showGrowthChart ? `${value.toFixed(2)}%` : formatPrice(value), 
                                showGrowthChart ? 'Growth' : 'Price USD'
                            ]}
                        />
                        <Area 
                            type="monotone" 
                            dataKey={showGrowthChart ? "growth" : "price"} 
                            stroke={showGrowthChart ? "#3b82f6" : "#14F195"} 
                            strokeWidth={2} 
                            fill="url(#colorPrice)" 
                        />
                        
                        {/* Day Markers (Vertical Lines) */}
                        {dayMarkers.map((marker, i) => (
                             <text key={i} x={0} y={0} className="hidden" /> // Placeholder, Recharts ReferenceLine is better but trying to keep it simple with existing imports
                        ))}
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Daily Log Table */}
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4">📅 Day-by-Day Lifecycle Log</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-gray-900 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3">Day</th>
                                <th className="px-4 py-3">Closing Price</th>
                                <th className="px-4 py-3">Daily Change</th>
                                <th className="px-4 py-3">Volume</th>
                                <th className="px-4 py-3">Maker Growth</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {dailyLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-center italic">Not enough data for daily logs yet (Need > 24h)</td>
                                </tr>
                            ) : (
                                dailyLogs.map((log) => (
                                    <tr key={log.day} className="hover:bg-gray-800/30">
                                        <td className="px-4 py-3 font-bold text-white">Day {log.day}</td>
                                        <td className="px-4 py-3 font-mono">${formatPrice(log.price)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.change >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                {log.change > 0 ? '+' : ''}{log.change.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">${(log.volume/1000).toFixed(1)}k</td>
                                        <td className="px-4 py-3">
                                            <span className={log.makerChange > 0 ? 'text-green-400' : 'text-gray-500'}>
                                                {log.makerChange > 0 ? '+' : ''}{log.makerChange}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Volume & Makers Chart (Correlation) */}
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 shadow-lg">
                <div className="mb-4 flex justify-between">
                    <h3 className="text-lg font-bold text-white">Makers vs Volume Correlation</h3>
                    <span className="text-xs text-gray-500">Identify Organic Growth vs Bots</span>
                </div>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={token.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                        <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#718096" />
                        <YAxis yAxisId="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #2d3748' }}
                            labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="buys" name="Buys" fill="#14F195" stackId="a" />
                        <Bar yAxisId="left" dataKey="sells" name="Sells" fill="#ef4444" stackId="a" />
                        <Area type="monotone" yAxisId="right" dataKey="makers" name="Makers (Unique)" stroke="#9945FF" fill="none" strokeWidth={2} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Right Column: AI & Metrics */}
        <div className="w-full lg:w-96 space-y-6">
            
            {/* AI Analysis Card */}
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 flex flex-col h-fit">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>🤖</span> Gemini Sniper
                    </h2>
                    <button 
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg ${analyzing ? 'bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-solana-purple to-pink-600 hover:scale-105 text-white'}`}
                    >
                        {analyzing ? 'Analyzing Chain...' : 'Scan Patterns'}
                    </button>
                </div>

                {!token.aiAnalysis ? (
                    <div className="bg-gray-900/50 rounded-lg p-6 text-center border border-dashed border-gray-700">
                        <p className="text-gray-400 text-sm">Run AI to check for Rug Pull probability and Accumulation zones.</p>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <div className={`p-4 rounded-lg border ${
                            token.aiAnalysis.action === 'BUY' ? 'bg-green-900/20 border-green-800' : 
                            token.aiAnalysis.action === 'SELL' ? 'bg-red-900/20 border-red-800' : 'bg-gray-800 border-gray-700'
                        }`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400 text-xs uppercase tracking-wider">Recommendation</span>
                                <span className={`text-lg font-bold ${
                                    token.aiAnalysis.action === 'BUY' ? 'text-green-400' : 
                                    token.aiAnalysis.action === 'SELL' ? 'text-red-400' : 'text-gray-300'
                                }`}>{token.aiAnalysis.action}</span>
                            </div>
                            <div className="w-full bg-gray-700 h-1.5 rounded-full mt-2">
                                <div className="h-full bg-solana-purple rounded-full" style={{ width: `${token.aiAnalysis.confidence}%` }}></div>
                            </div>
                            <div className="text-right text-xs text-solana-purple mt-1">{token.aiAnalysis.confidence}% Confidence</div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pattern Detected</h3>
                            <div className="bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white text-sm">
                                {token.aiAnalysis.patternDetected}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Analysis</h3>
                            <p className="text-gray-300 text-sm leading-relaxed bg-gray-900/30 p-3 rounded border border-gray-800">
                                {token.aiAnalysis.reasoning}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                 <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                     <p className="text-gray-500 text-xs">Total Buys (30m)</p>
                     <p className="text-green-400 font-mono text-xl">{latest.buys}</p>
                 </div>
                 <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                     <p className="text-gray-500 text-xs">Total Sells (30m)</p>
                     <p className="text-red-400 font-mono text-xl">{latest.sells}</p>
                 </div>
                 <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 col-span-2">
                     <div className="flex justify-between items-end">
                        <div>
                            <p className="text-gray-500 text-xs">Maker Growth</p>
                            <p className="text-white font-mono text-xl">{latest.makers} Wallets</p>
                        </div>
                        {/* Simple Sparkline trend indicator */}
                        <div className="text-xs text-gray-400">
                             {token.history.length > 5 && token.history[token.history.length-1].makers > token.history[token.history.length-5].makers 
                                ? <span className="text-green-400 flex items-center">Trending Up ↗</span> 
                                : <span className="text-gray-500">Stable -</span>
                             }
                        </div>
                     </div>
                 </div>
            </div>

        </div>
      </div>
    </div>
  );
};
