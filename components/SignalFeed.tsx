
import React, { useState } from 'react';
import { Token } from '../types';
import { analyzeTokenWithGemini } from '../services/gemini';

interface Props {
  tokens: Token[];
  onUpdateToken: (t: Token) => void;
  onSelectToken: (t: Token) => void;
  minConfidence: number; // New prop
}

export const SignalFeed: React.FC<Props> = ({ tokens, onUpdateToken, onSelectToken, minConfidence }) => {
  const [isAutoMining, setIsAutoMining] = useState(false);

  // 1. Filter tokens using dynamic confidence threshold
  const recommendedTokens = tokens.filter(t => 
    t.aiAnalysis?.action === 'BUY' && 
    t.aiAnalysis.confidence >= minConfidence
  );

  // 2. Logic to auto-scan tokens that look promising but haven't been checked by AI yet
  const handleAutoMine = async () => {
    setIsAutoMining(true);
    
    // Find tokens: Not owned, No AI analysis yet, Liquidity > $2k, Age > 30 mins
    const candidates = tokens.filter(t => 
        !t.isOwned && 
        !t.aiAnalysis && 
        t.history[t.history.length-1].liquidity > 2000 &&
        (Date.now() - t.createdAt) > 30 * 60 * 1000
    );

    // Sort by Volume (Highest first) and take top 5 to save API credits/time
    const topCandidates = candidates
        .sort((a, b) => b.history[b.history.length-1].volume24h - a.history[a.history.length-1].volume24h)
        .slice(0, 5);

    for (const token of topCandidates) {
        const analysis = await analyzeTokenWithGemini(token);
        const updatedToken: Token = { 
            ...token, 
            aiAnalysis: analysis, 
            status: analysis.action === 'BUY' ? 'BUY_SIGNAL' : analysis.action === 'SELL' ? 'SELL_SIGNAL' : 'TRACKING' 
        };
        onUpdateToken(updatedToken);
        // Small delay to not hit rate limits if any
        await new Promise(r => setTimeout(r, 1000));
    }
    
    setIsAutoMining(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-850 p-8 rounded-2xl border border-gray-750 relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                💎 Signal Box (Рекомендации)
            </h1>
            <p className="text-gray-400 max-w-2xl mb-6">
                Здесь находятся монеты, которые прошли полный анализ нашей системы. 
                Мы рекомендуем к покупке только те активы, где ИИ видит паттерн "Накопление" или "Органический рост" 
                с уверенностью <span className="text-solana-green font-bold">&gt; {minConfidence}%</span>.
            </p>
            
            <button 
                onClick={handleAutoMine}
                disabled={isAutoMining}
                className={`px-6 py-3 rounded-lg font-bold shadow-xl flex items-center gap-2 transition-all ${
                    isAutoMining 
                    ? 'bg-gray-700 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-solana-green to-emerald-600 hover:scale-105 text-gray-900'
                }`}
            >
                {isAutoMining ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Ищем Алмазы (AI Mining)...
                    </>
                ) : (
                    <>
                        🚀 Найти новые возможности (Auto-Scan)
                    </>
                )}
            </button>
        </div>
        
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-solana-green/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
      </div>

      {/* Results List (Horizontal Layout) */}
      <div className="flex flex-col gap-4">
        {recommendedTokens.length === 0 ? (
             <div className="text-center py-20 bg-gray-850/50 rounded-xl border border-dashed border-gray-700">
                <p className="text-gray-500 text-lg">Пока нет активных сигналов выше {minConfidence}% уверенности.</p>
                <p className="text-gray-600 text-sm">Нажмите кнопку выше для анализа или понизьте порог в настройках.</p>
             </div>
        ) : (
            recommendedTokens.map(token => (
                <div key={token.id} className="bg-gray-850 rounded-xl border border-solana-green/30 shadow-lg shadow-solana-green/5 overflow-hidden hover:border-solana-green/60 transition-all group">
                    <div className="flex flex-col lg:flex-row">
                        
                        {/* Content Area */}
                        <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                            
                            {/* Identity (Col 1-3) */}
                            <div className="md:col-span-3">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    {token.symbol}
                                    <span className="bg-green-500/20 text-green-400 border border-green-500/50 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">Buy Signal</span>
                                </h3>
                                <p className="text-xs text-gray-500 font-mono mt-1 mb-3 truncate">{token.address}</p>
                                
                                <div className="flex gap-2">
                                    <a 
                                        href={`https://dexscreener.com/solana/${token.address}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1.5 rounded border border-gray-700 transition-colors flex items-center gap-1"
                                    >
                                        🦅 DexScreener
                                    </a>
                                    <a 
                                        href={`https://www.geckoterminal.com/solana/pools/${token.address}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1.5 rounded border border-gray-700 transition-colors flex items-center gap-1"
                                    >
                                        🦎 GeckoTerminal
                                    </a>
                                </div>
                            </div>

                            {/* Analysis (Col 4-9) */}
                            <div className="md:col-span-6 border-t md:border-t-0 md:border-l md:border-r border-gray-800 md:px-6 py-4 md:py-0 border-dashed">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Pattern:</span>
                                    <span className="text-white font-medium bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{token.aiAnalysis?.patternDetected}</span>
                                    <div className="ml-auto flex items-center gap-2">
                                        <div className="h-2 w-16 bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-solana-green shadow-[0_0_10px_rgba(20,241,149,0.5)]" style={{ width: `${token.aiAnalysis?.confidence}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-solana-green">{token.aiAnalysis?.confidence}% Conf.</span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all cursor-default">
                                    {token.aiAnalysis?.reasoning}
                                </p>
                            </div>

                            {/* Metrics (Col 10-12) */}
                            <div className="md:col-span-3 flex justify-between md:block md:space-y-3">
                                <div className="bg-gray-900/50 p-2 rounded border border-gray-800/50">
                                    <span className="text-xs text-gray-500 block uppercase">Liquidity</span>
                                    <span className="text-white font-mono font-bold text-sm">${token.history[token.history.length-1].liquidity.toLocaleString()}</span>
                                </div>
                                <div className="bg-gray-900/50 p-2 rounded border border-gray-800/50">
                                    <span className="text-xs text-gray-500 block uppercase">Active Makers</span>
                                    <span className="text-white font-mono font-bold text-sm">{token.history[token.history.length-1].makers}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Area */}
                        <div className="bg-gray-900/50 p-4 border-t lg:border-t-0 lg:border-l border-gray-800 flex lg:flex-col items-center justify-center gap-3 lg:w-48">
                             <button 
                                onClick={() => onSelectToken(token)}
                                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-bold text-sm transition-colors border border-gray-700 flex items-center justify-center gap-2"
                             >
                                📊 График
                             </button>
                             <button 
                                onClick={() => {
                                    // Simulate Add to Portfolio
                                    const price = token.history[token.history.length-1].price;
                                    onUpdateToken({...token, isOwned: true, entryPrice: price, entryTime: Date.now()});
                                }}
                                className="w-full bg-solana-green hover:bg-emerald-400 text-gray-900 py-3 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-solana-green/10 flex items-center justify-center gap-2"
                             >
                                💰 Купить
                             </button>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};
